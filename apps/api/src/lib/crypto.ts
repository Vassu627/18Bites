import crypto from "crypto";

export function hashOtp(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function generateDeliveryOtp(): string {
  return generateOtp();
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
