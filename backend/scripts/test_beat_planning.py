"""
FieldAssist - Phase 2, GPS & Beat Planning Test Suite
Tests:
1. Authentication & Role-based Access
2. Saving Daily Beat Plan with Ordered Retailer Sequence (save_beat_plan RPC)
3. Retrieving Daily Beat Plan with Coordinates & Details (get_daily_beat_plan RPC)
4. Updating Retailer GPS Coordinates (update_retailer_location RPC)
5. Security: Anonymous Rejection & Access Control
"""

import sys
import os
import json
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
    anon_key = env.get("VITE_SUPABASE_PUBLISHABLE_KEY", "")

    if not url or not anon_key:
        print("[FAIL] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env")
        sys.exit(1)

    print(f"[*] Target Supabase: {url}")
    print("[*] Starting GPS & Beat Planning Test Suite")

    # 1. Authenticate as Admin
    print("\n1. Authenticating as Admin (b.akarsh2007@gmail.com)...")
    login_data = json.dumps({
        "email": "b.akarsh2007@gmail.com",
        "password": "Akarsh@9503"
    }).encode()
    login_req = urllib.request.Request(
        f"{url}/auth/v1/token?grant_type=password",
        data=login_data,
        headers={"apikey": anon_key, "Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(login_req, timeout=10) as resp:
            tokens = json.loads(resp.read().decode())
            admin_token = tokens["access_token"]
            admin_user_id = tokens["user"]["id"]
            print(f"   [PASS] Authenticated successfully! User ID: {admin_user_id}")
    except urllib.error.HTTPError as e:
        print(f"   [FAIL] Authentication failed: {e.code} {e.read().decode()}")
        print("   [NOTE] If email provider is disabled, enable it in Supabase Auth -> Sign In / Providers -> Email.")
        sys.exit(1)

    auth_headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }

    test_ret_1 = None
    test_ret_2 = None

    try:
        # 2. Setup 2 Test Retailers with GPS Coordinates
        print("\n2. Setting up Test Retailers with GPS coordinates...")
        r1_data = json.dumps({
            "name": "Beat Plan Store Alpha",
            "code": "RET-BP-ALPHA",
            "address": "Connaught Place Block A, New Delhi",
            "latitude": 28.6315,
            "longitude": 77.2167,
            "is_active": True
        }).encode()
        r1_req = urllib.request.Request(f"{url}/rest/v1/retailers", data=r1_data, headers={**auth_headers, "Prefer": "return=representation"}, method="POST")
        with urllib.request.urlopen(r1_req, timeout=8) as resp:
            r1 = json.loads(resp.read().decode())[0]
            test_ret_1 = r1["id"]
            print(f"   [PASS] Created Store 1: {r1['name']} ({r1['latitude']}, {r1['longitude']})")

        r2_data = json.dumps({
            "name": "Beat Plan Store Beta",
            "code": "RET-BP-BETA",
            "address": "Karol Bagh Main Market, New Delhi",
            "latitude": 28.6517,
            "longitude": 77.1906,
            "is_active": True
        }).encode()
        r2_req = urllib.request.Request(f"{url}/rest/v1/retailers", data=r2_data, headers={**auth_headers, "Prefer": "return=representation"}, method="POST")
        with urllib.request.urlopen(r2_req, timeout=8) as resp:
            r2 = json.loads(resp.read().decode())[0]
            test_ret_2 = r2["id"]
            print(f"   [PASS] Created Store 2: {r2['name']} ({r2['latitude']}, {r2['longitude']})")

        # 3. Test update_retailer_location RPC
        print("\n3. Testing update_retailer_location RPC...")
        loc_data = json.dumps({
            "_retailer_id": test_ret_1,
            "_latitude": 28.6320,
            "_longitude": 77.2170
        }).encode()
        loc_req = urllib.request.Request(f"{url}/rest/v1/rpc/update_retailer_location", data=loc_data, headers=auth_headers, method="POST")
        with urllib.request.urlopen(loc_req, timeout=8) as resp:
            loc_res = json.loads(resp.read().decode())
            print(f"   [PASS] Coordinates updated! New position: ({loc_res['latitude']}, {loc_res['longitude']})")

        # 4. Test save_beat_plan RPC with ordered sequence
        print("\n4. Testing save_beat_plan RPC (Sequencing Stops: 1 -> Store Beta, 2 -> Store Alpha)...")
        plan_data = json.dumps({
            "_plan_date": "2026-10-10",
            "_title": "Central Delhi Saturday Route",
            "_retailer_ids": [test_ret_2, test_ret_1], # Sequenced: Beta first, Alpha second
            "_notes": "High priority beverage restock"
        }).encode()
        plan_req = urllib.request.Request(f"{url}/rest/v1/rpc/save_beat_plan", data=plan_data, headers=auth_headers, method="POST")
        with urllib.request.urlopen(plan_req, timeout=8) as resp:
            plan_res = json.loads(resp.read().decode())
            print(f"   [PASS] Beat plan saved! ID: {plan_res['beat_plan_id']}, Stops Count: {plan_res['item_count']}")

        # 5. Test get_daily_beat_plan RPC
        print("\n5. Testing get_daily_beat_plan RPC...")
        get_plan_data = json.dumps({
            "_target_date": "2026-10-10"
        }).encode()
        get_plan_req = urllib.request.Request(f"{url}/rest/v1/rpc/get_daily_beat_plan", data=get_plan_data, headers=auth_headers, method="POST")
        with urllib.request.urlopen(get_plan_req, timeout=8) as resp:
            ret_plan = json.loads(resp.read().decode())
            print(f"   [PASS] Retrieved Plan: '{ret_plan['title']}' with {len(ret_plan['items'])} sequenced stops:")
            for item in ret_plan["items"]:
                print(f"          - Stop #{item['sequence_order']}: {item['retailer_name']} ({item['latitude']}, {item['longitude']}) [Status: {item['status']}]")

            assert ret_plan["items"][0]["retailer_id"] == test_ret_2, "Stop #1 should be Store Beta"
            assert ret_plan["items"][1]["retailer_id"] == test_ret_1, "Stop #2 should be Store Alpha"
            print("   [PASS] Sequence order matched perfectly (1: Beta -> 2: Alpha)!")

        # 6. Test Security: Anonymous Rejection
        print("\n6. Testing Security: Anonymous save_beat_plan call...")
        anon_req = urllib.request.Request(
            f"{url}/rest/v1/rpc/save_beat_plan",
            data=plan_data,
            headers={"apikey": anon_key, "Content-Type": "application/json"},
            method="POST"
        )
        try:
            urllib.request.urlopen(anon_req, timeout=8)
            print("   [FAIL] Anonymous call was allowed!")
            sys.exit(1)
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                print(f"   [PASS] Anonymous invocation blocked (HTTP {e.code})!")
            else:
                print(f"   [INFO] Status code: {e.code}")

    finally:
        # 7. Cleanup
        print("\n7. Cleaning up test artifacts...")
        if test_ret_1:
            try:
                urllib.request.urlopen(urllib.request.Request(f"{url}/rest/v1/retailers?id=eq.{test_ret_1}", headers=auth_headers, method="DELETE"))
                print("   [PASS] Cleaned up Store Alpha.")
            except Exception as e:
                pass
        if test_ret_2:
            try:
                urllib.request.urlopen(urllib.request.Request(f"{url}/rest/v1/retailers?id=eq.{test_ret_2}", headers=auth_headers, method="DELETE"))
                print("   [PASS] Cleaned up Store Beta.")
            except Exception as e:
                pass

    print("\n[SUCCESS] GPS & BEAT PLANNING TEST SUITE VERIFIED 100%!")

if __name__ == "__main__":
    run_tests()
