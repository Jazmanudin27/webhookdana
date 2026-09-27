import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit2, Trash2, CheckCircle2, AlertCircle, Save, X, Layers, Droplet, DollarSign } from 'lucide-react';

export default function PackageManagerCard({ onPackagesChanged }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Form State
  const [name, setName] = useState('');
  const [liters, setLiters] = useState(19);
  const [price, setPrice] = useState(7000);
  const [badge, setBadge] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);

  const fetchPackages = async () => {
    try {
      const res = await fetch('/api/admin/packages');
      const data = await res.json();
      if (data.success) {
        setPackages(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch packages:', e);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setLiters(19);
    setPrice(7000);
    setBadge('');
    setStatusMsg(null);
  };

  const handleEdit = (pkg) => {
    setEditingId(pkg.id);
    setName(pkg.name);
    setLiters(pkg.liters);
    setPrice(pkg.price);
    setBadge(pkg.badge || '');
    setStatusMsg(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || liters <= 0 || price <= 0) {
      setStatusMsg({ type: 'error', text: 'Nama, liter, dan harga harus valid!' });
      return;
    }

    setLoading(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/admin/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          name: name.trim(),
          liters: Number(liters),
          price: Number(price),
          badge: badge.trim(),
          isActive: true
        })
      });
      const data = await res.json();

      if (data.success) {
        setStatusMsg({ type: 'success', text: editingId ? 'Paket berhasil diperbarui!' : 'Paket baru berhasil ditambahkan!' });
        resetForm();
        fetchPackages();
        if (onPackagesChanged) onPackagesChanged();
      } else {
        setStatusMsg({ type: 'error', text: data.message || 'Gagal menyimpan paket' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Error: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, pkgName) => {
    if (!window.confirm(`Yakin ingin menghapus paket "${pkgName}"?`)) return;

    try {
      const res = await fetch(`/api/admin/packages/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchPackages();
        if (onPackagesChanged) onPackagesChanged();
      }
    } catch (e) {
      alert('Gagal menghapus paket: ' + e.message);
    }
  };

  return (
    <div className="bg-white/95 border-2 border-sky-300 shadow-xl shadow-sky-900/10 rounded-3xl p-6 sm:p-7">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-sky-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-sky-100 text-[#0284c7] rounded-2xl border border-sky-200 shadow-sm">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-[#034078] text-lg">Kelola Paket & Harga Air</h3>
            <p className="text-xs text-sky-800/80 font-medium">Atur literan, harga (Rp), dan label paket isi ulang</p>
          </div>
        </div>

        <button
          type="button"
          onClick={resetForm}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-50 border border-sky-300 hover:bg-sky-100 text-xs font-black rounded-xl text-[#0284c7] transition-all shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Paket Baru</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Tambah / Edit Paket */}
        <div className="lg:col-span-5 bg-sky-50/60 p-5 rounded-2xl border-2 border-sky-200 shadow-sm">
          <h4 className="text-sm font-black text-[#034078] mb-4 flex items-center justify-between">
            <span>{editingId ? '✏️ Edit Paket Air' : '➕ Tambah Paket Air Baru'}</span>
            {editingId && (
              <button onClick={resetForm} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-bold">
                <X className="w-3.5 h-3.5" /> Batal
              </button>
            )}
          </h4>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-extrabold text-sky-900 mb-1">
                Nama Paket
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: 1 Galon (19L) / Botol 1.5L"
                required
                className="w-full bg-white border-2 border-sky-200 rounded-xl px-3 py-2 text-xs text-[#034078] font-bold placeholder-sky-400 focus:outline-none focus:border-[#0284c7] font-sans shadow-inner"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-extrabold text-sky-900 mb-1 flex items-center gap-1">
                  <Droplet className="w-3 h-3 text-[#0284c7]" /> Volume (Liter)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  value={liters}
                  onChange={(e) => setLiters(e.target.value)}
                  placeholder="19"
                  required
                  className="w-full bg-white border-2 border-sky-200 rounded-xl px-3 py-2 text-xs text-[#034078] font-mono font-bold focus:outline-none focus:border-[#0284c7] shadow-inner"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-sky-900 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-emerald-600" /> Harga (Rp)
                </label>
                <input
                  type="number"
                  step="500"
                  min="500"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="7000"
                  required
                  className="w-full bg-white border-2 border-sky-200 rounded-xl px-3 py-2 text-xs text-emerald-700 font-mono font-bold focus:outline-none focus:border-[#0284c7] shadow-inner"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-sky-900 mb-1">
                Label Badge (Opsional)
              </label>
              <input
                type="text"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                placeholder="Contoh: Populer / Hemat / Promo"
                className="w-full bg-white border-2 border-sky-200 rounded-xl px-3 py-2 text-xs text-[#034078] font-bold placeholder-sky-400 focus:outline-none focus:border-[#0284c7] font-sans shadow-inner"
              />
            </div>

            {statusMsg && (
              <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 font-bold ${
                statusMsg.type === 'success' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}>
                {statusMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                <span>{statusMsg.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-[#0284c7] to-[#0ea5e9] hover:from-[#0369a1] hover:to-[#0284c7] active:scale-[0.99] text-white font-black rounded-xl text-xs shadow-md shadow-sky-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{editingId ? 'Simpan Perubahan' : 'Tambah Paket Air'}</span>
            </button>
          </form>
        </div>

        {/* Tabel Daftar Paket yang Ada */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl border-2 border-sky-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-sky-50 text-sky-900 font-black border-b border-sky-200">
                <tr>
                  <th className="py-3 px-4">Nama Paket</th>
                  <th className="py-3 px-3">Volume</th>
                  <th className="py-3 px-3">Harga (Rp)</th>
                  <th className="py-3 px-3">Label</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100 font-mono">
                {packages.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-sky-800/60 font-sans">
                      Belum ada paket air. Tambahkan melalui form di samping.
                    </td>
                  </tr>
                ) : (
                  packages.map((pkg) => (
                    <tr key={pkg.id} className="hover:bg-sky-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-sans font-bold text-[#034078]">
                        {pkg.name}
                      </td>
                      <td className="py-3.5 px-3 text-[#0284c7] font-bold">
                        {pkg.liters} L
                      </td>
                      <td className="py-3.5 px-3 text-emerald-600 font-bold">
                        Rp {pkg.price.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-3 font-sans">
                        {pkg.badge ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-100 text-[#0284c7] border border-sky-300">
                            {pkg.badge}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEdit(pkg)}
                            className="p-1.5 hover:bg-sky-100 rounded-lg text-sky-700 hover:text-sky-900 transition-colors cursor-pointer"
                            title="Edit Paket"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(pkg.id, pkg.name)}
                            className="p-1.5 hover:bg-rose-100 rounded-lg text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
                            title="Hapus Paket"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-sky-800/80 font-medium mt-2">
            💡 Setiap paket yang Anda buat atau ubah di sini akan langsung tampil pada tombol pemilihan di <strong>Kiosk Pembelian</strong> dan otomatis disinkronkan ke ESP32 saat transaksi dibuat!
          </p>
        </div>
      </div>
    </div>
  );
}
