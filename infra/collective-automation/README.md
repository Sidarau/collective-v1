# Collective calendar automation

This is a separate serverless stack. It does not modify or replace the
`zeug-linear-orchestrator`, which remains the only project-management Lambda.

It gives Calendar v2 three small reliability jobs:

1. acknowledge Google push notifications quickly and put their signed headers
   onto an encrypted SQS queue;
2. retry delivery to Collective's verified webhook, with a dead-letter queue;
3. reconcile calendars and renew Google watch channels every day at 04:15 in
   `Europe/Madrid`.

The OAuth screen, encrypted refresh tokens, permissions, approvals, and MCP
tools stay inside Collective. Lambda never receives a Google refresh token.

## Local validation

```bash
cd infra/collective-automation
sam validate --lint
sam build
```

## Deploy after the app has passed Alex's test

```bash
sam deploy --guided \
  --stack-name collective-calendar-automation \
  --region us-west-2 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    AppWebhookUrl=https://opencollective.app/api/google/calendar/webhook \
    AppReconcileUrl=https://opencollective.app/api/google/calendar/reconcile \
    CalendarCronSecret=REDACTED
```

Copy the `GoogleWebhookUrl` output into the app's
`GOOGLE_CALENDAR_WEBHOOK_URL`. Store `CalendarCronSecret` in the same secrets
manager used for the app; never commit it.
