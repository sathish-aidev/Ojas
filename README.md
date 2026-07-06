# Ojas

Personal training management platform for gym owners, supervisors, and trainers. Built for Indian gyms starting with PT tracking, client progress, and salary/payroll modules.

## Tech Stack

- **Next.js 15** (App Router, TypeScript)
- **PostgreSQL** + **Prisma**
- **NextAuth.js** (credentials, role-based access)
- **Tailwind CSS** + shadcn-style components
- **Recharts** (progress graphs)
- **@react-pdf/renderer** (pay stub PDFs)

## Quick Start

### Prerequisites

- Node.js 20+
- Docker Desktop (for local PostgreSQL)

### Setup

```powershell
cd d:\impackt_Fitness_App

# Copy environment file
copy .env.example .env

# Start PostgreSQL
docker compose up -d

# Install dependencies
npm install

# Push schema and seed demo data
npm run db:push
npm run db:seed

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo Logins (password: `password123`)

| Role       | Email                  |
|------------|------------------------|
| Owner      | owner@impackt.gym      |
| Supervisor | supervisor@impackt.gym |
| Trainer 1  | trainer1@impackt.gym   |
| Trainer 2  | trainer2@impackt.gym   |
| Trainer 3  | trainer3@impackt.gym   |

## Modules

### Owner
- Dashboard with revenue splits and renewals
- Team management (create trainers/supervisors, set split %)
- All clients view
- Salaries: generate payroll, PDF pay stubs, mark paid
- Gym settings

### Supervisor
- Operations dashboard (trainers, clients, renewals)
- Salaries: view and record payments (no rule changes)

### Trainer
- Today view with sessions and quick add client
- Client management (payments, sessions, progress)
- Day scheduler with open/blocked slots
- Earnings and payroll history

## Project Structure

```
docs/           # Business requirements, user stories, API spec
app/            # Next.js routes (owner, supervisor, trainer)
components/     # UI and forms
lib/            # Auth, services, validations
prisma/         # Schema and seed
```

## Scripts

| Command           | Description              |
|-------------------|--------------------------|
| `npm run dev`     | Start development server |
| `npm run build`   | Production build         |
| `npm run db:push` | Sync Prisma schema to DB |
| `npm run db:seed` | Seed demo gym data       |
| `npm run db:studio` | Open Prisma Studio   |

## Documentation

See the [`docs/`](docs/) folder for:

- [BUSINESS-REQUIREMENTS.md](docs/BUSINESS-REQUIREMENTS.md)
- [COMPETITIVE-ANALYSIS.md](docs/COMPETITIVE-ANALYSIS.md)
- [USER-STORIES.md](docs/USER-STORIES.md)
- [DATA-MODEL.md](docs/DATA-MODEL.md)
- [API-SPEC.md](docs/API-SPEC.md)
- [ROADMAP.md](docs/ROADMAP.md)

## Deployment (Vercel + Neon)

1. Push this repo to GitHub and import it in [Vercel](https://vercel.com).
2. In the Vercel project, open **Storage → Create Database → Postgres (Neon)** and link it to the project (sets `DATABASE_URL`).
3. Add environment variables:

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | Set automatically when Neon storage is linked |
| `AUTH_SECRET` | Random string (`openssl rand -base64 32`) |
| `AUTH_URL` | `https://your-project.vercel.app` |
| `NEXT_PUBLIC_APP_NAME` | `Ojas` |

4. Deploy, then initialize the production database (from your machine with production `DATABASE_URL`):

```powershell
$env:DATABASE_URL="postgresql://..."
npx prisma db push
npm run db:seed
```

5. Open the Vercel URL and sign in with demo credentials (after seed).

**Note:** Client photo uploads use local disk in development. On Vercel, use cloud blob storage before relying on uploads in production.