/*
  ===========================================================================================
  PROYEK   : DEPOT AIR ISI ULANG OTOMATIS - DANA.ASPARTECH.COM
  HARDWARE : ESP32 Dev Module (WROOM-32)
  PINOUT   :
    - GPIO 34 (D34) : Water Flow Sensor YF-S201 (Kabel Sinyal Kuning)
    - GPIO 26 (D26) : Relay Solenoid Valve 12V (IN Relay - Active LOW)
    - GPIO 32 (D32) : Tombol Kucur Air / Jeda  -> NO tombol ke D32, C tombol ke GND (NC kosong)
    - GPIO 33 (D33) : LED Tombol 12V via Transistor NPN (D33 -> 1k -> Basis)
                      * Berkedip  : Siap (sudah bayar) / Dijeda
                      * Nyala     : Air mengucur
                      * Mati      : Standby
    - GPIO 25 (D25) : Buzzer (I/O / + buzzer ke D25, VCC ke 3V3, GND ke GND)
    - GPIO 2  (D2)  : Built-in Blue LED ESP32

  ARSITEKTUR:
    - Core 1 (loop)    : Tombol, relay, LED, buzzer, flow sensor -> RESPON INSTAN
    - Core 0 (netTask) : Semua koneksi HTTPS ke server (polling & laporan selesai)
                         -> koneksi lambat TIDAK LAGI membuat tombol telat
  ===========================================================================================
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <WebServer.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

Preferences preferences;

// ==========================================================
// 1. DEFAULT KONFIGURASI WIFI, ID MESIN & SERVER CLOUD
// ==========================================================
// ID Unik Mesin Depot (Bisa diubah lewat Hotspot HP di lapangan atau default di sini)
String DEVICE_ID = "DEPOT-001";
const char* DEVICE_API_KEY = "DEPOT_IOT_KEY_2026"; // API Key Keamanan ESP32 ke Cloud

String wifi_ssid     = "Jihan";        // SSID WiFi Router
String wifi_password = "Tasikmalaya";  // Password WiFi Router

const char* BASE_SERVER_URL = "https://dana.aspartech.com";

// Endpoint API
String urlCheckOrder = String(BASE_SERVER_URL) + "/api/esp32/check-order";
String urlFinishFill = String(BASE_SERVER_URL) + "/api/esp32/finish-fill";

// Hotspot Darurat jika WiFi gagal connect
const char* AP_SSID = "ESP32_Depot_Air";
const char* AP_PASS = "12345678";
WebServer apServer(80);
volatile bool isApMode = false;
bool shouldRestart = false;
unsigned long restartTimer = 0;

// ==========================================================
// 2. PENETAPAN PIN ESP32
// ==========================================================
const int RELAY_PIN       = 26; // Relay Solenoid Valve 12V (D26)
const int BLUE_LED_PIN    = 2;  // LED Indikator Built-in (D2)
const int BUTTON_PIN      = 32; // Tombol Kucur Air / Jeda (D32) - NO ke D32, C ke GND
const int BUTTON_LED_PIN  = 33; // LED Tombol 12V via Transistor NPN (D33)
const int FLOW_SENSOR_PIN = 34; // Sinyal Kuning Sensor Flow YF-S201 (D34)
const int BUZZER_PIN      = 25; // Buzzer (D25)

// Logika Relay Solenoid Valve (Active HIGH: HIGH = Buka Keran, LOW = Tutup Keran)
// Jika relay Anda kebalik (saat bayar langsung buka), ubah flag ini (true <-> false)
const bool RELAY_ACTIVE_LOW = false; 
const int RELAY_ON  = RELAY_ACTIVE_LOW ? LOW  : HIGH;
const int RELAY_OFF = RELAY_ACTIVE_LOW ? HIGH : LOW;

// Logika LED Tombol via Transistor NPN (HIGH = transistor ON = LED nyala)
const int BTN_LED_ON  = HIGH;
const int BTN_LED_OFF = LOW;

// ----------------------------------------------------------
// LOGIKA BUZZER
// ----------------------------------------------------------
// false = Buzzer bunyi saat pin HIGH (buzzer 2 kaki / modul High Level Trigger)
// true  = Buzzer bunyi saat pin LOW  (modul 3 pin "Low Level Trigger")
//
// Kalau buzzer BUNYI TERUS TANPA HENTI -> ganti kebalikannya (true <-> false).
// Kalau sudah diganti dua-duanya tetap bunyi terus -> pindahkan VCC buzzer dari 5V ke 3V3.
const bool BUZZER_ACTIVE_LOW = false;
const int  BUZZER_ON  = BUZZER_ACTIVE_LOW ? LOW  : HIGH;
const int  BUZZER_OFF = BUZZER_ACTIVE_LOW ? HIGH : LOW;

// ==========================================================
// 3. VARIABEL FLOW SENSOR & SISTEM
// ==========================================================
volatile bool isWaitingButton = false; // Order DANA sudah lunas, menunggu tombol
volatile bool isFilling       = false; // Air sedang mengucur (Solenoid ON)
volatile bool isPaused        = false; // Pengisian dijeda sementara (Solenoid OFF)

volatile unsigned long currentFillMl = 0;
unsigned long targetFillMl  = 0;
unsigned long totalAccumulatedMl = 0;
String currentOrderId = "";
String lastFinishedOrderId = "";   // Cegah order yang sudah selesai diproses ulang

// Timeout Otomatis saat Jeda (60 Detik)
volatile unsigned long pauseStartTime = 0;
const unsigned long PAUSE_TIMEOUT_MS = 60000;

// Timeout Otomatis jika Air Tidak Mengalir saat Keran Terbuka (30 Detik)
volatile unsigned long lastPulseTime = 0;
const unsigned long NO_FLOW_TIMEOUT_MS = 30000;

volatile unsigned int pulseCount = 0;
volatile float flowRate = 0.0;
unsigned long oldTime = 0;
const float calibrationFactor = 7.5; // YF-S201

const unsigned long POLL_INTERVAL = 1500; // Polling server setiap 1.5 detik

// Waktu terakhir status mesin berubah secara lokal (tombol / order / stop).
// Respon server dari request yang DIMULAI SEBELUM waktu ini dianggap basi & diabaikan,
// supaya perintah lama dari server tidak membalikkan aksi tombol fisik.
volatile unsigned long lastLocalActionTime = 0;
volatile bool pollNow = false;           // Minta netTask segera sinkron ke server
volatile bool netPaused = false;         // Hentikan netTask sementara (saat ganti WiFi)

// Hardware Interrupt & Debounce untuk Tombol D32
volatile bool buttonPressedFlag = false;
volatile unsigned long lastButtonInterruptTime = 0;

// Data bersama antar-core (dilindungi spinlock)
portMUX_TYPE stateMux = portMUX_INITIALIZER_UNLOCKED;
char sharedOrderId[64] = "";
char sharedDeviceId[40] = "";
char sharedSsid[64] = "";

// ----------------------------------------------------------
// ANTRIAN PESAN ANTAR-CORE
// ----------------------------------------------------------
enum NetCmdType : uint8_t {
    CMD_START_RESUME = 1,
    CMD_PAUSE,
    CMD_PAID,
    CMD_STOP,
    CMD_UPDATE_WIFI
};

struct NetCommand {
    uint8_t type;
    unsigned long requestStart;
    float targetLiter;
    char orderId[64];
    char ssid[64];
    char pass[64];
};

struct FinishMsg {
    float liter;
    char orderId[64];
    char deviceId[40];
    char statusStr[24];
};

QueueHandle_t cmdQueue;     // netTask -> loop
QueueHandle_t finishQueue;  // loop    -> netTask

// ==========================================================
// INTERRUPT
// ==========================================================
void IRAM_ATTR buttonISR() {
    unsigned long now = millis();
    if (now - lastButtonInterruptTime > 300) {
        buttonPressedFlag = true;
        lastButtonInterruptTime = now;
    }
}

void IRAM_ATTR pulseCounter() {
    pulseCount++;
}

// ==========================================================
// BUZZER NON-BLOCKING (tidak menghentikan program saat bunyi)
// ==========================================================
int buzzerBeepsLeft = 0;
int buzzerOnMs = 80;
int buzzerOffMs = 80;
bool buzzerIsOn = false;
unsigned long buzzerNextToggle = 0;

void buzzerOff() {
    digitalWrite(BUZZER_PIN, BUZZER_OFF);
    buzzerIsOn = false;
}

void triggerBuzzer(int beepCount, int durationMs = 80, int pauseMs = 80) {
    buzzerBeepsLeft = beepCount;
    buzzerOnMs = durationMs;
    buzzerOffMs = pauseMs;
    buzzerIsOn = false;
    buzzerNextToggle = millis(); // mulai sekarang
}

void updateBuzzer() {
    if (buzzerBeepsLeft <= 0 && !buzzerIsOn) return;
    unsigned long now = millis();
    if ((long)(now - buzzerNextToggle) < 0) return;

    if (buzzerIsOn) {
        digitalWrite(BUZZER_PIN, BUZZER_OFF);
        buzzerIsOn = false;
        buzzerBeepsLeft--;
        buzzerNextToggle = now + buzzerOffMs;
    } else if (buzzerBeepsLeft > 0) {
        digitalWrite(BUZZER_PIN, BUZZER_ON);
        buzzerIsOn = true;
        buzzerNextToggle = now + buzzerOnMs;
    }
}

// Versi blocking, hanya dipakai di setup() sebelum loop berjalan
void beepBlocking(int durationMs) {
    digitalWrite(BUZZER_PIN, BUZZER_ON);
    delay(durationMs);
    digitalWrite(BUZZER_PIN, BUZZER_OFF);
}

// ==========================================================
// LED TOMBOL D33
//  - Siap / Jeda   -> BERKEDIP
//  - Mengucur      -> NYALA TERUS
//  - Standby       -> MATI
// ==========================================================
void updateLeds() {
    bool blinkPhase = (millis() / 400) % 2 == 0;

    if (isWaitingButton || (isFilling && isPaused)) {
        digitalWrite(BUTTON_LED_PIN, blinkPhase ? BTN_LED_ON : BTN_LED_OFF);
        digitalWrite(BLUE_LED_PIN, blinkPhase ? HIGH : LOW);
    } else if (isFilling && !isPaused) {
        digitalWrite(BUTTON_LED_PIN, BTN_LED_ON);
        digitalWrite(BLUE_LED_PIN, HIGH);
    } else {
        digitalWrite(BUTTON_LED_PIN, BTN_LED_OFF);
        digitalWrite(BLUE_LED_PIN, WiFi.status() == WL_CONNECTED ? HIGH : LOW);
    }
}

// Tandai ada perubahan status lokal -> server langsung disinkronkan
void markLocalAction() {
    lastLocalActionTime = millis();
    pollNow = true;
}

void syncSharedStrings() {
    portENTER_CRITICAL(&stateMux);
    strlcpy(sharedOrderId, currentOrderId.c_str(), sizeof(sharedOrderId));
    strlcpy(sharedDeviceId, DEVICE_ID.c_str(), sizeof(sharedDeviceId));
    strlcpy(sharedSsid, wifi_ssid.c_str(), sizeof(sharedSsid));
    portEXIT_CRITICAL(&stateMux);
}

// ==========================================================
// 4. MEMUAT & MENYIMPAN KONFIGURASI (WIFI & DEVICE ID) DARI NVS
// ==========================================================
void loadStoredConfig() {
    preferences.begin("depot_wifi", false);
    String storedSSID = preferences.getString("ssid", "");
    String storedPASS = preferences.getString("pass", "");
    String storedDev  = preferences.getString("dev_id", "");
    preferences.end();

    if (storedSSID.length() > 0 && storedPASS.length() > 0) {
        wifi_ssid = storedSSID;
        wifi_password = storedPASS;
        Serial.print("📂 Membaca WiFi dari memori NVS ESP32: ");
        Serial.println(wifi_ssid);
    } else {
        Serial.println("ℹ️ Memakai konfigurasi default WiFi: " + wifi_ssid);
    }

    if (storedDev.length() > 0) {
        DEVICE_ID = storedDev;
        Serial.println("🏭 [NVS] Membaca Device ID dari Flash: " + DEVICE_ID);
    } else {
        Serial.println("ℹ️ Memakai Device ID default: " + DEVICE_ID);
    }
}

void saveConfigToNVS(String newSsid, String newPass, String newDevId = "") {
    preferences.begin("depot_wifi", false);
    preferences.putString("ssid", newSsid);
    preferences.putString("pass", newPass);
    if (newDevId.length() > 0) {
        newDevId.trim();
        newDevId.toUpperCase();
        preferences.putString("dev_id", newDevId);
        DEVICE_ID = newDevId;
    }
    preferences.end();

    wifi_ssid = newSsid;
    wifi_password = newPass;
    syncSharedStrings();

    Serial.println("\n💾 [NVS] Konfigurasi berhasil disimpan permanen ke memori Flash ESP32!");
    Serial.print("SSID Baru: "); Serial.println(newSsid);
    Serial.print("Device ID: "); Serial.println(DEVICE_ID);
}

void saveWiFiToNVS(String newSsid, String newPass) {
    saveConfigToNVS(newSsid, newPass, "");
}

// Encode karakter spesial (spasi, dll) agar URL tidak rusak
String urlEncode(const String& str) {
    String encoded = "";
    const char* hex = "0123456789ABCDEF";
    for (size_t i = 0; i < str.length(); i++) {
        char c = str.charAt(i);
        if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') {
            encoded += c;
        } else {
            encoded += '%';
            encoded += hex[(c >> 4) & 0x0F];
            encoded += hex[c & 0x0F];
        }
    }
    return encoded;
}

// ==========================================================
// 5. KONEKSI KE WIFI
// ==========================================================
bool connectToWiFi(int timeoutSeconds = 15) {
    Serial.println("\n-------------------------------------------------");
    Serial.print("[WIFI] Target SSID     : "); Serial.println(wifi_ssid);
    Serial.print("[WIFI] Target Password : "); Serial.println(wifi_password);
    Serial.println("-------------------------------------------------");
    Serial.flush();

    buzzerOff(); // Pastikan buzzer diam selama proses konek

    WiFi.persistent(false);
    WiFi.disconnect(true, true);
    delay(200);

    WiFi.mode(WIFI_STA);
    WiFi.setSleep(false); // Respon jaringan lebih cepat
    delay(200);

    WiFi.begin(wifi_ssid.c_str(), wifi_password.c_str());

    unsigned long startAttemptTime = millis();

    while (WiFi.status() != WL_CONNECTED && (millis() - startAttemptTime < (unsigned long)timeoutSeconds * 1000)) {
        delay(250);
        yield();
        Serial.print(".");
        Serial.flush();
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n[WIFI] SUKSES TERHUBUNG!");
        Serial.print("[WIFI] IP Address ESP32: "); Serial.println(WiFi.localIP());
        Serial.print("[WIFI] Sinyal RSSI     : "); Serial.print(WiFi.RSSI()); Serial.println(" dBm");

        digitalWrite(BLUE_LED_PIN, HIGH);
        triggerBuzzer(2, 80, 80);
        isApMode = false;
        return true;
    } else {
        Serial.println("\n[WIFI] Gagal terhubung!");
        digitalWrite(BLUE_LED_PIN, LOW);
        return false;
    }
}

// ==========================================================
// 6. HOTSPOT DARURAT / CAPTIVE PORTAL
// ==========================================================
void startEmergencyAP() {
    isApMode = true;
    WiFi.disconnect(true);
    delay(100);
    WiFi.mode(WIFI_AP);
    WiFi.softAP(AP_SSID, AP_PASS);

    Serial.println("\n⚠️ [MODE DARURAT] Membuka Hotspot Konfigurasi WiFi:");
    Serial.print("SSID Hotspot: "); Serial.println(AP_SSID);
    Serial.print("Password    : "); Serial.println(AP_PASS);
    Serial.print("Buka browser di HP ke: http://"); Serial.println(WiFi.softAPIP());

    apServer.on("/", []() {
        String html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'><title>Pengaturan Depot Air</title>"
                      "<style>body{font-family:sans-serif;background:#0f172a;color:#fff;padding:20px;text-align:center;}"
                      ".card{background:#1e293b;padding:24px;border-radius:16px;max-width:350px;margin:auto;text-align:left;}"
                      "h2{text-align:center;color:#38bdf8;margin-bottom:4px;}"
                      "p.sub{font-size:12px;color:#94a3b8;text-align:center;margin-bottom:20px;}"
                      "label{font-size:11px;color:#cbd5e1;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-top:10px;}"
                      "input{width:100%;padding:10px;margin:6px 0 10px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#fff;box-sizing:border-box;font-size:14px;}"
                      "button{background:#0284c7;color:#fff;border:none;padding:12px;width:100%;border-radius:8px;font-weight:bold;cursor:pointer;margin-top:14px;font-size:15px;}</style></head>"
                      "<body><div class='card'><h2>Setup Depot Air</h2><p class='sub'>Konfigurasi WiFi & Device ID Cabang</p>"
                      "<form action='/save' method='POST'>"
                      "<label>Nama WiFi (SSID):</label>"
                      "<input type='text' name='ssid' value='" + wifi_ssid + "' required>"
                      "<label>Password WiFi:</label>"
                      "<input type='password' name='pass' placeholder='Password WiFi'>"
                      "<label>Device ID Cabang (Unik):</label>"
                      "<input type='text' name='device_id' value='" + DEVICE_ID + "' required style='color:#38bdf8;font-weight:bold;text-transform:uppercase;'>"
                      "<button type='submit'>Simpan & Sambungkan</button></form></div></body></html>";
        apServer.send(200, "text/html", html);
    });

    apServer.on("/save", []() {
        if (apServer.hasArg("ssid")) {
            String s = apServer.arg("ssid");
            String p = apServer.hasArg("pass") ? apServer.arg("pass") : "";
            String d = apServer.hasArg("device_id") ? apServer.arg("device_id") : DEVICE_ID;
            d.trim();
            d.toUpperCase();
            saveConfigToNVS(s, p, d);

            String resp = "<html><body style='background:#0f172a;color:#fff;text-align:center;padding:40px;font-family:sans-serif;'>"
                          "<h2 style='color:#38bdf8;'>✅ Konfigurasi Tersimpan!</h2>"
                          "<p>Device ID: <strong>" + d + "</strong></p>"
                          "<p>WiFi: <strong>" + s + "</strong></p>"
                          "<p style='color:#94a3b8;'>ESP32 sedang me-restart untuk konek ke server...</p></body></html>";
            apServer.send(200, "text/html", resp);

            shouldRestart = true;
            restartTimer = millis();
        }
    });

    apServer.begin();
}

// ==========================================================
// 7. KONTROL TRANSAKSI & PENGISIAN AIR (CORE 1 - INSTAN)
// ==========================================================

// Menyiapkan order setelah DANA dibayar (status: PAID)
void prepareOrder(String orderId, float targetLiters) {
    currentOrderId = orderId;
    targetFillMl = (unsigned long)(targetLiters * 1000.0);
    currentFillMl = 0;
    isWaitingButton = true;
    isFilling = false;
    isPaused = false;
    syncSharedStrings();
    markLocalAction();

    digitalWrite(RELAY_PIN, RELAY_OFF); // Pastikan solenoid tertutup
    updateLeds();

    Serial.println("\n========================================================");
    Serial.println("📢 [PEMBAYARAN DANA BERHASIL DITERIMA]");
    Serial.printf("📦 Order ID   : %s\n", orderId.c_str());
    Serial.printf("🚰 Target Air : %.2f Liter\n", targetLiters);
    Serial.println("💡 LED TOMBOL BERKEDIP (D33) -> Siap");
    Serial.println("👉 Letakkan galon, lalu TEKAN TOMBOL (D32) untuk MULAI!");
    Serial.println("========================================================");

    triggerBuzzer(2, 120, 80);
}

// Laporan selesai dikirim lewat antrian -> diproses netTask di Core 0 (tidak memblokir)
void queueFinishReport(const char* statusStr) {
    FinishMsg msg;
    msg.liter = (float)currentFillMl / 1000.0;
    strlcpy(msg.statusStr, statusStr, sizeof(msg.statusStr));
    strlcpy(msg.orderId, currentOrderId.c_str(), sizeof(msg.orderId));
    strlcpy(msg.deviceId, DEVICE_ID.c_str(), sizeof(msg.deviceId));
    xQueueSend(finishQueue, &msg, 0);
}

void stopFilling(bool isFinishedSuccess = true) {
    digitalWrite(RELAY_PIN, RELAY_OFF); // Tutup keran DULUAN

    isFilling = false;
    isWaitingButton = false;
    isPaused = false;
    pauseStartTime = 0;
    updateLeds();

    float actualL = (float)currentFillMl / 1000.0;
    float targetL = (float)targetFillMl / 1000.0;
    float missingL = (targetL > actualL) ? (targetL - actualL) : 0.0f;

    char statusStr[24] = "COMPLETED";

    if (!isFinishedSuccess) {
        // Pembatalan manual dari web / Emergency stop
        strlcpy(statusStr, "EMERGENCY_STOP", sizeof(statusStr));
        Serial.println("\n🚨 [PENGISIAN DIHENTIKAN MANUAL / EMERGENCY]");
        triggerBuzzer(2, 250, 100);
    } else {
        // Otomatis selesai (Target tercapai / Timeout jeda / Timeout air mati)
        if (missingL <= 0.50f) {
            // Selisih <= 0.50 Liter -> DITERIMA SEBAGAI SELESAI LUNAS (COMPLETED)
            strlcpy(statusStr, "COMPLETED", sizeof(statusStr));
            Serial.printf("\n🎉🎉🎉 [PENGISIAN AIR SELESAI COMPLETED] Total: %.2fL (Selisih %.2fL <= 0.5L Toleransi OK) 🎉🎉🎉\n", actualL, missingL);
            triggerBuzzer(3, 120, 100);
        } else {
            // Selisih > 0.50 Liter -> DIANGGAP TERHENTI / INCOMPLETE
            strlcpy(statusStr, "INCOMPLETE", sizeof(statusStr));
            Serial.printf("\n⚠️ [PENGISIAN TERHENTI / KURANG INCOMPLETE] Total: %.2fL dari target %.2fL (Kurang %.2fL > 0.5L)\n", actualL, targetL, missingL);
            triggerBuzzer(4, 200, 100); // Alarm 4x bip panjang
        }
    }

    queueFinishReport(statusStr);

    lastFinishedOrderId = currentOrderId;
    currentOrderId = "";
    targetFillMl = 0;
    currentFillMl = 0;
    syncSharedStrings();
    markLocalAction();
}

// Handler Tombol (D32 & Perintah Web):
// 1. Siap      -> Tekan -> Buka Keran  (LED nyala terus)
// 2. Mengalir  -> Tekan -> Jeda        (LED berkedip)
// 3. Jeda      -> Tekan -> Lanjut      (LED nyala terus)
void handleButtonPress() {
    unsigned long now = millis();
    static unsigned long lastActionTime = 0;

    // Cooldown 400ms anti dobel klik
    if (now - lastActionTime < 400) {
        Serial.println("⚠️ [ANTI-BOUNCE] Dobel klik diabaikan.");
        return;
    }
    lastActionTime = now;

    // 1. Siap -> MULAI
    if (isWaitingButton) {
        digitalWrite(RELAY_PIN, RELAY_ON); // Buka Solenoid Valve SEKETIKA
        isWaitingButton = false;
        isFilling = true;
        isPaused = false;
        lastPulseTime = millis(); // Reset timer pendeteksi air mati
        updateLeds();
        markLocalAction();
        triggerBuzzer(1, 100);
        Serial.println("\n🟢 [TOMBOL] KERAN DIBUKA! Air mulai mengucur.");
        return;
    }

    // 2. Mengalir -> JEDA
    if (isFilling && !isPaused) {
        digitalWrite(RELAY_PIN, RELAY_OFF); // Tutup Solenoid Valve SEKETIKA
        isPaused = true;
        pauseStartTime = millis();
        updateLeds();
        markLocalAction();
        triggerBuzzer(2, 70, 60);
        Serial.println("\n⏸️ [TOMBOL] PENGISIAN DIJEDA.");
        Serial.printf("   Terisi: %.2f / %.2f Liter (batas jeda 60 detik)\n",
                      (float)currentFillMl / 1000.0, (float)targetFillMl / 1000.0);
        return;
    }

    // 3. Jeda -> LANJUT
    if (isFilling && isPaused) {
        digitalWrite(RELAY_PIN, RELAY_ON); // Buka Solenoid Valve SEKETIKA
        isPaused = false;
        pauseStartTime = 0;
        lastPulseTime = millis(); // Reset timer pendeteksi air mati
        updateLeds();
        markLocalAction();
        triggerBuzzer(1, 100);
        Serial.println("\n🟢 [TOMBOL] MELANJUTKAN PENGISIAN AIR!");
        return;
    }

    // 4. Standby
    Serial.println("ℹ️ Tombol D32 OK (Standby - silakan bayar via DANA terlebih dahulu).");
}

// Eksekusi perintah dari server (diterima dari netTask lewat antrian)
void processNetCommands() {
    NetCommand cmd;
    while (xQueueReceive(cmdQueue, &cmd, 0) == pdTRUE) {
        // Abaikan respon basi: request dimulai SEBELUM ada aksi lokal terbaru
        bool isStale = (long)(cmd.requestStart - lastLocalActionTime) < 0;

        switch (cmd.type) {
            case CMD_START_RESUME:
                if (!isStale && (isWaitingButton || (isFilling && isPaused))) {
                    Serial.println("🌐 [WEB] Perintah MULAI/LANJUT dari Dashboard");
                    handleButtonPress();
                }
                break;

            case CMD_PAUSE:
                if (!isStale && isFilling && !isPaused) {
                    Serial.println("🌐 [WEB] Perintah JEDA dari Dashboard");
                    handleButtonPress();
                }
                break;

            case CMD_PAID: {
                String orderId = String(cmd.orderId);
                if (!isStale && !isFilling && orderId.length() > 0 &&
                    orderId != currentOrderId && orderId != lastFinishedOrderId) {
                    prepareOrder(orderId, cmd.targetLiter);
                }
                break;
            }

            case CMD_STOP:
                if (!isStale && (isFilling || isWaitingButton)) {
                    if (isPaused) {
                        Serial.println("ℹ️ [CMD_STOP Diabaikan] Mesin sedang dalam status PAUSED lokal.");
                    } else {
                        Serial.println("\n🛑 [WEB EMERGENCY STOP] Pembatalan diterima dari Website!");
                        stopFilling(false);
                    }
                }
                break;

            case CMD_UPDATE_WIFI:
                Serial.println("\n⚡ [OTA CLOUD] Menerima Perintah Ganti WiFi dari Website!");
                netPaused = true;
                delay(300); // beri waktu netTask berhenti
                saveWiFiToNVS(String(cmd.ssid), String(cmd.pass));
                if (connectToWiFi(15)) {
                    Serial.println("🎉 Berhasil beralih ke WiFi baru!");
                    netPaused = false;
                } else {
                    startEmergencyAP();
                }
                break;
        }
    }
}

// ==========================================================
// 8. NETWORK TASK (CORE 0) - POLLING & TELEMETRY
// ==========================================================
unsigned long lastSuccessfulPollTime = 0;
int consecutivePollFailures = 0;

void sendFinishReport(const FinishMsg& msg) {
    WiFiClientSecure client;
    client.setInsecure();
    client.setTimeout(5); // 5 detik socket timeout

    HTTPClient http;
    http.setReuse(false);
    http.setTimeout(4000);

    if (http.begin(client, urlFinishFill)) {
        http.addHeader("Content-Type", "application/json");
        http.addHeader("X-Device-Key", DEVICE_API_KEY);
        http.addHeader("X-Device-Id", msg.deviceId);

        StaticJsonDocument<256> doc;
        doc["deviceId"]       = msg.deviceId;
        doc["orderId"]        = msg.orderId;
        doc["dispensedLiter"] = msg.liter;
        doc["status"]         = msg.statusStr;

        String jsonBody;
        serializeJson(doc, jsonBody);

        int code = http.POST(jsonBody);
        http.end();
        Serial.printf("📤 [NET] Laporan selesai terkirim [%s] (HTTP %d)\n", msg.statusStr, code);
    } else {
        Serial.println("⚠️ [NET] Gagal inisialisasi koneksi untuk kirim laporan selesai");
    }
    client.stop(); // Bersihkan SSL context secara tuntas & bebaskan buffer RAM mbedTLS!
}

void pollServer() {
    // Ambil snapshot status mesin
    String stateStr = "IDLE";
    if (isWaitingButton)            stateStr = "WAITING";
    else if (isFilling && isPaused) stateStr = "PAUSED";
    else if (isFilling)             stateStr = "FILLING";

    unsigned long pauseRemainingSec = 0;
    unsigned long pst = pauseStartTime;
    if (isFilling && isPaused && pst > 0) {
        unsigned long elapsed = millis() - pst;
        if (elapsed < PAUSE_TIMEOUT_MS) pauseRemainingSec = (PAUSE_TIMEOUT_MS - elapsed) / 1000;
    }

    char orderId[64], devId[40], ssid[64];
    portENTER_CRITICAL(&stateMux);
    strlcpy(orderId, sharedOrderId, sizeof(orderId));
    strlcpy(devId, sharedDeviceId, sizeof(devId));
    strlcpy(ssid, sharedSsid, sizeof(ssid));
    portEXIT_CRITICAL(&stateMux);

    String url = urlCheckOrder + "?deviceId=" + urlEncode(devId) +
                 "&ssid=" + urlEncode(ssid) +
                 "&state=" + stateStr +
                 "&currentLiter=" + String((float)currentFillMl / 1000.0, 2) +
                 "&flowRate=" + String((float)flowRate, 1) +
                 "&pauseRemaining=" + String(pauseRemainingSec);
    if (strlen(orderId) > 0) url += "&orderId=" + urlEncode(orderId);

    unsigned long requestStart = millis();

    WiFiClientSecure client;
    client.setInsecure();
    client.setTimeout(4); // 4 detik timeout soket anti macet

    HTTPClient http;
    http.setReuse(false);
    http.setTimeout(4000);

    if (!http.begin(client, url)) {
        Serial.println("⚠️ [NET] Gagal inisialisasi begin HTTP GET");
        client.stop();
        consecutivePollFailures++;
        return;
    }

    http.addHeader("X-Device-Key", DEVICE_API_KEY);
    http.addHeader("X-Device-Id", devId);

    int httpCode = http.GET();

    if (httpCode == HTTP_CODE_OK) {
        lastSuccessfulPollTime = millis();
        consecutivePollFailures = 0;

        String payload = http.getString();
        StaticJsonDocument<512> doc;
        if (!deserializeJson(doc, payload)) {
            const char* status = doc["status"];
            if (status) {
                NetCommand cmd;
                memset(&cmd, 0, sizeof(cmd));
                cmd.requestStart = requestStart;

                if (strcmp(status, "UPDATE_WIFI") == 0) {
                    cmd.type = CMD_UPDATE_WIFI;
                    strlcpy(cmd.ssid, doc["wifiSsid"] | "", sizeof(cmd.ssid));
                    strlcpy(cmd.pass, doc["wifiPassword"] | "", sizeof(cmd.pass));
                } else if (strcmp(status, "START") == 0 || strcmp(status, "RESUME") == 0) {
                    cmd.type = CMD_START_RESUME;
                } else if (strcmp(status, "PAUSE") == 0) {
                    cmd.type = CMD_PAUSE;
                } else if (strcmp(status, "PAID") == 0) {
                    cmd.type = CMD_PAID;
                    strlcpy(cmd.orderId, doc["orderId"] | "", sizeof(cmd.orderId));
                    cmd.targetLiter = doc["targetLiter"] | 0.0f;
                } else if (strcmp(status, "EMERGENCY_STOP") == 0 || strcmp(status, "STOP") == 0) {
                    cmd.type = CMD_STOP;
                } else if (strcmp(status, "IDLE") == 0) {
                    // Hanya set STOP jika tidak sedang dijeda lokal
                    if (!isPaused) {
                        cmd.type = CMD_STOP;
                    }
                }

                if (cmd.type != 0) xQueueSend(cmdQueue, &cmd, 0);
            }
        }
    } else {
        consecutivePollFailures++;
        if (httpCode < 0) {
            Serial.printf("⚠️ [NET] Polling gagal: %s (gagal ke-%d)\n", http.errorToString(httpCode).c_str(), consecutivePollFailures);
        } else {
            Serial.printf("⚠️ [NET] Polling HTTP %d (gagal ke-%d)\n", httpCode, consecutivePollFailures);
        }
    }

    http.end();
    client.stop(); // Bersihkan socket dan bebaskan memori mbedtls
}

void netTask(void* param) {
    unsigned long lastPoll = 0;
    lastSuccessfulPollTime = millis();

    for (;;) {
        if (isApMode || netPaused) {
            vTaskDelay(pdMS_TO_TICKS(200));
            continue;
        }

        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("⚠️ [NET] WiFi terputus, mencoba koneksi ulang...");
            WiFi.disconnect();
            WiFi.reconnect();
            vTaskDelay(pdMS_TO_TICKS(3000));
            continue;
        }

        // 1. Prioritas: kirim laporan selesai jika ada
        FinishMsg msg;
        while (xQueueReceive(finishQueue, &msg, 0) == pdTRUE) {
            sendFinishReport(msg);
            vTaskDelay(pdMS_TO_TICKS(100)); // Jeda 100ms agar port TCP/SSL bersih
        }

        // 2. Polling rutin / segera jika ada aksi lokal
        if (pollNow || millis() - lastPoll >= POLL_INTERVAL) {
            pollNow = false;
            lastPoll = millis();
            pollServer();
        }

        // 3. AUTO-RECOVERY ANTI CABUT COLOKAN:
        // Jika tidak ada respon server > 35 detik saat standby, restart koneksi WiFi secara otomatis!
        if (millis() - lastSuccessfulPollTime > 35000 && !isFilling) {
            Serial.println("🚨 [NET RECOVERY] 35 detik tanpa respon server, reset WiFi otomatis...");
            WiFi.disconnect();
            vTaskDelay(pdMS_TO_TICKS(1000));
            WiFi.reconnect();
            lastSuccessfulPollTime = millis();
        }

        vTaskDelay(pdMS_TO_TICKS(20));
    }
}

// ==========================================================
// 9. SETUP
// ==========================================================
void setup() {
    // Matikan brownout detector agar tidak reset saat lonjakan arus WiFi
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

    // Set level aman SEBELUM pinMode agar relay & buzzer tidak "nyentak" saat boot
    digitalWrite(RELAY_PIN, RELAY_OFF);
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, RELAY_OFF);

    digitalWrite(BUZZER_PIN, BUZZER_OFF);
    pinMode(BUZZER_PIN, OUTPUT);
    digitalWrite(BUZZER_PIN, BUZZER_OFF);

    pinMode(BUTTON_LED_PIN, OUTPUT);
    digitalWrite(BUTTON_LED_PIN, BTN_LED_OFF);

    pinMode(BLUE_LED_PIN, OUTPUT);
    digitalWrite(BLUE_LED_PIN, LOW);

    Serial.begin(115200);
    delay(500);

    Serial.println("\n=================================================");
    Serial.println("💧 ESP32 DEPOT AIR OTOMATIS - DANA.ASPARTECH.COM");
    Serial.println("=================================================");

    // Tes hardware: 1x bip pendek + LED tombol nyala sebentar
    Serial.println("🔧 Tes buzzer (1x bip pendek) & LED tombol D33...");
    digitalWrite(BUTTON_LED_PIN, BTN_LED_ON);
    beepBlocking(100);
    delay(200);
    digitalWrite(BUTTON_LED_PIN, BTN_LED_OFF);

    loadStoredConfig();
    Serial.println("🏭 ID MESIN / CABANG : " + DEVICE_ID);
    syncSharedStrings();

    // Tombol D32: INPUT_PULLUP + Hardware Interrupt (FALLING ke GND)
    pinMode(BUTTON_PIN, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), buttonISR, FALLING);

    pinMode(FLOW_SENSOR_PIN, INPUT);
    attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), pulseCounter, FALLING);

    cmdQueue    = xQueueCreate(6, sizeof(NetCommand));
    finishQueue = xQueueCreate(6, sizeof(FinishMsg));

    if (!connectToWiFi(15)) {
        startEmergencyAP();
    }

    // Jalankan semua urusan jaringan di Core 0
    xTaskCreatePinnedToCore(netTask, "netTask", 12288, NULL, 1, NULL, 0);

    oldTime = millis();
    updateLeds();
}

// ==========================================================
// 10. LOOP UTAMA (CORE 1) - TIDAK ADA KONEKSI INTERNET DI SINI
// ==========================================================
void loop() {
    if (shouldRestart && (millis() - restartTimer >= 1000)) {
        ESP.restart();
    }

    updateBuzzer();

    if (isApMode) {
        apServer.handleClient();
        return;
    }

    // 1. Tombol fisik D32 -> diproses SEKETIKA
    if (buttonPressedFlag) {
        buttonPressedFlag = false;
        handleButtonPress();
    }

    // 2. Batas Waktu Jeda (Auto-Timeout 60 Detik)
    if (isFilling && isPaused && pauseStartTime > 0) {
        if (millis() - pauseStartTime >= PAUSE_TIMEOUT_MS) {
            Serial.println("\n⏰ [AUTO-TIMEOUT JEDA 60 DETIK] Menutup transaksi otomatis.");
            stopFilling(true);
        }
    }

    // 3. Batas Waktu Air Tidak Mengalir / Mati (Auto-Timeout 30 Detik tanpa pulsa saat FILLING)
    if (isFilling && !isPaused && lastPulseTime > 0) {
        if (millis() - lastPulseTime >= NO_FLOW_TIMEOUT_MS) {
            Serial.println("\n🚨 [TIMEOUT AIR MATI 30 DETIK] Air tidak mengalir! Menutup transaksi otomatis.");
            stopFilling(true);
        }
    }

    // 4. Perintah dari server (hasil polling netTask)
    processNetCommands();

    // 5. Hitung debit dan volume air setiap 200 ms (5x per detik agar penghentian akurat)
    if ((millis() - oldTime) >= 200) {
        noInterrupts();
        unsigned int pulses = pulseCount;
        pulseCount = 0;
        interrupts();

        unsigned long elapsedMs = millis() - oldTime;
        oldTime = millis();

        if (pulses > 0) {
            lastPulseTime = millis(); // Reset timer saat air mengalir
        }

        flowRate = ((1000.0 / (float)elapsedMs) * (float)pulses) / calibrationFactor; // L/min
        unsigned int mlThisChunk = ((flowRate / 60.0) * (float)elapsedMs);

        if (isFilling && !isPaused) {
            currentFillMl += mlThisChunk;
            totalAccumulatedMl += mlThisChunk;

            static unsigned long lastLogTime = 0;
            if (millis() - lastLogTime >= 1000) {
                lastLogTime = millis();
                Serial.printf("⏳ Mengisi... [%.2f / %.2f Liter] - Debit: %.1f L/min\n",
                              (float)currentFillMl / 1000.0,
                              (float)targetFillMl / 1000.0,
                              (float)flowRate);
            }

            if (currentFillMl >= targetFillMl) {
                Serial.println("\n✅ Target volume air tercapai penuh!");
                stopFilling(true);
            }
        }
    }

    // 6. Update LED tombol D33
    updateLeds();

    delay(1); // beri napas ke watchdog
}