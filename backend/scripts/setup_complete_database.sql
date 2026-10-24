-- ================================================================
-- FIELDASSIST COMPLETE DATABASE SETUP
-- Migrations 0000 + 0001 + 0002 combined
-- ================================================================

-- 1. App Roles & Helpers
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'sales_rep');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  employee_code text UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. User Roles Table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','manager'))
$$;

-- 4. Territories Table
CREATE TABLE IF NOT EXISTS public.territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.territories(id) ON DELETE RESTRICT,
  name text NOT NULL,
  code text UNIQUE,
  level text NOT NULL DEFAULT 'area',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_territories_parent ON public.territories(parent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.territories TO authenticated;
GRANT ALL ON public.territories TO service_role;
ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;

-- 5. User Territories Table
CREATE TABLE IF NOT EXISTS public.user_territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  territory_id uuid NOT NULL REFERENCES public.territories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, territory_id)
);
CREATE INDEX IF NOT EXISTS idx_user_territories_territory ON public.user_territories(territory_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_territories TO authenticated;
GRANT ALL ON public.user_territories TO service_role;
ALTER TABLE public.user_territories ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_territory(_user_id uuid, _territory_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_territories WHERE user_id = _user_id AND territory_id = _territory_id)
$$;

-- 6. Distributors Table
CREATE TABLE IF NOT EXISTS public.distributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id uuid REFERENCES public.territories(id) ON DELETE SET NULL,
  name text NOT NULL,
  code text UNIQUE,
  contact_name text,
  phone text,
  email text,
  address text,
  gst_number text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_distributors_territory ON public.distributors(territory_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.distributors TO authenticated;
GRANT ALL ON public.distributors TO service_role;
ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;

-- 7. Retailers Table
CREATE TABLE IF NOT EXISTS public.retailers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id uuid REFERENCES public.territories(id) ON DELETE SET NULL,
  distributor_id uuid REFERENCES public.distributors(id) ON DELETE SET NULL,
  name text NOT NULL,
  code text UNIQUE,
  owner_name text,
  phone text,
  email text,
  address text,
  latitude double precision,
  longitude double precision,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_retailers_territory ON public.retailers(territory_id);
CREATE INDEX IF NOT EXISTS idx_retailers_distributor ON public.retailers(distributor_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retailers TO authenticated;
GRANT ALL ON public.retailers TO service_role;
ALTER TABLE public.retailers ENABLE ROW LEVEL SECURITY;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_territories_updated ON public.territories;
CREATE TRIGGER trg_territories_updated BEFORE UPDATE ON public.territories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_distributors_updated ON public.distributors;
CREATE TRIGGER trg_distributors_updated BEFORE UPDATE ON public.distributors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_retailers_updated ON public.retailers;
CREATE TRIGGER trg_retailers_updated BEFORE UPDATE ON public.retailers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Policies: profiles
DROP POLICY IF EXISTS "profiles_select_own_or_staff" ON public.profiles;
CREATE POLICY "profiles_select_own_or_staff" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policies: user_roles
DROP POLICY IF EXISTS "user_roles_select_own_or_admin" ON public.user_roles;
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Policies: territories
DROP POLICY IF EXISTS "territories_select" ON public.territories;
CREATE POLICY "territories_select" ON public.territories FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_territory(auth.uid(), id));

DROP POLICY IF EXISTS "territories_admin_write" ON public.territories;
CREATE POLICY "territories_admin_write" ON public.territories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policies: user_territories
DROP POLICY IF EXISTS "user_territories_select" ON public.user_territories;
CREATE POLICY "user_territories_select" ON public.user_territories FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "user_territories_staff_write" ON public.user_territories;
CREATE POLICY "user_territories_staff_write" ON public.user_territories FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Policies: distributors
DROP POLICY IF EXISTS "distributors_select" ON public.distributors;
CREATE POLICY "distributors_select" ON public.distributors FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_territory(auth.uid(), territory_id));

DROP POLICY IF EXISTS "distributors_staff_write" ON public.distributors;
CREATE POLICY "distributors_staff_write" ON public.distributors FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Policies: retailers
DROP POLICY IF EXISTS "retailers_select" ON public.retailers;
CREATE POLICY "retailers_select" ON public.retailers FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_territory(auth.uid(), territory_id));

DROP POLICY IF EXISTS "retailers_rep_insert" ON public.retailers;
CREATE POLICY "retailers_rep_insert" ON public.retailers FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) OR (public.has_territory(auth.uid(), territory_id) AND created_by = auth.uid()));

DROP POLICY IF EXISTS "retailers_rep_update" ON public.retailers;
CREATE POLICY "retailers_rep_update" ON public.retailers FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_territory(auth.uid(), territory_id))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_territory(auth.uid(), territory_id));

DROP POLICY IF EXISTS "retailers_staff_delete" ON public.retailers;
CREATE POLICY "retailers_staff_delete" ON public.retailers FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

-- Function execution permissions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_territory(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_territory(uuid, uuid) TO authenticated;

-- 8. Products & Inventory Tables
CREATE TABLE IF NOT EXISTS public.products (
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
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique ON public.products (lower(sku));
CREATE INDEX IF NOT EXISTS products_category_idx ON public.products (category);
CREATE INDEX IF NOT EXISTS products_name_idx ON public.products (lower(name));

GRANT SELECT, INSERT, UPDATE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_select ON public.products;
CREATE POLICY products_select ON public.products FOR SELECT TO authenticated
  USING (is_active OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS products_staff_insert ON public.products;
CREATE POLICY products_staff_insert ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS products_staff_update ON public.products;
CREATE POLICY products_staff_update ON public.products FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS trg_products_updated ON public.products;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  change integer NOT NULL CHECK (change <> 0),
  quantity_after integer NOT NULL CHECK (quantity_after >= 0),
  reason text NOT NULL CHECK (reason IN ('initial','restock','adjustment','correction','damage','return')),
  note text CHECK (note IS NULL OR length(note) <= 500),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_movements_product_idx ON public.inventory_movements (product_id, created_at DESC);
GRANT SELECT ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_movements_staff_select ON public.inventory_movements;
CREATE POLICY inventory_movements_staff_select ON public.inventory_movements FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Atomic stock adjustment
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
