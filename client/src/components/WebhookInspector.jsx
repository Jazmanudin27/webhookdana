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
          <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
            <Globe className="w-3 h-3" /> DANA Webhook
          </span>
        );
      case 'ESP32':
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
            <Cpu className="w-3 h-3" /> ESP32 Device
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            {source}
          </span>
        );
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              Webhook & Telemetry Stream
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </h3>
            <p className="text-xs text-slate-400">Live JSON Payload Inspector</p>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          {['ALL', 'DANA_WEBHOOK', 'ESP32'].map(src => (
            <button
              key={src}
              onClick={() => setFilterSource(src)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                filterSource === src
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
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
          <div className="h-48 flex flex-col items-center justify-center text-center text-slate-500">
            <Terminal className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Belum ada aktivitas webhook atau request ESP32.</p>
            <p className="text-xs mt-1">Lakukan simulasi atau nyalakan ESP32 untuk melihat log.</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800/90 text-xs font-mono transition-all hover:border-slate-700"
            >
              <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/60">
                <div className="flex items-center gap-2">
                  {getSourceBadge(log.source)}
                  <span className="text-[11px] text-slate-500 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString('id-ID')}
                  </span>
                </div>
                {log.payload && (
                  <button
                    onClick={() => copyToClipboard(log.payload, log.id)}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all"
                  >
                    {copiedId === log.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Tersalin</span>
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

              <p className={`font-sans font-medium mb-1.5 ${
                log.type === 'SUCCESS' ? 'text-emerald-300' :
                log.type === 'WARNING' ? 'text-amber-300' :
                log.type === 'ERROR' ? 'text-rose-400' : 'text-slate-200'
              }`}>
                {log.message}
              </p>

              {/* JSON Payload preview */}
              {log.payload && (
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/80 overflow-x-auto text-slate-300">
                  <pre className="text-[11px] leading-relaxed text-cyan-200/90">
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
