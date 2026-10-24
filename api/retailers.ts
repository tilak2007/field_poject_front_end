// FieldAssist Serverless Backend: Retailers API
const mockRetailers = [
  {
    id: 'ret-101',
    name: 'Gupta Kirana & General Stores',
    ownerName: 'Ramesh Gupta',
    code: 'RET-001',
    type: 'Kirana',
    phone: '+91 98112 23344',
    address: 'Shop 14, Main Market, Sector 18',
    territory: 'North Delhi',
    city: 'New Delhi',
    outstandingBalance: 14500,
    creditLimit: 50000,
    lastOrderDate: '2026-10-09',
    lastVisitDate: '2026-10-09',
    assignedRepName: 'Vikram Sharma',
    assignedRepId: 'rep-1',
    status: 'Active',
    rating: 5,
  },
  {
    id: 'ret-102',
    name: 'Modern Super Bazaar',
    ownerName: 'Kavita Singh',
    code: 'RET-002',
    type: 'Supermarket',
    phone: '+91 98223 34455',
    address: 'Plot 45, Commercial Complex, Bandra West',
    territory: 'South Mumbai',
    city: 'Mumbai',
    outstandingBalance: 32000,
    creditLimit: 100000,
    lastOrderDate: '2026-10-08',
    lastVisitDate: '2026-10-09',
    assignedRepName: 'Ananya Verma',
    assignedRepId: 'rep-2',
    status: 'Active',
    rating: 5,
  },
  {
    id: 'ret-103',
    name: 'Sri Krishna Provisions & Co',
    ownerName: 'Venkatesh Rao',
    code: 'RET-003',
    type: 'Kirana',
    phone: '+91 98442 11223',
    address: '100 Feet Road, Indiranagar',
    territory: 'Bengaluru Central',
    city: 'Bengaluru',
    outstandingBalance: 8200,
    creditLimit: 30000,
    lastOrderDate: '2026-10-05',
    lastVisitDate: '2026-10-07',
    assignedRepName: 'Rahul Deshmukh',
    assignedRepId: 'rep-3',
    status: 'Active',
    rating: 4,
  },
  {
    id: 'ret-104',
    name: 'National Wholesale Traders',
    ownerName: 'Harish Chandra',
    code: 'RET-004',
    type: 'Wholesale',
    phone: '+91 98553 44556',
    address: 'Grain Market, Wholesale Yard',
    territory: 'North Delhi',
    city: 'New Delhi',
    outstandingBalance: 125000,
    creditLimit: 150000,
    lastOrderDate: '2026-09-28',
    lastVisitDate: '2026-10-02',
    assignedRepName: 'Vikram Sharma',
    assignedRepId: 'rep-1',
    status: 'Blocked',
    rating: 3,
  },
];

let retailersStore = [...mockRetailers];

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: List retailers with filtering
  if (req.method === 'GET') {
    const { q, territory, type, status } = req.query || {};
    let filtered = [...retailersStore];

    if (q) {
      const query = String(q).toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.ownerName.toLowerCase().includes(query) ||
          r.code.toLowerCase().includes(query)
      );
    }
    if (territory && territory !== 'All') {
      filtered = filtered.filter((r) => r.territory === territory);
    }
    if (type && type !== 'All') {
      filtered = filtered.filter((r) => r.type === type);
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

  // POST: Add new retailer
  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.name) {
      return res.status(400).json({ success: false, message: 'Retailer name is required' });
    }

    const nextId = `ret-${Date.now()}`;
    const nextCode = `RET-${String(retailersStore.length + 1).padStart(3, '0')}`;
    const newRetailer = {
      id: nextId,
      code: body.code || nextCode,
      name: body.name,
      ownerName: body.ownerName || 'Store Owner',
      type: body.type || 'Kirana',
      phone: body.phone || '+91 98000 00000',
      address: body.address || 'Field Territory Storefront',
      territory: body.territory || 'North Delhi',
      city: body.city || 'New Delhi',
      outstandingBalance: Number(body.outstandingBalance) || 0,
      creditLimit: Number(body.creditLimit) || 50000,
      lastOrderDate: new Date().toISOString().split('T')[0],
      lastVisitDate: new Date().toISOString().split('T')[0],
      assignedRepName: body.assignedRepName || 'Vikram Sharma',
      assignedRepId: body.assignedRepId || 'rep-1',
      status: body.status || 'Active',
      rating: body.rating || 5,
    };

    retailersStore.unshift(newRetailer);
    return res.status(201).json({
      success: true,
      message: 'Retailer registered successfully',
      data: newRetailer,
    });
  }

  // PUT: Update retailer
  if (req.method === 'PUT') {
    const { id } = req.query || {};
    const body = req.body || {};
    const index = retailersStore.findIndex((r) => r.id === id || r.id === body.id);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Retailer not found' });
    }

    retailersStore[index] = { ...retailersStore[index], ...body };
    return res.status(200).json({
      success: true,
      message: 'Retailer updated successfully',
      data: retailersStore[index],
    });
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
