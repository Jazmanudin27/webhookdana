import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Shield, 
  User, 
  Key, 
  Phone, 
  MapPin, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Loader2, 
  AlertCircle,
  Sparkles,
  Lock
} from 'lucide-react';

export default function UserManagementCard({ authToken, machines = [] }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'CLIENT',
    assignedMachineId: machines[0]?.id || 'DEPOT-001',
    phone: ''
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setUsers(data.data || []);
      } else {
        setError(data.message || 'Gagal mengambil data user dari database');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchUsers();
    }
  }, [authToken]);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      password: '',
      name: '',
      role: 'CLIENT',
      assignedMachineId: machines[0]?.id || 'DEPOT-001',
      phone: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setFormData({
      id: user.id,
      username: user.username,
      password: '',
      name: user.name,
      role: user.role,
      assignedMachineId: user.assignedMachineId || (machines[0]?.id || 'DEPOT-001'),
      phone: user.phone || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...formData,
        id: editingUser ? editingUser.id : undefined
      };
      if (payload.role === 'ADMIN') {
        payload.assignedMachineId = null;
      }
      if (editingUser && !payload.password) {
        delete payload.password;
      }

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(editingUser ? 'Data pengguna berhasil diperbarui!' : 'Pengguna baru berhasil ditambahkan!');
        setTimeout(() => setSuccessMsg(''), 4000);
        setIsModalOpen(false);
        fetchUsers();
      } else {
        setError(data.message || 'Gagal menyimpan pengguna');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (id === 1) {
      alert('Akun Super Administrator Utama (#1) dilindungi dan tidak dapat dihapus!');
      return;
    }
    if (!confirm(`Hapus akun "${name}" secara permanen dari database?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Akun ${name} berhasil dihapus dari database.`);
        setTimeout(() => setSuccessMsg(''), 4000);
        fetchUsers();
      } else {
        alert(data.message || 'Gagal menghapus pengguna');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="glass-card rounded-3xl p-5 sm:p-7 border border-slate-800 space-y-6 relative overflow-hidden">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-md">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                Manajemen Pengguna & Mitra
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Tabel `users`
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Data akun login Administrator & Mitra Cabang yang diambil langsung dari database MySQL
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 via-[#118EEA] to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-95 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-xl shadow-blue-500/25 transition-all cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Pengguna Baru</span>
        </button>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2.5 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Users Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin text-cyan-400" />
          <span className="text-xs">Mengambil data pengguna dari tabel `users` database...</span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-extrabold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Pengguna (Username)</th>
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">Peran (Role)</th>
                <th className="py-3 px-4">Cabang Ditugaskan</th>
                <th className="py-3 px-4">No. WhatsApp</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-900/50 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-500 font-bold">#{u.id}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs uppercase">
                        {u.username[0]}
                      </div>
                      <span className="font-bold text-white font-mono">{u.username}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-200">{u.name}</td>
                  <td className="py-3 px-4">
                    {u.role === 'ADMIN' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-extrabold">
                        👑 Super Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-extrabold">
                        👤 Mitra Cabang
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {u.role === 'ADMIN' ? (
                      <span className="text-slate-500 font-mono text-xs">Semua Cabang (Global)</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono text-cyan-300 font-semibold text-xs">
                        <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                        {u.assignedMachineId || '-'}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-mono text-xs">
                    {u.phone || '-'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-700 transition-all cursor-pointer"
                        title="Edit Pengguna"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {u.id !== 1 && (
                        <button
                          onClick={() => handleDelete(u.id, u.name)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition-all cursor-pointer"
                          title="Hapus Pengguna"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Tambah / Edit Pengguna */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass-card w-full max-w-md p-6 rounded-3xl border border-slate-800 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                {editingUser ? 'Edit Data Pengguna' : 'Tambah Pengguna Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Username Login
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="misal: mitra_sby"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  {editingUser ? 'Password Baru (Kosongkan jika tidak ingin diubah)' : 'Password Login'}
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="password"
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? '••••••••' : 'Password login user'}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nama Lengkap / Penanggung Jawab
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="misal: Budi Santoso"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Peran (Role)
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    <option value="CLIENT">Mitra Cabang (Client)</option>
                    <option value="ADMIN">Super Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    No. WhatsApp
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="08123456789"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>

              {formData.role === 'CLIENT' && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Cabang Mesin yang Ditugaskan
                  </label>
                  <select
                    value={formData.assignedMachineId}
                    onChange={(e) => setFormData({ ...formData, assignedMachineId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer font-mono"
                  >
                    {machines.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.id} - {m.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Mitra hanya dapat memantau omset dan transaksi untuk mesin cabang ini saja.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 via-[#118EEA] to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-lg shadow-blue-500/30 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingUser ? 'Simpan Perubahan' : 'Tambah Pengguna'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
