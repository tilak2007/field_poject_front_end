// FieldAssist Serverless Backend: Visits & Field Force API
const mockVisits = [
  {
    id: 'vis-301',
    visitCode: 'VST-20261009-01',
    retailerId: 'ret-101',
    retailerName: 'Gupta Kirana & General Stores',
    retailerAddress: 'Shop 14, Main Market, Sector 18',
    repId: 'rep-1',
    repName: 'Vikram Sharma',
    beatName: 'Connaught Place - Market Route A',
    plannedTime: '09:30 AM',
    actualCheckIn: '09:34 AM',
    actualCheckOut: '09:58 AM',
    visitType: 'Regular Order',
    status: 'Completed',
    geofenceVerified: true,
    orderBookedAmount: 18480,
    notes: 'Restocked beverage shelf, ordered 10 cases of coconut water',
    feedback: 'Retailer requested promotional banner for festive season',
  },
  {
    id: 'vis-302',
    visitCode: 'VST-20261009-02',
    retailerId: 'ret-104',
    retailerName: 'National Wholesale Traders',
    retailerAddress: 'Grain Market, Wholesale Yard',
    repId: 'rep-1',
    repName: 'Vikram Sharma',
    beatName: 'Connaught Place - Market Route A',
    plannedTime: '10:15 AM',
    actualCheckIn: '10:20 AM',
    actualCheckOut: '10:45 AM',
    visitType: 'Collection',
    status: 'Completed',
    geofenceVerified: true,
    orderBookedAmount: 0,
    notes: 'Collected partial payment of ₹25,000 via cheque',
    feedback: 'Owner promised to clear outstanding balance by next Friday',
  },
];

let visitsStore = [...mockVisits];

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Visits list
  if (req.method === 'GET') {
    const { repId, status } = req.query || {};
    let filtered = [...visitsStore];

    if (repId) {
      filtered = filtered.filter((v) => v.repId === repId);
    }
    if (status && status !== 'All') {
      filtered = filtered.filter((v) => v.status === status);
    }

    return res.status(200).json({
      success: true,
      count: filtered.length,
      data: filtered,
    });
  }

  // POST: Record visit or check-in
  if (req.method === 'POST') {
    const body = req.body || {};
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);

    const newVisit = {
      id: `vis-${Date.now()}`,
      visitCode: `VST-${dateStr}-${rand}`,
      retailerId: body.retailerId || 'ret-101',
      retailerName: body.retailerName || 'Verified Store Outlet',
      retailerAddress: body.retailerAddress || 'Market Center',
      repId: body.repId || 'rep-1',
      repName: body.repName || 'Field Sales Rep',
      beatName: body.beatName || 'Daily Beat Route 1',
      plannedTime: body.plannedTime || '10:00 AM',
      actualCheckIn: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actualCheckOut: undefined,
      visitType: body.visitType || 'Regular Order',
      status: body.status || 'In Progress',
      geofenceVerified: Boolean(body.geofenceVerified !== false),
      orderBookedAmount: Number(body.orderBookedAmount) || 0,
      notes: body.notes || 'Field visit logged',
      feedback: body.feedback || '',
    };

    visitsStore.unshift(newVisit);
    return res.status(201).json({
      success: true,
      message: 'Field visit recorded with geofence verification',
      data: newVisit,
    });
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
