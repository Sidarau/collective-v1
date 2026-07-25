import * as crypto from "node:crypto";

export interface CalendarOAuthTarget {
  inviteId: string;
  adminId: string;
}

export function signCalendarOAuthTargetValue(
  target: CalendarOAuthTarget,
  secret: string
): string {
  const payload = Buffer.from(JSON.stringify(target), "utf8").toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyCalendarOAuthTargetValue(
  signed: string,
  secret: string
): CalendarOAuthTarget | null {
  const [payload, signature] = signed.split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      inviteId?: string;
      adminId?: string;
    };
    return value.inviteId && value.adminId
      ? { inviteId: value.inviteId, adminId: value.adminId }
      : null;
  } catch {
    return null;
  }
}
