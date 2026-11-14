// FieldAssist Serverless Backend: Distributors API
const mockDistributors = [
  {
    id: 'dist-1',
    name: 'Apex Karnataka FMCG Logistics Ltd',
    code: 'DST-901',
    contactPerson: 'Manish Gowda',
    phone: '+91 91122 33445',
    email: 'supply@apexfmcg.com',
    region: 'South Zone (Bengaluru)',
    territoryCoverage: ['Bengaluru South', 'Bengaluru Central', 'Jayanagar Belt'],
    stockValue: 4850000,
    currentWarehouseCapacityPct: 78,
    creditLimit: 7500000,
    outstandingBalance: 1250000,
    status: 'Active',
  },
  {
    id: 'dist-2',
    name: 'Bengaluru Metro Distributors',
    code: 'DST-902',
    contactPerson: 'Kunal Hegde',
    phone: '+91 92233 44556',
    email: 'kunal@bengalurumetro.com',
    region: 'South Zone (Bengaluru)',
    territoryCoverage: ['Bengaluru West', 'Banashankari Hub', 'Rajajinagar Belt'],
    stockValue: 6200000,
    currentWarehouseCapacityPct: 85,
    creditLimit: 10000000,
    outstandingBalance: 3100000,
    status: 'Active',
  },
  {
    id: 'dist-3',
    name: 'Southern Express Distributors',
    code: 'DST-903',
    contactPerson: 'K. V. Subbarao',
    phone: '+91 93344 55667',
    email: 'kv@southernexpress.com',
    region: 'South Zone (Bengaluru)',
    territoryCoverage: ['Bengaluru East', 'Indiranagar Hub', 'Koramangala Loop'],
    stockValue: 5100000,
    currentWarehouseCapacityPct: 62,
    creditLimit: 8000000,
    outstandingBalance: 1800000,
    status: 'Active',
  },
];

let distributorsStore = [...mockDistributors];

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      count: distributorsStore.length,
      data: distributorsStore,
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.name) {
      return res.status(400).json({ success: false, message: 'Distributor name is required' });
    }

    const nextCode = `DST-${900 + distributorsStore.length + 1}`;
    const newDist = {
      id: `dist-${Date.now()}`,
      name: body.name,
      code: body.code || nextCode,
      contactPerson: body.contactPerson || 'Operations Head',
      phone: body.phone || '+91 98000 00000',
      email: body.email || `${body.name.toLowerCase().replace(/[^a-z]/g, '')}@distributors.fieldassist.io`,
      region: body.region || 'South Zone (Bengaluru)',
      territoryCoverage: Array.isArray(body.territoryCoverage) ? body.territoryCoverage : ['Bengaluru South'],
      stockValue: Number(body.stockValue) || 4500000,
      currentWarehouseCapacityPct: Number(body.currentWarehouseCapacityPct) || 75,
      creditLimit: Number(body.creditLimit) || 7500000,
      outstandingBalance: Number(body.outstandingBalance) || 0,
      status: 'Active',
    };

    distributorsStore.unshift(newDist);
    return res.status(201).json({
      success: true,
      message: 'Distributor partner added successfully',
      data: newDist,
    });
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
