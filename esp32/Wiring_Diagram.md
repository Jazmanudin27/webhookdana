# 🔌 Skema Wiring & Panduan Hardware ESP32 Depot Air DANA

Dokumen ini menjelaskan koneksi kabel (wiring) antara **ESP32 Dev Module** dengan komponen periferal sistem depot air isi ulang.

---

## 📌 Tabel Pinout ESP32

| Komponen Hardware | Pin ESP32 | Tipe Pin | Keterangan |
| :--- | :--- | :--- | :--- |
| **Water Flow Sensor (YF-S201)** | `GPIO 18` | Digital Input (Interrupt) | Kabel Kuning/Signal Sensor Flow |
| **Relay Solenoid Valve 12V** | `GPIO 26` | Digital Output | Pin IN pada Modul Relay (Active LOW) |
| **Active Buzzer 5V** | `GPIO 19` | Digital Output | Pin I/O / Positif (+) Buzzer |
| **Tombol Emergency Stop** | `GPIO 4` | Digital Input (Pull-Up) | Ke Push Button (satu kaki ke GND) |
| **LED Status Indikator** | `GPIO 2` | Digital Output | Built-in LED ESP32 / LED Eksternal |

---

## ⚡ Detail Rangkaian Kelistrikan

### 1. Water Flow Sensor (YF-S201 / YF-B5)
- **VCC (Kabel Merah)** ➡️ Hubungkan ke **5V / VIN** ESP32.
- **GND (Kabel Hitam)** ➡️ Hubungkan ke **GND** ESP32.
- **Signal (Kabel Kuning)** ➡️ Hubungkan ke **GPIO 18** ESP32.
> *Catatan:* Sangat disarankan menambahkan resistor pull-up 4.7kΩ – 10kΩ antara pin Signal dan 3.3V/5V jika pembacaan pulsa berfluktuasi.

### 2. Modul Relay Solenoid Valve (12V DC / 220V AC)
- **VCC Relay** ➡️ **5V / VIN** ESP32.
- **GND Relay** ➡️ **GND** ESP32.
- **IN Relay** ➡️ **GPIO 26** ESP32.
- **Terminal Relay (COM & NO)**:
  - **COM** ➡️ Kutub Positif Adaptor Power Supply Solenoid (12V DC).
  - **NO (Normally Open)** ➡️ Kabel Positif Solenoid Valve.
  - **GND 12V Adaptor** ➡️ Kabel Negatif Solenoid Valve.

### 3. Active Buzzer (5V / 3.3V)
- **Pin Positif (+ / I/O)** ➡️ **GPIO 19** ESP32.
- **Pin Negatif (- / GND)** ➡️ **GND** ESP32.

### 4. Tombol Darurat Manual (Emergency Push Button)
- **Kaki 1 Button** ➡️ **GPIO 4** ESP32.
- **Kaki 2 Button** ➡️ **GND** ESP32.
> Firmware sudah mengaktifkan internal `INPUT_PULLUP`, sehingga tidak memerlukan resistor eksternal tambahan.

---

## ⚙️ Kalibrasi Water Flow Sensor (YF-S201)

Sensitivitas dan jumlah pulsa per liter dapat berbeda sedikit tergantung tekanan pompa air depot:
1. Siapkan jerigen / galon ukur presisi (misal: 5 Liter atau 19 Liter).
2. Lakukan pengujian pengisian dan lihat pulsa di Serial Monitor:
   $$\text{Pulses Per Liter} = \frac{\text{Total Pulsa Terhitung}}{\text{Volume Air Aktual (Liter)}}$$
3. Ubah nilai variabel di `DepotAir_ESP32.ino`:
   ```cpp
   float PULSES_PER_LITER = 450.0; // Sesuaikan hasil uji coba Anda
   ```

---

## 📦 Persiapan Software Arduino IDE
1. Install **ESP32 Board Package** di Arduino IDE (`Tools > Board > Boards Manager > esp32 by Espressif`).
2. Install library **ArduinoJson** (`Sketch > Include Library > Manage Libraries > cari "ArduinoJson"`).
3. Pilih board: **ESP32 Dev Module**.
4. Ubah `WIFI_SSID`, `WIFI_PASSWORD`, dan `BASE_SERVER_URL` di sketch, lalu Upload!
