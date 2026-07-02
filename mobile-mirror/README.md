# MG Team Mobile Mirror

Static PWA for `mobile.mgteamoficial.site`.

This app is intentionally separate from the main Next.js CRM. It reads data with
the public Supabase client and Row Level Security, so it does not change CRM
routes, APIs, database schema, or server-side message providers.

Deployment requires a generated `config.js` with:

- `supabaseUrl`
- `supabaseAnonKey`
- `crmBaseUrl`

Do not put service-role keys in this app.
