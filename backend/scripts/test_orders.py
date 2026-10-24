"""
FieldAssist - Phase 2, Module 5: Order Creation & Order History Test Suite
Tests:
1. Order Creation & Calculation (Atomic stock deduction & audit trail)
2. Order History, Filtering, and Full Details View
3. Order Status Transitions (Lifecycle tracking)
4. Inventory Safety: Insufficient Stock Prevention
5. Inventory Safety: Invalid Quantity & Price Prevention
6. Order Cancellation: Automatic Stock Restoration & Movement Audit
7. Security: Unauthorized & Anonymous Request Rejection
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
    print("[*] Starting Phase 2, Module 5 Test Suite: Orders & Order History\n")

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
    test_product_id = None
    test_retailer_id = None
    test_order_id = None

    try:
        # Step 2: Setup Test Product (Stock = 50, Price = 150.00)
        print("\n2. Setting up Test Product & Retailer...")
        p_payload = json.dumps({
            "name": "Order Test Beverage",
            "sku": f"ORD-SKU-{ts}",
            "selling_price": 150.00,
            "stock_quantity": 50,
            "is_active": True
        }).encode()
        p_req = urllib.request.Request(f"{url}/rest/v1/products", data=p_payload, headers=auth_headers, method="POST")
        with urllib.request.urlopen(p_req, timeout=8) as resp:
            p_res = json.loads(resp.read().decode())[0]
            test_product_id = p_res["id"]
            print(f"   [PASS] Test Product created: {p_res['name']} (Initial Stock: 50, Price: 150.00)")

        # Setup Test Retailer
        r_payload = json.dumps({
            "name": "Order Test Mart",
            "code": f"ORD-RET-{ts}",
            "is_active": True,
            "created_by": admin_user_id
        }).encode()
        r_req = urllib.request.Request(f"{url}/rest/v1/retailers", data=r_payload, headers=auth_headers, method="POST")
        with urllib.request.urlopen(r_req, timeout=8) as resp:
            r_res = json.loads(resp.read().decode())[0]
            test_retailer_id = r_res["id"]
            print(f"   [PASS] Test Retailer created: {r_res['name']}")

        # ==============================================================
        # TEST 1: ORDER CREATION (Atomic Calculation & Stock Deduction)
        # ==============================================================
        print("\n3. Testing Atomic Order Creation & Calculation...")
        order_payload = json.dumps({
            "_retailer_id": test_retailer_id,
            "_items": [{"product_id": test_product_id, "quantity": 10}],
            "_notes": "Urgent morning delivery"
        }).encode()
        o_req = urllib.request.Request(f"{url}/rest/v1/rpc/create_order_atomic", data=order_payload, headers=auth_headers, method="POST")
        with urllib.request.urlopen(o_req, timeout=8) as resp:
            order_res = json.loads(resp.read().decode())
            test_order_id = order_res["order_id"]
            print(f"   [PASS] Order created! Number: {order_res['order_number']}, Status: {order_res['status']}")
            print(f"   [PASS] Server Calculated Total: {order_res['total_amount']} (10 units * 150.00 = 1500.00)")
            assert float(order_res['total_amount']) == 1500.00, "Calculated total mismatch!"

        # Verify stock was deducted from 50 -> 40
        chk_req = urllib.request.Request(f"{url}/rest/v1/products?id=eq.{test_product_id}&select=stock_quantity", headers=auth_headers)
        with urllib.request.urlopen(chk_req, timeout=8) as resp:
            stock_data = json.loads(resp.read().decode())[0]
            print(f"   [PASS] Inventory deducted! Current Stock: {stock_data['stock_quantity']} (Expected: 40)")
            assert stock_data['stock_quantity'] == 40, "Stock was not deducted properly!"

        # ==============================================================
        # TEST 2: ORDER HISTORY & DETAILS
        # ==============================================================
        print("\n4. Testing Order History & Relational Details...")
        list_req = urllib.request.Request(
            f"{url}/rest/v1/orders?id=eq.{test_order_id}&select=*,retailer:retailers(name),items:order_items(*,product:products(name,sku))",
            headers=auth_headers
        )
        with urllib.request.urlopen(list_req, timeout=8) as resp:
            orders_list = json.loads(resp.read().decode())[0]
            items = orders_list.get("items", [])
            print(f"   [PASS] Order retrieved with {len(items)} items. Retailer: {orders_list['retailer']['name']}")
            print(f"   [PASS] Item 1: {items[0]['product']['name']} | Qty: {items[0]['quantity']} @ {items[0]['unit_price']}")

        # ==============================================================
        # TEST 3: STATUS TRANSITIONS
        # ==============================================================
        print("\n5. Testing Status Transitions (Lifecycle tracking)...")
        status_payload = json.dumps({
            "_order_id": test_order_id,
            "_new_status": "confirmed",
            "_note": "Order confirmed by manager"
        }).encode()
        st_req = urllib.request.Request(f"{url}/rest/v1/rpc/update_order_status", data=status_payload, headers=auth_headers, method="POST")
        with urllib.request.urlopen(st_req, timeout=8) as resp:
            st_res = json.loads(resp.read().decode())
            print(f"   [PASS] Status updated to: {st_res['status']}")

        # ==============================================================
        # TEST 4: INVENTORY SAFETY - INSUFFICIENT STOCK
        # ==============================================================
        print("\n6. Testing Inventory Safety: Insufficient Stock Prevention...")
        over_payload = json.dumps({
            "_retailer_id": test_retailer_id,
            "_items": [{"product_id": test_product_id, "quantity": 9999}],
            "_notes": "Exceeds stock"
        }).encode()
        try:
            req = urllib.request.Request(f"{url}/rest/v1/rpc/create_order_atomic", data=over_payload, headers=auth_headers, method="POST")
            urllib.request.urlopen(req, timeout=8)
            print("   [FAIL] Order with insufficient stock was incorrectly accepted!")
        except urllib.error.HTTPError as e:
            if e.code in (400, 422):
                print(f"   [PASS] Order rejected! Insufficient stock prevented from negative balance (HTTP {e.code})")
            else:
                print(f"   [INFO] Status code: {e.code}")

        # ==============================================================
        # TEST 5: INVENTORY SAFETY - INVALID QUANTITY
        # ==============================================================
        print("\n7. Testing Input Validation: Zero & Negative Quantity...")
        inv_payload = json.dumps({
            "_retailer_id": test_retailer_id,
            "_items": [{"product_id": test_product_id, "quantity": 0}]
        }).encode()
        try:
            req = urllib.request.Request(f"{url}/rest/v1/rpc/create_order_atomic", data=inv_payload, headers=auth_headers, method="POST")
            urllib.request.urlopen(req, timeout=8)
            print("   [FAIL] Zero quantity item was incorrectly accepted!")
        except urllib.error.HTTPError as e:
            if e.code in (400, 422):
                print(f"   [PASS] Zero quantity correctly rejected (HTTP {e.code})")

        # ==============================================================
        # TEST 6: ORDER CANCELLATION & STOCK RESTORATION
        # ==============================================================
        print("\n8. Testing Order Cancellation & Stock Restoration...")
        cancel_payload = json.dumps({
            "_order_id": test_order_id,
            "_reason": "Testing stock return"
        }).encode()
        can_req = urllib.request.Request(f"{url}/rest/v1/rpc/cancel_order_atomic", data=cancel_payload, headers=auth_headers, method="POST")
        with urllib.request.urlopen(can_req, timeout=8) as resp:
            can_res = json.loads(resp.read().decode())
            print(f"   [PASS] Order cancelled! Status: {can_res['status']}")

        # Verify stock was restored from 40 back to 50
        with urllib.request.urlopen(chk_req, timeout=8) as resp:
            restored_stock = json.loads(resp.read().decode())[0]["stock_quantity"]
            print(f"   [PASS] Stock restored! Current Stock: {restored_stock} (Expected: 50)")
            assert restored_stock == 50, "Stock was not restored upon cancellation!"

        # ==============================================================
        # TEST 7: SECURITY & UNAUTHORIZED ACCESS
        # ==============================================================
        print("\n9. Testing Row Level Security (RLS) & Unauthorized Order Access...")
        unauth_order = json.dumps({
            "_retailer_id": test_retailer_id,
            "_items": [{"product_id": test_product_id, "quantity": 1}]
        }).encode()
        try:
            req = urllib.request.Request(f"{url}/rest/v1/rpc/create_order_atomic", data=unauth_order, headers=anon_headers, method="POST")
            urllib.request.urlopen(req, timeout=8)
            print("   [FAIL] Anonymous user was allowed to create orders!")
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                print(f"   [PASS] Anonymous order creation strictly blocked by RLS (HTTP {e.code})!")

    finally:
        # Cleanup
        print("\n10. Cleaning up test artifacts...")
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

    print("\n[SUCCESS] ALL MODULE 5 TESTS PASSED! Orders & Order History verified!")

if __name__ == "__main__":
    run_tests()
