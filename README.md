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
        Detector <--> DB[(PostgreSQL Database)]
        API <--> DB
    end

    classDef default fill:#1A1F2C,stroke:#38BDF8,stroke-width:1px,color:#E2E8F0;
```

1. **Next.js Interface (Port 3000)**: Serves the client dashboards, allows users to view assets and set alerts, and communicates with PostgreSQL via the Prisma ORM.
2. **Express Background Engine (Port 4000)**: Maintains an active thread that runs asynchronous fetch schedules and evaluate loops. It pulls market rates, syncs a localized cache layer, and executes database pruning when thresholds are breached.

---

## ✨ Key Technical Strengths

- 🔋 **Robust TypeScript Foundation**: End-to-end type safety across both the Next.js frontend and Express background system.
- ⚡ **In-Memory Cache Layer**: Rather than querying CoinGecko coin-by-coin or constantly polling databases, current pricing data stays stored inside a high-speed, localized in-memory cache.
### 🛡️ Security & Authentication
- **Google OAuth 2.0**: Secure social login with persistent session handling.
- **Two-Step Verification (2FA)**: Mandatory app-level TOTP (Google Authenticator) protection for sensitive access.
- **Trusted Device Management**: "Remember this device" functionality that bypasses 2FA for 30 days on authorized browsers.
- **Session Persistence**: 30-day JWT-based session longevity with secure, HTTP-only cookies.
- **Audit Logging**: Automatic tracking of login timestamps and security events.
- **Middleware Guard**: Robust route protection that enforces 2FA verification before granting access to dashboard telemetry.
- 🔄 **Smart Paginated Fetcher**: Circuments CoinGecko free-tier rate limits by polling with automated multi-page aggregation, caching fallback guards, and polite request cool-down breaks.
- 🧹 **Self-Managing Database State**: When a user's price-drop threshold triggers, the alert is logged directly in the terminal, and the event is recorded in the `EventLog` table for frontend retrieval.

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
│   ├── auth.ts               # NextAuth authorization adapter (Prisma)
│   └── prisma.ts             # Prisma Client singleton
├── prisma/                   # Database Schemas and Migrations
│   └── schema.prisma         # Pure PostgreSQL schema
└── server/                   # Independent Express Background Engine
    ├── services/
    │   ├── cache.ts          # Centralized In-Memory Pricing Cache
    │   ├── coingecko.ts      # Paginated CoinGecko batch manager
    │   ├── detector.ts       # Periodic DB Alert evaluator
    │   └── fetcher.ts        # Pricing sync scheduler
    └── index.ts              # Express Server entry-point (Bootstrap)
```

---

## 🚀 Step-by-Step Developer Setup

### 1. Prerequisites
- **Node.js** (v18.x or newer recommended)
- **npm** or **yarn**
- A **PostgreSQL** database instance (Standalone or Hosted)

### 2. Configure Environment Variables
Create a `.env` file in the root folder of the project. Add your PostgreSQL connection URI and server parameters:

```env
# ------------------------------------------------------------------------------
# DATABASE AND ORM
# ------------------------------------------------------------------------------
DATABASE_URL="postgresql://user:password@localhost:5432/crypto_sentry?schema=public"
DIRECT_URL="postgresql://user:password@localhost:5432/crypto_sentry?schema=public"

# ------------------------------------------------------------------------------
# AUTHENTICATION (NextAuth)
# ------------------------------------------------------------------------------
NEXTAUTH_SECRET="your-super-secure-next-auth-secret-key-phrase"
NEXTAUTH_URL="http://localhost:3000"

GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# ------------------------------------------------------------------------------
# STANDALONE SERVER UTILITIES
# ------------------------------------------------------------------------------
PORT=4000
NODE_ENV="development"
```

---

### 3. Initialize Database Tables
To sync the Prisma models into your PostgreSQL database, run the following commands:

```bash
# Install node dependencies
npm install

# Generate the type-safe Prisma client
npm run prisma:generate

# Apply migrations to push schemas directly to the db
npm run prisma:migrate
```

---

### 4. Running the Sentry System

You need to start **both** engines in separate terminal windows to get the entire application running:

#### 🖥️ Launch the Frontend Dashboard
```bash
npm run dev
# Dashboard launches locally on http://localhost:3000
```

#### ⚙️ Launch the Express Sentry Engine
```bash
npm run server:dev
# Sentry server boots on http://localhost:4000 and begins polling
```
