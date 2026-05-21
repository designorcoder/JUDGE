# JudgeHub - Loyiha Baholash Tizimi

JudgeHub — bu maktablar, universitetlar va turli tadbirlar uchun loyihalarni hakamlar tomonidan baholash tizimi. Tizim to'liq **O'zbek tilida (Lotin)** yozilgan, zamonaviy dizayn, moslashuvchan (responsive) interfeys va mukammal boshqaruv paneliga ega.

## Asosiy Imkoniyatlar

### Admin Paneli (Boshqaruv):
* Sinflar yaratish (masalan: 9-A, 10-B, 11-D)
* Har bir sinf ichida guruhlar/loyihalar yaratish
* Guruhlarga hakamlarni biriktirish
* Guruh a'zolarini (o'quvchilarni) va loyiha nomlarini kiritish
* Hakamlarni boshqarish (qo'shish, o'chirish)
* Keraksiz loyiha va sinflarni o'chirish
* Barcha baholash natijalarini ko'rish va liderlar jadvali (Leaderboard)
* Natijalarni **PDF formatda yuklab olish**
* Statistik kartalar va chiroyli diagrammalar (Charts)

### Hakamlar Paneli:
* Xavfsiz tizimga kirish (Login)
* Faqat o'ziga biriktirilgan guruhlarni ko'rish
* Har bir loyihani 5 ta kategoriya bo'yicha (1 dan 10 gacha ball) baholash
* Baholarga izoh qoldirish

---

## Mahalliy ishga tushirish (Local Run)

1. **Kutubxonalarni yuklash:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Ma'lumotlar bazasini sozlash va migratsiyalarni ishga tushirish:**
   ```bash
   python manage.py migrate
   ```

3. **Admin (Superuser) yaratish:**
   ```bash
   python manage.py createsuperuser
   ```

4. **Serverni ishga tushirish:**
   ```bash
   python manage.py runserver
   ```
   Tizimga brauzer orqali kirish: `http://127.0.0.1:8000/`

---

## Production Deployment (Serverga Joylash)

Loyiha **Django Monolit** arxitekturasida yaratilgan. Ya'ni, Backend (Django kodlari) va Frontend (HTML, CSS/Tailwind, JavaScript) birgalikda ishlaydi. Shuning uchun ularni alohida-alohida ajratib bo'lmaydi (Vercel'ga faqat frontend, Render'ga faqat backend qilib).

Buning o'rniga, quyidagi ikki xil usuldan birini tanlab loyihani to'liq joylashtirishingiz mumkin:

### 1-Usul: Render.com orqali to'liq deploy qilish (Tavsiya etiladi)
Render loyihaning backend qismini ham, frontend qismini ham bitta umumiy serverda juda oson ishga tushirib beradi.

#### A. PostgreSQL Ma'lumotlar Bazasini yaratish:
1. [Render.com](https://render.com) saytiga kiring va profilingizga kiring.
2. **New +** tugmasini bosing va **PostgreSQL** ni tanlang.
3. Ma'lumotlar bazasiga nom bering va **Create Database** tugmasini bosing.
4. Baza yaratilgach, **External Database URL** manzilini nusxalab oling (Uni keyingi bosqichda ishlatamiz).

#### B. Web Service yaratish:
1. Render boshqaruv panelida **New +** -> **Web Service** ni tanlang.
2. GitHub profilingizni ulab, `designorcoder/JUDGE` repozitoriyasini tanlang.
3. Quyidagi sozlamalarni kiriting:
   * **Language**: `Python`
   * **Branch**: `main`
   * **Build Command**: 
     ```bash
     pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
     ```
   * **Start Command**: 
     ```bash
     gunicorn config.wsgi:application
     ```
4. **Advanced** bo'limiga o'tib, **Environment Variables** (muhit o'zgaruvchilari) ni qo'shing:
   * `SECRET_KEY` = `sizning_maxfiy_kalitingiz` (ixtiyoriy uzun matn)
   * `DEBUG` = `False`
   * `ALLOWED_HOSTS` = `*` (yoki Render bergan havola manzili)
   * `DATABASE_URL` = `nusxalab_olingan_database_url` (A bo'limidagi PostgreSQL havolasi)
5. **Create Web Service** tugmasini bosing. Server ishga tushadi va tayyor havolani taqdim etadi.

---

### 2-Usul: Vercel orqali deploy qilish
Loyiha tarkibida Vercel serverless Python uchun maxsus `vercel.json` sozlamalari mavjud. Bu usulda ham ma'lumotlar bazasi sifatida tashqi PostgreSQL (masalan, Neon.tech yoki Render PostgreSQL) bazasi kerak bo'ladi.

1. [Vercel](https://vercel.com) saytiga kiring.
2. **Add New** -> **Project** tugmasini bosing va GitHub'dagi `designorcoder/JUDGE` repozitoriyasini tanlang.
3. **Environment Variables** bo'limida quyidagilarni sozlang:
   * `SECRET_KEY` = `sizning_maxfiy_kalitingiz`
   * `DEBUG` = `False`
   * `ALLOWED_HOSTS` = `*`
   * `DATABASE_URL` = `tashqi_postgresql_database_url` (Neon.tech yoki Render'da ochilgan bazaning URL manzili)
4. **Deploy** tugmasini bosing. Vercel loyihani avtomatik tarzda Serverless funksiya ko'rinishida ishga tushiradi.
