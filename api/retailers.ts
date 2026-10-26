import { createClient } from '@supabase/supabase-js';

// FieldAssist Serverless Backend: Retailers API
const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://ibzycpftqmngcrmgpsed.supabase.co';
const supabaseKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlienljcGZ0cW1uZ2NybWdwc2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5ODcxMzksImV4cCI6MjEwODU2MzEzOX0.O_FyD60-X_khKoPajDBA1xn_Gu87cmOffoB5wFhfrl8';
const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseKey && !supabaseUrl.includes('baqelrnhnrsdnubasepq')
);
const serverSupabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
  : null;
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

    if (serverSupabase) {
      try {
        let query = serverSupabase.from('retailers').select('*');
        if (territory && territory !== 'All') query = query.eq('territory', territory);
        if (type && type !== 'All') query = query.eq('type', type);
        if (status && status !== 'All') query = query.eq('status', status);
        if (q) query = query.or(`name.ilike.%${q}%,owner_name.ilike.%${q}%,code.ilike.%${q}%`);
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const mapped = data.map((r: any) => ({
            id: r.id,
            name: r.name,
            ownerName: r.owner_name || r.ownerName || 'Store Owner',
            code: r.code,
            type: r.type || 'Kirana',
            phone: r.phone || '+91 98000 00000',
            address: r.address || '',
            territory: r.territory || 'North Delhi',
            city: r.city || 'New Delhi',
            outstandingBalance: Number(r.outstanding_balance ?? r.outstandingBalance ?? 0),
            creditLimit: Number(r.credit_limit ?? r.creditLimit ?? 50000),
            lastOrderDate: r.last_order_date || r.lastOrderDate || new Date().toISOString().split('T')[0],
            lastVisitDate: r.last_visit_date || r.lastVisitDate || new Date().toISOString().split('T')[0],
            assignedRepName: r.assigned_rep_name || r.assignedRepName || 'Vikram Sharma',
            assignedRepId: r.assigned_rep_id || r.assignedRepId || 'rep-1',
            status: r.status || 'Active',
            rating: Number(r.rating ?? 5),
          }));
          return res.status(200).json({
            success: true,
            count: mapped.length,
            data: mapped,
            source: 'supabase-permanent',
          });
        }
      } catch (err) {
        console.warn('Supabase retailers query fallback notice:', err);
      }
    }

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
      source: 'local-persistent',
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

    if (serverSupabase) {
      try {
        await serverSupabase.from('retailers').insert([
          {
            id: newRetailer.id,
            code: newRetailer.code,
            name: newRetailer.name,
            owner_name: newRetailer.ownerName,
            type: newRetailer.type,
            phone: newRetailer.phone,
            address: newRetailer.address,
            territory: newRetailer.territory,
            city: newRetailer.city,
            outstanding_balance: newRetailer.outstandingBalance,
            credit_limit: newRetailer.creditLimit,
            status: newRetailer.status,
          },
        ]);
      } catch (err) {
        console.warn('Supabase retailer insert fallback notice:', err);
      }
    }

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

    if (serverSupabase) {
      try {
        await serverSupabase
          .from('retailers')
          .update({
            name: body.name || retailersStore[index].name,
            owner_name: body.ownerName || retailersStore[index].ownerName,
            status: body.status || retailersStore[index].status,
            outstanding_balance: body.outstandingBalance !== undefined ? Number(body.outstandingBalance) : retailersStore[index].outstandingBalance,
          })
          .eq('id', retailersStore[index].id);
      } catch (err) {
        console.warn('Supabase retailer update fallback notice:', err);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Retailer updated successfully',
      data: retailersStore[index],
    });
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
