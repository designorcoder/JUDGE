# JudgeHub - Loyihalarni Baholash Tizimi

JudgeHub — bu maktablar, universitetlar va turli tadbirlar uchun loyihalarni hakamlar tomonidan baholash tizimi. Tizim to'liq **Node.js (Express) API** va **Single Page Application (SPA) Frontend** asosida qayta yozilgan hamda **O'zbek tilida (Lotin)** mukammal moslashtirilgan.

Ushbu loyiha Vercel serverless platformalarida tez va barqaror ishlash hamda mahalliy muhitda SQLite yordamida hech qanday ortiqcha sozlamalarsiz ishga tushirish uchun optimallashtirilgan.

---

## Asosiy Imkoniyatlar

### 🔑 Tizimga Kirish (Authentication)
* Xavfsiz login/parol tizimi hamda JWT (JSON Web Token) orqali sessiyani boshqarish.
* Foydalanuvchi roliga (Admin yoki Hakam) qarab interfeysning dinamik o'zgarishi.

### 🛡️ Admin Paneli (Boshqaruv):
* **Dashboard (Boshqaruv paneli)**: Tizim ko'rsatkichlari (sinflar, guruhlar, hakamlar, baholangan loyihalar soni) va oxirgi baholangan loyihalar jurnali.
* **Sinflar boshqaruvi**: Yangi sinflar yaratish va ularni guruhlari bilan birga o'chirish.
* **Guruhlar / Loyihalar boshqaruvi**: Loyiha jamoalarini yaratish, a'zolarini kiritish hamda ularni baholash uchun hakamlarni biriktirish.
* **Hakamlar boshqaruvi**: Tizimga yangi hakamlarni qo'shish va ularni o'chirish.
* **Baholar jurnali**: Hakamlar kiritgan barcha batafsil ballar va izohlar jurnali, qidirish va sinf bo'yicha filterlash.
* **Liderlar jadvali (Reyting)**: Loyihalarning to'plagan umumiy ballari reytingi va ularni **PDF formatida yuklab olish** (chop etish optimalligi).
* **Statistika**: 5 ta mezon (Funksionallik, Kod arxitekturasi, Tezlik, Xavfsizlik, UI/UX) bo'yicha o'rtacha ballar tahlili va Chart.js radar diagrammasi.

### 👨‍⚖️ Hakamlar Paneli:
* Faqat o'ziga biriktirilgan loyihalar ro'yxatini ko'rish.
* Loyihalarni baholash holatini kuzatish (kutilmoqda yoki baholangan).
* Loyiha uchun 5 ta kategoriya bo'yicha (1 dan 10 gacha) ball berish va izoh qoldirish (tahrirlash imkoniyati bilan).
* Boshqa hakamlarning izohlarini ko'rish.

---

## 🛠️ Texnologiyalar Tizimi

* **Frontend**: HTML5, Vanilla JS (SPA Hash-Routing), Tailwind CSS, Lucide Icons, Chart.js.
* **Backend**: Node.js, Express.js (REST API).
* **Database (Ma'lumotlar bazasi)**:
  * **Mahalliy (Local)**: SQLite (fayl ko'rinishida `database.sqlite` avtomatik yaratiladi).
  * **Production (Server)**: PostgreSQL (`pg` moduli yordamida).

---

## 🚀 Mahalliy Ishga Tushirish (Local Run)

Loyiha mahalliy kompyuterda avtomatik SQLite bazasini ishlatadi va boshlang'ich ma'lumotlar (admin, demo hakamlar va sinflar) bilan to'ldiradi (Seed data).

1. **Loyihani yuklab oling va kutubxonalarni o'rnating:**
   ```bash
   npm install
   ```

2. **Muhit o'zgaruvchilarini sozlang (ixtiyoriy):**
   `.env.example` faylini `.env` deb nusxalab oling. Standart sozlamalar o'zi yetarli.

3. **Serverni ishga tushiring:**
   ```bash
   npm start
   ```

4. **Brauzerda oching:**
   `http://localhost:3000` ga kiring.

### 🔑 Demo Kirish Ma'lumotlari:
* **Administrator**:
  * Login: `admin`
  * Parol: `admin123`
* **Hakam 1**:
  * Login: `judge1`
  * Parol: `judge123`
* **Hakam 2**:
  * Login: `judge2`
  * Parol: `judge123`

---

## ☁️ Vercel-ga Joylash (Deployment)

Loyiha Vercel platformasi uchun to'liq moslashtirilgan. Ma'lumotlar bazasi sifatida Render.com yoki Neon.tech kabi bepul PostgreSQL xizmatlaridan foydalanish tavsiya etiladi.

### 1-Bosqich: PostgreSQL Bazasini Yaratish (Render.com da)
1. [Render.com](https://render.com) saytiga kiring.
2. **New +** -> **PostgreSQL** ni tanlang.
3. Bazaga nom bering (masalan: `judgehub-db`) va yarating.
4. Baza yaratilgach, uning **External Database URL** (yoki **Internal Database URL**) manzilini nusxalab oling.

### 2-Bosqich: Vercel-ga yuklash
1. [Vercel](https://vercel.com) boshqaruv paneliga kiring.
2. **Add New** -> **Project** tugmasini bosing va loyihaning GitHub repozitoriyasini tanlang.
3. **Environment Variables** (muhit o'zgaruvchilari) qismida quyidagi o'zgaruvchini qo'shing:
   * `DATABASE_URL` = `nusxalab_olingan_postgresql_database_url`
   * `JWT_SECRET` = `ixtiyoriy_murakkab_xavfsiz_kalit` (JWT tokenni imzolash uchun)
4. **Deploy** tugmasini bosing. Vercel loyihani avtomatik tarzda sozlab, jonli havolani taqdim etadi.

---

## 📁 Loyiha Tuzilishi

* `/api/db.js` — PostgreSQL va SQLite bazalarini avtomatik moslashtiruvchi va jadvallarni yaratuvchi driver.
* `/api/index.js` — Tizimning Express API yo'nalishlari va boshqaruv xizmatlari.
* `/public/index.html` — Loyihaning yagona SPA sahifasi.
* `/public/js/app.js` — Sahifalar yo'nalishini (Routing), renderlashni, Chart.js va PDF chop etishni boshqaradigan frontend scripti.
* `/public/css/style.css` — Glassmorphism ko'rinishidagi zamonaviy interfeys stillari.
* `vercel.json` — Vercel marshrutlarini to'g'ri yo'naltirish konfiguratsiyasi.
