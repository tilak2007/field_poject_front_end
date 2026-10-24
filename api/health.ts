export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const hasDatabase = Boolean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);

  return res.status(200).json({
    status: 'online',
    service: 'FieldAssist Backend Engine',
    version: '2.5.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    databaseConnection: hasDatabase ? 'configured' : 'serverless-in-memory',
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
    ],
  });
}
