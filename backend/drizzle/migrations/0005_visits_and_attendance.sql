-- Migration 0005: Visits & Attendance
-- Implements daily attendance check-in/out, retailer visits, and visit-to-order linkage with RLS.

-- 1. Attendance Table
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  check_in_time timestamptz NOT NULL DEFAULT now(),
  check_out_time timestamptz,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'half_day', 'on_leave', 'absent')),
  check_in_latitude double precision CHECK (check_in_latitude IS NULL OR (check_in_latitude >= -90 AND check_in_latitude <= 90)),
  check_in_longitude double precision CHECK (check_in_longitude IS NULL OR (check_in_longitude >= -180 AND check_in_longitude <= 180)),
  check_out_latitude double precision CHECK (check_out_latitude IS NULL OR (check_out_latitude >= -90 AND check_out_latitude <= 90)),
  check_out_longitude double precision CHECK (check_out_longitude IS NULL OR (check_out_longitude >= -180 AND check_out_longitude <= 180)),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_user_date_unique UNIQUE (user_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_user ON public.attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(work_date DESC);

GRANT SELECT, INSERT, UPDATE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_attendance_updated ON public.attendance;
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Retailer Visits Table
CREATE TABLE IF NOT EXISTS public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE RESTRICT,
  sales_rep_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  outcome text CHECK (outcome IS NULL OR outcome IN ('order_placed', 'follow_up_required', 'no_order', 'retailer_unavailable', 'other')),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  start_latitude double precision CHECK (start_latitude IS NULL OR (start_latitude >= -90 AND start_latitude <= 90)),
  start_longitude double precision CHECK (start_longitude IS NULL OR (start_longitude >= -180 AND start_longitude <= 180)),
  end_latitude double precision CHECK (end_latitude IS NULL OR (end_latitude >= -90 AND end_latitude <= 90)),
  end_longitude double precision CHECK (end_longitude IS NULL OR (end_longitude >= -180 AND end_longitude <= 180)),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Constraint: Only one active in_progress visit per sales representative at any given time
CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_single_active_per_rep
  ON public.visits (sales_rep_id) WHERE (status = 'in_progress');

CREATE INDEX IF NOT EXISTS idx_visits_retailer ON public.visits(retailer_id);
CREATE INDEX IF NOT EXISTS idx_visits_rep ON public.visits(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON public.visits(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_visits_order ON public.visits(order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visits TO authenticated;
GRANT ALL ON public.visits TO service_role;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_visits_updated ON public.visits;
CREATE TRIGGER trg_visits_updated BEFORE UPDATE ON public.visits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Row Level Security Policies
-- Attendance: Rep views/updates own attendance; Staff views all
DROP POLICY IF EXISTS "attendance_select" ON public.attendance;
CREATE POLICY "attendance_select" ON public.attendance FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "attendance_insert" ON public.attendance;
CREATE POLICY "attendance_insert" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "attendance_update" ON public.attendance;
CREATE POLICY "attendance_update" ON public.attendance FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- Visits: Rep views/modifies own visits; Staff views all
DROP POLICY IF EXISTS "visits_select" ON public.visits;
CREATE POLICY "visits_select" ON public.visits FOR SELECT TO authenticated
  USING (sales_rep_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "visits_insert" ON public.visits;
CREATE POLICY "visits_insert" ON public.visits FOR INSERT TO authenticated
  WITH CHECK (sales_rep_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "visits_update" ON public.visits;
CREATE POLICY "visits_update" ON public.visits FOR UPDATE TO authenticated
  USING (sales_rep_id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (sales_rep_id = auth.uid() OR public.is_staff(auth.uid()));

-- 4. Stored Procedures for Attendance & Visits
CREATE OR REPLACE FUNCTION public.check_in_rep(
  _latitude double precision DEFAULT NULL,
  _longitude double precision DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rec public.attendance%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.attendance WHERE user_id = v_user_id AND work_date = CURRENT_DATE) THEN
    RAISE EXCEPTION 'Already checked in for today' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.attendance (
    user_id, work_date, check_in_time, status,
    check_in_latitude, check_in_longitude, notes
  ) VALUES (
    v_user_id, CURRENT_DATE, now(), 'present',
    _latitude, _longitude, _notes
  ) RETURNING * INTO v_rec;

  RETURN to_jsonb(v_rec);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_out_rep(
  _latitude double precision DEFAULT NULL,
  _longitude double precision DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rec public.attendance%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_rec FROM public.attendance
    WHERE user_id = v_user_id AND work_date = CURRENT_DATE
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No check-in record found for today' USING ERRCODE = 'P0002';
  END IF;

  IF v_rec.check_out_time IS NOT NULL THEN
    RAISE EXCEPTION 'Already checked out for today' USING ERRCODE = '22023';
  END IF;

  UPDATE public.attendance
    SET check_out_time = now(),
        check_out_latitude = _latitude,
        check_out_longitude = _longitude,
        notes = coalesce(_notes, notes)
    WHERE id = v_rec.id
    RETURNING * INTO v_rec;

  RETURN to_jsonb(v_rec);
END;
$$;

CREATE OR REPLACE FUNCTION public.start_visit(
  _retailer_id uuid,
  _latitude double precision DEFAULT NULL,
  _longitude double precision DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rec public.visits%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  -- Validate retailer
  IF NOT EXISTS (SELECT 1 FROM public.retailers WHERE id = _retailer_id AND is_active = true) THEN
    RAISE EXCEPTION 'Retailer not found or inactive' USING ERRCODE = 'P0002';
  END IF;

  -- Ensure no active visit
  IF EXISTS (SELECT 1 FROM public.visits WHERE sales_rep_id = v_user_id AND status = 'in_progress') THEN
    RAISE EXCEPTION 'An active visit is already in progress. Complete or cancel it first.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.visits (
    retailer_id, sales_rep_id, visit_date, start_time,
    status, start_latitude, start_longitude, notes
  ) VALUES (
    _retailer_id, v_user_id, CURRENT_DATE, now(),
    'in_progress', _latitude, _longitude, _notes
  ) RETURNING * INTO v_rec;

  RETURN to_jsonb(v_rec);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_visit(
  _visit_id uuid,
  _outcome text,
  _order_id uuid DEFAULT NULL,
  _latitude double precision DEFAULT NULL,
  _longitude double precision DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_visit public.visits%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_visit FROM public.visits WHERE id = _visit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visit not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_staff(v_user_id) AND v_visit.sales_rep_id <> v_user_id THEN
    RAISE EXCEPTION 'You are not authorized to complete this visit' USING ERRCODE = '42501';
  END IF;

  IF v_visit.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Visit is already %', v_visit.status USING ERRCODE = '22023';
  END IF;

  IF _outcome NOT IN ('order_placed', 'follow_up_required', 'no_order', 'retailer_unavailable', 'other') THEN
    RAISE EXCEPTION 'Invalid visit outcome: %', _outcome USING ERRCODE = '22023';
  END IF;

  -- If order_placed outcome is specified, validate order linkage
  IF _order_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = _order_id AND retailer_id = v_visit.retailer_id) THEN
      RAISE EXCEPTION 'Linked order does not match the visit retailer' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.visits
    SET status = 'completed',
        end_time = now(),
        outcome = _outcome,
        order_id = _order_id,
        end_latitude = _latitude,
        end_longitude = _longitude,
        notes = coalesce(_notes, notes)
    WHERE id = _visit_id
    RETURNING * INTO v_visit;

  RETURN to_jsonb(v_visit);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_in_rep(double precision, double precision, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_out_rep(double precision, double precision, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_visit(uuid, double precision, double precision, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_visit(uuid, text, uuid, double precision, double precision, text) TO authenticated;
