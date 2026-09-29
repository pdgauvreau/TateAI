# TATE AI

Conversational study tool: upload course materials, then talk through them with AI.

Built with React 18, Vite, Framer Motion, and Supabase.

## Status

The product is built and live at https://tateai.app. Billing runs in Stripe test mode
until the live-mode setup below is done — see [Before launch](#before-launch).

| Area | Status |
| --- | --- |
| Marketing site (home, pricing) | Done |
| Email/password auth, protected routes | Done |
| Database schema + row-level security | Done |
| Upload and text extraction (PDF, photos, scans, Word, PowerPoint) | Done |
| Math and Markdown rendering in replies | Done |
| Reply modes: hint, similar example, check my work | Done |
| Passage search over long documents | Done |
| AI conversations | Done |
| Voice (dictation + spoken replies) | Done |
| Payments (Stripe checkout, portal, webhooks) | Done — test mode |
| Privacy Policy / Terms | Drafted — needs legal review |

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

Model calls go through a provider-neutral interface in `api/_lib/ai/index.js`,
which holds no vendor SDK calls. Each provider is an adapter exposing two
functions:

```js
streamChat({ system, messages, signal, onDelta, deep }) -> Promise<{ text, usage }>
transcribe({ mediaType, data, signal }) -> Promise<{ text, usage, truncated }>
```

`anthropic` is implemented. To add another, write the adapter, register it in the
`ADAPTERS` map, and set `AI_PROVIDER`. Nothing else changes.

Set `ANTHROPIC_API_KEY` in Vercel **without** a `VITE_` prefix — a prefixed key
would be bundled into the browser for anyone to read and spend.

### Context handling

When a conversation's documents fit a character budget (`CONTEXT_BUDGET` in
`api/chat.js`), they all go into the system prompt whole. The system prompt is
cached, so they are billed at full price once and as a cheap cache read on every
turn after.

When they do not fit, short documents (a photo of a worksheet, say) still go in
whole, and the long ones are searched instead. Every document's text is split
into overlapping passages of about 1,500 characters in `document_chunks` by a
database trigger. Each message, the passages that best match the question (and
the student's previous message, so a follow-up like "why?" keeps its topic) are
found by Postgres full-text search (`match_document_chunks`) and sent with that
message only, which keeps the system prompt cacheable. The model is told which
documents are searched and to say when the passages do not cover the question.

Full-text search matches words, not meaning: "the powerhouse of the cell" finds
passages that say "mitochondria" only if they use the same words. Embedding
search would close that gap, at the cost of an embeddings provider.

### Uploads

`api/documents/extract.js` turns each upload into text once, when it arrives:

| Type | How |
| --- | --- |
| PDF with text | `unpdf`, no model call |
| Scanned PDF (no selectable text), up to 20 pages | Read by the model |
| Photo (JPEG, PNG, WebP, GIF; HEIC where the browser can decode it) | Shrunk to 2,000 px and re-encoded as JPEG in the browser, then read by the model |
| Word (`.docx`) | `mammoth`, no model call |
| PowerPoint (`.pptx`) | Slide XML read directly, with speaker notes, no model call |

Reading with the model runs on the standard tier at low effort, is checked
against the student's allowance first, and is metered as a `transcription`
usage event. Math comes back as LaTeX, and figures as bracketed descriptions.

### Reply modes

The composer offers **Hint**, **Similar example**, and **Check my work**. The
mode is stored on the message (`messages.intent`) and its instruction
(`INTENT_INSTRUCTIONS` in `api/chat.js`) is added to that message every time
the conversation is sent, so later turns see the same prompt. None of them hands
over a solution to the student's own problem: a similar example is a different
problem, and a check points to the first wrong step without correcting it.

## Before launch

`src/pages/legalContent.jsx` holds the Privacy Policy and Terms. They describe the
service's actual data flows accurately, but they are **not legal advice and have
not been reviewed by a lawyer**. `OPERATOR` and `STATE` at the top of the file
name the operator and the governing-law state.

`support@tateai.app` receives mail through Forward Email's free plan, configured
entirely by DNS records on the domain (MX `mx1`/`mx2.forwardemail.net`, a
`forward-email=` TXT record naming the destination, and SPF). There is no account:
to change the destination, edit that TXT record with `vercel dns`. On the free plan
the destination address is publicly visible in DNS; the policy points people there
to request account deletion.

Set a spend cap in the Anthropic console as a backstop — the app-level limits
below bound normal use, but only the provider can stop spend unconditionally.

## Usage limits

Usage is limited by **AI cost, not message count**. A message costs several
times more with a long document attached or a cold prompt cache, so a message
cap cannot bound spend.

After every reply, `/api/chat` records the token counts the provider reported
and the exact cost (`cost_micros`, US dollars x 1e6, priced in
`api/_lib/ai/anthropic.js`). Before each reply it checks two rolling windows
against the plan's allowance, from `shared/plans.js`:

| Plan | 30-day allowance | 24-hour cap |
| --- | --- | --- |
| Free | $0.25 | 25% of that |
| Student | 50% of the price after 10% tax headroom ($9.55 at $21) | 25% |
| Pro | same rule ($13.18 at $29) | 25% |
| Institution | unmetered | — |

Paid allowances are derived from the prices, so changing a price updates the
allowance. The daily cap stops one sitting from using the whole month. A reply
that fails or is cancelled partway still records what it was billed. Totals come
from the `usage_summary()` database function, because summing rows in the client
would hit PostgREST's 1,000-row cap on exactly the heaviest users. The dashboard
shows the share of the allowance used, not dollars.

Replies run on Claude Sonnet 5 at medium effort. A "Deeper thinking" switch in
the conversation header sends that student's replies to Claude Opus 5 at high
effort instead; it is metered at Opus rates, so it draws the allowance down
faster rather than needing a separate limit. Both are overridable with the
`ANTHROPIC_*` variables in `.env.example`.

When a model is added or its pricing changes, update `RATES` in the adapter; an
unknown model is costed at the most expensive rate so it can never run free.

Usage is metered in `usage_events` rather than counted from `messages`: counting
messages would mean joining through `conversations` to reach a user id, and a
student deleting a conversation would erase the record of what it cost. The table
has select and insert policies but deliberately **no update or delete policy**, so
a user can only ever add to their own usage, never remove it.

## Stripe configuration (lives in Stripe, not this repo)

`scripts/stripe-setup.mjs` creates all of this in any account, test or live, and
is safe to re-run (existing prices, portal and webhook are skipped):

```bash
node --env-file=.env.stripe-live scripts/stripe-setup.mjs
```

A new webhook's signing secret lands in `.env.stripe-webhook` (gitignored).

- **Products and prices**: TATE AI Student ($21/mo) and TATE AI Pro ($29/mo),
  one Product per plan, with lookup keys `tateai_student_monthly` and
  `tateai_pro_monthly`. The code resolves prices by lookup key, so live prices
  need the same keys and no code change. Prices are **tax-inclusive** and the
  products carry tax code `txcd_10105001` (AI as a service, personal use), which
  Managed Payments requires: Stripe is merchant of record and collects and
  remits sales tax out of the advertised price.
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
network chunk breaks words mid-syllable. Each sentence first goes through
`toSpeakable()`, which drops Markdown marks, turns brackets into pauses, and says
symbols and LaTeX math as words ("$\frac{a}{b}$" is read "a over b"), so the
voice never reads out punctuation.

## Data model

| Table | Purpose |
| --- | --- |
| `profiles` | One row per user, created automatically on signup |
| `documents` | Uploaded slides, assignments, practice exams |
| `conversations` | A study session |
| `conversation_documents` | Which documents a conversation draws on |
| `document_chunks` | Each document's text in searchable passages, written by a trigger |
| `messages` | Turns within a conversation, with their reply mode and any attached file |

Every table has row-level security enabled and scoped to the owning user. Uploaded
files live in a private bucket at `<user-id>/<document-id>`, with storage policies
keyed off that first path segment.

## Roadmap

1. ~~Move off GitHub Pages to a host that runs server code~~
2. ~~Auth and database~~
3. ~~Document upload and text extraction~~
4. ~~AI conversations over uploaded documents~~
5. ~~Voice input and output~~
6. ~~Payments~~ (test mode; live mode pending)
7. Legal pages and honest marketing copy — drafted, pending review

## License

MIT
