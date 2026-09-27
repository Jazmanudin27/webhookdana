#include <WiFi.h>

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n==========================================");
    Serial.println(">>> ESP32 WIFI SCANNER TEST <<<");
    Serial.println("==========================================");

    WiFi.mode(WIFI_STA);
    WiFi.disconnect();
    delay(500);

    Serial.println("Sedang memindai semua sinyal WiFi sekitar...");
    int n = WiFi.scanNetworks();
    
    Serial.println("------------------------------------------");
    if (n == 0) {
        Serial.println("TIDAK ADA WIFI YANG DITEMUKAN!");
        Serial.println("Kemungkinan antena / modul WiFi ESP32 bermasalah.");
    } else {
        Serial.printf("DITEMUKAN %d JARINGAN WIFI:\n\n", n);
        for (int i = 0; i < n; ++i) {
            String ssid = WiFi.SSID(i);
            int rssi = WiFi.RSSI(i);
            int channel = WiFi.channel(i);
            String encType = (WiFi.encryptionType(i) == WIFI_AUTH_OPEN) ? "Open" : "Password";

            Serial.printf("[%2d] SSID    : %s\n", i + 1, ssid.c_str());
            Serial.printf("     Sinyal  : %d dBm (Channel %d) - %s\n", rssi, channel, encType.c_str());
            if (ssid == "TP-Link_71E8") {
                Serial.println("     ===> INI ROUTER TP-LINK ANDA (TERDETEKSI OLEH ESP32!) <===");
            }
            Serial.println();
        }
    }
    Serial.println("==========================================");
    Serial.println("Scan selesai!");
}

void loop() {
    delay(1000);
}
