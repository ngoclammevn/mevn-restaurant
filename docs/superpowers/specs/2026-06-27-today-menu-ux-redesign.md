# Today Page + MenuPage Guest UX Redesign

**Date:** 2026-06-27
**Branch:** nhat

---

## Scope

Two pages:
1. **TodayPage** — remove inline order form, keep orders list, add "Vào chọn món" CTA per card
2. **MenuPage** — fix guest layout overflow, improve guest-banner placement and style

---

## 1. TodayPage Redesign

### Goal
Force users to the MenuPage to order — where they experience the new presence/realtime features. The Today page becomes a **social dashboard**: see who ordered what, then click into the menu to participate.

### Remove
- Entire inline `<form>` block per menu card (item textarea, note field, "Đặt cho" select, submit button)
- All `draft` reactive state references (`draft.item_text`, `draft.note`, `draft.orderFor`, `draft.submitting`, `draft.submitError`)
- `picks` reactive object and `toggleDish` function (no longer needed on Today page)
- `submitOrder` function
- `profiles` ref and `listProfiles` call (was only needed for "đặt cho" dropdown)
- `MenuBoard`'s `@toggle-dish` and `@hover-dish` handlers (MenuBoard stays for viewing, no interaction)
- `ConfettiBurst` import and ref

### Keep
- Orders list per menu (existing orders, social context)
- Inline edit form for own orders (Sửa button stays — useful without going to menu page)
- PaidToggle for own orders
- MenuBoard in view-only mode (no picks/toggle)
- Delete menu button for poster

### Add
A "Vào chọn món →" primary CTA button, placed:
- **When 0 orders:** shown prominently as the main action inside the card
- **When ≥1 orders exist:** shown after the orders list, full-width, as a secondary but visible CTA

Button: `<AppButton :to="\`/menu/${menu.id}\`">Vào chọn món →</AppButton>` with `size="sm"`.

### State cleanup
- Remove `draft` reactive entirely
- Remove `picks` reactive
- Remove `profiles` ref
- Remove `submitOrder`, `toggleDish`, `confettiRef`
- Keep: `editDraft`, `editingOrderId`, `editSaving`, `editError`, `toggleLoading`, `toggleError`, `deleting`, `deleteError`, `copied`, `zoomedImageUrl`

---

## 2. MenuPage Guest Layout Fix

### Overflow fix
`.presence-card` is `position: fixed; right: 16px`. The `.presence-card-grid` has `inset: -24px` which bleeds `8px` past the viewport right edge causing a horizontal scrollbar.

**Fix:** Change `.presence-card` from `right: 16px` to `right: 40px`. Add `overflow: clip` to `.presence-card` to contain the grid bleed.

### Guest-banner improvement
Currently the guest-banner sits below the orders list at the bottom of the card — easy to miss.

**Move:** Place the guest-banner **above the order form section** (where the form would be), so it's clearly the call-to-action for that section rather than an afterthought.

**Style improvement:** Add an icon/emoji before the text for visual weight. Keep current green soft background. Ensure button uses primary variant.

New guest-banner content:
```
🍱 Đăng nhập để đặt cơm trưa cùng mọi người
[Đăng nhập]
```

### Anonymous presence behavior
For guests (`isGuest === true`):
- `myId.value` is `null` → `otherViewers` includes everyone (including guest themselves if anon)
- Solo card correctly hidden (`!isGuest` guard) ✓
- No changes needed to presence logic — just layout fixes above

---

## Out of Scope
- Removing presence from Today page (not needed, Today page has no presence)
- Redesigning the MenuPage orders section
- Changing auth flow
