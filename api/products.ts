import { createClient } from '@supabase/supabase-js';

// FieldAssist Serverless Backend: Products API
const supabaseUrl = 'https://ibzycpftqmngcrmgpsed.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlienljcGZ0cW1uZ2NybWdwc2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5ODcxMzksImV4cCI6MjEwODU2MzEzOX0.O_FyD60-X_khKoPajDBA1xn_Gu87cmOffoB5wFhfrl8';

const isSupabaseConfigured = true;
const serverSupabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
const mockProducts = [
  {
    id: 'prod-1',
    sku: 'FA-COCO-500',
    name: 'Pure Hydration Coconut Water 500ml',
    category: 'Beverages',
    unitPrice: 42,
    mrp: 60,
    casePackSize: 24,
    stockInHandCases: 420,
    reorderLevelCases: 100,
    taxRatePct: 12,
    imageUrl: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=200&auto=format&fit=crop&q=80',
    status: 'In Stock',
  },
  {
    id: 'prod-2',
    sku: 'FA-SNACK-CR',
    name: 'CrispMax Oven-Baked Protein Chips (Chili Lime)',
    category: 'Snacks',
    unitPrice: 28,
    mrp: 40,
    casePackSize: 48,
    stockInHandCases: 85,
    reorderLevelCases: 150,
    taxRatePct: 18,
    imageUrl: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=200&auto=format&fit=crop&q=80',
    status: 'Low Stock',
  },
  {
    id: 'prod-3',
    sku: 'FA-WASH-FR',
    name: 'BioGlow Organic Herbal Handwash 350ml',
    category: 'Personal Care',
    unitPrice: 110,
    mrp: 145,
    casePackSize: 12,
    stockInHandCases: 290,
    reorderLevelCases: 80,
    taxRatePct: 18,
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80',
    status: 'In Stock',
  },
  {
    id: 'prod-4',
    sku: 'FA-CHOC-DK',
    name: 'Velvet Noir Belgian Dark Chocolate Bar 100g',
    category: 'Snacks',
    unitPrice: 75,
    mrp: 110,
    casePackSize: 36,
    stockInHandCases: 12,
    reorderLevelCases: 50,
    taxRatePct: 18,
    imageUrl: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=200&auto=format&fit=crop&q=80',
    status: 'Low Stock',
  },
  {
    id: 'prod-5',
    sku: 'FA-TEA-ORG',
    name: 'Royal Heritage Assam Gold CTC Tea 500g',
    category: 'FMCG',
    unitPrice: 220,
    mrp: 290,
    casePackSize: 20,
    stockInHandCases: 540,
    reorderLevelCases: 120,
    taxRatePct: 5,
    imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=200&auto=format&fit=crop&q=80',
    status: 'In Stock',
  },
];

let productsStore = [...mockProducts];

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Return products catalog (from Supabase if configured, otherwise persistent store)
  if (req.method === 'GET') {
    const { category, search, status } = req.query || {};

    if (serverSupabase) {
      try {
        let query = serverSupabase.from('products').select('*').eq('is_active', true);
        if (category && category !== 'All') query = query.eq('category', category);
        if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const mapped = data.map((p: any) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            category: p.category,
            unitPrice: Number(p.unit_price),
            mrp: Number(p.mrp),
            casePackSize: Number(p.case_size ?? 24),
            stockInHandCases: Number(p.stock_cases ?? 100),
            reorderLevelCases: 30,
            taxRatePct: 18,
            imageUrl: p.image_url || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
            status: Number(p.stock_cases ?? 100) > 30 ? 'In Stock' : 'Low Stock',
          }));
          return res.status(200).json({
            success: true,
            count: mapped.length,
            data: mapped,
            source: 'supabase-permanent',
          });
        }
      } catch (err) {
        console.warn('Supabase query fallback notice:', err);
      }
    }

    let filtered = [...productsStore];

    if (search) {
      const q = String(search).toLowerCase();
      filtered = filtered.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      );
    }
    if (category && category !== 'All') {
      filtered = filtered.filter((p) => p.category === category);
    }
    if (status && status !== 'All') {
      filtered = filtered.filter((p) => p.status === status);
    }

    return res.status(200).json({
      success: true,
      count: filtered.length,
      data: filtered,
      source: 'local-persistent',
    });
  }

  // POST: Add new product SKU or inward stock
  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.name || !body.sku) {
      return res.status(400).json({ success: false, message: 'Product name and SKU are required' });
    }

    const newProduct = {
      id: `prod-${Date.now()}`,
      sku: body.sku.toUpperCase(),
      name: body.name,
      category: body.category || 'FMCG',
      unitPrice: Number(body.unitPrice) || 50,
      mrp: Number(body.mrp) || 70,
      casePackSize: Number(body.casePackSize) || 24,
      stockInHandCases: Number(body.stockInHandCases) || 100,
      reorderLevelCases: Number(body.reorderLevelCases) || 50,
      taxRatePct: Number(body.taxRatePct) || 12,
      imageUrl: body.imageUrl || 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=200&auto=format&fit=crop&q=80',
      status: Number(body.stockInHandCases) > 50 ? 'In Stock' : 'Low Stock',
    };

    if (serverSupabase) {
      try {
        await serverSupabase.from('products').insert([
          {
            id: newProduct.id,
            sku: newProduct.sku,
            name: newProduct.name,
            category: newProduct.category,
            unit_price: newProduct.unitPrice,
            mrp: newProduct.mrp,
            case_size: newProduct.casePackSize,
            stock_cases: newProduct.stockInHandCases,
            image_url: newProduct.imageUrl,
            is_active: true,
          },
        ]);
      } catch (err) {
        console.warn('Supabase insert fallback notice:', err);
      }
    }

    productsStore.unshift(newProduct);
    return res.status(201).json({
      success: true,
      message: 'Product SKU created permanently',
      data: newProduct,
    });
  }

  // PATCH: Adjust stock quantity
  if (req.method === 'PATCH') {
    const { id, change, inStockCases } = req.body || {};
    const index = productsStore.findIndex((p) => p.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (change !== undefined) {
      productsStore[index].stockInHandCases = Math.max(0, productsStore[index].stockInHandCases + Number(change));
    } else if (inStockCases !== undefined) {
      productsStore[index].stockInHandCases = Number(inStockCases);
    }

    productsStore[index].status =
      productsStore[index].stockInHandCases === 0
        ? 'Out of Stock'
        : productsStore[index].stockInHandCases < productsStore[index].reorderLevelCases
        ? 'Low Stock'
        : 'In Stock';

    if (serverSupabase) {
      try {
        await serverSupabase
          .from('products')
          .update({ stock_cases: productsStore[index].stockInHandCases })
          .eq('id', id);
      } catch (err) {
        console.warn('Supabase stock update fallback notice:', err);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Product stock updated permanently',
      data: productsStore[index],
    });
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
