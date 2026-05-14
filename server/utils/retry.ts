// ==============================================================================
// EXPONENTIAL BACKOFF RETRY UTILITY WITH JITTER (TYPESCRIPT)
// ==============================================================================
// In production backends, external network calls (like CoinGecko) can fail due to
// momentary internet drops, server timeouts, or rate limits.
//
// Retrying immediately is bad because it can worsen server overload.
// This utility handles failures gracefully using two industry best practices:
// 1. EXPONENTIAL BACKOFF: The waiting time increases exponentially with each retry
//    (e.g., wait 1s, then 2s, then 4s, then 8s) to give the target system room to recover.
// 2. JITTER: Adds a small random variance to the wait time. This prevents multiple
//    distributed clients from retrying at the exact same millisecond, which can crash databases.

import logger from './logger';

/**
 * Executes an asynchronous function. If it fails, retries it with exponential backoff and randomized jitter.
 *
 * @param fn - The asynchronous function to execute (wrapped inside an arrow function)
 * @param maxRetries - Maximum number of retries before giving up (Default: 3)
 * @param delayMs - Initial starting delay in milliseconds (Default: 1000ms)
 * @param backoffMultiplier - Rate of exponential curve scaling (Default: 2, meaning delay doubles each time)
 * @returns The successful return value of the async function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000,
  backoffMultiplier = 2
): Promise<T> {
  let currentAttempt = 0;
  let currentDelay = delayMs;

  while (currentAttempt <= maxRetries) {
    try {
      // Execute passed async task
      return await fn();
    } catch (error: any) {
      currentAttempt++;

      // If maximum attempts are exhausted, throw error
      if (currentAttempt > maxRetries) {
        logger.error(
          `Operation failed after ${maxRetries} retry attempts. Propagating error to caller.`
        );
        throw error;
      }

      // Check for HTTP 429 Rate Limit
      const isRateLimit = error.response?.status === 429;
      let finalDelay = 0;

      if (isRateLimit) {
        logger.warn(
          'Rate limit hit (HTTP 429) from external API. Initiating an immediate 15-second cooldown pause before retrying...'
        );
        await new Promise((resolve) => setTimeout(resolve, 15000));

        // Ensure subsequent retries wait at least 15 seconds as well
        finalDelay = Math.max(15000, currentDelay * backoffMultiplier);
      } else {
        // ADD RANDOMIZED JITTER (+- 10% of the current delay)
        const jitter = (Math.random() - 0.5) * 0.2 * currentDelay;
        // Ensure delay is never less than 100ms
        finalDelay = Math.max(100, Math.round(currentDelay + jitter));
      }

      logger.warn(
        `Operation failed (Attempt ${currentAttempt}/${maxRetries}). Retrying in ${finalDelay}ms... Error: %s`,
        error.message || error
      );

      // Wait finalDelay milliseconds before trying again
      await new Promise((resolve) => setTimeout(resolve, finalDelay));

      // Scale delay for exponential curve
      currentDelay = isRateLimit ? finalDelay : currentDelay * backoffMultiplier;
    }
  }

  throw new Error('Unreachable code in retryWithBackoff');
}
