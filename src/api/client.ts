import type { ApiError } from '../types/auth';

// Base API configuration: Points directly to native Vercel Serverless Functions (/api/*)
// In production or preview on Vercel, this automatically uses the same-origin '/api' endpoint.
export const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '/api';

export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true'; // false by default for live backend connectivity

const TOKEN_KEY = 'fieldassist_auth_token';

export const getAuthToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeAuthToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

// Simulated network delay for fallback / offline behavior
export const simulateNetworkDelay = (ms: number = 200): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Generic API fetch wrapper with Bearer token injection and error handling
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw {
        message: errorData.message || 'API request failed',
        status: response.status,
      } as ApiError;
    }
    return (await response.json()) as T;
  } catch (err: any) {
    if (err && err.status) throw err;
    throw {
      message: err?.message || 'Network error connecting to FieldAssist backend',
      status: 500,
    } as ApiError;
  }
}
