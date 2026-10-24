// Orders & Order History API. Runs with caller's JWT so database RLS enforces permissions.
// Routes:
//   GET    /orders-api                 list orders (status, retailer_id, rep_id, date range, page, page_size)
//   GET    /orders-api/:id             order details (with items, products, retailer, rep, status history)
//   POST   /orders-api                 create order (atomic stock deduction & audit log)
//   PATCH  /orders-api/:id/status      update order status (enforces transition & staff rules)
//   POST   /orders-api/:id/cancel      cancel order (restores inventory & logs movement)

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

const createOrderItemSchema = z.object({
  product_id: uuid,
  quantity: z.number().int().positive("Quantity must be greater than 0"),
});

const createOrderSchema = z.object({
  retailer_id: uuid,
  distributor_id: uuid.optional().nullable(),
  items: z.array(createOrderItemSchema).min(1, "Order must have at least one product item"),
  notes: z.string().trim().max(1000).optional().nullable(),
}).strict();

const statusUpdateSchema = z.object({
  status: z.enum(["pending", "confirmed", "processing", "dispatched", "delivered", "cancelled"]),
  note: z.string().trim().max(500).optional().nullable(),
}).strict();

const cancelOrderSchema = z.object({
  reason: z.string().trim().max(500).optional().default("Customer requested cancellation"),
}).strict();

function dbError(e: { code?: string; message: string }) {
  if (e.code === "23505") return fail(409, "duplicate_order", "Order with this number already exists");
  if (e.code === "42501" || e.code === "PGRST301") return fail(403, "forbidden", "You are not authorized to perform this operation");
  if (e.code === "P0002" || e.code === "PGRST116") return fail(404, "not_found", "Order, retailer, or product not found");
  if (e.code === "22023") return fail(422, "invalid_input", e.message || "Invalid order operation");
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
  const rootIndex = parts.indexOf("orders-api");
  const orderId = parts[rootIndex + 1];
  const subAction = parts[rootIndex + 2];

  let body: unknown = undefined;
  if (req.method === "POST" || req.method === "PATCH") {
    try { body = await req.json(); } catch { return fail(400, "invalid_json", "Request body must be valid JSON"); }
  }

  try {
    // 1. LIST ORDERS (Search, filter, paginate)
    if (req.method === "GET" && !orderId) {
      const q = url.searchParams.get("q")?.trim();
      const status = url.searchParams.get("status");
      const retailerId = url.searchParams.get("retailer_id");
      const repId = url.searchParams.get("sales_rep_id");
      const fromDate = url.searchParams.get("from_date");
      const toDate = url.searchParams.get("to_date");
      const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") ?? "20", 10)));

      let query = supabase.from("orders").select(`
        *,
        retailer:retailers(id, name, code, phone, address),
        distributor:distributors(id, name, code),
        sales_rep:profiles!orders_sales_rep_id_fkey(id, full_name, email, phone)
      `, { count: "exact" });

      if (q) query = query.or(`order_number.ilike.%${q}%,notes.ilike.%${q}%`);
      if (status) query = query.eq("status", status);
      if (retailerId) query = query.eq("retailer_id", retailerId);
      if (repId) query = query.eq("sales_rep_id", repId);
      if (fromDate) query = query.gte("created_at", fromDate);
      if (toDate) query = query.lte("created_at", toDate);

      query = query.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      const { data, error, count } = await query;
      if (error) return dbError(error);

      return json(200, {
        status: "success",
        data,
        pagination: { page, page_size: pageSize, total: count ?? 0 }
      });
    }

    // 2. GET ORDER DETAILS (With order items and product info)
    if (req.method === "GET" && orderId && !subAction) {
      if (!uuid.safeParse(orderId).success) return fail(400, "invalid_id", "Invalid order ID");

      const { data, error } = await supabase.from("orders")
        .select(`
          *,
          retailer:retailers(id, name, code, owner_name, phone, address),
          distributor:distributors(id, name, code, contact_name, phone),
          sales_rep:profiles!orders_sales_rep_id_fkey(id, full_name, email, phone),
          items:order_items(
            id, quantity, unit_price, total_price,
            product:products(id, name, sku, category)
          )
        `)
        .eq("id", orderId)
        .maybeSingle();

      if (error) return dbError(error);
      if (!data) return fail(404, "not_found", "Order not found or access denied");
      return json(200, { status: "success", data });
    }

    // 3. CREATE ORDER (Atomic calculation, reservation, stock check)
    if (req.method === "POST" && !orderId) {
      const parsed = createOrderSchema.safeParse(body);
      if (!parsed.success) return fail(422, "validation_error", "Invalid order input", parsed.error.flatten());

      const { data, error } = await supabase.rpc("create_order_atomic", {
        _retailer_id: parsed.data.retailer_id,
        _items: parsed.data.items,
        _notes: parsed.data.notes ?? null,
        _distributor_id: parsed.data.distributor_id ?? null,
      });

      if (error) return dbError(error);
      return json(201, {
        status: "success",
        message: "Order created successfully",
        data
      });
    }

    // 4. UPDATE ORDER STATUS
    if (req.method === "PATCH" && orderId && subAction === "status") {
      if (!uuid.safeParse(orderId).success) return fail(400, "invalid_id", "Invalid order ID");
      const parsed = statusUpdateSchema.safeParse(body);
      if (!parsed.success) return fail(422, "validation_error", "Invalid status update", parsed.error.flatten());

      const { data, error } = await supabase.rpc("update_order_status", {
        _order_id: orderId,
        _new_status: parsed.data.status,
        _note: parsed.data.note ?? null,
      });

      if (error) return dbError(error);
      return json(200, { status: "success", message: "Order status updated", data });
    }

    // 5. CANCEL ORDER (Atomic stock restoration)
    if (req.method === "POST" && orderId && subAction === "cancel") {
      if (!uuid.safeParse(orderId).success) return fail(400, "invalid_id", "Invalid order ID");
      const parsed = cancelOrderSchema.safeParse(body || {});
      if (!parsed.success) return fail(422, "validation_error", "Invalid cancel payload", parsed.error.flatten());

      const { data, error } = await supabase.rpc("cancel_order_atomic", {
        _order_id: orderId,
        _reason: parsed.data.reason,
      });

      if (error) return dbError(error);
      return json(200, { status: "success", message: "Order cancelled and inventory restored", data });
    }

    return fail(405, "method_not_allowed", "Route not supported");
  } catch (err) {
    console.error("Unhandled error:", err);
    return fail(500, "server_error", "Unexpected server error occurred");
  }
});
