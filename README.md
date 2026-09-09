# TATE AI

Conversational study tool: upload course materials, then talk through them with AI.

Built with React 18, Vite, Framer Motion, and Supabase.

## Status

The marketing site and the account foundation are in place. The product itself is not
yet built — see [Roadmap](#roadmap).

| Area | Status |
| --- | --- |
| Marketing site (home, pricing) | Done |
| Email/password auth, protected routes | Done |
| Database schema + row-level security | Done |
| Document upload and parsing | Not started |
| AI conversations | Not started |
| Voice | Not started |
| Payments | Not started |
| Privacy Policy / Terms | Placeholder pages only |

## Getting started

Requires Node.js 18 or newer.

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Sign up at [supabase.com](https://supabase.com) and create a project. Then:

- Open **SQL Editor > New query**, paste the contents of
  `supabase/migrations/0001_init.sql`, and run it. This creates the tables, the
  row-level security policies, and the private `documents` storage bucket.
- Go to **Project Settings > API** and copy the project URL and the `anon` public key.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The app runs without them,
but auth will be disabled and the console will say so.

### 4. Run

```bash
npm run dev
```

Open http://localhost:5173.

## Environment variables

Anything prefixed `VITE_` is **bundled into the client and visible to anyone**. The
Supabase anon key is designed for this — row-level security is what protects your
data. Server-only secrets (AI provider keys, the Supabase service role key) must not
carry the `VITE_` prefix; they belong in serverless functions under `/api`.

## Deployment

Deploys to Vercel. `vercel.json` rewrites all non-`/api` paths to `index.html` so
client-side routing works on refresh and deep links.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in **Vercel > Project Settings >
Environment Variables** for every environment you deploy to.

## Project structure

```
TateAI/
├── src/
│   ├── components/        # Marketing sections, navbar, footer, route guard
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── lib/
│   │   └── supabase.js
│   └── pages/             # Home, Login, Signup, Dashboard, Legal, NotFound
├── supabase/
│   └── migrations/
├── vercel.json
└── vite.config.js
```

## Data model

| Table | Purpose |
| --- | --- |
| `profiles` | One row per user, created automatically on signup |
| `documents` | Uploaded slides, assignments, practice exams |
| `conversations` | A study session |
| `conversation_documents` | Which documents a conversation draws on |
| `messages` | Turns within a conversation |

Every table has row-level security enabled and scoped to the owning user. Uploaded
files live in a private bucket at `<user-id>/<document-id>`, with storage policies
keyed off that first path segment.

## Roadmap

1. ~~Move off GitHub Pages to a host that runs server code~~
2. ~~Auth and database~~
3. Document upload and text extraction
4. AI conversations over uploaded documents
5. Voice input and output
6. Payments
7. Real legal pages, launch polish

## License

MIT
