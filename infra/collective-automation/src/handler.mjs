import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({});
const GOOGLE_HEADERS = [
  "x-goog-channel-id",
  "x-goog-channel-token",
  "x-goog-resource-id",
  "x-goog-resource-state",
  "x-goog-message-number",
  "x-goog-channel-expiration",
];

const normalizedHeaders = (headers = {}) =>
  Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)])
  );

export async function webhook(event) {
  const headers = normalizedHeaders(event.headers);
  const channelId = headers["x-goog-channel-id"];
  const resourceId = headers["x-goog-resource-id"];
  const channelToken = headers["x-goog-channel-token"];
  if (!channelId || !resourceId || !channelToken) {
    return { statusCode: 400, body: "Missing Google channel headers" };
  }

  const forwarded = Object.fromEntries(
    GOOGLE_HEADERS.flatMap((name) => (headers[name] ? [[name, headers[name]]] : []))
  );
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: process.env.CALENDAR_QUEUE_URL,
      MessageBody: JSON.stringify({ headers: forwarded }),
      MessageGroupId: undefined,
    })
  );
  // Google only needs a fast acknowledgement; verification and sync happen in
  // the app worker against the stored hash/resource id.
  return { statusCode: 204, body: "" };
}

async function forwardWebhook(record) {
  const payload = JSON.parse(record.body);
  const response = await fetch(process.env.APP_WEBHOOK_URL, {
    method: "POST",
    headers: payload.headers,
  });
  if (!response.ok) {
    throw new Error(`Collective webhook rejected ${response.status}: ${(await response.text()).slice(0, 180)}`);
  }
}

export async function worker(event) {
  const failures = [];
  for (const record of event.Records || []) {
    try {
      await forwardWebhook(record);
    } catch (error) {
      console.error("calendar webhook worker failed", {
        messageId: record.messageId,
        error: error instanceof Error ? error.message : String(error),
      });
      failures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures: failures };
}

export async function reconcile() {
  const response = await fetch(process.env.APP_RECONCILE_URL, {
    method: "POST",
    headers: {
      "x-calendar-cron-secret": process.env.CALENDAR_CRON_SECRET,
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Collective reconciliation failed ${response.status}: ${body.slice(0, 240)}`);
  }
  console.log("calendar reconciliation complete", body);
  return { statusCode: 200, body };
}
