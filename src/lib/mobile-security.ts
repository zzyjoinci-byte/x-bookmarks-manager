import crypto from "crypto";

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export function toIso(date: Date): string {
  return date.toISOString();
}

export function isExpired(value: string | null | undefined): boolean {
  if (!value) return true;
  return new Date(value).getTime() <= Date.now();
}
