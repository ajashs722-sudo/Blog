# 📝 Aluvantis Blog — Modern Personal Blog & Content Engine

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://blog.aluvantis.uz)
[![React 19](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

**Aluvantis Blog** (`aluvantisblog`) is a high-performance, full-stack personal blogging platform built with **React 19**, **Vite 6**, **TypeScript**, **Tailwind CSS v4**, **Cloudflare Workers**, **Cloudflare KV**, **Cloudflare R2**, and **Telegram Bot** integrations.

🌐 **Live URL:** [https://blog.aluvantis.uz](https://blog.aluvantis.uz)

---

## 🌟 Key Features

* **⚡ Ultra-fast Edge Architecture:** Powered by Cloudflare Workers edge runtime and Cloudflare KV (`BLOG_STORE`) for instantaneous globally distributed data access.
* **📦 Cloudflare R2 Media Storage:** S3-compatible media asset storage for seamless file and image uploads.
* **📲 Telegram Bot & Admin Integration:** Real-time post synchronization, Telegram group auto-posting, and admin notification system.
* **🎨 Modern UI/UX:** Styled using Tailwind CSS v4 and fluid animations powered by Motion (Framer Motion).
* **🌐 Dynamic API & Edge Routes:** Built-in REST endpoints for posts, media uploads, health checks, and Telegram webhooks.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19 + React Router v7 |
| **Build Tool & Styling** | Vite 6 + Tailwind CSS v4 |
| **Edge Server Engine** | Cloudflare Workers (`worker.ts`) / Node.js Express (`server.ts`) |
| **Data Storage** | Cloudflare KV (`BLOG_STORE`) |
| **Media Storage** | Cloudflare R2 (`@aws-sdk/client-s3`) |
| **Bot Integrations** | Telegram Bot Webhooks & Group Notifications |

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory (or configure via Cloudflare Wrangler secrets):

```env
# Cloudflare R2 Configuration
CLOUDFLARE_R2_BUCKET_NAME=your_r2_bucket_name_here
CLOUDFLARE_R2_ACCOUNT_ID=your_cloudflare_account_id_here
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key_id_here
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_access_key_here

# Telegram Integration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_ADMIN_ID=your_telegram_admin_id_here
TELEGRAM_GROUP_ID=your_telegram_group_id_here

# App URL
APP_URL=https://blog.aluvantis.uz
```

---

## 🚀 Quick Start & Local Setup

### 1. Kutubxonalarni o'rnatish (Install Dependencies)
```bash
npm install
```

### 2. Dasturiy Muhitda Ishga Tushirish (Development Mode)
```bash
npm run dev
```

### 3. Build & Cloudflare Deploy
```bash
# Build Vite frontend & Worker bundle
npm run build

# Deploy to Cloudflare Workers (blog.aluvantis.uz)
npx wrangler deploy
```

---

## 🇺🇿 O'zbekcha Yo'riqnoma

**Aluvantis Blog** — Cloudflare Workers va Cloudflare KV bazasida ishlovchi, zamonaviy va tezkor shaxsiy blog platformasi.

### ⚙️ Asosiy Imkoniyatlar:
1. **Cloudflare KV (`BLOG_STORE`):** Maqolalarni global chekka serverlarda saqlaydi va tezkor yuklanishni ta'minlaydi.
2. **Cloudflare R2 Media:** Rasm va fayllarni bulutli saqlash.
3. **Telegram Bot Integratsiyasi:** Yangi blog postlarni Telegram guruhiga va admin boti orqali avtomatik yuborish.
4. **Moslashuvchan interfeys:** Tailwind CSS v4 va React 19 yordamida yaratilgan chiroyli dizayn.

---

Designed with ❤️ for Aluvantis.
