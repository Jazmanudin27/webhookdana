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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle className="w-3.5 h-3.5" /> Sukses Terisi
          </span>
        );
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-sky-100 text-sky-800 border border-sky-300 animate-pulse">
            <Clock className="w-3.5 h-3.5" /> Menunggu ESP32
          </span>
        );
      case 'FILLING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-cyan-100 text-cyan-800 border border-cyan-300 animate-pulse">
            <Droplet className="w-3.5 h-3.5" /> Sedang Mengisi
          </span>
        );
      case 'STOPPED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
            <ShieldAlert className="w-3.5 h-3.5" /> Emergency Stop
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5" /> Pending Bayar
          </span>
        );
    }
  };

  return (
    <div className="bg-white/95 border-2 border-sky-300 shadow-xl shadow-sky-900/10 rounded-3xl p-6 sm:p-7">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-sky-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-sky-100 text-[#0284c7] rounded-2xl border border-sky-200 shadow-sm">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-[#034078] text-lg">Riwayat Transaksi Depot</h3>
            <p className="text-xs text-sky-800/80 font-medium">Total {transactions.length} transaksi tercatat</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-sky-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari Order ID / Nama..."
            className="w-full bg-white border-2 border-sky-200 rounded-xl pl-9 pr-3 py-2 text-xs text-[#034078] font-bold placeholder-sky-400 focus:outline-none focus:border-[#0284c7] shadow-inner"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border-2 border-sky-200 shadow-sm">
        <table className="w-full text-left text-xs bg-white">
          <thead className="bg-sky-50 text-sky-900 font-black border-b border-sky-200 uppercase tracking-wider">
            <tr>
              <th className="py-3.5 pl-4">Order ID</th>
              <th className="py-3.5">Paket Air</th>
              <th className="py-3.5">Pelanggan</th>
              <th className="py-3.5">Nominal</th>
              <th className="py-3.5">Terisi</th>
              <th className="py-3.5">Status</th>
              <th className="py-3.5 pr-4">Waktu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sky-100 font-mono">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-8 text-center text-sky-800/60 font-sans">
                  Belum ada data transaksi yang sesuai pencarian.
                </td>
              </tr>
            ) : (
              filtered.map((tx) => (
                <tr key={tx.orderId} className="hover:bg-sky-50/50 transition-colors">
                  <td className="py-3.5 pl-4 font-bold text-sky-900">
                    {tx.orderId}
                  </td>
                  <td className="py-3.5 font-sans font-bold text-[#034078]">
                    {tx.title}
                  </td>
                  <td className="py-3.5 font-sans text-sky-800 font-semibold">
                    {tx.customerName || '-'}
                  </td>
                  <td className="py-3.5 text-emerald-600 font-black">
                    Rp {Number(tx.amount || 0).toLocaleString('id-ID')}
                  </td>
                  <td className="py-3.5 text-[#0284c7] font-bold">
                    {tx.dispensedLiter ? `${tx.dispensedLiter} L` : `${tx.targetLiter} L`}
                  </td>
                  <td className="py-3.5 font-sans">
                    {getStatusBadge(tx.status)}
                  </td>
                  <td className="py-3.5 pr-4 text-sky-700 text-[11px] font-medium font-sans">
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
