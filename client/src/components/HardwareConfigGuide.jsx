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
    <div className="bg-white/95 border-2 border-sky-300 shadow-xl shadow-sky-900/10 rounded-3xl p-6 sm:p-7">
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-sky-200">
        <div className="p-3 bg-sky-100 text-[#0284c7] rounded-2xl border border-sky-200 shadow-sm">
          <Server className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-black text-[#034078] text-lg">Konfigurasi Endpoint & Wiring ESP32</h3>
          <p className="text-xs text-sky-800/80 font-medium">Domain Publik: <strong className="text-[#0284c7] font-mono">{baseUrl}</strong></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Endpoint URLs */}
        <div className="space-y-3">
          <h4 className="text-xs font-black text-[#034078] uppercase tracking-wider flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#0284c7]" /> Endpoint API Live
          </h4>
          
          {endpoints.map((ep, idx) => (
            <div key={idx} className="bg-sky-50/60 rounded-2xl p-3 border-2 border-sky-200 shadow-sm">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-sky-900">{ep.label}</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  ep.method === 'POST' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-sky-100 text-[#0284c7] border border-sky-300'
                }`}>
                  {ep.method}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-sky-200 shadow-inner">
                <code className="text-xs text-[#0284c7] font-mono font-bold truncate">{ep.url}</code>
                <button
                  onClick={() => copyText(ep.url, `ep-${idx}`)}
                  className="p-1 hover:bg-sky-100 rounded-lg text-sky-700 hover:text-sky-900 transition-all flex-shrink-0 cursor-pointer"
                  title="Salin URL"
                >
                  {copiedKey === `ep-${idx}` ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
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
          <h4 className="text-xs font-black text-[#034078] uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#0284c7]" /> Pinout Hardware ESP32
          </h4>

          <div className="bg-white rounded-2xl border-2 border-sky-200 overflow-hidden text-xs shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-sky-50 border-b border-sky-200 text-[11px] text-sky-900 font-black">
                <tr>
                  <th className="py-2.5 px-3">Pin ESP32</th>
                  <th className="py-2.5 px-3">Komponen</th>
                  <th className="py-2.5 px-3">Fungsi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100 font-mono">
                <tr className="hover:bg-sky-50/40">
                  <td className="py-2 px-3 text-[#0284c7] font-bold">GPIO 34 (D34)</td>
                  <td className="py-2 px-3 font-sans font-bold text-[#034078]">Water Flow Sensor (YF-S201)</td>
                  <td className="py-2 px-3 font-sans text-sky-800 text-[11px]">Sinyal Kuning Hitung Liter</td>
                </tr>
                <tr className="hover:bg-sky-50/40">
                  <td className="py-2 px-3 text-[#0284c7] font-bold">GPIO 32 (D32)</td>
                  <td className="py-2 px-3 font-sans font-bold text-[#034078]">Tombol Push Kucur / Jeda</td>
                  <td className="py-2 px-3 font-sans text-sky-800 text-[11px]">Tekan Mulai Ngocor / Pause</td>
                </tr>
                <tr className="hover:bg-sky-50/40">
                  <td className="py-2 px-3 text-rose-600 font-bold">GPIO 21 (D21)</td>
                  <td className="py-2 px-3 font-sans font-bold text-rose-700">Lampu LED Merah Tombol</td>
                  <td className="py-2 px-3 font-sans text-sky-800 text-[11px]">Menyala saat Siap / Jeda</td>
                </tr>
                <tr className="hover:bg-sky-50/40">
                  <td className="py-2 px-3 text-emerald-600 font-bold">GPIO 22 (D22)</td>
                  <td className="py-2 px-3 font-sans font-bold text-emerald-700">Lampu LED Hijau Tombol</td>
                  <td className="py-2 px-3 font-sans text-sky-800 text-[11px]">Menyala saat Air Mengucur</td>
                </tr>
                <tr className="hover:bg-sky-50/40">
                  <td className="py-2 px-3 text-[#0284c7] font-bold">GPIO 26 (D26)</td>
                  <td className="py-2 px-3 font-sans font-bold text-[#034078]">Relay Solenoid Valve 12V</td>
                  <td className="py-2 px-3 font-sans text-sky-800 text-[11px]">Buka / Tutup Keran Air</td>
                </tr>
                <tr className="hover:bg-sky-50/40">
                  <td className="py-2 px-3 text-[#0284c7] font-bold">GPIO 19 (D19)</td>
                  <td className="py-2 px-3 font-sans font-bold text-[#034078]">Active Buzzer 5V</td>
                  <td className="py-2 px-3 font-sans text-sky-800 text-[11px]">1x Mulai / 4x Selesai</td>
                </tr>
                <tr className="hover:bg-sky-50/40">
                  <td className="py-2 px-3 text-[#0284c7] font-bold">GPIO 2 (D2)</td>
                  <td className="py-2 px-3 font-sans font-bold text-[#034078]">Built-in LED ESP32</td>
                  <td className="py-2 px-3 font-sans text-sky-800 text-[11px]">Indikator WiFi & Status</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-3.5 bg-sky-50 rounded-2xl border border-sky-200 text-xs text-sky-800 leading-relaxed font-medium shadow-sm">
            💡 <strong>Info Kalibrasi:</strong> Default rumus pulsa flow sensor adalah <code>450 pulsa/Liter</code>. Jika hasil takaran kurang atau berlebih beberapa mililiter, ubah <code>PULSES_PER_LITER</code> di file Arduino <code>DepotAir_ESP32.ino</code>.
          </div>
        </div>
      </div>
    </div>
  );
}
