import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  QrCode, 
  Sparkles, 
  ShoppingBag, 
  Loader2, 
  RefreshCw, 
  Droplet, 
  CreditCard, 
  AlertTriangle, 
  PhoneCall, 
  MessageSquare, 
  WifiOff,
  UserX,
  CheckCircle2,
  ScanLine,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';

export default function OrderSimulator({ 
  onOrderCreated, 
  onSimulatePayment, 
  activePendingOrder, 
  systemState,
  selectedMachineId = 'DEPOT-001',
  selectedMachine = null
}) {
  const [packages, setPackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [customLiter, setCustomLiter] = useState(19);
  const [isCustom, setIsCustom] = useState(false);
  const [customerName, setCustomerName] = useState('Pelanggan Depot');
  const [isCreating, setIsCreating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // Status Perangkat ESP32
  const isDeviceOffline = systemState?.esp32Status !== 'ONLINE';

  const fetchPackages = async () => {
    try {
      const res = await fetch('/api/packages');
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        setPackages(data.data);
        if (!selectedPackageId) {
          setSelectedPackageId(data.data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch packages:', e);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const getActivePrice = () => {
    if (isCustom) {
      return Math.round((Number(customLiter) / 19) * 7000);
    }
    const pkg = packages.find(p => p.id === selectedPackageId);
    return pkg ? pkg.price : 7000;
  };

  const getActiveLiters = () => {
    if (isCustom) return Number(customLiter) || 19;
    const pkg = packages.find(p => p.id === selectedPackageId);
    return pkg ? pkg.liters : 19;
  };

  const handleCreateOrder = async (e) => {
    e?.preventDefault();
    if (isDeviceOffline) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/dana/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: isCustom ? null : selectedPackageId,
          customLiter: isCustom ? getActiveLiters() : null,
          customerName: customerName || 'Pelanggan Depot',
          deviceId: selectedMachineId || 'DEPOT-001'
        })
      });
      const data = await response.json();
      if (data.success && onOrderCreated) {
        onOrderCreated(data.data);
      }
    } catch (err) {
      console.error('Failed to create order:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleQuickPay = async (orderId) => {
    setIsSimulating(true);
    try {
      await onSimulatePayment(orderId || activePendingOrder?.orderId);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="glass-card rounded-3xl p-6 sm:p-8 lg:p-10 border border-slate-800 flex flex-col w-full relative overflow-hidden shadow-2xl">
      {/* Background Subtle Gradient Glows */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-800/80 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-[#118EEA] to-cyan-400 flex items-center justify-center text-white shadow-xl shadow-blue-500/30">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-black text-white text-xl sm:text-2xl tracking-tight">Kiosk DANA QRIS</h2>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-cyan-300 font-bold">
                {selectedMachineId || 'DEPOT-001'}
              </span>
              {selectedMachine?.name && (
                <span className="text-xs text-slate-400 font-medium">
                  📍 {selectedMachine.name}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Pilih paket air minum isi ulang, bayar dengan QRIS DANA, dan air mengucur otomatis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#118EEA]/20 border border-[#118EEA]/40 text-[#118EEA] text-xs font-black">
            <span className="w-2 h-2 rounded-full bg-[#118EEA] animate-pulse" />
            DANA QRIS READY
          </div>
        </div>
      </div>

      {/* ⚠️ BANNER PERINGATAN JIKA ESP32 OFFLINE / GANGGUAN */}
      {isDeviceOffline && (
        <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-rose-950/70 border border-rose-500/40 shadow-xl shadow-rose-950/40 text-left relative z-10 animate-pulse">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 mt-0.5 flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-extrabold text-rose-300 tracking-tight flex items-center gap-2">
                MESIN DEPOT SEDANG GANGGUAN / OFFLINE
              </h4>
              <p className="text-xs sm:text-sm text-rose-200/90 mt-1 leading-relaxed">
                Mohon maaf, mesin pengisian air otomatis saat ini <strong>tidak dapat digunakan</strong> karena perangkat pengisi belum terhubung atau sedang dalam pemeliharaan.
              </p>
              <div className="mt-3.5 pt-3 border-t border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <span className="text-xs text-rose-300 font-semibold flex items-center gap-1.5">
                  <UserX className="w-3.5 h-3.5" /> Silahkan Hubungi Admin / Karyawan Depot
                </span>
                <a
                  href="https://wa.me/6281234567890?text=Halo%20Admin%20Depot%2C%20mesin%20pengisian%20air%20sedang%20offline%20atau%20gangguan"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md self-start sm:self-auto"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Hubungi Admin (WhatsApp)</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Two-Column Kiosk Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10">
        
        {/* Left Column: Form & Paket Selection (7 Columns) */}
        <div className="lg:col-span-7 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Droplet className="w-3.5 h-3.5 text-cyan-400" /> 1. Pilih Paket Ukuran Air
              </span>
              <span className="text-xs font-bold text-cyan-400 font-mono">
                Terpilih: {getActiveLiters()} Liter (Rp {getActivePrice().toLocaleString('id-ID')})
              </span>
            </div>

            {/* Dynamic Package Cards Grid */}
            <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 ${isDeviceOffline ? 'opacity-40 pointer-events-none' : ''}`}>
              {packages.map((pkg) => {
                const isSelected = !isCustom && selectedPackageId === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    disabled={isDeviceOffline}
                    onClick={() => {
                      setSelectedPackageId(pkg.id);
                      setIsCustom(false);
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all duration-300 relative group cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-b from-blue-600/25 to-blue-900/35 border-cyan-400 shadow-xl shadow-blue-600/30 ring-2 ring-cyan-400/40 scale-[1.02]'
                        : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    {pkg.badge && (
                      <span className="inline-block text-[10px] font-black text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded-full mb-1.5 border border-cyan-500/30">
                        {pkg.badge}
                      </span>
                    )}
                    <div className="text-sm font-bold text-white truncate group-hover:text-cyan-200 transition-colors">
                      {pkg.name}
                    </div>
                    <div className="text-xs text-cyan-400 font-mono mt-0.5">
                      {pkg.liters} Liter
                    </div>
                    <div className="text-base font-black text-emerald-400 font-mono mt-2">
                      Rp {pkg.price.toLocaleString('id-ID')}
                    </div>
                    {isSelected && (
                      <div className="absolute top-3.5 right-3.5 w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400 animate-ping" />
                    )}
                  </button>
                );
              })}

              {/* Custom Liter Button */}
              <button
                type="button"
                disabled={isDeviceOffline}
                onClick={() => setIsCustom(true)}
                className={`p-4 rounded-2xl border text-left transition-all duration-300 relative cursor-pointer ${
                  isCustom
                    ? 'bg-gradient-to-b from-purple-600/25 to-purple-900/35 border-purple-400 shadow-xl shadow-purple-600/30 ring-2 ring-purple-400/40 scale-[1.02]'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <span className="inline-block text-[10px] font-black text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full mb-1.5 border border-purple-500/30">
                  Kustom
                </span>
                <div className="text-sm font-bold text-white">Liter Bebas</div>
                <div className="text-xs text-purple-300 font-mono mt-0.5">{customLiter} Liter</div>
                <div className="text-base font-black text-purple-400 font-mono mt-2">
                  Rp {getActivePrice().toLocaleString('id-ID')}
                </div>
              </button>
            </div>
          </div>

          {/* Input if custom */}
          {isCustom && !isDeviceOffline && (
            <div className="bg-purple-950/30 p-4 rounded-2xl border border-purple-500/30 relative z-10 animate-fadeIn">
              <label className="block text-xs font-bold text-purple-300 mb-1.5 flex items-center justify-between">
                <span>Masukkan Volume Air yang Diinginkan:</span>
                <span className="text-purple-200 font-mono font-bold">{customLiter} Liter</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="100"
                value={customLiter}
                onChange={(e) => setCustomLiter(e.target.value)}
                className="w-full bg-slate-950 border border-purple-500/40 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          )}

          {/* Customer Name Input */}
          <div className={`${isDeviceOffline ? 'opacity-40 pointer-events-none' : ''}`}>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              2. Nama Pembeli (Opsional)
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              disabled={isDeviceOffline}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-sans shadow-inner"
            />
          </div>

          {/* Generate Order Button */}
          <button
            onClick={handleCreateOrder}
            disabled={isCreating || isDeviceOffline}
            className={`w-full py-4 px-5 font-black rounded-2xl text-sm sm:text-base shadow-2xl flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
              isDeviceOffline
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-[#118EEA] via-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.99] text-white shadow-blue-600/40 ring-2 ring-cyan-400/30'
            }`}
          >
            {isCreating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isDeviceOffline ? (
              <WifiOff className="w-5 h-5 text-slate-500" />
            ) : (
              <QrCode className="w-5 h-5" />
            )}
            <span>
              {isDeviceOffline 
                ? 'MESIN SEDANG OFFLINE (TIDAK DAPAT DIGUNAKAN)' 
                : `GENERATE QRIS DANA • Rp ${getActivePrice().toLocaleString('id-ID')}`}
            </span>
          </button>
        </div>

        {/* Right Column: QRIS Terminal Display (5 Columns) */}
        <div className="lg:col-span-5 flex flex-col items-center w-full">
          {activePendingOrder && !isDeviceOffline ? (
            /* Active QR Code & Quick Pay Section */
            <div className="w-full p-6 sm:p-7 rounded-3xl bg-gradient-to-b from-slate-900 via-blue-950/60 to-slate-950 border-2 border-cyan-400/50 flex flex-col items-center text-center shadow-2xl shadow-cyan-950/60 relative animate-fadeIn">
              
              <div className="flex items-center justify-between w-full mb-4">
                <span className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-yellow-400" /> SCAN QRIS DANA
                </span>
                <span className="text-[11px] font-mono text-slate-300 bg-slate-950 px-2.5 py-0.5 rounded-full border border-slate-800">
                  {activePendingOrder.orderId}
                </span>
              </div>

              {/* Tagihan Info */}
              <div className="mb-3 text-center">
                <div className="text-xs text-slate-400 font-medium">Total Pembayaran:</div>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  Rp {Number(activePendingOrder.amount || getActivePrice()).toLocaleString('id-ID')}
                </div>
              </div>

              {/* QR Code with Holographic Laser Scanner */}
              <div className="relative p-4 sm:p-5 bg-white rounded-3xl shadow-2xl overflow-hidden my-2 border-4 border-slate-800">
                <div className="laser-line" />
                <QRCodeSVG
                  value={activePendingOrder.qrString || activePendingOrder.orderId}
                  size={180}
                  level="M"
                  includeMargin={false}
                />
              </div>

              <div className="text-xs text-slate-400 mt-3 max-w-xs leading-relaxed">
                Buka aplikasi <strong>DANA</strong> atau e-wallet apa saja di HP Anda, lalu scan QR di atas.
              </div>

              <button
                onClick={() => handleQuickPay(activePendingOrder.orderId)}
                disabled={isSimulating}
                className="w-full mt-4 py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 active:scale-[0.99] text-white font-black rounded-2xl text-xs sm:text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSimulating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                )}
                <span>⚡ SIMULASI BAYAR SUKSES (WEBHOOK DANA)</span>
              </button>
            </div>
          ) : (
            /* Idle Terminal Guide Card */
            <div className="w-full p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 shadow-lg shadow-cyan-500/10">
                <ScanLine className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-white tracking-tight">Siap Melayani Pengisian</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                Pilih paket literan air minum di sebelah kiri, lalu tekan tombol <strong>Generate QRIS DANA</strong>.
              </p>

              <div className="mt-6 w-full space-y-3 text-left">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <div className="w-7 h-7 rounded-xl bg-blue-500/20 text-cyan-300 flex items-center justify-center font-black text-xs shrink-0">
                    1
                  </div>
                  <div className="text-xs text-slate-300">
                    Pilih ukuran galon (19L, 10L, botol atau kustom)
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <div className="w-7 h-7 rounded-xl bg-blue-500/20 text-cyan-300 flex items-center justify-center font-black text-xs shrink-0">
                    2
                  </div>
                  <div className="text-xs text-slate-300">
                    Scan QRIS DANA yang muncul di layar
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <div className="w-7 h-7 rounded-xl bg-blue-500/20 text-cyan-300 flex items-center justify-center font-black text-xs shrink-0">
                    3
                  </div>
                  <div className="text-xs text-slate-300">
                    Tekan tombol fisik di ESP32 / layar untuk mulai isi air
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2 text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Sistem Otomatis Akurat dengan Sensor Flow YF-S201</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
