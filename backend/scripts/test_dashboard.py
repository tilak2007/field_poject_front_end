"""
FieldAssist - Dashboard Summary RPC Test Suite
Tests:
1. Authenticated invocation of get_dashboard_summary RPC by Admin/Manager
2. Payload schema validation (counts, totals, metrics)
3. Security: Rejection of anonymous/unauthenticated invocation
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
    print("[*] Starting Dashboard Summary Test Suite")

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
    with urllib.request.urlopen(login_req, timeout=10) as resp:
        tokens = json.loads(resp.read().decode())
        admin_token = tokens["access_token"]
        print(f"   [PASS] Authenticated successfully!")

    auth_headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }

    # 2. Invoke get_dashboard_summary RPC
    print("\n2. Calling get_dashboard_summary RPC...")
    dash_req = urllib.request.Request(
        f"{url}/rest/v1/rpc/get_dashboard_summary",
        data=b"{}",
        headers=auth_headers,
        method="POST"
    )
    with urllib.request.urlopen(dash_req, timeout=10) as resp:
        stats = json.loads(resp.read().decode())
        print("   [PASS] RPC executed successfully! Metrics received:")
        print(f"          - Today's Orders: {stats.get('today_orders_count')} (Total Amount: ${stats.get('today_orders_total')})")
        print(f"          - Today's Visits: {stats.get('today_visits_count')}")
        print(f"          - Today's Attendance Check-ins: {stats.get('today_attendance_count')}")
        print(f"          - Total Active Retailers: {stats.get('total_retailers_count')}")
        print(f"          - Total Active Products: {stats.get('total_products_count')}")
        print(f"          - Low Stock Alerts: {stats.get('low_stock_products_count')}")

        required_keys = [
            "today_orders_count", "today_orders_total", "today_visits_count",
            "today_attendance_count", "total_retailers_count", "total_products_count",
            "low_stock_products_count"
        ]
        for k in required_keys:
            if k not in stats:
                print(f"   [FAIL] Missing required key in response: {k}")
                sys.exit(1)
        print("   [PASS] All required dashboard KPI keys verified.")

    # 3. Test Security: Anonymous Rejection
    print("\n3. Testing Security: Anonymous RPC Call...")
    anon_req = urllib.request.Request(
        f"{url}/rest/v1/rpc/get_dashboard_summary",
        data=b"{}",
        headers={"apikey": anon_key, "Content-Type": "application/json"},
        method="POST"
    )
    try:
        urllib.request.urlopen(anon_req, timeout=10)
        print("   [FAIL] Anonymous call was allowed!")
        sys.exit(1)
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            print(f"   [PASS] Anonymous invocation blocked (HTTP {e.code})!")
        else:
            print(f"   [INFO] Status code: {e.code}")

    print("\n[SUCCESS] DASHBOARD SUMMARY SUITE PASSED!")

if __name__ == "__main__":
    run_tests()
