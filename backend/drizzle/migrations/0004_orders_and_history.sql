-- 0. Ensure Retailer Assigned Rep Column Exists
ALTER TABLE public.retailers 
  ADD COLUMN IF NOT EXISTS assigned_rep_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_retailers_assigned_rep ON public.retailers(assigned_rep_id);

-- 1. Order Status Enum
DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Orders Sequence for Order Numbers
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 1001;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  seq_val bigint;
  date_part text;
BEGIN
  seq_val := nextval('public.order_number_seq');
  date_part := to_char(now(), 'YYYYMMDD');
  RETURN 'ORD-' || date_part || '-' || lpad(seq_val::text, 5, '0');
END; $$;

-- 3. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL DEFAULT public.generate_order_number(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE RESTRICT,
  distributor_id uuid REFERENCES public.distributors(id) ON DELETE SET NULL,
  sales_rep_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status public.order_status NOT NULL DEFAULT 'pending',
  subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  discount_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  notes text,
  status_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_retailer ON public.orders(retailer_id);
CREATE INDEX IF NOT EXISTS idx_orders_rep ON public.orders(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_orders_distributor ON public.orders(distributor_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_orders_updated ON public.orders;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Order Items Table
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  total_price numeric(12,2) NOT NULL CHECK (total_price >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items(product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 5. Row Level Security Policies
DROP POLICY IF EXISTS "orders_select" ON public.orders;
CREATE POLICY "orders_select" ON public.orders FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid()) 
    OR sales_rep_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.retailers r 
      WHERE r.id = retailer_id 
        AND (public.has_territory(auth.uid(), r.territory_id) OR r.assigned_rep_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "orders_rep_insert" ON public.orders;
CREATE POLICY "orders_rep_insert" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff(auth.uid()) 
    OR (sales_rep_id = auth.uid())
  );

DROP POLICY IF EXISTS "orders_staff_or_rep_update" ON public.orders;
CREATE POLICY "orders_staff_or_rep_update" ON public.orders FOR UPDATE TO authenticated
  USING (
    public.is_staff(auth.uid()) 
    OR (sales_rep_id = auth.uid() AND status = 'pending')
  )
  WITH CHECK (
    public.is_staff(auth.uid()) 
    OR (sales_rep_id = auth.uid() AND status IN ('pending', 'cancelled'))
  );

DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
CREATE POLICY "order_items_select" ON public.order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          public.is_staff(auth.uid()) 
          OR o.sales_rep_id = auth.uid() 
          OR EXISTS (
            SELECT 1 FROM public.retailers r 
            WHERE r.id = o.retailer_id 
              AND (public.has_territory(auth.uid(), r.territory_id) OR r.assigned_rep_id = auth.uid())
          )
        )
    )
  );

DROP POLICY IF EXISTS "order_items_staff_or_rep_write" ON public.order_items;
CREATE POLICY "order_items_staff_or_rep_write" ON public.order_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (public.is_staff(auth.uid()) OR (o.sales_rep_id = auth.uid() AND o.status = 'pending'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (public.is_staff(auth.uid()) OR (o.sales_rep_id = auth.uid() AND o.status = 'pending'))
    )
  );

-- 6. Atomic Order Creation Function with Inventory Reservation
-- Prevents race conditions and negative inventory via FOR UPDATE row locks.
CREATE OR REPLACE FUNCTION public.create_order_atomic(
  _retailer_id uuid,
  _items jsonb,
  _notes text DEFAULT NULL,
  _distributor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_order_number text;
  v_calc_subtotal numeric(12,2) := 0;
  v_calc_total numeric(12,2) := 0;
  v_item jsonb;
  v_prod_id uuid;
  v_qty int;
  v_prod public.products%ROWTYPE;
  v_item_subtotal numeric(12,2);
  v_final_distributor_id uuid := _distributor_id;
  v_history_entry jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  IF jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item' USING ERRCODE = '22023';
  END IF;

  -- Validate retailer
  IF NOT EXISTS (SELECT 1 FROM public.retailers WHERE id = _retailer_id AND is_active = true) THEN
    RAISE EXCEPTION 'Retailer not found or inactive' USING ERRCODE = 'P0002';
  END IF;

  -- Default distributor from retailer if not provided
  IF v_final_distributor_id IS NULL THEN
    SELECT distributor_id INTO v_final_distributor_id FROM public.retailers WHERE id = _retailer_id;
  END IF;

  v_order_number := public.generate_order_number();
  v_history_entry := jsonb_build_array(jsonb_build_object(
    'status', 'pending',
    'changed_by', v_user_id,
    'changed_at', now(),
    'note', 'Order created'
  ));

  -- Step 1: Pre-create the order
  INSERT INTO public.orders (
    order_number, retailer_id, distributor_id, sales_rep_id,
    status, subtotal, total_amount, notes, status_history
  ) VALUES (
    v_order_number, _retailer_id, v_final_distributor_id, v_user_id,
    'pending', 0, 0, _notes, v_history_entry
  ) RETURNING id INTO v_order_id;

  -- Step 2: Iterate through items with row-level locking
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_prod_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::int;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be greater than zero' USING ERRCODE = '22023';
    END IF;

    -- Lock the product row to ensure inventory consistency
    SELECT * INTO v_prod FROM public.products WHERE id = v_prod_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_prod_id USING ERRCODE = 'P0002';
    END IF;

    IF NOT v_prod.is_active THEN
      RAISE EXCEPTION 'Product % (%) is inactive', v_prod.name, v_prod.sku USING ERRCODE = '22023';
    END IF;

    IF v_prod.stock_quantity < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for product "%". Available: %, Requested: %',
        v_prod.name, v_prod.stock_quantity, v_qty USING ERRCODE = '22023';
    END IF;

    v_item_subtotal := round((v_prod.selling_price * v_qty)::numeric, 2);
    v_calc_subtotal := v_calc_subtotal + v_item_subtotal;

    -- Deduct product stock quantity atomically
    UPDATE public.products
      SET stock_quantity = stock_quantity - v_qty, updated_by = v_user_id
      WHERE id = v_prod_id;

    -- Write inventory audit movement row
    INSERT INTO public.inventory_movements (
      product_id, change, quantity_after, reason, note, created_by
    ) VALUES (
      v_prod_id, -v_qty, (v_prod.stock_quantity - v_qty),
      'adjustment', 'Order ' || v_order_number, v_user_id
    );

    -- Insert order item
    INSERT INTO public.order_items (
      order_id, product_id, quantity, unit_price, total_price
    ) VALUES (
      v_order_id, v_prod_id, v_qty, v_prod.selling_price, v_item_subtotal
    );
  END LOOP;

  v_calc_total := v_calc_subtotal;

  -- Step 3: Update order with verified totals
  UPDATE public.orders
    SET subtotal = v_calc_subtotal, total_amount = v_calc_total
    WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'status', 'pending',
    'subtotal', v_calc_subtotal,
    'total_amount', v_calc_total
  );
END;
$$;

-- 7. Atomic Order Cancellation with Stock Restoration
CREATE OR REPLACE FUNCTION public.cancel_order_atomic(
  _order_id uuid,
  _reason text DEFAULT 'Customer requested cancellation'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_item record;
  v_is_staff boolean;
  v_current_stock int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  v_is_staff := public.is_staff(v_user_id);
  IF NOT v_is_staff AND v_order.sales_rep_id <> v_user_id THEN
    RAISE EXCEPTION 'You are not authorized to cancel this order' USING ERRCODE = '42501';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Order is already cancelled' USING ERRCODE = '22023';
  END IF;

  IF v_order.status IN ('delivered', 'dispatched') AND NOT v_is_staff THEN
    RAISE EXCEPTION 'Dispatched or delivered orders can only be cancelled by staff' USING ERRCODE = '42501';
  END IF;

  -- Restore stock for all order items
  FOR v_item IN SELECT * FROM public.order_items WHERE order_id = _order_id LOOP
    UPDATE public.products
      SET stock_quantity = stock_quantity + v_item.quantity, updated_by = v_user_id
      WHERE id = v_item.product_id
      RETURNING stock_quantity INTO v_current_stock;

    INSERT INTO public.inventory_movements (
      product_id, change, quantity_after, reason, note, created_by
    ) VALUES (
      v_item.product_id, v_item.quantity, v_current_stock,
      'return', 'Order cancelled: ' || v_order.order_number || ' (' || _reason || ')', v_user_id
    );
  END LOOP;

  -- Update order status
  UPDATE public.orders
    SET status = 'cancelled',
        status_history = status_history || jsonb_build_object(
          'status', 'cancelled',
          'changed_by', v_user_id,
          'changed_at', now(),
          'note', _reason
        )
    WHERE id = _order_id;

  RETURN jsonb_build_object(
    'order_id', _order_id,
    'order_number', v_order.order_number,
    'status', 'cancelled',
    'restored_items_count', (SELECT count(*) FROM public.order_items WHERE order_id = _order_id)
  );
END;
$$;

-- 8. Order Status Transition Function
CREATE OR REPLACE FUNCTION public.update_order_status(
  _order_id uuid,
  _new_status public.order_status,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_is_staff boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  v_is_staff := public.is_staff(v_user_id);

  -- Cancellation should go through cancel_order_atomic to restore stock
  IF _new_status = 'cancelled' THEN
    RETURN public.cancel_order_atomic(_order_id, coalesce(_note, 'Cancelled via status update'));
  END IF;

  -- Only staff can move past confirmed
  IF _new_status IN ('processing', 'dispatched', 'delivered') AND NOT v_is_staff THEN
    RAISE EXCEPTION 'Only managers and admins can change order status to %', _new_status USING ERRCODE = '42501';
  END IF;

  UPDATE public.orders
    SET status = _new_status,
        status_history = status_history || jsonb_build_object(
          'status', _new_status,
          'changed_by', v_user_id,
          'changed_at', now(),
          'note', coalesce(_note, 'Status updated')
        )
    WHERE id = _order_id;

  RETURN jsonb_build_object(
    'order_id', _order_id,
    'order_number', v_order.order_number,
    'status', _new_status
  );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.create_order_atomic(uuid, jsonb, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_atomic(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, public.order_status, text) TO authenticated;
