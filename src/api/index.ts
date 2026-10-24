import { authApi } from './authApi';
import { repsApi } from './repsApi';
import { retailersApi } from './retailersApi';
import { ordersApi } from './ordersApi';
import { productsApi } from './productsApi';
import { visitsApi } from './visitsApi';
import { API_BASE_URL, USE_MOCK_API } from './client';
import * as backendFoundation from '../integrations/supabase';

export * from '../integrations/supabase';

export const api = {
  auth: authApi,
  reps: repsApi,
  retailers: retailersApi,
  orders: ordersApi,
  products: productsApi,
  visits: visitsApi,
  backend: backendFoundation,
  config: {
    baseUrl: API_BASE_URL,
    isMock: USE_MOCK_API,
  },
};

export default api;
