// FieldAssist Serverless Backend: Orders API
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
    return res.status(200).json({
      success: true,
      message: 'Order cancelled and stock restored to depot',
      data: ordersStore[index],
    });
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
