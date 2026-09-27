import React, { useState } from 'react';
import { Cpu, Globe, Server, Copy, Check, ExternalLink, ShieldCheck, Terminal } from 'lucide-react';

export default function HardwareConfigGuide({ baseUrl = 'https://dana.aspartech.com' }) {
  const [copiedKey, setCopiedKey] = useState(null);

  const endpoints = [
    {
      label: 'DANA Finish-Notify Webhook URL (Daftarkan ke DANA Merchant)',
      url: `${baseUrl}/api/dana/finish-notify`,
      method: 'POST'
    },
    {
      label: 'ESP32 Check Order Polling URL',
      url: `${baseUrl}/api/esp32/check-order`,
      method: 'GET'
    },
    {
      label: 'ESP32 Finish Fill Callback URL',
      url: `${baseUrl}/api/esp32/finish-fill`,
      method: 'POST'
    },
    {
      label: 'Simulasi Buat Order Baru (Kiosk/Frontend)',
      url: `${baseUrl}/api/dana/create-order`,
      method: 'POST'
    }
  ];

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800">
      <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-slate-800/80">
        <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl">
          <Server className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-white text-lg">Konfigurasi Endpoint & Wiring ESP32</h3>
          <p className="text-xs text-slate-400">Domain Publik: <strong className="text-cyan-400 font-mono">{baseUrl}</strong></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Endpoint URLs */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" /> Endpoint API Live
          </h4>
          
          {endpoints.map((ep, idx) => (
            <div key={idx} className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-slate-400">{ep.label}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  ep.method === 'POST' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                }`}>
                  {ep.method}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800/80">
                <code className="text-xs text-cyan-300 font-mono truncate">{ep.url}</code>
                <button
                  onClick={() => copyText(ep.url, `ep-${idx}`)}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-all flex-shrink-0"
                  title="Salin URL"
                >
                  {copiedKey === `ep-${idx}` ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Pinout Hardware Matrix */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" /> Pinout Hardware ESP32
          </h4>

          <div className="bg-slate-900/80 rounded-xl border border-slate-800 overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-950 border-b border-slate-800 text-[11px] text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">Pin ESP32</th>
                  <th className="py-2.5 px-3">Komponen</th>
                  <th className="py-2.5 px-3">Fungsi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono">
                <tr>
                  <td className="py-2 px-3 text-cyan-300 font-bold">GPIO 18</td>
                  <td className="py-2 px-3 font-sans text-slate-200">Water Flow Sensor (YF-S201)</td>
                  <td className="py-2 px-3 font-sans text-slate-400 text-[11px]">Interrupt Hitung Pulsa</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-cyan-300 font-bold">GPIO 26</td>
                  <td className="py-2 px-3 font-sans text-slate-200">Relay Solenoid Valve</td>
                  <td className="py-2 px-3 font-sans text-slate-400 text-[11px]">Kontrol Aliran Air 12V</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-cyan-300 font-bold">GPIO 19</td>
                  <td className="py-2 px-3 font-sans text-slate-200">Active Buzzer 5V</td>
                  <td className="py-2 px-3 font-sans text-slate-400 text-[11px]">1x Mulai / 4x Selesai</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-cyan-300 font-bold">GPIO 4</td>
                  <td className="py-2 px-3 font-sans text-slate-200">Tombol Emergency Stop</td>
                  <td className="py-2 px-3 font-sans text-slate-400 text-[11px]">Stop Manual Seketika</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-cyan-300 font-bold">GPIO 2</td>
                  <td className="py-2 px-3 font-sans text-slate-200">Built-in LED ESP32</td>
                  <td className="py-2 px-3 font-sans text-slate-400 text-[11px]">Indikator WiFi & Flow</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-blue-950/30 rounded-xl border border-blue-500/20 text-xs text-blue-200/90 leading-relaxed">
            💡 <strong>Info Kalibrasi:</strong> Default rumus pulsa flow sensor adalah <code>450 pulsa/Liter</code>. Jika hasil takaran kurang atau berlebih beberapa mililiter, ubah <code>PULSES_PER_LITER</code> di file Arduino <code>DepotAir_ESP32.ino</code>.
          </div>
        </div>
      </div>
    </div>
  );
}
