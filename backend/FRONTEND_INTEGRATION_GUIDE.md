# FieldAssist — Frontend Integration Guide

This guide is for frontend developers connecting their React / Vite / TypeScript application to the FieldAssist Supabase backend.

---

## 1. Environment Setup

In your frontend project root, create or update `.env`:

```env
VITE_SUPABASE_URL="https://baqelrnhnrsdnubasepq.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcWVscm5obnJzZG51YmFzZXBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NTg3NjgsImV4cCI6MjEwNzEzNDc2OH0.FoaZMFc1cwkQhkWiEXEGfwYZOHS_Ca7DR28UXsBgJy4"
```

Install the Supabase JS client if not already installed:
```bash
npm install @supabase/supabase-js
```

---

## 2. Supabase Client Setup

Create `src/lib/supabaseClient.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

## 3. Authentication & Roles

### 3.1 Sign In (Email & Password)
```typescript
import { supabase } from "@/lib/supabaseClient";

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data.session;
}
```

### 3.2 Create Account / Sign Up (Email & Password)
```typescript
export async function register(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });
  if (error) throw error;
  return data;
}
```

### 3.3 Sign In / Sign Up with Google (Gmail)
```typescript
export async function loginWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });
  if (error) throw error;
  return data;
}
```


### 3.4 Get Current User & Role
```typescript
export async function getCurrentUserRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const role = roles?.[0]?.role ?? "sales_rep"; // 'admin' | 'manager' | 'sales_rep'
  const isAdmin = role === "admin";
  const isStaff = role === "admin" || role === "manager";

  return { user, role, isAdmin, isStaff };
}
```

### 3.5 Role-Based UI Routing
```typescript
// Example: in your App.tsx or ProtectedRoute
const userSession = await getCurrentUserRole();

if (!userSession) {
  navigate("/login");
} else if (userSession.isAdmin || userSession.isStaff) {
  navigate("/admin/dashboard"); // Admin view: Team metrics, product management, stock adjustment
} else {
  navigate("/rep/attendance"); // Sales Rep view: Daily check-in, visit stores, take orders
}
```

### 3.6 Sign Out
```typescript
export async function logout() {
  await supabase.auth.signOut();
}
```

### 3.7 Enabling Google Sign-In in Supabase (1-time setup)
To allow users to sign in with their Google/Gmail account:
1. Go to **Google Cloud Console** ([console.cloud.google.com](https://console.cloud.google.com/apis/credentials)) ➔ Create an **OAuth 2.0 Client ID** (Web application).
2. Set Authorized redirect URI to:
   `https://baqelrnhnrsdnubasepq.supabase.co/auth/v1/callback`
3. In your **Supabase Dashboard** ➔ **Authentication** ➔ **Providers** ➔ **Google**:
   - Toggle **Enable Google provider** to ON.
   - Paste your **Client ID** and **Client Secret**.
   - Click **Save**.
*(All new users signing in via Google automatically get their profile created and default to the `sales_rep` role!)*

---



## 4. Attendance Screen (Check-in & Check-out)

### 4.1 Daily Check-in
```typescript
export async function checkIn(coords?: { latitude: number; longitude: number }, notes?: string) {
  const { data, error } = await supabase.rpc("check_in_rep", {
    _latitude: coords?.latitude ?? null,
    _longitude: coords?.longitude ?? null,
    _notes: notes ?? null,
  });
  if (error) throw error;
  return data;
}
```

### 4.2 Daily Check-out
```typescript
export async function checkOut(coords?: { latitude: number; longitude: number }, notes?: string) {
  const { data, error } = await supabase.rpc("check_out_rep", {
    _latitude: coords?.latitude ?? null,
    _longitude: coords?.longitude ?? null,
    _notes: notes ?? null,
  });
  if (error) throw error;
  return data;
}
```

### 4.3 Get Today's Attendance Status
```typescript
export async function getTodayAttendance() {
  const { data: { user } } = await supabase.auth.getUser();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", user?.id)
    .eq("work_date", today)
    .maybeSingle();

  if (error) throw error;
  return data; // null if not checked in yet
}
```

---

## 5. Retailers & Distributors

### 5.1 Fetch Retailers
```typescript
export async function fetchRetailers(searchQuery?: string) {
  let query = supabase.from("retailers").select(`
    *,
    distributor:distributors(id, name, code)
  `).eq("is_active", true);

  if (searchQuery) {
    query = query.or(`name.ilike.%${searchQuery}%,code.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
  }

  const { data, error } = await query.order("name");
  if (error) throw error;
  return data;
}
```

### 5.2 Add New Retailer
```typescript
export async function addRetailer(retailer: {
  name: string;
  code?: string;
  owner_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  distributor_id?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase.from("retailers").insert({
    ...retailer,
    created_by: user?.id,
    assigned_rep_id: user?.id,
  }).select().single();

  if (error) throw error;
  return data;
}
```

---

## 6. Store Visits

### 6.1 Start a Visit
```typescript
export async function startVisit(retailerId: string, coords?: { latitude: number; longitude: number }) {
  const { data, error } = await supabase.rpc("start_visit", {
    _retailer_id: retailerId,
    _latitude: coords?.latitude ?? null,
    _longitude: coords?.longitude ?? null,
    _notes: "Store visit started",
  });
  if (error) throw error;
  return data;
}
```

### 6.2 Check Active Visit
```typescript
export async function getActiveVisit() {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("visits")
    .select("*, retailer:retailers(*)")
    .eq("sales_rep_id", user?.id)
    .eq("status", "in_progress")
    .maybeSingle();

  if (error) throw error;
  return data;
}
```

### 6.3 Complete a Visit (with outcome & order linkage)
```typescript
export async function completeVisit(
  visitId: string,
  outcome: "order_placed" | "follow_up_required" | "no_order" | "retailer_unavailable" | "other",
  orderId?: string,
  notes?: string
) {
  const { data, error } = await supabase.rpc("complete_visit", {
    _visit_id: visitId,
    _outcome: outcome,
    _order_id: orderId ?? null,
    _notes: notes ?? null,
  });
  if (error) throw error;
  return data;
}
```

---

## 7. Products & Inventory

### 7.1 Fetch Active Product Catalog
```typescript
export async function fetchProducts(category?: string) {
  let query = supabase.from("products").select("*").eq("is_active", true);
  if (category) query = query.eq("category", category);

  const { data, error } = await query.order("name");
  if (error) throw error;
  return data;
}
```

---

## 8. Orders & Order History

### 8.1 Create Order (Atomic with Stock Deduction)
```typescript
export async function createOrder(
  retailerId: string,
  items: Array<{ product_id: string; quantity: number }>,
  notes?: string
) {
  const { data, error } = await supabase.rpc("create_order_atomic", {
    _retailer_id: retailerId,
    _items: items,
    _notes: notes ?? null,
  });
  if (error) throw error;
  return data; // Returns { order_id, order_number, total_amount, status: 'pending' }
}
```

### 8.2 Fetch Order History
```typescript
export async function fetchOrderHistory(filters?: { status?: string; retailerId?: string }) {
  let query = supabase.from("orders").select(`
    *,
    retailer:retailers(name, phone, address),
    items:order_items(quantity, unit_price, total_price, product:products(name, sku))
  `);

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.retailerId) query = query.eq("retailer_id", filters.retailerId);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
```

### 8.3 Cancel Order (Restores Inventory Automatically)
```typescript
export async function cancelOrder(orderId: string, reason: string) {
  const { data, error } = await supabase.rpc("cancel_order_atomic", {
    _order_id: orderId,
    _reason: reason,
  });
  if (error) throw error;
  return data;
}
```

---

## 9. Dashboard Summary Metrics

```typescript
export async function getDashboardStats() {
  const { data, error } = await supabase.rpc("get_dashboard_summary");
  if (error) throw error;
  return data;
}
```
Returns:
```json
{
  "today_orders_count": 3,
  "today_orders_total": 4500.00,
  "today_visits_count": 5,
  "today_attendance_count": 2,
  "total_retailers_count": 18,
  "total_products_count": 25,
  "low_stock_products_count": 2
}
```
*(Automatically scoped: Sales reps only see their own daily stats, while Admins/Managers see team totals).*

---

## 10. GPS, Google Maps & Beat Planning

### 10.1 Environment Variable Setup
In your frontend `.env` file, add your Google Maps API key:
```env
VITE_GOOGLE_MAPS_API_KEY="YOUR_GOOGLE_MAPS_API_KEY"
```

> **Google Cloud Key Configuration:**
> 1. In Google Cloud Console, enable **Maps JavaScript API**.
> 2. Under Credentials, restrict your API key to **HTTP referrers**:
>    - `http://localhost:5173/*` (for local Vite dev)
>    - `https://your-production-domain.com/*`
> 3. Restrict API key to only **Maps JavaScript API**.

### 10.2 Browser Geolocation (No Google Key Required)
Use the included `useGeolocation` hook:
```typescript
import { useGeolocation } from "@/hooks/useGeolocation";

const { latitude, longitude, error, loading, getLocation } = useGeolocation();

// Trigger on button click:
<button onClick={getLocation}>📍 Get My Location</button>
```

### 10.3 Save & Load Daily Beat Plan
```typescript
import { saveBeatPlan, getDailyBeatPlan } from "@/integrations/supabase/beats";
import { supabase } from "@/lib/supabaseClient";

// 1. Save ordered route sequence (1: Store B, 2: Store A):
await saveBeatPlan(supabase, {
  planDate: "2026-10-10",
  title: "Central Delhi Saturday Route",
  retailerIds: ["retailer-uuid-2", "retailer-uuid-1"], // Sequenced visit order
});

// 2. Retrieve today's planned route with coordinates:
const plan = await getDailyBeatPlan(supabase, "2026-10-10");
console.log(plan.items); // Ordered stops with lat, lng, address, sequence_order
```

### 10.4 Updating Store Coordinates & Google Navigation
```typescript
import { updateRetailerCoordinates, getGoogleMapsDirectionsUrl } from "@/integrations/supabase/beats";

// Pin current rep GPS as retailer's coordinates:
await updateRetailerCoordinates(supabase, retailerId, latitude, longitude);

// Generate Google Maps navigation link:
const navUrl = getGoogleMapsDirectionsUrl(
  { latitude: repLat, longitude: repLng },
  { latitude: storeLat, longitude: storeLng }
);
window.open(navUrl, "_blank");
```

---

## 11. API & RPC Reference Summary

| Operation | Method / Function | PostgREST / RPC Endpoint | Auth / Roles Required |
|---|---|---|---|
| Sign In | `supabase.auth.signInWithPassword()` | `/auth/v1/token?grant_type=password` | Public |
| Sign Out | `supabase.auth.signOut()` | `/auth/v1/logout` | Authenticated |
| Get User Roles | `supabase.from('user_roles').select('*')` | `/rest/v1/user_roles` | Authenticated |
| List Products | `supabase.from('products').select('*')` | `/rest/v1/products` | Authenticated (Active only, or Staff for all) |
| Adjust Stock | `supabase.rpc('adjust_product_stock')` | `/rest/v1/rpc/adjust_product_stock` | Admin / Manager |
| List Retailers | `supabase.from('retailers').select('*')` | `/rest/v1/retailers` | Authenticated (Assigned or Staff) |
| Add Retailer | `supabase.from('retailers').insert(...)` | `/rest/v1/retailers` | Authenticated |
| Update Retailer | `supabase.from('retailers').update(...)` | `/rest/v1/retailers` | Authenticated |
| List Distributors | `supabase.from('distributors').select('*')` | `/rest/v1/distributors` | Authenticated |
| Add Distributor | `supabase.from('distributors').insert(...)` | `/rest/v1/distributors` | Admin / Manager |
| Daily Check-in | `supabase.rpc('check_in_rep')` | `/rest/v1/rpc/check_in_rep` | Authenticated (Rep / Staff) |
| Daily Check-out | `supabase.rpc('check_out_rep')` | `/rest/v1/rpc/check_out_rep` | Authenticated (Rep / Staff) |
| Start Store Visit | `supabase.rpc('start_visit')` | `/rest/v1/rpc/start_visit` | Authenticated (Rep / Staff) |
| Complete Visit | `supabase.rpc('complete_visit')` | `/rest/v1/rpc/complete_visit` | Authenticated (Rep / Staff) |
| Create Order (Atomic) | `supabase.rpc('create_order_atomic')` | `/rest/v1/rpc/create_order_atomic` | Authenticated (Rep / Staff) |
| Order History | `supabase.from('orders').select(...)` | `/rest/v1/orders` | Authenticated (Own or Staff) |
| Update Order Status | `supabase.rpc('update_order_status')` | `/rest/v1/rpc/update_order_status` | Staff (or Rep for cancellation) |
| Cancel Order (Atomic) | `supabase.rpc('cancel_order_atomic')` | `/rest/v1/rpc/cancel_order_atomic` | Authenticated (Own or Staff) |
| Dashboard Summary | `supabase.rpc('get_dashboard_summary')` | `/rest/v1/rpc/get_dashboard_summary` | Authenticated |
| Save Beat Plan | `supabase.rpc('save_beat_plan')` | `/rest/v1/rpc/save_beat_plan` | Authenticated (Rep / Staff) |
| Get Beat Plan | `supabase.rpc('get_daily_beat_plan')` | `/rest/v1/rpc/get_daily_beat_plan` | Authenticated (Rep / Staff) |
| Update Store GPS | `supabase.rpc('update_retailer_location')` | `/rest/v1/rpc/update_retailer_location` | Authenticated |

---

## 12. Deployment Architecture


### Backend Services (Serverless & Instant)
- The FieldAssist backend runs fully serverless on Supabase (`baqelrnhnrsdnubasepq.supabase.co`).
- **No separate Node.js / Bun application server is needed to be hosted or kept running.**
- The PostgreSQL database handles authentication, Row Level Security (RLS), multi-table atomic transactions, inventory race condition protection, and sequential order generation via PostgreSQL `SECURITY DEFINER` stored procedures.

### Frontend Deployment Options
For your frontend teammates deploying the React / Vite application:
1. **Vercel** (Recommended):
   - Import git repository
   - Framework preset: Vite
   - Add environment variables in Project Settings:
     - `VITE_SUPABASE_URL=https://baqelrnhnrsdnubasepq.supabase.co`
     - `VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Deploy button -> Live in 60 seconds.
2. **Netlify**:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Add the same two environment variables.
3. **Local Testing**:
   - Simply copy the `.env` values above into the local frontend `.env` file and run `npm run dev`.

