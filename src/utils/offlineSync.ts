/**
 * FieldAssist Offline Sync Engine
 * Handles automatic background synchronization when returning online,
 * LocalStorage queue processing, and connectivity status monitoring.
 */

import { supabase } from '../lib/supabaseClient';
import { apiFetch } from '../api/client';
import type { Order } from '../types';

const ORDERS_KEY = 'fieldassist_orders';

export interface SyncResult {
  syncedCount: number;
  failedCount: number;
  totalPending: number;
}

/**
 * Get count of pending offline orders in LocalStorage
 */
export function getPendingOrdersCount(): number {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return 0;
    const orders: any[] = JSON.parse(raw);
    if (!Array.isArray(orders)) return 0;
    return orders.filter(
      (o) => o.syncStatus === 'pending' || o.synced === false || (typeof o.id === 'string' && o.id.startsWith('ord-') && !o.synced)
    ).length;
  } catch {
    return 0;
  }
}

/**
 * Flush and synchronize pending offline orders to Supabase / Backend
 */
export async function syncPendingOrders(): Promise<SyncResult> {
  const result: SyncResult = { syncedCount: 0, failedCount: 0, totalPending: 0 };

  if (typeof window === 'undefined' || !navigator.onLine) {
    return result;
  }

  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return result;
    const orders: any[] = JSON.parse(raw);
    if (!Array.isArray(orders) || orders.length === 0) return result;

    const pendingOrders = orders.filter(
      (o) => o.syncStatus === 'pending' || o.synced === false || (typeof o.id === 'string' && o.id.startsWith('ord-') && !o.synced)
    );

    result.totalPending = pendingOrders.length;
    if (result.totalPending === 0) return result;

    let updatedOrders = [...orders];

    for (const pending of pendingOrders) {
      let syncSuccess = false;

      // 1. Try serverless backend (/api/orders)
      try {
        const res = await apiFetch<{ success: boolean; data: Order }>('/orders', {
          method: 'POST',
          body: JSON.stringify(pending),
        });
        if (res && res.data) {
          syncSuccess = true;
        }
      } catch (backendErr) {
        // Fallback to Supabase direct
      }

      // 2. Try Supabase direct insert if backend not reached
      if (!syncSuccess) {
        try {
          const payload = {
            order_number: pending.orderNumber || `ORD-BLR-${Date.now().toString().slice(-4)}`,
            retailer_id: pending.retailerId,
            distributor_id: pending.distributorId || 'dist-1',
            rep_id: pending.repId || 'rep-1',
            total_amount: pending.totalAmount,
            payment_status: pending.paymentStatus || 'Pending',
            order_status: 'Approved',
            date: pending.date || new Date().toISOString().split('T')[0],
          };

          const { error } = await supabase.from('orders').insert([payload]);
          if (!error) {
            syncSuccess = true;
          }
        } catch (supabaseErr) {
          // Both failed (network drop or server error)
        }
      }

      if (syncSuccess) {
        result.syncedCount++;
        updatedOrders = updatedOrders.map((o) =>
          o.id === pending.id
            ? { ...o, syncStatus: 'synced', synced: true, orderStatus: 'Approved' }
            : o
        );
      } else {
        result.failedCount++;
      }
    }

    localStorage.setItem(ORDERS_KEY, JSON.stringify(updatedOrders));
  } catch (err) {
    console.error('Offline sync execution error:', err);
  }

  return result;
}

/**
 * Initialize automatic background listener for online events
 */
export function initOfflineSyncListeners(onSyncComplete?: (result: SyncResult) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = async () => {
    console.log('[FieldAssist Sync Engine] Network restored. Starting automatic cloud sync...');
    const result = await syncPendingOrders();
    if (result.syncedCount > 0) {
      console.log(`[FieldAssist Sync Engine] Successfully synced ${result.syncedCount} offline orders to cloud database!`);
      onSyncComplete?.(result);
    }
  };

  window.addEventListener('online', handleOnline);

  // Periodic background check every 45s if online
  const intervalId = setInterval(() => {
    if (navigator.onLine && getPendingOrdersCount() > 0) {
      handleOnline();
    }
  }, 45000);

  return () => {
    window.removeEventListener('online', handleOnline);
    clearInterval(intervalId);
  };
}
