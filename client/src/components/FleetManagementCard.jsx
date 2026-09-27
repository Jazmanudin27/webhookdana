import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Plus, 
  Trash2, 
  RefreshCw, 
  ExternalLink, 
  ShieldAlert, 
  CheckCircle2, 
  Droplet, 
  TrendingUp, 
  Gauge, 
  Wifi, 
  WifiOff, 
  Copy, 
  Check, 
  MapPin, 
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';

export default function FleetManagementCard({ machines = [], onRefresh, onSelectMachine, selectedMachineId }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newFilterLimit, setNewFilterLimit] = useState(10000);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);

  const handleCopyLink = (machineId) => {
    const url = `${window.location.origin}/?machine=${machineId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(machineId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCreateMachine = async (e) => {
    e.preventDefault();
    if (!newId || !newName) return;
    setLoading(true);
    try {
      const res = await fetch('/api/machines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newId,
          name: newName,
          location: newLocation,
          filterLimitLiters: Number(newFilterLimit) || 10000
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setNewId('');
        setNewName('');
        setNewLocation('');
        setNewFilterLimit(10000);
        setActionMsg({ type: 'success', text: `Cabang ${data.data?.name || newId} berhasil didaftarkan!` });
        if (onRefresh) onRefresh();
      } else {
        setActionMsg({ type: 'error', text: data.message || 'Gagal mendaftarkan cabang baru' });
      }
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
      setTimeout(() => setActionMsg(null), 5000);
    }
  };

  const handleDeleteMachine = async (machineId, machineName) => {
    if (machineId === 'DEPOT-001') {
      alert('Mesin Utama / Prototipe (DEPOT-001) tidak dapat dihapus!');
      return;
    }
    if (!window.confirm(`Yakin ingin menghapus cabang "${machineName}" (${machineId})? Data riwayat tetap tersimpan di database.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/machines/${machineId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: `Cabang ${machineId} berhasil dihapus.` });
        if (onRefresh) onRefresh();
      } else {
        setActionMsg({ type: 'error', text: data.message });
      }
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const handleResetFilter = async (machineId) => {
    if (!window.confirm(`Konfirmasi reset filter untuk ${machineId}? Gunakan ini setelah Anda mengganti cartridge filter fisik di depot.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/machines/${machineId}/reset-filter`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setActionMsg({ type: 'success', text: `Filter ${machineId} berhasil di-reset ke 0 Liter.` });
        if (onRefresh) onRefresh();
      } else {
        setActionMsg({ type: 'error', text: data.message });
      }
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  // Fleet Totals
  const totalFleetRevenue = machines.reduce((acc, m) => acc + (Number(m.totalRevenue) || 0), 0);
  const totalFleetLiters = machines.reduce((acc, m) => acc + (Number(m.totalLiters) || 0), 0);
  const onlineCount = machines.filter(m => m.esp32Status === 'ONLINE').length;

  return (
    <div className="space-y-6">
      
      {/* Action Notification Alert */}
      {actionMsg && (
        <div className={`p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between animate-fadeIn ${
          actionMsg.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <span>{actionMsg.text}</span>
          <button onClick={() => setActionMsg(null)} className="text-xs opacity-70 hover:opacity-100">Tutup</button>
        </div>
      )}

      {/* Fleet Overview Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-3xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Cabang Aktif</div>
            <div className="text-2xl font-black text-white mt-1">
              {machines.length} <span className="text-sm font-normal text-slate-400">Unit Mesin</span>
            </div>
            <div className="text-xs text-emerald-400 mt-0.5 flex items-center gap-1 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              {onlineCount} Mesin Online
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400">
            <Server className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Omset Seluruh Cabang</div>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
              Rp {totalFleetRevenue.toLocaleString('id-ID')}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Akumulasi pendapatan DANA</div>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-5 rounded-3xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Air Terdistribusi</div>
            <div className="text-2xl font-black text-cyan-300 font-mono mt-1">
              {totalFleetLiters.toFixed(1)} <span className="text-sm font-normal text-slate-400">Liter</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Semua sensor flow YF-S201</div>
          </div>
          <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400">
            <Droplet className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-400" />
            Armada Mesin Depot Air (Fleet Management)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Pantau dan kendalikan semua depot air di berbagai lokasi/cabang secara terpusat dari satu server cloud
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onRefresh}
            className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all text-xs font-semibold flex items-center gap-1.5"
            title="Refresh Status Armada"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#118EEA] to-cyan-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-blue-500/25 hover:from-blue-600 hover:to-cyan-400 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Cabang Baru</span>
          </button>
        </div>
      </div>

      {/* Grid of Machine Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {machines.map((machine) => {
          const isOnline = machine.esp32Status === 'ONLINE';
          const isSelected = selectedMachineId === machine.id;
          const filterLimit = Number(machine.filterLimitLiters) || 10000;
          const filterUsed = Number(machine.filterUsedLiters) || 0;
          const filterPercent = Math.min(100, Math.round((filterUsed / filterLimit) * 100));
          const isFilterWarning = filterPercent >= 80;
          const isFilterCritical = filterPercent >= 95;

          return (
            <div 
              key={machine.id}
              className={`rounded-3xl p-6 border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                isSelected 
                  ? 'bg-slate-900/90 border-cyan-500/60 shadow-2xl shadow-cyan-950/60 ring-2 ring-cyan-500/30' 
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Card Ambient Glow */}
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl pointer-events-none ${
                isOnline ? 'bg-emerald-500/10' : 'bg-rose-500/5'
              }`} />

              <div>
                {/* Top Badge & Status */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-cyan-300">
                      {machine.id}
                    </span>
                    {machine.id === 'DEPOT-001' && (
                      <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Pusat
                      </span>
                    )}
                  </div>

                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
                    isOnline 
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' 
                      : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  }`}>
                    {isOnline ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        <span>ONLINE</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3 h-3 text-rose-400" />
                        <span>OFFLINE</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Machine Name & Location */}
                <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                  {machine.name}
                </h3>
                <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{machine.location || 'Lokasi belum disetel'}</span>
                </div>

                {/* Status Operasional Mesin Saat Ini */}
                <div className="mt-4 p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Status Dispenser:</span>
                  <span className={`font-black uppercase px-2 py-0.5 rounded-lg ${
                    machine.status === 'FILLING' 
                      ? 'bg-cyan-500/20 text-cyan-300 animate-pulse'
                      : machine.status === 'PAID' 
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : machine.status === 'PAUSED'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'text-slate-300'
                  }`}>
                    {machine.status || 'IDLE'}
                  </span>
                </div>

                {/* Metrics Stats */}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-1">
                  <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Total Omset</div>
                    <div className="text-sm font-black text-emerald-400 font-mono mt-0.5">
                      Rp {(Number(machine.totalRevenue) || 0).toLocaleString('id-ID')}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Total Air</div>
                    <div className="text-sm font-black text-cyan-300 font-mono mt-0.5">
                      {(Number(machine.totalLiters) || 0).toFixed(1)} L
                    </div>
                  </div>
                </div>

                {/* Water Filter Life Progress Bar */}
                <div className="mt-4 p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Gauge className={`w-3.5 h-3.5 ${isFilterCritical ? 'text-rose-400' : isFilterWarning ? 'text-amber-400' : 'text-cyan-400'}`} />
                      Kesehatan Filter Air
                    </span>
                    <span className={`font-mono text-xs font-black ${
                      isFilterCritical ? 'text-rose-400' : isFilterWarning ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {filterPercent}% Terpakai
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isFilterCritical 
                          ? 'bg-gradient-to-r from-red-500 to-rose-600' 
                          : isFilterWarning 
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-400' 
                          : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                      }`}
                      style={{ width: `${filterPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
                    <span>{filterUsed.toFixed(0)} / {filterLimit.toLocaleString('id-ID')} L</span>
                    <button
                      onClick={() => handleResetFilter(machine.id)}
                      className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 underline flex items-center gap-0.5"
                      title="Reset setelah ganti cartridge filter fisik baru"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      Reset Filter
                    </button>
                  </div>

                  {isFilterWarning && (
                    <div className="mt-2 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 p-1.5 rounded-xl flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>Filter sudah mencapai {filterPercent}%. Segera siapkan cartridge pengganti!</span>
                    </div>
                  )}
                </div>

                {/* Device Diagnostics & Telemetry Info */}
                <div className="mt-3 text-[11px] text-slate-500 space-y-1 font-mono">
                  <div className="flex items-center justify-between">
                    <span>IP ESP32:</span>
                    <span className="text-slate-400">{machine.esp32Ip || machine.ip || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>WiFi SSID:</span>
                    <span className="text-slate-400">{machine.esp32CurrentSsid || machine.ssid || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center gap-2">
                
                {/* Select / View Machine in Main Dashboard */}
                <button
                  onClick={() => onSelectMachine(machine.id)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    isSelected 
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' 
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isSelected ? 'Sedang Dipantau' : 'Pilih Cabang Ini'}</span>
                </button>

                {/* Copy Kiosk Tablet Link */}
                <button
                  onClick={() => handleCopyLink(machine.id)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-all"
                  title="Salin Link Kiosk Khusus Mesin Ini (Untuk Tablet/Layar di Cabang)"
                >
                  {copiedId === machine.id ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>

                {/* Open Kiosk in New Tab */}
                <a
                  href={`/?machine=${machine.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-all"
                  title="Buka Halaman Pembeli Kiosk di Tab Baru"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>

                {/* Delete button (except DEPOT-001) */}
                {machine.id !== 'DEPOT-001' && (
                  <button
                    onClick={() => handleDeleteMachine(machine.id, machine.name)}
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all"
                    title="Hapus Cabang"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: Tambah Cabang Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass-card max-w-md w-full p-6 sm:p-7 rounded-3xl border border-slate-800 relative shadow-2xl">
            <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <Plus className="w-5 h-5 text-cyan-400" />
              Daftarkan Cabang Depot Baru
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Setiap depot air di cabang baru harus memiliki ID Mesin unik (contoh: DEPOT-002, DEPOT-003).
            </p>

            <form onSubmit={handleCreateMachine} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  ID Mesin (Unik) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: DEPOT-002"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value.toUpperCase())}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Masukkan ID yang sama ke program sketch ESP32: <code className="text-cyan-300">DEVICE_ID = "{newId || 'DEPOT-002'}"</code>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Nama Cabang / Depot *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Depot Air Cabang Jl. Sudirman"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Lokasi / Alamat Cabang
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Ruko Blok A5, Surabaya Timur"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-white text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Batas Umur Filter Air (Liter)
                </label>
                <input
                  type="number"
                  placeholder="10000"
                  value={newFilterLimit}
                  onChange={(e) => setNewFilterLimit(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Sistem akan memberikan peringatan ganti filter jika telah mencapai 80% dari batas ini.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-900 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#118EEA] to-cyan-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-blue-500/25 hover:from-blue-600 hover:to-cyan-400 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {loading ? 'Menyimpan...' : 'Simpan Cabang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Guide Box for Cloning ESP32 Units */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-3">
        <div className="flex items-center gap-2 font-bold text-white text-sm">
          <Info className="w-4 h-4 text-cyan-400" />
          <span>Cara Menambah Mesin Depot Baru di Lapangan:</span>
        </div>
        <ol className="list-decimal list-inside space-y-1.5 text-slate-400 pl-1 leading-relaxed">
          <li>Klik tombol <strong>"Tambah Cabang Baru"</strong> di atas dan masukkan ID (misal: <code className="text-cyan-300">DEPOT-002</code>).</li>
          <li>Ambil ESP32 baru untuk cabang tersebut, buka file sketch <code className="text-cyan-300">DepotAir_ESP32.ino</code> di Arduino IDE.</li>
          <li>Ubah baris: <code className="text-cyan-300">const String DEVICE_ID = "DEPOT-002";</code> dan upload ke ESP32.</li>
          <li>Pasang di lokasi cabang. ESP32 akan langsung terhubung ke server pusat <code className="text-cyan-300">dana.aspartech.com</code> dan berstatus ONLINE.</li>
          <li>Buka link kiosk tablet cabang (klik tombol Salin Link Kiosk) dan letakkan di etalase depot agar pelanggan bisa langsung memesan via QRIS DANA!</li>
        </ol>
      </div>

    </div>
  );
}
