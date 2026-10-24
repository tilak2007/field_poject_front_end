// FieldAssist Serverless Backend: Dashboard Analytics API
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const liveStats = {
    totalRevenueThisMonth: 12480000,
    revenueGrowthPct: 18.4,
    activeRepsCount: 6,
    totalVisitsCompletedToday: 184,
    visitsTargetToday: 210,
    totalOrdersBookedToday: 94,
    avgOrderValue: 24500,
    overallTargetAchievementPct: 88.6,
    today_orders_count: 94,
    today_orders_total: 12480000,
    today_visits_count: 184,
    today_attendance_count: 6,
    total_retailers_count: 48,
    total_products_count: 25,
    low_stock_products_count: 2,
    lastSynchronized: new Date().toISOString(),
  };

  const revenueTrends = [
    { month: 'May 2026', actual: 9800000, target: 9500000, visits: 3800 },
    { month: 'Jun 2026', actual: 10400000, target: 10000000, visits: 4100 },
    { month: 'Jul 2026', actual: 11200000, target: 11000000, visits: 4400 },
    { month: 'Aug 2026', actual: 10900000, target: 11500000, visits: 4250 },
    { month: 'Sep 2026', actual: 11900000, target: 12000000, visits: 4600 },
    { month: 'Oct 2026', actual: 12480000, target: 12500000, visits: 4850 },
  ];

  return res.status(200).json({
    success: true,
    data: {
      summary: liveStats,
      revenueTrends,
    },
  });
}
