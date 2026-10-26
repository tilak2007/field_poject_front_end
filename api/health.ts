// FieldAssist Serverless Backend: Health Check & System Status
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

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    status: 'online',
    service: 'FieldAssist Backend Engine',
    version: '2.5.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    databaseConnection: isSupabaseConfigured ? 'supabase-permanent' : 'local-persistent-fallback',
    permanentSyncReady: true,
    routes: [
      '/api/health',
      '/api/retailers',
      '/api/products',
      '/api/orders',
      '/api/reps',
      '/api/distributors',
      '/api/visits',
      '/api/dashboard',
      '/api/auth',
      '/api/gps',
    ],
  });
}
