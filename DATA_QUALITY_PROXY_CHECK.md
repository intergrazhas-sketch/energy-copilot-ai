# Data Quality Proxy Check

## Scope

This check investigates why the same-origin request below returned `500` and documents the Docker runtime fix:

`http://localhost:3000/api/v1/telemetry/rejected/summary`

The fix was applied in `docker-compose.yml` for the Docker `web` service only.

## 1. Next Config

The project has one Next config file:

`apps/web/next.config.js`

The file defines:

```js
const backendUrl = process.env.NEXT_DEV_BACKEND_URL || "http://localhost:8000";

const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/health",
        destination: `${backendUrl}/health`,
      },
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};
```

So `/api/:path*` is proxied to:

`NEXT_DEV_BACKEND_URL/api/:path*`

or, if `NEXT_DEV_BACKEND_URL` is not set:

`http://localhost:8000/api/:path*`

## 2. Actual Proxy Target Before Fix

For this request:

`http://localhost:3000/api/v1/telemetry/rejected/summary`

the active Next rewrite target is:

`http://localhost:8000/api/v1/telemetry/rejected/summary`

This is confirmed by `ec_web` logs:

```text
Failed to proxy http://localhost:8000/api/v1/telemetry/rejected/summary [AggregateError: ] { code: 'ECONNREFUSED' }
```

## 3. Frontend Environment Variables

Host shell environment:

```text
NEXT_DEV_BACKEND_URL=
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_WS_URL=
```

`ec_web` container environment:

```text
NEXT_DEV_BACKEND_URL=http://api:8000
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_APP_NAME=Energy Copilot AI
NEXT_PUBLIC_DEFAULT_LANG=ru
```

Important detail:

`NEXT_DEV_BACKEND_URL` was previously not set in the `ec_web` container.

`NEXT_PUBLIC_API_URL` is set, but `apps/web/next.config.js` does not use `NEXT_PUBLIC_API_URL` for rewrites. Rewrites use only `NEXT_DEV_BACKEND_URL` and then fall back to `http://localhost:8000`.

After the fix, `NEXT_DEV_BACKEND_URL` is set to:

`http://api:8000`

## 4. Reproduction Results Before Fix

Same-origin proxy request through Next:

```text
GET http://localhost:3000/api/v1/telemetry/rejected/summary
HTTP/1.1 500 Internal Server Error
Internal Server Error
```

Direct backend request:

```text
GET http://localhost:8000/api/v1/telemetry/rejected/summary
HTTP/1.1 200 OK
{"total":5,"items":[{"reason":"invalid_topic","count":1},{"reason":"invalid_json","count":1},{"reason":"plant_not_found","count":1},{"reason":"power_exceeds_capacity","count":1},{"reason":"negative_power","count":1}]}
```

Backend is healthy:

```text
GET http://localhost:8000/health
200
```

## 5. Container Network Check

From inside the `ec_web` container:

```text
http://localhost:8000/health ECONNREFUSED
http://api:8000/health 200
```

This proves that `localhost:8000` is the wrong backend address from inside the Docker `web` container.

Inside Docker, `localhost` points to the current container (`ec_web`), not to the `ec_api` container. The correct Docker network target is:

`http://api:8000`

## 6. Exact Cause Of 500

The `500` is caused by the Next.js rewrite in the Docker `web` runtime.

`apps/web/next.config.js` uses:

`process.env.NEXT_DEV_BACKEND_URL || "http://localhost:8000"`

But `NEXT_DEV_BACKEND_URL` is not configured for `ec_web` in `docker-compose.yml`.

Therefore, the Dockerized Next.js server proxies:

`/api/v1/telemetry/rejected/summary`

to:

`http://localhost:8000/api/v1/telemetry/rejected/summary`

From inside `ec_web`, that address is not the backend container, so the connection fails with:

`ECONNREFUSED`

Next.js returns:

`500 Internal Server Error`

The backend endpoint itself is not broken. It returns `200` when called directly through the host-published backend port.

## 7. Fix Applied

`docker-compose.yml` now sets the Docker-safe backend URL for the `web` service:

`NEXT_DEV_BACKEND_URL=http://api:8000`

This does not break local development outside Docker because `apps/web/next.config.js` still falls back to:

`http://localhost:8000`

when `NEXT_DEV_BACKEND_URL` is not set.

The `web` container was recreated with:

`docker compose up -d web`

## 8. Verification After Fix

The `ec_web` container now has:

```text
NEXT_DEV_BACKEND_URL=http://api:8000
```

Required checks:

```text
GET http://localhost:3000/api/v1/telemetry/rejected/summary -> 200
GET http://localhost:3000/api/v1/telemetry/rejected?limit=5 -> 200
GET http://localhost:3000/api/v1/telemetry/summary?asset_id=60df5995-306b-40ea-a988-13405d036f1b&from=...&to=... -> 200
GET http://localhost:3000 -> 200
```

Build:

```text
npm run build -> success
```

A) Проблемы нет, можно нажимать Keep All.
