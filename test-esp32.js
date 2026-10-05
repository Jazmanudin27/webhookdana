// Script Simulator Perilaku Hardware ESP32
// Menjalankan polling /api/esp32/check-order, mendeteksi PAID, menghitung flow simulasi, lalu POST /api/esp32/finish-fill
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3005';
const NOZZLE_ID = process.env.NOZZLE_ID || 1;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulateEsp32() {
  console.log(`🤖 [ESP32 SIMULATOR] Mulai polling ke server: ${BASE_URL} (Kran / Nozzle #${NOZZLE_ID})`);
  console.log('📡 Tekan Ctrl+C untuk berhenti.\n');

  while (true) {
    try {
      // 1. Polling check-order
      const checkRes = await axios.get(`${BASE_URL}/api/esp32/check-order?nozzleId=${NOZZLE_ID}`);
      const { status, orderId, targetLiter } = checkRes.data;

      if (status === 'PAID') {
        console.log(`\n🎉 [ESP32] Transaksi Ditemukan: ${orderId} | Target: ${targetLiter} Liter`);
        console.log('🔊 [Buzzer] BEEP 1x! (Mulai)');
        console.log('🚰 [Relay GPIO 26] Solenoid DIBUKA (Active LOW -> ON)');

        // Simulasi pengisian air
        const litersToFill = Number(targetLiter) || 19;
        let currentLiters = 0;
        const startTime = Date.now();

        console.log('⏳ [Flow Sensor GPIO 18] Menghitung pulsa aliran air...');
        while (currentLiters < litersToFill) {
          await sleep(500);
          currentLiters += 2.0; // simulasi debit air
          if (currentLiters > litersToFill) currentLiters = litersToFill;
          
          console.log(`💧 Air Mengalir: ${currentLiters.toFixed(1)} / ${litersToFill} Liter (Pulsa: ${Math.round(currentLiters * 450)})`);

          // Kirim telemetri live
          try {
            await axios.post(`${BASE_URL}/api/esp32/telemetry`, {
              orderId,
              currentLiter: currentLiters,
              pulses: Math.round(currentLiters * 450)
            });
          } catch (e) {}
        }

        console.log('✅ [ESP32] Target Liter Tercapai!');
        console.log('🚰 [Relay GPIO 26] Solenoid DITUTUP (OFF)');
        console.log('🔊 [Buzzer] BEEP 4x! (Pengisian Selesai)');

        // Kirim finish-fill callback
        const durationSec = Math.round((Date.now() - startTime) / 1000);
        const finishRes = await axios.post(`${BASE_URL}/api/esp32/finish-fill`, {
          orderId,
          dispensedLiter: currentLiters,
          durationSeconds: durationSec,
          status: 'COMPLETED'
        });

        console.log('📤 [ESP32] Callback Finish Fill Terkirim:', finishRes.data);
        console.log('💤 [ESP32] Kembali ke mode standby (IDLE).\n');
      } else {
        process.stdout.write(`\r[ESP32] Standby IDLE... Server Time: ${new Date().toLocaleTimeString('id-ID')}   `);
      }
    } catch (error) {
      console.error('\n⚠️ [ESP32] Error polling server:', error.message);
    }

    await sleep(2000); // Polling setiap 2 detik
  }
}

simulateEsp32();
