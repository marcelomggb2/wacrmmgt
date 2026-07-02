# WACRM VPS modularization plan

This is an opt-in infrastructure layer for a future VPS migration. It keeps the
current Hostinger deployment untouched while preparing the app to run as logical
services on one machine.

## Marcus: infrastructure and data

### Runtime services

- `app`: Next.js UI plus the current core API.
- `redis`: internal Redis used for short-lived state and async queues.
- `worker`: Node.js background process for queue consumption.

The initial `docker-compose.yml` keeps Supabase external. Redis is only exposed
on the internal Docker network, never publicly.

### Webhook isolation

With the initial three-container layout, the webhook route is isolated by
behavior, not by a separate public process:

1. `/api/instagram/webhook/*` should validate Meta signature and channel data.
2. It should write a compact job to Redis.
3. It should return HTTP 200 quickly.
4. The `worker` should process Graph API calls, CRM mutations, tags, deals, and
   long-running automation work in the background.

When traffic grows, add a second Next.js service from the same image:

```yaml
webhook:
  build:
    context: .
    dockerfile: Dockerfile
  command: npm run start
  env_file:
    - .env.vps
  environment:
    NODE_ENV: production
    REDIS_URL: redis://redis:6379/0
    WACRM_PROCESS_ROLE: webhook
  depends_on:
    redis:
      condition: service_healthy
  networks:
    - wacrm-internal
  restart: unless-stopped
```

Then route only Meta callbacks to it at the reverse proxy:

```nginx
location /api/instagram/webhook/ {
  proxy_pass http://webhook:3000;
}

location /api/whatsapp/webhook {
  proxy_pass http://webhook:3000;
}

location / {
  proxy_pass http://app:3000;
}
```

That gives hard memory/process isolation while preserving the same codebase.

### Required environment shape

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: browser-safe Supabase anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key for webhooks/workers.
- `ENCRYPTION_KEY`: same 64-character hex value in app, webhook, and worker.
- `META_APP_SECRET`: same Meta app secret in app, webhook, and worker.
- `META_APP_ID`: required for media/template upload helpers.
- `META_GRAPH_API_VERSION`: pinned Graph API version.
- `NEXT_PUBLIC_SITE_URL`: canonical CRM URL.
- `NEXT_PUBLIC_INSTAGRAM_WEBHOOK_ORIGIN`: dedicated Instagram callback origin.
- `REDIS_URL`: internal Redis URL, usually `redis://redis:6379/0`.
- `INTERNAL_APP_ORIGIN`: internal service URL, usually `http://app:3000`.
- `INTERNAL_WORKER_ENDPOINT`: internal endpoint consumed by the worker.
- `INTERNAL_WORKER_TOKEN`: shared secret for app-worker calls.
- `MESSAGE_QUEUE_NAMES`: queue list, for example
  `meta:webhooks,instagram:webhooks,whatsapp:webhooks`.
- `MESSAGE_DEAD_LETTER_QUEUE`: queue used for poison messages.

## Sofia: SaaS, middleware, and UX

### Frontend contract

Keep React and Next.js pointed at the same public WACRM origin. The browser
should not call Redis, worker, n8n, or any internal container directly.

The frontend should continue to call stable BFF routes under `/api/*`, for
example:

- `/api/inbox/send`
- `/api/inbox/start-conversation`
- `/api/inbox/channels`
- `/api/automations/*`

Those routes can later enqueue work, poll status, or read persisted state
without changing the UI contract.

### n8n integration

If n8n is added later, treat it as an internal automation engine:

- WACRM sends signed internal webhooks to n8n over the Docker network.
- n8n returns results through a dedicated WACRM internal callback route.
- Every internal request carries `x-internal-worker-token` or a dedicated
  `x-wacrm-n8n-signature` HMAC header.
- n8n receives minimal payloads: IDs and context, not long-lived Meta tokens.
- WACRM remains the system of record for accounts, contacts, conversations,
  tags, and deals.

Recommended internal pattern:

```text
WACRM /api/automations/run
  -> Redis queue
  -> worker
  -> http://n8n:5678/webhook/wacrm/<flow>
  -> WACRM /api/internal/n8n/callback
```

### Media strategy

Do not store Instagram or WhatsApp media permanently on the VPS disk.

Preferred approach:

1. Download media from Meta/UAZAPI only when required.
2. Upload it immediately to object storage such as Supabase Storage, S3,
   Cloudflare R2, or another S3-compatible bucket.
3. Persist only metadata in Postgres:
   `provider`, `media_id`, `mime_type`, `size`, `storage_bucket`,
   `storage_path`, `sha256`, and `expires_at`.
4. Serve the UI with signed URLs.
5. Add lifecycle rules to expire raw media after the retention window.

The VPS should keep only transient temp files, logs with rotation, and Redis AOF
data. Media belongs in object storage.
