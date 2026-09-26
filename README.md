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
│   │   └── motion/        # Reusable motion primitives (see Front end below)
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── lib/
│   │   ├── documents.js
│   │   └── supabase.js
│   ├── motion/            # Motion tokens and hooks — no rendering
│   └── pages/             # Home, Login, Signup, Dashboard, Legal, NotFound
├── supabase/
│   └── migrations/
├── vercel.json
└── vite.config.js
```

## Front end

Two files hold the design system, and everything else resolves through them:

- **`src/index.css`** — colour, type, shape, and easing as custom properties,
  defined twice: once for dark and once for light. A theme is a `data-theme`
  attribute on `<html>`, resolved before first paint by an inline script in
  `index.html` so a light-theme reader never sees a flash of dark. That
  attribute is also what `useTheme()` reads as its initial value, so there is
  one source of truth rather than two.
- **`src/motion/tokens.js`** — the easing curves, spring configurations, and
  entrance variants every component imports instead of writing transitions
  inline. The cubic-beziers mirror the custom properties in `index.css`, so a
  CSS transition and a Framer transition on the same element agree.

`src/motion/hooks.js` holds the pointer- and scroll-driven hooks (tilt, magnetic
pull, cursor position, count-up, a frame loop that pauses off screen). Two rules
hold throughout: continuous input is written to motion values rather than React
state, so a mousemove never re-renders the tree; and every hook degrades to a
still, usable version of itself under `prefers-reduced-motion` rather than
switching its feature off.

`src/components/motion/` holds the primitives built on those: scroll reveals,
split-text headlines, tilt cards, the marquee, the progress ring, the theme
toggle, and the app chrome (scroll progress, cursor glow, route transitions).

Reduced motion is handled in one place — `<MotionConfig reducedMotion="user">`
in `App.jsx` covers everything Framer animates, and a media query at the end of
`index.css` covers the CSS-driven half. Per-component `if (reduced) return null`
is deliberately avoided: it tends to leave content invisible.

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

Set a spend cap in the Anthropic console as a backstop — the app-level limits
below bound normal use, but only the provider can stop spend unconditionally.

## Usage limits

`/api/chat` enforces a per-user cap over a rolling 24-hour window, from
`shared/plans.js` (free 25, student 250, pro 1000, institution unlimited). That
file is imported by both the API and the dashboard so the number shown can never
drift from the number enforced.

Usage is metered in `usage_events` rather than counted from `messages`: counting
messages would mean joining through `conversations` to reach a user id, and a
student deleting a conversation would erase the record of what it cost. The table
has select and insert policies but deliberately **no update or delete policy**, so
a user can only ever add to their own usage, never remove it.

## Stripe configuration (lives in Stripe, not this repo)

These were set up via the API in the sandbox and **must be recreated in live
mode** before real billing — nothing here is version-controlled:

- **Products and prices**: TATE AI Student ($18/mo) and TATE AI Pro ($26/mo),
  with lookup keys `tateai_student_monthly` and `tateai_pro_monthly`. The code
  resolves prices by lookup key, so live prices need the same keys and no code
  change.
- **Customer portal**: invoice history, card updates, email updates, plan
  switching between the two prices with proration, cancel at period end, and
  **price decreases scheduled at period end** (`decreasing_item_amount`) so a
  downgrade keeps the current plan until renewal. Upgrades apply immediately.
- **Webhook endpoint** at `/api/billing/webhook` for: `checkout.session.completed`,
  `checkout.session.async_payment_succeeded`, `customer.subscription.created`,
  `.updated`, `.deleted`, `.paused`, `.resumed`, `invoice.paid`,
  `invoice.payment_failed`. Its signing secret goes in `STRIPE_WEBHOOK_SECRET`.

When adding secrets with `vercel env add` on Windows, pipe from bash or type at
the prompt — piping from Windows PowerShell prepends an invisible byte-order
mark, which broke webhook signature checks once already.

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
