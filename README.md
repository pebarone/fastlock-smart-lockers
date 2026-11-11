<div align="center">

# FastLock

**Self-service smart lockers: rent with a QR code, lock with your fingerprint, pay with PIX.**

![Vue.js](https://img.shields.io/badge/Vue_3-35495E?style=for-the-badge&logo=vuedotjs&logoColor=4FC08D)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-000000?style=for-the-badge&logo=fastify&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Azure](https://img.shields.io/badge/Azure_Container_Apps-0078D4?style=for-the-badge&logo=microsoftazure&logoColor=white)
![ESP32](https://img.shields.io/badge/ESP32-E7352C?style=for-the-badge&logo=espressif&logoColor=white)

</div>

---

## Overview

FastLock is a full-stack prototype of a **smart locker rental network**. A user finds a locker on the map (or scans the QR code stuck to it), picks a size, confirms an activation fee via PIX and registers a **WebAuthn passkey** (Face ID / Touch ID / fingerprint). To get their items back they authenticate again with the same biometrics, the system charges the extra time per started hour, and the locker is released.

Partners (companies that host lockers) get a **multi-tenant portal** to manage locations, lockers, team members and an audit trail. An **ESP32 firmware simulated on Wokwi** polls the API and drives servo locks, LEDs and LCD displays, closing the loop between software and hardware.

## Features

**Customer flow**
- Interactive locker map (Leaflet) with geocoding and distance to nearby locations
- QR-code entry per locker (`/locker/:lockerId`) and guided rental flow
- Passwordless lock/unlock with **WebAuthn** (`@simplewebauthn`) passkeys bound to each rental
- Rental states for activation payment and final retrieval payment (PIX), with hourly pricing
- Google OAuth sign-in via Supabase Auth and an account area

**Partner portal (multi-tenant)**
- Organizations with `owner` / `admin` / `viewer` roles and email-based pending invitations
- Locker locations and lockers CRUD, status (`free`, `occupied`, `maintenance`) and size filters
- Per-organization dashboard plus a platform-wide admin dashboard
- Audit log for every relevant write and every unlock attempt, plus manual override release

**Platform**
- Postgres **Row Level Security** policies per tenant, `helmet` security headers and rate limiting
- OpenAPI spec with Swagger UI at `/api-docs`
- Versioned plain-SQL migrations (no ORM) and seed scripts
- Single multi-stage Docker image that builds the Vue SPA and serves it from the Fastify API
- PowerShell script to type-check, build, push to Docker Hub and roll out to Azure Container Apps
- ESP32 + servo + LCD1602 + LED firmware on Wokwi talking to the live API
- 3D viewer of the locker model (`3dmodel/model.html`)

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | Vue 3, Vue Router, Vite, Tailwind CSS, GSAP, Leaflet, driver.js, lucide icons |
| Backend | Bun, TypeScript, Fastify 4, `pg`, JSON Schema validation, `@fastify/swagger` |
| Auth | Supabase Auth (Google OAuth, Bearer tokens), WebAuthn passkeys, admin API key |
| Data | PostgreSQL 16 / Supabase, RLS, SQL migrations |
| DevOps | Docker (multi-stage), Docker Compose, Docker Hub, Azure Container Apps |
| IoT | ESP32 (Arduino), ArduinoJson, ESP32Servo, LiquidCrystal I2C, Wokwi |

## Project Structure

```text
.
├── backend/              # Bun + Fastify API (TypeScript)
│   ├── db/migrations/    # versioned SQL schema (lockers, rentals, RLS, orgs, WebAuthn, payments)
│   ├── db/seeds/         # sample lockers
│   ├── openapi.yaml      # API contract
│   └── src/modules/      # audit · dashboard · locations · organizations · rentals · users
├── frontend/             # Vue 3 SPA (customer flow + partner portal)
├── wokwi/                # ESP32 firmware + circuit diagram for the Wokwi simulator
├── 3dmodel/              # 3D locker viewer
├── scripts/              # Azure deploy script
├── Dockerfile            # builds frontend + backend into one image
└── docker-compose.yml
```

Each backend module follows `routes → controller → service → repository → schemas`, keeping HTTP, business rules (transactions + auditing) and SQL apart.

## Getting Started

**Requirements:** [Bun](https://bun.sh) 1.x and a PostgreSQL database (a Supabase project for auth).

```bash
# 1. Backend
cd backend
cp .env.example .env          # fill DATABASE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ADMIN_API_KEY ...
bun install
bun run db:migrate
bun run db:seed
bun run dev                   # http://localhost:3333  ·  docs at /api-docs

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env          # VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_API_BASE_URL
bun install                   # or npm install
bun run dev                   # http://localhost:3000 (proxies /api to :3333)
```

**Docker** (API + bundled frontend, plus a local Postgres):

```bash
docker compose up --build     # app on http://localhost:3333
```

Health check: `curl http://localhost:3333/api/health`

<details>
<summary><b>Main backend environment variables</b></summary>

| Variable | Purpose |
| --- | --- |
| `PORT`, `HOST` | HTTP bind (default `3333`, `0.0.0.0`) |
| `DATABASE_URL`, `DATABASE_SSL` | Postgres connection |
| `CORS_ORIGIN` | Allowed frontend origin |
| `ADMIN_API_KEY` | Platform admin key (`x-admin-api-key` header) |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW` | Rate limiting |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Supabase Auth token validation |
| `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ALLOWED_ORIGINS` | Passkey relying party (HTTPS required on phones) |

</details>

More backend details (tenant model, admin assignment, API list) are in [`backend/README.md`](backend/README.md) (Portuguese).

## Academic Context

Built as the **Startup One** prototype during the Software Engineering program at **[FIAP](https://www.fiap.com.br/)**.
