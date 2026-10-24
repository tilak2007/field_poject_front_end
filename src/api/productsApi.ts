import type { Product, InventoryItem } from '../types';
import { mockProducts } from '../data/mockData';
import { supabase } from '../lib/supabase';
import { apiFetch, simulateNetworkDelay } from './client';

const LOCAL_STORAGE_KEY = 'fieldassist_products';

function getLocalProducts(): Product[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [...mockProducts];
}

function saveLocalProducts(list: Product[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

export const productsApi = {
  /**
   * GET /api/products
   * List all products in catalog
   */
  async getProducts(params?: { category?: string; search?: string }): Promise<Product[]> {
    // 1. Try native Serverless Backend (/api/products)
    try {
      const queryParams = new URLSearchParams();
      if (params?.category && params.category !== 'All') queryParams.set('category', params.category);
      if (params?.search) queryParams.set('q', params.search);
      const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const res = await apiFetch<{ success: boolean; data: Product[] }>(`/products${qs}`);
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        saveLocalProducts(res.data);
        return res.data;
      }
    } catch (e) {
      console.warn('Backend /api/products fallback to cache:', e);
    }

    // 2. Try Supabase if configured
    try {
      let query = supabase.from('products').select('*').eq('is_active', true).order('name');
      if (params?.category && params.category !== 'All') {
        query = query.eq('category', params.category);
      }
      if (params?.search) {
        query = query.or(`name.ilike.%${params.search}%,sku.ilike.%${params.search}%`);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const mapped: Product[] = data.map((p: any) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category as any,
          unitPrice: Number(p.unit_price),
          mrp: Number(p.mrp),
          casePackSize: Number(p.case_size ?? 24),
          stockInHandCases: Number(p.stock_cases ?? 100),
          reorderLevelCases: 30,
          taxRatePct: 18,
          imageUrl: p.image_url || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
          status: Number(p.stock_cases ?? 100) > 30 ? 'In Stock' : 'Low Stock',
        }));
        saveLocalProducts(mapped);
        return mapped;
      }
    } catch (e) {
      // Supabase unavailable
    }

    // 3. Fallback to LocalStorage Persistent Cache / Mock Data
    await simulateNetworkDelay(100);
    let items = getLocalProducts();

    if (params?.category && params.category !== 'All') {
      items = items.filter((p) => p.category === params.category);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      );
    }
    return items;
  },

  /**
   * GET /api/inventory
   * Fetch current warehouse inventory stock items
   */
  async getInventory(): Promise<InventoryItem[]> {
    const products = await this.getProducts();
    return products.map((p, idx) => ({
      id: `inv-${idx + 1}`,
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      distributorName: 'Apex FMCG Logistics Ltd',
      distributorId: 'dist-1',
      casesAvailable: p.stockInHandCases,
      casesReserved: Math.floor(p.stockInHandCases * 0.15),
      batchNumber: `BATCH-2026-${100 + idx}`,
      expiryDate: '2027-06-30',
      status: p.stockInHandCases < p.reorderLevelCases ? 'Low Stock' : 'Optimal',
    }));
  },
};
