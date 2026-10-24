import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type RetailerRow = Database["public"]["Tables"]["retailers"]["Row"];
export type RetailerInsert = Database["public"]["Tables"]["retailers"]["Insert"];
export type RetailerUpdate = Database["public"]["Tables"]["retailers"]["Update"];

export interface RetailerFilters {
  q?: string;
  category?: string;
  distributor_id?: string;
  assigned_rep_id?: string;
  territory_id?: string;
  is_active?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listRetailers(
  supabase: SupabaseClient<Database>,
  filters: RetailerFilters = {}
) {
  const { page = 1, pageSize = 20, q, category, distributor_id, assigned_rep_id, territory_id, is_active } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("retailers").select(`
    *,
    distributor:distributors(id, name, code),
    assigned_rep:profiles!retailers_assigned_rep_id_fkey(id, full_name, email, phone)
  `, { count: "exact" });

  if (q) {
    query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%,owner_name.ilike.%${q}%,phone.ilike.%${q}%`);
  }
  if (category) query = query.eq("category", category);
  if (distributor_id) query = query.eq("distributor_id", distributor_id);
  if (assigned_rep_id) query = query.eq("assigned_rep_id", assigned_rep_id);
  if (territory_id) query = query.eq("territory_id", territory_id);
  if (typeof is_active === "boolean") query = query.eq("is_active", is_active);

  const { data, error, count } = await query.order("name").range(from, to);
  if (error) throw error;
  return { data, count: count ?? 0, page, pageSize };
}

export async function getRetailerById(
  supabase: SupabaseClient<Database>,
  id: string
) {
  const { data, error } = await supabase
    .from("retailers")
    .select(`
      *,
      distributor:distributors(id, name, code, contact_name, phone, email, address),
      assigned_rep:profiles!retailers_assigned_rep_id_fkey(id, full_name, email, phone),
      territory:territories(id, name, code, level)
    `)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createRetailer(
  supabase: SupabaseClient<Database>,
  retailer: RetailerInsert
) {
  const { data, error } = await supabase
    .from("retailers")
    .insert(retailer)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateRetailer(
  supabase: SupabaseClient<Database>,
  id: string,
  updates: RetailerUpdate
) {
  const { data, error } = await supabase
    .from("retailers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deactivateRetailer(
  supabase: SupabaseClient<Database>,
  id: string
) {
  return updateRetailer(supabase, id, { is_active: false });
}

export async function activateRetailer(
  supabase: SupabaseClient<Database>,
  id: string
) {
  return updateRetailer(supabase, id, { is_active: true });
}
