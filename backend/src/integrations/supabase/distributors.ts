import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type DistributorRow = Database["public"]["Tables"]["distributors"]["Row"];
export type DistributorInsert = Database["public"]["Tables"]["distributors"]["Insert"];
export type DistributorUpdate = Database["public"]["Tables"]["distributors"]["Update"];

export interface DistributorFilters {
  q?: string;
  territory_id?: string;
  is_active?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listDistributors(
  supabase: SupabaseClient<Database>,
  filters: DistributorFilters = {}
) {
  const { page = 1, pageSize = 20, q, territory_id, is_active } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("distributors").select("*, territory:territories(id, name, code)", { count: "exact" });

  if (q) {
    query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%,contact_name.ilike.%${q}%`);
  }
  if (territory_id) query = query.eq("territory_id", territory_id);
  if (typeof is_active === "boolean") query = query.eq("is_active", is_active);

  const { data, error, count } = await query.order("name").range(from, to);
  if (error) throw error;
  return { data, count: count ?? 0, page, pageSize };
}

export async function getDistributorById(
  supabase: SupabaseClient<Database>,
  id: string
) {
  const { data, error } = await supabase
    .from("distributors")
    .select("*, territory:territories(id, name, code, level)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function createDistributor(
  supabase: SupabaseClient<Database>,
  distributor: DistributorInsert
) {
  const { data, error } = await supabase
    .from("distributors")
    .insert(distributor)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateDistributor(
  supabase: SupabaseClient<Database>,
  id: string,
  updates: DistributorUpdate
) {
  const { data, error } = await supabase
    .from("distributors")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deactivateDistributor(
  supabase: SupabaseClient<Database>,
  id: string
) {
  return updateDistributor(supabase, id, { is_active: false });
}

export async function activateDistributor(
  supabase: SupabaseClient<Database>,
  id: string
) {
  return updateDistributor(supabase, id, { is_active: true });
}
