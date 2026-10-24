import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type AttendanceRow = Database["public"]["Tables"]["attendance"]["Row"];
export type VisitRow = Database["public"]["Tables"]["visits"]["Row"];
export type VisitOutcome = "order_placed" | "follow_up_required" | "no_order" | "retailer_unavailable" | "other";

export interface GeoLocation {
  latitude?: number | null;
  longitude?: number | null;
}

export interface AttendanceFilters {
  user_id?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  pageSize?: number;
}

export interface VisitFilters {
  retailer_id?: string;
  sales_rep_id?: string;
  outcome?: VisitOutcome;
  status?: "in_progress" | "completed" | "cancelled";
  from_date?: string;
  to_date?: string;
  page?: number;
  pageSize?: number;
}

// Attendance Services
export async function checkIn(
  supabase: SupabaseClient<Database>,
  location?: GeoLocation,
  notes?: string | null
) {
  const { data, error } = await supabase.rpc("check_in_rep", {
    _latitude: location?.latitude ?? null,
    _longitude: location?.longitude ?? null,
    _notes: notes ?? null,
  });
  if (error) throw error;
  return data;
}

export async function checkOut(
  supabase: SupabaseClient<Database>,
  location?: GeoLocation,
  notes?: string | null
) {
  const { data, error } = await supabase.rpc("check_out_rep", {
    _latitude: location?.latitude ?? null,
    _longitude: location?.longitude ?? null,
    _notes: notes ?? null,
  });
  if (error) throw error;
  return data;
}

export async function getTodayAttendance(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", userId)
    .eq("work_date", today)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listAttendanceHistory(
  supabase: SupabaseClient<Database>,
  filters: AttendanceFilters = {}
) {
  const { page = 1, pageSize = 20, user_id, from_date, to_date } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("attendance").select("*, user:profiles(id, full_name, email)", { count: "exact" });
  if (user_id) query = query.eq("user_id", user_id);
  if (from_date) query = query.gte("work_date", from_date);
  if (to_date) query = query.lte("work_date", to_date);

  const { data, error, count } = await query.order("work_date", { ascending: false }).range(from, to);
  if (error) throw error;
  return { data, count: count ?? 0, page, pageSize };
}

// Retailer Visit Services
export async function startVisit(
  supabase: SupabaseClient<Database>,
  retailerId: string,
  location?: GeoLocation,
  notes?: string | null
) {
  const { data, error } = await supabase.rpc("start_visit", {
    _retailer_id: retailerId,
    _latitude: location?.latitude ?? null,
    _longitude: location?.longitude ?? null,
    _notes: notes ?? null,
  });
  if (error) throw error;
  return data;
}

export async function completeVisit(
  supabase: SupabaseClient<Database>,
  visitId: string,
  outcome: VisitOutcome,
  orderId?: string | null,
  location?: GeoLocation,
  notes?: string | null
) {
  const { data, error } = await supabase.rpc("complete_visit", {
    _visit_id: visitId,
    _outcome: outcome,
    _order_id: orderId ?? null,
    _latitude: location?.latitude ?? null,
    _longitude: location?.longitude ?? null,
    _notes: notes ?? null,
  });
  if (error) throw error;
  return data;
}

export async function getActiveVisit(
  supabase: SupabaseClient<Database>,
  salesRepId: string
) {
  const { data, error } = await supabase
    .from("visits")
    .select("*, retailer:retailers(id, name, code, phone, address)")
    .eq("sales_rep_id", salesRepId)
    .eq("status", "in_progress")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listVisits(
  supabase: SupabaseClient<Database>,
  filters: VisitFilters = {}
) {
  const { page = 1, pageSize = 20, retailer_id, sales_rep_id, outcome, status, from_date, to_date } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("visits").select(`
    *,
    retailer:retailers(id, name, code, phone, address),
    sales_rep:profiles(id, full_name, email),
    order:orders(id, order_number, total_amount, status)
  `, { count: "exact" });

  if (retailer_id) query = query.eq("retailer_id", retailer_id);
  if (sales_rep_id) query = query.eq("sales_rep_id", sales_rep_id);
  if (outcome) query = query.eq("outcome", outcome);
  if (status) query = query.eq("status", status);
  if (from_date) query = query.gte("visit_date", from_date);
  if (to_date) query = query.lte("visit_date", to_date);

  const { data, error, count } = await query.order("start_time", { ascending: false }).range(from, to);
  if (error) throw error;
  return { data, count: count ?? 0, page, pageSize };
}

export async function getVisitById(
  supabase: SupabaseClient<Database>,
  visitId: string
) {
  const { data, error } = await supabase
    .from("visits")
    .select(`
      *,
      retailer:retailers(id, name, code, phone, address, owner_name),
      sales_rep:profiles(id, full_name, email, phone),
      order:orders(id, order_number, total_amount, status, created_at)
    `)
    .eq("id", visitId)
    .single();

  if (error) throw error;
  return data;
}
