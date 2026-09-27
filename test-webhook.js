// Script Simulasi Pengujian Webhook DANA Finish-Notify
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ENDPOINT = `${BASE_URL}/api/dana/finish-notify`;

async function testDanaWebhook() {
  const sampleOrderId = 'DANA-TEST-' + Date.now();
  
  // Format Payload DANA OpenAPI 2.0 Finish Notify
  const danaPayload = {
    response: {
      head: {
        version: '2.0',
        function: 'dana.acquirement.order.finishNotify',
        clientId: '2021000000000001',
        reqTime: new Date().toISOString()
      },
      body: {
        resultInfo: {
          resultStatus: 'S',
          resultCode: 'SUCCESS',
          resultMsg: 'Success payment in sandbox'
        },
        merchantTransId: sampleOrderId,
        acquirementId: 'ACQ-' + Date.now(),
        orderTitle: 'Isi Ulang 1 Galon (19L)',
        amount: {
          value: '7000.00',
          currency: 'IDR'
        },
        payTime: new Date().toISOString()
      }
    }
  };

  console.log('🚀 Mengirim simulasi Webhook DANA Finish-Notify ke:', ENDPOINT);
  console.log('📦 Payload:', JSON.stringify(danaPayload, null, 2));

  try {
    const response = await axios.post(ENDPOINT, danaPayload, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('\n✅ Respons Server:', response.status, response.data);
    console.log('\n🎉 Webhook berhasil diproses! ESP32 sekarang akan membaca status PAID.');
  } catch (error) {
    console.error('❌ Gagal mengirim webhook:', error.response ? error.response.data : error.message);
  }
}

testDanaWebhook();
