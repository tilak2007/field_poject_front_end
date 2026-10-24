// Visits & Attendance API. Runs with caller's JWT so database RLS enforces permissions.
// Routes:
//   POST   /visits-api/attendance/check-in       Record daily check-in (prevents duplicates)
//   POST   /visits-api/attendance/check-out      Record daily check-out
//   GET    /visits-api/attendance/today          Get caller's attendance for today
//   GET    /visits-api/attendance/history        List attendance records (date range, rep filter, pagination)
//
//   POST   /visits-api/visits/start              Start a retailer visit (enforces 1 active visit max)
//   POST   /visits-api/visits/:id/complete       Complete visit with outcome & optional order linkage
//   GET    /visits-api/visits/active             Get caller's current in-progress visit
//   GET    /visits-api/visits/history            List visits (filters: retailer, rep, outcome, dates)
//   GET    /visits-api/visits/:id                Visit details (includes linked order and retailer)

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const fail = (status: number, code: string, message: string, details?: unknown) =>
  json(status, { status: "error", error: { code, message, details } });

const uuid = z.string().uuid();
const latSchema = z.number().min(-90).max(90).optional().nullable();
const lngSchema = z.number().min(-180).max(180).optional().nullable();

const checkInSchema = z.object({
  latitude: latSchema,
  longitude: lngSchema,
  notes: z.string().trim().max(500).optional().nullable(),
}).strict();

const checkOutSchema = z.object({
  latitude: latSchema,
  longitude: lngSchema,
  notes: z.string().trim().max(500).optional().nullable(),
}).strict();

const startVisitSchema = z.object({
  retailer_id: uuid,
  latitude: latSchema,
  longitude: lngSchema,
  notes: z.string().trim().max(500).optional().nullable(),
}).strict();

const completeVisitSchema = z.object({
  outcome: z.enum(["order_placed", "follow_up_required", "no_order", "retailer_unavailable", "other"]),
  order_id: uuid.optional().nullable(),
  latitude: latSchema,
  longitude: lngSchema,
  notes: z.string().trim().max(500).optional().nullable(),
}).strict();

function dbError(e: { code?: string; message: string }) {
  if (e.code === "23505") return fail(409, "duplicate_record", e.message || "Record or active state already exists");
  if (e.code === "42501" || e.code === "PGRST301") return fail(403, "forbidden", "You are not authorized to perform this operation");
  if (e.code === "P0002" || e.code === "PGRST116") return fail(404, "not_found", e.message || "Resource not found");
  if (e.code === "22023") return fail(422, "invalid_operation", e.message || "Invalid operation parameters");
  console.error("Database error:", e);
  return fail(500, "server_error", e.message || "An unexpected error occurred");
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

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const rootIndex = parts.indexOf("visits-api");
  const domain = parts[rootIndex + 1]; // "attendance" or "visits"
  const actionOrId = parts[rootIndex + 2];
  const subAction = parts[rootIndex + 3];

  let body: unknown = undefined;
  if (req.method === "POST" || req.method === "PATCH") {
    try { body = await req.json(); } catch { return fail(400, "invalid_json", "Body must be valid JSON"); }
  }

  try {
    // ==============================================================
    // ATTENDANCE DOMAIN
    // ==============================================================
    if (domain === "attendance") {
      // 1. CHECK-IN
      if (req.method === "POST" && actionOrId === "check-in") {
        const parsed = checkInSchema.safeParse(body || {});
        if (!parsed.success) return fail(422, "validation_error", "Invalid check-in payload", parsed.error.flatten());

        const { data, error } = await supabase.rpc("check_in_rep", {
          _latitude: parsed.data.latitude ?? null,
          _longitude: parsed.data.longitude ?? null,
          _notes: parsed.data.notes ?? null,
        });
        if (error) return dbError(error);
        return json(201, { status: "success", message: "Checked in successfully", data });
      }

      // 2. CHECK-OUT
      if (req.method === "POST" && actionOrId === "check-out") {
        const parsed = checkOutSchema.safeParse(body || {});
        if (!parsed.success) return fail(422, "validation_error", "Invalid check-out payload", parsed.error.flatten());

        const { data, error } = await supabase.rpc("check_out_rep", {
          _latitude: parsed.data.latitude ?? null,
          _longitude: parsed.data.longitude ?? null,
          _notes: parsed.data.notes ?? null,
        });
        if (error) return dbError(error);
        return json(200, { status: "success", message: "Checked out successfully", data });
      }

      // 3. TODAY'S ATTENDANCE
      if (req.method === "GET" && actionOrId === "today") {
        const today = new Date().toISOString().split("T")[0];
        const { data, error } = await supabase.from("attendance")
          .select("*")
          .eq("user_id", userId)
          .eq("work_date", today)
          .maybeSingle();
        if (error) return dbError(error);
        return json(200, { status: "success", data });
      }

      // 4. ATTENDANCE HISTORY
      if (req.method === "GET" && (actionOrId === "history" || !actionOrId)) {
        const fromDate = url.searchParams.get("from_date");
        const toDate = url.searchParams.get("to_date");
        const repId = url.searchParams.get("user_id");
        const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
        const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") ?? "20", 10)));

        let query = supabase.from("attendance").select("*, user:profiles(id, full_name, email)", { count: "exact" });
        if (fromDate) query = query.gte("work_date", fromDate);
        if (toDate) query = query.lte("work_date", toDate);
        if (repId) query = query.eq("user_id", repId);

        query = query.order("work_date", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
        const { data, error, count } = await query;
        if (error) return dbError(error);
        return json(200, { status: "success", data, pagination: { page, page_size: pageSize, total: count ?? 0 } });
      }

      return fail(405, "method_not_allowed", "Route not supported");
    }

    // ==============================================================
    // VISITS DOMAIN
    // ==============================================================
    if (domain === "visits") {
      // 1. START VISIT
      if (req.method === "POST" && actionOrId === "start") {
        const parsed = startVisitSchema.safeParse(body);
        if (!parsed.success) return fail(422, "validation_error", "Invalid start visit payload", parsed.error.flatten());

        const { data, error } = await supabase.rpc("start_visit", {
          _retailer_id: parsed.data.retailer_id,
          _latitude: parsed.data.latitude ?? null,
          _longitude: parsed.data.longitude ?? null,
          _notes: parsed.data.notes ?? null,
        });
        if (error) return dbError(error);
        return json(201, { status: "success", message: "Visit started", data });
      }

      // 2. COMPLETE VISIT
      if (req.method === "POST" && actionOrId && subAction === "complete") {
        if (!uuid.safeParse(actionOrId).success) return fail(400, "invalid_id", "Invalid visit ID");
        const parsed = completeVisitSchema.safeParse(body);
        if (!parsed.success) return fail(422, "validation_error", "Invalid complete visit payload", parsed.error.flatten());

        const { data, error } = await supabase.rpc("complete_visit", {
          _visit_id: actionOrId,
          _outcome: parsed.data.outcome,
          _order_id: parsed.data.order_id ?? null,
          _latitude: parsed.data.latitude ?? null,
          _longitude: parsed.data.longitude ?? null,
          _notes: parsed.data.notes ?? null,
        });
        if (error) return dbError(error);
        return json(200, { status: "success", message: "Visit completed", data });
      }

      // 3. GET ACTIVE VISIT FOR CURRENT REP
      if (req.method === "GET" && actionOrId === "active") {
        const { data, error } = await supabase.from("visits")
          .select("*, retailer:retailers(id, name, code, phone, address)")
          .eq("sales_rep_id", userId)
          .eq("status", "in_progress")
          .maybeSingle();
        if (error) return dbError(error);
        return json(200, { status: "success", data });
      }

      // 4. LIST VISITS (HISTORY & FILTERS)
      if (req.method === "GET" && (actionOrId === "history" || !actionOrId)) {
        const retailerId = url.searchParams.get("retailer_id");
        const repId = url.searchParams.get("sales_rep_id");
        const outcome = url.searchParams.get("outcome");
        const status = url.searchParams.get("status");
        const fromDate = url.searchParams.get("from_date");
        const toDate = url.searchParams.get("to_date");
        const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
        const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") ?? "20", 10)));

        let query = supabase.from("visits").select(`
          *,
          retailer:retailers(id, name, code, phone, address),
          sales_rep:profiles(id, full_name, email),
          order:orders(id, order_number, total_amount, status)
        `, { count: "exact" });

        if (retailerId) query = query.eq("retailer_id", retailerId);
        if (repId) query = query.eq("sales_rep_id", repId);
        if (outcome) query = query.eq("outcome", outcome);
        if (status) query = query.eq("status", status);
        if (fromDate) query = query.gte("visit_date", fromDate);
        if (toDate) query = query.lte("visit_date", toDate);

        query = query.order("start_time", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
        const { data, error, count } = await query;
        if (error) return dbError(error);
        return json(200, { status: "success", data, pagination: { page, page_size: pageSize, total: count ?? 0 } });
      }

      // 5. GET SINGLE VISIT DETAILS
      if (req.method === "GET" && actionOrId && !subAction) {
        if (!uuid.safeParse(actionOrId).success) return fail(400, "invalid_id", "Invalid visit ID");
        const { data, error } = await supabase.from("visits")
          .select(`
            *,
            retailer:retailers(id, name, code, phone, address, owner_name),
            sales_rep:profiles(id, full_name, email, phone),
            order:orders(id, order_number, total_amount, status, created_at)
          `)
          .eq("id", actionOrId)
          .maybeSingle();
        if (error) return dbError(error);
        if (!data) return fail(404, "not_found", "Visit not found");
        return json(200, { status: "success", data });
      }

      return fail(405, "method_not_allowed", "Route not supported");
    }

    return fail(404, "not_found", "Domain not found");
  } catch (err) {
    console.error("Unhandled error:", err);
    return fail(500, "server_error", "Unexpected server error occurred");
  }
});
