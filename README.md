# Default Zero

Discipline and accountability app. Proof over performance.

## Stack

- Frontend: Expo (React Native)
- Backend: FastAPI
- Database/Auth/Storage: Supabase (Postgres)
- Local dev: Docker (backend only — Expo runs natively)

## Project layout

```
default-zero/
  frontend/         Expo app
  backend/           FastAPI app
  supabase/          SQL schema to run in Supabase SQL editor
  docker-compose.yml
```

## Quick setup (run this first)

From the project root:
```
bash setup.sh
```
This installs backend Python dependencies (in a virtual environment), frontend npm dependencies, and the EAS CLI you'll need to build the shareable APK. It also copies both `.env.example` files to `.env` if they don't already exist — you still need to fill in your actual keys afterward (Supabase, Groq).

If you're on Windows without Git Bash, run the equivalent commands manually — they're listed in "First-time setup" below.

## Testing on your phone during development

`npx expo start` opens Expo Go for **you**, on your own phone, while you're building. Your phone and laptop need to be on the same wifi for this to work — if they're not (or you get a network error), run `npx expo start --tunnel` instead, which routes through Expo's servers so network mismatches stop mattering.

This step is for you only. It is not how you get the app to 500 other people — see below.

## Deploying the backend so it's not stuck on localhost

`localhost:8000` only ever means "this exact laptop." Your phone — or anyone else's — can never reach it, which is why it failed last time. Fix:

1. Push this repo to GitHub.
2. On [Render](https://render.com), New → Blueprint → point it at your repo. It reads `render.yaml` at the root and sets itself up automatically.
3. In the Render dashboard, fill in the env vars it asks for (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `JWT_SECRET`, `GROQ_API_KEY`, `ALLOWED_ORIGINS`) — these are marked `sync: false` in the config, meaning Render won't guess them, you enter them once in the dashboard.
4. Once deployed, Render gives you a real URL like `https://default-zero-api.onrender.com`. Put that in `frontend/.env` as `EXPO_PUBLIC_API_URL` — now every device, anywhere, hits the same real backend.

Use the **Starter** plan (already set in `render.yaml`), not free — free tier sleeps after 15 minutes idle and the next request eats a 30-60s cold start, which is exactly the "feels broken" problem you're trying to avoid on launch day.

## Getting a real link to send 500 people

This is the actual distribution path — not Expo Go, not a Play Store listing. EAS Build compiles your app in the cloud and hands you a direct APK download link when it's done.

1. `eas login` (free Expo account — the CLI is already installed if you ran `setup.sh`)
2. From `frontend/`: `eas build --platform android --profile preview`
3. It builds in the cloud (a few minutes, you can close your laptop). When done, it prints a download link — that link *is* what you send. Anyone who opens it on Android downloads and installs directly.
4. They'll need to allow "install from unknown sources" once — normal and expected for APK distribution outside the Play Store, common in Kenya.

Re-run step 2 any time you ship changes and want to send an updated link. Each build gets its own link, so old links stay valid for whoever hasn't updated yet.

## First-time setup (fresh machine)

### 1. Prerequisites
- Node.js LTS (18 or 20) — https://nodejs.org
- Python 3.11+
- A free Supabase project — https://supabase.com
- Expo Go app on your phone (for testing without a build)

Check Node is installed correctly before doing anything else:
```
node -v
npm -v
```

### 2. Backend

```
cd backend
python -m venv venv
venv\Scripts\activate        (Windows)
source venv/bin/activate     (Mac/Linux)
pip install -r requirements.txt
cp .env.example .env
```
Fill in `.env` with your Supabase URL, Supabase service key, and a JWT secret.

Run it:
```
uvicorn main:app --reload
```
API will be live at http://localhost:8000 — docs at http://localhost:8000/docs

### 3. Google Sign-In setup

Default Zero uses Google as the only sign-in method, through Supabase Auth (so it's still Supabase managing sessions — Google is just the login screen users see, and it works identically across every device without a password).

1. Go to [Google Cloud Console](https://console.cloud.google.com) → create a project (or use an existing one) → APIs & Services → Credentials → Create OAuth client ID → type **Web application**.
2. In your Supabase project → Authentication → Providers → **Google** → toggle it on. Supabase shows you a callback URL there — copy it.
3. Back in Google Cloud Console, paste that callback URL into **Authorized redirect URIs** on the OAuth client you made, then save.
4. Copy the Google **Client ID** and **Client Secret** into the Supabase Google provider screen, save.

That's it — no Google-side app review needed for testing with your own account or a handful of testers.

### 4. Database

Open your Supabase project → SQL Editor → paste the contents of `supabase/schema.sql` → Run.
This creates: users, day_zero_videos, containers, container_entries, mentorship_lanes, mentor_matches, socrates_sessions.

### 5. Frontend

```
cd frontend
npm install
cp .env.example .env
```
Fill in `.env` with your Supabase URL/anon key and your backend API URL.

Run it:
```
npx expo start
```
Scan the QR code with Expo Go, or press `a` for Android emulator / `i` for iOS simulator.

### 6. Docker (optional, backend only)

```
docker compose up --build
```

---

## Going to production with multiple users

Fixes already in this scaffold:
- Socrates calls to Groq are now **async**, so one user's chat request doesn't block everyone else's requests while it waits on a response.
- **Rate limiting** (10 requests/min per caller) on the Socrates endpoint, so one user can't burn your entire Groq quota alone.
- **CORS locked** to an `ALLOWED_ORIGINS` env var instead of `*` — set this before deploying.
- A **catch-all error handler** so one unhandled exception returns a clean 500 instead of crashing that worker or leaking a stack trace to the client.
- **Database indexes** on `user_id` / `container_key` so queries stay fast as row counts grow, not just at low volume.
- Docker now runs **4 uvicorn workers** in production instead of 1, so requests run in parallel instead of queueing behind each other.

Still worth knowing before you scale past a handful of users:
- **Free-tier hosting sleeps.** If you deploy the backend on Render's free tier, it goes idle after 15 minutes and the next request eats a 30-60 second cold start. Fine for testing with friends, not fine once real users depend on it — budget for a paid tier (or Railway/Fly.io) once you're past pilot stage.
- **Supabase free tier caps concurrent DB connections** (around 60). You won't hit this early, but it's the next wall after hosting.
- **Video uploads (Day Zero) are the heaviest thing this app does.** The upload endpoint currently reads the whole file into memory — fine for a few users, but you'll want to stream it directly to Supabase Storage before this goes wide, so a big video from a bad connection doesn't tie up a worker.
- **Load test before a real launch**, not after. Even a rough test (multiple fake users hitting Socrates and the dashboard at once) will show you where the next bottleneck actually is instead of guessing.

## Socrates — the actual Socratic method, not a supportive chatbot

Socrates doesn't give advice, doesn't hand out plans, and doesn't offer encouragement or a pep talk — that's a deliberate rule in its system prompt, not an oversight. Its job is to ask the question that forces the user to answer it themselves, the way the real Socrates worked: expose the contradiction, don't resolve it for them.

On every message, the backend pulls the user's actual Day Zero status and last 5 entries per container (Money, Physical, Spiritual, Mind) — including days since their last entry in each — and feeds that in as evidence. When what the user types contradicts what they've actually logged, Socrates is instructed to name that gap directly and ask them to explain it, not soften it with sympathy first. An empty or stale container isn't treated gently — it's something to interrogate.

It's built to be exacting, not cruel — it doesn't insult the user, it just doesn't let inaction hide behind good intentions. If you want it sharper or softer, the rules are explicit and easy to tune in `SOCRATES_SYSTEM_PROMPT` in `backend/app/routers/socrates.py` — the "hard rules" list there is the actual lever.

## Notifications

Push notifications are wired end to end: the app registers for a push token on launch, saves it to Supabase (`push_tokens` table), and the backend can send a nudge to any user via Expo's push service (`backend/app/routers/notifications.py`). The `/notifications/send` route is a stub for you to lock down or replace with a scheduled job later — right now it's meant for you to trigger manually or wire into a cron (e.g. "nudge anyone with 3+ days since their last Physical entry").

The custom horse neigh sound only plays on a real build (EAS build) — Expo Go itself can't bundle custom notification sounds, so during dev testing in Expo Go you'll hear the default system sound instead. That's an Expo Go limitation, not a bug in the setup; the real APK will have it.

## Icons

All in-app icons use [Ionicons](https://ionic.io/ionicons) via `@expo/vector-icons` — a proper, widely-used professional icon set (already bundled with Expo, no extra setup) — instead of emoji, so the app reads as a finished product rather than a prototype. If you want a different icon anywhere, browse the full set at the link above and swap the name in the relevant screen file.

## Mentorship — by life container OR by profession

Two separate lane types now, and a user picks one per request:
- **By container** — matched with someone further along in the same life container (Money, Physical, Spiritual, Mind), the original idea.
- **By profession** — free text, e.g. "Software Engineer" or "Nurse." Matching on free text is naturally imprecise (someone typing "dev" won't auto-match "developer") — the backend does simple normalized matching for now; that's flagged as a TODO to improve once you see what people actually type in.

## Finance — full analytics, not just a log

The Money container is now its own screen (`FinanceScreen.js`) instead of the generic entry list every other container uses:
- Savings rate, total income/expense, a 6-month income-vs-expense chart, and a spend-by-category breakdown — all computed server-side in `/finance/summary`.
- Savings goals with progress bars.
- Manual entry form (amount, type, category) for anyone who'd rather log by hand.

**M-Pesa integration — the honest version.** Daraja (Safaricom's API) is built for businesses *receiving* payments — there's no Safaricom API that lets an app read a user's own M-Pesa transaction history. So this uses two separate real mechanisms instead of pretending one API does both:
- **STK Push** (`/finance/mpesa/stkpush`) — for money going *into* Default Zero, e.g. a savings goal contribution. This is what Daraja is actually for, and it's fully wired: initiate → Safaricom prompts the user's phone → webhook confirms → transaction logged automatically.
- **SMS import** (`/finance/import/sms`, `frontend/lib/smsImport.js`) — for tracking the user's general spending. The app reads the user's own M-Pesa confirmation texts on-device and sends the text to the backend for parsing. This is genuinely Android-only (iOS doesn't allow any app to read SMS, no exceptions) and only works in a real build, not Expo Go, since it needs a native module. The parser handles the common M-Pesa message formats (sent to, paid to, received, withdrawn) — real message wording varies by transaction type, so it skips anything it can't confidently parse rather than guessing and logging something wrong.

To actually use the M-Pesa pieces, you'll need a Daraja account (free, sandbox first) from the [Safaricom Developer Portal](https://developer.safaricom.co.ke) — get your consumer key/secret, a test shortcode, and passkey from there, then fill them into `backend/.env`.

## Containers are dynamic now, not hardcoded

Six defaults ship for every user: Money, Physical, Spiritual, Mind, **Relationships**, and **Emotional Regulation** — pulling the app toward actual human lifestyle, not just habit-tracking. Beyond the defaults, users can add their own containers, or accept one Socrates proposes mid-conversation (see below). This is a real architecture change from the first version of this scaffold — containers now live in the `containers` table instead of being a hardcoded list in the code, so the dashboard, summary, and entry screens all read from the database instead of a fixed array.

## Socrates can propose new containers — and knows when NOT to be Socrates

If Socrates notices a real recurring pattern in a conversation that doesn't fit an existing container, it can propose one. The user sees it as a tappable chip under that message ("Add 'Boundaries' as a container?") — nothing gets created without the user choosing to add it.

**The important part:** Socrates' confrontational, no-comfort style is built for accountability — did you show up, does what you said match what you logged. It is deliberately switched off for two different situations, and this is not a nice-to-have, it's load-bearing given what you're adding (Relationships, Emotional Regulation):

- **Genuine emotional pain** (grief, being hurt by someone, real overwhelm) — the system prompt explicitly tells the model to drop the interrogation mode and respond like it's actually listening, not confronting a contradiction.
- **Crisis language** (self-harm, suicidal thoughts) — this bypasses the AI model entirely. A keyword check runs first, before anything reaches Groq, and routes to a fixed, pre-written response with a real Kenyan crisis resource (Emergency Medicine Kenya Foundation's toll-free line, 0800 723 253) rather than letting a language model handle something this serious. This is a blunt keyword net, not a clinical tool — treat it as a floor to build on, not a finished safety system, especially once you have hundreds of real people using it. If you're serious about the Relationships/Emotions containers, it's worth having someone with actual mental-health-adjacent experience review this layer before a wide launch — that's a genuine "don't guess" recommendation, not a formality.

## Goals — general purpose, any container

A `life_goals` table and `/goals` endpoints let a user set a goal tied to any container (or none), track progress with a simple percentage, and mark it complete. This is intentionally simple in v1 — no auto-progress from entries yet, the user updates it directly — since the "right" way to derive progress automatically depends on decisions about what counts as proof, which is yours to make as you see real usage.

## On not failing with 300 people

Everything from earlier in this build stays in place and matters most right now: async Socrates calls, per-user rate limiting, indexes on every user-scoped table (including the new `containers` and `life_goals`), the streamed Day Zero upload with a memory cap, configurable worker count, and the paid Render tier recommendation. I ran an actual import test on the full backend with all these new routers wired in — it loads cleanly with no route conflicts across all 23 endpoints. That's necessary, not sufficient: the honest next step before 300 real people is a soft launch to a smaller group first if you haven't already, watching Render/Supabase logs for the first real traffic, before assuming it'll hold at full scale untested.

## Proof Score — the actual formula, not a placeholder

Each container scores 0-100 from two ingredients:
- **Current streak** (consecutive days with an entry, capped at 30) — 60% weight
- **Recency decay** — drops 20 points per day since the last entry — 40% weight

If the most recent entry is 2+ days old, the streak resets to 0 even if there was a long run before that — a stale 20-day streak scores the same as an empty container, on purpose. Proof over performance means old effort doesn't carry you once you've stopped.

The overall Proof Score is the **average across every container**, including empty ones. This is what actually enforces "can't hide a weak area behind a strong one" — one dead container drags the whole number down, it can't be offset by being strong somewhere else. Formula lives in `backend/app/scoring.py`, shared by both the dashboard and mentorship matching below.

## Mentorship — real matching, not first-come-first-served

Users now opt in as mentors (container or profession, with a mentee cap — default 3) instead of matches being manually assigned. When a mentee requests a match:
- **By container**: candidates are ranked by their actual Proof Score in that container (using the same formula above), then by who has the fewest mentees already, so the strongest available mentor gets picked and load doesn't pile onto one person.
- **By profession**: free text is normalized and matched (exact first, then a looser "contains" match as fallback, since "dev" and "developer" won't line up as an exact string) — ranked by least-loaded mentor, since there's no meaningful container score to rank a profession match by.

If no mentor is available yet, the mentee's request stays pending rather than failing outright.

## Automated nudges — the real discipline-harnessing mechanism

`/notifications/nudge-stale-containers` is a locked, internal-only endpoint (see below) that checks every user's container scores using the exact same formula the dashboard shows them, and pushes a notification to anyone below a staleness threshold. This is what actually "harnesses discipline through Default Zero" — set it to run once a day via a free external scheduler like [cron-job.org](https://cron-job.org) or Render's own Cron Jobs feature, hitting your deployed URL with the internal key header. It runs on plain data, not Groq, so it carries none of the AI rate-limit risk from earlier.

## Internal-only endpoints — locked down properly

`/notifications/send` and `/notifications/nudge-stale-containers` now require a shared secret (`INTERNAL_API_KEY` in `backend/.env`) passed as an `X-Internal-Key` header — a regular signed-in user can no longer call these at all. Generate a real key with:
```
python3 -c "import secrets; print(secrets.token_hex(32))"
```
(On Windows, if `python3` isn't recognized, use `python` instead — same command otherwise.)
If this env var isn't set, the routes reject every request rather than defaulting open.

## Crisis detection — now two layers, not one

The keyword net from before still runs first, unconditionally, on every message — instant, zero cost, catches explicit language regardless of anything else. On top of it, a second layer now runs: a small, fast model classifies the message as CRISIS or SAFE before the main Socrates call happens, catching paraphrased or subtler language the keyword list can't anticipate ("I don't think I can keep doing this" vs. an explicit phrase). If that classifier call fails for any reason, it fails toward *not* blocking the conversation — the keyword net is still there underneath it regardless, so a classifier hiccup doesn't remove the primary protection.

This is still a genuine "don't guess" situation, same as before: two automated layers are a real improvement over one, but neither is a clinical tool. Worth a real review by someone with mental-health-adjacent judgment before this is in front of your full 300, especially given Relationships and Emotional Regulation are now containers people will actually use.

## Assets you need to send

Drop these into `frontend/assets/` with these exact filenames so the code picks them up automatically. The horse logo you already sent is saved as `frontend/assets/logo.png` and is already wired into the splash screen and app icon config.

| Filename | Used for | Recommended size |
|---|---|---|
| `logo.png` | ✅ already have this — splash centerpiece, header mark | already sent |
| `google-icon.png` | The "G" logo on the Continue with Google button | 40x40, transparent bg (this is Google's own logo — download the official one from Google's brand resources, don't redraw it) |
| `notification-icon.png` | Small icon shown in the Android status bar for nudges | 96x96, must be a plain white silhouette on transparent — Android ignores colors here and renders it as a flat white shape |
| `sounds/neigh.wav` | The horse neigh notification sound | .wav format, under 5 seconds, mono preferred. Get a free one from [Zapsplat](https://www.zapsplat.com) or [Freesound](https://freesound.org) (search "horse neigh") — pick a short, clean one, not a long clip, since it plays in full on every nudge |
| `icon.png` | App home-screen icon | 1024x1024, square, no transparency needed but fine either way |
| `adaptive-icon.png` | Android adaptive icon foreground | 1024x1024, logo centered with padding (Android crops to a circle/rounded square) |
| `favicon.png` | Web favicon (Expo web) | 48x48 |
| `day-zero-bg.jpg` | Background for the Day Zero recording screen — should feel serious, a threshold moment | 1080x1920 |
| `container-money.png` | Icon for the Money life container | 512x512, transparent bg |
| `container-physical.png` | Icon for the Physical life container | 512x512, transparent bg |
| `container-spiritual.png` | Icon for the Spiritual life container | 512x512, transparent bg |
| `container-mind.png` | Icon for the Mind/Discipline life container (if you're keeping this as a 4th) | 512x512, transparent bg |
| `mentorship-lanes.png` | Illustration for the empty state on the Mentorship screen before a match | 800x600 |
| `socrates-avatar.png` | Avatar for the Socrates AI chat bubble | 256x256, round-safe |

You don't need all of these to run the app — placeholders are already coded in so nothing crashes if a file is missing. Send them whenever they're ready and drop them straight into `frontend/assets/`, no code changes needed.

## Screens included in this scaffold

1. Splash — logo reveal, uses `logo.png`
2. Onboarding — 3-slide intro
3. Auth — Google sign-in via Supabase Auth (no email/password)
4. Day Zero Record — mandatory uneditable video recording, one-time
5. Dashboard — dynamic containers grid (6 defaults + any custom ones), Goals/Mentorship/Socrates links
6. Container Detail — entries for Physical/Spiritual/Mind/Relationships/Emotional Regulation/custom containers
6b. Finance — dedicated screen for Money: analytics, charts, savings goals, M-Pesa import
7. Goals — general purpose, spans any container, simple progress tracking
8. Mentorship — matched by life container OR by free-text profession
9. Socrates Chat — grounded in real user data, proposes new containers when it sees a pattern, switches out of confrontational mode for genuine pain or crisis
10. Profile — settings, account, sign out

This is a working navigation skeleton with real screens, not just wireframes — each screen renders, is styled to match the logo's black/gold identity, and is wired to call the backend where relevant. Business logic inside each screen (matching algorithm, scoring, video upload pipeline) is left as clearly marked TODOs for you to fill in, since that's the part only you can define correctly for Default Zero.
#   d e f a u l t - z e r o  
 