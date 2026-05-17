# 🛡️ Bitbash Crypto Sentry: Project Workflow Guide

This guide explains how the **Crypto Sentry** works, how the files are organized, and the logic behind every component. Designed for easy understanding during evaluations.

---

## 1. The "Two Hearts" Architecture
This project is built using a **Decoupled Architecture**. It has two separate systems working together:

1.  **The Frontend (The Face):** Built with **Next.js**. This is what the user sees, clicks, and interacts with.
2.  **The Background Engine (The Brain):** Built with **Express.js**. This runs 24/7 in the background, even if no one is looking at the website. It watches the markets.

---

## 2. Folder & File Breakdown

### 📂 `prisma/` (The Blueprint)
*   **`schema.prisma`**: The master plan for your database. It defines what a "User," "Alert," and "Watchlist" item looks like.
*   **Purpose:** Prisma reads this file to build your tables in **PostgreSQL**.

### 📂 `server/` (The Background Engine)
This is the "Security Guard" of the app.
*   **`index.ts`**: The entry point. It starts the background timers.
*   **`services/coingecko.ts`**: The **Fetcher**. It talks to the outside world to get live crypto prices.
*   **`services/cache.ts`**: The **Pantry**. It stores prices in RAM (Memory) so they can be accessed instantly (Low Latency).
*   **`services/detector.ts`**: The **Brain**. It compares live prices against user alerts. If it finds a price drop, it logs a "Breach."

### 📂 `app/` (The Front Desk & UI)
This is the **Next.js** folder.
*   **`dashboard/`**: The main page where users see their coins and charts.
*   **`api/`**: The "Internal Phone Lines." These allow the website to talk to the database securely.
*   **`login/` & `signup/`**: The entry gates for users.

### 📂 `lib/` (The Toolbox)
*   **`auth.ts`**: Rules for login (NextAuth with Prisma Adapter).
*   **`prisma.ts`**: The "Plug" that connects your code to the database (Singleton pattern).

---

## 3. The "Path of a Price Alert" (Step-by-Step)

How does the app actually work in real-time? Follow the numbers:

1.  **FETCH:** Every 30 seconds, `coingecko.ts` grabs the latest prices from the internet.
2.  **CACHE:** `fetcher.ts` takes those prices and writes them into `cache.ts` (RAM).
3.  **DETECT:** `detector.ts` looks at the cache and then looks at the **Alerts Table** in the database. 
4.  **LOG:** If Bitcoin drops by 5%, the detector creates an entry in the **EventLog** table in PostgreSQL.
5.  **DISPLAY:** The user’s **Dashboard** (which checks the API every few seconds) sees the new log and shows a notification on the screen.

---

## 4. Key Concepts to Remember

### 🔑 Authentication (NextAuth + Prisma)
We use **NextAuth** with the **Prisma Adapter**. This means user accounts, sessions, and social logins (like Google) are all stored in our PostgreSQL database.

### ⚡ Low Latency & Caching
We don't ask the database for prices because databases are slow. We store prices in **Memory (RAM)**. Reading from RAM is 100,000x faster than reading from a database, which makes the app feel "instant."

### 🔄 CRUD Operations
*   **CREATE:** Adding a coin to the watchlist.
*   **READ:** Viewing the dashboard.
*   **UPDATE:** Changing your alert settings.
*   **DELETE:** Removing a coin from the list.

---

## 5. Summary Table for Evaluation

| Question | Answer |
| :--- | :--- |
| **Backend Language?** | Node.js / Express (TypeScript) |
| **Frontend Framework?** | Next.js 15 (React) |
| **Database?** | Standalone **PostgreSQL** |
| **ORM?** | **Prisma** |
| **Auth System?** | **NextAuth** with Prisma Adapter |
| **How are prices live?** | Background engine polls every 30s and updates an in-memory cache |
