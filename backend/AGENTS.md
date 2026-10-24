# FieldAssist Backend — Rules

- This project is backend-only; the React/Vite frontend lives in a separate codebase. Why: avoid duplicated or conflicting UI.
- Backend runs on Lovable Cloud (PostgreSQL + auth + edge functions). Why: managed, secure, no external accounts.
- All schema changes go through migrations; every public table gets GRANTs, RLS enabled, and explicit policies. Why: locked-by-default data access.
- User roles live in a dedicated `user_roles` table checked via a security-definer function, never in profile or client-editable metadata. Why: prevents privilege escalation.
- Privileged keys (service role, third-party API keys) are only used server-side in edge functions via stored secrets; clients only get the publishable key. Why: no secret exposure.
- Business APIs are exposed as edge functions under `supabase/functions/<domain>-*` (e.g. orders, visits, attendance). Why: clear domain boundaries for the external frontend.
- Stock quantity changes go through the `adjust_product_stock` database function, which also writes an `inventory_movements` audit row. Why: atomic updates with a full stock history.
- Edge functions call the database with the caller's sign-in token (not the service key) so row-level rules enforce permissions. Why: one permission system, enforced in the database.
