import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  CheckCircle2,
  X,
  Server,
  Key,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  HardDrive,
  Globe,
} from 'lucide-react';
import {
  getSupabaseConfig,
  savePermanentSupabaseConnection,
  clearPermanentSupabaseConnection,
  testLiveSupabaseConnection,
} from '../../lib/supabaseClient';

interface CloudConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudConnectionModal: React.FC<CloudConnectionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const currentConfig = getSupabaseConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(
    currentConfig.isCustom ? currentConfig.url : ''
  );
  const [supabaseKey, setSupabaseKey] = useState(
    currentConfig.isCustom ? currentConfig.key : ''
  );

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    const urlToTest = supabaseUrl.trim() || currentConfig.url;
    const keyToTest = supabaseKey.trim() || currentConfig.key;

    const result = await testLiveSupabaseConnection(urlToTest, keyToTest);
    setIsTesting(false);
    setTestResult(result);
  };

  const handleSaveConnection = () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setTestResult({
        success: false,
        message: 'Please provide both your Supabase URL and Anon/Public Key.',
      });
      return;
    }

    const saved = savePermanentSupabaseConnection(supabaseUrl, supabaseKey);
    if (saved) {
      setSaveSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    }
  };

  const handleResetToDefaults = () => {
    clearPermanentSupabaseConnection();
    setSupabaseUrl('');
    setSupabaseKey('');
    setSaveSuccess(true);
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden p-6 sm:p-7 space-y-6 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-inner">
                <Database className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-white tracking-tight">
                    Permanent Cloud & Database Connection
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Permanent data storage with Supabase PostgreSQL and offline browser cache.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Connection Architecture Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <HardDrive className="w-4 h-4" />
                <span>Local Storage</span>
              </div>
              <p className="text-[11px] text-slate-300 font-semibold">100% Permanent</p>
              <p className="text-[10px] text-slate-500">
                Zero data loss. Cached locally across reloads.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-sky-400 font-bold">
                <Globe className="w-4 h-4" />
                <span>Map CDN</span>
              </div>
              <p className="text-[11px] text-slate-300 font-semibold">OpenStreetMap</p>
              <p className="text-[10px] text-slate-500">
                Free public tile servers. No expiration.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Server className="w-4 h-4" />
                <span>Cloud Sync</span>
              </div>
              <p className="text-[11px] text-slate-300 font-semibold">
                {currentConfig.isCustom ? 'Custom Supabase' : 'Offline-First Ready'}
              </p>
              <p className="text-[10px] text-slate-500">
                Syncs with PostgreSQL cloud database.
              </p>
            </div>
          </div>

          {/* Form Fields: Configure Permanent Supabase Project */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Supabase Project URL</span>
                <span className="text-[10px] font-normal text-slate-500">
                  e.g. https://yourproject.supabase.co
                </span>
              </label>
              <div className="relative">
                <Server className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full pl-10 pr-3 py-2 bg-slate-950 text-xs text-white placeholder-slate-600 rounded-xl border border-slate-800 focus:outline-none focus:border-brand-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Supabase Anon / Public API Key</span>
                <span className="text-[10px] font-normal text-slate-500">
                  Starts with eyJhbGci...
                </span>
              </label>
              <div className="relative">
                <Key className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full pl-10 pr-3 py-2 bg-slate-950 text-xs text-white placeholder-slate-600 rounded-xl border border-slate-800 focus:outline-none focus:border-brand-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Test Status Banner */}
          {testResult && (
            <div
              className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>Connection saved permanently! Reloading app to apply...</span>
            </div>
          )}

          {/* SQL Setup Notice */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center justify-between text-xs text-slate-400">
            <div>
              <p className="font-semibold text-slate-300">Database Schema Setup</p>
              <p className="text-[11px] text-slate-500">
                Run <code>supabase_master_setup.sql</code> in your Supabase SQL Editor.
              </p>
            </div>
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-all"
            >
              <span>Supabase Dashboard</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              onClick={handleResetToDefaults}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline cursor-pointer"
            >
              Reset to Local Mode
            </button>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
              </button>

              <button
                onClick={handleSaveConnection}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Save Permanently</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
