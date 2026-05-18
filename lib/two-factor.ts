// Generates TOTP secrets, QR codes, and validates 2FA tokens for two-factor authentication.
import { generateSecret, generateURI, verifySync } from "otplib";
import qrcode from 'qrcode';

/**
 * Generates a new 2FA secret (Base32 encoded)
 */
export const generateTwoFactorSecret = () => {
  return generateSecret();
};

/**
 * Generates a QR code data URL for the given secret
 */
export const generateQRCode = async (email: string, secret: string) => {
  const otpauth = generateURI({
    issuer: "Crypto Sentry",
    label: email,
    secret,
  });
  return qrcode.toDataURL(otpauth);
};

/**
 * Verifies a 2FA token against a secret
 */
export const verifyToken = (token: string, secret: string) => {
  const result = verifySync({ token, secret });
  return result.valid;
};
