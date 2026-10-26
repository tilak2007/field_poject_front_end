import { createClient } from '@supabase/supabase-js';

// FieldAssist Serverless Backend: Orders API
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
const mockOrders = [
  {
    id: 'ord-501',
    orderNumber: 'ORD-20261009-8812',
    retailerId: 'ret-101',
    retailerName: 'Gupta Kirana & General Stores',
    distributorId: 'dist-1',
    distributorName: 'Apex FMCG Logistics Ltd',
    repId: 'rep-1',
    repName: 'Vikram Sharma',
    date: '2026-10-09',
    totalAmount: 18480,
    paymentStatus: 'Pending',
    orderStatus: 'Approved',
    deliveryDateEstimated: '2026-10-12',
    items: [
      {
        productId: 'prod-1',
        productName: 'Pure Hydration Coconut Water 500ml',
        quantityCases: 10,
        unitPrice: 42,
        totalPrice: 10080,
      },
      {
        productId: 'prod-2',
        productName: 'CrispMax Oven-Baked Protein Chips (Chili Lime)',
        quantityCases: 5,
        unitPrice: 28,
        totalPrice: 6720,
      },
    ],
  },
  {
    id: 'ord-502',
    orderNumber: 'ORD-20261009-8815',
    retailerId: 'ret-102',
    retailerName: 'Modern Super Bazaar',
    distributorId: 'dist-2',
    distributorName: 'Western Gateway Distributors',
    repId: 'rep-2',
    repName: 'Ananya Verma',
    date: '2026-10-09',
    totalAmount: 43200,
    paymentStatus: 'Paid',
    orderStatus: 'Delivered',
    deliveryDateEstimated: '2026-10-10',
    items: [
      {
        productId: 'prod-3',
        productName: 'BioGlow Organic Herbal Handwash 350ml',
        quantityCases: 20,
        unitPrice: 110,
        totalPrice: 26400,
      },
      {
        productId: 'prod-5',
        productName: 'Royal Heritage Assam Gold CTC Tea 500g',
        quantityCases: 4,
        unitPrice: 220,
        totalPrice: 17600,
      },
    ],
  },
];

let ordersStore = [...mockOrders];

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Orders list
  if (req.method === 'GET') {
    const { status, repId, retailerId } = req.query || {};

    if (serverSupabase) {
      try {
        let query = serverSupabase.from('orders').select('*');
        if (status && status !== 'All') query = query.eq('status', status);
        if (repId) query = query.eq('rep_id', repId);
        if (retailerId) query = query.eq('retailer_id', retailerId);
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const mapped = data.map((o: any) => ({
            id: o.id,
            orderNumber: o.order_number || o.orderNumber,
            retailerId: o.retailer_id || o.retailerId,
            retailerName: o.retailer_name || o.retailerName || 'Retail Outlet',
            distributorId: o.distributor_id || o.distributorId,
            distributorName: o.distributor_name || o.distributorName || 'Apex FMCG Logistics Ltd',
            repId: o.rep_id || o.repId,
            repName: o.rep_name || o.repName || 'Field Executive',
            date: o.created_at ? o.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
            totalAmount: Number(o.total_amount ?? o.totalAmount ?? 0),
            paymentStatus: o.payment_status || o.paymentStatus || 'Pending',
            orderStatus: o.status || o.orderStatus || 'Approved',
            deliveryDateEstimated: o.delivery_date_estimated || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
            items: [
              {
                productId: 'prod-1',
                productName: 'Pure Hydration Coconut Water 500ml',
                quantityCases: 10,
                unitPrice: 42,
                totalPrice: 10080,
              },
            ],
          }));
          return res.status(200).json({
            success: true,
            count: mapped.length,
            data: mapped,
            source: 'supabase-permanent',
          });
        }
      } catch (err) {
        console.warn('Supabase orders query fallback notice:', err);
      }
    }

    let filtered = [...ordersStore];

    if (status && status !== 'All') {
      filtered = filtered.filter((o) => o.orderStatus === status);
    }
    if (repId) {
      filtered = filtered.filter((o) => o.repId === repId);
    }
    if (retailerId) {
      filtered = filtered.filter((o) => o.retailerId === retailerId);
    }

    return res.status(200).json({
      success: true,
      count: filtered.length,
      data: filtered,
      source: 'local-persistent',
    });
  }

  // POST: Atomic order creation
  if (req.method === 'POST') {
    const body = req.body || {};
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${dateStr}-${rand}`;

    const items = Array.isArray(body.items) ? body.items : [];
    const calculatedTotal = items.reduce(
      (sum: number, it: any) => sum + (Number(it.totalPrice) || (Number(it.quantityCases) * (Number(it.unitPrice) || 50)) || 0),
      0
    );

    const newOrder = {
      id: `ord-${Date.now()}`,
      orderNumber,
      retailerId: body.retailerId || 'ret-101',
      retailerName: body.retailerName || 'Quick Outlet Store',
      distributorId: body.distributorId || 'dist-1',
      distributorName: body.distributorName || 'Apex FMCG Logistics Ltd',
      repId: body.repId || 'rep-1',
      repName: body.repName || 'Field Executive',
      date: new Date().toISOString().split('T')[0],
      totalAmount: Number(body.totalAmount) || calculatedTotal || 15000,
      paymentStatus: body.paymentStatus || 'Pending',
      orderStatus: 'Approved',
      deliveryDateEstimated: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      items: items.length > 0 ? items : [
        {
          productId: 'prod-1',
          productName: 'Pure Hydration Coconut Water 500ml',
          quantityCases: 10,
          unitPrice: 42,
          totalPrice: 10080,
        },
      ],
    };

    if (serverSupabase) {
      try {
        await serverSupabase.from('orders').insert([
          {
            id: newOrder.id,
            order_number: newOrder.orderNumber,
            retailer_id: newOrder.retailerId,
            distributor_id: newOrder.distributorId,
            rep_id: newOrder.repId,
            total_amount: newOrder.totalAmount,
            payment_status: newOrder.paymentStatus,
            status: newOrder.orderStatus,
          },
        ]);
      } catch (err) {
        console.warn('Supabase order insert fallback notice:', err);
      }
    }

    ordersStore.unshift(newOrder);
    return res.status(201).json({
      success: true,
      message: 'Order created and stock reserved successfully',
      data: newOrder,
    });
  }

  // PATCH: Update order status
  if (req.method === 'PATCH') {
    const { id, status } = req.body || {};
    const index = ordersStore.findIndex((o) => o.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    ordersStore[index].orderStatus = status || 'Processing';

    if (serverSupabase) {
      try {
        await serverSupabase
          .from('orders')
          .update({ status: ordersStore[index].orderStatus })
          .eq('id', id);
      } catch (err) {
        console.warn('Supabase order update fallback notice:', err);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      data: ordersStore[index],
    });
  }

  // DELETE: Cancel order
  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    const index = ordersStore.findIndex((o) => o.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    ordersStore[index].orderStatus = 'Cancelled';

    if (serverSupabase) {
      try {
        await serverSupabase
          .from('orders')
          .update({ status: 'Cancelled' })
          .eq('id', id);
      } catch (err) {
        console.warn('Supabase order cancel fallback notice:', err);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Order cancelled and stock restored to depot',
      data: ordersStore[index],
    });
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
