import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
export type OrderStatus = Database["public"]["Enums"]["order_status"];

export interface OrderItemInput {
  product_id: string;
  quantity: number;
}

export interface CreateOrderInput {
  retailer_id: string;
  distributor_id?: string | null;
  items: OrderItemInput[];
  notes?: string | null;
}

export interface OrderFilters {
  q?: string;
  status?: OrderStatus;
  retailer_id?: string;
  sales_rep_id?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  pageSize?: number;
}

export async function listOrders(
  supabase: SupabaseClient<Database>,
  filters: OrderFilters = {}
) {
  const { page = 1, pageSize = 20, q, status, retailer_id, sales_rep_id, from_date, to_date } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("orders").select(`
    *,
    retailer:retailers(id, name, code, phone, address),
    distributor:distributors(id, name, code),
    sales_rep:profiles!orders_sales_rep_id_fkey(id, full_name, email, phone)
  `, { count: "exact" });

  if (q) query = query.or(`order_number.ilike.%${q}%,notes.ilike.%${q}%`);
  if (status) query = query.eq("status", status);
  if (retailer_id) query = query.eq("retailer_id", retailer_id);
  if (sales_rep_id) query = query.eq("sales_rep_id", sales_rep_id);
  if (from_date) query = query.gte("created_at", from_date);
  if (to_date) query = query.lte("created_at", to_date);

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) throw error;
  return { data, count: count ?? 0, page, pageSize };
}

export async function getOrderById(
  supabase: SupabaseClient<Database>,
  orderId: string
) {
  const { data, error } = await supabase
    .from("orders")
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
    .single();

  if (error) throw error;
  return data;
}

export async function createOrder(
  supabase: SupabaseClient<Database>,
  input: CreateOrderInput
) {
  const { data, error } = await supabase.rpc("create_order_atomic", {
    _retailer_id: input.retailer_id,
    _items: input.items as any,
    _notes: input.notes ?? null,
    _distributor_id: input.distributor_id ?? null,
  });

  if (error) throw error;
  return data;
}

export async function updateOrderStatus(
  supabase: SupabaseClient<Database>,
  orderId: string,
  newStatus: OrderStatus,
  note?: string
) {
  const { data, error } = await supabase.rpc("update_order_status", {
    _order_id: orderId,
    _new_status: newStatus,
    _note: note ?? null,
  });

  if (error) throw error;
  return data;
}

export async function cancelOrder(
  supabase: SupabaseClient<Database>,
  orderId: string,
  reason: string = "Customer requested cancellation"
) {
  const { data, error } = await supabase.rpc("cancel_order_atomic", {
    _order_id: orderId,
    _reason: reason,
  });

  if (error) throw error;
  return data;
}
