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
  UserX
} from 'lucide-react';

export default function OrderSimulator({ onOrderCreated, onSimulatePayment, activePendingOrder, systemState }) {
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
          customerName: customerName || 'Pelanggan Depot'
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
    <div className="glass-card rounded-3xl p-6 sm:p-7 border border-slate-800 flex flex-col h-full relative overflow-hidden">
      {/* Background Subtle Gradient */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-800/80 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-white text-lg tracking-tight">Kiosk DANA QRIS</h3>
            <p className="text-xs text-slate-400">Pilih paket air & bayar non-tunai</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#118EEA]/20 border border-[#118EEA]/40 text-[#118EEA] text-xs font-black">
          <span className="w-2 h-2 rounded-full bg-[#118EEA] animate-pulse" />
          DANA SANDBOX
        </div>
      </div>

      {/* ⚠️ BANNER PERINGATAN JIKA ESP32 OFFLINE / GANGGUAN */}
      {isDeviceOffline && (
        <div className="mb-5 p-4 rounded-2xl bg-rose-950/70 border border-rose-500/40 shadow-xl shadow-rose-950/40 text-left relative z-10 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 mt-0.5 flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-extrabold text-rose-300 tracking-tight flex items-center gap-2">
                MESIN DEPOT SEDANG GANGGUAN / OFFLINE
              </h4>
              <p className="text-xs text-rose-200/90 mt-1 leading-relaxed">
                Mohon maaf, mesin pengisian air otomatis saat ini <strong>tidak dapat digunakan</strong> karena perangkat pengisi belum terhubung atau sedang dalam pemeliharaan.
              </p>
              <div className="mt-3 pt-2.5 border-t border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[11px] text-rose-300 font-semibold flex items-center gap-1.5">
                  <UserX className="w-3.5 h-3.5" /> Silahkan Hubungi Admin / Karyawan Depot
                </span>
                <a
                  href="https://wa.me/6281234567890?text=Halo%20Admin%20Depot%2C%20mesin%20pengisian%20air%20sedang%20offline%20atau%20gangguan"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-md self-start sm:self-auto"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>Hubungi Admin (WhatsApp)</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Package Cards Grid */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4 relative z-10 ${isDeviceOffline ? 'opacity-40 pointer-events-none' : ''}`}>
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
              className={`p-3.5 rounded-2xl border text-left transition-all duration-300 relative group ${
                isSelected
                  ? 'bg-gradient-to-b from-blue-600/25 to-blue-900/30 border-cyan-400 shadow-lg shadow-blue-600/25 ring-2 ring-cyan-400/30 scale-[1.02]'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              {pkg.badge && (
                <span className="inline-block text-[10px] font-black text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded-full mb-1 border border-cyan-500/30">
                  {pkg.badge}
                </span>
              )}
              <div className="text-xs font-bold text-white truncate group-hover:text-cyan-200 transition-colors">
                {pkg.name}
              </div>
              <div className="text-[11px] text-cyan-400 font-mono mt-0.5">
                {pkg.liters} Liter
              </div>
              <div className="text-sm font-black text-emerald-400 font-mono mt-1.5">
                Rp {pkg.price.toLocaleString('id-ID')}
              </div>
              {isSelected && (
                <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400 animate-ping" />
              )}
            </button>
          );
        })}

        {/* Custom Liter Button */}
        <button
          type="button"
          disabled={isDeviceOffline}
          onClick={() => setIsCustom(true)}
          className={`p-3.5 rounded-2xl border text-left transition-all duration-300 relative ${
            isCustom
              ? 'bg-gradient-to-b from-purple-600/25 to-purple-900/30 border-purple-400 shadow-lg shadow-purple-600/25 ring-2 ring-purple-400/30 scale-[1.02]'
              : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
          }`}
        >
          <span className="inline-block text-[10px] font-black text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full mb-1 border border-purple-500/30">
            Kustom
          </span>
          <div className="text-xs font-bold text-white">Liter Bebas</div>
          <div className="text-[11px] text-purple-300 font-mono mt-0.5">{customLiter} Liter</div>
          <div className="text-sm font-black text-purple-400 font-mono mt-1.5">
            Rp {getActivePrice().toLocaleString('id-ID')}
          </div>
        </button>
      </div>

      {/* Input if custom */}
      {isCustom && !isDeviceOffline && (
        <div className="mb-4 bg-purple-950/30 p-3.5 rounded-2xl border border-purple-500/30 relative z-10">
          <label className="block text-xs font-bold text-purple-300 mb-1.5 flex items-center justify-between">
            <span>Masukkan Volume Air (Liter):</span>
            <span className="text-purple-200 font-mono">{customLiter} L</span>
          </label>
          <input
            type="number"
            step="0.5"
            min="1"
            max="100"
            value={customLiter}
            onChange={(e) => setCustomLiter(e.target.value)}
            className="w-full bg-slate-950 border border-purple-500/40 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      )}

      {/* Customer Name Input */}
      <div className={`mb-4 relative z-10 ${isDeviceOffline ? 'opacity-40 pointer-events-none' : ''}`}>
        <label className="block text-xs font-bold text-slate-400 mb-1.5">
          Nama Pembeli (Opsional)
        </label>
        <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Contoh: Budi Santoso"
          disabled={isDeviceOffline}
          className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-sans shadow-inner"
        />
      </div>

      {/* Generate Order Button */}
      <button
        onClick={handleCreateOrder}
        disabled={isCreating || isDeviceOffline}
        className={`w-full py-3.5 px-4 font-extrabold rounded-2xl text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2 transition-all relative z-10 ${
          isDeviceOffline
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            : 'bg-gradient-to-r from-[#118EEA] via-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.99] text-white shadow-blue-600/30'
        }`}
      >
        {isCreating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isDeviceOffline ? (
          <WifiOff className="w-4 h-4 text-slate-500" />
        ) : (
          <QrCode className="w-4 h-4" />
        )}
        <span>
          {isDeviceOffline 
            ? 'TIDAK DAPAT DIGUNAKAN (SEDANG GANGGUAN / OFFLINE)' 
            : `GENERATE QRIS DANA (Rp ${getActivePrice().toLocaleString('id-ID')})`}
        </span>
      </button>

      {/* Active QR Code & Quick Pay Section */}
      {activePendingOrder && !isDeviceOffline && (
        <div className="mt-5 p-5 rounded-2xl bg-gradient-to-b from-slate-900 via-blue-950/50 to-slate-950 border border-cyan-500/40 flex flex-col items-center text-center shadow-2xl relative z-10 animate-fadeIn">
          
          <div className="flex items-center justify-between w-full mb-3.5">
            <span className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" /> SCAN QRIS DANA
            </span>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded-full border border-slate-800">
              {activePendingOrder.orderId}
            </span>
          </div>

          {/* QR Code with Holographic Laser Scanner */}
          <div className="relative p-4 bg-white rounded-3xl shadow-2xl overflow-hidden my-1.5">
            <div className="laser-line" />
            <QRCodeSVG
              value={activePendingOrder.qrString || activePendingOrder.orderId}
              size={140}
              level="M"
              includeMargin={false}
            />
          </div>

          <div className="text-xs text-slate-400 mt-2.5">
            Scan dari aplikasi DANA Sandbox atau klik tombol simulasi di bawah:
          </div>

          <button
            onClick={() => handleQuickPay(activePendingOrder.orderId)}
            disabled={isSimulating}
            className="w-full mt-3.5 py-3 px-4 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 active:scale-[0.99] text-white font-black rounded-2xl text-xs sm:text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isSimulating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-yellow-300" />
            )}
            <span>⚡ SIMULASI BAYAR SUKSES (WEBHOOK DANA)</span>
          </button>
        </div>
      )}
    </div>
  );
}
