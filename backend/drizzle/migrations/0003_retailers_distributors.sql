-- Migration 0003: Retailer & Distributor enhancements
-- Adds explicit assigned_rep_id and updates RLS policies for retailer and distributor operations.

ALTER TABLE public.retailers
  ADD COLUMN IF NOT EXISTS assigned_rep_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_retailers_assigned_rep ON public.retailers(assigned_rep_id);

-- Updated Policies: retailers (staff can do all; reps can view/edit in their territory or assigned to them)
DROP POLICY IF EXISTS "retailers_select" ON public.retailers;
CREATE POLICY "retailers_select" ON public.retailers FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_territory(auth.uid(), territory_id) OR assigned_rep_id = auth.uid() OR created_by = auth.uid());

DROP POLICY IF EXISTS "retailers_rep_insert" ON public.retailers;
CREATE POLICY "retailers_rep_insert" ON public.retailers FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) OR (public.has_territory(auth.uid(), territory_id) AND (created_by = auth.uid() OR assigned_rep_id = auth.uid())));

DROP POLICY IF EXISTS "retailers_rep_update" ON public.retailers;
CREATE POLICY "retailers_rep_update" ON public.retailers FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_territory(auth.uid(), territory_id) OR assigned_rep_id = auth.uid() OR created_by = auth.uid())
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_territory(auth.uid(), territory_id) OR assigned_rep_id = auth.uid() OR created_by = auth.uid());
