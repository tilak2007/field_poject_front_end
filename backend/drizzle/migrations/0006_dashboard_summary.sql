-- Migration 0006: Dashboard Summary Function & Administrative Policies
-- Provides high-performance consolidated metrics for the frontend dashboard in a single query.

-- 1. Helper function: is_admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'::public.app_role)
$$;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

-- 2. Administrative Attendance Policy (allows admins to manage/clean attendance records)
GRANT DELETE ON public.attendance TO authenticated;

DROP POLICY IF EXISTS "attendance_delete" ON public.attendance;
CREATE POLICY "attendance_delete" ON public.attendance FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 3. Consolidated Dashboard Summary Function
CREATE OR REPLACE FUNCTION public.get_dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_staff boolean;
  v_today date := CURRENT_DATE;
  v_orders_count bigint;
  v_orders_total numeric(12,2);
  v_visits_count bigint;
  v_attendance_count bigint;
  v_retailers_count bigint;
  v_products_count bigint;
  v_low_stock_count bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  v_is_staff := public.is_staff(v_user_id);

  IF v_is_staff THEN
    -- Admin / Manager view: entire team metrics
    SELECT count(*), coalesce(sum(total_amount), 0)
      INTO v_orders_count, v_orders_total
      FROM public.orders
      WHERE date(created_at) = v_today;

    SELECT count(*) INTO v_visits_count
      FROM public.visits
      WHERE visit_date = v_today;

    SELECT count(*) INTO v_attendance_count
      FROM public.attendance
      WHERE work_date = v_today AND check_in_time IS NOT NULL;

    SELECT count(*) INTO v_retailers_count FROM public.retailers WHERE is_active = true;
    SELECT count(*) INTO v_products_count FROM public.products WHERE is_active = true;
    SELECT count(*) INTO v_low_stock_count FROM public.products WHERE is_active = true AND stock_quantity <= 10;
  ELSE
    -- Sales rep view: metrics scoped to the logged-in representative
    SELECT count(*), coalesce(sum(total_amount), 0)
      INTO v_orders_count, v_orders_total
      FROM public.orders
      WHERE sales_rep_id = v_user_id AND date(created_at) = v_today;

    SELECT count(*) INTO v_visits_count
      FROM public.visits
      WHERE sales_rep_id = v_user_id AND visit_date = v_today;

    SELECT count(*) INTO v_attendance_count
      FROM public.attendance
      WHERE user_id = v_user_id AND work_date = v_today;

    SELECT count(*) INTO v_retailers_count
      FROM public.retailers r
      WHERE r.is_active = true 
        AND (r.assigned_rep_id = v_user_id OR r.created_by = v_user_id OR public.has_territory(v_user_id, r.territory_id));

    SELECT count(*) INTO v_products_count FROM public.products WHERE is_active = true;
    SELECT count(*) INTO v_low_stock_count FROM public.products WHERE is_active = true AND stock_quantity <= 10;
  END IF;

  RETURN jsonb_build_object(
    'today_orders_count', v_orders_count,
    'today_orders_total', v_orders_total,
    'today_visits_count', v_visits_count,
    'today_attendance_count', v_attendance_count,
    'total_retailers_count', v_retailers_count,
    'total_products_count', v_products_count,
    'low_stock_products_count', v_low_stock_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary() TO authenticated;
