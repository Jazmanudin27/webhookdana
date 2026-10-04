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
  ShieldCheck
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
    <div className="glass-card rounded-2xl p-3 sm:p-4 border border-slate-800 flex flex-col w-full relative overflow-hidden shadow-2xl">
      {/* Background Subtle Gradient Glows */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-blue-600/10 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-cyan-500/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Header Bar (Ultra Compact) */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800/80 relative z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 via-[#118EEA] to-cyan-400 flex items-center justify-center text-white shadow-md shadow-blue-500/30 shrink-0">
            <CreditCard className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <h2 className="font-black text-white text-sm sm:text-base tracking-tight">Kiosk DANA QRIS</h2>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300 font-bold">
              {selectedMachineId || 'DEPOT-001'}
            </span>
            {selectedMachine?.name && (
              <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                📍 {selectedMachine.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#118EEA]/20 border border-[#118EEA]/40 text-[#118EEA] text-[9px] font-black shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-[#118EEA] animate-pulse" />
          DANA QRIS READY
        </div>
      </div>

      {/* ⚠️ BANNER PERINGATAN JIKA ESP32 OFFLINE (Ultra Compact 1-line Alert) */}
      {isDeviceOffline && (
        <div className="mb-2 px-2.5 py-1 rounded-lg bg-rose-950/80 border border-rose-500/40 text-left flex items-center justify-between gap-2 animate-pulse shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-rose-200 truncate">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">
              <strong>MESIN OFFLINE:</strong> Mesin pengisian air belum terhubung.
            </span>
          </div>
          <a
            href="https://wa.me/6281234567890?text=Halo%20Admin%20Depot%2C%20mesin%20pengisian%20air%20sedang%20offline%20atau%20gangguan"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold transition-all shrink-0"
          >
            <MessageSquare className="w-3 h-3" />
            <span>Admin</span>
          </a>
        </div>
      )}

      {/* Two-Column Kiosk Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch relative z-10 flex-1">
        
        {/* Left Column: Form & Paket Selection (7 Columns) */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1">
                <Droplet className="w-3 h-3 text-cyan-400" /> 1. Pilih Paket Ukuran Air
              </span>
              <span className="text-[11px] font-bold text-cyan-400 font-mono">
                {getActiveLiters()} L • Rp {getActivePrice().toLocaleString('id-ID')}
              </span>
            </div>

            {/* Dynamic Package Cards Grid */}
            <div className={`grid grid-cols-3 sm:grid-cols-5 gap-1.5 ${isDeviceOffline ? 'opacity-40 pointer-events-none' : ''}`}>
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
                    className={`p-2 rounded-xl border text-left transition-all duration-200 relative group cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-b from-blue-600/30 to-blue-900/40 border-cyan-400 shadow-md shadow-blue-600/30 ring-1 ring-cyan-400/40 scale-[1.02]'
                        : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    {pkg.badge && (
                      <span className="inline-block text-[8px] font-black text-cyan-300 bg-cyan-500/20 px-1 py-0 rounded mb-0.5 border border-cyan-500/30">
                        {pkg.badge}
                      </span>
                    )}
                    <div className="text-[11px] font-bold text-white truncate group-hover:text-cyan-200 transition-colors leading-tight">
                      {pkg.name}
                    </div>
                    <div className="text-[9px] text-cyan-400 font-mono mt-0.5">
                      {pkg.liters} Liter
                    </div>
                    <div className="text-xs font-black text-emerald-400 font-mono mt-0.5">
                      Rp {pkg.price.toLocaleString('id-ID')}
                    </div>
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                    )}
                  </button>
                );
              })}

              {/* Custom Liter Button */}
              <button
                type="button"
                disabled={isDeviceOffline}
                onClick={() => setIsCustom(true)}
                className={`p-2 rounded-xl border text-left transition-all duration-200 relative cursor-pointer ${
                  isCustom
                    ? 'bg-gradient-to-b from-purple-600/30 to-purple-900/40 border-purple-400 shadow-md shadow-purple-600/30 ring-1 ring-purple-400/40 scale-[1.02]'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <span className="inline-block text-[8px] font-black text-purple-300 bg-purple-500/20 px-1 py-0 rounded mb-0.5 border border-purple-500/30">
                  Kustom
                </span>
                <div className="text-[11px] font-bold text-white leading-tight">Liter Bebas</div>
                <div className="text-[9px] text-purple-300 font-mono mt-0.5">{customLiter} Liter</div>
                <div className="text-xs font-black text-purple-400 font-mono mt-0.5">
                  Rp {getActivePrice().toLocaleString('id-ID')}
                </div>
              </button>
            </div>
          </div>

          {/* Input if custom */}
          {isCustom && !isDeviceOffline && (
            <div className="bg-purple-950/30 px-2.5 py-1 rounded-lg border border-purple-500/30 relative z-10 animate-fadeIn mt-1.5 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-purple-300">Volume (Liter):</span>
              <input
                type="number"
                step="0.5"
                min="1"
                max="100"
                value={customLiter}
                onChange={(e) => setCustomLiter(e.target.value)}
                className="w-20 bg-slate-950 border border-purple-500/40 rounded px-2 py-0.5 text-xs text-white font-mono focus:outline-none text-center"
              />
            </div>
          )}

          {/* Customer Name Input & Generate Button (Side-by-Side to save vertical space) */}
          <div className="flex flex-col sm:flex-row gap-2 items-center mt-2.5 pt-2 border-t border-slate-800/80">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nama Pembeli (Opsional)"
              disabled={isDeviceOffline}
              className="w-full sm:w-2/5 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-sans shadow-inner"
            />

            <button
              onClick={handleCreateOrder}
              disabled={isCreating || isDeviceOffline}
              className={`w-full sm:w-3/5 py-2 px-3 font-black rounded-xl text-xs shadow-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isDeviceOffline
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-[#118EEA] via-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.99] text-white shadow-blue-600/40 ring-1 ring-cyan-400/30'
              }`}
            >
              {isCreating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isDeviceOffline ? (
                <WifiOff className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <QrCode className="w-3.5 h-3.5" />
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
        <div className="lg:col-span-5 flex flex-col justify-center items-center w-full">
          {activePendingOrder && !isDeviceOffline ? (
            /* Active QR Code & Quick Pay Section */
            <div className="w-full p-2.5 rounded-xl bg-gradient-to-b from-slate-900 via-blue-950/60 to-slate-950 border border-cyan-400/50 flex flex-col items-center text-center shadow-lg relative animate-fadeIn">
              
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-[10px] font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-yellow-400" /> SCAN QRIS DANA
                </span>
                <span className="text-[9px] font-mono text-slate-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                  {activePendingOrder.orderId}
                </span>
              </div>

              {/* Tagihan Info */}
              <div className="text-center mb-1">
                <span className="text-[10px] text-slate-400 font-medium mr-1.5">Total:</span>
                <span className="text-lg font-black text-emerald-400 font-mono">
                  Rp {Number(activePendingOrder.amount || getActivePrice()).toLocaleString('id-ID')}
                </span>
              </div>

              {/* QR Code with Laser Scanner */}
              <div className="relative p-2 bg-white rounded-xl shadow-md overflow-hidden my-0.5 border border-slate-700">
                <div className="laser-line" />
                <QRCodeSVG
                  value={activePendingOrder.qrString || activePendingOrder.orderId}
                  size={110}
                  level="M"
                  includeMargin={false}
                />
              </div>

              <div className="text-[9px] text-slate-400 mt-1 leading-tight">
                Scan dengan aplikasi <strong>DANA</strong> atau e-wallet lainnya
              </div>

              <button
                onClick={() => handleQuickPay(activePendingOrder.orderId)}
                disabled={isSimulating}
                className="w-full mt-1.5 py-1.5 px-2.5 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 active:scale-[0.99] text-white font-black rounded-lg text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSimulating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3 text-yellow-300" />
                )}
                <span>⚡ SIMULASI BAYAR SUKSES</span>
              </button>
            </div>
          ) : (
            /* Idle Terminal Guide Card */
            <div className="w-full p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between text-center h-full">
              <div>
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <div className="w-5 h-5 rounded-lg bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <ScanLine className="w-3 h-3" />
                  </div>
                  <h3 className="text-xs font-black text-white tracking-tight">Siap Melayani Pengisian</h3>
                </div>
                <p className="text-[10px] text-slate-400">
                  Pilih paket ukuran di samping, lalu tekan <strong>Generate QRIS DANA</strong>
                </p>
              </div>

              <div className="space-y-1 text-left my-1.5">
                <div className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-950/70 border border-slate-800">
                  <div className="w-4 h-4 rounded bg-blue-500/20 text-cyan-300 flex items-center justify-center font-black text-[9px] shrink-0">
                    1
                  </div>
                  <div className="text-[10px] text-slate-300 leading-tight">
                    Pilih ukuran galon (19L, 38L, 10L, 2L, kustom)
                  </div>
                </div>

                <div className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-950/70 border border-slate-800">
                  <div className="w-4 h-4 rounded bg-blue-500/20 text-cyan-300 flex items-center justify-center font-black text-[9px] shrink-0">
                    2
                  </div>
                  <div className="text-[10px] text-slate-300 leading-tight">
                    Scan QRIS DANA yang muncul di layar
                  </div>
                </div>

                <div className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-950/70 border border-slate-800">
                  <div className="w-4 h-4 rounded bg-blue-500/20 text-cyan-300 flex items-center justify-center font-black text-[9px] shrink-0">
                    3
                  </div>
                  <div className="text-[10px] text-slate-300 leading-tight">
                    Tekan tombol fisik di ESP32 / layar untuk mulai kucur
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-1 text-[9px] text-emerald-400 font-semibold bg-emerald-500/10 py-0.5 px-2 rounded-full border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3 shrink-0" />
                <span className="truncate">Sensor Flow Akurat YF-S201 (GPIO 34)</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
