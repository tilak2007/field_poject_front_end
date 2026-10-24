import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export interface BeatPlanRetailerItem {
  item_id: string;
  sequence_order: number;
  status: "pending" | "in_progress" | "completed" | "skipped";
  retailer_id: string;
  retailer_name: string;
  retailer_code: string | null;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  has_coordinates: boolean;
}

export interface DailyBeatPlanResponse {
  found: boolean;
  beat_plan_id?: string;
  plan_date: string;
  title?: string;
  notes?: string | null;
  items: BeatPlanRetailerItem[];
}

export interface SaveBeatPlanParams {
  planDate?: string; // YYYY-MM-DD (defaults to today)
  title?: string;
  retailerIds: string[]; // Ordered list of retailer IDs (sequence 1, 2, 3...)
  notes?: string;
}

/**
 * Save or update a daily beat plan with ordered retailer visit sequence
 */
export async function saveBeatPlan(
  supabase: SupabaseClient<Database>,
  params: SaveBeatPlanParams
) {
  const { planDate, title = "Daily Visit Plan", retailerIds, notes } = params;

  const { data, error } = await supabase.rpc("save_beat_plan", {
    _plan_date: planDate ?? new Date().toISOString().split("T")[0],
    _title: title,
    _retailer_ids: retailerIds,
    _notes: notes ?? null,
  });

  if (error) throw error;
  return data;
}

/**
 * Retrieve daily beat plan with ordered retailers, coordinates, and visit status
 */
export async function getDailyBeatPlan(
  supabase: SupabaseClient<Database>,
  planDate?: string,
  targetUserId?: string
): Promise<DailyBeatPlanResponse> {
  const targetDate = planDate ?? new Date().toISOString().split("T")[0];

  const { data, error } = await supabase.rpc("get_daily_beat_plan", {
    _target_date: targetDate,
    _target_user_id: targetUserId ?? null,
  });

  if (error) throw error;
  return data as unknown as DailyBeatPlanResponse;
}

/**
 * Save/update a retailer's GPS coordinates (e.g. from rep's current position)
 */
export async function updateRetailerCoordinates(
  supabase: SupabaseClient<Database>,
  retailerId: string,
  latitude: number,
  longitude: number
) {
  const { data, error } = await supabase.rpc("update_retailer_location", {
    _retailer_id: retailerId,
    _latitude: latitude,
    _longitude: longitude,
  });

  if (error) throw error;
  return data;
}

/**
 * Update the status of an item in the beat plan (e.g. mark completed after visit)
 */
export async function updateBeatItemStatus(
  supabase: SupabaseClient<Database>,
  itemId: string,
  status: "pending" | "in_progress" | "completed" | "skipped"
) {
  const { data, error } = await supabase
    .from("beat_plan_items")
    .update({ status })
    .eq("id", itemId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Helper to generate a Google Maps navigation direction URL
 */
export function getGoogleMapsDirectionsUrl(
  origin: { latitude: number; longitude: number } | null,
  destination: { latitude: number; longitude: number }
): string {
  if (origin && origin.latitude && origin.longitude) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
}
