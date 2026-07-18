# ChoreStar

ChoreStar is a synchronized household chore and schedule board designed for an Amazon Echo Show 15 and companion phone browsers.

## Features

- Four-lane Echo Show dashboard with a focused single-member phone view
- Daily, weekly, and selected-day chore schedules
- Server-authoritative completion, points, and reward claiming
- Family schedule and persistent screen wake lock
- Parent-managed members, chores, rewards, events, and bulk resets
- Server-verified parent PIN with an HttpOnly management session
- Revision checks that prevent one device from silently overwriting another
- Local bundled icons, fonts, and celebration assets; no public CDN dependency

## Release Workflow

GitHub Actions builds and publishes images for pushes to `dev` and tags matching `v*`. A tag such as `v0.0.1-beta.4` produces:

```text
ghcr.io/notfixingit3/chorestar:0.0.1-beta.4
```

The application version comes from `package.json` and is exposed by `/healthz` and `/api/state`.

## Deploy On docker1

Create the writable data directory as the deployment user, select the exact published tag, and update the service:

```bash
ssh house@docker1
cd /opt/stacks/chorestar
mkdir -p data
export CHORESTAR_TAG=0.0.1-beta.4
docker compose pull
docker compose up -d
docker compose ps
curl -fsS http://127.0.0.1:8282/healthz
```

Persist `CHORESTAR_TAG` in the stack's `.env` file so later Compose commands use the same image:

```dotenv
CHORESTAR_TAG=0.0.1-beta.4
```

Rollback by changing that value to the previous published tag and running `docker compose pull && docker compose up -d` again.

The bind-mounted `./data/state.json` file is written atomically. Existing beta state files are migrated when first read; plaintext legacy PINs are converted to a salted hash on the next write.

## Local Development

```bash
npm ci
PORT=8080 npm start
```

Open `http://127.0.0.1:8080`. Run the focused API suite with:

```bash
npm test
```

For a complete local container check:

```bash
docker build -t chorestar:local .
CHORESTAR_TAG=local docker compose -f docker-compose.yml up --build
```

## Echo Show Setup

1. Open the Silk browser and navigate to the reverse-proxied ChoreStar URL.
2. Bookmark the page.
3. Use **Screen** in the header to request the browser wake lock.
4. Use **Manage** to customize the household and optionally enable a parent PIN.
