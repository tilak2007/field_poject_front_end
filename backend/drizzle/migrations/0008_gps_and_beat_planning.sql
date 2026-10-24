-- Migration 0008: GPS, Maps & Beat Planning
-- Implements daily beat planning, retailer sequencing, and location updates

-- 1. Beat Plans Table
CREATE TABLE IF NOT EXISTS public.beat_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL DEFAULT 'Daily Visit Plan',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_beat_plans_user_date UNIQUE (user_id, plan_date)
);

CREATE INDEX IF NOT EXISTS idx_beat_plans_user ON public.beat_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_beat_plans_date ON public.beat_plans(plan_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.beat_plans TO authenticated;
GRANT ALL ON public.beat_plans TO service_role;
ALTER TABLE public.beat_plans ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_beat_plans_updated ON public.beat_plans;
CREATE TRIGGER trg_beat_plans_updated
  BEFORE UPDATE ON public.beat_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Beat Plan Items (Ordered Retailers Sequence)
CREATE TABLE IF NOT EXISTS public.beat_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beat_plan_id uuid NOT NULL REFERENCES public.beat_plans(id) ON DELETE CASCADE,
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE RESTRICT,
  sequence_order integer NOT NULL CHECK (sequence_order >= 1),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_beat_plan_retailer UNIQUE (beat_plan_id, retailer_id)
);

CREATE INDEX IF NOT EXISTS idx_beat_plan_items_plan ON public.beat_plan_items(beat_plan_id, sequence_order ASC);
CREATE INDEX IF NOT EXISTS idx_beat_plan_items_retailer ON public.beat_plan_items(retailer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.beat_plan_items TO authenticated;
GRANT ALL ON public.beat_plan_items TO service_role;
ALTER TABLE public.beat_plan_items ENABLE ROW LEVEL SECURITY;

-- 3. Row Level Security Policies
-- Beat Plans: Reps manage own plans; Staff views/manages all
DROP POLICY IF EXISTS "beat_plans_select" ON public.beat_plans;
CREATE POLICY "beat_plans_select" ON public.beat_plans FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "beat_plans_insert" ON public.beat_plans;
CREATE POLICY "beat_plans_insert" ON public.beat_plans FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "beat_plans_update" ON public.beat_plans;
CREATE POLICY "beat_plans_update" ON public.beat_plans FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "beat_plans_delete" ON public.beat_plans;
CREATE POLICY "beat_plans_delete" ON public.beat_plans FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- Beat Plan Items: Authorized if parent plan belongs to user or user is staff
DROP POLICY IF EXISTS "beat_plan_items_select" ON public.beat_plan_items;
CREATE POLICY "beat_plan_items_select" ON public.beat_plan_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.beat_plans bp 
    WHERE bp.id = beat_plan_id AND (bp.user_id = auth.uid() OR public.is_staff(auth.uid()))
  ));

DROP POLICY IF EXISTS "beat_plan_items_insert" ON public.beat_plan_items;
CREATE POLICY "beat_plan_items_insert" ON public.beat_plan_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.beat_plans bp 
    WHERE bp.id = beat_plan_id AND (bp.user_id = auth.uid() OR public.is_staff(auth.uid()))
  ));

DROP POLICY IF EXISTS "beat_plan_items_update" ON public.beat_plan_items;
CREATE POLICY "beat_plan_items_update" ON public.beat_plan_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.beat_plans bp 
    WHERE bp.id = beat_plan_id AND (bp.user_id = auth.uid() OR public.is_staff(auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.beat_plans bp 
    WHERE bp.id = beat_plan_id AND (bp.user_id = auth.uid() OR public.is_staff(auth.uid()))
  ));

DROP POLICY IF EXISTS "beat_plan_items_delete" ON public.beat_plan_items;
CREATE POLICY "beat_plan_items_delete" ON public.beat_plan_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.beat_plans bp 
    WHERE bp.id = beat_plan_id AND (bp.user_id = auth.uid() OR public.is_staff(auth.uid()))
  ));

-- 4. Atomic Stored Procedure to Save / Update Beat Plan with Ordered Retailers
CREATE OR REPLACE FUNCTION public.save_beat_plan(
  _plan_date date,
  _title text,
  _retailer_ids uuid[],
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_plan_id uuid;
  v_i integer;
  v_ret_id uuid;
  v_plan_row public.beat_plans%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  IF _plan_date IS NULL THEN
    _plan_date := CURRENT_DATE;
  END IF;

  -- Upsert parent beat plan
  INSERT INTO public.beat_plans (user_id, plan_date, title, notes, is_active)
  VALUES (v_user_id, _plan_date, COALESCE(_title, 'Daily Visit Plan'), _notes, true)
  ON CONFLICT (user_id, plan_date)
  DO UPDATE SET
    title = EXCLUDED.title,
    notes = COALESCE(EXCLUDED.notes, beat_plans.notes),
    updated_at = now()
  RETURNING * INTO v_plan_row;

  v_plan_id := v_plan_row.id;

  -- Clear previous items for this plan
  DELETE FROM public.beat_plan_items WHERE beat_plan_id = v_plan_id;

  -- Insert new items in the specified sequence order
  IF _retailer_ids IS NOT NULL AND array_length(_retailer_ids, 1) > 0 THEN
    FOR v_i IN 1..array_length(_retailer_ids, 1) LOOP
      v_ret_id := _retailer_ids[v_i];
      IF EXISTS (SELECT 1 FROM public.retailers WHERE id = v_ret_id AND is_active = true) THEN
        INSERT INTO public.beat_plan_items (beat_plan_id, retailer_id, sequence_order, status)
        VALUES (v_plan_id, v_ret_id, v_i, 'pending')
        ON CONFLICT (beat_plan_id, retailer_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'beat_plan_id', v_plan_id,
    'plan_date', v_plan_row.plan_date,
    'title', v_plan_row.title,
    'item_count', COALESCE(array_length(_retailer_ids, 1), 0)
  );
END;
$$;

-- 5. Stored Procedure to Retrieve Daily Beat Plan with Ordered Retailers & Coordinates
CREATE OR REPLACE FUNCTION public.get_daily_beat_plan(
  _target_date date DEFAULT CURRENT_DATE,
  _target_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_query_user_id uuid;
  v_plan_row public.beat_plans%ROWTYPE;
  v_items jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  IF _target_user_id IS NOT NULL AND public.is_staff(v_user_id) THEN
    v_query_user_id := _target_user_id;
  ELSE
    v_query_user_id := v_user_id;
  END IF;

  SELECT * INTO v_plan_row
  FROM public.beat_plans
  WHERE user_id = v_query_user_id AND plan_date = _target_date;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'found', false,
      'plan_date', _target_date,
      'items', '[]'::jsonb
    );
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'item_id', bpi.id,
      'sequence_order', bpi.sequence_order,
      'status', bpi.status,
      'retailer_id', r.id,
      'retailer_name', r.name,
      'retailer_code', r.code,
      'address', r.address,
      'phone', r.phone,
      'latitude', r.latitude,
      'longitude', r.longitude,
      'has_coordinates', (r.latitude IS NOT NULL AND r.longitude IS NOT NULL)
    ) ORDER BY bpi.sequence_order ASC
  ), '[]'::jsonb)
  INTO v_items
  FROM public.beat_plan_items bpi
  JOIN public.retailers r ON r.id = bpi.retailer_id
  WHERE bpi.beat_plan_id = v_plan_row.id;

  RETURN jsonb_build_object(
    'found', true,
    'beat_plan_id', v_plan_row.id,
    'plan_date', v_plan_row.plan_date,
    'title', v_plan_row.title,
    'notes', v_plan_row.notes,
    'items', v_items
  );
END;
$$;

-- 6. Helper Procedure: Update Retailer Location Coordinates
CREATE OR REPLACE FUNCTION public.update_retailer_location(
  _retailer_id uuid,
  _latitude double precision,
  _longitude double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  IF _latitude IS NOT NULL AND (_latitude < -90 OR _latitude > 90) THEN
    RAISE EXCEPTION 'invalid latitude: must be between -90 and 90' USING ERRCODE = '22023';
  END IF;

  IF _longitude IS NOT NULL AND (_longitude < -180 OR _longitude > 180) THEN
    RAISE EXCEPTION 'invalid longitude: must be between -180 and 180' USING ERRCODE = '22023';
  END IF;

  UPDATE public.retailers
  SET latitude = _latitude,
      longitude = _longitude,
      updated_at = now()
  WHERE id = _retailer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'retailer not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'retailer_id', _retailer_id,
    'latitude', _latitude,
    'longitude', _longitude
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_beat_plan(date, text, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_beat_plan(date, text, uuid[], text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_daily_beat_plan(date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_beat_plan(date, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.update_retailer_location(uuid, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_retailer_location(uuid, double precision, double precision) TO authenticated;
