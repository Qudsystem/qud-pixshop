# استخدام Node.js النسخة المستقرة
FROM node:18-alpine

# تعيين المجلد الرئيسي
WORKDIR /app

# تثبيت المتطلبات النظامية
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# تعيين متغيرات بيئة Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# نسخ ملفات package
COPY package*.json ./

# تثبيت الاعتماديات
RUN npm ci --only=production && npm cache clean --force

# نسخ بقية الملفات
COPY . .

# إنشاء المجلدات المطلوبة
RUN mkdir -p logs temp

# تعيين صلاحيات الملفات
RUN chown -R node:node /app
USER node

# فتح المنفذ
EXPOSE 3000

# الأمر لتشغيل التطبيق
CMD ["npm", "start"]