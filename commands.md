
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

```

### 🔹 Background Surveillance Server
Runs the Express daemon on port `4000` to monitor prices, compute indicators, and trigger active alerts.
```bash
# Start the surveillance server daemon in dev mode (hot-reloads via tsx watch)
npm run server

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
- **Frontend Panel Portal:** `http://localhost:3000/dashboard`
- **In-Memory Markets Cache:** `http://localhost:4000/api/cache`
- **Active DB Alert Interceptors:** `http://localhost:4000/api/alerts`


Login session
http://localhost:3000/api/auth/session
