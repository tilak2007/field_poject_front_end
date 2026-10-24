// FieldAssist Serverless Backend: Sales Representatives API
const mockSalesReps = [
  {
    id: 'rep-1',
    name: 'Vikram Sharma',
    code: 'FA-REP-101',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    phone: '+91 98110 11223',
    email: 'vikram.s@fieldassist.io',
    territory: 'North Delhi',
    region: 'North Zone (Delhi-NCR)',
    status: 'In Visit',
    batteryLevel: 78,
    lastCheckIn: '10 mins ago',
    targetAmount: 500000,
    targetAchievedPct: 84.5,
    visitsTodayCount: 9,
    totalDistanceKm: 14.2,
    salesClosedAmount: 422500,
    joinDate: '2024-03-15',
  },
  {
    id: 'rep-2',
    name: 'Ananya Verma',
    code: 'FA-REP-102',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    phone: '+91 98220 22334',
    email: 'ananya.v@fieldassist.io',
    territory: 'South Mumbai',
    region: 'West Zone (Maharashtra)',
    status: 'On Route',
    batteryLevel: 92,
    lastCheckIn: '25 mins ago',
    targetAmount: 650000,
    targetAchievedPct: 91.2,
    visitsTodayCount: 12,
    totalDistanceKm: 22.8,
    salesClosedAmount: 592800,
    joinDate: '2023-11-01',
  },
  {
    id: 'rep-3',
    name: 'Rahul Deshmukh',
    code: 'FA-REP-103',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    phone: '+91 98330 33445',
    email: 'rahul.d@fieldassist.io',
    territory: 'Bengaluru Central',
    region: 'South Zone (Karnataka)',
    status: 'Active',
    batteryLevel: 64,
    lastCheckIn: '1 hour ago',
    targetAmount: 450000,
    targetAchievedPct: 76.0,
    visitsTodayCount: 7,
    totalDistanceKm: 11.5,
    salesClosedAmount: 342000,
    joinDate: '2024-01-20',
  },
];

let repsStore = [...mockSalesReps];

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: List representatives
  if (req.method === 'GET') {
    const { territory, status } = req.query || {};
    let filtered = [...repsStore];

    if (territory && territory !== 'All') {
      filtered = filtered.filter((r) => r.territory === territory);
    }
    if (status && status !== 'All') {
      filtered = filtered.filter((r) => r.status === status);
    }

    return res.status(200).json({
      success: true,
      count: filtered.length,
      data: filtered,
    });
  }

  // POST: Onboard representative
  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.name) {
      return res.status(400).json({ success: false, message: 'Representative name is required' });
    }

    const nextNum = repsStore.length + 101;
    const newRep = {
      id: `rep-${Date.now()}`,
      name: body.name,
      code: `FA-REP-${nextNum}`,
      avatar: body.avatar || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
      phone: body.phone || '+91 98000 00000',
      email: body.email || `${body.name.toLowerCase().replace(/[^a-z]/g, '')}@fieldassist.io`,
      territory: body.territory || 'North Delhi',
      region: 'North Zone (Delhi-NCR)',
      status: 'Active',
      batteryLevel: 100,
      lastCheckIn: 'Just now',
      targetAmount: Number(body.targetAmount) || 500000,
      targetAchievedPct: 0,
      visitsTodayCount: 0,
      totalDistanceKm: 0,
      salesClosedAmount: 0,
      joinDate: new Date().toISOString().split('T')[0],
    };

    repsStore.unshift(newRep);
    return res.status(201).json({
      success: true,
      message: 'Representative onboarded successfully',
      data: newRep,
    });
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
