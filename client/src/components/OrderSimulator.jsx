import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  QrCode, 
  Sparkles, 
  Loader2, 
  Droplet, 
  CreditCard, 
  AlertTriangle, 
  MessageSquare, 
  WifiOff,
  ScanLine,
  ShieldCheck,
  CheckCircle2
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
    <div className="glass-card rounded-2xl p-4 sm:p-5 border border-slate-800 flex flex-col w-full h-full flex-1 relative overflow-hidden shadow-2xl justify-between">
      {/* Background Subtle Gradient Glows */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 pb-3 mb-2 border-b border-slate-800/80 relative z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-[#118EEA] to-cyan-400 flex items-center justify-center text-white shadow-md shadow-blue-500/30 shrink-0">
            <CreditCard className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-black text-white text-base sm:text-lg tracking-tight">Kiosk DANA QRIS</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-cyan-300 font-bold">
              {selectedMachineId || 'DEPOT-001'}
            </span>
            {selectedMachine?.name && (
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                📍 {selectedMachine.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#118EEA]/20 border border-[#118EEA]/40 text-[#118EEA] text-[10px] font-black shrink-0">
          <span className="w-2 h-2 rounded-full bg-[#118EEA] animate-pulse" />
          DANA QRIS READY
        </div>
      </div>

      {/* ⚠️ BANNER PERINGATAN JIKA ESP32 OFFLINE */}
      {isDeviceOffline && (
        <div className="mb-2.5 px-3 py-2 rounded-xl bg-rose-950/80 border border-rose-500/40 text-left flex items-center justify-between gap-2.5 animate-pulse shrink-0">
          <div className="flex items-center gap-2 text-xs text-rose-200 truncate">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="truncate">
              <strong>MESIN OFFLINE:</strong> Mesin pengisian air saat ini belum terhubung / dalam pemeliharaan.
            </span>
          </div>
          <a
            href="https://wa.me/6281234567890?text=Halo%20Admin%20Depot%2C%20mesin%20pengisian%20air%20sedang%20offline%20atau%20gangguan"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shrink-0"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Admin</span>
          </a>
        </div>
      )}

      {/* Two-Column Kiosk Layout (Fills height and width evenly) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-stretch relative z-10 flex-1 h-full min-h-0">
        
        {/* Left Column: Form & Paket Selection (7 Columns) */}
        <div className="lg:col-span-7 flex flex-col justify-between h-full min-h-0">
          <div className="flex flex-col justify-center flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Droplet className="w-3.5 h-3.5 text-cyan-400" /> 1. Pilih Paket Ukuran Air
              </span>
              <span className="text-xs font-bold text-cyan-400 font-mono">
                Terpilih: {getActiveLiters()} Liter • Rp {getActivePrice().toLocaleString('id-ID')}
              </span>
            </div>

            {/* Dynamic Package Cards Grid */}
            <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 ${isDeviceOffline ? 'opacity-40 pointer-events-none' : ''}`}>
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
                    className={`p-3 rounded-2xl border text-left transition-all duration-200 relative group cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-gradient-to-b from-blue-600/35 to-blue-900/50 border-cyan-400 shadow-lg shadow-blue-600/30 ring-2 ring-cyan-400/40 scale-[1.02]'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div>
                      {pkg.badge && (
                        <span className="inline-block text-[9px] font-black text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded-full mb-1 border border-cyan-500/30">
                          {pkg.badge}
                        </span>
                      )}
                      <div className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-cyan-200 transition-colors leading-tight">
                        {pkg.name}
                      </div>
                      <div className="text-[11px] text-cyan-400 font-mono mt-0.5">
                        {pkg.liters} Liter
                      </div>
                    </div>
                    <div className="text-sm sm:text-base font-black text-emerald-400 font-mono mt-2">
                      Rp {pkg.price.toLocaleString('id-ID')}
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    )}
                  </button>
                );
              })}

              {/* Custom Liter Button */}
              <button
                type="button"
                disabled={isDeviceOffline}
                onClick={() => setIsCustom(true)}
                className={`p-3 rounded-2xl border text-left transition-all duration-200 relative cursor-pointer flex flex-col justify-between ${
                  isCustom
                    ? 'bg-gradient-to-b from-purple-600/35 to-purple-900/50 border-purple-400 shadow-lg shadow-purple-600/30 ring-2 ring-purple-400/40 scale-[1.02]'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div>
                  <span className="inline-block text-[9px] font-black text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full mb-1 border border-purple-500/30">
                    Kustom
                  </span>
                  <div className="text-xs sm:text-sm font-bold text-white leading-tight">Liter Bebas</div>
                  <div className="text-[11px] text-purple-300 font-mono mt-0.5">{customLiter} Liter</div>
                </div>
                <div className="text-sm sm:text-base font-black text-purple-400 font-mono mt-2">
                  Rp {getActivePrice().toLocaleString('id-ID')}
                </div>
              </button>
            </div>
          </div>

          {/* Input if custom */}
          {isCustom && !isDeviceOffline && (
            <div className="bg-purple-950/30 px-3 py-1.5 rounded-xl border border-purple-500/30 relative z-10 animate-fadeIn my-2 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-purple-300">Volume (Liter):</span>
              <input
                type="number"
                step="0.5"
                min="1"
                max="100"
                value={customLiter}
                onChange={(e) => setCustomLiter(e.target.value)}
                className="w-24 bg-slate-950 border border-purple-500/40 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
              />
            </div>
          )}

          {/* Customer Name Input & Generate Button (Side-by-Side to save vertical space) */}
          <div className="flex flex-col sm:flex-row gap-3 items-center mt-3 pt-3 border-t border-slate-800/80 shrink-0">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nama Pembeli (Opsional)"
              disabled={isDeviceOffline}
              className="w-full sm:w-2/5 bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-sans shadow-inner"
            />

            <button
              onClick={handleCreateOrder}
              disabled={isCreating || isDeviceOffline}
              className={`w-full sm:w-3/5 py-2.5 sm:py-3 px-4 font-black rounded-xl text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isDeviceOffline
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-[#118EEA] via-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.99] text-white shadow-blue-600/40 ring-1 ring-cyan-400/30'
              }`}
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isDeviceOffline ? (
                <WifiOff className="w-4 h-4 text-slate-500" />
              ) : (
                <QrCode className="w-4 h-4" />
              )}
              <span className="truncate">
                {isDeviceOffline 
                  ? 'MESIN OFFLINE' 
                  : `GENERATE QRIS • Rp ${getActivePrice().toLocaleString('id-ID')}`}
              </span>
            </button>
          </div>
        </div>

        {/* Right Column: QRIS Terminal Display (5 Columns) */}
        <div className="lg:col-span-5 flex flex-col justify-between items-center w-full h-full min-h-0">
          {activePendingOrder && !isDeviceOffline ? (
            /* Active QR Code & Quick Pay Section */
            <div className="w-full p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-slate-900 via-blue-950/60 to-slate-950 border-2 border-cyan-400/50 flex flex-col justify-between items-center text-center shadow-xl shadow-cyan-950/60 relative animate-fadeIn h-full">
              
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-400" /> SCAN QRIS DANA
                </span>
                <span className="text-[10px] font-mono text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {activePendingOrder.orderId}
                </span>
              </div>

              {/* Tagihan Info */}
              <div className="text-center my-1">
                <div className="text-xs text-slate-400 font-medium">Total Pembayaran:</div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                  Rp {Number(activePendingOrder.amount || getActivePrice()).toLocaleString('id-ID')}
                </div>
              </div>

              {/* QR Code with Laser Scanner */}
              <div className="relative p-2.5 bg-white rounded-2xl shadow-xl overflow-hidden my-1 border-2 border-slate-800">
                <div className="laser-line" />
                <QRCodeSVG
                  value={activePendingOrder.qrString || activePendingOrder.orderId}
                  size={135}
                  level="M"
                  includeMargin={false}
                />
              </div>

              <div className="text-xs text-slate-400 mt-1 leading-tight">
                Scan dengan aplikasi <strong>DANA</strong> atau e-wallet lainnya
              </div>

              <button
                onClick={() => handleQuickPay(activePendingOrder.orderId)}
                disabled={isSimulating}
                className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 active:scale-[0.99] text-white font-black rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSimulating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                )}
                <span>⚡ SIMULASI BAYAR SUKSES</span>
              </button>
            </div>
          ) : (
            /* Idle Terminal Guide Card */
            <div className="w-full p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between text-center h-full">
              <div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm">
                    <ScanLine className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-white tracking-tight">Siap Melayani Pengisian</h3>
                </div>
                <p className="text-xs text-slate-400">
                  Pilih paket ukuran di samping, lalu tekan <strong>Generate QRIS DANA</strong>
                </p>
              </div>

              <div className="space-y-2 text-left my-auto py-2">
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-cyan-300 flex items-center justify-center font-black text-xs shrink-0">
                    1
                  </div>
                  <div className="text-xs text-slate-300 leading-tight">
                    Pilih ukuran galon (19L, 38L, 10L, 2L, kustom)
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-cyan-300 flex items-center justify-center font-black text-xs shrink-0">
                    2
                  </div>
                  <div className="text-xs text-slate-300 leading-tight">
                    Scan QRIS DANA yang muncul di layar
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-cyan-300 flex items-center justify-center font-black text-xs shrink-0">
                    3
                  </div>
                  <div className="text-xs text-slate-300 leading-tight">
                    Tekan tombol fisik di ESP32 / layar untuk mulai kucur
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-500/10 py-1.5 px-3 rounded-full border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Sensor Flow Akurat YF-S201 (GPIO 34)</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
