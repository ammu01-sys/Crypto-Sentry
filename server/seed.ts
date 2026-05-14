// ==============================================================================
// DATABASE SURVEILLANCE SYNCHRONIZER (TYPESCRIPT)
// ==============================================================================
// This utility dynamically synchronizes the baseline prices of active alerts
// with real-time CoinGecko market rates to initialize them for surveillance.
// This prevents alerts from immediately triggering due to old baseline configurations.

import dotenv from 'dotenv';
dotenv.config(); // Load environment variables (.env) for database connections

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { fetchAllMarkets } from './services/coingecko';

const prisma = new PrismaClient();

async function main() {
  console.log('⚡ Starting dynamic database target initialization...');

  // 1. PASSWORD HASHING MODULE VERIFICATION
  const rawPassword = 'user_secure_pass';
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(rawPassword, saltRounds);
  console.log(
    `🔐 BCrypt Password Hashing Service: Active. Sample hash length: ${hashedPassword.length}`
  );

  // 2. DYNAMIC ALERT BASELINE INITIALIZATION
  console.log('🔍 Querying active alert benchmarks in database...');
  const alerts = await prisma.alert.findMany();

  if (alerts.length === 0) {
    console.log('ℹ️ No active alerts found in database to synchronize.');
    return;
  }

  console.log(
    `🌐 Fetching live coin pricing data from CoinGecko to update ${alerts.length} alert baselines dynamically...`
  );
  try {
    const markets = await fetchAllMarkets(false, true); // Fetch top 250 assets
    if (markets && Array.isArray(markets)) {
      let updatedCount = 0;

      for (const alert of alerts) {
        const liveCoin = markets.find((c) => c.id === alert.assetId);
        if (liveCoin) {
          await prisma.alert.update({
            where: { id: alert.id },
            data: { price: liveCoin.current_price },
          });
          console.log(
            `   - Synced ${alert.assetId.toUpperCase()} baseline to current live price: $${liveCoin.current_price.toFixed(2)}`
          );
          updatedCount++;
        }
      }

      console.log(
        `✅ Dynamically initialized baseline prices for ${updatedCount} alerts to align with live market rates!`
      );
    }
  } catch (error: any) {
    console.error('⚠️ Could not fetch live prices from CoinGecko:', error.message || error);
  }
}

main()
  .catch((error) => {
    console.error('❌ Synchronization failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🔌 Disconnected Prisma connection cleanly.');
  });
