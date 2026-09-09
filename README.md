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
| PDF upload and text extraction | Done |
| AI conversations | Done |
| Voice (dictation + spoken replies) | Done |
| Payments | Not started |
| Privacy Policy / Terms | Drafted — needs legal review and placeholders filled |

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

`npm run dev` runs Vite only, which does **not** serve the `/api` routes. Document
upload will fail at the extraction step with a message saying so. To run the app and
the serverless functions together:

```bash
npm run dev:api
```

That runs `vercel dev`, so it needs the Vercel CLI (`npm i -g vercel`) and a linked
project (`vercel link`).

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
├── api/
│   ├── _lib/
│   │   └── ai/            # Provider-neutral chat interface + adapters
│   ├── chat.js            # Streaming conversation endpoint
│   └── documents/
│       └── extract.js     # Serverless PDF text extraction
├── src/
│   ├── components/        # Marketing sections, navbar, footer, upload, route guard
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── lib/
│   │   ├── documents.js
│   │   └── supabase.js
│   └── pages/             # Home, Login, Signup, Dashboard, Legal, NotFound
├── supabase/
│   └── migrations/
├── vercel.json
└── vite.config.js
```

## AI provider

Chat goes through a provider-neutral interface in `api/_lib/ai/index.js`, which
holds no vendor SDK calls. Each provider is an adapter exposing one function:

```js
streamChat({ system, messages, signal, onDelta }) -> Promise<{ text }>
```

`anthropic` is implemented. To add another, write the adapter, register it in the
`ADAPTERS` map, and set `AI_PROVIDER`. Nothing else changes.

Set `ANTHROPIC_API_KEY` in Vercel **without** a `VITE_` prefix — a prefixed key
would be bundled into the browser for anyone to read and spend.

### Context handling

The conversation's documents are packed into the system prompt under a fixed
character budget (`CONTEXT_BUDGET` in `api/chat.js`), shared evenly so one long
document cannot crowd out the others. That is adequate for a set of lecture
slides and **not** adequate for a textbook — long documents are truncated, and
the model is not told which part was dropped. Retrieval over embeddings is the
real fix and is not implemented.

The system prompt is cached, so the documents are billed at full price once per
conversation and as a cheap cache read on every turn after.

## Before launch

`src/pages/legalContent.jsx` holds the Privacy Policy and Terms. They describe the
service's actual data flows accurately, but they are **not legal advice and have
not been reviewed by a lawyer**. Two placeholders must be filled in first:

- `OPERATOR` — your full legal name
- `STATE` — your state, for the governing-law clause

`support@tateai.app` must also receive mail before these go live; the policy
points people there to request account deletion.

Still missing and load-bearing: there is **no rate limiting** on `/api/chat`, so
any signed-up account can spend against the Anthropic key without limit. Set a
spend cap in the Anthropic console as a backstop.

## Voice

Uses the browser's built-in Web Speech API — no extra vendor, key, or per-minute
cost. `src/lib/speech.js` wraps both halves and feature-detects them; the mic
button and the read-aloud toggle are hidden entirely where the browser lacks
support rather than offered as controls that do nothing.

Support is uneven: recognition works in Chrome, Edge, and Safari, and is absent
or behind a flag in Firefox. Replies are spoken a sentence at a time as they
stream, since waiting for the full reply leaves a long silence and speaking each
network chunk breaks words mid-syllable.

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
3. ~~Document upload and text extraction~~
4. ~~AI conversations over uploaded documents~~
5. ~~Voice input and output~~
6. Payments
7. Legal pages and honest marketing copy — drafted, pending review

## License

MIT
