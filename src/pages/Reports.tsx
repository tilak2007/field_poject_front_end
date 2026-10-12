import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSpreadsheet,
  Download,
  FileText,
  Plus,
  CheckCircle2,
  X,
  Calendar,
  Clock,
  Mail,
  Filter,
  Layers
} from 'lucide-react';
import { mockReports } from '../data/mockData';
import type { ReportItem } from '../types';

export const Reports: React.FC = () => {
  const [reportsList, setReportsList] = useState<ReportItem[]>(() => {
    const saved = localStorage.getItem('fieldassist_reports');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // Fallback
      }
    }
    return mockReports;
  });

  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states
  const [reportCategory, setReportCategory] = useState<ReportItem['category']>('Sales');
  const [reportTitle, setReportTitle] = useState('Secondary Sales & Daily Beat Orders');
  const [exportFormat, setExportFormat] = useState<ReportItem['format']>('CSV');
  const [dateRange, setDateRange] = useState('Last 7 Days');
  const [scheduleFrequency, setScheduleFrequency] = useState('Immediate Download');
  const [recipientEmail, setRecipientEmail] = useState('vinaymeghu09@gmail.com');

  const presetTitles: Record<string, string[]> = {
    Sales: [
      'Secondary Sales & Daily Beat Orders',
      'Retailer Brand Wise Revenue Realization',
      'Distributor Secondary Billing Report',
    ],
    'Field Force': [
      'Daily Field Attendance & Route Audit Summary',
      'Sales Rep Distance Travelled & Beat Productivity',
      'Rep Geofence Compliance & Check-in Timestamps',
    ],
    Inventory: [
      'Distributor Warehouse Inventory & Expiry Risk Analysis',
      'Warehouse Stock In Hand & Reorder Warning Summary',
      'Damaged / Expiry Returns Log',
    ],
    Distributors: [
      'Distributor Credit Balance & Ageing Analysis',
      'Distributor Tertiary Outward Despatch Records',
    ],
    Outlets: [
      'Outlet Coverage & Beat Plan Productivity Report',
      'New Retail Outlet Onboarding & Lead Conversion',
      'Zero-Order Store Audit Analysis',
    ],
  };

  const handleCategoryChange = (cat: ReportItem['category']) => {
    setReportCategory(cat);
    const options = presetTitles[cat] || [];
    if (options.length > 0) {
      setReportTitle(options[0]);
    }
  };

  const downloadFileBlob = (title: string, format: string) => {
    const csvContent =
      `"Report Title","${title}"\n` +
      `"Generated On","${new Date().toLocaleString()}"\n` +
      `"Export Type","${format}"\n` +
      `"Status","Compliance Verified"\n\n` +
      `"ID","Date","Territory","Rep Name","Retailer Name","Amount (INR)","Status"\n` +
      `"TXN-101","2026-10-10","North Delhi","Vikram Sharma","Sharma Kirana Store","18500","Approved"\n` +
      `"TXN-102","2026-10-10","North Delhi","Vikram Sharma","Gupta General Mart","32400","Approved"\n` +
      `"TXN-103","2026-10-11","South Mumbai","Ananya Verma","Blinkit Dark Store Hub","45800","Delivered"\n` +
      `"TXN-104","2026-10-11","Bengaluru Central","Rahul Deshmukh","Apollo Pharmacy","12600","Processing"\n` +
      `"TXN-105","2026-10-12","North Delhi","Priya Patel","Aggarwal Daily Needs","24100","Delivered"\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const sanitizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.download = `${sanitizedTitle}_${Date.now()}.${format.toLowerCase() === 'pdf' ? 'pdf' : format.toLowerCase() === 'xlsx' ? 'xlsx' : 'csv'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleGenerateExport = (e: React.FormEvent) => {
    e.preventDefault();

    const finalTitle = reportTitle.trim() || `${reportCategory} Field Compliance Report`;
    const newReport: ReportItem = {
      id: `rep-doc-${Date.now()}`,
      title: finalTitle,
      category: reportCategory,
      generatedDate: 'Today (Just Now)',
      format: exportFormat,
      fileSize: exportFormat === 'PDF' ? '3.2 MB' : exportFormat === 'CSV' ? '1.4 MB' : '4.6 MB',
      downloadUrl: '#',
    };

    const updated = [newReport, ...reportsList];
    setReportsList(updated);
    localStorage.setItem('fieldassist_reports', JSON.stringify(updated));
    setShowExportModal(false);

    // Trigger instant browser download
    downloadFileBlob(finalTitle, exportFormat);

    setToastMessage(`Scheduled export "${finalTitle}" (${exportFormat}) generated & downloaded!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-between text-xs font-semibold shadow-xl"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-emerald-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <FileSpreadsheet className="w-7 h-7 text-brand-400" />
            <span>Reports & Compliance Downloads</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Automated PDF, CSV, and Excel exports for sales, beat audits, and warehouse audits.
          </p>
        </div>

        <button
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all self-start sm:self-auto cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Generate Scheduled Export</span>
        </button>
      </div>

      {/* Reports List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportsList.map((repDoc) => (
          <div
            key={repDoc.id}
            className="glass-card glass-card-hover p-6 rounded-2xl space-y-4 border border-slate-800 flex flex-col justify-between"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-brand-500/10 text-brand-400 shrink-0 border border-brand-500/20">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-brand-300 tracking-wider">
                  {repDoc.category}
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">{repDoc.title}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Generated on {repDoc.generatedDate} • Format: {repDoc.format} ({repDoc.fileSize})
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Ready for Download
              </span>

              <button
                onClick={() => downloadFileBlob(repDoc.title, repDoc.format)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-brand-600 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download ({repDoc.format})</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Generate Scheduled Export */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center border border-brand-500/20">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Generate Scheduled Export</h2>
                    <p className="text-xs text-slate-400">Configure automated data export & delivery schedule</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleGenerateExport} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-brand-400" />
                    <span>Report Category *</span>
                  </label>
                  <select
                    value={reportCategory}
                    onChange={(e) => handleCategoryChange(e.target.value as any)}
                    className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="Sales">Secondary Sales & Billing</option>
                    <option value="Field Force">Field Force & Route Attendance</option>
                    <option value="Inventory">Inventory & Warehouse Stock</option>
                    <option value="Distributors">Distributor Outstanding & Balance</option>
                    <option value="Outlets">Retailer Outlets & Beat Coverage</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Report Dataset / Title *</label>
                  <select
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    {(presetTitles[reportCategory] || []).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-brand-400" />
                      <span>Export Format *</span>
                    </label>
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value as any)}
                      className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    >
                      <option value="CSV">CSV Spreadsheet (.csv)</option>
                      <option value="XLSX">Excel Workbook (.xlsx)</option>
                      <option value="PDF">Formatted Document (.pdf)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-brand-400" />
                      <span>Date Range</span>
                    </label>
                    <select
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value)}
                      className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    >
                      <option value="Last 7 Days">Last 7 Days</option>
                      <option value="Current Month">Current Month (M-T-D)</option>
                      <option value="Last 30 Days">Last 30 Days</option>
                      <option value="Quarter to Date">Quarter to Date (Q3)</option>
                      <option value="Full Year 2026">Full Year 2026</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-brand-400" />
                      <span>Schedule Frequency</span>
                    </label>
                    <select
                      value={scheduleFrequency}
                      onChange={(e) => setScheduleFrequency(e.target.value)}
                      className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    >
                      <option value="Immediate Download">Immediate Download</option>
                      <option value="Daily 08:00 AM">Daily at 08:00 AM</option>
                      <option value="Weekly Monday">Weekly on Monday</option>
                      <option value="Monthly 1st">Monthly on 1st</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-brand-400" />
                      <span>Notify Email</span>
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="manager@fieldassist.io"
                      className="w-full h-10 px-3.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowExportModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Generate & Download Export</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Reports;
