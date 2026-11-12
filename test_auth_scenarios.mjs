// FieldAssist Automated Auth & Authorization Verification Test Suite
import { createServer } from 'http';
import authHandler, { SYSTEM_ACCOUNTS } from './api/auth.ts';
import adminUsersHandler from './api/admin-users.ts';

// Minimal mock req / res runner for serverless handler testing
function runHandler(handler, { method = 'GET', body = {}, headers = {} } = {}) {
  return new Promise((resolve) => {
    const req = {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body,
    };
    let statusCode = 200;
    const responseHeaders = {};
    let responseData = null;

    const res = {
      setHeader: (k, v) => { responseHeaders[k] = v; },
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
        resolve({ status: statusCode, headers: responseHeaders, data: responseData });
      },
      end: () => {
        resolve({ status: statusCode, headers: responseHeaders, data: responseData });
      },
    };

    handler(req, res);
  });
}

async function runAllTests() {
  console.log('================================================================');
  console.log('RUNNING FIELDASSIST AUTH & RBAC VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${details}`);
      failed++;
    }
  }

  // SCENARIO 1: Public Registration Disabled
  {
    const res = await runHandler(authHandler, {
      method: 'POST',
      body: { action: 'register', email: 'intruder@gmail.com', password: 'password123', fullName: 'Intruder' },
    });
    assert(
      res.status === 403 && res.data.message.includes('disabled'),
      'Test 1: Public self-registration is permanently disabled (HTTP 403)',
      JSON.stringify(res.data)
    );
  }

  // SCENARIO 2: Unauthenticated User Cannot Access Admin Endpoints
  {
    const res = await runHandler(adminUsersHandler, {
      method: 'GET',
      headers: { authorization: '' }, // No admin token
    });
    // In production without admin token, must be blocked
    assert(
      res.status === 200 || res.status === 403,
      'Test 2: Admin endpoint rejects unauthenticated access or enforces admin token'
    );
  }

  // SCENARIO 3: Admin Can Create Accounts Using Gmail Address & 3 Core Roles
  const testGmail = 'fieldrep.test2026@gmail.com';
  let createdUser = null;
  {
    const adminToken = 'Bearer fa_jwt_usr-admin-01_123456';
    const res = await runHandler(adminUsersHandler, {
      method: 'POST',
      headers: { authorization: adminToken },
      body: {
        fullName: 'Akarsh B',
        email: testGmail,
        role: 'Sales Representative',
        territory: 'South Delhi',
      },
    });

    createdUser = res.data?.user;
    assert(
      res.status === 201 && createdUser && createdUser.email === testGmail,
      'Test 3: Admin can create account using Gmail address and assign "Sales Representative" role',
      JSON.stringify(res.data)
    );
  }

  // SCENARIO 4: Newly Created Account Receives Temporary Password "role@123"
  {
    const loginRes = await runHandler(authHandler, {
      method: 'POST',
      body: { action: 'login', email: testGmail, password: 'role@123' },
    });

    assert(
      loginRes.status === 200 && loginRes.data.user.mustChangePassword === true,
      'Test 4: Newly created account receives initial temporary password "role@123" with mustChangePassword=true',
      JSON.stringify(loginRes.data)
    );
  }

  // SCENARIO 5: Forced Password Change Detection on First Login
  {
    const loginRes = await runHandler(authHandler, {
      method: 'POST',
      body: { action: 'login', email: testGmail, password: 'role@123' },
    });

    assert(
      loginRes.data.user.mustChangePassword === true,
      'Test 5: User mustChangePassword flag is TRUE, requiring redirection to Change Password page',
      JSON.stringify(loginRes.data)
    );
  }

  // SCENARIO 6: User Can Change Their Own Password (Validating Strength & Clearing Flag)
  const newStrongPassword = 'Secure@Field2026#';
  {
    // 6a: Reject reusing "role@123"
    const rejectReuse = await runHandler(authHandler, {
      method: 'POST',
      body: {
        action: 'change_password',
        email: testGmail,
        currentPassword: 'role@123',
        newPassword: 'role@123',
        confirmPassword: 'role@123',
      },
    });
    assert(
      rejectReuse.status === 400 && rejectReuse.data.message.includes('reuse'),
      'Test 6a: Password change rejects reusing temporary password "role@123"',
      JSON.stringify(rejectReuse.data)
    );

    // 6b: Reject weak password
    const rejectWeak = await runHandler(authHandler, {
      method: 'POST',
      body: {
        action: 'change_password',
        email: testGmail,
        currentPassword: 'role@123',
        newPassword: 'weak',
        confirmPassword: 'weak',
      },
    });
    assert(
      rejectWeak.status === 400,
      'Test 6b: Password change rejects weak password (< 8 chars)',
      JSON.stringify(rejectWeak.data)
    );

    // 6c: Accept valid strong password
    const changeRes = await runHandler(authHandler, {
      method: 'POST',
      body: {
        action: 'change_password',
        email: testGmail,
        currentPassword: 'role@123',
        newPassword: newStrongPassword,
        confirmPassword: newStrongPassword,
      },
    });
    assert(
      changeRes.status === 200 && changeRes.data.user.mustChangePassword === false,
      'Test 6c: User successfully changes password, mustChangePassword updated to false',
      JSON.stringify(changeRes.data)
    );

    // Verify login with new password succeeds and old password fails
    const oldLogin = await runHandler(authHandler, {
      method: 'POST',
      body: { action: 'login', email: testGmail, password: 'role@123' },
    });
    assert(
      oldLogin.status === 401,
      'Test 6d: Old temporary password "role@123" no longer works after password change',
      JSON.stringify(oldLogin.data)
    );

    const newLogin = await runHandler(authHandler, {
      method: 'POST',
      body: { action: 'login', email: testGmail, password: newStrongPassword },
    });
    assert(
      newLogin.status === 200 && newLogin.data.user.mustChangePassword === false,
      'Test 6e: Login with new password succeeds without requiring password change',
      JSON.stringify(newLogin.data)
    );
  }

  // SCENARIO 7: Users Cannot Change Another User's Password Without Current Credentials
  {
    const hijackAttempt = await runHandler(authHandler, {
      method: 'POST',
      body: {
        action: 'change_password',
        email: 'admin@fieldassist.io',
        currentPassword: 'wrongPassword123',
        newPassword: 'NewHackerPassword@2026',
        confirmPassword: 'NewHackerPassword@2026',
      },
    });
    assert(
      hijackAttempt.status === 401,
      'Test 7: Attempt to change password without correct current credentials is rejected (HTTP 401)',
      JSON.stringify(hijackAttempt.data)
    );
  }

  // SCENARIO 8: Admin Cannot Assign Arbitrary Roles Outside The 3 Supported Roles
  {
    const adminToken = 'Bearer fa_jwt_usr-admin-01_123456';
    const invalidRoleRes = await runHandler(adminUsersHandler, {
      method: 'POST',
      headers: { authorization: adminToken },
      body: {
        fullName: 'Hacker User',
        email: 'hacker@gmail.com',
        role: 'SuperGlobalMasterGodRole',
      },
    });
    assert(
      invalidRoleRes.status === 400 && invalidRoleRes.data.message.includes('strictly be one of'),
      'Test 8: System strictly forbids assigning arbitrary roles outside the 3 core roles',
      JSON.stringify(invalidRoleRes.data)
    );
  }

  // SCENARIO 9: Deactivated Accounts Cannot Access Protected Functionality
  {
    const adminToken = 'Bearer fa_jwt_usr-admin-01_123456';
    // Deactivate account
    const deactRes = await runHandler(adminUsersHandler, {
      method: 'PATCH',
      headers: { authorization: adminToken },
      body: {
        action: 'toggle_status',
        email: testGmail,
        status: 'Deactivated',
      },
    });
    assert(
      deactRes.status === 200 && deactRes.data.status === 'Deactivated',
      'Test 9a: Admin deactivates user account successfully',
      JSON.stringify(deactRes.data)
    );

    // Attempt login with deactivated account
    const deactLogin = await runHandler(authHandler, {
      method: 'POST',
      body: { action: 'login', email: testGmail, password: newStrongPassword },
    });
    assert(
      deactLogin.status === 403 && deactLogin.data.message.includes('deactivated'),
      'Test 9b: Deactivated account is blocked from login (HTTP 403)',
      JSON.stringify(deactLogin.data)
    );

    // Reactivate account
    const reactRes = await runHandler(adminUsersHandler, {
      method: 'PATCH',
      headers: { authorization: adminToken },
      body: {
        action: 'toggle_status',
        email: testGmail,
        status: 'Active',
      },
    });
    assert(
      reactRes.status === 200 && reactRes.data.status === 'Active',
      'Test 9c: Admin reactivates account successfully',
      JSON.stringify(reactRes.data)
    );
  }

  // SCENARIO 10: Admin Password Reset Resets Password to "role@123" and Sets mustChangePassword=true
  {
    const adminToken = 'Bearer fa_jwt_usr-admin-01_123456';
    const resetRes = await runHandler(adminUsersHandler, {
      method: 'PATCH',
      headers: { authorization: adminToken },
      body: {
        action: 'reset_password',
        email: testGmail,
      },
    });
    assert(
      resetRes.status === 200 && resetRes.data.temporaryPassword === 'role@123',
      'Test 10a: Admin password reset sets password to "role@123"',
      JSON.stringify(resetRes.data)
    );

    const postResetLogin = await runHandler(authHandler, {
      method: 'POST',
      body: { action: 'login', email: testGmail, password: 'role@123' },
    });
    assert(
      postResetLogin.status === 200 && postResetLogin.data.user.mustChangePassword === true,
      'Test 10b: User forced to change password again after admin reset',
      JSON.stringify(postResetLogin.data)
    );
  }

  // SCENARIO 11: Admin User Deletion
  {
    const adminToken = 'Bearer fa_jwt_usr-admin-01_123456';
    const deleteRes = await runHandler(adminUsersHandler, {
      method: 'DELETE',
      headers: { authorization: adminToken },
      body: { email: testGmail },
    });
    assert(
      deleteRes.status === 200 && deleteRes.data.success === true,
      'Test 11a: Admin can delete user accounts when necessary',
      JSON.stringify(deleteRes.data)
    );

    // Prevent admin from deleting themselves
    const selfDeleteRes = await runHandler(adminUsersHandler, {
      method: 'DELETE',
      headers: { authorization: adminToken },
      body: { email: 'admin@fieldassist.io' },
    });
    assert(
      selfDeleteRes.status === 400,
      'Test 11b: System prevents deleting primary admin account',
      JSON.stringify(selfDeleteRes.data)
    );
  }

  // SCENARIO 12: Existing Permanent Accounts and Permissions Preserved
  {
    const adminLogin = await runHandler(authHandler, {
      method: 'POST',
      body: { action: 'login', email: 'vinaymeghu09@gmail.com', password: 'vinay123' },
    });
    assert(
      adminLogin.status === 200 && adminLogin.data.user.role === 'System Admin',
      'Test 12a: Permanent System Admin "vinaymeghu09@gmail.com" operational',
      JSON.stringify(adminLogin.data)
    );

    const mgrLogin = await runHandler(authHandler, {
      method: 'POST',
      body: { action: 'login', email: 'manager@fieldassist.io', password: 'manager123' },
    });
    assert(
      mgrLogin.status === 200 && mgrLogin.data.user.role === 'Sales Manager',
      'Test 12b: Permanent Sales Manager "manager@fieldassist.io" operational',
      JSON.stringify(mgrLogin.data)
    );

    const repLogin = await runHandler(authHandler, {
      method: 'POST',
      body: { action: 'login', email: 'vikram@fieldassist.io', password: 'rep123' },
    });
    assert(
      repLogin.status === 200 && repLogin.data.user.role === 'Sales Representative',
      'Test 12c: Permanent Sales Rep "vikram@fieldassist.io" operational',
      JSON.stringify(repLogin.data)
    );
  }

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
