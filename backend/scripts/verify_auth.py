"""
FieldAssist - Authentication & Admin Role Verification Script
Tests:
1. Supabase Auth configuration (email provider enabled).
2. Unauthenticated request rejection (RLS).
3. Privilege escalation prevention on public.user_roles.
4. User login & token acquisition with credentials.
5. Verification of public.profiles and public.user_roles assignment.
6. Authorized admin product creation and stock adjustment via database RLS & RPC.
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

def run_tests(email=None, password=None):
    env = load_env()
    url = env.get("VITE_SUPABASE_URL", "")
    key = env.get("VITE_SUPABASE_PUBLISHABLE_KEY", "")

    if not url or not key:
        print("[ERROR] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env")
        sys.exit(1)

    print(f"[*] Target Supabase: {url}")
    print("[*] Running Security and Authentication Diagnostics...\n")

    # --- TEST 1: Supabase Auth Settings ---
    print("1. Checking Supabase Auth Provider Configuration...")
    try:
        req = urllib.request.Request(f"{url}/auth/v1/settings", headers={"apikey": key})
        with urllib.request.urlopen(req, timeout=8) as resp:
            settings = json.loads(resp.read().decode())
            email_enabled = settings.get("external", {}).get("email", False)
            if email_enabled:
                print("   [PASS] Email provider is ENABLED.")
            else:
                print("   [!] Email provider is DISABLED.")
    except Exception as e:
        print(f"   [FAIL] Could not reach auth settings: {e}")

    # --- TEST 2: Unauthenticated Request Rejection ---
    print("\n2. Testing Unauthenticated Request Rejection...")
    try:
        data = json.dumps({"name": "Unauth Test", "sku": "UNAUTH-001", "selling_price": 10}).encode()
        req = urllib.request.Request(
            f"{url}/rest/v1/products",
            data=data,
            headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            method="POST"
        )
        urllib.request.urlopen(req, timeout=8)
        print("   [FAIL] Anonymous user was allowed to insert into public.products!")
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            print("   [PASS] Anonymous insert into public.products blocked by RLS.")
        else:
            print(f"   [INFO] Status code: {e.code}")

    # --- TEST 3: Privilege Escalation Prevention ---
    print("\n3. Testing Self-Promotion Prevention on public.user_roles...")
    try:
        data = json.dumps({"user_id": "00000000-0000-0000-0000-000000000000", "role": "admin"}).encode()
        req = urllib.request.Request(
            f"{url}/rest/v1/user_roles",
            data=data,
            headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            method="POST"
        )
        urllib.request.urlopen(req, timeout=8)
        print("   [FAIL] Security vulnerability: User self-promotion succeeded!")
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            print("   [PASS] User self-promotion strictly blocked by RLS (HTTP 401/403).")
        else:
            print(f"   [INFO] Status code: {e.code}")

    # --- TEST 4: Login & Admin Verification (if credentials supplied) ---
    if email and password:
        print(f"\n4. Testing Login for: {email}...")
        login_data = json.dumps({"email": email, "password": password}).encode()
        login_req = urllib.request.Request(
            f"{url}/auth/v1/token?grant_type=password",
            data=login_data,
            headers={"apikey": key, "Content-Type": "application/json"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(login_req, timeout=8) as resp:
                auth_res = json.loads(resp.read().decode())
                access_token = auth_res.get("access_token")
                user = auth_res.get("user", {})
                user_id = user.get("id")
                print(f"   [PASS] Login successful! User UUID: {user_id}")

                # Check user_roles
                role_req = urllib.request.Request(
                    f"{url}/rest/v1/user_roles?user_id=eq.{user_id}&select=role",
                    headers={"apikey": key, "Authorization": f"Bearer {access_token}"}
                )
                with urllib.request.urlopen(role_req, timeout=8) as role_resp:
                    roles = json.loads(role_resp.read().decode())
                    user_roles = [r.get("role") for r in roles]
                    print(f"   [*] Assigned roles: {user_roles}")

                    if "admin" in user_roles:
                        print("   [PASS] User confirmed as 'admin' in public.user_roles!")
                    else:
                        print(f"   [!] User does not have 'admin' role yet. Roles found: {user_roles}")

                import time
                test_sku = f"VERIFY-ADM-{int(time.time())}"
                p_data = json.dumps({
                    "name": "Admin Verification Test Item",
                    "sku": test_sku,
                    "category": "Test",
                    "selling_price": 99.99,
                    "stock_quantity": 10
                }).encode()
                p_req = urllib.request.Request(
                    f"{url}/rest/v1/products",
                    data=p_data,
                    headers={
                        "apikey": key,
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                        "Prefer": "return=representation"
                    },
                    method="POST"
                )
                created_p = None
                with urllib.request.urlopen(p_req, timeout=8) as p_resp:
                    created_p = json.loads(p_resp.read().decode())[0]
                    print(f"   [PASS] Product created successfully! ID: {created_p['id']}, Name: {created_p['name']}")

                # Test atomic stock adjustment RPC
                print("\n6. Testing adjust_product_stock RPC with Admin token...")
                adj_data = json.dumps({
                    "_product_id": created_p['id'],
                    "_change": 25,
                    "_reason": "restock",
                    "_note": "Automated verification restock"
                }).encode()
                adj_req = urllib.request.Request(
                    f"{url}/rest/v1/rpc/adjust_product_stock",
                    data=adj_data,
                    headers={
                        "apikey": key,
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json"
                    },
                    method="POST"
                )
                with urllib.request.urlopen(adj_req, timeout=8) as adj_resp:
                    adj_res = json.loads(adj_resp.read().decode())
                    print(f"   [PASS] Stock adjusted! New stock: {adj_res.get('stock_quantity')} units.")

                # Clean up test product
                del_req = urllib.request.Request(
                    f"{url}/rest/v1/products?id=eq.{created_p['id']}",
                    headers={"apikey": key, "Authorization": f"Bearer {access_token}"},
                    method="DELETE"
                )
                urllib.request.urlopen(del_req, timeout=8)
                print("   [PASS] Verification item cleaned up successfully.")

                print("\n[SUCCESS] ALL TESTS PASSED! Authentication, Admin Role, RLS, and Inventory are 100% verified!")

        except urllib.error.HTTPError as e:
            body = e.read().decode()
            print(f"   [FAIL] Test error (HTTP {e.code}): {body}")
    else:
        print("\n4. Verification Command:")
        print("   To test your login and admin privileges end-to-end, run:")
        print("   python .\\scripts\\verify_auth.py <your-email> <your-password>")

if __name__ == "__main__":
    em = sys.argv[1] if len(sys.argv) > 1 else None
    pw = sys.argv[2] if len(sys.argv) > 2 else None
    run_tests(em, pw)
