import React, { useState } from 'react';
import { History, CheckCircle, Clock, AlertTriangle, ShieldAlert, Search, Droplet } from 'lucide-react';

export default function TransactionHistory({ transactions = [] }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = transactions.filter(t => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      t.orderId?.toLowerCase().includes(term) ||
      t.customerName?.toLowerCase().includes(term) ||
      t.title?.toLowerCase().includes(term) ||
      t.status?.toLowerCase().includes(term)
    );
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3.5 h-3.5" /> Sukses Terisi
          </span>
        );
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
            <Clock className="w-3.5 h-3.5" /> Menunggu ESP32
          </span>
        );
      case 'FILLING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse">
            <Droplet className="w-3.5 h-3.5" /> Sedang Mengisi
          </span>
        );
      case 'INCOMPLETE':
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> Terhenti / Kurang
          </span>
        );
      case 'STOPPED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-3.5 h-3.5" /> Emergency Stop
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Pending Bayar
          </span>
        );
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">Riwayat Transaksi Depot</h3>
            <p className="text-xs text-slate-400">Total {transactions.length} transaksi tercatat</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari Order ID / Nama..."
            className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <th className="pb-3 pl-2">Order ID</th>
              <th className="pb-3">Paket Air</th>
              <th className="pb-3">Pelanggan</th>
              <th className="pb-3">Nominal</th>
              <th className="pb-3">Terisi</th>
              <th className="pb-3">Status</th>
              <th className="pb-3 pr-2">Waktu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-8 text-center text-slate-500 font-sans">
                  Belum ada data transaksi yang sesuai pencarian.
                </td>
              </tr>
            ) : (
              filtered.map((tx) => (
                <tr key={tx.orderId} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3.5 pl-2 font-medium text-slate-300">
                    {tx.orderId}
                  </td>
                  <td className="py-3.5 font-sans font-medium text-white">
                    {tx.title}
                  </td>
                  <td className="py-3.5 font-sans text-slate-300">
                    {tx.customerName || '-'}
                  </td>
                  <td className="py-3.5 text-emerald-400 font-bold">
                    Rp {Number(tx.amount || 0).toLocaleString('id-ID')}
                  </td>
                  <td className="py-3.5 text-cyan-300">
                    {tx.dispensedLiter ? `${tx.dispensedLiter} L` : `${tx.targetLiter} L`}
                  </td>
                  <td className="py-3.5 font-sans">
                    {getStatusBadge(tx.status)}
                  </td>
                  <td className="py-3.5 pr-2 text-slate-400 text-[11px]">
                    {new Date(tx.createdAt).toLocaleString('id-ID')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
