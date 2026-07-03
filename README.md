# FirstReply V1

Private access-key web app for students who want more replies to internship/job applications.

## Stack

- Next.js App Router
- TypeScript
- Tailwind
- Supabase
- Server-side AI route

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Supabase

Run the SQL in `supabase/schema.sql`.

Then create one access key manually:

```sql
insert into access_keys (key, active, credits_limit, credits_used)
values ('FIRST-DEMO-001', true, 30, 0);
```

## Environment variables

See `.env.example`.

## Test flow

1. Open `/`
2. Enter `FIRST-DEMO-001`
3. Access dashboard
4. Fill generator form
5. Generate messages
6. Check credits decrease
