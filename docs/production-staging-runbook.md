# Production and Staging Runbook

This project uses `main` for production and `staging` for parallel development.

## Production: current 2-number rollout

Use production conservatively with up to 2 official WhatsApp numbers.

1. Back up the production Supabase database.
2. In the production Supabase SQL Editor, run:
   `supabase/migrations/024_multi_channel_inbox.sql`
3. Verify the production database:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'whatsapp_config'
  and column_name = 'label';

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'conversations'
  and column_name = 'whatsapp_config_id';

select indexname
from pg_indexes
where schemaname = 'public'
  and indexname = 'idx_conversations_whatsapp_config';

select conname
from pg_constraint
where conname = 'whatsapp_config_account_id_key';
```

Expected result: the first three queries return one row each, and the last query returns zero rows.

4. Redeploy or restart the Hostinger production app from `main`.
5. Configure only 2 official WhatsApp numbers in production.
6. Smoke test production:
   - login works
   - inbox opens
   - channel selector shows both numbers
   - inbound message lands in the correct channel
   - manual reply leaves through the same channel
   - old conversations remain visible in All channels

Do not enable Instagram, unofficial WhatsApp API, or broad multi-channel broadcasts in production yet.

## Staging: parallel development

Use `staging` for all feature work before production.

1. Create a separate Supabase project for staging.
2. Apply all migrations to staging before testing app changes.
3. Create a separate Hostinger deployment for the `staging` branch, for example `staging.mgteamoficial.com`.
4. Store staging env vars separately from production.
5. Develop features in feature branches and merge into `staging` first.
6. Merge `staging` into `main` only after validation.

Recommended feature order:

1. PT-BR interface pass.
2. Harden official WhatsApp support for up to 5 numbers.
3. Add explicit channel selection for templates and broadcasts.
4. Add Instagram DM support.
5. Add unofficial WhatsApp API support.

## Required checks before promoting staging to main

Run or verify:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Then test webhook receive and manual send against the staging Supabase and staging deployment.
