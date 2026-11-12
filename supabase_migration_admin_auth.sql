-- ==============================================================================
-- FIELDASSIST: ADMIN-CONTROLLED AUTHENTICATION & ROLE-BASED AUTHORIZATION MIGRATION
-- Run this script in the Supabase Dashboard -> SQL Editor -> Run
-- ==============================================================================

-- 1. ADD SECURITY & LIFECYCLE COLUMNS TO public.user_profiles
DO $$
BEGIN
  -- Add status column ('Active' | 'Deactivated')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_profiles' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.user_profiles 
      ADD COLUMN status TEXT NOT NULL DEFAULT 'Active' 
      CHECK (status IN ('Active', 'Deactivated'));
  END IF;

  -- Add must_change_password column (BOOLEAN)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_profiles' 
    AND column_name = 'must_change_password'
  ) THEN
    ALTER TABLE public.user_profiles 
      ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
END $$;

-- 2. ENSURE KNOWN ADMINS DO NOT GET LOCKED OUT WITH MANDATORY PASSWORD CHANGE
UPDATE public.user_profiles
SET 
  status = 'Active',
  must_change_password = FALSE
WHERE role = 'System Admin' OR email IN ('vinaymeghu09@gmail.com', 'admin@fieldassist.io');

-- 3. HELPER FUNCTION TO CHECK IF CURRENT AUTHENTICATED USER IS A SYSTEM ADMIN
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'System Admin'
      AND status = 'Active'
  ) OR (
    -- Also allow Supabase Service Role key operations
    (auth.jwt() ->> 'role') = 'service_role'
  );
$$;

-- 4. PREVENT USERS FROM ELEVATING THEIR OWN ROLES OR UNBANNING THEMSELVES VIA DIRECT DB UPDATES
CREATE OR REPLACE FUNCTION public.enforce_profile_update_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If role or status is being changed:
  IF (OLD.role IS DISTINCT FROM NEW.role) OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Verify if caller is System Admin or service_role
    IF NOT public.is_system_admin() THEN
      RAISE EXCEPTION 'SECURITY VIOLATION: Only a System Administrator can alter user roles or account activation status.';
    END IF;
  END IF;

  -- Ensure role is strictly one of the 3 supported roles
  IF NEW.role NOT IN ('System Admin', 'Sales Manager', 'Sales Representative') THEN
    RAISE EXCEPTION 'INVALID ROLE: Role must be one of: "System Admin", "Sales Manager", "Sales Representative".';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_update_security ON public.user_profiles;
CREATE TRIGGER trg_profile_update_security
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_update_security();

-- 5. UPGRADE ROW LEVEL SECURITY (RLS) POLICIES ON public.user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop legacy permissive policies if they exist
DROP POLICY IF EXISTS "Allow read user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow write user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_policy" ON public.user_profiles;

-- Policy 1: SELECT
-- Admins can read all profiles.
-- Regular users can read their own profile or profiles needed for operations.
CREATE POLICY "user_profiles_select_policy"
  ON public.user_profiles
  FOR SELECT
  USING (
    public.is_system_admin()
    OR auth.uid() = id
    OR role IN ('Sales Manager', 'Sales Representative')
  );

-- Policy 2: INSERT
-- Strictly restricted to System Administrators and service_role.
-- Users cannot self-register by inserting directly into user_profiles.
CREATE POLICY "user_profiles_insert_policy"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (
    public.is_system_admin()
  );

-- Policy 3: UPDATE
-- Admins can update any profile.
-- Users can update their own profile (name, avatar, territory), but the BEFORE UPDATE trigger prevents changing role or status.
CREATE POLICY "user_profiles_update_policy"
  ON public.user_profiles
  FOR UPDATE
  USING (
    public.is_system_admin() OR auth.uid() = id
  )
  WITH CHECK (
    public.is_system_admin() OR auth.uid() = id
  );

-- Policy 4: DELETE
-- Strictly restricted to System Administrators and service_role.
CREATE POLICY "user_profiles_delete_policy"
  ON public.user_profiles
  FOR DELETE
  USING (
    public.is_system_admin()
  );

-- 6. STORED PROCEDURE: ADMIN USER CREATION / REGISTRATION VIA SECURE RPC
CREATE OR REPLACE FUNCTION public.admin_create_user(
  _user_id UUID,
  _email TEXT,
  _full_name TEXT,
  _role TEXT,
  _territory TEXT DEFAULT 'North Delhi',
  _region TEXT DEFAULT 'North Zone (Delhi-NCR)',
  _department TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dept TEXT;
  v_result JSONB;
BEGIN
  -- Verify caller is System Admin or service_role
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'ACCESS DENIED: Only a System Administrator can create new accounts.';
  END IF;

  -- Validate role
  IF _role NOT IN ('System Admin', 'Sales Manager', 'Sales Representative') THEN
    RAISE EXCEPTION 'Role must be System Admin, Sales Manager, or Sales Representative.';
  END IF;

  v_dept := COALESCE(_department, 
    CASE _role
      WHEN 'System Admin' THEN 'Executive Administration'
      WHEN 'Sales Manager' THEN 'Regional Sales Management'
      ELSE 'Field Sales Force'
    END
  );

  INSERT INTO public.user_profiles (
    id, full_name, email, role, avatar_url, territory, region, department, status, must_change_password
  )
  VALUES (
    _user_id,
    _full_name,
    LOWER(TRIM(_email)),
    _role,
    'https://ui-avatars.com/api/?name=' || replace(_full_name, ' ', '+') || '&background=0284c7&color=fff',
    _territory,
    _region,
    v_dept,
    'Active',
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    territory = EXCLUDED.territory,
    status = 'Active',
    must_change_password = TRUE;

  SELECT to_jsonb(up) INTO v_result 
  FROM public.user_profiles up 
  WHERE up.id = _user_id;

  RETURN jsonb_build_object('success', TRUE, 'user', v_result);
END;
$$;
