# 🪙 Bitbash Crypto Sentry

> Standalone Automated Price-Drop Detector and Telemetry Engine

[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-black?logo=nextdotjs&logoColor=white&style=flat-square)](https://nextjs.org/)
[![Express](https://img.shields.io/badge/Backend-Express%204-green?logo=express&logoColor=white&style=flat-square)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Database-Prisma%20ORM-2D3748?logo=prisma&logoColor=white&style=flat-square)](https://www.prisma.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)

**Bitbash Crypto Sentry** is a state-of-the-art dual-engine application designed to monitor live cryptocurrency rates and trigger rapid alerts when prices drop below user-defined percentage thresholds. 

It divides execution between a responsive **Next.js Web Frontend** and an independent, lightweight **Express Background Polling & Detection Engine** to protect your databases and prevent public API rate limits.

---

## 📐 Dual-Engine Architecture

The project runs two decoupled runtime environments:

```mermaid
graph TD
    subgraph "Frontend Engine (Next.js Dashboard)"
        UI[Web Interface] <--> API[Next.js API Routes]
    end

    subgraph "Sentry Background Engine (Express)"
        E[Express Server] <--> Fetcher[Background Price Fetcher]
        Fetcher <--> Cache[(In-Memory Cache)]
        E <--> Detector[Sentry Trigger Detector]
    end

    subgraph "External & Data Layer"
        Cache <--> CG[(CoinGecko API)]
        Detector <--> DB[(Supabase PostgreSQL)]
        API <--> DB
    end

    classDef default fill:#1A1F2C,stroke:#38BDF8,stroke-width:1px,color:#E2E8F0;
```

1. **Next.js Interface (Port 3000)**: Serves the client dashboards, allows users to view assets and set alerts, and communicates with Supabase PostgreSQL via the Prisma ORM.
2. **Express Background Engine (Port 4000)**: Maintains an active thread that runs asynchronous fetch schedules and evaluate loops. It pulls market rates, syncs a localized cache layer, and executes database pruning when thresholds are breached.

---

## ✨ Key Technical Strengths

- 🔋 **Robust TypeScript Foundation**: End-to-end type safety across both the Next.js frontend and Express background system.
- ⚡ **In-Memory Cache Layer**: Rather than querying CoinGecko coin-by-coin or constantly polling databases, current pricing data stays stored inside a high-speed, localized in-memory cache.
- 🔄 **Smart Paginated Fetcher**: Circuments CoinGecko free-tier rate limits by polling with automated multi-page aggregation, caching fallback guards, and polite request cool-down breaks.
- 🛡️ **Exponential Backoff with Jitter**: Avoids distributed request clashes by executing retries using exponentially scaled delay timers backed by randomized mathematical micro-jitter (+-10%).
- 🧹 **Self-Managing Database State**: When a user's price-drop threshold triggers, the alert is logged directly in the terminal, and the database row is immediately deleted to avoid redundant notifications.

---

## 📁 Maintainable Folder Structure

The project has been refactored and structured to maintain complete separation of concerns:

```
Bitbash Crypto Sentry/
├── app/                      # Next.js 15 App Router Frontend
│   ├── api/                  # Frontend api handlers (alerts, prices, auth)
│   ├── dashboard/            # Telemetry monitor views
│   └── watchlist/            # Custom watch views
├── lib/                      # Core Shared Libraries
│   ├── auth.ts               # NextAuth authorization adapter
│   └── prisma.ts             # Prisma Client singleton
├── prisma/                   # Database Schemas and Migrations
│   └── schema.prisma         # Active Supabase PostgreSQL schema
└── server/                   # Independent Express Background Engine
    ├── config/
    │   └── constants.ts      # Polling rate limits and supported token feeds
    ├── services/
    │   ├── cache.ts          # Centralized In-Memory Pricing Cache
    │   ├── coingecko.ts      # Paginated CoinGecko batch manager
    │   ├── detector.ts       # Periodic DB Alert evaluator
    │   └── fetcher.ts        # Pricing sync scheduler
    ├── utils/
    │   ├── logger.ts         # Winston dual-transport console/file logger
    │   └── retry.ts          # Generic Exponential Backoff retry wrapper
    └── index.ts              # Express Server entry-point (Bootstrap)
```

---

## 🚀 Step-by-Step Developer Setup

### 1. Prerequisites
- **Node.js** (v18.x or newer recommended)
- **npm** or **yarn**
- A **Supabase PostgreSQL** database instance

### 2. Configure Environment Variables
Create a `.env` file in the root folder of the project. Add your PostgreSQL connection URI and server parameters:

```env
# ------------------------------------------------------------------------------
# DATABASE AND ORM
# ------------------------------------------------------------------------------
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

# ------------------------------------------------------------------------------
# AUTHENTICATION (NextAuth)
# ------------------------------------------------------------------------------
NEXTAUTH_SECRET="your-super-secure-next-auth-secret-key-phrase"
NEXTAUTH_URL="http://localhost:3000"

# ------------------------------------------------------------------------------
# STANDALONE SERVER UTILITIES
# ------------------------------------------------------------------------------
PORT=4000
NODE_ENV="development"

# ------------------------------------------------------------------------------
# COINGECKO PARAMETERS
# ------------------------------------------------------------------------------
COINGECKO_BASE_URL="https://api.coingecko.com/api/v3"
COINGECKO_VS_CURRENCY="usd"
COINGECKO_PER_PAGE=250
COINGECKO_CACHE_DURATION=30000
```

> [!WARNING]
> Keep your `.env` private and **never** commit it to GitHub. It has been pre-configured to be ignored by our `.gitignore`.

---

### 3. Initialize Database Tables
To sync the Prisma models into your Supabase Postgres database, run the following commands:

```bash
# Install node dependencies
npm install

# Generate the type-safe Prisma client
npm run prisma:generate

# Apply migrations to push schemas directly to the cloud db
npm run prisma:migrate
```

---

### 4. Running the Sentry System

You need to start **both** engines in separate terminal windows to get the entire application running:

#### 🖥️ Launch the Frontend Dashboard
To run the Next.js visual dashboard, use:
```bash
npm run dev
# Dashboard launches locally on http://localhost:3000
```

#### ⚙️ Launch the Express Sentry Engine
To run the standalone background scheduler and detector:
```bash
npm run server:dev
# Sentry server boots on http://localhost:4000 and begins polling
```

---

## 🛠️ Verification & Health Checks

Once your Sentry server is running, you can hit its endpoints to ensure it is healthy and querying processes are online:

### Root Diagnostics Endpoint
```bash
curl http://localhost:4000/
```
**Expected Response:**
```json
{
  "status": "online",
  "message": "Bitbash Crypto Sentry Express Engine is operational.",
  "timestamp": "2026-05-08T11:55:00.000Z"
}
```

### Server Telemetry Telemetry Endpoint
```bash
curl http://localhost:4000/api/status
```
**Expected Response:**
```json
{
  "success": true,
  "engine": {
    "name": "bitbash-crypto-sentry-background-engine",
    "version": "1.0.0",
    "activePolling": true,
    "activeDetector": true
  },
  "uptime": 12.4281
}
```
