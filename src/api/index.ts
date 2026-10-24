import { authApi } from './authApi';
import { repsApi } from './repsApi';
import { retailersApi } from './retailersApi';
import { ordersApi } from './ordersApi';
import { productsApi } from './productsApi';
import { visitsApi } from './visitsApi';
import { distributorsApi } from './distributorsApi';
import { dashboardApi } from './dashboardApi';
import { gpsApi } from './gpsApi';
import { API_BASE_URL, USE_MOCK_API, apiFetch } from './client';
import * as backendFoundation from '../integrations/supabase';

export * from './client';
export * from './authApi';
export * from './repsApi';
export * from './retailersApi';
export * from './ordersApi';
export * from './productsApi';
export * from './visitsApi';
export * from './distributorsApi';
export * from './dashboardApi';
export * from './gpsApi';
export * from '../integrations/supabase';

export const api = {
  auth: authApi,
  reps: repsApi,
  retailers: retailersApi,
  orders: ordersApi,
  products: productsApi,
  visits: visitsApi,
  distributors: distributorsApi,
  dashboard: dashboardApi,
  gps: gpsApi,
  backend: backendFoundation,
  fetch: apiFetch,
  config: {
    baseUrl: API_BASE_URL,
    isMock: USE_MOCK_API,
  },
};

export default api;

