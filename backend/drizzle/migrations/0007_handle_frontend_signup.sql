-- Migration 0007: Handle Frontend Signup Form (Name, Role, Territory, Email)
-- Automatically processes the frontend signup form fields:
-- 1. Saves Full Name to profiles
-- 2. Automatically assigns selected Role (Sales Rep, Manager, Admin) to user_roles
-- 3. Automatically links the selected Territory (e.g. North Delhi) to user_territories
-- 4. Auto-confirms user email so they can log in immediately without email verification roadblock

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_raw text;
  v_app_role public.app_role;
  v_territory_name text;
  v_territory_id uuid;
BEGIN
  -- 1. Create or update profile with user's full name
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

  -- 2. Determine and assign Role from frontend dropdown
  v_role_raw := lower(COALESCE(NEW.raw_user_meta_data->>'role', 'sales_rep'));
  
  IF v_role_raw LIKE '%admin%' THEN
    v_app_role := 'admin'::public.app_role;
  ELSIF v_role_raw LIKE '%manager%' THEN
    v_app_role := 'manager'::public.app_role;
  ELSE
    v_app_role := 'sales_rep'::public.app_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 3. Automatically link Territory (e.g., North Delhi)
  v_territory_name := btrim(COALESCE(NEW.raw_user_meta_data->>'territory', ''));
  IF v_territory_name <> '' THEN
    -- Check if territory exists or create it
    SELECT id INTO v_territory_id 
      FROM public.territories 
      WHERE lower(name) = lower(v_territory_name) 
      LIMIT 1;

    IF v_territory_id IS NULL THEN
      INSERT INTO public.territories (name, code, level)
      VALUES (
        v_territory_name, 
        upper(regexp_replace(v_territory_name, '[^a-zA-Z0-9]+', '_', 'g')), 
        'area'
      )
      RETURNING id INTO v_territory_id;
    END IF;

    -- Assign user to this territory
    IF v_territory_id IS NOT NULL THEN
      INSERT INTO public.user_territories (user_id, territory_id)
      VALUES (NEW.id, v_territory_id)
      ON CONFLICT (user_id, territory_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Auto-confirm any pending unconfirmed users so they can log in right now
UPDATE auth.users 
SET email_confirmed_at = now() 
WHERE email_confirmed_at IS NULL;
