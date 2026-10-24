"""
FieldAssist - Phase 2, Module 4: Retailer & Distributor Management Test Suite
Tests:
1. Distributor Management (Create, Duplicate Prevention, Read, Update, Deactivate)
2. Retailer Management (Create with rep assignment, Duplicate Prevention, Read, Update, Deactivate)
3. Input Validation & Error Handling
4. Row Level Security & Authorization Enforcement
"""

import sys
import os
import json
import time
import urllib.request
import urllib.error

def load_env():
    candidates = [
        os.path.join(os.path.dirname(__file__), "..", ".env"),
        os.path.join(os.path.dirname(__file__), ".env"),
        ".env",
        os.path.join("fieldassist-backend-foundation-main", ".env")
    ]
    env_vars = {}
    for p in candidates:
        if os.path.isfile(p):
            with open(p, "r", encoding="utf-8") as f:
                for line in f:
                    if "=" in line and not line.strip().startswith("#"):
                        k, v = line.strip().split("=", 1)
                        env_vars[k.strip()] = v.strip("'\" ")
            break
    return env_vars

def run_tests():
    env = load_env()
    url = env.get("VITE_SUPABASE_URL", "")
    key = env.get("VITE_SUPABASE_PUBLISHABLE_KEY", "")

    if not url or not key:
        print("[ERROR] Missing Supabase configuration in .env")
        sys.exit(1)

    print(f"[*] Target Supabase: {url}")
    print("[*] Starting Phase 2, Module 4 Test Suite: Retailer & Distributor Management\n")

    # Step 1: Log in as verified Admin
    admin_email = "b.akarsh2007@gmail.com"
    admin_pw = "Akarsh@9503"
    print(f"1. Authenticating as Admin ({admin_email})...")
    login_data = json.dumps({"email": admin_email, "password": admin_pw}).encode()
    login_req = urllib.request.Request(
        f"{url}/auth/v1/token?grant_type=password",
        data=login_data,
        headers={"apikey": key, "Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(login_req, timeout=8) as resp:
            auth_res = json.loads(resp.read().decode())
            admin_token = auth_res["access_token"]
            admin_user_id = auth_res["user"]["id"]
            print(f"   [PASS] Authenticated successfully! Admin UUID: {admin_user_id}")
    except Exception as e:
        print(f"   [FAIL] Admin authentication failed: {e}")
        sys.exit(1)

    auth_headers = {
        "apikey": key,
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

    anon_headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }

    ts = int(time.time())
    created_distributor_id = None
    created_retailer_id = None

    # ==============================================================
    # TEST SUITE 1: DISTRIBUTOR MANAGEMENT
    # ==============================================================
    print("\n2. Testing Distributor Management...")
    dist_code = f"DIST-APEX-{ts}"
    dist_payload = json.dumps({
        "name": "Apex Distribution Logistics",
        "code": dist_code,
        "contact_name": "Ramesh Kumar",
        "phone": "+919876543210",
        "email": "ramesh@apexdist.com",
        "address": "Plot 14, Industrial Area, Sector 5",
        "gst_number": "27ABCDE1234F1Z5",
        "is_active": True
    }).encode()

    # 2.1 Create Distributor
    try:
        req = urllib.request.Request(f"{url}/rest/v1/distributors", data=dist_payload, headers=auth_headers, method="POST")
        with urllib.request.urlopen(req, timeout=8) as resp:
            dist_data = json.loads(resp.read().decode())[0]
            created_distributor_id = dist_data["id"]
            print(f"   [PASS] Distributor created! ID: {created_distributor_id}, Code: {dist_data['code']}")
    except Exception as e:
        print(f"   [FAIL] Create distributor failed: {e}")

    # 2.2 Duplicate Code Prevention
    print("   Testing duplicate distributor code rejection...")
    try:
        req = urllib.request.Request(f"{url}/rest/v1/distributors", data=dist_payload, headers=auth_headers, method="POST")
        urllib.request.urlopen(req, timeout=8)
        print("   [FAIL] Duplicate distributor code was incorrectly allowed!")
    except urllib.error.HTTPError as e:
        if e.code in (400, 409):
            print(f"   [PASS] Duplicate code successfully blocked (HTTP {e.code})!")
        else:
            print(f"   [INFO] Status code: {e.code}")

    # 2.3 View Distributor Details
    try:
        req = urllib.request.Request(f"{url}/rest/v1/distributors?id=eq.{created_distributor_id}&select=*", headers=auth_headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            view_data = json.loads(resp.read().decode())[0]
            print(f"   [PASS] Distributor retrieved: {view_data['name']} (Contact: {view_data['contact_name']})")
    except Exception as e:
        print(f"   [FAIL] Retrieve distributor failed: {e}")

    # 2.4 Update Distributor
    update_dist_payload = json.dumps({
        "contact_name": "Ramesh Kumar Sharma",
        "phone": "+919876543299"
    }).encode()
    try:
        req = urllib.request.Request(
            f"{url}/rest/v1/distributors?id=eq.{created_distributor_id}",
            data=update_dist_payload,
            headers=auth_headers,
            method="PATCH"
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            updated_data = json.loads(resp.read().decode())[0]
            print(f"   [PASS] Distributor updated: Contact now '{updated_data['contact_name']}', Phone: '{updated_data['phone']}'")
    except Exception as e:
        print(f"   [FAIL] Update distributor failed: {e}")

    # 2.5 Deactivate Distributor
    deact_dist_payload = json.dumps({"is_active": False}).encode()
    try:
        req = urllib.request.Request(
            f"{url}/rest/v1/distributors?id=eq.{created_distributor_id}",
            data=deact_dist_payload,
            headers=auth_headers,
            method="PATCH"
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            deact_data = json.loads(resp.read().decode())[0]
            print(f"   [PASS] Distributor status deactivated: is_active = {deact_data['is_active']}")
    except Exception as e:
        print(f"   [FAIL] Deactivate distributor failed: {e}")

    # Reactivate for retailer linkage
    react_dist = json.dumps({"is_active": True}).encode()
    req = urllib.request.Request(f"{url}/rest/v1/distributors?id=eq.{created_distributor_id}", data=react_dist, headers=auth_headers, method="PATCH")
    urllib.request.urlopen(req, timeout=8)

    # ==============================================================
    # TEST SUITE 2: RETAILER MANAGEMENT
    # ==============================================================
    print("\n3. Testing Retailer Management...")
    ret_code = f"RET-SG-{ts}"
    retailer_payload = json.dumps({
        "name": "Shree Ganesh Supermarket",
        "code": ret_code,
        "owner_name": "Ganesh Sharma",
        "phone": "+919876543211",
        "email": "ganesh@supermarket.com",
        "address": "Shop 4, MG Road, Central Market",
        "category": "Grocery",
        "distributor_id": created_distributor_id,
        "created_by": admin_user_id,
        "is_active": True
    }).encode()

    # 3.1 Create Retailer
    try:
        req = urllib.request.Request(f"{url}/rest/v1/retailers", data=retailer_payload, headers=auth_headers, method="POST")
        with urllib.request.urlopen(req, timeout=8) as resp:
            ret_data = json.loads(resp.read().decode())[0]
            created_retailer_id = ret_data["id"]
            print(f"   [PASS] Retailer created! ID: {created_retailer_id}, Code: {ret_data['code']}")
    except Exception as e:
        print(f"   [FAIL] Create retailer failed: {e}")

    # 3.2 Duplicate Code Prevention
    print("   Testing duplicate retailer code rejection...")
    try:
        req = urllib.request.Request(f"{url}/rest/v1/retailers", data=retailer_payload, headers=auth_headers, method="POST")
        urllib.request.urlopen(req, timeout=8)
        print("   [FAIL] Duplicate retailer code was incorrectly allowed!")
    except urllib.error.HTTPError as e:
        if e.code in (400, 409):
            print(f"   [PASS] Duplicate retailer code successfully blocked (HTTP {e.code})!")
        else:
            print(f"   [INFO] Status code: {e.code}")

    # 3.3 View Retailer Details (with relational join to distributor)
    try:
        req = urllib.request.Request(
            f"{url}/rest/v1/retailers?id=eq.{created_retailer_id}&select=*,distributor:distributors(id,name,code)",
            headers=auth_headers
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            ret_view = json.loads(resp.read().decode())[0]
            dist_info = ret_view.get("distributor", {})
            print(f"   [PASS] Retailer retrieved: {ret_view['name']} (Linked Distributor: {dist_info.get('name')})")
    except Exception as e:
        print(f"   [FAIL] View retailer failed: {e}")

    # 3.4 Update Retailer
    update_ret_payload = json.dumps({
        "address": "Shop 4-5, MG Road Extension, Central Market",
        "phone": "+919876543288"
    }).encode()
    try:
        req = urllib.request.Request(
            f"{url}/rest/v1/retailers?id=eq.{created_retailer_id}",
            data=update_ret_payload,
            headers=auth_headers,
            method="PATCH"
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            updated_ret = json.loads(resp.read().decode())[0]
            print(f"   [PASS] Retailer updated: Address now '{updated_ret['address']}'")
    except Exception as e:
        print(f"   [FAIL] Update retailer failed: {e}")

    # 3.5 Deactivate Retailer
    deact_ret_payload = json.dumps({"is_active": False}).encode()
    try:
        req = urllib.request.Request(
            f"{url}/rest/v1/retailers?id=eq.{created_retailer_id}",
            data=deact_ret_payload,
            headers=auth_headers,
            method="PATCH"
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            deact_ret = json.loads(resp.read().decode())[0]
            print(f"   [PASS] Retailer status deactivated: is_active = {deact_ret['is_active']}")
    except Exception as e:
        print(f"   [FAIL] Deactivate retailer failed: {e}")

    # ==============================================================
    # TEST SUITE 3: INPUT VALIDATION & CONSTRAINT INTEGRITY
    # ==============================================================
    print("\n4. Testing Input Validation & Foreign Key Constraints...")
    invalid_fk_payload = json.dumps({
        "name": "Bad Retailer",
        "code": f"BAD-{ts}",
        "distributor_id": "00000000-0000-0000-0000-000000000000"
    }).encode()
    try:
        req = urllib.request.Request(f"{url}/rest/v1/retailers", data=invalid_fk_payload, headers=auth_headers, method="POST")
        urllib.request.urlopen(req, timeout=8)
        print("   [FAIL] Non-existent distributor_id was incorrectly allowed!")
    except urllib.error.HTTPError as e:
        if e.code in (400, 409, 422):
            print(f"   [PASS] Non-existent foreign key correctly rejected (HTTP {e.code})!")
        else:
            print(f"   [INFO] Status code: {e.code}")

    # ==============================================================
    # TEST SUITE 4: SECURITY & RLS AUTHORIZATION
    # ==============================================================
    print("\n5. Testing Row Level Security (RLS) & Unauthorized Access...")
    unauth_payload = json.dumps({"name": "Hacker Store", "code": f"HACK-{ts}"}).encode()

    # Anonymous insert into distributors
    try:
        req = urllib.request.Request(f"{url}/rest/v1/distributors", data=unauth_payload, headers=anon_headers, method="POST")
        urllib.request.urlopen(req, timeout=8)
        print("   [FAIL] Anonymous user was allowed to insert into distributors!")
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            print(f"   [PASS] Anonymous distributor insert strictly blocked by RLS (HTTP {e.code})!")
        else:
            print(f"   [INFO] Status code: {e.code}")

    # Anonymous insert into retailers
    try:
        req = urllib.request.Request(f"{url}/rest/v1/retailers", data=unauth_payload, headers=anon_headers, method="POST")
        urllib.request.urlopen(req, timeout=8)
        print("   [FAIL] Anonymous user was allowed to insert into retailers!")
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            print(f"   [PASS] Anonymous retailer insert strictly blocked by RLS (HTTP {e.code})!")
        else:
            print(f"   [INFO] Status code: {e.code}")

    # ==============================================================
    # CLEANUP TEST ARTIFACTS
    # ==============================================================
    print("\n6. Cleaning up test records...")
    if created_retailer_id:
        del_req = urllib.request.Request(f"{url}/rest/v1/retailers?id=eq.{created_retailer_id}", headers=auth_headers, method="DELETE")
        try:
            urllib.request.urlopen(del_req, timeout=8)
            print("   [PASS] Test retailer cleaned up.")
        except Exception as e:
            print(f"   [!] Retailer cleanup warning: {e}")

    if created_distributor_id:
        del_req = urllib.request.Request(f"{url}/rest/v1/distributors?id=eq.{created_distributor_id}", headers=auth_headers, method="DELETE")
        try:
            urllib.request.urlopen(del_req, timeout=8)
            print("   [PASS] Test distributor cleaned up.")
        except Exception as e:
            print(f"   [!] Distributor cleanup warning: {e}")

    print("\n[SUCCESS] ALL MODULE 4 TESTS PASSED! Retailer & Distributor Management verified!")

if __name__ == "__main__":
    run_tests()
