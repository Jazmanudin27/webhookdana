import React, { useState } from 'react';
import { Lock, User, Key, ShieldCheck, Sparkles, X, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!isOpen) return null;

  const handleLogin = async (e, customUser = null, customPass = null) => {
    if (e) e.preventDefault();
    const u = customUser || username;
    const p = customPass || password;

    if (!u || !p) {
      setErrorMsg('Username dan Password wajib diisi');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      });
      const data = await res.json();

      if (data.success && data.token) {
        localStorage.setItem('depot_auth_token', data.token);
        if (onLoginSuccess) {
          onLoginSuccess(data.user, data.token);
        }
        onClose();
      } else {
        setErrorMsg(data.message || 'Login gagal! Periksa username & password.');
      }
    } catch (err) {
      setErrorMsg('Gagal terhubung ke server: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (role) => {
    if (role === 'admin') {
      setUsername('admin');
      setPassword('admin123');
      handleLogin(null, 'admin', 'admin123');
    } else {
      setUsername('mitra1');
      setPassword('123456');
      handleLogin(null, 'mitra1', '123456');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="glass-card max-w-md w-full p-6 sm:p-8 rounded-3xl border border-slate-800 relative shadow-2xl overflow-hidden">
        
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-44 h-44 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-2xl bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800 transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#118EEA] to-cyan-400 p-0.5 shadow-xl shadow-blue-500/30">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Lock className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Login Pengguna
            </h2>
            <p className="text-xs text-slate-400">
              Super Admin Pusat & Klien Pemilik Cabang
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              Username
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: admin atau mitra1"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-white text-sm focus:outline-none focus:border-cyan-500 transition-all font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-white text-sm focus:outline-none focus:border-cyan-500 transition-all font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-[#118EEA] to-cyan-500 text-white font-black text-sm shadow-xl shadow-blue-500/25 hover:from-blue-600 hover:to-cyan-400 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{loading ? 'Memeriksa Kredensial...' : 'Masuk ke Dashboard'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Demo Fast Login Presets */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 text-center">
            ⚡ Quick Demo Akses Cepat:
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleQuickDemo('admin')}
              className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition-all group cursor-pointer"
            >
              <div className="text-xs font-black text-cyan-300 flex items-center gap-1">
                👑 Super Admin
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                Semua Cabang
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemo('mitra')}
              className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition-all group cursor-pointer"
            >
              <div className="text-xs font-black text-emerald-300 flex items-center gap-1">
                👤 Klien Mitra
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                Khusus Cabang 1
              </div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
