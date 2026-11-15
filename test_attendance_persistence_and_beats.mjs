import { attendanceApi } from './src/api/attendanceApi.ts';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ibzycpftqmngcrmgpsed.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlienljcGZ0cW1uZ2NybWdwc2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5ODcxMzksImV4cCI6MjEwODU2MzEzOX0.O_FyD60-X_khKoPajDBA1xn_Gu87cmOffoB5wFhfrl8';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Mock LocalStorage in Node environment
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
globalThis.localStorage = localStorageMock;

async function runTests() {
  console.log('================================================================');
  console.log('RUNNING ATTENDANCE PERSISTENCE & BEAT PLANS TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  const testUser = {
    id: 'f5e9c639-2bee-4bbb-993a-61d450242a0f',
    name: 'Nagarjun B.G.',
    email: 'nagarjunbg183@gmail.com',
    role: 'Sales Representative',
    territory: 'Bengaluru South',
    region: 'South Zone (Bengaluru)',
  };

  const today = new Date().toISOString().split('T')[0];

  // Test 1: Ensure rep exists in Supabase sales_reps
  try {
    const repId = await attendanceApi.ensureRepExists(testUser);
    assert(repId === 'rep-nagarjun' || repId === testUser.id, 'Test 1: Rep successfully mapped/registered in Supabase sales_reps');
  } catch (e) {
    assert(false, 'Test 1: ' + e.message);
  }

  // Test 2: Check-in sets synchronous cache immediately
  try {
    const punchRecord = await attendanceApi.checkIn({
      user: testUser,
      latitude: 12.9298,
      longitude: 77.5832,
      locationName: 'Bengaluru South (Jayanagar 4th Block)',
      notes: 'Morning shift beat check-in',
    });

    assert(punchRecord.status === 'Present', 'Test 2a: Punch-in status is "Present"');
    assert(Boolean(punchRecord.check_in_time), 'Test 2b: Punch-in has valid ISO timestamp');

    // Test 3: Synchronous cache retrieval (simulating page navigation back to Attendance)
    const cached = attendanceApi.getCachedTodayAttendance(testUser);
    assert(cached !== null, 'Test 3a: Synchronous cache read succeeds immediately upon page mount');
    assert(cached?.status === 'Present', 'Test 3b: Cached record retains "Present" status (no revert to "Check In")');
    assert(Boolean(cached?.check_in_time), 'Test 3c: Cached check_in_time is present, showing "Check Out" button');
  } catch (e) {
    assert(false, 'Test 2/3: ' + e.message);
  }

  // Test 4: Supabase table attendance stores the record
  try {
    const { data: sbRecord, error: sbErr } = await sb
      .from('attendance')
      .select('*')
      .eq('work_date', today)
      .eq('rep_id', 'rep-nagarjun')
      .maybeSingle();

    assert(!sbErr && sbRecord !== null, 'Test 4a: Supabase attendance table contains verified check-in row');
    assert(sbRecord?.latitude === 12.9298 && sbRecord?.longitude === 77.5832, 'Test 4b: Supabase record has real GPS coordinates');
  } catch (e) {
    assert(false, 'Test 4: ' + e.message);
  }

  // Test 5: Punch-Out updates status to Completed and calculates working hours
  try {
    const current = attendanceApi.getCachedTodayAttendance(testUser);
    const checkoutRecord = await attendanceApi.checkOut({
      user: testUser,
      todayAttendance: current,
      notes: 'Route finished successfully',
      endLocation: 'Bengaluru South Depot',
    });

    assert(checkoutRecord.status === 'Completed', 'Test 5a: Punch-out updates status to "Completed"');
    assert(Boolean(checkoutRecord.check_out_time), 'Test 5b: Punch-out sets valid check_out_time timestamp');
    assert(checkoutRecord.working_hours >= 0.1, 'Test 5c: Working hours calculated correctly: ' + checkoutRecord.working_hours + ' hrs');

    const updatedCached = attendanceApi.getCachedTodayAttendance(testUser);
    assert(updatedCached?.status === 'Completed', 'Test 5d: LocalStorage updated with Completed status');
  } catch (e) {
    assert(false, 'Test 5: ' + e.message);
  }

  // Test 6: Role-based attendance history visibility
  try {
    // 6a: Rep only sees own records
    const repHistory = await attendanceApi.getAttendanceHistory(testUser);
    const hasOtherReps = repHistory.some((h) => h.repName !== testUser.name && h.repId !== 'rep-nagarjun' && !h.repName.includes('Nagarjun'));
    assert(!hasOtherReps, 'Test 6a: Sales Representative only sees their own shift logs');

    // 6b: Manager for Bengaluru sees Bengaluru reps
    const managerUser = {
      id: 'mgr-blr',
      name: 'Bengaluru Area Manager',
      email: 'manager.blr@fieldassist.io',
      role: 'Sales Manager',
      territory: 'Bengaluru South',
      region: 'South Zone (Bengaluru)',
    };
    const mgrHistory = await attendanceApi.getAttendanceHistory(managerUser);
    const hasMumbaiRep = mgrHistory.some((h) => h.territory === 'Mumbai South' || h.startLocation.includes('Mumbai'));
    assert(!hasMumbaiRep, 'Test 6b: Bengaluru Sales Manager CANNOT see Mumbai reps (territory isolation verified)');

    // 6c: System Admin sees nationwide
    const adminUser = {
      id: 'admin-sys',
      name: 'System Administrator',
      email: 'vinaymeghu09@gmail.com',
      role: 'System Admin',
    };
    const adminHistory = await attendanceApi.getAttendanceHistory(adminUser);
    assert(adminHistory.length >= 1, 'Test 6c: System Admin sees nationwide attendance history logs');
  } catch (e) {
    assert(false, 'Test 6: ' + e.message);
  }

  // Test 7: Reset punch for testing
  try {
    await attendanceApi.resetTodayPunch(testUser);
    const afterReset = attendanceApi.getCachedTodayAttendance(testUser);
    assert(afterReset === null, 'Test 7: Reset punch clears today record allowing clean re-test');
  } catch (e) {
    assert(false, 'Test 7: ' + e.message);
  }

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runTests();
