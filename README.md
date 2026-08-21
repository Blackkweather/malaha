# Málaga Prospect Finder

Finds the strongest potential website and design clients in **Málaga, Spain**.

It is built around one idea: a short shortlist of genuinely strong prospects is
worth more than a long list of businesses. A search returns 10 results by
default and 25 at most, and it returns fewer than you asked for whenever fewer
businesses actually deserve to be there.

```
Search businesses:  [ dentist ]
Location:           Málaga            (locked by configuration)
                    [ SEARCH ]
```

---

## What makes this different

**Search is instant because it does nothing clever.** `GET /api/search` runs a
single indexed query against one precomputed table. It never calls Groq or
Claude, never crawls a website, never launches a browser, and makes no outbound
network request of any kind. All the expensive work happens in background jobs.
Measured on the bundled dataset: **~48 ms average, well under the 500 ms target.**

**Málaga is enforced in the backend, not the UI.** A business is stored only
when public evidence puts it inside Málaga city. Marbella, Torremolinos,
Fuengirola and the rest of the province are rejected at ingestion — verified
against real OpenStreetMap data, where 4 of 60 fetched dental practices were
correctly discarded.

**No score is a black box.** Every number carries the reasons that produced it.

---

## There is no sample data

This application ships with **no bundled dataset**, synthetic or otherwise.
Every business in it was fetched from a public source and verified to be in
Málaga city. An empty install is an honest one: it stays empty until you load
real data, which takes one click.

## Quick start

Requirements: Node 20.11+, and PostgreSQL 14+ — Docker locally, or any hosted
Postgres (Neon, Supabase, RDS).

```bash
npm install

cp .env.example .env          # then set DATABASE_URL
docker compose up -d          # optional: local PostgreSQL on port 5544

npm run bootstrap             # checks the connection and applies migrations
npm run dev                   # http://localhost:3000
```

Then open **`/data`**, pick the sectors worth selling to, and press *Fetch*.
That queues one bounded OpenStreetMap query per sector, crawls and audits every
website it discovers, scores everything and rebuilds the search index — with
live progress on the page.

You will have a working, searchable application with **no API keys at all**.
Groq, Claude and Google Places are optional, and the app states plainly when
they are not configured.

### Loading data from the command line

`/data` drives the same pipeline as the CLI, so use whichever suits:

```bash
# OpenStreetMap — public, no key required
npm run ingest -- --source=openstreetmap --query=dentist

# Google Places API — official API, supplies public ratings and review counts
npm run ingest -- --source=google_places --query=dentist

# Discover and audit the real websites, then rescore and reindex
npm run pipeline
```

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm test` | Full test suite |
| `npm run lint` | TypeScript check |
| `npm run bootstrap` | Verify the database and apply migrations |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:reset` | Drop and recreate the schema (destructive) |
| `npm run ingest` | Ingest from a public source |
| `npm run pipeline` | Website discovery, audit, rescore, reindex |
| `npm run worker` | Drain the background job queue |

---

## How a prospect is scored

Three independent components combine into one **Opportunity Score**, using
weights you control (`WEIGHT_*` in `.env`, default 35 / 25 / 40):

**Business Quality (35%)** — how strong and established the business looks from
public evidence. Review volume is log-scaled, because the step from 10 to 100
reviews means far more than 900 to 1000. Rating is mapped across a 3.0–5.0 band.
A business with no public review evidence is penalised, not given the benefit of
the doubt.

**Commercial Value (25%)** — how attractive the *category* is to a design
agency, driven by realistic project budget: dental clinics and law firms score
in the 90s, bars and convenience shops in the 30s. An uncertain classification
is pulled back toward neutral rather than trusted.

**Digital Opportunity (40%)** — how much visible website upside exists, as the
weighted sum of catalogued audit findings. Weights reflect business impact, so a
missing mobile viewport (18) costs far more than a missing canonical tag (3).

### Absence of a website is not a jackpot

A missing website scores **62**, deliberately *below* a broken or badly failing
site. Combined with the weighting, a weak business with no website cannot
outrank an established one with a mediocre site — which is what the
specification requires, and what `tests/opportunity.test.ts` pins down.

### The quality filter

Before ranking, candidates are removed for: unverified Málaga location, being a
duplicate, an irrelevant category, insufficient public evidence, a business too
weak to be worth approaching, or **no meaningful website opportunity**. Results
are never padded to reach the requested count.

---

## Architecture

```
PUBLIC SOURCES → INGEST → NORMALIZE → DEDUPLICATE → VERIFY MÁLAGA
   → BUSINESS QUALITY → WEBSITE DISCOVERY → WEBSITE AUDIT
   → DIGITAL OPPORTUNITY → OPPORTUNITY SCORE → SEARCH INDEX
                                                     ↓
                                        GET /api/search  (reads only this)
```

`Next.js 15 · TypeScript · Tailwind v4 · PostgreSQL` — no ORM, raw parameterised
SQL throughout.

```
src/lib/
  sources/    pluggable adapters: discover → parse → normalize → validate → persist
  geo/        Málaga scope definition and evidence-based verification
  normalize/  text, phone, domain, email, category taxonomy
  dedupe/     domain → phone+name → address+name → fuzzy (secondary only)
  website/    robots-aware fetcher, HTML analysis, auditor, issue catalogue
  scoring/    the three components, the quality gate, the final score
  pipeline/   upsert, scoring, search index, website jobs, job queue
  ai/         Groq, Claude, evidence packaging, caching and cost tracking
  demo/       original website-concept generation
```

### Deduplication

Signals apply strictly in priority order: exact domain → exact phone + similar
name → same address + similar name → fuzzy name (only alongside a shared postal
code). **Ambiguous evidence never merges automatically** — two businesses
sharing a switchboard stay separate and are flagged instead.

### Website auditing

A fast HTTP crawler runs first. Playwright is used *only* when the homepage is
clearly a JavaScript shell, and it is a genuinely optional dependency: the
project builds and type-checks without it installed.

Only the pages the spec prioritises are fetched — homepage, contact, about,
services, booking — capped by `AUDIT_MAX_PAGES` (default 8). `robots.txt` is
parsed and honoured; a disallowed path is recorded and skipped, never worked
around.

### Groq and Claude

Deterministic scoring narrows the field first, then Groq classifies and extracts
signals, and only the strongest prospects reach Claude:

```
all valid businesses → deterministic scoring → Groq → Claude → shortlist
```

Both are cached on a key built from the business, audit version, evidence hash,
prompt version and model, so identical work is never paid for twice. Every call
records latency, token usage, estimated cost and cache hit/miss, visible on
`/api/dashboard` and the Settings page.

---

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/search?q=dentist&limit=10` | The instant shortlist (max 25) |
| `GET /api/prospects/top` | Strongest prospects overall |
| `GET /api/prospects/{id}` | Scores, reasons, audit, reputation |
| `GET /api/businesses/{id}` | Raw stored record with provenance |
| `GET /api/prospects/{id}/analysis` | Stored AI analyses |
| `POST /api/prospects/{id}/deep-analyze` | Refresh, audit, Groq, then Claude |
| `POST /api/prospects/{id}/generate-demo` | Generate a website concept |
| `GET /api/dashboard` | Counts, costs, pipeline state |
| `GET /api/audits`, `GET /api/demos` | Audit and demo listings |
| `GET /api/crm`, `PUT /api/crm/{id}` | Pipeline status |
| `POST /api/import` | CSV / JSON / manual import |
| `GET /api/prospects/{id}/outreach` | Drafts written for this prospect |
| `POST /api/prospects/{id}/outreach` | Draft a pitch from the audit findings |
| `GET /api/export/prospects` | The shortlist as CSV |
| `POST /api/admin/ingest` | Queue ingestion of real businesses by sector |
| `POST /api/admin/run` | Execute queued work within a time budget |
| `GET /api/admin/jobs` | Queue state, dataset counts, live event log |
| `GET /api/cron/refresh` | Scheduled re-audit (scheduler only) |
| `GET /api/health` | Status and configuration |

Write endpoints accept either a bearer token from `API_TOKENS` **or** a
same-origin request from the application's own UI — which is what makes *Deep
analyze*, *Generate demo* and the CRM controls work in a local install without
putting a secret in the browser.

Same-origin is established from `Sec-Fetch-Site`, a header the browser controls
and a cross-site page cannot set, so this is CSRF-safe. A scripted caller with
neither header is always refused. Set `REQUIRE_TOKEN_FOR_UI_WRITES=true` to
require a token even from the UI.

Reads are open by default for local use; set `REQUIRE_AUTH_FOR_READS=true` to
lock them down.

---

## One click per prospect

`POST /api/prospects/{id}/prepare` runs the whole approach in the order the
data requires: audit the site, analyse it, build the concept, then draft the
message that cites what the audit just found. On the prospect page it is one
button, and it returns every step with status, detail and duration.

The order is not cosmetic. Drafting before auditing produces a message that
can cite nothing; building a concept before analysing loses the positioning
the model inferred. That sequence used to live in whoever remembered it.

It runs inline rather than through the job queue -- a person is waiting on the
result and wants to read it, and the chain takes a few seconds. The queue
stays the right tool for bulk work across many businesses.

Steps are shown rather than hidden. A skipped AI step, or a site that would
not respond, changes how much the output is worth, and whoever is about to
send the message needs to know which happened.

## Model routing

AI calls route through **Vercel AI Gateway** when `AI_GATEWAY_API_KEY` is set:
one credential reaches the whole model catalogue, switching model is a string
change, and the gateway fails over between providers.

This exists because the opposite failed in production. The app called Groq
directly with one hard-coded model id, Groq retired that model, and every AI
feature started returning 404. One provider with one model is a single point
of failure.

Three levels, each a loss of polish but never of availability:

```
AI Gateway  ->  direct Groq  ->  deterministic templates
```

`GET /api/health` reports which credential is present and which model each
task resolves to, because a gateway silently falling back to the direct
provider is otherwise invisible.

Free gateway credits only serve the `gpt-oss` models. Buying credits unlocks
the rest with no redeploy: set `AI_MODEL_WRITE=anthropic/claude-sonnet-4.6`.

## Outreach

A ranked list is not a client. Each prospect can be turned into a draft —
email, WhatsApp, call script or LinkedIn note, in Spanish or English — built
from that prospect's own audit.

The rule the code enforces: **every claim must trace back to something the
auditor actually observed.** `pickAngle` chooses the single strongest reason to
make contact, ordered by what a business owner actually feels rather than by
technical severity, and the message may only cite the findings that justify
that angle. A site with no catalogued failings produces a conversion pitch, not
an invented crisis. When Groq is configured it writes the copy from that same
evidence under the same constraint; when it is not, a deterministic composer
does, and `tests/outreach.test.ts` pins the grounding down either way.

Drafts are stored with the issue codes they were built from. **Nothing is ever
sent from this application** — an automated mailer pointed at addresses
collected this way is exactly what this project should not become.

## Deployment

The application is built to run on serverless hosting, where no long-lived
worker process exists. Instead of pretending otherwise, the queue is drained in
bounded slices: `POST /api/admin/run` executes what it can inside one request
and reports what is left, the `/data` page keeps calling while work remains, and
a scheduled job finishes anything nobody is watching. Progress lives in
Postgres, so closing the tab pauses a batch rather than losing it.

```bash
vercel link
vercel integration add neon      # or set DATABASE_URL yourself
vercel env pull .env.local
vercel deploy --prod
```

`vercel-build` applies migrations before building, and the operational routes
also verify the schema lazily behind an advisory lock, so a deployment that
skipped the build step still repairs itself.

| Variable | Why |
| --- | --- |
| `DATABASE_URL` | Set automatically by the Neon integration |
| `CRON_SECRET` | Authenticates the scheduled refresh |
| `API_TOKENS` | Required for programmatic writes to a public deployment |
| `GROQ_API_KEY` | Optional: model-written outreach and classification |

The cron in `vercel.json` runs daily (the most a Vercel Hobby account allows;
raise the frequency on Pro) and is deliberately incremental
— it re-audits only sites whose audit has aged past `REFRESH_STALE_AFTER_DAYS`
(default 14). Re-crawling every site in Málaga on every tick would be wasteful
and impolite to those servers.

## Data sources and conduct

Only legitimately public business information is used, and every record stores
its source, source URL, retrieval time and confidence.

- **OpenStreetMap (Overpass API)** — public, no key. One bounded query per run.
- **Google Places API** — the official documented endpoint, with your own key.
- **CSV / JSON / manual import** — your own lists.

The crawler identifies itself, honours `robots.txt`, applies timeouts and size
caps, and inspects at most a handful of pages per site. When a source refuses a
request, the failure is recorded and the run moves on. There is no CAPTCHA
bypass, no anti-bot evasion, no rate-limit evasion, no private-data extraction,
and no access to anything behind authentication.

Generated demos are **original concepts** built from public business facts. They
never copy the existing site, are marked `noindex`, and state on the page that
they are not the official website of the business.

---

## Testing

```bash
npm test
```

The suite runs against a dedicated `prospect_finder_test` database that is
created automatically on first run. It defaults to the local Docker instance;
set `TEST_DATABASE_URL` to run it against any other server — a hosted Postgres,
a CI service container — so a machine without Docker can still run the tests. It covers normalisation, Málaga filtering
and non-Málaga rejection, deduplication, website discovery and auditing, all
three score components, final ranking, AI caching, both providers, demo
generation, the API, security and the frontend.

The load-bearing guarantees:

| Guarantee | Where |
| --- | --- |
| Search calls no AI | `tests/search.test.ts` |
| Search crawls nothing | `tests/search.test.ts` |
| Search makes no outbound request at all | `tests/search.test.ts` |
| Search stays Málaga-only | `tests/search.test.ts`, `tests/geo.test.ts` |
| Weak businesses never displace stronger ones | `tests/opportunity.test.ts` |
| Results are never padded | `tests/search.test.ts` |
| Search costs about one database round trip | `tests/search.test.ts` |

---

## Security

Secrets come from the environment and are never committed — `.env` is
gitignored, and the structured logger redacts credentials both by key name and
by value shape, so a key leaking through an unexpected field is still caught.

All SQL is parameterised; user input is never interpolated into a query. Inputs
are validated with Zod at every route. Rate limiting, bearer-token auth and
audit logging are applied by one wrapper that every route goes through, so no
route can forget them.

**Changing the city is a configuration change, not a request parameter.**
`?city=Marbella` on the search endpoint does nothing.

---

## Configuration

Everything lives in `.env` (see `.env.example` for the full annotated list).

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | local Docker | PostgreSQL connection |
| `API_TOKENS` | *(empty)* | Bearer tokens for programmatic writes |
| `REQUIRE_TOKEN_FOR_UI_WRITES` | `false` | Require a token even from the UI |
| `GEO_SCOPE_CITY` | `Malaga` | Geographic scope |
| `GEO_MIN_LOCATION_CONFIDENCE` | `0.7` | Evidence needed to be indexed |
| `SEARCH_DEFAULT_LIMIT` / `SEARCH_MAX_LIMIT` | `10` / `25` | Result counts |
| `SEARCH_MIN_OPPORTUNITY_SCORE` | `45` | Shortlist floor |
| `WEIGHT_*` | `0.35` / `0.25` / `0.40` | Score weights |
| `AUDIT_MAX_PAGES` | `8` | Pages per site |
| `AUDIT_ENABLE_PLAYWRIGHT` | `false` | JS rendering |
| `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_PLACES_API_KEY` | *(empty)* | Optional |

Adding another city means adding a `GeoScope` definition in
`src/lib/geo/scope.ts`; an unknown scope throws rather than silently widening.

### Optional: JavaScript rendering

```bash
npm install playwright && npx playwright install chromium
# then set AUDIT_ENABLE_PLAYWRIGHT=true
```

---

## Troubleshooting

**`Cannot reach the database`** — start it with `docker compose up -d`, or point
`DATABASE_URL` at your own PostgreSQL.

**Search returns nothing** — nothing has been indexed yet. Open `/data` and
fetch a few sectors, or run `npm run ingest` followed by `npm run pipeline`.

**Overpass returns 429 or 504** — the public endpoint is busy. The failure is
recorded and the run continues; wait and retry.

**Prospects show "not audited yet"** — website discovery has not run for them
yet. Run `npm run pipeline`.
