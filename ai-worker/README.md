# Lunch feedback suggestion worker

An independently deployed, read-only Cloudflare Worker. It suggests selectable Vietnamese dish feedback; it never saves reviews, star ratings or business data. The Vue app remains a static Vercel build. Shared label contracts come from `../shared/feedback.js`, so deploy from this directory inside the repository rather than copying only `ai-worker/` elsewhere.

Vietnamese canonical docs: [architecture](../docs/architecture/README.md), [security](../docs/security/README.md), [independent deployment](../docs/architecture/deployment.md). The existing Clerk token is the API credential; no separate API key or extra user authentication flow is needed.

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

The owner must choose/confirm two distinct rate-limit namespace IDs unique in their Cloudflare account. `1001`/`1002` in the checked-in config are examples, **not discovered account settings**. Copy `wrangler.jsonc` to ignored `wrangler.owner.jsonc`, supply `account_id`, the four settings, and the actual namespace IDs there. Dashboard variables are also possible with `--keep-vars`, but verify they match the intended issuer/origins before deployment. No real account or origin is inferred by this package.

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
