import { apiFetch, simulateNetworkDelay } from './client';

export interface DashboardStats {
  today_orders_count: number;
  today_orders_total: number;
  today_visits_count: number;
  today_attendance_count: number;
  total_retailers_count: number;
  total_products_count: number;
  low_stock_products_count: number;
}

export interface DashboardResponse {
  summary: {
    totalRevenueThisMonth: number;
    revenueGrowthPct: number;
    activeRepsCount: number;
    totalVisitsCompletedToday: number;
    visitsTargetToday: number;
    totalOrdersBookedToday: number;
    avgOrderValue: number;
    overallTargetAchievementPct: number;
    lastSynchronized: string;
    today_orders_count?: number;
    today_orders_total?: number;
    today_visits_count?: number;
    today_attendance_count?: number;
    total_retailers_count?: number;
    total_products_count?: number;
    low_stock_products_count?: number;
  };
  revenueTrends: Array<{ month: string; actual: number; target: number; visits: number }>;
}

export const dashboardApi = {
  /**
   * GET /api/dashboard
   */
  async getDashboardSummary(): Promise<DashboardStats> {
    try {
      const res = await apiFetch<{ success: boolean; data: DashboardResponse }>('/dashboard');
      if (res && res.data && res.data.summary) {
        const s = res.data.summary;
        return {
          today_orders_count: s.today_orders_count ?? s.totalOrdersBookedToday ?? 94,
          today_orders_total: s.today_orders_total ?? (s.totalOrdersBookedToday ? s.totalOrdersBookedToday * s.avgOrderValue : 2303000),
          today_visits_count: s.today_visits_count ?? s.totalVisitsCompletedToday ?? 184,
          today_attendance_count: s.today_attendance_count ?? s.activeRepsCount ?? 6,
          total_retailers_count: s.total_retailers_count ?? 48,
          total_products_count: s.total_products_count ?? 25,
          low_stock_products_count: s.low_stock_products_count ?? 2,
        };
      }
    } catch (err) {
      console.warn('Backend /api/dashboard fallback:', err);
    }

    await simulateNetworkDelay(100);
    return {
      today_orders_count: 6,
      today_orders_total: 8000.0,
      today_visits_count: 4,
      today_attendance_count: 3,
      total_retailers_count: 12,
      total_products_count: 25,
      low_stock_products_count: 2,
    };
  },
};
