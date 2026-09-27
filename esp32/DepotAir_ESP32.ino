/*
  ===========================================================================================
  PROYEK   : DEPOT AIR ISI ULANG OTOMATIS - INTEGRASI DANA SANDBOX WEBHOOK
  BOARD    : ESP32 Dev Module / NodeMCU-32S
  DESKRIPSI: 
    1. Polling ke Server Backend (HTTP GET /api/esp32/check-order) setiap 2 detik.
    2. Saat status "PAID": Buka Solenoid Valve (GPIO 26) & Bunyikan Buzzer 1x (GPIO 19).
    3. Baca Pulsa Water Flow Sensor (GPIO 18 - Interrupt) & hitung volume Liter real-time.
    4. Kirim telemetri volume real-time setiap 1 detik saat pengisian.
    5. Setelah targetLiter tercapai: Tutup Solenoid, Bunyikan Buzzer 4x, dan kirim 
       notifikasi selesai (HTTP POST /api/esp32/finish-fill).
    6. Tombol Darurat Manual (GPIO 4) untuk Emergency Stop seketika.
  ===========================================================================================
  PINOUT HARDWARE ESP32:
    - Water Flow Sensor (YF-S201 Signal) : GPIO 18 (Interrupt)
    - Relay Solenoid Valve (Aktif LOW)   : GPIO 26
    - Active Buzzer                      : GPIO 19
    - Tombol Emergency Stop (Active LOW) : GPIO 4 (Internal Pull-Up)
    - Status LED Indikator               : GPIO 2 (Built-in LED)
  ===========================================================================================
  LIBRARY YANG DIBUTUHKAN (Install via Arduino Library Manager):
    1. ArduinoJson (Versi 6.x atau 7.x) oleh Benoit Blanchon
    2. WiFi (Built-in ESP32)
    3. HTTPClient (Built-in ESP32)
  ===========================================================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ==========================================================
// 1. KONFIGURASI WIFI & SERVER BACKEND
// ==========================================================
const char* WIFI_SSID     = "NAMA_WIFI_ANDA";     // Ganti dengan SSID WiFi Anda
const char* WIFI_PASSWORD = "PASSWORD_WIFI_ANDA"; // Ganti dengan Password WiFi Anda

// Domain Backend (Contoh: https://dana.aspartech.com atau IP LAN http://192.168.1.100:3000)
const char* BASE_SERVER_URL = "https://dana.aspartech.com";

// Endpoint API
String urlCheckOrder  = String(BASE_SERVER_URL) + "/api/esp32/check-order";
String urlFinishFill  = String(BASE_SERVER_URL) + "/api/esp32/finish-fill";
String urlTelemetry   = String(BASE_SERVER_URL) + "/api/esp32/telemetry";

// ==========================================================
// 2. DEFINISI PIN HARDWARE
// ==========================================================
const int PIN_FLOW_SENSOR    = 18;  // Input Pulsa Water Flow Sensor YF-S201
const int PIN_RELAY_SOLENOID = 26;  // Output Kontrol Relay Solenoid Valve
const int PIN_BUZZER         = 19;  // Output Active Buzzer
const int PIN_EMERGENCY_BTN  = 4;   // Input Tombol Emergency Stop (Pull-Up)
const int PIN_LED_STATUS     = 2;   // Built-in LED ESP32

// Logika Relay (Sebagian besar modul relay adalah Active LOW)
#define RELAY_OPEN  LOW   // Solenoid Terbuka (Air Mengalir)
#define RELAY_CLOSE HIGH  // Solenoid Tertutup (Air Berhenti)

// ==========================================================
// 3. KALIBRASI WATER FLOW SENSOR (YF-S201)
// ==========================================================
// Rumus umum YF-S201: Frekuensi (Hz) = 7.5 * Q (L/min)
// 1 Liter ≈ 450 pulsa (bisa disesuaikan dengan pengujian ukur galon)
float PULSES_PER_LITER = 450.0;

// Variabel Global Sensor & Interrupt
volatile unsigned long pulseCount = 0;
unsigned long lastPulseTime = 0;

// ISR (Interrupt Service Routine) untuk menghitung pulsa air
void IRAM_ATTR pulseCounterISR() {
  pulseCount++;
}

// ==========================================================
// 4. VARIABEL STATUS SISTEM
// ==========================================================
enum SystemState {
  STATE_IDLE,
  STATE_FILLING,
  STATE_COMPLETED,
  STATE_EMERGENCY_STOP
};

SystemState currentState = STATE_IDLE;

String currentOrderId      = "";
float targetLiter          = 0.0;
float currentDispensedLiter= 0.0;
unsigned long fillStartTime= 0;
unsigned long lastPollTime = 0;
unsigned long lastTelemetryTime = 0;
const unsigned long POLL_INTERVAL = 2000; // Polling setiap 2000 ms (2 detik)

// Debounce Tombol Darurat
unsigned long lastBtnPressTime = 0;
const unsigned long DEBOUNCE_DELAY = 250;

// ==========================================================
// 5. HELPER FUNCTION: SUARA BUZZER
// ==========================================================
void beepBuzzer(int count, int durationMs = 150, int pauseMs = 100) {
  for (int i = 0; i < count; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(durationMs);
    digitalWrite(PIN_BUZZER, LOW);
    if (i < count - 1) {
      delay(pauseMs);
    }
  }
}

// Bunyi nada khusus Emergency
void emergencyAlarm() {
  for (int i = 0; i < 6; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    digitalWrite(PIN_LED_STATUS, HIGH);
    delay(80);
    digitalWrite(PIN_BUZZER, LOW);
    digitalWrite(PIN_LED_STATUS, LOW);
    delay(60);
  }
}

// ==========================================================
// 6. SETUP & INISIALISASI
// ==========================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n========================================================");
  Serial.println("💧 ESP32 DEPOT AIR ISI ULANG - WEBHOOK DANA SANDBOX");
  Serial.println("========================================================");

  // Inisialisasi Pin
  pinMode(PIN_RELAY_SOLENOID, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED_STATUS, OUTPUT);
  pinMode(PIN_FLOW_SENSOR, INPUT_PULLUP);
  pinMode(PIN_EMERGENCY_BTN, INPUT_PULLUP);

  // Pastikan Solenoid tertutup & Buzzer mati saat booting
  digitalWrite(PIN_RELAY_SOLENOID, RELAY_CLOSE);
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_LED_STATUS, LOW);

  // Pasang Interrupt pada Sensor Water Flow
  attachInterrupt(digitalPinToInterrupt(PIN_FLOW_SENSOR), pulseCounterISR, RISING);

  // Bunyi 2x beep tanda sistem menyala
  beepBuzzer(2, 100, 100);

  // Hubungkan ke WiFi
  connectToWiFi();
}

// ==========================================================
// 7. KONEKSI KE WIFI
// ==========================================================
void connectToWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(PIN_LED_STATUS, !digitalRead(PIN_LED_STATUS)); // Blink LED
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi Terhubung!");
    Serial.print("IP Address ESP32: ");
    Serial.println(WiFi.localIP());
    digitalWrite(PIN_LED_STATUS, HIGH);
    beepBuzzer(1, 300); // Beep panjang tanda online
  } else {
    Serial.println("\n❌ Gagal terhubung ke WiFi! Cek SSID/Password.");
    digitalWrite(PIN_LED_STATUS, LOW);
  }
}

// ==========================================================
// 8. FUNGSI HTTP: CHECK ORDER (/api/esp32/check-order)
// ==========================================================
void checkOrderFromServer() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ WiFi terputus, mencoba reconnect...");
    WiFi.reconnect();
    return;
  }

  HTTPClient http;
  http.begin(urlCheckOrder);
  http.setTimeout(4000);

  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    
    // Parsing JSON Respons
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      const char* status = doc["status"];
      
      // Jika status pesanan adalah PAID
      if (status && strcmp(status, "PAID") == 0) {
        currentOrderId = doc["orderId"].as<String>();
        targetLiter    = doc["targetLiter"].as<float>();
        
        Serial.println("\n🎉 [TRANSAKSI BARU DITERIMA]");
        Serial.print("Order ID    : "); Serial.println(currentOrderId);
        Serial.print("Target Liter: "); Serial.print(targetLiter); Serial.println(" Liter");

        startFillingWater();
      }
    } else {
      Serial.print("JSON Parsing error: ");
      Serial.println(error.c_str());
    }
  } else {
    Serial.printf("HTTP Check Order gagal, error code: %d\n", httpCode);
  }

  http.end();
}

// ==========================================================
// 9. FUNGSI MEMULAI PENGISIAN AIR
// ==========================================================
void startFillingWater() {
  currentState = STATE_FILLING;
  
  // Reset penghitung pulsa
  noInterrupts();
  pulseCount = 0;
  interrupts();

  currentDispensedLiter = 0.0;
  fillStartTime = millis();

  // 1. Bunyikan Buzzer 1x konfirmasi mulai
  beepBuzzer(1, 400);

  // 2. Buka Solenoid Valve (Relay ON)
  digitalWrite(PIN_RELAY_SOLENOID, RELAY_OPEN);
  digitalWrite(PIN_LED_STATUS, HIGH);

  Serial.println("🚰 Solenoid Valve DIBUKA! Memulai pengisian air...");
}

// ==========================================================
// 10. FUNGSI HTTP: FINISH FILL (/api/esp32/finish-fill)
// ==========================================================
void sendFinishFillToServer(String finishStatus) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi offline saat kirim finish, reconnecting...");
    WiFi.reconnect();
  }

  HTTPClient http;
  http.begin(urlFinishFill);
  http.addHeader("Content-Type", "application/json");

  // Siapkan Payload JSON
  StaticJsonDocument<256> doc;
  doc["orderId"]         = currentOrderId;
  doc["dispensedLiter"]  = currentDispensedLiter;
  doc["durationSeconds"] = (millis() - fillStartTime) / 1000;
  doc["status"]          = finishStatus; // "COMPLETED" atau "EMERGENCY_STOP"

  String requestBody;
  serializeJson(doc, requestBody);

  Serial.print("📤 Mengirim notifikasi selesai ke server: ");
  Serial.println(requestBody);

  int httpCode = http.POST(requestBody);
  if (httpCode == HTTP_CODE_OK || httpCode == 201) {
    Serial.println("✅ Server mereset status depot ke IDLE.");
  } else {
    Serial.printf("❌ Gagal kirim finish-fill, code: %d\n", httpCode);
  }

  http.end();
}

// ==========================================================
// 11. FUNGSI TELEMETRI REAL-TIME (/api/esp32/telemetry)
// ==========================================================
void sendLiveTelemetry() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(urlTelemetry);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["orderId"]      = currentOrderId;
  doc["currentLiter"] = currentDispensedLiter;
  doc["pulses"]       = pulseCount;
  doc["flowRate"]     = 0; // opsional

  String body;
  serializeJson(doc, body);

  http.POST(body);
  http.end();
}

// ==========================================================
// 12. FUNGSI DARURAT (EMERGENCY STOP)
// ==========================================================
void handleEmergencyStop() {
  Serial.println("\n🚨 [EMERGENCY STOP DIAKTIFKAN!]");
  
  // Matikan Solenoid seketika
  digitalWrite(PIN_RELAY_SOLENOID, RELAY_CLOSE);
  currentState = STATE_IDLE;

  // Bunyikan alarm darurat
  emergencyAlarm();

  // Kirim laporan darurat ke server
  sendFinishFillToServer("EMERGENCY_STOP");

  // Reset variabel
  currentOrderId = "";
  targetLiter = 0.0;
  currentDispensedLiter = 0.0;
}

// ==========================================================
// 13. PROSES PENGISIAN & MONITORING LITER
// ==========================================================
void processFilling() {
  // Ambil data pulsa secara aman dari ISR
  unsigned long currentPulses;
  noInterrupts();
  currentPulses = pulseCount;
  interrupts();

  // Konversi pulsa ke Liter
  currentDispensedLiter = (float)currentPulses / PULSES_PER_LITER;

  // Print progress ke Serial Monitor setiap 500ms
  static unsigned long lastSerialPrint = 0;
  if (millis() - lastSerialPrint > 500) {
    lastSerialPrint = millis();
    Serial.printf("⏳ Mengisi... [%.2f / %.2f Liter] (Pulsa: %lu)\n", 
                  currentDispensedLiter, targetLiter, currentPulses);
  }

  // Kirim telemetri ke server setiap 1000ms (1 detik)
  if (millis() - lastTelemetryTime > 1000) {
    lastTelemetryTime = millis();
    sendLiveTelemetry();
  }

  // Cek apakah target liter sudah tercapai
  if (currentDispensedLiter >= targetLiter) {
    Serial.println("\n✅ TARGET LITER TERCAPAI!");
    
    // 1. Tutup Solenoid Valve Seketika
    digitalWrite(PIN_RELAY_SOLENOID, RELAY_CLOSE);
    digitalWrite(PIN_LED_STATUS, LOW);

    // 2. Bunyikan Buzzer 4x tanda pengisian selesai
    Serial.println("🔊 Membunyikan Buzzer 4x...");
    beepBuzzer(4, 180, 120);

    // 3. Kirim konfirmasi selesai ke server
    sendFinishFillToServer("COMPLETED");

    // 4. Kembalikan state ke IDLE
    currentState = STATE_IDLE;
    currentOrderId = "";
    targetLiter = 0.0;
    currentDispensedLiter = 0.0;
    Serial.println("💤 Sistem kembali ke status IDLE. Siap melayani pesanan berikutnya.\n");
  }
}

// ==========================================================
// 14. MAIN LOOP
// ==========================================================
void loop() {
  // 1. Cek Tombol Emergency Stop (Active LOW)
  if (digitalRead(PIN_EMERGENCY_BTN) == LOW) {
    if (millis() - lastBtnPressTime > DEBOUNCE_DELAY) {
      lastBtnPressTime = millis();
      if (currentState == STATE_FILLING) {
        handleEmergencyStop();
      }
    }
  }

  // 2. State Machine Execution
  switch (currentState) {
    case STATE_IDLE:
      // Polling server setiap 2 detik
      if (millis() - lastPollTime >= POLL_INTERVAL) {
        lastPollTime = millis();
        checkOrderFromServer();
      }
      break;

    case STATE_FILLING:
      // Hitung volume dan kendalikan pengisian air
      processFilling();
      break;

    default:
      currentState = STATE_IDLE;
      break;
  }
}
