# AGENTS.md — FirstReply

## Product Goal

FirstReply is a private web app for students who want to get more replies to internship/job applications.

It helps them:
1. Find the right contact.
2. Generate a short, human outreach message.
3. Track who to follow up with and when.

Core promise:
Obtiens ta première réponse plus vite.

## Target User

French-speaking students looking for:
- internship
- alternance
- first junior role

They struggle because:
- they apply on LinkedIn and get ignored
- they do not know who to contact
- they hate writing generic motivation letters
- they forget to follow up

## Product Positioning

FirstReply is not a classic job board.
It is a simple private system to stop applying into the void.

Tone:
- direct
- useful
- tactical
- credible
- not fake guru
- not illegal

Avoid:
- guaranteed job claims
- fake urgency
- spam automation
- illegal scraping
- tax evasion language

## V1 Scope

Build the smallest useful version.

V1 includes:
- Access key gate
- Dashboard
- Message generator
- Follow-up tracker
- Credits per access key
- Supabase for access keys and usage tracking
- AI generation via server-side API route

V1 does not include:
- full user accounts
- Stripe payment
- automated email sending
- scraping
- Chrome extension
- admin dashboard
- resume analyzer
- ATS scoring

## Core Product Flow

1. Student receives an access key after payment.
2. Student enters access key.
3. App validates key in Supabase.
4. Student enters company/contact/profile info.
5. AI generates:
   - cold email
   - LinkedIn DM
   - follow-up J+3
   - follow-up J+7
6. One credit is consumed.
7. Student can add the target to the tracker.

## Technical Rules

Use:
- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase
- Server-side AI route

Rules:
- API keys must never be exposed in the browser.
- Keep changes small.
- Do not add full auth unless asked.
- Do not implement scraping.
- Do not automate mass outreach.
- Prefer a working V1 over perfect architecture.
- After each change, explain how to test.

## Brand

Name:
FirstReply

Tagline:
Obtiens ta première réponse plus vite.

Primary copy:
Trouve le bon contact. Génère le bon message. Relance au bon moment.

Visual direction:
- clean dark UI
- premium student tool
- subtle tactical language
- no cringe hacker theme

## Current Task

Build the FirstReply V1 skeleton with access key validation, dashboard, generator UI, tracker UI, Supabase schema, and API placeholders.
