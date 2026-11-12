# AI Studio Automation

نظام وسيط متقدم للتكامل مع Google AI Studio عبر الأتمتة المتصفح، يوفر واجهة برمجية RESTful لمعالجة الصور والنصوص باستخدام تقنيات Playwright و Node.js.

## ✨ المميزات

- 🚀 **واجهة RESTful API** - سهلة التكامل مع أي تطبيق
- 🔒 **نظام أمان متقدم** - مصادقة API Key و Rate Limiting
- 🔄 **إدارة جلسات ذكية** - إعادة استخدام الجلسات لتحسين الأداء
- 📊 **نظام Queue متقدم** - معالجة الطلبات بكفاءة عالية
- 📝 **توثيق API تفاعلي** - OpenAPI/Swagger specification
- 🧪 **اختبارات شاملة** - اختبارات وحدة و تكامل
- 📈 **مراقبة و تسجيل** - نظام logging متكامل

## 🛠️ المتطلبات

- Node.js 18 أو أحدث
- Redis (اختياري ولكنه مستحسن للإنتاج)
- Google AI Studio account

## 📦 التثبيت

1. **استنساخ المستودع**
```bash
git clone https://github.com/yourusername/ai-studio-automation.git
cd ai-studio-automation
```

2. **تثبيت الاعتماديات**
```bash
npm install
```

3. **إعداد المتغيرات البيئية**
```bash
cp .env.example .env
# عدل ملف .env وأضف بياناتك
```

4. **بدء الخادم**
```bash
# في وضع التطوير
npm run dev

# في وضع الإنتاج
npm start
```

## 🔧 الإعداد

### المتغيرات البيئية المهمة

```env
# إعدادات الخادم
PORT=3000
NODE_ENV=development

# بيانات Google AI Studio
GOOGLE_ACCOUNT_EMAIL=your-email@gmail.com
GOOGLE_ACCOUNT_PASSWORD=your-password

# إعدادات Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# الأمان
API_KEY=your-secret-api-key
JWT_SECRET=your-jwt-secret

# المتصفح
BROWSER_HEADLESS=true
MAX_CONCURRENT_SESSIONS=3
```

## 📖 استخدام الAPI

### 1. معالجة صورة

```bash
curl -X POST http://localhost:3000/api/v1/process \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful sunset over mountains",
    "image": "optional-base64-image-data"
  }'
```

**الاستجابة:**
```json
{
  "success": true,
  "message": "Request added to processing queue",
  "data": {
    "jobId": "job_1234567890_abc123",
    "status": "queued",
    "estimatedTime": "30-60 seconds"
  }
}
```

### 2. التحقق من حالة الطلب

```bash
curl -X GET http://localhost:3000/api/v1/status/job_1234567890_abc123 \
  -H "X-API-Key: YOUR_API_KEY"
```

**الاستجابة:**
```json
{
  "success": true,
  "data": {
    "found": true,
    "id": "job_1234567890_abc123",
    "status": "completed",
    "result": {
      "type": "image",
      "url": "https://generated-image-url.com"
    }
  }
}
```

### 3. إحصائيات النظام

```bash
curl -X GET http://localhost:3000/api/v1/stats \
  -H "X-API-Key: YOUR_API_KEY"
```

## 🧪 الاختبارات

```bash
# تشغيل جميع الاختبارات
npm test

# تشغيل الاختبارات في وضع المراقبة
npm run test:watch

# توليد تقرير التغطية
npm test -- --coverage
```

## 📁 هيكل المشروع

```
ai-studio-automation/
├── src/
│   ├── api/                 # واجهة البرمجة
│   │   ├── middleware/      # Middlewares
│   │   └── routes.js       # المسارات
│   ├── core/               # النواة
│   │   ├── session-manager.js
│   │   └── request-processor.js
│   ├── utils/              # الأدوات المساعدة
│   │   ├── logger.js
│   │   └── error-handler.js
│   └── server.js           # ملف الخادم الرئيسي
├── tests/                  # الاختبارات
│   ├── integration/
│   └── unit/
├── docs/                   # التوثيق
│   └── api-spec.yml       # OpenAPI specification
├── logs/                   # ملفات السجلات
├── temp/                   # الملفات المؤقتة
└── package.json
```

## 🔒 الأمان

- ✅ **مصادقة API Key** لجميع الطلبات
- ✅ **Rate Limiting** للوقاية من الهجمات
- ✅ **تشفير HTTPS** للاتصالات
- ✅ **التحقق من صحة البيانات** المدخلة
- ✅ **نظام Logging** لمراقبة النشاطات المشبوهة

## 🚀 النشر

### باستخدام Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

```bash
# بناء الصورة
docker build -t ai-studio-automation .

# تشغيل الحاوية
docker run -d -p 3000:3000 --env-file .env ai-studio-automation
```

### باستخدام PM2

```bash
# تثبيت PM2
npm install -g pm2

# تشغيل التطبيق
pm2 start src/server.js --name ai-studio-automation

# حفظ الإعدادات
pm2 save
pm2 startup
```

## 📊 المراقبة

يتضمن النظام:

- **سجلات مفصلة** في مجلد `logs/`
- **إحصائيات النظام** عبر endpoint `/api/v1/stats`
- **مراقبة الأداء** في الوقت الفعلي
- **تنبيهات الأخطار** (يمكن التكامل مع Slack/Email)

## 🤝 المساهمة

1. Fork المستودع
2. أنشئ فرعك الخاص (`git checkout -b feature/amazing-feature`)
3. ارتكب تغييراتك (`git commit -m 'Add some amazing feature'`)
4. ادفع إلى الفرع (`git push origin feature/amazing-feature`)
5. افتح Pull Request

## 📝 الترخيص

هذا المشروع مرخص تحت MIT License - انظر ملف [LICENSE](LICENSE) للتفاصيل.

## ⚠️ إخلاء المسؤولية

هذا المشروع مخصص للأغراض التعليمية والشخصية فقط. تأكد من:

- ✅ الالتزام بشروط خدمة Google AI Studio
- ✅ عدم انتهاك حقوق الملكية الفكرية
- ✅ استخدام النظام بشكل قانوني وأخلاقي

## 🆘 الدعم

إذا واجهت أي مشاكل:

1. تحقق من السجلات في مجلد `logs/`
2. تأكد من صحة إعدادات البيئة
3. افتح Issue في المستودع
4. تواصل عبر البريد الإلكتروني: support@aistudio-automation.com

---

**⭐ لا تنسى إعطاء نجمة للمشروع إذا أعجبك!**

## 🚀 التحسينات الجديدة

### نظام التوازن في الحمل (Load Balancer)
- دعم وضع النظام الموزع عبر `CLUSTER_MODE=true`
- توزيع تلقائي للطلبات على عدة instances
- إعادة تشغيل تلقائي للعمليات المتوقفة

### نظام Queue المتقدم
- إدارة الطلبات باستخدام Bull Queue وRedis
- معالجة غير متزامنة للطلبات
- تتبع حالة الطلبات في الوقت الفعلي

### نظام المراقبة والتنبيهات
- لوحة معلومات ويب في الوقت الفعلي على المنفذ 3001
- تتبع الأداء والأخطاء
- تنبيهات Slack والبريد الإلكتروني
- متوسط وقت الاستجابة وتتبع معدل الخطأ

### تحسينات الأمان المتقدمة
- Rate Limiting لكل مفتاح API
- تشفير البيانات الحساسة
- Audit Log لتتبع النشاطات
- API Keys مع إمكانية انتهاء الصلاحية

### أوامر التشغيل الجديدة
```bash
# وضع النظام الموزع (Cluster Mode)
npm run cluster

# تشغيل لوحة المراقبة
npm run monitor

# بناء وتشغيل Docker
npm run docker:build
npm run docker:run
npm run docker:compose
```

### نقاط النهاية الجديدة
- `POST /enqueue` - إضافة طلب إلى قائمة الانتظار
- `GET /queue/status` - حالة قائمة الانتظار
- `GET /metrics` - مقاييس الأداء
- `GET /monitor` - لوحة المراقبة

### متغيرات البيئة الجديدة
- `CLUSTER_MODE` - تفعيل وضع التوازن في الحمل
- `MONITOR_PORT` - منفذ لوحة المراقبة
- `SLACK_WEBHOOK_URL` - رابط Slack للتنبيهات
- `ALERT_EMAIL` - بريد إلكتروني للتنبيهات
- `API_KEY_RATE_LIMIT_MAX` - حد Rate Limiting لكل مفتاح API