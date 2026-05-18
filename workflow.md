# 🛡️ CRYPTO SENTRY — COMPLETE WORKFLOW GUIDE

---

## 📌 TABLE OF CONTENTS

1. [Big Picture: What Are The Two Servers?](#1-big-picture)
2. [How Frontend & Backend Are Connected](#2-frontend-backend-connection)
3. [Authentication: NextAuth, Google, JWT](#3-authentication-workflow)
4. [Registration Flow](#4-registration-flow)
5. [The Surveillance Engine (Express Backend)](#5-surveillance-engine)
6. [Client-Side Polling vs WebSockets](#6-polling-vs-websockets)
7. [API Endpoints & Which File Handles Each](#7-api-endpoints-map)
8. [JavaScript Mapping Explained](#8-javascript-mapping)
9. [Database: Keys, Constraints, Duplicates](#9-database-design)
10. [How Files Talk to Each Other](#10-how-files-talk)
11. [Where to Make Changes](#11-where-to-make-changes)

---

## 1. BIG PICTURE

Crypto Sentry runs as **TWO separate servers** at the same time:

```
┌─────────────────────────────────────────────────────┐
│  SERVER 1: Next.js (Port 3000)                      │
│  - Shows the website to users (UI)                  │
│  - Handles login, register, dashboard pages         │
│  - Has its own API routes (/api/...)                 │
│  - Started with: npm run dev                        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  SERVER 2: Express (Port 4000)                      │
│  - Runs silently in the background                  │
│  - Fetches crypto prices from CoinGecko every 30s   │
│  - Checks if any user's price alert has triggered   │
│  - Stores prices in RAM (memory cache)              │
│  - Started with: npm run server                     │
└─────────────────────────────────────────────────────┘

Both servers run together using: npm run dev:all
```

**Why two servers?**
- Next.js is great for building web pages and user-facing APIs.
- Express is better for running non-stop background tasks.
- They talk to each other via HTTP (Next.js asks Express for cached prices).

---

## 2. FRONTEND–BACKEND CONNECTION

### Who handles the frontend?
**Next.js (Port 3000)** handles everything the user sees:
- Pages: `/login`, `/register`, `/dashboard`, `/settings`, `/verify`
- File: `app/dashboard/page.tsx` → loads `DashboardClient.tsx`

### How the browser gets data:
```
Browser (React) 
  → every 5 seconds calls: GET /api/prices        (Next.js API route)
  → Next.js calls internally: GET localhost:4000/api/cache  (Express)
  → Express returns the cached prices from RAM
  → Next.js transforms data and sends it to the browser
  → Browser updates the price table on screen
```

### Key connection file: `app/dashboard/_hooks/usePriceTicker.ts`
This is a **React Hook** that runs in the browser. Here is what it does:
1. On load, it immediately calls `/api/prices`.
2. It then calls `/api/prices` again **every 5 seconds** using `setInterval`.
3. When new prices arrive, it updates the `prices` state.
4. React automatically re-renders the UI with the fresh prices.

---

## 3. AUTHENTICATION WORKFLOW

### Three ways to authenticate:

#### A) Email + Password Login
```
User types email/password on /login page
  → clicks Login button
  → frontend calls NextAuth's signIn("credentials", {...})
  → NextAuth calls the "authorize" function in lib/auth.ts
  → auth.ts checks if email OR username exists in DB (prisma.user.findUnique)
  → bcrypt.compare() checks if password matches the hashed password in DB
  → if valid: returns user object → JWT token is created
  → if invalid: throws Error → login page shows error message
```

#### B) Google OAuth Login
```
User clicks "Login with Google" (components/auth/GoogleLoginButton.tsx)
  → calls signIn("google")
  → browser redirects to Google's consent screen
  → Google redirects back to: /api/auth/callback/google
  → NextAuth's signIn() callback in lib/auth.ts fires:
      - Checks if user email already exists in DB
      - If NEW user: allows account creation (PrismaAdapter creates User + Account rows)
      - If EXISTING user: logs them in (allowDangerousEmailAccountLinking = true)
  → events.signIn() fires: auto-assigns a username if the Google user has none
  → JWT token created
```

#### C) Two-Factor Authentication (2FA) — TOTP
```
User has 2FA enabled → after password login:
  → middleware.ts detects: token.twoFactorEnabled=true AND token.is2FAVerified=false
  → redirects user to /verify page
  → user opens Google Authenticator app, gets 6-digit code
  → /verify page calls POST /api/auth/2fa/verify
  → server calls verifyToken() from lib/two-factor.ts (uses otplib library)
  → if valid: session is updated (trigger="update"), token.is2FAVerified=true
  → middleware now allows access to /dashboard
```

### The JWT Token — What Is It and Where Is Stored?
A **JWT (JSON Web Token)** is like a secure ID card stored in a cookie in your browser.

**How it's created:**
1. After successful login, NextAuth calls the `jwt()` callback in `lib/auth.ts`
2. The callback adds custom fields to the token: `id`, `username`, `twoFactorEnabled`, `is2FAVerified`, `hasSeenTutorial`
3. This token is **signed** using `NEXTAUTH_SECRET` from `.env` (nobody can fake it)
4. Stored as an **HttpOnly cookie** in the browser (JavaScript cannot read it → secure)

**Where it lives:** `next-auth.session-token` cookie (browser storage)

**How it's read:** Every protected API call runs `getServerSession(authOptions)` which decodes the cookie and returns the session object.

### Key Files for Auth:
| File | Role |
|------|------|
| `lib/auth.ts` | Main auth config: providers, JWT callbacks, session callbacks |
| `lib/two-factor.ts` | Generates 2FA secrets, QR codes, verifies TOTP tokens |
| `lib/prisma.ts` | Provides the database connection used by auth |
| `app/api/auth/[...nextauth]/route.ts` | The catch-all route that NextAuth uses for all auth URLs |
| `app/api/auth/2fa/setup/route.ts` | GET=generate QR code, POST=save secret, DELETE=disable 2FA |
| `middleware.ts` | Guards all routes: checks JWT, enforces 2FA redirect |
| `app/providers.tsx` | Wraps entire app in `<SessionProvider>` so all pages can read session |

---

## 4. REGISTRATION FLOW

```
User fills out form at /signup or /register
  → clicks Register
  → frontend calls: POST /api/register

app/api/register/route.ts does:
  1. Validates email format (EMAIL_REGEX)
  2. Validates username format (3–24 chars, letters/numbers/_/-)
  3. Validates password length (min 6 chars)
  4. Duplicate email check: prisma.user.findUnique({ where: { email } })
  5. Duplicate username check: prisma.user.findUnique({ where: { username } })
  6. bcrypt.hash(password, 10) → hashes the password
  7. prisma.user.create({ email, username, password: hashedPassword })
  8. Returns: { success: true, user: { id, email, username } }

User then gets redirected to /login to sign in with the new account.
```

---

## 5. SURVEILLANCE ENGINE (Express Backend)

Think of the Express server (`server/`) as a **security guard that never sleeps**. It runs background tasks automatically.

### server/index.ts — The Entry Point
This file:
1. Creates an Express app
2. Sets up CORS to allow requests only from `localhost:3000`
3. Logs every incoming request
4. Starts two background loops: `startFetcher(30000)` and `startDetector(30000)`
5. Exposes 3 API endpoints:
   - `GET /` → health check
   - `GET /api/status` → engine status
   - `GET /api/cache` → returns all cached prices (this is what Next.js calls)

### server/services/cache.ts — The RAM Storage
A `MemoryCache` class that stores data in a JavaScript `Map` (just computer RAM, not a database).

**Key methods:**
- `cache.set("price:bitcoin", { price: 96000, change24h: 3.2, ... })` — store a value
- `cache.get("price:bitcoin")` — retrieve a value
- `cache.getAll()` — get everything (used by `/api/cache` endpoint)

**Cache keys follow this pattern:** `price:{coinId}` e.g. `price:bitcoin`, `price:ethereum`

### server/services/coingecko.ts — Fetching from CoinGecko API
**Main function: `fetchMarketSnapshot()`**
- Calls `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=20`
- Gets top 20 coins: id, name, symbol, current_price, price_change_percentage_24h, image
- Returns the array of coin data

**Library used:** `axios` — an HTTP client (like a web browser for code)

### server/services/fetcher.ts — The 30-Second Price Polling Loop
**Main function: `pollPrices()`**
1. Calls `fetchMarketSnapshot()` to get fresh prices from CoinGecko
2. For each coin, writes to cache: `cache.set("price:bitcoin", { price, change24h, name, symbol, image })`
3. Writes a timestamp: `cache.set("system:last_updated", Date.now())`

**`startFetcher(30000)`** → sets up `setInterval(pollPrices, 30000)` to run every 30 seconds

### server/services/detector.ts — The Alert Scanner
This is the **core surveillance logic**. Every 30 seconds it:

1. **Loads all users** from DB (their `globalThreshold` setting)
2. **Loads all watchlists** from DB (which coins each user is watching)
3. **Builds a Map** — `watchlistMap: userId → Set<assetId>` for fast O(1) lookup
4. **Loops through every coin** in the RAM cache
5. **For each user** who is watching that coin, checks 3 conditions:
   - `SENTRY_DROP`: is the 24h change ≤ user's threshold? (e.g., dropped more than -2%)
   - `SENTRY_SPIKE`: is the 24h change ≥ threshold? (positive threshold)
   - `SENTRY_VOLATILITY`: is the absolute change ≥ 15%?
6. If triggered AND not a duplicate → writes to `event_logs` table in PostgreSQL

**Anti-spam (deduplication) logic:**
- Uses an in-memory `alertTracker` Map: key = `"userId:assetId:eventType"`
- Will only fire again if: 10+ minutes have passed AND price moved by >1% OR change shifted by >1%

**Fingerprint system:**
- Every log gets a `fingerprint`: `"userId:assetId:eventType:timeWindow"` (30-min windows)
- Database has `@unique` on fingerprint → if duplicate fingerprint → Prisma throws error code `P2002` → caught and skipped

### server/utils/logger.ts — Logging System
Uses **Winston** library to write logs to:
- `server/logs/error.log` — only errors
- `server/logs/combined.log` — everything
- Console (in development mode with colors)

### server/utils/retry.ts — Retry with Exponential Backoff
If a network call fails (e.g., CoinGecko is down):
- Retries up to 3 times
- Waits: 1s → 2s → 4s (doubles each time)
- If HTTP 429 (rate limited): waits 15 seconds before retrying
- Adds random "jitter" (±10%) to prevent all clients hitting at once

---

## 6. POLLING vs WebSockets — WHY WE CHOSE POLLING

### What is WebSockets?
WebSockets keep a **permanent open connection** between browser and server. Server can push data anytime.

### What is Client-Side Polling?
Browser asks the server for new data **every N seconds** (like repeatedly asking "any news?").

### Why we chose polling (not WebSockets):

| Reason | Explanation |
|--------|-------------|
| **Simpler architecture** | No need for socket.io or ws library, no connection state management |
| **CoinGecko updates every 30s** | Prices don't change 100 times per second, so real-time push isn't needed |
| **Next.js App Router** | Built around request/response model, not persistent connections |
| **Reliability** | If network drops, polling auto-recovers. WebSocket needs reconnect logic |
| **No extra server cost** | WebSockets need a persistent server process; polling works with serverless |

**Where the polling is coded:**
- **Backend polling** (Express fetches CoinGecko): `server/services/fetcher.ts` → `setInterval(pollPrices, 30000)` — every **30 seconds**
- **Frontend polling** (browser fetches prices): `app/dashboard/_hooks/usePriceTicker.ts` → `setInterval(fetchLivePrices, 5000)` — every **5 seconds**

The 5-second frontend interval feels fast/live to the user, even though real CoinGecko data only updates every 30 seconds.

---

## 7. API ENDPOINTS MAP

### Next.js API Routes (Port 3000)

| Endpoint | File | What It Does |
|----------|------|--------------|
| `GET /api/auth/[...nextauth]` | `app/api/auth/[...nextauth]/route.ts` | Handles ALL NextAuth flows (login, Google callback, session, logout) |
| `POST /api/register` | `app/api/register/route.ts` | Creates a new user account |
| `GET /api/prices` | `app/api/prices/route.ts` | Gets live prices by asking Express cache |
| `GET /api/global` | `app/api/global/route.ts` | Gets total crypto market cap from CoinGecko |
| `GET /api/watchlist` | `app/api/watchlist/route.ts` | Gets user's watchlist coins |
| `POST /api/watchlist` | `app/api/watchlist/route.ts` | Adds a coin to watchlist |
| `DELETE /api/watchlist` | `app/api/watchlist/route.ts` | Removes a coin from watchlist |
| `GET /api/alerts` | `app/api/alerts/route.ts` | Gets user's price alerts |
| `POST /api/alerts` | `app/api/alerts/route.ts` | Creates a new price alert |
| `DELETE /api/alerts` | `app/api/alerts/route.ts` | Deletes a price alert |
| `GET /api/logs` | `app/api/logs/route.ts` | Gets recent event logs for user |
| `GET /api/settings` | `app/api/settings/route.ts` | Gets user's threshold setting |
| `POST /api/settings` | `app/api/settings/route.ts` | Updates user's threshold setting |
| `GET /api/auth/2fa/setup` | `app/api/auth/2fa/setup/route.ts` | Generates 2FA secret + QR code |
| `POST /api/auth/2fa/setup` | `app/api/auth/2fa/setup/route.ts` | Verifies first TOTP code, enables 2FA |
| `DELETE /api/auth/2fa/setup` | `app/api/auth/2fa/setup/route.ts` | Disables 2FA |

### Express API Routes (Port 4000)

| Endpoint | File | What It Does |
|----------|------|--------------|
| `GET /` | `server/index.ts` | Health check |
| `GET /api/status` | `server/index.ts` | Engine status info |
| `GET /api/cache` | `server/index.ts` | Returns all cached price data |

---

## 8. JAVASCRIPT MAPPING EXPLAINED

"Mapping" in JavaScript means **transforming an array from one shape to another** using `.map()`.

### Example 1 — detector.ts builds a watchlist Map:
```typescript
// Raw data from database:
// [{ userId: "u1", assetId: "bitcoin" }, { userId: "u1", assetId: "solana" }]

const watchlistMap = new Map<string, Set<string>>();
for (const item of watchlists) {
  if (!watchlistMap.has(item.userId)) {
    watchlistMap.set(item.userId, new Set());
  }
  watchlistMap.get(item.userId)?.add(item.assetId);
}

// Result: Map { "u1" => Set { "bitcoin", "solana" } }
// Now we can instantly check: does user "u1" watch "bitcoin"? → O(1) speed
```

### Example 2 — prices/route.ts transforms cache data for the UI:
```typescript
const data = priceKeys.map((key) => {
  const id = key.replace('price:', '');    // "price:bitcoin" → "bitcoin"
  const val = cacheData[key];
  return {
    id,
    name: val.name,        // "Bitcoin"
    symbol: val.symbol,    // "BTC"
    price: parseFloat(val.price),
    change24h: parseFloat(val.change24h),
    image: val.image,      // coin logo URL
  };
});
```
Raw cache keys like `price:bitcoin` get transformed into clean objects the frontend can use.

### Example 3 — usePriceTicker.ts merges live prices with history:
```typescript
setPrices((prevPrices) => {
  return payload.data.map((liveCoin) => {
    const matchedPrev = prevPrices.find((p) => p.id === liveCoin.id);
    const updatedHistory = matchedPrev ? [...matchedPrev.history] : [];
    updatedHistory.push(liveCoin.price);          // add latest price
    if (updatedHistory.length > 12) updatedHistory.shift(); // keep only last 12
    return { ...liveCoin, history: updatedHistory };
  });
});
```
This is how sparkline charts work: we keep a rolling window of the last 12 prices.

### Example 4 — dashboard/page.tsx maps DB rows to clean objects:
```typescript
const initialWatchlist = watchlistRows.map((row) => ({
  id: row.id,
  assetId: row.assetId,
  assetName: row.assetName,
}));
```
Raw Prisma DB rows (which have many internal fields) get mapped to just what the UI needs.

---

## 9. DATABASE DESIGN

### Database: PostgreSQL via Prisma ORM
File: `prisma/schema.prisma`

### Tables and Their Purpose:

| Table | Prisma Model | Purpose |
|-------|-------------|---------|
| `users` | `User` | Stores all user accounts |
| `accounts` | `Account` | Stores OAuth (Google) connection info |
| `sessions` | `Session` | Stores active login sessions |
| `verification_tokens` | `VerificationToken` | For email verification |
| `wishlists` | `Wishlist` | Coins a user is watching |
| `alerts` | `Alert` | User price alerts |
| `event_logs` | `EventLog` | Surveillance trigger history |

### Primary Keys (PK) — Unique Row Identifier:
Every table has an `id` field that uniquely identifies each row:
```
User.id      → UUID (auto-generated random string like "a1b2c3d4-...")
Wishlist.id  → UUID
Alert.id     → UUID
EventLog.id  → UUID
```

### Foreign Keys (FK) — Linking Tables Together:
```
Wishlist.userId  → points to User.id   (who owns this watchlist item?)
Alert.userId     → points to User.id   (who set this alert?)
EventLog.userId  → points to User.id   (who triggered this event?)
Account.userId   → points to User.id   (which user is this Google account for?)
```

`onDelete: Cascade` means: **if you delete a User, all their wishlists/alerts/logs are automatically deleted too**.

### Composite Unique Key — Preventing Duplicates:
```prisma
// In Wishlist model:
@@unique([userId, assetId])
```
This means: **a user cannot add the same coin twice**. If User A tries to add "bitcoin" again, PostgreSQL rejects it with a unique constraint violation.

Also used in the Account model:
```prisma
@@unique([provider, providerAccountId])
```
Prevents the same Google account from being linked twice.

### Unique Fields:
```
User.email     → @unique  (no two users can have same email)
User.username  → @unique  (no two users can have same username)
EventLog.fingerprint → @unique  (prevents duplicate alert logs in same 30-min window)
```

### How duplicate checks work in code:
**In `app/api/register/route.ts`:**
```typescript
// Check email first
const emailConflict = await prisma.user.findUnique({ where: { email: cleanEmail } });
if (emailConflict) return error("Email already exists");

// Then check username
const usernameConflict = await prisma.user.findUnique({ where: { username: cleanUsername } });
if (usernameConflict) return error("Username taken");
```

**In `app/api/watchlist/route.ts`:**
```typescript
// Check before inserting
const existingItem = await prisma.wishlist.findUnique({
  where: { userId_assetId: { userId, assetId } }  // composite key lookup
});
if (existingItem) return error("Already in watchlist");
```

---

## 10. HOW FILES TALK TO EACH OTHER

### Complete data flow with file references:

```
┌─────────────────────────────────────────────────────────────────┐
│  STARTUP (npm run dev:all)                                       │
│                                                                  │
│  server/index.ts boots Express on port 4000                     │
│    → calls startFetcher(30000)    [server/services/fetcher.ts]  │
│    → calls startDetector(30000)   [server/services/detector.ts] │
│                                                                  │
│  next dev boots Next.js on port 3000                            │
│    → app/layout.tsx wraps app in AuthProvider + TutorialProvider│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  EVERY 30 SECONDS (Express Background)                          │
│                                                                  │
│  fetcher.ts → calls coingecko.ts:fetchMarketSnapshot()          │
│    → axios.get("api.coingecko.com/coins/markets")               │
│    → returns 20 coins                                           │
│  fetcher.ts → writes to cache.ts: cache.set("price:bitcoin"...) │
│                                                                  │
│  detector.ts → reads prisma (users + watchlists from DB)        │
│  detector.ts → reads cache.ts: cache.getAll()                   │
│  detector.ts → if threshold breached → prisma.eventLog.create() │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  EVERY 5 SECONDS (Browser)                                       │
│                                                                  │
│  usePriceTicker.ts → fetch("/api/prices")                       │
│    → app/api/prices/route.ts (Next.js API)                      │
│    → internally fetch("localhost:4000/api/cache")               │
│    → server/index.ts returns cache.getAll()                     │
│    → prices/route.ts maps the data                              │
│    → returns clean JSON to browser                              │
│  usePriceTicker.ts → setPrices() → React re-renders dashboard   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  USER LOADS DASHBOARD                                            │
│                                                                  │
│  browser → GET /dashboard                                        │
│  middleware.ts → checks JWT cookie → validates session          │
│  app/dashboard/page.tsx (Server Component):                      │
│    → getServerSession(authOptions)  [lib/auth.ts]               │
│    → prisma.wishlist.findMany()     [lib/prisma.ts → PostgreSQL] │
│    → prisma.eventLog.findMany()                                  │
│    → prisma.user.findUnique()                                    │
│    → passes all data as props to DashboardClient.tsx            │
│  DashboardClient.tsx renders the full dashboard UI              │
│  usePriceTicker hook starts polling /api/prices every 5 seconds │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. WHERE TO MAKE CHANGES

| What you want to change | File to edit |
|------------------------|-------------|
| Add more coins to track | `server/services/coingecko.ts` — change `per_page: 20` to higher number |
| Change polling speed (backend) | `server/index.ts` — change `startFetcher(30000)` ms value |
| Change polling speed (frontend) | `app/dashboard/_hooks/usePriceTicker.ts` — change `setInterval(fetchLivePrices, 5000)` |
| Change alert threshold logic | `server/services/detector.ts` — edit the `tasks` array |
| Add a new API endpoint | Create a new folder in `app/api/` with a `route.ts` |
| Add a new database table | Edit `prisma/schema.prisma` → run `npx prisma migrate dev` |
| Change login page design | `app/login/page.tsx` |
| Change dashboard layout | `app/dashboard/_components/DashboardClient.tsx` |
| Change JWT token contents | `lib/auth.ts` → `jwt()` callback |
| Change session data | `lib/auth.ts` → `session()` callback |
| Change Google OAuth config | `lib/auth.ts` → `GoogleProvider({...})` |
| Change password hashing rounds | `app/api/register/route.ts` → `bcrypt.hash(password, 10)` — change `10` |
| Change dedup window (30 min) | `server/services/detector.ts` → `Math.floor(now / (30 * 60 * 1000))` |
| Change cooldown check (6 hours) | `server/services/detector.ts` → `initializeCooldowns()` → `6 * 60 * 60 * 1000` |
| Change middleware-protected routes | `middleware.ts` → `matcher` array |
| Add new log transport | `server/utils/logger.ts` → add new `winston.transports` |
| Change Express port | `.env` → set `PORT=4000` or change in `server/index.ts` |
| Change Next.js port | `package.json` → `"dev": "next dev -p 3000"` |

---

## MAIN LIBRARIES USED

| Library | Where Used | Purpose |
|---------|-----------|---------|
| `next` / `react` | Entire `app/` folder | Web framework + UI |
| `next-auth` | `lib/auth.ts`, `app/providers.tsx` | Auth sessions, JWT, Google OAuth |
| `@next-auth/prisma-adapter` | `lib/auth.ts` | Connects NextAuth to PostgreSQL |
| `prisma` / `@prisma/client` | `lib/prisma.ts`, all route files | Database ORM (Object-Relational Mapper) |
| `bcrypt` | `app/api/register/route.ts`, `lib/auth.ts` | Password hashing and verification |
| `express` | `server/index.ts` | Background HTTP server |
| `axios` | `server/services/coingecko.ts` | Makes HTTP requests to CoinGecko |
| `cors` | `server/index.ts` | Allows cross-origin requests (port 3000 → 4000) |
| `winston` | `server/utils/logger.ts` | Structured logging to files + console |
| `otplib` | `lib/two-factor.ts` | Generates TOTP 2FA secrets and verifies codes |
| `qrcode` | `lib/two-factor.ts` | Converts 2FA secret into scannable QR code |
| `dotenv` | `server/index.ts` | Loads `.env` variables into `process.env` |
| `concurrently` | `package.json` dev script | Runs Next.js and Express at the same time |
| `tsx` | `package.json` dev script | Runs TypeScript files directly (no compile step) |
| `framer-motion` | `DashboardClient.tsx` | Smooth UI animations |
| `lucide-react` | `DashboardClient.tsx` | Icon library |
