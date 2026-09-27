import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Sparkles, CheckCircle, ShoppingBag, Loader2, RefreshCw, Droplet } from 'lucide-react';

export default function OrderSimulator({ onOrderCreated, onSimulatePayment, activePendingOrder }) {
  const [packages, setPackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState(null);
  const [customLiter, setCustomLiter] = useState(19);
  const [isCustom, setIsCustom] = useState(false);
  const [customerName, setCustomerName] = useState('Pelanggan Depot');
  const [isCreating, setIsCreating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

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
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col h-full">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">Simulasi Transaksi DANA</h3>
            <p className="text-xs text-slate-400">Pilih paket air & buat QRIS Sandbox</p>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
          DANA Sandbox
        </span>
      </div>

      {/* Dynamic Package Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
        {packages.map((pkg) => (
          <button
            key={pkg.id}
            type="button"
            onClick={() => {
              setSelectedPackageId(pkg.id);
              setIsCustom(false);
            }}
            className={`p-3 rounded-xl border text-left transition-all relative ${
              !isCustom && selectedPackageId === pkg.id
                ? 'bg-blue-600/15 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
            }`}
          >
            {pkg.badge && (
              <span className="inline-block text-[10px] font-semibold text-blue-300 bg-blue-500/20 px-1.5 py-0.5 rounded mb-1">
                {pkg.badge}
              </span>
            )}
            <div className="text-xs font-bold text-white truncate">{pkg.name}</div>
            <div className="text-[11px] text-cyan-300 font-mono mt-0.5">{pkg.liters} Liter</div>
            <div className="text-xs font-extrabold text-emerald-400 font-mono mt-1">
              Rp {pkg.price.toLocaleString('id-ID')}
            </div>
            {!isCustom && selectedPackageId === pkg.id && (
              <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-blue-400" />
            )}
          </button>
        ))}

        {/* Custom Liter Button */}
        <button
          type="button"
          onClick={() => setIsCustom(true)}
          className={`p-3 rounded-xl border text-left transition-all relative ${
            isCustom
              ? 'bg-purple-600/15 border-purple-500 ring-2 ring-purple-500/20 shadow-md'
              : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-[10px] text-purple-300 font-semibold mb-1">Kustom</div>
          <div className="text-xs font-bold text-white">Liter Bebas</div>
          <div className="text-xs font-extrabold text-purple-400 font-mono mt-2">
            Rp {getActivePrice().toLocaleString('id-ID')}
          </div>
          {isCustom && (
            <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-purple-400" />
          )}
        </button>
      </div>

      {/* Input if custom */}
      {isCustom && (
        <div className="mb-4 bg-slate-900/80 p-3 rounded-xl border border-purple-500/30">
          <label className="block text-xs font-medium text-purple-300 mb-1">
            Masukkan Jumlah Liter Air:
          </label>
          <input
            type="number"
            step="0.5"
            min="1"
            max="100"
            value={customLiter}
            onChange={(e) => setCustomLiter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
          />
        </div>
      )}

      {/* Customer Name Input */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-slate-400 mb-1.5">
          Nama Pelanggan (Opsional)
        </label>
        <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Contoh: Budi Santoso"
          className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-sans"
        />
      </div>

      {/* Generate Order Button */}
      <button
        onClick={handleCreateOrder}
        disabled={isCreating}
        className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 active:scale-[0.99] text-white font-semibold rounded-xl text-sm shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
      >
        {isCreating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <QrCode className="w-4 h-4" />
        )}
        <span>Generate Order & QRIS DANA (Rp {getActivePrice().toLocaleString('id-ID')})</span>
      </button>

      {/* Active QR Code & Quick Pay Section */}
      {activePendingOrder && (
        <div className="mt-5 p-4 rounded-xl bg-slate-900/80 border border-blue-500/30 flex flex-col items-center text-center">
          <div className="flex items-center justify-between w-full mb-3">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
              QRIS DANA Siap Dibayar
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {activePendingOrder.orderId}
            </span>
          </div>

          <div className="bg-white p-3 rounded-2xl shadow-xl my-1">
            <QRCodeSVG
              value={activePendingOrder.qrString || activePendingOrder.orderId}
              size={130}
              level="M"
              includeMargin={false}
            />
          </div>

          <div className="mt-2 text-xs text-slate-400">
            Scan dengan aplikasi DANA Sandbox atau klik tombol simulasi di bawah
          </div>

          <button
            onClick={() => handleQuickPay(activePendingOrder.orderId)}
            disabled={isSimulating}
            className="w-full mt-3 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold rounded-xl text-sm shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isSimulating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-emerald-200" />
            )}
            <span>⚡ Simulasi Pembayaran Sukses (Kirim Webhook)</span>
          </button>
        </div>
      )}
    </div>
  );
}
