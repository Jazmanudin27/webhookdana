import React, { useState } from 'react';
import { Terminal, Copy, Check, Filter, Trash2, Globe, Cpu, ArrowDownLeft } from 'lucide-react';

export default function WebhookInspector({ logs = [] }) {
  const [copiedId, setCopiedId] = useState(null);
  const [filterSource, setFilterSource] = useState('ALL');

  const filteredLogs = logs.filter(log => {
    if (filterSource === 'ALL') return true;
    return log.source === filterSource;
  });

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(typeof text === 'object' ? JSON.stringify(text, null, 2) : text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getSourceBadge = (source) => {
    switch (source) {
      case 'DANA_WEBHOOK':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-[#0284c7] bg-sky-100 px-2 py-0.5 rounded border border-sky-300">
            <Globe className="w-3 h-3" /> DANA Webhook
          </span>
        );
      case 'ESP32':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded border border-teal-300">
            <Cpu className="w-3 h-3" /> ESP32 Device
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
            {source}
          </span>
        );
    }
  };

  return (
    <div className="bg-white/95 border-2 border-sky-300 shadow-xl shadow-sky-900/10 rounded-3xl p-6 sm:p-7 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-sky-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-sky-100 text-[#0284c7] rounded-2xl border border-sky-200 shadow-sm">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-[#034078] text-lg flex items-center gap-2">
              Webhook & Telemetry Stream
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            </h3>
            <p className="text-xs text-sky-800/80 font-medium">Live JSON Payload Inspector</p>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 bg-sky-50 p-1 rounded-xl border border-sky-200">
          {['ALL', 'DANA_WEBHOOK', 'ESP32'].map(src => (
            <button
              key={src}
              onClick={() => setFilterSource(src)}
              className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterSource === src
                  ? 'bg-[#0284c7] text-white shadow-sm'
                  : 'text-sky-800 hover:text-sky-950 hover:bg-sky-100'
              }`}
            >
              {src === 'ALL' ? 'Semua' : src === 'DANA_WEBHOOK' ? 'DANA Webhook' : 'ESP32'}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Terminal Area */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[420px]">
        {filteredLogs.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center text-sky-800/60 font-sans">
            <Terminal className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm font-bold">Belum ada aktivitas webhook atau request ESP32.</p>
            <p className="text-xs mt-1">Lakukan transaksi atau polling ESP32 untuk melihat log langsung.</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="bg-white rounded-2xl p-4 border-2 border-sky-200 text-xs font-mono shadow-sm hover:border-sky-300 transition-all"
            >
              <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-sky-100">
                <div className="flex items-center gap-2">
                  {getSourceBadge(log.source)}
                  <span className="text-[11px] text-sky-700 font-mono font-medium">
                    {new Date(log.timestamp).toLocaleTimeString('id-ID')}
                  </span>
                </div>
                {log.payload && (
                  <button
                    onClick={() => copyToClipboard(log.payload, log.id)}
                    className="flex items-center gap-1 text-[11px] text-sky-800 hover:text-[#0284c7] px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-all font-bold cursor-pointer"
                  >
                    {copiedId === log.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Salin JSON</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <p className={`font-sans font-bold mb-2 ${
                log.type === 'SUCCESS' ? 'text-emerald-700' :
                log.type === 'WARNING' ? 'text-amber-700' :
                log.type === 'ERROR' ? 'text-rose-700' : 'text-[#034078]'
              }`}>
                {log.message}
              </p>

              {/* JSON Payload preview */}
              {log.payload && (
                <div className="bg-[#031d3b] p-3 rounded-xl border border-sky-900 overflow-x-auto text-sky-100 shadow-inner">
                  <pre className="text-[11px] leading-relaxed text-cyan-200">
                    {typeof log.payload === 'object' 
                      ? JSON.stringify(log.payload, null, 2) 
                      : String(log.payload)}
                  </pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
