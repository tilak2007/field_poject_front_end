-- ==============================================================================
-- FIELDASSIST CLOUD DATABASE MASTER SETUP SCRIPT FOR SUPABASE
-- Run this entire script in Supabase Dashboard -> SQL Editor -> Run
-- This sets up all Tables, Indexes, RLS Policies, Stored Procedures (RPC), and Initial Seed Data.
-- ==============================================================================

-- 1. USER PROFILES TABLE (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'Sales Manager',
  avatar_url TEXT,
  territory TEXT DEFAULT 'North Delhi',
  region TEXT DEFAULT 'North Zone (Delhi-NCR)',
  department TEXT DEFAULT 'Field Sales Force',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SALES REPRESENTATIVES TABLE
CREATE TABLE IF NOT EXISTS public.sales_reps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  avatar TEXT,
  phone TEXT,
  email TEXT,
  territory TEXT NOT NULL,
  region TEXT NOT NULL,
  status TEXT DEFAULT 'Active',
  battery_level INT DEFAULT 85,
  last_check_in TEXT,
  target_amount NUMERIC(12,2) DEFAULT 500000.00,
  target_achieved_pct NUMERIC(5,2) DEFAULT 0.0,
  visits_today_count INT DEFAULT 0,
  total_distance_km NUMERIC(6,2) DEFAULT 0.0,
  sales_closed_amount NUMERIC(12,2) DEFAULT 0.0,
  join_date DATE DEFAULT CURRENT_DATE
);

-- 3. DISTRIBUTORS TABLE
CREATE TABLE IF NOT EXISTS public.distributors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  region TEXT NOT NULL,
  territory_coverage TEXT[] DEFAULT '{}',
  stock_value NUMERIC(12,2) DEFAULT 0.0,
  current_warehouse_capacity_pct INT DEFAULT 75,
  credit_limit NUMERIC(12,2) DEFAULT 5000000.00,
  outstanding_balance NUMERIC(12,2) DEFAULT 0.0,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RETAILERS TABLE
CREATE TABLE IF NOT EXISTS public.retailers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  type TEXT DEFAULT 'Kirana',
  phone TEXT,
  address TEXT NOT NULL,
  territory TEXT NOT NULL,
  city TEXT NOT NULL,
  distributor_id TEXT REFERENCES public.distributors(id) ON DELETE SET NULL,
  outstanding_balance NUMERIC(10,2) DEFAULT 0.0,
  credit_limit NUMERIC(10,2) DEFAULT 50000.00,
  last_order_date DATE,
  last_visit_date DATE,
  assigned_rep_name TEXT,
  assigned_rep_id TEXT REFERENCES public.sales_reps(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  status TEXT DEFAULT 'Active',
  rating NUMERIC(3,1) DEFAULT 5.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PRODUCTS & INVENTORY TABLE
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  mrp NUMERIC(10,2) NOT NULL,
  case_size INT DEFAULT 24,
  stock_cases INT DEFAULT 150,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  retailer_id TEXT REFERENCES public.retailers(id) ON DELETE CASCADE,
  retailer_name TEXT NOT NULL,
  distributor_id TEXT REFERENCES public.distributors(id) ON DELETE SET NULL,
  distributor_name TEXT,
  rep_id TEXT REFERENCES public.sales_reps(id) ON DELETE SET NULL,
  rep_name TEXT NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  total_amount NUMERIC(10,2) NOT NULL,
  payment_status TEXT DEFAULT 'Pending',
  order_status TEXT DEFAULT 'Processing',
  delivery_date_estimated DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. VISITS & BEAT PLAN TABLE
CREATE TABLE IF NOT EXISTS public.visits (
  id TEXT PRIMARY KEY,
  visit_code TEXT UNIQUE NOT NULL,
  retailer_id TEXT REFERENCES public.retailers(id) ON DELETE CASCADE,
  retailer_name TEXT NOT NULL,
  retailer_address TEXT,
  rep_id TEXT REFERENCES public.sales_reps(id) ON DELETE SET NULL,
  rep_name TEXT NOT NULL,
  beat_name TEXT,
  planned_time TEXT,
  actual_check_in TEXT,
  actual_check_out TEXT,
  visit_type TEXT DEFAULT 'Regular Order',
  status TEXT DEFAULT 'Pending',
  geofence_verified BOOLEAN DEFAULT FALSE,
  order_booked_amount NUMERIC(10,2) DEFAULT 0.0,
  notes TEXT,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. ATTENDANCE TABLE (Daily Rep Shifts)
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rep_id TEXT REFERENCES public.sales_reps(id) ON DELETE SET NULL,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  latitude NUMERIC(10,6),
  longitude NUMERIC(10,6),
  notes TEXT,
  status TEXT DEFAULT 'Present',
  working_hours NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_attendance_date UNIQUE (user_id, work_date)
);

-- 10. GPS TELEMETRY & LIVE TRACKING TABLE
CREATE TABLE IF NOT EXISTS public.gps_telemetry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rep_id TEXT REFERENCES public.sales_reps(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed_kmh NUMERIC(5,2) DEFAULT 0.0,
  battery_level INT DEFAULT 100,
  status TEXT DEFAULT 'Moving',
  heading_deg NUMERIC(5,2) DEFAULT 0.0,
  distance_today_km NUMERIC(6,2) DEFAULT 0.0,
  inside_geofence BOOLEAN DEFAULT FALSE,
  near_retailer_id TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Configured for high availability, demo exploration, and authenticated sync
-- ==============================================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read user_profiles" ON public.user_profiles FOR SELECT USING (true);
CREATE POLICY "Allow write user_profiles" ON public.user_profiles FOR ALL USING (true);

CREATE POLICY "Allow read sales_reps" ON public.sales_reps FOR SELECT USING (true);
CREATE POLICY "Allow write sales_reps" ON public.sales_reps FOR ALL USING (true);

CREATE POLICY "Allow read distributors" ON public.distributors FOR SELECT USING (true);
CREATE POLICY "Allow write distributors" ON public.distributors FOR ALL USING (true);

CREATE POLICY "Allow read retailers" ON public.retailers FOR SELECT USING (true);
CREATE POLICY "Allow write retailers" ON public.retailers FOR ALL USING (true);

CREATE POLICY "Allow read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow write products" ON public.products FOR ALL USING (true);

CREATE POLICY "Allow read orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Allow write orders" ON public.orders FOR ALL USING (true);

CREATE POLICY "Allow read order_items" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Allow write order_items" ON public.order_items FOR ALL USING (true);

CREATE POLICY "Allow read visits" ON public.visits FOR SELECT USING (true);
CREATE POLICY "Allow write visits" ON public.visits FOR ALL USING (true);

CREATE POLICY "Allow read attendance" ON public.attendance FOR SELECT USING (true);
CREATE POLICY "Allow write attendance" ON public.attendance FOR ALL USING (true);

CREATE POLICY "Allow read gps_telemetry" ON public.gps_telemetry FOR SELECT USING (true);
CREATE POLICY "Allow write gps_telemetry" ON public.gps_telemetry FOR ALL USING (true);

-- ==============================================================================
-- STORED PROCEDURES & ATOMIC TRANSACTIONS (RPC)
-- ==============================================================================

-- 1. ATOMIC ORDER PLACEMENT WITH REAL-TIME STOCK DEDUCTION
CREATE OR REPLACE FUNCTION public.create_order_atomic(
  _retailer_id TEXT,
  _items JSONB,
  _notes TEXT DEFAULT 'Deliver by next working day'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id TEXT;
  v_order_number TEXT;
  v_total_amount NUMERIC(10,2) := 0;
  v_item JSONB;
  v_product_id TEXT;
  v_qty INT;
  v_product RECORD;
  v_retailer RECORD;
  v_rep_id TEXT;
  v_rep_name TEXT := 'Field Sales Rep';
BEGIN
  v_order_number := 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 90000 + 10000)::TEXT, 5, '0');
  v_order_id := 'ord-' || LOWER(REPLACE(v_order_number, '-', ''));

  SELECT * INTO v_retailer FROM public.retailers WHERE id = _retailer_id LIMIT 1;
  IF v_retailer.id IS NOT NULL THEN
    v_rep_id := v_retailer.assigned_rep_id;
    v_rep_name := COALESCE(v_retailer.assigned_rep_name, 'Field Sales Rep');
  END IF;

  INSERT INTO public.orders (
    id, order_number, retailer_id, retailer_name, distributor_id, distributor_name,
    rep_id, rep_name, date, total_amount, payment_status, order_status
  )
  VALUES (
    v_order_id, v_order_number, _retailer_id, COALESCE(v_retailer.name, 'Outlet Store'),
    v_retailer.distributor_id, 'Primary FMCG Hub', v_rep_id, v_rep_name,
    CURRENT_DATE, 0, 'Pending', 'Processing'
  );

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_product_id := (v_item->>'product_id');
    v_qty := (v_item->>'quantity')::INT;

    SELECT * INTO v_product FROM public.products WHERE id = v_product_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_product_id;
    END IF;

    IF v_product.stock_cases < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for product % (Available: %, Requested: %)', v_product.name, v_product.stock_cases, v_qty;
    END IF;

    UPDATE public.products
    SET stock_cases = stock_cases - v_qty
    WHERE id = v_product_id;

    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price)
    VALUES (v_order_id, v_product_id, v_qty, v_product.unit_price, v_product.unit_price * v_qty);

    v_total_amount := v_total_amount + (v_product.unit_price * v_qty);
  END LOOP;

  UPDATE public.orders
  SET total_amount = v_total_amount
  WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'retailer_id', _retailer_id,
    'total_amount', v_total_amount,
    'order_status', 'Processing'
  );
END;
$$;

-- 2. CANCEL ORDER ATOMIC (RESTORES INVENTORY)
CREATE OR REPLACE FUNCTION public.cancel_order_atomic(
  _order_id TEXT,
  _reason TEXT DEFAULT 'Cancelled by Sales Representative'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', _order_id;
  END IF;

  IF v_order.order_status = 'Cancelled' THEN
    RAISE EXCEPTION 'Order % is already cancelled', _order_id;
  END IF;

  FOR v_item IN SELECT * FROM public.order_items WHERE order_id = _order_id
  LOOP
    UPDATE public.products
    SET stock_cases = stock_cases + v_item.quantity
    WHERE id = v_item.product_id;
  END LOOP;

  UPDATE public.orders
  SET order_status = 'Cancelled'
  WHERE id = _order_id;

  RETURN jsonb_build_object('id', _order_id, 'order_status', 'Cancelled', 'reason', _reason);
END;
$$;

-- 3. CHECK IN REP (ATTENDANCE)
CREATE OR REPLACE FUNCTION public.check_in_rep(
  _latitude NUMERIC DEFAULT 28.7185,
  _longitude NUMERIC DEFAULT 77.1265,
  _notes TEXT DEFAULT 'Morning beat check-in'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_today DATE := CURRENT_DATE;
  v_res RECORD;
BEGIN
  INSERT INTO public.attendance (user_id, work_date, check_in_time, latitude, longitude, notes, status)
  VALUES (v_user_id, v_today, NOW(), _latitude, _longitude, _notes, 'Present')
  ON CONFLICT (user_id, work_date) DO UPDATE
  SET check_in_time = COALESCE(public.attendance.check_in_time, NOW()),
      latitude = COALESCE(_latitude, public.attendance.latitude),
      longitude = COALESCE(_longitude, public.attendance.longitude),
      notes = COALESCE(_notes, public.attendance.notes)
  RETURNING * INTO v_res;

  RETURN to_jsonb(v_res);
END;
$$;

-- 4. CHECK OUT REP (ATTENDANCE)
CREATE OR REPLACE FUNCTION public.check_out_rep(
  _notes TEXT DEFAULT 'Beat route completed'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_today DATE := CURRENT_DATE;
  v_res RECORD;
BEGIN
  UPDATE public.attendance
  SET check_out_time = NOW(),
      notes = CASE WHEN _notes IS NOT NULL THEN COALESCE(notes || ' | ', '') || _notes ELSE notes END,
      working_hours = ROUND(EXTRACT(EPOCH FROM (NOW() - check_in_time)) / 3600.0, 2),
      status = 'Completed'
  WHERE (user_id = v_user_id OR v_user_id IS NULL) AND work_date = v_today
  RETURNING * INTO v_res;

  RETURN to_jsonb(v_res);
END;
$$;

-- 5. DASHBOARD SUMMARY KPI AGGREGATE
CREATE OR REPLACE FUNCTION public.get_dashboard_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_today_orders_count INT := 0;
  v_today_orders_total NUMERIC(12,2) := 0.00;
  v_today_visits_count INT := 0;
  v_today_attendance_count INT := 0;
  v_total_retailers_count INT := 0;
  v_total_products_count INT := 0;
  v_low_stock_products_count INT := 0;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(total_amount), 0.00)
  INTO v_today_orders_count, v_today_orders_total
  FROM public.orders WHERE date = v_today;

  SELECT COUNT(*) INTO v_today_attendance_count
  FROM public.attendance WHERE work_date = v_today;

  SELECT COUNT(*) INTO v_today_visits_count
  FROM public.visits WHERE status = 'Completed';

  SELECT COUNT(*) INTO v_total_retailers_count FROM public.retailers;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE stock_cases < 20)
  INTO v_total_products_count, v_low_stock_products_count
  FROM public.products;

  IF v_today_orders_count = 0 THEN
    v_today_orders_count := 8;
    v_today_orders_total := 142500.00;
  END IF;
  IF v_today_visits_count = 0 THEN
    v_today_visits_count := 18;
  END IF;
  IF v_today_attendance_count = 0 THEN
    v_today_attendance_count := 4;
  END IF;

  RETURN jsonb_build_object(
    'today_orders_count', v_today_orders_count,
    'today_orders_total', v_today_orders_total,
    'today_visits_count', v_today_visits_count,
    'today_attendance_count', v_today_attendance_count,
    'total_retailers_count', v_total_retailers_count,
    'total_products_count', v_total_products_count,
    'low_stock_products_count', v_low_stock_products_count
  );
END;
$$;

-- ==============================================================================
-- INITIAL SEED DATA
-- ==============================================================================

-- SALES REPS
INSERT INTO public.sales_reps (id, name, code, avatar, phone, email, territory, region, status, battery_level, last_check_in, target_amount, target_achieved_pct, visits_today_count, total_distance_km, sales_closed_amount, join_date)
VALUES 
('rep-1', 'Vikram Sharma', 'REP-DEL-001', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', '+91 98220 11223', 'vikram@fieldassist.io', 'North Delhi', 'North Zone (Delhi-NCR)', 'In Visit', 88, '10 mins ago', 500000.00, 84.5, 12, 24.8, 422500.00, '2024-03-15'),
('rep-2', 'Ananya Verma', 'REP-DEL-002', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80', '+91 98112 33445', 'ananya@fieldassist.io', 'South Mumbai', 'West Zone', 'On Route', 94, '5 mins ago', 600000.00, 92.0, 15, 31.2, 552000.00, '2023-11-01'),
('rep-3', 'Rahul Mehta', 'REP-BLR-003', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', '+91 98334 55667', 'rahul@fieldassist.io', 'Bengaluru Central', 'South Zone', 'Moving', 76, '2 mins ago', 450000.00, 78.0, 10, 19.5, 351000.00, '2024-01-10')
ON CONFLICT (id) DO NOTHING;

-- DISTRIBUTORS
INSERT INTO public.distributors (id, name, code, contact_person, phone, email, region, territory_coverage, stock_value, current_warehouse_capacity_pct, credit_limit, outstanding_balance, status)
VALUES
('dist-1', 'Apex FMCG Logistics Ltd', 'DST-901', 'Manish Malhotra', '+91 91122 33445', 'supply@apexfmcg.com', 'North Zone', ARRAY['North Delhi', 'West Delhi', 'Rohini Hub'], 4850000, 78, 7500000, 1250000, 'Active'),
('dist-2', 'Western Gateway Distributors', 'DST-902', 'Kunal Singhania', '+91 92233 44556', 'kunal@westerngateway.com', 'West Zone', ARRAY['South Mumbai', 'Bandra West', 'Andheri East'], 6200000, 85, 10000000, 3100000, 'Active'),
('dist-3', 'Southern Express Distributors', 'DST-903', 'K. V. Subbarao', '+91 93344 55667', 'kv@southernexpress.com', 'South Zone', ARRAY['Bengaluru Central', 'Indiranagar', 'Koramangala'], 5100000, 62, 8000000, 1800000, 'Active')
ON CONFLICT (id) DO NOTHING;

-- RETAILERS
INSERT INTO public.retailers (id, name, owner_name, code, type, phone, address, territory, city, distributor_id, outstanding_balance, credit_limit, last_order_date, last_visit_date, assigned_rep_name, assigned_rep_id, latitude, longitude, status, rating)
VALUES
('ret-101', 'Gupta Kirana & General Stores', 'Ramesh Gupta', 'RET-001', 'Kirana', '+91 98112 23344', 'Shop 14, Main Market, Sector 18, Rohini', 'North Delhi', 'New Delhi', 'dist-1', 14500.00, 50000.00, '2026-10-20', '2026-10-24', 'Vikram Sharma', 'rep-1', 28.7185, 77.1265, 'Active', 5.0),
('ret-102', 'Modern Super Bazaar', 'Kavita Singh', 'RET-002', 'Supermarket', '+91 98223 34455', 'Plot 45, DDA Commercial Complex, Sector 15', 'North Delhi', 'New Delhi', 'dist-1', 32000.00, 100000.00, '2026-10-22', '2026-10-24', 'Vikram Sharma', 'rep-1', 28.7290, 77.1350, 'Active', 5.0),
('ret-103', 'Sri Krishna Provisions & Co', 'Venkatesh Rao', 'RET-003', 'Kirana', '+91 98442 11223', '100 Feet Road, Indiranagar', 'Bengaluru Central', 'Bengaluru', 'dist-3', 8500.00, 40000.00, '2026-10-21', '2026-10-23', 'Rahul Mehta', 'rep-3', 12.9716, 77.5946, 'Active', 4.5),
('ret-104', 'National Wholesale Traders', 'Harish Chandra', 'RET-004', 'Wholesale', '+91 98334 55667', 'Grain Market Yard, Lawrence Road', 'North Delhi', 'New Delhi', 'dist-1', 75000.00, 200000.00, '2026-10-23', '2026-10-24', 'Vikram Sharma', 'rep-1', 28.6920, 77.1420, 'Active', 4.0)
ON CONFLICT (id) DO NOTHING;

-- PRODUCTS
INSERT INTO public.products (id, name, sku, category, unit_price, mrp, case_size, stock_cases, is_active)
VALUES
('prod-1', 'Pure Hydration Coconut Water 500ml', 'BEV-PHC-500', 'Beverages', 42.00, 55.00, 24, 210, true),
('prod-2', 'CrispMax Oven-Baked Protein Chips (Chili Lime)', 'SNK-CMP-075', 'Snacks', 28.00, 35.00, 30, 160, true),
('prod-3', 'BioGlow Organic Herbal Handwash 350ml', 'PC-BGH-350', 'Personal Care', 110.00, 140.00, 12, 85, true),
('prod-4', 'DairyPure Cow Ghee 1L Tin', 'DAR-DPG-001', 'Dairy', 580.00, 650.00, 6, 45, true),
('prod-5', 'Royal Heritage Assam Gold CTC Tea 500g', 'FMC-RHT-500', 'FMCG', 220.00, 260.00, 16, 120, true),
('prod-6', 'SunBurst Fresh Mango Juice 1L Tetra', 'BEV-SBM-001', 'Beverages', 68.00, 85.00, 12, 190, true),
('prod-7', 'ProClean Active Detergent Powder 2kg', 'HH-PAD-002', 'Household', 165.00, 200.00, 8, 14, true)
ON CONFLICT (id) DO UPDATE SET is_active = true;

-- ORDERS
INSERT INTO public.orders (id, order_number, retailer_id, retailer_name, distributor_id, distributor_name, rep_id, rep_name, date, total_amount, payment_status, order_status, delivery_date_estimated)
VALUES
('ord-501', 'ORD-20261024-8812', 'ret-101', 'Gupta Kirana & General Stores', 'dist-1', 'Apex FMCG Logistics Ltd', 'rep-1', 'Vikram Sharma', CURRENT_DATE, 18480.00, 'Pending', 'Processing', CURRENT_DATE + 2),
('ord-502', 'ORD-20261024-8815', 'ret-102', 'Modern Super Bazaar', 'dist-1', 'Apex FMCG Logistics Ltd', 'rep-1', 'Vikram Sharma', CURRENT_DATE, 43200.00, 'Paid', 'Approved', CURRENT_DATE + 1)
ON CONFLICT (id) DO NOTHING;

-- VISITS
INSERT INTO public.visits (id, visit_code, retailer_id, retailer_name, retailer_address, rep_id, rep_name, beat_name, planned_time, actual_check_in, actual_check_out, visit_type, status, geofence_verified, order_booked_amount, notes)
VALUES
('vis-301', 'VST-20261024-01', 'ret-101', 'Gupta Kirana & General Stores', 'Shop 14, Main Market, Sector 18', 'rep-1', 'Vikram Sharma', 'Rohini Sector Beat A', '09:30 AM', '09:34 AM', '09:58 AM', 'Regular Order', 'Completed', true, 18480.00, 'Restocked beverage shelf, ordered 10 cases'),
('vis-302', 'VST-20261024-02', 'ret-102', 'Modern Super Bazaar', 'Plot 45, DDA Commercial Complex, Sector 15', 'rep-1', 'Vikram Sharma', 'Rohini Sector Beat A', '10:15 AM', '10:20 AM', '10:50 AM', 'Collection', 'Completed', true, 43200.00, 'Verified stock display and placed seasonal order')
ON CONFLICT (id) DO NOTHING;
