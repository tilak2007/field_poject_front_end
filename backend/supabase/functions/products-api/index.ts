// Products & Inventory API. Runs with the caller's JWT so database RLS enforces permissions.
// Routes:
//   GET    /products-api                 list (q, category, min_price, max_price, in_stock, include_inactive, page, page_size, sort)
//   GET    /products-api/:id             details (+ recent stock movements for staff)
//   POST   /products-api                 create (admin/manager)
//   PATCH  /products-api/:id             update (admin/manager)
//   POST   /products-api/:id/stock       adjust stock {change, reason, note} (admin/manager)
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
const sku = z.string().trim().regex(/^[A-Za-z0-9._-]{1,64}$/, "SKU: 1-64 letters, digits, . _ -");
const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sku,
  category: z.string().trim().max(100).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  selling_price: z.number().nonnegative().max(9999999999).multipleOf(0.01),
  stock_quantity: z.number().int().nonnegative().default(0),
  is_active: z.boolean().optional(),
}).strict();
const updateSchema = createSchema.omit({ stock_quantity: true }).partial().strict()
  .refine((v) => Object.keys(v).length > 0, "No fields to update");
const stockSchema = z.object({
  change: z.number().int().refine((n) => n !== 0, "change must be non-zero"),
  reason: z.enum(["restock", "adjustment", "correction", "damage", "return"]),
  note: z.string().trim().max(500).optional(),
}).strict();
const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  min_price: z.coerce.number().nonnegative().optional(),
  max_price: z.coerce.number().nonnegative().optional(),
  in_stock: z.enum(["true", "false"]).optional(),
  include_inactive: z.enum(["true", "false"]).optional(),
  sort: z.enum(["name", "-name", "price", "-price", "stock", "-stock", "created_at", "-created_at"]).default("name"),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});
const sortCol: Record<string, string> = { name: "name", price: "selling_price", stock: "stock_quantity", created_at: "created_at" };

function dbError(e: { code?: string; message: string }) {
  if (e.code === "23505") return fail(409, "duplicate_sku", "A product with this SKU already exists");
  if (e.code === "42501" || e.code === "PGRST301") return fail(403, "forbidden", "You are not allowed to perform this action");
  if (e.code === "P0002" || e.code === "PGRST116") return fail(404, "not_found", "Product not found");
  if (e.code === "23514") return fail(422, "invalid", "Value violates a constraint (e.g. stock cannot go below zero)");
  console.error(e);
  return fail(500, "server_error", "Unexpected server error");
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

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const i = parts.indexOf("products-api");
  const [id, sub] = parts.slice(i + 1);
  if (id && !uuid.safeParse(id).success) return fail(400, "invalid_id", "Invalid product id");

  let body: unknown = undefined;
  if (req.method === "POST" || req.method === "PATCH") {
    try { body = await req.json(); } catch { return fail(400, "invalid_json", "Body must be valid JSON"); }
  }
  const needStaff = () => (staff ? null : fail(403, "forbidden", "Only admins and managers can manage products"));

  try {
    // LIST
    if (req.method === "GET" && !id) {
      const p = listSchema.safeParse(Object.fromEntries(url.searchParams));
      if (!p.success) return fail(422, "validation_error", "Invalid query", p.error.flatten());
      const f = p.data;
      let q = supabase.from("products").select("*", { count: "exact" });
      if (f.q) {
        const s = f.q.replace(/[%,()]/g, " ");
        q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%,category.ilike.%${s}%`);
      }
      if (f.category) q = q.eq("category", f.category);
      if (f.min_price !== undefined) q = q.gte("selling_price", f.min_price);
      if (f.max_price !== undefined) q = q.lte("selling_price", f.max_price);
      if (f.in_stock === "true") q = q.gt("stock_quantity", 0);
      if (f.in_stock === "false") q = q.eq("stock_quantity", 0);
      if (!(staff && f.include_inactive === "true")) q = q.eq("is_active", true);
      const desc = f.sort.startsWith("-");
      q = q.order(sortCol[f.sort.replace("-", "")], { ascending: !desc }).order("id");
      const from = (f.page - 1) * f.page_size;
      const { data, error, count } = await q.range(from, from + f.page_size - 1);
      if (error) return dbError(error);
      return json(200, {
        status: data.length ? "success" : "empty",
        data,
        pagination: { page: f.page, page_size: f.page_size, total: count ?? 0 },
      });
    }

    // DETAILS
    if (req.method === "GET" && id && !sub) {
      const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
      if (error) return dbError(error);
      if (!data) return fail(404, "not_found", "Product not found");
      let movements = undefined;
      if (staff) {
        const r = await supabase.from("inventory_movements").select("*").eq("product_id", id)
          .order("created_at", { ascending: false }).limit(20);
        movements = r.data ?? [];
      }
      return json(200, { status: "success", data: { ...data, recent_movements: movements } });
    }

    // CREATE
    if (req.method === "POST" && !id) {
      const deny = needStaff(); if (deny) return deny;
      const p = createSchema.safeParse(body);
      if (!p.success) return fail(422, "validation_error", "Invalid product", p.error.flatten());
      const { stock_quantity, ...rest } = p.data;
      const { data, error } = await supabase.from("products")
        .insert({ ...rest, stock_quantity: 0, created_by: userId, updated_by: userId }).select().single();
      if (error) return dbError(error);
      let product = data;
      if (stock_quantity > 0) {
        const r = await supabase.rpc("adjust_product_stock", {
          _product_id: data.id, _change: stock_quantity, _reason: "initial", _note: "Opening stock",
        });
        if (r.error) return dbError(r.error);
        product = r.data;
      }
      return json(201, { status: "success", message: "Product created", data: product });
    }

    // UPDATE
    if (req.method === "PATCH" && id && !sub) {
      const deny = needStaff(); if (deny) return deny;
      const p = updateSchema.safeParse(body);
      if (!p.success) return fail(422, "validation_error", "Invalid update", p.error.flatten());
      const { data, error } = await supabase.from("products")
        .update({ ...p.data, updated_by: userId }).eq("id", id).select().maybeSingle();
      if (error) return dbError(error);
      if (!data) return fail(404, "not_found", "Product not found");
      return json(200, { status: "success", message: "Product updated", data });
    }

    // STOCK ADJUST
    if (req.method === "POST" && id && sub === "stock") {
      const deny = needStaff(); if (deny) return deny;
      const p = stockSchema.safeParse(body);
      if (!p.success) return fail(422, "validation_error", "Invalid stock adjustment", p.error.flatten());
      const { data, error } = await supabase.rpc("adjust_product_stock", {
        _product_id: id, _change: p.data.change, _reason: p.data.reason, _note: p.data.note ?? null,
      });
      if (error) return dbError(error);
      return json(200, { status: "success", message: "Stock updated", data });
    }

    return fail(405, "method_not_allowed", "Route not supported");
  } catch (e) {
    console.error(e);
    return fail(500, "server_error", "Unexpected server error");
  }
});
