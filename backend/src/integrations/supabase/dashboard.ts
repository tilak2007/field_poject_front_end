import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export interface DashboardSummary {
  today_orders_count: number;
  today_orders_total: number;
  today_visits_count: number;
  today_attendance_count: number;
  total_retailers_count: number;
  total_products_count: number;
  low_stock_products_count: number;
}

export async function getDashboardSummary(
  supabase: SupabaseClient<Database>
): Promise<DashboardSummary> {
  const { data, error } = await supabase.rpc("get_dashboard_summary");
  if (error) throw error;
  return data as unknown as DashboardSummary;
}
