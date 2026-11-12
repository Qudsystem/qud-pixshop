// إعداد بيئة الاختبار
const path = require('path');
const fs = require('fs');

// تعيين متغيرات البيئة للاختبار
process.env.NODE_ENV = 'test';
process.env.API_KEY = 'test-api-key';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.MAX_CONCURRENT_SESSIONS = '2';
process.env.BROWSER_HEADLESS = 'true';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.GOOGLE_AI_STUDIO_URL = 'https://aistudio.google.com';
process.env.GOOGLE_ACCOUNT_EMAIL = 'test@example.com';
process.env.GOOGLE_ACCOUNT_PASSWORD = 'test-password';

// إنشاء المجلدات المطلوبة
const dirs = [
  path.join(__dirname, '../logs'),
  path.join(__dirname, '../temp'),
  path.join(__dirname, '../coverage')
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// تعطيل console.log أثناء الاختبارات لمنع الضوضاء
if (process.env.SILENT_TESTS === 'true') {
  console.log = jest.fn();
  console.error = jest.fn();
}

// تنظيف بعد الانتهاء من جميع الاختبارات
afterAll(async () => {
  // إضافة أي تنظيف عام هنا
  await new Promise(resolve => setTimeout(resolve, 1000)); // انتظار ثانية للتنظيف
});