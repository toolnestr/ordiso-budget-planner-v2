# Ordiso — Budget Planner

A beautiful, automated personal finance command center. Track income, expenses,
savings goals, debt payoff, and subscriptions — with multi-user accounts and an
admin management console. Built with Next.js 16, TypeScript, Tailwind CSS,
shadcn/ui, Firebase Firestore, and NextAuth.js.

---

## Features

- **Multi-user SaaS** — each user has their own account and isolated data
- **Admin Console** — admins create/ban/promote/delete user accounts
- **8 financial modules**: Dashboard, Monthly Budget, Transactions, Savings Goals,
  Debt Payoff, Bills & Subscriptions, Annual Review, Setup
- **Firebase Firestore** backend — no database server to manage
- **Currency picker** with 45+ world currencies + custom option
- **Dark mode** + fully responsive

---

## Demo accounts (after seeding)

| Role  | Email              | Password   |
|-------|--------------------|------------|
| Admin | admin@ordiso.app   | admin123   |
| Demo  | demo@ordiso.app    | demo123    |

> Accounts are admin-created only. Public signup is disabled.

---

## Prerequisites

1. **Node.js 18+** (or [Bun](https://bun.sh))
2. A **Firebase** project with **Firestore Database** enabled — [create one free](https://console.firebase.google.com/)
3. A **Cloudflare** account (free tier works) — for deployment

---

## 1 · Local development

```bash
# Install dependencies
npm install        # or: bun install

# Copy the example env file and fill in your values
cp .env.example .env
#   → Set NEXTAUTH_SECRET (run: openssl rand -base64 32)
#   → Set NEXTAUTH_URL (http://localhost:3000 for local dev)

# Start the dev server
npm run dev        # or: bun run dev
```

Open **http://localhost:3000**. On first visit the app auto-seeds an admin +
demo user so you can log in immediately.

> **Firebase config** is already in `src/lib/firebase.ts`. To use your own
> Firebase project, replace the `firebaseConfig` object there with your
> project's config (Firebase Console → Project Settings → Your apps).

---

## 2 · Enable Firestore in Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/) → your project
2. Left menu → **Firestore Database** → **Create database**
3. Choose a location → start in **Test mode** (or production mode with rules below)
4. Wait ~1 minute for it to provision

**Recommended Firestore security rules** (Rules tab):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only authenticated users can read/write, and only their own data.
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    match /{document=**} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.userId
        || request.auth != null
        && request.resource.data.userId == request.auth.uid;
    }
  }
}
```

---

## 3 · Deploy to Cloudflare Workers

This project uses the **OpenNext Cloudflare adapter** (`@opennextjs/cloudflare`)
which builds the Next.js app for Cloudflare Workers with **full Node.js runtime
support**. This is required because the app uses NextAuth, bcryptjs, and the
Firebase Firestore SDK — none of which are compatible with the Edge Runtime that
the older `@cloudflare/next-on-pages` adapter forces.

### Option A — Connect via Git (recommended)

1. **Push this project to GitHub/GitLab**:
   ```bash
   git init
   git add -A
   git commit -m "Ordiso budget planner"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/ordiso.git
   git push -u origin main
   ```

2. **In the Cloudflare dashboard**:
   - Go to **Workers & Pages** → [Create](https://dash.cloudflare.com/?to=/:account/workers-and-pages/create)
   - Click **Create Worker** (or **Connect to Git**)
   - Select your `ordiso` repository
   - Set the build settings:
     - **Framework preset:** `Next.js`
     - **Build command:** `npx @opennextjs/cloudflare build`
     - **Deploy command:** `npx wrangler deploy`
   - Under **Environment variables** (Settings → Variables), add:
     - `NEXTAUTH_SECRET` = a random string (run `openssl rand -base64 32`)
     - `NEXTAUTH_URL` = `https://ordiso.<your-subdomain>.workers.dev` (update after first deploy to your real URL)
     - `NODE_VERSION` = `20`
   - Click **Save and Deploy**

3. After the first deploy, update `NEXTAUTH_URL` to your production URL
   and trigger a redeploy.

> **Why OpenNext and not `@cloudflare/next-on-pages`?** The older adapter
> requires all API routes to use `export const runtime = 'edge'`, which breaks
> NextAuth + bcryptjs + Firebase. OpenNext runs the full Node.js runtime on
> Cloudflare Workers (via the `nodejs_compat` flag), so everything works
> unchanged.

### Option B — Deploy via Wrangler CLI (from your machine)

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Install dependencies
npm install

# Set your secrets (run once — these are stored encrypted)
wrangler secret put NEXTAUTH_SECRET    # paste a random string

# Build for Cloudflare Workers + deploy
npm run cf:deploy
```

This runs `@opennextjs/cloudflare build` then `wrangler deploy` in one step.

---

## 4 · After deployment

1. Visit your Cloudflare Workers URL (e.g. `https://ordiso.<your-subdomain>.workers.dev`)
2. The app auto-seeds the admin + demo accounts on first visit
3. Log in as **admin@ordiso.app / admin123**
4. Go to **Admin Console** → **Create User** to make accounts for your customers

---

## Project structure

```
src/
├── app/
│   ├── api/              # API routes (auth, dashboard, transactions, admin, …)
│   ├── page.tsx          # Main app (auth gate + tab router)
│   ├── layout.tsx        # Root layout + providers
│   └── globals.css       # Emerald/teal theme
├── components/
│   ├── budget/           # App shell, tabs, auth screen, shared UI
│   └── ui/               # shadcn/ui components
└── lib/
    ├── firebase.ts       # Firebase init (your config)
    ├── firestore.ts      # Firestore data-access helpers
    ├── auth.ts           # NextAuth config
    ├── session.ts        # requireUser / requireAdmin
    ├── api-hooks.ts      # React Query hooks (frontend)
    ├── store.ts          # Zustand store (active tab, month)
    ├── format.ts         # Currency/date formatting + auto-categorization
    ├── currencies.ts     # 45+ world currencies for the dropdown
    └── types.ts          # Shared TypeScript types
```

---

## Tech stack

| Layer         | Technology                          |
|---------------|-------------------------------------|
| Framework     | Next.js 16 (App Router)             |
| Language      | TypeScript 5                        |
| Styling       | Tailwind CSS 4 + shadcn/ui          |
| Database      | Firebase Firestore                  |
| Auth          | NextAuth.js v4 (JWT + Credentials)  |
| State         | Zustand + TanStack Query            |
| Charts        | Recharts                            |
| Deployment    | Cloudflare Pages (`@cloudflare/next-on-pages`) |

---

## License

This is a commercial product. © Ordiso.
