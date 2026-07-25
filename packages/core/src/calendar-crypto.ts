import * as crypto from "node:crypto";

const VERSION = "v1";

function decodeKey(raw: string): Buffer {
  const value = raw.trim();
  const key = /^[a-f0-9]{64}$/i.test(value)
    ? Buffer.from(value, "hex")
    : Buffer.from(value, "base64");
  if (key.length !== 32) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must be 32-byte base64 or 64-character hex");
  }
  return key;
}

export function encryptCalendarSecret(plaintext: string, rawKey: string): string {
  if (!plaintext) throw new Error("Cannot encrypt an empty calendar secret");
  const key = decodeKey(rawKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptCalendarSecret(ciphertext: string, rawKey: string): string {
  const [version, ivRaw, tagRaw, bodyRaw] = ciphertext.split(".");
  if (version !== VERSION || !ivRaw || !tagRaw || !bodyRaw) {
    throw new Error("Unsupported calendar secret ciphertext");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    decodeKey(rawKey),
    Buffer.from(ivRaw, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(bodyRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function hashCalendarToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
