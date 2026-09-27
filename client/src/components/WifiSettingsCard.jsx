import React, { useState, useEffect } from 'react';
import { Wifi, Key, Save, CheckCircle2, AlertCircle, RefreshCw, Cpu, Loader2, Info, Eye, EyeOff } from 'lucide-react';

export default function WifiSettingsCard({ systemState }) {
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [currentConfig, setCurrentConfig] = useState(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/device/settings');
      const data = await res.json();
      if (data.success) {
        setCurrentConfig(data.data);
        if (data.data.wifiSsid) setSsid(data.data.wifiSsid);
        if (data.data.wifiPassword !== undefined) setPassword(data.data.wifiPassword);
      }
    } catch (e) {
      console.error('Failed to fetch settings:', e);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveWifi = async (e) => {
    e.preventDefault();
    if (!ssid.trim()) {
      setStatusMsg({ type: 'error', text: 'Nama WiFi (SSID) tidak boleh kosong!' });
      return;
    }

    setLoading(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/device/save-wifi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid: ssid.trim(), password: password })
      });
      const data = await res.json();

      if (data.success) {
        setStatusMsg({
          type: 'success',
          text: data.message
        });
        // Tidak mengosongkan password agar tetap terlihat dan tersimpan
        fetchSettings();
      } else {
        setStatusMsg({ type: 'error', text: data.message || 'Gagal menyimpan konfigurasi' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Terjadi kesalahan jaringan: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/95 border-2 border-sky-300 shadow-xl shadow-sky-900/10 rounded-3xl p-6 sm:p-7">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-sky-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-sky-100 text-[#0284c7] rounded-2xl border border-sky-200 shadow-sm">
            <Wifi className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-[#034078] text-lg">Pengaturan WiFi ESP32 (Cloud OTA)</h3>
            <p className="text-xs text-sky-800/80 font-medium">Ubah SSID & Password WiFi tanpa perlu flash ulang ESP32</p>
          </div>
        </div>

        {/* Status Perangkat Terhubung */}
        <div className="flex items-center gap-2 text-xs font-mono bg-sky-50 px-3.5 py-1.5 rounded-xl border border-sky-200 shadow-sm">
          <Cpu className="w-4 h-4 text-[#0284c7]" />
          <span className="text-sky-800 font-semibold">WiFi Aktif di ESP32:</span>
          <span className="text-[#0284c7] font-black">
            {systemState?.esp32CurrentSsid || currentConfig?.wifiSsid || 'Default'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Ubah WiFi */}
        <form onSubmit={handleSaveWifi} className="lg:col-span-7 space-y-4">
          <div>
            <label className="block text-xs font-extrabold text-sky-900 mb-1.5 flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-[#0284c7]" /> Nama WiFi (SSID)
            </label>
            <input
              type="text"
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              placeholder="Contoh: TP-Link_71E8"
              required
              className="w-full bg-white border-2 border-sky-200 rounded-xl px-3.5 py-2.5 text-sm text-[#034078] font-bold font-mono placeholder-sky-400 focus:outline-none focus:border-[#0284c7] shadow-inner"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-sky-900 mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-[#0284c7]" /> Password WiFi
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password WiFi"
                className="w-full bg-white border-2 border-sky-200 rounded-xl px-3.5 py-2.5 text-sm text-[#034078] font-bold font-mono placeholder-sky-400 focus:outline-none focus:border-[#0284c7] shadow-inner pr-24"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-sky-700 hover:text-sky-900 px-2.5 py-1 bg-sky-100 hover:bg-sky-200 rounded-lg flex items-center gap-1 transition-all font-bold cursor-pointer"
              >
                {showPassword ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Tutup</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Lihat</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-sky-700/80 font-medium mt-1">
              Password tersimpan secara aman di database dan tidak akan hilang saat disimpan.
            </p>
          </div>

          {statusMsg && (
            <div className={`p-3 rounded-xl text-xs flex items-start gap-2 font-bold ${
              statusMsg.type === 'success'
                ? 'bg-emerald-100 border border-emerald-300 text-emerald-800'
                : 'bg-rose-100 border border-rose-300 text-rose-800'
            }`}>
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-[#0284c7] to-[#0ea5e9] hover:from-[#0369a1] hover:to-[#0284c7] active:scale-[0.99] text-white font-black rounded-xl text-sm shadow-md shadow-sky-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Simpan & Kirim Konfigurasi ke ESP32</span>
          </button>
        </form>

        {/* Informasi Cara Kerja */}
        <div className="lg:col-span-5 bg-sky-50/70 rounded-2xl p-5 border-2 border-sky-200 text-xs space-y-3">
          <div className="flex items-center gap-2 text-[#0284c7] font-black text-sm">
            <Info className="w-4 h-4" />
            <span>Bagaimana Fitur Ini Bekerja?</span>
          </div>

          <p className="text-sky-900 leading-relaxed font-medium">
            1. Saat Anda menekan tombol <strong>Simpan</strong>, nama WiFi dan password baru akan tersimpan di database server.
          </p>
          <p className="text-sky-900 leading-relaxed font-medium">
            2. Pada polling berikutnya (setiap 1.5 detik), ESP32 otomatis menerima data WiFi baru dan menyimpannya secara permanen ke <strong>Memori Flash Internal ESP32 (Non-Volatile Storage / NVS)</strong>.
          </p>
          <p className="text-sky-900 leading-relaxed font-medium">
            3. ESP32 otomatis me-restart koneksi WiFi dan tersambung ke router baru tanpa menghapus program dispenser air!
          </p>

          <div className="bg-white p-3 rounded-xl border border-sky-200 text-sky-800 text-[11px] shadow-sm">
            💡 <strong>Mode Darurat (Captive Portal):</strong> Jika WiFi rumah Anda mati/ganti, ESP32 otomatis memancarkan hotspot darurat bernama <code>ESP32_Depot_Air</code> sehingga Anda bisa connect dari HP untuk memasukkan WiFi baru.
          </div>
        </div>
      </div>
    </div>
  );
}
