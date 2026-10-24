CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  sku text NOT NULL CHECK (sku ~ '^[A-Za-z0-9._-]{1,64}$'),
  category text CHECK (category IS NULL OR length(category) <= 100),
  description text CHECK (description IS NULL OR length(description) <= 5000),
  selling_price numeric(12,2) NOT NULL CHECK (selling_price >= 0),
  stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX products_sku_unique ON public.products (lower(sku));
CREATE INDEX products_category_idx ON public.products (category);
CREATE INDEX products_name_idx ON public.products (lower(name));

GRANT SELECT, INSERT, UPDATE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_select ON public.products FOR SELECT TO authenticated
  USING (is_active OR public.is_staff(auth.uid()));
CREATE POLICY products_staff_insert ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY products_staff_update ON public.products FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  change integer NOT NULL CHECK (change <> 0),
  quantity_after integer NOT NULL CHECK (quantity_after >= 0),
  reason text NOT NULL CHECK (reason IN ('initial','restock','adjustment','correction','damage','return')),
  note text CHECK (note IS NULL OR length(note) <= 500),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_movements_product_idx ON public.inventory_movements (product_id, created_at DESC);
GRANT SELECT ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_movements_staff_select ON public.inventory_movements FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Atomic stock adjustment with audit trail; staff only.
CREATE OR REPLACE FUNCTION public.adjust_product_stock(_product_id uuid, _change integer, _reason text, _note text DEFAULT NULL)
RETURNS public.products
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.products;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _change IS NULL OR _change = 0 THEN
    RAISE EXCEPTION 'change must be non-zero' USING ERRCODE = '22023';
  END IF;
  UPDATE public.products SET stock_quantity = stock_quantity + _change, updated_by = auth.uid()
    WHERE id = _product_id RETURNING * INTO p;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not found' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.inventory_movements (product_id, change, quantity_after, reason, note, created_by)
    VALUES (_product_id, _change, p.stock_quantity, _reason, _note, auth.uid());
  RETURN p;
END; $$;
REVOKE ALL ON FUNCTION public.adjust_product_stock(uuid, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(uuid, integer, text, text) TO authenticated;