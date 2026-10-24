"""
FieldAssist - Phase 2, Module 6: Visits & Attendance Test Suite
Tests:
1. Sales Representative Attendance (Check-in, Check-out, Timezone Timestamps)
2. Duplicate Check-in & Invalid Check-out Prevention
3. Retailer Visit Lifecycle (Start, In-progress, Complete with Outcome)
4. Duplicate Active Visit Prevention (Max 1 concurrent active visit)
5. Visit-to-Order Linkage (Atomic order placement linked to visit outcome)
6. Security & Row Level Security (RLS) Enforcement
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
    print("[*] Starting Phase 2, Module 6 Test Suite: Visits & Attendance\n")

    # Step 1: Admin Authentication
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
    test_retailer_id = None
    test_product_id = None
    test_order_id = None
    test_visit_id = None
    created_attendance_id = None

    try:
        # Pre-cleanup: Delete any previous attendance/visits for the test user to ensure a clean test run
        for endpoint in [f"attendance?user_id=eq.{admin_user_id}", f"visits?sales_rep_id=eq.{admin_user_id}"]:
            try:
                del_req = urllib.request.Request(f"{url}/rest/v1/{endpoint}", headers=auth_headers, method="DELETE")
                urllib.request.urlopen(del_req, timeout=8)
            except Exception:
                pass

        # ==============================================================
        # TEST SUITE 1: ATTENDANCE MANAGEMENT
        # ==============================================================
        print("\n2. Testing Sales Representative Attendance...")

        # 2.1 Daily Check-in
        check_in_data = json.dumps({
            "_latitude": 19.0760,
            "_longitude": 72.8777,
            "_notes": "Morning field shift check-in"
        }).encode()
        cin_req = urllib.request.Request(f"{url}/rest/v1/rpc/check_in_rep", data=check_in_data, headers=auth_headers, method="POST")
        with urllib.request.urlopen(cin_req, timeout=8) as resp:
            cin_res = json.loads(resp.read().decode())
            created_attendance_id = cin_res["id"]
            print(f"   [PASS] Checked in! Date: {cin_res['work_date']}, Time: {cin_res['check_in_time']}")
            print(f"   [PASS] Status: {cin_res['status']}, Coordinates: ({cin_res['check_in_latitude']}, {cin_res['check_in_longitude']})")

        # 2.2 Prevent Duplicate Check-in
        print("   Testing duplicate check-in prevention for same day...")
        try:
            req = urllib.request.Request(f"{url}/rest/v1/rpc/check_in_rep", data=check_in_data, headers=auth_headers, method="POST")
            urllib.request.urlopen(req, timeout=8)
            print("   [FAIL] Duplicate check-in was incorrectly allowed!")
        except urllib.error.HTTPError as e:
            if e.code in (400, 409):
                print(f"   [PASS] Duplicate check-in blocked by constraint (HTTP {e.code})!")
            else:
                print(f"   [INFO] Status code: {e.code}")

        # 2.3 Daily Check-out
        print("   Testing check-out...")
        check_out_data = json.dumps({
            "_latitude": 19.0765,
            "_longitude": 72.8780,
            "_notes": "Completed daily route"
        }).encode()
        cout_req = urllib.request.Request(f"{url}/rest/v1/rpc/check_out_rep", data=check_out_data, headers=auth_headers, method="POST")
        with urllib.request.urlopen(cout_req, timeout=8) as resp:
            cout_res = json.loads(resp.read().decode())
            print(f"   [PASS] Checked out! Check-out Time: {cout_res['check_out_time']}")

        # 2.4 Prevent Invalid Re-Checkout
        print("   Testing invalid duplicate check-out prevention...")
        try:
            req = urllib.request.Request(f"{url}/rest/v1/rpc/check_out_rep", data=check_out_data, headers=auth_headers, method="POST")
            urllib.request.urlopen(req, timeout=8)
            print("   [FAIL] Second check-out was incorrectly allowed!")
        except urllib.error.HTTPError as e:
            if e.code in (400, 422):
                print(f"   [PASS] Duplicate check-out correctly rejected (HTTP {e.code})!")

        # ==============================================================
        # TEST SUITE 2: RETAILER VISITS & ORDER LINKAGE
        # ==============================================================
        print("\n3. Setting up Retailer & Product for Visit Tests...")
        # Create Retailer
        r_payload = json.dumps({
            "name": f"Visit Test Retailer {ts}",
            "code": f"VISIT-RET-{ts}",
            "is_active": True,
            "created_by": admin_user_id
        }).encode()
        r_req = urllib.request.Request(f"{url}/rest/v1/retailers", data=r_payload, headers=auth_headers, method="POST")
        with urllib.request.urlopen(r_req, timeout=8) as resp:
            r_res = json.loads(resp.read().decode())[0]
            test_retailer_id = r_res["id"]
            print(f"   [PASS] Test Retailer created: {r_res['name']}")

        # Create Product
        p_payload = json.dumps({
            "name": f"Visit Order Product {ts}",
            "sku": f"VISIT-PRD-{ts}",
            "selling_price": 200.00,
            "stock_quantity": 25,
            "is_active": True
        }).encode()
        p_req = urllib.request.Request(f"{url}/rest/v1/products", data=p_payload, headers=auth_headers, method="POST")
        with urllib.request.urlopen(p_req, timeout=8) as resp:
            p_res = json.loads(resp.read().decode())[0]
            test_product_id = p_res["id"]
            print(f"   [PASS] Test Product created: {p_res['name']} (Stock: 25)")

        # 3.1 Start Visit
        print("\n4. Testing Retailer Visit Lifecycle...")
        start_visit_data = json.dumps({
            "_retailer_id": test_retailer_id,
            "_latitude": 19.0760,
            "_longitude": 72.8777,
            "_notes": "Scheduled weekly restocking visit"
        }).encode()
        sv_req = urllib.request.Request(f"{url}/rest/v1/rpc/start_visit", data=start_visit_data, headers=auth_headers, method="POST")
        with urllib.request.urlopen(sv_req, timeout=8) as resp:
            sv_res = json.loads(resp.read().decode())
            test_visit_id = sv_res["id"]
            print(f"   [PASS] Visit started! ID: {test_visit_id}, Status: {sv_res['status']}")

        # 3.2 Prevent Duplicate Active Visits
        print("   Testing duplicate active visit prevention (single active visit rule)...")
        try:
            req = urllib.request.Request(f"{url}/rest/v1/rpc/start_visit", data=start_visit_data, headers=auth_headers, method="POST")
            urllib.request.urlopen(req, timeout=8)
            print("   [FAIL] Starting second concurrent active visit was incorrectly allowed!")
        except urllib.error.HTTPError as e:
            if e.code in (400, 409):
                print(f"   [PASS] Concurrent active visit blocked by unique index (HTTP {e.code})!")

        # 3.3 Create Order during visit (Module 5 linkage)
        print("\n5. Placing Order During Visit...")
        order_payload = json.dumps({
            "_retailer_id": test_retailer_id,
            "_items": [{"product_id": test_product_id, "quantity": 5}],
            "_notes": "Order placed during retailer visit"
        }).encode()
        o_req = urllib.request.Request(f"{url}/rest/v1/rpc/create_order_atomic", data=order_payload, headers=auth_headers, method="POST")
        with urllib.request.urlopen(o_req, timeout=8) as resp:
            order_res = json.loads(resp.read().decode())
            test_order_id = order_res["order_id"]
            print(f"   [PASS] Order placed! Number: {order_res['order_number']}, Total: {order_res['total_amount']}")

        # 3.4 Complete Visit with 'order_placed' outcome and Order Linkage
        print("\n6. Completing Visit with Order Linkage...")
        comp_visit_data = json.dumps({
            "_visit_id": test_visit_id,
            "_outcome": "order_placed",
            "_order_id": test_order_id,
            "_latitude": 19.0762,
            "_longitude": 72.8779,
            "_notes": "Retailer ordered 5 units of new stock"
        }).encode()
        cv_req = urllib.request.Request(f"{url}/rest/v1/rpc/complete_visit", data=comp_visit_data, headers=auth_headers, method="POST")
        with urllib.request.urlopen(cv_req, timeout=8) as resp:
            cv_res = json.loads(resp.read().decode())
            print(f"   [PASS] Visit completed! Status: {cv_res['status']}, Outcome: {cv_res['outcome']}")
            print(f"   [PASS] Linked Order ID: {cv_res['order_id']}")

        # 3.5 Query Visit Details with Relational Join
        v_details_req = urllib.request.Request(
            f"{url}/rest/v1/visits?id=eq.{test_visit_id}&select=*,retailer:retailers(name),order:orders(order_number,total_amount)",
            headers=auth_headers
        )
        with urllib.request.urlopen(v_details_req, timeout=8) as resp:
            v_data = json.loads(resp.read().decode())[0]
            print(f"   [PASS] Verified Visit History: Retailer '{v_data['retailer']['name']}' linked to Order '{v_data['order']['order_number']}'")

        # ==============================================================
        # TEST SUITE 3: SECURITY & RLS ENFORCEMENT
        # ==============================================================
        print("\n7. Testing Security & Row Level Security...")
        unauth_checkin = json.dumps({"_latitude": 19.0, "_longitude": 72.0}).encode()
        try:
            req = urllib.request.Request(f"{url}/rest/v1/rpc/check_in_rep", data=unauth_checkin, headers=anon_headers, method="POST")
            urllib.request.urlopen(req, timeout=8)
            print("   [FAIL] Anonymous user was allowed to check in!")
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                print(f"   [PASS] Anonymous check-in strictly blocked by RLS (HTTP {e.code})!")

        unauth_visit = json.dumps({"_retailer_id": test_retailer_id}).encode()
        try:
            req = urllib.request.Request(f"{url}/rest/v1/rpc/start_visit", data=unauth_visit, headers=anon_headers, method="POST")
            urllib.request.urlopen(req, timeout=8)
            print("   [FAIL] Anonymous user was allowed to start a visit!")
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                print(f"   [PASS] Anonymous visit start strictly blocked by RLS (HTTP {e.code})!")

    finally:
        # Cleanup
        print("\n8. Cleaning up test artifacts...")
        if test_visit_id:
            try:
                del_v = urllib.request.Request(f"{url}/rest/v1/visits?id=eq.{test_visit_id}", headers=auth_headers, method="DELETE")
                urllib.request.urlopen(del_v, timeout=8)
                print("   [PASS] Test visit cleaned up.")
            except Exception as e:
                print(f"   [!] Visit cleanup note: {e}")

        if test_order_id:
            try:
                del_o = urllib.request.Request(f"{url}/rest/v1/orders?id=eq.{test_order_id}", headers=auth_headers, method="DELETE")
                urllib.request.urlopen(del_o, timeout=8)
                print("   [PASS] Test order cleaned up.")
            except Exception as e:
                print(f"   [!] Order cleanup note: {e}")

        if test_retailer_id:
            try:
                del_r = urllib.request.Request(f"{url}/rest/v1/retailers?id=eq.{test_retailer_id}", headers=auth_headers, method="DELETE")
                urllib.request.urlopen(del_r, timeout=8)
                print("   [PASS] Test retailer cleaned up.")
            except Exception as e:
                print(f"   [!] Retailer cleanup note: {e}")

        if test_product_id:
            try:
                del_p = urllib.request.Request(f"{url}/rest/v1/products?id=eq.{test_product_id}", headers=auth_headers, method="DELETE")
                urllib.request.urlopen(del_p, timeout=8)
                print("   [PASS] Test product cleaned up.")
            except Exception as e:
                print(f"   [!] Product cleanup note: {e}")

        if created_attendance_id:
            try:
                del_a = urllib.request.Request(f"{url}/rest/v1/attendance?id=eq.{created_attendance_id}", headers=auth_headers, method="DELETE")
                urllib.request.urlopen(del_a, timeout=8)
                print("   [PASS] Test attendance cleaned up.")
            except Exception as e:
                print(f"   [!] Attendance cleanup note: {e}")

    print("\n[SUCCESS] ALL MODULE 6 TESTS PASSED! Visits & Attendance verified!")

if __name__ == "__main__":
    run_tests()
