# 🖥️ SENTRY SYSTEM OPERATIONAL COMMANDS

Use these standard commands inside your terminal to manage, run, compile, and configure the Sentry Cyber-Terminal.

---

## 1. Primary Servers (Core Stack)

### 🔹 Full Stack Surveillance (Simultaneous)
Launches both the Next.js dashboard and the Express engine in parallel.
```bash
# Run both servers simultaneously using concurrently
npm run dev:all
```

### 🔹 Next.js Frontend Dashboard
Serves the security console at `http://localhost:3000`.
```bash
# Run the Next.js Frontend in development mode (with hot-reload)
npm run dev

# Build the Next.js Frontend for production bundle optimization
npm run build

# Start the compiled production Next.js Frontend
npm run start
```

### 🔹 Background Surveillance Server
Runs the Express daemon on port `4000` to monitor prices, compute indicators, and trigger active alerts.
```bash
# Start the surveillance server daemon in dev mode (hot-reloads via tsx watch)
npm run server

# Start the surveillance server in production mode
npm run server:start
```

---

## 2. Database Schema & Seed Management

Synchronize, apply, or reset tables on your PostgreSQL instance using the Prisma Client.
```bash
# Apply migrations and update database schema
npx prisma migrate dev

# Sync local prisma schema definitions directly to database tables (Dry run/Push)
npx prisma db push

# Re-generate the TS static typings inside node_modules/@prisma/client
npm run prisma:generate

# Synchronize / reset target price benchmarks with live CoinGecko rates
npm run db:seed
```

---

## 3. Network Diagnostics (Surveillance Checking)

Use these URLs inside your browser or curl/postman clients to inspect in-memory cached feeds and alerts.
- **Frontend Panel Portal:** `http://localhost:3000/dashboard`
- **In-Memory Markets Cache:** `http://localhost:4000/api/cache`
- **Active DB Alert Interceptors:** `http://localhost:4000/api/alerts`