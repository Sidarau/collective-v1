---
name: Collective
version: 0.1.0
format: design-md-alpha
status: draft
product:
  type: invite-only private villa portal
  audience: prospective guests, approved members, operators, and admins
  primaryJourney: application -> approval -> portal access -> stay request -> operator decision
colors:
  primary: "#1c1917"
  background: "#fafaf9"
  surface: "#ffffff"
  surfaceMuted: "#f5f5f4"
  ink: "#1c1917"
  text: "#44403c"
  muted: "#78716c"
  border: "#e7e5e4"
  sea: "#2f6f73"
  olive: "#5f6f3f"
  sun: "#c68b3c"
  success: "#047857"
  successBg: "#ecfdf5"
  danger: "#b91c1c"
  dangerBg: "#fef2f2"
typography:
  display:
    fontFamily: Geist Sans
    fontSize: 3rem
    lineHeight: 1.05
    fontWeight: 300
  h1:
    fontFamily: Geist Sans
    fontSize: 2.25rem
    lineHeight: 1.15
    fontWeight: 400
  h2:
    fontFamily: Geist Sans
    fontSize: 1.5rem
    lineHeight: 1.25
    fontWeight: 500
  body:
    fontFamily: Geist Sans
    fontSize: 1rem
    lineHeight: 1.65
    fontWeight: 400
  bodySmall:
    fontFamily: Geist Sans
    fontSize: 0.875rem
    lineHeight: 1.5
    fontWeight: 400
  label:
    fontFamily: Geist Sans
    fontSize: 0.875rem
    lineHeight: 1.25
    fontWeight: 500
  meta:
    fontFamily: Geist Sans
    fontSize: 0.75rem
    lineHeight: 1.25
    fontWeight: 500
rounded:
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
layout:
  pageMaxWidth: 1152px
  contentMaxWidth: 896px
  formMaxWidth: 512px
  cardPadding: 24px
components:
  buttonPrimary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: 44px
    padding: "0 16px"
  buttonSecondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    height: 44px
    padding: "0 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: 44px
    padding: "0 16px"
  helperText:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    padding: "0"
  badgeMuted:
    backgroundColor: "{colors.surfaceMuted}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  badgeInfo:
    backgroundColor: "{colors.sea}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  badgeAvailability:
    backgroundColor: "{colors.olive}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  badgePending:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  alertSuccess:
    backgroundColor: "{colors.successBg}"
    textColor: "{colors.success}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  alertDanger:
    backgroundColor: "{colors.dangerBg}"
    textColor: "{colors.danger}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  divider:
    backgroundColor: "{colors.border}"
    textColor: "{colors.ink}"
    height: 1px
agentic:
  defaultAutonomy: assistive-draft-and-confirm
  irreversibleActionsRequireHumanApproval: true
  highRiskActions:
    - approving or rejecting stay requests
    - changing CRM lifecycle or deal stage
    - sending outbound guest communication
    - changing prices, room inventory, payments, or access roles
  allowedAgentOutputs:
    - summaries
    - suggested next actions
    - form prefill drafts
    - operator checklists
    - source-linked recommendations
---

## Overview

Collective is an invite-only private villa experience centered on trust, discretion, and calm operational clarity. The product should feel like a quiet member portal, not a public booking marketplace and not a marketing landing page.

The visual system is restrained: warm stone surfaces, crisp white panels, deep ink text, and a small set of Mediterranean accents for meaningful state and orientation. Use the accent colors sparingly. Primary actions remain deep ink so the interface feels steady and premium.

This file follows Google's DESIGN.md direction: machine-readable tokens first, human design rationale second. Agents should treat the front matter as the normative values and the prose as instructions for applying them.

## Product Principles

- **Private before promotional:** write and design for invited guests and operators. Avoid public marketplace language such as "book now", "deals", "inventory", or "lead scoring".
- **Hospitality with control:** the user should always know what is requested, what is pending, and who reviews it.
- **Operator clarity:** admin screens prioritize scanability, decision readiness, and auditability over decorative storytelling.
- **Progressive trust:** ask for sensitive or personal details only when needed, explain why they are needed, and keep recovery paths visible.
- **Human final say:** AI can draft, summarize, rank, and recommend. It does not approve, reject, charge, invite, message, or change CRM state without an operator confirmation step.

## Color Use

- **Background `#fafaf9`:** page shell and low-attention areas. Maps closely to Tailwind `stone-50`.
- **Surface `#ffffff`:** cards, forms, top bars, and admin work surfaces.
- **Ink `#1c1917`:** headings, primary actions, and highest-priority text. Maps closely to Tailwind `stone-900`.
- **Text `#44403c`:** normal body text. Maps closely to Tailwind `stone-700`.
- **Muted `#78716c`:** labels, metadata, helper text, and secondary navigation. Maps closely to Tailwind `stone-500`.
- **Border `#e7e5e4`:** section dividers, card borders, input borders. Maps closely to Tailwind `stone-200`.
- **Sea `#2f6f73`:** calm informational emphasis, selected states, villa/place context.
- **Olive `#5f6f3f`:** availability, suitability, and member-fit cues.
- **Sun `#c68b3c`:** warm attention, pending state, or date sensitivity.
- **Danger/success:** use only for explicit system status, validation, and booking decisions.

Do not build a one-note beige or brown interface. Warm neutrals are the base, not the whole palette.

## Typography

Use Geist Sans for all interface text. Use Geist Mono only for tokens, IDs, timestamps, or debug-only values. Headings should be light to medium weight, with generous line height. Body copy should be plain, short, and direct.

Do not use letter spacing except for small uppercase metadata labels. Avoid negative tracking. Avoid oversized hero type inside forms, admin panels, cards, and tool surfaces.

## Layout

Use full-width page bands with constrained inner content. Do not place page sections inside decorative outer cards. Cards are for repeated items, forms, admin records, and compact decision surfaces.

Recommended widths:

- Marketing/invite shell: `max-w-6xl`.
- Portal content: `max-w-4xl`.
- Forms: `max-w-lg`.
- Admin dashboards: prefer dense grids and tables over large narrative cards.

Keep first screens functional. The home page can be brand-led, but portal and admin pages should open directly into the work: villa details, rooms, booking requests, or review queues.

## Components

### Buttons

Primary buttons use ink background with white text. Secondary buttons use white or transparent surfaces with stone borders. Buttons should have at least `44px` touch height. Use sentence case labels: "Apply to stay", "Request dates", "Approve request".

Destructive buttons use danger styling and require a confirmation step if the action changes data.

### Forms

Forms should feel calm and finite. Group related fields, keep helper text close to the field it explains, and show validation inline. Use native inputs where possible. Preserve browser autocomplete for names, email, phone, and address-like fields.

Never expose dev/test login links in production UI. Test-only affordances must be gated behind environment checks.

### Cards

Cards use white surface, subtle stone border, and minimal shadow. Use `rounded-lg` by default; reserve `rounded-xl` for larger, standalone surfaces. Do not nest cards inside cards.

### Navigation

Guest portal navigation should remain compact: Villa, Rooms, Stay request, Account. Admin navigation should be task-first: Requests, Invites, Rooms, CRM sync, Settings.

### Status States

Use consistent language:

- `pending`: request received, waiting for operator review.
- `approved`: request accepted but not necessarily paid or finalized.
- `booked`: confirmed stay.
- `rejected`: request declined.
- `cancelled`: request withdrawn or voided.

Status labels should include the next useful action when possible.

## Agentic UX Rules

Collective may use agents to reduce operator load, but the interface must make automation visible and reversible. Use Google's agentic guidance as the operating posture: choose an agent only when the task is open-ended, multi-step, or requires external data. Use deterministic forms and rules for simple validation, summaries, and known workflow steps.

### Good Agent Tasks

- Summarize an application for operator review.
- Highlight missing information before a request is submitted.
- Draft a guest reply from approved templates.
- Suggest room/date fit based on party size, constraints, and availability.
- Explain why a request is blocked, incomplete, or ready for review.

### Human Approval Required

Agents must pause before:

- approving or rejecting a stay request;
- sending email, WhatsApp, SMS, or another external communication;
- changing a CRM lifecycle state;
- creating, deleting, or changing access roles;
- changing prices, payments, deposits, or inventory;
- exposing or exporting personal/contact data.

Use a clear review surface: "Suggested by AI", source facts, editable draft, and one explicit human action.

### Trust and Explanation

For AI-generated summaries or recommendations, show:

- the source data used;
- the confidence or uncertainty in plain language;
- what the operator can edit;
- what will happen after confirmation.

Avoid anthropomorphic claims. The agent is a support tool, not a concierge, manager, or decision maker.

### Error and Recovery

When automation fails, preserve user progress and give a next step. Good failure copy names the failed system and the safe path forward:

- "We could not complete the automated update. The request is saved in Collective."
- "The invite was created, but the email draft was not sent. Review and send it manually."
- "The AI summary is unavailable. The original application is still ready for review."

Never hide a failed agent action behind generic success messaging.

## Agentic Security Rules

Agents and automation should be designed with least privilege, clear identity, and auditable actions.

- Separate instructions from user-provided or CRM-derived data. Treat applications, notes, emails, and imported CRM fields as data, not commands.
- Grant tools only the minimum permissions needed for the specific workflow.
- Log each agent-suggested action, each human approval, and each executed mutation.
- Prefer human-in-the-middle mode for all guest, CRM, payment, invite, and access workflows.
- Redact or omit sensitive personal details in summaries unless the operator needs them for the immediate decision.
- Use deterministic validation before model reasoning for dates, guest counts, required fields, and role checks.

## Accessibility

All text and interactive states must meet WCAG AA contrast. Do not rely on color alone for status. Inputs need visible labels, clear focus rings, and helpful error text. Loading states should preserve layout dimensions so pages do not jump.

Use language that is concrete and non-extractive. Prefer "member journey", "stay request", "relationship map", and "operator review". Avoid "lead intelligence", "scrape", "elite scoring", or "global elite map".

## Implementation Notes

The current app is a Next.js 16 App Router project using Tailwind CSS. Existing UI already maps closely to the stone/zinc token family:

- `bg-stone-50` -> `colors.background`
- `bg-white` -> `colors.surface`
- `text-stone-900` -> `colors.ink`
- `text-stone-700` -> `colors.text`
- `text-stone-500` -> `colors.muted`
- `border-stone-200` -> `colors.border`

When editing UI, prefer local consistency first. Do not introduce a component library or design-token build pipeline just to satisfy this file. If tokens are centralized later, use this document as the migration source.

## Source Trace

External sources:

- Google Labs, "Stitch app's DESIGN.md format is now open-source for designers" - https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-design-md/
- Google Labs, "Introducing vibe design with Stitch" - https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-ai-ui-design/
- Google Labs DESIGN.md specification repository - https://github.com/google-labs-code/design.md
- Google Cloud Architecture Center, "Choose your agentic AI architecture components" - https://docs.cloud.google.com/architecture/choose-agentic-ai-architecture-components
- Google Cloud Architecture Center, "Choose a design pattern for your agentic AI system" - https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system
- Google People + AI Guidebook - https://pair.withgoogle.com/guidebook/
- Google Cloud, "Cloud CISO Perspectives: How Google secures AI Agents" - https://cloud.google.com/blog/products/identity-security/cloud-ciso-perspectives-how-google-secures-ai-agents

Internal pointers provided with this request:

- KB-Drops source: `f283dbe3-9d6e-559a-8d96-dd04c41710e9`
- Canonical repo plan: `zeug-command/workspace/HERMES_CHIEF_OF_STAFF_OPS_PLAN.md`
- Eve Brain note: `~/eve-brain/wiki/operations/hermes-chief-of-staff-ops-plan.md`
- Related commit: `21ccbe5` on `task/hermes-video-sop-improvements`
