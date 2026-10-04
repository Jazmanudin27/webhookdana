import React, { useState, useEffect, useMemo } from 'react';
import { Droplet, Activity, Zap, ShieldAlert, Sparkles, Volume2, CheckCircle, Clock, Gauge, Play, Pause } from 'lucide-react';

export default function WaterDispenserVisualizer({ 
  systemState, 
  telemetry, 
  onEmergencyStop,
  selectedMachineId = 'DEPOT-001',
  selectedMachine = null
}) {
  const isPaid = systemState?.status === 'PAID';
  const isFilling = systemState?.status === 'FILLING';
  const isPaused = systemState?.status === 'PAUSED';
  const isIdle = systemState?.status === 'IDLE';
  const isStopped = systemState?.status === 'EMERGENCY_STOP' || systemState?.status === 'STOPPED';

  const [isToggling, setIsToggling] = useState(false);
  const [lastToggleTime, setLastToggleTime] = useState(0);

  const handleToggleWater = async () => {
    const now = Date.now();
    if (now - lastToggleTime < 800 || isToggling) return;
    setLastToggleTime(now);

    try {
      setIsToggling(true);
      await fetch('/api/dispenser/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'TOGGLE',
          deviceId: selectedMachineId || 'DEPOT-001'
        })
      });
    } catch (err) {
      console.error('Failed to toggle dispenser:', err);
    } finally {
      setTimeout(() => setIsToggling(false), 500);
    }
  };

  const handleFinishEarly = async () => {
    if (isToggling) return;
    try {
      setIsToggling(true);
      await fetch('/api/dispenser/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'FINISH_EARLY',
          deviceId: selectedMachineId || 'DEPOT-001'
        })
      });
    } catch (err) {
      console.error('Failed to finish early:', err);
    } finally {
      setTimeout(() => setIsToggling(false), 500);
    }
  };

  const targetLiter = Number(systemState?.activeOrder?.targetLiter) || (isPaid ? 19 : 0);
  const currentLiter = Number(telemetry?.currentLiter) || 0;
  
  // Calculate percentage
  const percentage = targetLiter > 0 
    ? Math.min(100, Math.round((currentLiter / targetLiter) * 100))
    : (isPaid ? 4 : 0);

  // Generate random bubbles when filling
  const bubbles = useMemo(() => {
    return Array.from({ length: 10 }).map((_, i) => ({
      id: i,
      left: `${15 + (i * 7) % 70}%`,
      size: `${3 + (i % 4) * 2}px`,
      delay: `${(i * 0.3) % 2}s`,
      duration: `${1.5 + (i % 3) * 0.4}s`
    }));
  }, []);

  return (
    <div className={`rounded-2xl p-3 sm:p-4 relative overflow-hidden transition-all duration-500 ${
      isFilling 
        ? 'glass-card-glow border-cyan-500/40 shadow-xl shadow-cyan-950/50' 
        : isPaid 
        ? 'glass-card-emerald' 
        : 'glass-card'
    }`}>
      {/* Dynamic Ambient Background Glows */}
      <div className={`absolute -top-24 -left-24 w-60 h-60 rounded-full blur-[80px] pointer-events-none transition-all duration-1000 ${
        isFilling ? 'bg-cyan-500/25' : isPaid ? 'bg-emerald-500/20' : 'bg-blue-600/10'
      }`} />
      <div className={`absolute -bottom-24 -right-24 w-60 h-60 rounded-full blur-[80px] pointer-events-none transition-all duration-1000 ${
        isFilling ? 'bg-blue-500/25' : isPaid ? 'bg-cyan-500/20' : 'bg-purple-600/10'
      }`} />

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 mb-2.5 pb-2 border-b border-slate-800/80 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-500 shrink-0 ${
            isFilling 
              ? 'bg-gradient-to-tr from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-500/40 animate-pulse' 
              : isPaid 
              ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-md shadow-emerald-500/30' 
              : 'bg-slate-900 border border-slate-800 text-slate-400'
          }`}>
            <Droplet className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-black text-white tracking-tight">
                Smart Water Dispenser
              </h2>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300">
                {selectedMachine?.name ? `${selectedMachine.name} (${selectedMachineId})` : selectedMachineId}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 ${
                isFilling 
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' 
                  : isPaid 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse' 
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isFilling ? 'bg-cyan-400 animate-ping' : isPaid ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                {systemState?.status || 'IDLE'}
              </span>
            </div>
          </div>
        </div>

        {/* Emergency Stop Button */}
        {(isFilling || isPaid) && (
          <button
            onClick={onEmergencyStop}
            className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/30 transition-all shrink-0 cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">EMERGENCY STOP</span>
          </button>
        )}
      </div>

      {/* Main Interactive Visualizer Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center relative z-10">
        
        {/* Left Column: 3D High-Tech Water Galon Cylinder */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          
          {/* Top Dispenser Nozzle / Faucet */}
          <div className="relative flex flex-col items-center">
            <div className="w-12 h-2.5 bg-gradient-to-r from-slate-700 via-slate-500 to-slate-700 rounded-t shadow-sm" />
            <div className="w-5 h-3 bg-slate-600 border-x border-slate-500 relative flex items-center justify-center">
              {isFilling && (
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              )}
            </div>
            {/* Water Stream Nozzle Effect */}
            {isFilling && (
              <div className="w-1.5 h-5 bg-gradient-to-b from-cyan-300 via-blue-400 to-cyan-200 animate-pulse shadow-[0_0_10px_rgba(56,189,248,0.8)] z-20" />
            )}
          </div>

          {/* Main 3D Water Tank Body */}
          <div className="relative w-44 h-56 bg-gradient-to-b from-slate-900/90 to-slate-950/95 rounded-[24px] border-2 border-slate-700/80 p-1.5 shadow-xl flex flex-col justify-end overflow-hidden backdrop-blur-md">
            
            {/* Glossy Glass Reflection Overlay */}
            <div className="absolute top-0 left-2 w-4 h-full bg-gradient-to-r from-white/10 to-transparent pointer-events-none z-30 rounded-l-xl" />
            <div className="absolute top-0 right-2 w-2 h-full bg-gradient-to-l from-white/5 to-transparent pointer-events-none z-30 rounded-r-xl" />

            {/* Scale Measurement Hash Lines */}
            <div className="absolute right-2 top-4 bottom-4 flex flex-col justify-between text-[9px] font-mono text-slate-500 z-20 pointer-events-none select-none">
              <span className="flex items-center gap-0.5 font-bold text-slate-400"><span className="w-1.5 h-[1px] bg-slate-500 inline-block"/> {targetLiter || 19}L</span>
              <span className="flex items-center gap-0.5"><span className="w-1 h-[1px] bg-slate-600 inline-block"/> {((targetLiter || 19) * 0.5).toFixed(0)}L</span>
              <span className="flex items-center gap-0.5 font-bold text-slate-500"><span className="w-1.5 h-[1px] bg-slate-500 inline-block"/> 0L</span>
            </div>

            {/* Rising Bubbles inside Water */}
            {isFilling && bubbles.map(b => (
              <div
                key={b.id}
                className="bubble z-20"
                style={{
                  left: b.left,
                  width: b.size,
                  height: b.size,
                  animationDelay: b.delay,
                  animationDuration: b.duration
                }}
              />
            ))}

            {/* Water Liquid Body */}
            <div 
              className="w-full water-fill-gradient rounded-xl relative transition-all duration-700 ease-out flex items-center justify-center overflow-hidden shadow-[inset_0_2px_12px_rgba(255,255,255,0.3)]"
              style={{ height: `${Math.max(percentage, isPaid ? 8 : 4)}%` }}
            >
              {/* Animated Wave Surface */}
              {isFilling && (
                <div className="absolute -top-1.5 left-0 right-0 h-3 bg-cyan-200/50 rounded-full animate-wave" />
              )}
            </div>

            {/* Center Digital Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-30 pointer-events-none">
              <div className="bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 shadow-xl flex flex-col items-center">
                <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400 font-mono tracking-tight">
                  {currentLiter.toFixed(1)} <span className="text-xs font-semibold text-slate-400 font-sans">/ {targetLiter} L</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-[10px] font-extrabold text-cyan-200 font-mono">
                    {percentage}% TERISI
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] font-semibold text-slate-400 mt-2 font-mono bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-slate-800">
            📦 {systemState?.activeOrder?.title || 'Galon 19 Liter'}
          </div>
        </div>

        {/* Right Column: Hardware Telemetry HUD Gauges */}
        <div className="lg:col-span-7 space-y-2.5">
          
          {/* Active Order Card & Dynamic Colored Button */}
          {(systemState?.activeOrder || isPaid || isFilling || isPaused) ? (
            <div className={`p-3 rounded-xl border space-y-2 shadow-lg relative overflow-hidden transition-all duration-300 ${
              isFilling 
                ? 'bg-gradient-to-r from-slate-900 via-emerald-950/30 to-slate-900 border-emerald-500/40' 
                : 'bg-gradient-to-r from-slate-900 via-rose-950/30 to-slate-900 border-rose-500/40'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                  isFilling ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  <Sparkles className="w-3 h-3" /> Transaksi Sedang Berjalan
                </span>
                <span className="text-[10px] font-mono text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {systemState?.activeOrder?.orderId || 'DANA-ACTIVE'}
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <h3 className="text-sm sm:text-base font-black text-white tracking-tight">
                  {systemState?.activeOrder?.title || 'Isi Ulang Galon 19 Liter'}
                </h3>
                <span className="text-lg font-black text-emerald-400 font-mono">
                  Rp {Number(systemState?.activeOrder?.amount || 7000).toLocaleString('id-ID')}
                </span>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
                <span>Pelanggan: <strong className="text-white">{systemState?.activeOrder?.customerName || 'Pelanggan Depot'}</strong></span>
                <span>Waktu: <strong className="text-cyan-300 font-mono">{new Date(systemState?.activeOrder?.paidAt || Date.now()).toLocaleTimeString('id-ID')}</strong></span>
              </div>

              {/* TOMBOL WARNA DINAMIS: MERAH (SIAP/JEDA) <---> HIJAU (MENGUCUR) */}
              <div className="pt-1">
                {isFilling ? (
                  <button
                    type="button"
                    onClick={handleToggleWater}
                    disabled={isToggling}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:scale-[0.98] text-white font-black text-xs sm:text-sm shadow-md ring-2 ring-emerald-400/40 border border-emerald-300/40 flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                      <Pause className="w-4 h-4 fill-current" />
                      <span className="tracking-wide">🟢 TOMBOL HIJAU: AIR SEDANG MENGUCUR</span>
                    </div>
                    <span className="text-[10px] font-medium text-emerald-100 opacity-90">
                      Klik / Tekan Tombol D32 di ESP32 untuk JEDA (PAUSE)
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleToggleWater}
                    disabled={isToggling}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-600 active:scale-[0.98] text-white font-black text-xs sm:text-sm shadow-md ring-2 ring-rose-500/40 border border-rose-300/40 animate-pulse flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-white" />
                      <Play className="w-4 h-4 fill-current" />
                      <span className="tracking-wide">
                        {isPaused ? '🔴 TOMBOL MERAH: AIR DIJEDA' : '🔴 TOMBOL MERAH: SUDAH BAYAR & SIAP'}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-rose-100 opacity-90">
                      Klik / Tekan Tombol D32 di ESP32 untuk {isPaused ? 'LANJUTKAN AIR' : 'MULAI KUCURKAN AIR'}
                    </span>
                  </button>
                )}

                {/* Tombol Selesaikan Lebih Awal & Indikator Auto-Timeout saat Jeda */}
                {isPaused && (
                  <div className="pt-1.5 space-y-1.5">
                    <button
                      type="button"
                      onClick={handleFinishEarly}
                      disabled={isToggling}
                      className="w-full py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Selesaikan Pengisian (Galon Penuh di {currentLiter.toFixed(1)}L)</span>
                    </button>
                    
                    <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px] font-medium flex items-center justify-center gap-1 text-center">
                      <Clock className="w-3 h-3 shrink-0 animate-pulse text-amber-400" />
                      <span>
                        Auto-Timeout: Pesanan selesai otomatis dlm <strong>{telemetry?.pauseRemaining ? `${telemetry.pauseRemaining}s` : '60s'}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 text-center">
              <p className="text-xs font-medium text-slate-300">
                Depot dalam keadaan <strong className="text-cyan-400 font-bold">STANDBY</strong>
              </p>
            </div>
          )}

          {/* 3 Hardware HUD Cards */}
          <div className="grid grid-cols-3 gap-2">
            {/* Card 1: Solenoid Valve */}
            <div className={`p-2 rounded-xl border transition-all ${
              isFilling 
                ? 'bg-cyan-950/40 border-cyan-500/60 shadow-sm' 
                : 'bg-slate-900/60 border-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-400">Solenoid</span>
                <Zap className={`w-3 h-3 ${isFilling ? 'text-cyan-400 animate-pulse' : 'text-slate-600'}`} />
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${isFilling ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'}`} />
                <span className={`text-xs font-black font-mono ${isFilling ? 'text-cyan-300' : 'text-slate-400'}`}>
                  {isFilling ? 'OPEN' : 'CLOSED'}
                </span>
              </div>
            </div>

            {/* Card 2: Flow Sensor */}
            <div className={`p-2 rounded-xl border transition-all ${
              isFilling 
                ? 'bg-blue-950/40 border-blue-500/60 shadow-sm' 
                : 'bg-slate-900/60 border-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-400">Flow</span>
                <Gauge className={`w-3 h-3 ${isFilling ? 'text-blue-400 animate-spin' : 'text-slate-600'}`} />
              </div>
              <div className="text-xs font-black font-mono text-white">
                {telemetry?.flowRate ? telemetry.flowRate.toFixed(1) : (isFilling ? '4.8' : '0.0')} <span className="text-[9px] text-slate-400 font-normal">L/m</span>
              </div>
            </div>

            {/* Card 3: Buzzer Alert */}
            <div className="p-2 rounded-xl border bg-slate-900/60 border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-400">Buzzer</span>
                <Volume2 className={`w-3 h-3 ${isFilling ? 'text-emerald-400' : 'text-slate-600'}`} />
              </div>
              <div className="text-xs font-black font-mono text-slate-200">
                {isFilling ? '1x Mulai' : percentage >= 100 ? '4x Selesai' : 'Standby'}
              </div>
            </div>
          </div>

          {/* Polling Health bar */}
          <div className="bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${systemState?.esp32Status === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-slate-300 font-medium">
                ESP32: <strong className="text-cyan-400 font-mono">ONLINE</strong>
              </span>
            </div>
            <span className="text-slate-400 font-mono text-[10px]">
              IP: {systemState?.esp32Ip || '192.168.x.x'}
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
