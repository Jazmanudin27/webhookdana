import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Sparkles, CheckCircle, ArrowRight, ShoppingBag, Loader2, RefreshCw } from 'lucide-react';

export default function OrderSimulator({ onOrderCreated, onSimulatePayment, activePendingOrder, loading }) {
  const [packageType, setPackageType] = useState('1_GALON');
  const [customLiter, setCustomLiter] = useState(19);
  const [customerName, setCustomerName] = useState('Pelanggan Depot');
  const [isCreating, setIsCreating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const getPrice = () => {
    if (packageType === '1_GALON') return 7000;
    if (packageType === '2_GALON') return 14000;
    return Math.round((Number(customLiter) / 19) * 7000);
  };

  const getLiters = () => {
    if (packageType === '1_GALON') return 19;
    if (packageType === '2_GALON') return 38;
    return Number(customLiter) || 19;
  };

  const handleCreateOrder = async (e) => {
    e?.preventDefault();
    setIsCreating(true);
    try {
      const response = await fetch('/api/dana/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageType,
          customLiter: getLiters(),
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

      {/* Package Selection Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Package 1 */}
        <button
          type="button"
          onClick={() => { setPackageType('1_GALON'); }}
          className={`p-3.5 rounded-xl border text-left transition-all relative ${
            packageType === '1_GALON'
              ? 'bg-blue-600/15 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
              : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-xs text-slate-400 font-medium">Paket Populer</div>
          <div className="text-base font-bold text-white mt-0.5">1 Galon (19L)</div>
          <div className="text-sm font-extrabold text-blue-400 font-mono mt-1">
            Rp 7.000
          </div>
          {packageType === '1_GALON' && (
            <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-blue-400" />
          )}
        </button>

        {/* Package 2 */}
        <button
          type="button"
          onClick={() => { setPackageType('2_GALON'); }}
          className={`p-3.5 rounded-xl border text-left transition-all relative ${
            packageType === '2_GALON'
              ? 'bg-blue-600/15 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
              : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="text-xs text-slate-400 font-medium">Paket Hemat</div>
          <div className="text-base font-bold text-white mt-0.5">2 Galon (38L)</div>
          <div className="text-sm font-extrabold text-blue-400 font-mono mt-1">
            Rp 14.000
          </div>
          {packageType === '2_GALON' && (
            <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-blue-400" />
          )}
        </button>
      </div>

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
          className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
        <span>Generate Order & QRIS DANA (Rp {getPrice().toLocaleString('id-ID')})</span>
      </button>

      {/* Active QR Code & Quick Pay Section */}
      {activePendingOrder && (
        <div className="mt-5 p-4 rounded-xl bg-slate-900/80 border border-blue-500/30 flex flex-col items-center text-center animate-fadeIn">
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

          {/* 1-Click Sandbox Payment Trigger Button */}
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
