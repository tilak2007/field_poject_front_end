-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'sales_rep');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Profiles
CREATE TABLE public.profiles (
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

-- User roles
CREATE TABLE public.user_roles (
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

-- Territories (hierarchical: region > area > beat)
CREATE TABLE public.territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.territories(id) ON DELETE RESTRICT,
  name text NOT NULL,
  code text UNIQUE,
  level text NOT NULL DEFAULT 'area',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_territories_parent ON public.territories(parent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.territories TO authenticated;
GRANT ALL ON public.territories TO service_role;
ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;

-- Territory assignments
CREATE TABLE public.user_territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  territory_id uuid NOT NULL REFERENCES public.territories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, territory_id)
);
CREATE INDEX idx_user_territories_territory ON public.user_territories(territory_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_territories TO authenticated;
GRANT ALL ON public.user_territories TO service_role;
ALTER TABLE public.user_territories ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_territory(_user_id uuid, _territory_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_territories WHERE user_id = _user_id AND territory_id = _territory_id)
$$;

-- Distributors
CREATE TABLE public.distributors (
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
CREATE INDEX idx_distributors_territory ON public.distributors(territory_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.distributors TO authenticated;
GRANT ALL ON public.distributors TO service_role;
ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;

-- Retailers
CREATE TABLE public.retailers (
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
CREATE INDEX idx_retailers_territory ON public.retailers(territory_id);
CREATE INDEX idx_retailers_distributor ON public.retailers(distributor_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retailers TO authenticated;
GRANT ALL ON public.retailers TO service_role;
ALTER TABLE public.retailers ENABLE ROW LEVEL SECURITY;

-- updated_at triggers
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_territories_updated BEFORE UPDATE ON public.territories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_distributors_updated BEFORE UPDATE ON public.distributors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_retailers_updated BEFORE UPDATE ON public.retailers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup (no role granted automatically)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Policies: profiles
CREATE POLICY "profiles_select_own_or_staff" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policies: user_roles (read own; admin reads all; writes only via service role)
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Policies: territories
CREATE POLICY "territories_select" ON public.territories FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_territory(auth.uid(), id));
CREATE POLICY "territories_admin_write" ON public.territories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policies: user_territories
CREATE POLICY "user_territories_select" ON public.user_territories FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "user_territories_staff_write" ON public.user_territories FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Policies: distributors
CREATE POLICY "distributors_select" ON public.distributors FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_territory(auth.uid(), territory_id));
CREATE POLICY "distributors_staff_write" ON public.distributors FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Policies: retailers
CREATE POLICY "retailers_select" ON public.retailers FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_territory(auth.uid(), territory_id));
CREATE POLICY "retailers_rep_insert" ON public.retailers FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) OR (public.has_territory(auth.uid(), territory_id) AND created_by = auth.uid()));
CREATE POLICY "retailers_rep_update" ON public.retailers FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_territory(auth.uid(), territory_id))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_territory(auth.uid(), territory_id));
CREATE POLICY "retailers_staff_delete" ON public.retailers FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));
