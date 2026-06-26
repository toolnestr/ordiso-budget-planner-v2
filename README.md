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

## 3 · Deploy to Cloudflare Pages (static — no Workers)

This app is a **pure static site**. It talks to Firebase Auth + Firestore
directly from the browser — no server, no Workers, no API routes. This makes it
fast, lightweight, and free to host on Cloudflare Pages.

### Option A — Connect via Git (recommended)

1. **Push this project to GitHub**:
   ```bash
   git init
   git add -A
   git commit -m "Ordiso budget planner"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/ordiso.git
   git push -u origin main
   ```

2. **In the Cloudflare dashboard**:
   - Go to **Workers & Pages** → [Create](https://dash.cloudflare.com/?to=/:account/workers-and-pages/create) → **Pages** → **Connect to Git**
   - Select your `ordiso` repository
   - Set the build settings:
     - **Framework preset:** `Next.js (Static HTML Export)`
     - **Build command:** `npm run build`
     - **Build output directory:** `out`
     - **Environment variable:** `NODE_VERSION` = `20`
   - Click **Save and Deploy**

3. That's it! Cloudflare builds the static site and serves it from its global CDN. No Workers, no server cold starts, no `nodejs_compat` needed.

> **Why static?** All auth (Firebase Auth) and data (Firestore) happen in the
> browser via the Firebase client SDK. The `next build` command produces a fully
> static `out/` folder. This is the fastest, cheapest, simplest deployment.

### Option B — Deploy via Wrangler CLI

```bash
npm install
npm run build
npx wrangler pages deploy out --project-name=ordiso
```

---

## 4 · First visit — load demo data

After deploying, visit your site. On the login screen, click **"First time? Load demo data"**.
This creates the admin + demo accounts in Firebase Auth and seeds 6 months of sample
transactions for the demo user (~10 seconds). You'll be signed in as the demo user
automatically.

**Demo login:** `demo@ordiso.app` / `demo123` (read-only — data resets on re-seed)
**Admin login:** `admin@ordiso.app` / `admin123` (can create/ban/delete users)

---

## 5 · After deployment

1. Visit your Cloudflare Pages URL (e.g. `https://ordiso.pages.dev`)
2. Click **"First time? Load demo data"** on the login screen (creates users + sample data)
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
