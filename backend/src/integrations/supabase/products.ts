import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type ProductRow = Database["public"]["Tables"]["products"]["Row"];
export type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
export type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];
export type InventoryMovementRow = Database["public"]["Tables"]["inventory_movements"]["Row"];

export interface ProductFilters {
  q?: string;
  category?: string;
  isActive?: boolean;
  minPrice?: number;
  maxPrice?: number;
  lowStockOnly?: boolean;
  lowStockThreshold?: number;
  page?: number;
  pageSize?: number;
}

export async function listProducts(
  supabase: SupabaseClient<Database>,
  filters: ProductFilters = {}
) {
  const {
    page = 1,
    pageSize = 20,
    q,
    category,
    isActive = true,
    minPrice,
    maxPrice,
    lowStockOnly,
    lowStockThreshold = 10,
  } = filters;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("products").select("*", { count: "exact" });

  if (typeof isActive === "boolean") {
    query = query.eq("is_active", isActive);
  }
  if (category) {
    query = query.eq("category", category);
  }
  if (q) {
    query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
  }
  if (typeof minPrice === "number") {
    query = query.gte("selling_price", minPrice);
  }
  if (typeof maxPrice === "number") {
    query = query.lte("selling_price", maxPrice);
  }
  if (lowStockOnly) {
    query = query.lte("stock_quantity", lowStockThreshold);
  }

  const { data, error, count } = await query
    .order("name", { ascending: true })
    .range(from, to);

  if (error) throw error;
  return { data, count: count ?? 0, page, pageSize };
}

export async function getProductById(
  supabase: SupabaseClient<Database>,
  id: string
) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createProduct(
  supabase: SupabaseClient<Database>,
  product: ProductInsert
) {
  const { data, error } = await supabase
    .from("products")
    .insert(product)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProduct(
  supabase: SupabaseClient<Database>,
  id: string,
  updates: ProductUpdate
) {
  const { data, error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function adjustProductStock(
  supabase: SupabaseClient<Database>,
  params: {
    productId: string;
    change: number;
    reason: "initial" | "restock" | "adjustment" | "correction" | "damage" | "return";
    note?: string;
  }
) {
  const { data, error } = await supabase.rpc("adjust_product_stock", {
    _product_id: params.productId,
    _change: params.change,
    _reason: params.reason,
    _note: params.note ?? null,
  });

  if (error) throw error;
  return data;
}

export async function listInventoryMovements(
  supabase: SupabaseClient<Database>,
  productId: string
) {
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}
