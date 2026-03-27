# Plausible CE via Dokploy

This directory vendors a Plausible Community Edition deployment adapted for Dokploy.

The base compose layout and ClickHouse tuning files come from the Plausible CE upstream `v3.2.0` release:

- https://github.com/plausible/community-edition
- https://github.com/plausible/community-edition/wiki/Configuration
- https://github.com/plausible/community-edition/wiki/reverse-proxy

## Recommended Hostname

Use a dedicated subdomain such as `plausible.boilerhaus.org`.

Plausible CE is designed for a subdomain install, not a subpath.

## Dokploy Setup

1. Create a DNS `A` record for `plausible.boilerhaus.org` pointing to the VPS.
2. In Dokploy, create a new Docker Compose app from this repo.
3. Point it at [`infra/plausible/compose.yml`](./compose.yml).
4. Add environment variables from [`infra/plausible/.env.example`](./.env.example).
5. In the Dokploy Domains tab, add `plausible.boilerhaus.org` and route it to the `plausible` service on port `8000`.
6. Deploy.

Why port `8000`:

- Plausible CE defaults `HTTP_PORT` to `8000`
- When Traefik or Dokploy terminates TLS, Plausible should stay on plain HTTP internally
- You do not need Plausible's built-in Let's Encrypt flow behind Dokploy

## Required Env Vars

```env
BASE_URL=https://plausible.boilerhaus.org
SECRET_KEY_BASE=<generate with: openssl rand -base64 48>
TOTP_VAULT_KEY=<generate with: openssl rand -base64 32>
HTTP_PORT=8000
```

Recommended first deploy:

```env
DISABLE_REGISTRATION=false
ENABLE_EMAIL_VERIFICATION=false
MAILER_ADAPTER=Bamboo.Mua
```

After creating the first admin user, tighten registration:

```env
DISABLE_REGISTRATION=invite_only
```

## Email

SMTP is optional. Keep `MAILER_ADAPTER=Bamboo.Mua` unless you are configuring a different supported adapter. Leave the SMTP settings blank unless you want:

- password reset emails
- email verification
- weekly/monthly reports

For an initial single-admin setup, it is simpler to skip email until the instance is running.

## Hooking It Into tips.boilerhaus.org

Once Plausible is live and you have created the `tips.boilerhaus.org` site in the Plausible dashboard, add these env vars to the existing `tips-boilerhaus` Dokploy app and redeploy the web app:

```env
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=tips.boilerhaus.org
NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL=https://plausible.boilerhaus.org/js/script.js
```

The repository already supports the custom script URL in the frontend; this repo update also wires that variable through the production Docker build.

## Data and Backups

This stack persists data in Docker named volumes:

- `db-data`
- `event-data`
- `event-logs`
- `plausible-data`

Back those up from the Dokploy host if the analytics data matters.
