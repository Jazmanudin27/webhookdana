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
    <div className="glass-panel rounded-2xl p-6 border border-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">Kelola Paket & Harga Air</h3>
            <p className="text-xs text-slate-400">Atur literan, harga (Rp), dan label paket isi ulang</p>
          </div>
        </div>

        <button
          type="button"
          onClick={resetForm}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold rounded-xl text-slate-300 hover:text-white transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah Paket Baru</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Tambah / Edit Paket */}
        <div className="lg:col-span-5 bg-slate-900/70 p-5 rounded-2xl border border-slate-800">
          <h4 className="text-sm font-bold text-white mb-4 flex items-center justify-between">
            <span>{editingId ? '✏️ Edit Paket Air' : '➕ Tambah Paket Air Baru'}</span>
            {editingId && (
              <button onClick={resetForm} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Batal
              </button>
            )}
          </h4>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nama Paket
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: 1 Galon (19L) / Botol 1.5L"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-sans"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                  <Droplet className="w-3 h-3 text-cyan-400" /> Volume (Liter)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  value={liters}
                  onChange={(e) => setLiters(e.target.value)}
                  placeholder="19"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-emerald-400" /> Harga (Rp)
                </label>
                <input
                  type="number"
                  step="500"
                  min="500"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="7000"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Label Badge (Opsional)
              </label>
              <input
                type="text"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                placeholder="Contoh: Populer / Hemat / Promo"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-sans"
              />
            </div>

            {statusMsg && (
              <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                statusMsg.type === 'success' ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30' : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
              }`}>
                {statusMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                <span>{statusMsg.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-500 active:scale-[0.99] text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{editingId ? 'Simpan Perubahan' : 'Tambah Paket Air'}</span>
            </button>
          </form>
        </div>

        {/* Tabel Daftar Paket yang Ada */}
        <div className="lg:col-span-7">
          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Nama Paket</th>
                  <th className="py-3 px-3">Volume</th>
                  <th className="py-3 px-3">Harga (Rp)</th>
                  <th className="py-3 px-3">Label</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {packages.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-500 font-sans">
                      Belum ada paket air. Tambahkan melalui form di samping.
                    </td>
                  </tr>
                ) : (
                  packages.map((pkg) => (
                    <tr key={pkg.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-sans font-bold text-white">
                        {pkg.name}
                      </td>
                      <td className="py-3.5 px-3 text-cyan-300">
                        {pkg.liters} L
                      </td>
                      <td className="py-3.5 px-3 text-emerald-400 font-bold">
                        Rp {pkg.price.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-3 font-sans">
                        {pkg.badge ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            {pkg.badge}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEdit(pkg)}
                            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-400 transition-colors"
                            title="Edit Paket"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(pkg.id, pkg.name)}
                            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
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

          <p className="text-[11px] text-slate-500 mt-2">
            💡 Setiap paket yang Anda buat atau ubah di sini akan langsung tampil pada tombol pemilihan di <strong>Kiosk Pembelian</strong> dan otomatis disinkronkan ke ESP32 saat transaksi dibuat!
          </p>
        </div>
      </div>
    </div>
  );
}
