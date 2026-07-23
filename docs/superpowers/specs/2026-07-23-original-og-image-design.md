# Original Menu Image for Open Graph

**Date:** 2026-07-23
**Status:** Approved

## Goal

When a menu is shared, its Open Graph preview must use the original image uploaded by the
menu poster. OCR output must not influence which image is shared. If the menu has no original
image, the preview uses a static branded image.

## Current problem

`api/og-image.js` currently redirects to `menu.image_url` only when OCR has not produced a
structured menu. Once `dishes[]` exists, it launches Puppeteer and Chromium to render a generated
image instead.

The serverless handlers also cannot reliably look up menus with the Supabase publishable key:
the current RLS policies allow table reads only for authenticated users, while Slack and other
Open Graph crawlers are anonymous.

## Approved behavior

1. A share URL may carry the menu's public Storage image URL in an `image` query parameter.
2. The server accepts the image only when:
   - its origin exactly matches `VITE_SUPABASE_URL` (HTTPS in production; local HTTP remains
     testable);
   - its path starts with `/storage/v1/object/public/menus/`.
3. `api/share.js` sets `og:image` and `twitter:image` to an `api/og-image` URL containing that
   validated source image.
4. `api/og-image.js` redirects to the validated original image.
5. If the image is missing or invalid, `api/og-image.js` redirects to `/og-default.png`.
6. Existing share links without an `image` parameter still return the SPA shell and use the
   static branded fallback.
7. OCR notes and `dishes[]` are never parsed to decide the Open Graph image.
8. Puppeteer and Chromium are removed from the Open Graph runtime path and from dependencies
   when they have no remaining consumers.

## Data flow

```text
User clicks Copy share link
  -> frontend reads menu.image_url already returned by create/load
  -> /share/<menu-id>?image=<encoded-public-storage-url>
  -> api/share validates image URL
  -> HTML meta points to /api/og-image?image=<encoded-url>
  -> api/og-image validates again
  -> 307 original Storage image

No image / invalid image
  -> /api/og-image
  -> 307 /og-default.png
```

Validation happens in both serverless handlers so `api/og-image` cannot become an open redirect
when called directly.

## Frontend changes

Every place that creates a share link must use one shared helper:

- the success state after posting a menu;
- the Today page share action;
- the Menu page share action;
- the My Menus management page share action.

The helper appends `image` only when `menu.image_url` is present. It preserves the short legacy
URL for text-only menus.

## Share handler behavior

`api/share.js` may still attempt to load menu details for richer title and description. Failure to
load those details must not redirect a valid share request away from the SPA. Instead, it serves
generic Vietnamese metadata and the selected original/fallback image. This keeps anonymous
crawlers working without weakening table RLS.

The browser destination remains `/menu/<id>` after the SPA router handles `/share/<id>`.

## Static fallback

`public/og-default.png` is a committed 1200×630 branded image using the application's existing
green, cream, and lunchbox visual language. It is generated once during development, not at
request time.

## Error handling

- Missing `id`: redirect to `/`, preserving current behavior.
- Invalid or foreign `image` URL: ignore it and use the branded fallback.
- Supabase lookup unavailable or RLS-hidden: serve generic metadata instead of a 500 or redirect.
- Missing fallback asset is caught by build/runtime smoke tests.

## Testing

Regression tests cover:

- structured OCR menu plus original image still selects the original image;
- a valid Supabase Storage menu image is accepted;
- a foreign origin, wrong bucket, protocol downgrade, and malformed URL are rejected;
- `api/og-image` redirects valid images and falls back for invalid/missing images;
- `api/share` serves HTML with generic metadata when Supabase cannot return a menu;
- all frontend share entry points use the shared URL helper;
- Puppeteer is not launched and its dependencies have no remaining imports.

Verification includes the complete UI/RLS test suite, production build, and local HTTP smoke tests
for both original-image and fallback share URLs.

## Non-goals

- No RLS policy changes.
- No public exposure of profiles, orders, payment information, or OCR data.
- No runtime image generation.
- No changes to OCR behavior or menu image upload behavior.
