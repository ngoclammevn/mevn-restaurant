# Shared lunch AI and Slack worker

One independently deployed Cloudflare Worker serves feedback suggestions and authenticated Slack coordination. The AI route remains read-only; Slack routes persist scoped delivery events through the caller’s Supabase RLS policies. It never saves reviews or star ratings. The Vue app remains a static Vercel build. Shared label contracts come from `../shared/feedback.js`, so deploy from this directory inside the repository rather than copying only `ai-worker/` elsewhere.

Vietnamese canonical docs: [architecture](../docs/architecture/README.md), [security](../docs/security/README.md), [independent deployment](../docs/architecture/deployment.md). The existing Clerk token is the API credential; no separate API key or extra user authentication flow is needed. For the company rollout, use the [main rollout and recovery runbook](../docs/operations/2026-10-29-main-rollout.md); it supersedes older AI-only deployment examples on limiter count and production preview access.

## API

`GET /health` returns `{"version":"1"}`. `POST /v1/feedback-suggestions` requires the existing Clerk session token in `Authorization: Bearer <token>` and an explicitly allowed `Origin`.

```json
{"order_id":"11111111-1111-4111-8111-111111111111","order_item_ids":["22222222-2222-4222-8222-222222222222"],"locale":"vi"}
```

```json
{"version":"1","suggestions":[{"order_item_id":"22222222-2222-4222-8222-222222222222","labels":["Thịt mềm","Hơi dai","Ướp vừa","Hơi mặn"],"source":"ai"}]}
```

`source` is `fallback` when inference fails, times out, hits quota or produces invalid JSON. No fallback bypasses authentication or ownership. Errors are JSON: 400 invalid input, 401 invalid token, 403 generic ownership/date/origin rejection, 408 body read timeout, 413 over 16 KiB, 429 local rate limit (Retry-After 60), 503 missing configuration or unavailable data. Maximum 20 unique item IDs. Item order matches the input.

The worker verifies RS256 using public JWKS at the configured HTTPS issuer, requires exp/nbf/sub/azp, and requires azp to match both an allowed app origin and the request Origin. Cookies are not used. Supabase reads use only its publishable key and the same user token. Group-readable orders still require `orders.user_id === sub`; all requested items must belong to that exact order/menu and its Vietnam date must be today or earlier.

Public JWKS retrieval rejects redirects, forwards no credentials, limits the body to 32 KiB and 1–10 keys, and bounds fetch/body reading to 3 seconds each. Streamed JSON reads have a 4-second body deadline by default, independently of byte limits. Configuration accepts at most 20 distinct exact origins and syntactically valid modern publishable keys. These are per-stage bounds, not a total request deadline. API authentication deliberately adds no mandatory sid/iat/role session guards; Supabase remains responsible for business RLS.

## Owner configuration

Keep the Cloudflare account on Workers Free. No billing activation, Clerk secret or Supabase service-role/secret key is required. Configure these **nonsecret** settings; blank repository values fail closed:

| Setting | Owner-supplied value |
| --- | --- |
| `CLERK_ISSUER` | Exact HTTPS issuer origin from the existing Clerk instance/token; no trailing slash |
| `ALLOWED_ORIGINS` | Comma-separated exact app origins; HTTPS in production, optional localhost HTTP for local development; no wildcard, path or trailing slash |
| `SUPABASE_URL` | Exact project HTTPS origin |
| `SUPABASE_PUBLISHABLE_KEY` | Existing modern `sb_publishable_…` public key (legacy JWT keys deliberately rejected) |

The owner must choose/confirm four distinct rate-limit namespace IDs unique in their Cloudflare account. `1001`–`1004` in the checked-in config are examples, **not discovered account settings**. Copy `wrangler.jsonc` to ignored `wrangler.owner.jsonc`, supply the existing Worker name, `account_id`, the four core settings plus Slack settings below, and all four actual namespace IDs there. Dashboard variables are also possible with `--keep-vars`, but verify they match the intended issuer/origins before deployment. No real account or origin is inferred by this package.

## Install and local development

Use Node 22 or newer. From `ai-worker/`:

```sh
rtk proxy npm ci
rtk proxy npm run types
rtk proxy cp .dev.vars.example .dev.vars
```

Fill the local file with the four nonsecret settings. Then:

```sh
rtk proxy npm run dev
```

Workers AI inference uses the remote Cloudflare service even during local development and consumes the account's free allocation. Offline tests mock inference, JWKS and REST reads and require no Cloudflare login or credentials. Use the browser app's configured localhost origin when making authenticated local requests.

## Final verification and independent deployment

Implementation was requested before testing; the following verification commands are prepared for the controller's final batch:

```sh
rtk proxy npm test
rtk proxy npm run typecheck
rtk proxy npm run dry-run
```

Only the account owner runs deployment, after reviewing configuration and final verification:

```sh
rtk proxy npx wrangler login
rtk proxy npx wrangler types --config wrangler.owner.jsonc --strict-vars=false
rtk proxy npx wrangler deploy --config wrangler.owner.jsonc
```

The Worker deploy is independent of Vercel. Set the Vue app's public suggestion URL to the resulting Worker URL in its Vercel environment and rebuild the static frontend. The owner should check `/health`, valid own-order suggestions, and a denied foreign order after deploying. Deploys/remote smoke tests are not executed by this implementation task.

## Inference, cache and Free limits

The pinned model is [`@cf/meta/llama-3.1-8b-instruct-fp8`](https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fp8/), a Cloudflare-hosted text model covered by the [Workers AI free allocation](https://developers.cloudflare.com/workers-ai/platform/pricing/). It receives only dish names (120 characters), categories (48 characters) and temporary batch indexes. These are treated as untrusted data. Personal notes, tokens, IDs, restaurant names and images never enter prompts. One inference batch generates 2 positive and 2 negative choices per missing dish, with an 8-second abort deadline and at most 2,048 output tokens. Strict parsing rejects malformed structure, missing/duplicate indexes, unsafe/oversized/duplicate labels and unbalanced lists; JSON instructions do not establish a semantic quality guarantee.

Cache API entries contain labels only, last up to one day, and use SHA-256 over normalized name/category/locale/prompt/model version. Cache hits still require authentication, rate limits and fresh ownership checks. Writes use `ctx.waitUntil`; cache errors degrade safely. Cache is location-local and best-effort. Change `PROMPT_VERSION` when changing prompt behavior and `MODEL` when changing models.

Current [Workers Free limits](https://developers.cloudflare.com/workers/platform/limits/) include 100,000 requests/day, 10 ms CPU per request, 128 MB memory and 50 subrequests/request. AI waiting time is not CPU time; actual JWT/parsing/cache CPU usage still requires final verification and a Free-account smoke test. Workers AI includes 10,000 neurons/day, resetting at 00:00 UTC; Free accounts stop further inference when exhausted. The app can still use fallback labels. Do not upgrade billing to handle exhaustion.

[Rate-limit bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) apply 10 requests/user/minute and 60 service requests/minute **per Cloudflare location**. They are eventually consistent, not a global budget counter. Daily Free-account quotas are the final no-spend boundary. Observability logs only fixed event/version/status and AI/fallback counts; invocation logs and traces are disabled. Do not add request headers, raw errors, prompts or personal notes to logs.

## OCR quality gate

The existing OCR provider stays unchanged. Before any OCR migration, benchmark real Vietnamese menu images from the app: compare dish name accuracy, prices, categories, multi-restaurant attribution, latency, failures and total free-tier usage against the existing provider. Record anonymized expected results and decide the acceptable thresholds with the owner. No Cloudflare OCR switch is justified by this text-label implementation or by synthetic examples alone.

Authentication references: [Clerk manual JWT verification](https://clerk.com/docs/guides/sessions/manual-jwt-verification) and [Supabase native Clerk integration](https://supabase.com/docs/guides/auth/third-party/clerk). Runtime references: [Workers AI bindings](https://developers.cloudflare.com/workers-ai/configuration/bindings/) and [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/).


## Slack coordination

The same Worker and `VITE_AI_API_BASE_URL` serve all `/v1/slack/*` POST routes. Every request requires the same Clerk bearer token, allowed Origin and JSON body, capped at 8 KiB. Caller-supplied channels, recipients, URLs, phone numbers and arbitrary message text are rejected. The Worker loads public allowlisted menu/pickup fields and sends no bank details, phone/contact snapshots, private notes or JWT to Slack. Only images from the Supabase public `menus` bucket, at the configured project origin with no query or fragment, can become image blocks.

| Path suffix | JSON body | Authorization |
| --- | --- | --- |
| `publish`, `share`, `closed`, `reopened`, `pickup-changed`, `reminder`, `sync` | `{"menu_id":"uuid"}`; optional expected `revision` | Menu poster |
| `received` | `{"menu_id":"uuid"}` | Current primary or poster; current pickup must already be received |
| `retry` | `{"event_id":"uuid"}` | Same event permission; current DB revision rechecked |
| `resolve` | `{"event_id":"uuid","resolution":"sent"}` or `not_sent` | Poster; explicit human confirmation of unknown result |
| `link-account` | `{"member_id":"U0123456789"}` | Current user; `users.info` verifies active workspace membership |

Successful dispatch returns `{status,eventId,slackUrl?}`. Account linking returns `{status:"linked",memberId,name}`. `sync` returns the current namespace’s pending events for one owned menu. Published/shared revision is 1; close/reopen use closure revision; pickup/received use closure revision × 100000 + pickup version. Clients can omit revision and let the server derive it.

Additional nonsecret settings: `SLACK_WORKSPACE_ID` (T…), `SLACK_ORDER_CHANNEL_ID` (C…), `SLACK_GENERAL_CHANNEL_ID` (C…), `APP_PUBLIC_BASE_URL` (exact HTTPS origin), `SLACK_NAMESPACE` (lowercase environment identifier). Configure `SLACK_BOT_TOKEN` and a random **at least 32 character** `SLACK_RECEIPT_SIGNING_KEY` as Cloudflare secrets, or in ignored local `.dev.vars`. Neither belongs in a Vite environment variable. Use a Slack app with bot scopes `chat:write` and `users:read`; invite the bot to both configured channels. No Slack Events subscription, inbound webhook, cron, KV, D1, Queue or second Worker is required.

The owner must confirm **four distinct Cloudflare limiter namespace IDs** unique in the account. Checked-in 1001–1004 are examples. `SLACK_USER_RATE_LIMITER` and `SLACK_SERVICE_RATE_LIMITER` are independent from the two AI limiters, and Slack configuration is read only on Slack requests. Missing Slack secrets do not disable AI; AI inference or quota is never part of Slack dispatch.

Apply `20261029145252_lunch_slack_events.sql` after the three domain migrations and review RLS before enabling Slack. `slack_profile_links`, `slack_daily_threads` and `slack_notifications` contain public coordination IDs/status/receipts only. RPCs are SECURITY INVOKER, use fixed search paths, and have EXECUTE revoked from PUBLIC/anon. A lease grants one sender a nonce for 30 seconds. Expired in-flight work becomes `unknown`, never automatically pending. The Worker verifies HMAC scope (namespace, workspace, channel, menu/day, kind, revision) before trusting any saved timestamp or schedule ID; the DB receipt alone is never evidence of a successful Slack send.

Status handling:

- `pending` / `retryable`: enqueue/deliver may be retried when due; Slack 429 Retry-After is persisted. There is no automatic non-idempotent transport retry.
- `sending`: one lease is in flight. Other clicks return its status without posting.
- `sent`: a Slack ACK and signed receipt were persisted. Receipt scope must still verify before reuse.
- `unknown`: Slack may have accepted the request, or ACK persistence is uncertain. The poster checks the configured channel, then explicitly confirms seen/not seen. `not_sent` permits another attempt and can produce a duplicate if the operator missed the earlier message. Exactly-once delivery across a lost Slack ACK is not promised.
- `cancel_pending`: an acknowledged schedule could not be cancelled. This remains visible; new reminder scheduling stops until cancellation succeeds.
- `cancelled`: schedule cancellation or explicit operator resolution completed. An operator “already sent” confirmation suppresses retries; it does not manufacture an ACK timestamp or Slack link.

Reminders: first save `set_lunch_reminder(p_menu_id,p_at)` through the logged-in Supabase client, then call `/v1/slack/reminder`. The timestamp must be in the menu’s Vietnam date and at least a minute in the future for delivery. Slack `chat.scheduleMessage` holds the schedule after the browser closes. The Worker never attaches `metadata` (see [Slack scheduleMessage docs](https://docs.slack.dev/reference/methods/chat.scheduleMessage/)). Replacing/disabling a reminder and closing/reopening a menu cancel prior acknowledged schedules via `chat.deleteScheduledMessage`. Reopening does not schedule another reminder automatically. An unresolved prior sending/unknown schedule blocks replacement to avoid duplicate reminders.

Preview/staging must use a separate namespace and test channels; production configuration is explicit and blank by default. `APP_PUBLIC_BASE_URL` must match the intended app, and a signing-key rotation invalidates previous receipts: inspect and reconcile existing events/schedules before rotation. No live workspace, project, channel, token or rollout allowlist is guessed. Enable real delivery only through the release runbook after reviewing the workspace, two channels and namespace.

Offline verification uses Node 22: `node --import tsx --test test/*.test.ts`, `npm run typecheck`, `npm run dry-run`. No command in that batch sends Slack messages or deploys. The repository frontend tests additionally cover current-session token retrieval, logout/account-switch responses, fixed origin, API failures and aborts.
