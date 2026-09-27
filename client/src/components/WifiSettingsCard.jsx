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
    <div className="glass-panel rounded-2xl p-6 border border-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl">
            <Wifi className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">Pengaturan WiFi ESP32 (Cloud OTA)</h3>
            <p className="text-xs text-slate-400">Ubah SSID & Password WiFi tanpa perlu flash ulang ESP32</p>
          </div>
        </div>

        {/* Status Perangkat Terhubung */}
        <div className="flex items-center gap-2 text-xs font-mono bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-400">WiFi Aktif di ESP32:</span>
          <span className="text-cyan-300 font-bold">
            {systemState?.esp32CurrentSsid || currentConfig?.wifiSsid || 'Default'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Ubah WiFi */}
        <form onSubmit={handleSaveWifi} className="lg:col-span-7 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-blue-400" /> Nama WiFi (SSID)
            </label>
            <input
              type="text"
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              placeholder="Contoh: TP-Link_71E8"
              required
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-blue-400" /> Password WiFi
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password WiFi"
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono pr-24"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1 transition-all"
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
            <p className="text-[11px] text-slate-500 mt-1">
              Password tersimpan secara aman di database dan tidak akan hilang saat disimpan.
            </p>
          </div>

          {statusMsg && (
            <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border border-rose-500/30 text-rose-300'
            }`}>
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 active:scale-[0.99] text-white font-bold rounded-xl text-sm shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
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
        <div className="lg:col-span-5 bg-slate-900/60 rounded-xl p-4 border border-slate-800 text-xs space-y-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold">
            <Info className="w-4 h-4" />
            <span>Bagaimana Fitur Ini Bekerja?</span>
          </div>

          <p className="text-slate-300 leading-relaxed">
            1. Saat Anda menekan tombol <strong>Simpan</strong>, nama WiFi dan password baru akan tersimpan di database.
          </p>
          <p className="text-slate-300 leading-relaxed">
            2. Pada polling berikutnya (setiap 2 detik), ESP32 otomatis menerima data WiFi baru dan menyimpannya secara permanen ke <strong>Memori Flash Internal ESP32 (Non-Volatile Storage / NVS)</strong>.
          </p>
          <p className="text-slate-300 leading-relaxed">
            3. ESP32 otomatis me-restart koneksi WiFi dan tersambung ke router baru tanpa menghapus program dispenser air!
          </p>

          <div className="bg-blue-950/40 p-2.5 rounded-lg border border-blue-500/20 text-blue-200 text-[11px]">
            💡 <strong>Mode Darurat (Captive Portal):</strong> Jika WiFi rumah Anda mati/ganti, ESP32 otomatis memancarkan hotspot darurat bernama <code>ESP32_Depot_Air</code> sehingga Anda bisa connect dari HP untuk memasukkan WiFi baru.
          </div>
        </div>
      </div>
    </div>
  );
}
