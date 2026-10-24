// Retailer & Distributor Management API. Runs with caller's JWT so database RLS enforces permissions.
// Routes:
//   GET    /retailers-api                      list retailers (q, category, distributor_id, assigned_rep_id, is_active, page, page_size, sort)
//   GET    /retailers-api/:id                  retailer details (with distributor & rep profiles)
//   POST   /retailers-api                      create retailer (staff or assigned rep)
//   PATCH  /retailers-api/:id                  update retailer
//   PATCH  /retailers-api/:id/status           activate/deactivate retailer { is_active: boolean }
//   DELETE /retailers-api/:id                  delete retailer (staff only)
//
//   GET    /retailers-api/distributors         list distributors (q, territory_id, is_active, page, page_size)
//   GET    /retailers-api/distributors/:id     distributor details
//   POST   /retailers-api/distributors         create distributor (staff only)
//   PATCH  /retailers-api/distributors/:id     update distributor (staff only)
//   PATCH  /retailers-api/distributors/:id/status activate/deactivate distributor { is_active: boolean }

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const fail = (status: number, code: string, message: string, details?: unknown) =>
  json(status, { status: "error", error: { code, message, details } });

const uuid = z.string().uuid();
const phoneRegex = /^[+]?[0-9\s-]{7,20}$/;

// Retailer validation schemas
const createRetailerSchema = z.object({
  name: z.string().trim().min(2, "Business name must be at least 2 characters").max(200),
  code: z.string().trim().regex(/^[A-Za-z0-9._-]{1,50}$/, "Code must be 1-50 alphanumeric, ., _, or -").optional().nullable(),
  owner_name: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().regex(phoneRegex, "Invalid phone number format").optional().nullable(),
  email: z.string().trim().email("Invalid email format").max(255).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  category: z.string().trim().max(50).optional().nullable(),
  territory_id: uuid.optional().nullable(),
  distributor_id: uuid.optional().nullable(),
  assigned_rep_id: uuid.optional().nullable(),
  is_active: z.boolean().default(true),
}).strict();

const updateRetailerSchema = createRetailerSchema.partial().strict()
  .refine((v) => Object.keys(v).length > 0, "No fields provided to update");

const statusSchema = z.object({
  is_active: z.boolean(),
}).strict();

// Distributor validation schemas
const createDistributorSchema = z.object({
  name: z.string().trim().min(2, "Distributor name must be at least 2 characters").max(200),
  code: z.string().trim().regex(/^[A-Za-z0-9._-]{1,50}$/, "Code must be 1-50 alphanumeric, ., _, or -").optional().nullable(),
  contact_name: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().regex(phoneRegex, "Invalid phone number format").optional().nullable(),
  email: z.string().trim().email("Invalid email format").max(255).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  gst_number: z.string().trim().regex(/^[0-9A-Z]{15}$/, "GST number must be 15 alphanumeric characters").optional().nullable(),
  territory_id: uuid.optional().nullable(),
  is_active: z.boolean().default(true),
}).strict();

const updateDistributorSchema = createDistributorSchema.partial().strict()
  .refine((v) => Object.keys(v).length > 0, "No fields provided to update");

function dbError(e: { code?: string; message: string }) {
  if (e.code === "23505") return fail(409, "duplicate_record", "A record with this unique code or identifier already exists");
  if (e.code === "42501" || e.code === "PGRST301") return fail(403, "forbidden", "You are not authorized to perform this action");
  if (e.code === "23503") return fail(422, "invalid_reference", "Referenced territory, distributor, or representative does not exist");
  if (e.code === "P0002" || e.code === "PGRST116") return fail(404, "not_found", "Record not found");
  console.error("Database error:", e);
  return fail(500, "server_error", "Internal server error occurred");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return fail(401, "unauthorized", "Sign in required");

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });

  const { data: u, error: uErr } = await supabase.auth.getUser(auth.slice(7));
  if (uErr || !u.user) return fail(401, "unauthorized", "Invalid or expired session");
  const userId = u.user.id;

  const { data: staff } = await supabase.rpc("is_staff", { _user_id: userId });
  const isStaff = Boolean(staff);

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const rootIndex = parts.indexOf("retailers-api");
  const subRoute = parts[rootIndex + 1];
  const targetId = parts[rootIndex + 2];

  let body: unknown = undefined;
  if (req.method === "POST" || req.method === "PATCH") {
    try { body = await req.json(); } catch { return fail(400, "invalid_json", "Body must be valid JSON"); }
  }

  try {
    // ==============================================================
    // DISTRIBUTORS SUB-ROUTES (/retailers-api/distributors/...)
    // ==============================================================
    if (subRoute === "distributors") {
      const distId = targetId;
      const distSub = parts[rootIndex + 3];

      // LIST DISTRIBUTORS
      if (req.method === "GET" && !distId) {
        const q = url.searchParams.get("q")?.trim();
        const territoryId = url.searchParams.get("territory_id");
        const isActive = url.searchParams.get("is_active");
        const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
        const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") ?? "20", 10)));

        let query = supabase.from("distributors").select("*, territory:territories(id, name, code)", { count: "exact" });
        if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%,contact_name.ilike.%${q}%`);
        if (territoryId) query = query.eq("territory_id", territoryId);
        if (isActive === "true") query = query.eq("is_active", true);
        if (isActive === "false") query = query.eq("is_active", false);

        query = query.order("name").range((page - 1) * pageSize, page * pageSize - 1);
        const { data, error, count } = await query;
        if (error) return dbError(error);

        return json(200, {
          status: "success",
          data,
          pagination: { page, page_size: pageSize, total: count ?? 0 }
        });
      }

      // GET DISTRIBUTOR DETAILS
      if (req.method === "GET" && distId && !distSub) {
        if (!uuid.safeParse(distId).success) return fail(400, "invalid_id", "Invalid distributor ID");
        const { data, error } = await supabase.from("distributors")
          .select("*, territory:territories(id, name, code, level)")
          .eq("id", distId)
          .maybeSingle();
        if (error) return dbError(error);
        if (!data) return fail(404, "not_found", "Distributor not found");
        return json(200, { status: "success", data });
      }

      // CREATE DISTRIBUTOR (Staff only)
      if (req.method === "POST" && !distId) {
        if (!isStaff) return fail(403, "forbidden", "Only administrators and managers can create distributors");
        const parsed = createDistributorSchema.safeParse(body);
        if (!parsed.success) return fail(422, "validation_error", "Invalid distributor input", parsed.error.flatten());

        const { data, error } = await supabase.from("distributors").insert(parsed.data).select().single();
        if (error) return dbError(error);
        return json(201, { status: "success", message: "Distributor created successfully", data });
      }

      // UPDATE DISTRIBUTOR (Staff only)
      if (req.method === "PATCH" && distId && !distSub) {
        if (!isStaff) return fail(403, "forbidden", "Only administrators and managers can update distributors");
        if (!uuid.safeParse(distId).success) return fail(400, "invalid_id", "Invalid distributor ID");

        const parsed = updateDistributorSchema.safeParse(body);
        if (!parsed.success) return fail(422, "validation_error", "Invalid distributor update", parsed.error.flatten());

        const { data, error } = await supabase.from("distributors").update(parsed.data).eq("id", distId).select().maybeSingle();
        if (error) return dbError(error);
        if (!data) return fail(404, "not_found", "Distributor not found");
        return json(200, { status: "success", message: "Distributor updated successfully", data });
      }

      // DEACTIVATE / ACTIVATE DISTRIBUTOR STATUS (Staff only)
      if (req.method === "PATCH" && distId && distSub === "status") {
        if (!isStaff) return fail(403, "forbidden", "Only administrators and managers can change distributor status");
        if (!uuid.safeParse(distId).success) return fail(400, "invalid_id", "Invalid distributor ID");

        const parsed = statusSchema.safeParse(body);
        if (!parsed.success) return fail(422, "validation_error", "Status must be a boolean", parsed.error.flatten());

        const { data, error } = await supabase.from("distributors").update({ is_active: parsed.data.is_active }).eq("id", distId).select().maybeSingle();
        if (error) return dbError(error);
        if (!data) return fail(404, "not_found", "Distributor not found");
        return json(200, { status: "success", message: `Distributor ${parsed.data.is_active ? "activated" : "deactivated"} successfully`, data });
      }

      // DELETE DISTRIBUTOR (Staff only)
      if (req.method === "DELETE" && distId && !distSub) {
        if (!isStaff) return fail(403, "forbidden", "Only administrators and managers can delete distributors");
        if (!uuid.safeParse(distId).success) return fail(400, "invalid_id", "Invalid distributor ID");
        const { error } = await supabase.from("distributors").delete().eq("id", distId);
        if (error) return dbError(error);
        return json(200, { status: "success", message: "Distributor deleted successfully" });
      }

      return fail(405, "method_not_allowed", "Route not supported");
    }

    // ==============================================================
    // RETAILERS ROUTES (/retailers-api/...)
    // ==============================================================
    const retailerId = subRoute;
    const retailerSub = targetId;

    // LIST RETAILERS
    if (req.method === "GET" && !retailerId) {
      const q = url.searchParams.get("q")?.trim();
      const category = url.searchParams.get("category");
      const distributorId = url.searchParams.get("distributor_id");
      const repId = url.searchParams.get("assigned_rep_id");
      const isActive = url.searchParams.get("is_active");
      const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") ?? "20", 10)));

      let query = supabase.from("retailers").select(`
        *,
        distributor:distributors(id, name, code),
        assigned_rep:profiles!retailers_assigned_rep_id_fkey(id, full_name, email, phone)
      `, { count: "exact" });

      if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%,owner_name.ilike.%${q}%,phone.ilike.%${q}%`);
      if (category) query = query.eq("category", category);
      if (distributorId) query = query.eq("distributor_id", distributorId);
      if (repId) query = query.eq("assigned_rep_id", repId);
      if (isActive === "true") query = query.eq("is_active", true);
      if (isActive === "false") query = query.eq("is_active", false);

      query = query.order("name").range((page - 1) * pageSize, page * pageSize - 1);
      const { data, error, count } = await query;
      if (error) return dbError(error);

      return json(200, {
        status: "success",
        data,
        pagination: { page, page_size: pageSize, total: count ?? 0 }
      });
    }

    // GET RETAILER DETAILS
    if (req.method === "GET" && retailerId && !retailerSub) {
      if (!uuid.safeParse(retailerId).success) return fail(400, "invalid_id", "Invalid retailer ID");

      const { data, error } = await supabase.from("retailers")
        .select(`
          *,
          distributor:distributors(id, name, code, contact_name, phone),
          assigned_rep:profiles!retailers_assigned_rep_id_fkey(id, full_name, email, phone),
          territory:territories(id, name, code)
        `)
        .eq("id", retailerId)
        .maybeSingle();

      if (error) return dbError(error);
      if (!data) return fail(404, "not_found", "Retailer not found");
      return json(200, { status: "success", data });
    }

    // CREATE RETAILER
    if (req.method === "POST" && !retailerId) {
      const parsed = createRetailerSchema.safeParse(body);
      if (!parsed.success) return fail(422, "validation_error", "Invalid retailer input", parsed.error.flatten());

      const payload = {
        ...parsed.data,
        created_by: userId,
        assigned_rep_id: parsed.data.assigned_rep_id ?? (isStaff ? null : userId)
      };

      const { data, error } = await supabase.from("retailers").insert(payload).select().single();
      if (error) return dbError(error);
      return json(201, { status: "success", message: "Retailer created successfully", data });
    }

    // UPDATE RETAILER
    if (req.method === "PATCH" && retailerId && !retailerSub) {
      if (!uuid.safeParse(retailerId).success) return fail(400, "invalid_id", "Invalid retailer ID");
      const parsed = updateRetailerSchema.safeParse(body);
      if (!parsed.success) return fail(422, "validation_error", "Invalid retailer update", parsed.error.flatten());

      const { data, error } = await supabase.from("retailers").update(parsed.data).eq("id", retailerId).select().maybeSingle();
      if (error) return dbError(error);
      if (!data) return fail(404, "not_found", "Retailer not found or not permitted to edit");
      return json(200, { status: "success", message: "Retailer updated successfully", data });
    }

    // DEACTIVATE / ACTIVATE RETAILER STATUS
    if (req.method === "PATCH" && retailerId && retailerSub === "status") {
      if (!uuid.safeParse(retailerId).success) return fail(400, "invalid_id", "Invalid retailer ID");
      const parsed = statusSchema.safeParse(body);
      if (!parsed.success) return fail(422, "validation_error", "Status must be a boolean", parsed.error.flatten());

      const { data, error } = await supabase.from("retailers").update({ is_active: parsed.data.is_active }).eq("id", retailerId).select().maybeSingle();
      if (error) return dbError(error);
      if (!data) return fail(404, "not_found", "Retailer not found or not permitted to edit");
      return json(200, { status: "success", message: `Retailer ${parsed.data.is_active ? "activated" : "deactivated"} successfully`, data });
    }

    // DELETE RETAILER (Staff only)
    if (req.method === "DELETE" && retailerId && !retailerSub) {
      if (!isStaff) return fail(403, "forbidden", "Only administrators and managers can delete retailers");
      if (!uuid.safeParse(retailerId).success) return fail(400, "invalid_id", "Invalid retailer ID");
      const { error } = await supabase.from("retailers").delete().eq("id", retailerId);
      if (error) return dbError(error);
      return json(200, { status: "success", message: "Retailer deleted successfully" });
    }

    return fail(405, "method_not_allowed", "Route not supported");
  } catch (err) {
    console.error("Unhandled error:", err);
    return fail(500, "server_error", "Unexpected server error");
  }
});
