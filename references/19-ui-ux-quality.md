# 19 — UI/UX Quality: Make It Look and Feel Like a Real Product

Users judge quality in seconds. A correct product with a default-template look reads as
a prototype. This file is the bar for every screen.

## Contents
1. Design tokens first
2. Layout and hierarchy
3. Components and states
4. Copy
5. Responsive behaviour
6. Accessibility essentials
7. Visual self-review checklist

---

## 1. Design tokens first

Before building screens, define a small token set in one place (CSS variables / Tailwind theme):

```css
:root {
  --color-bg: #ffffff;        --color-surface: #f7f7f8;   --color-border: #e4e4e7;
  --color-text: #18181b;      --color-text-muted: #52525b;
  --color-primary: #4f46e5;   --color-primary-contrast: #ffffff;
  --color-danger: #dc2626;    --color-success: #16a34a;   --color-warning: #d97706;
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px;
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-6: 24px; --space-8: 32px; --space-12: 48px;
  --font-sans: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --text-sm: 0.875rem; --text-base: 1rem; --text-lg: 1.125rem; --text-xl: 1.25rem; --text-2xl: 1.5rem; --text-3xl: 1.875rem;
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.06); --shadow-md: 0 4px 12px rgb(0 0 0 / 0.08);
}
@media (prefers-color-scheme: dark) { :root { --color-bg: #0b0b0f; --color-surface: #16161d; --color-border: #27272f; --color-text: #f4f4f5; --color-text-muted: #a1a1aa; } }
```

Pick **one** accent colour that suits the product's personality and use it sparingly
(primary buttons, links, active state). Neutrals carry the rest. Check text contrast ≥ 4.5:1.

## 2. Layout and hierarchy

- One primary action per screen, visually dominant. Secondary actions are quieter (outline/ghost).
- Consistent page shell: header/nav, page title + short description, content, consistent max width (e.g. 1120 px app, 720 px forms/reading).
- Spacing on the 4/8 px scale only. Generous whitespace beats borders and boxes.
- Type scale: page title 1.5–1.875 rem semibold, section 1.125–1.25 rem, body 1 rem, meta 0.875 rem muted. Max ~70 characters per line for reading text.
- Align to a grid; left-align text; right-align numbers in tables.
- Group related controls; label groups; put destructive actions last and apart.

## 3. Components and states

Every data-backed view must design all five states:

| State | Must have |
|---|---|
| Loading | Skeleton or spinner after ~200 ms; no layout jump when data arrives |
| Empty | Friendly explanation + the primary action to create the first item |
| Error | Plain-language message, what to do next, retry button; keep user input |
| Partial / paginated | "Load more" or pager; count when cheap |
| Success | Toast or inline confirmation for writes; optimistic UI only with rollback |

Interactive elements need hover, focus-visible, active, disabled, and loading states.
Buttons show a spinner and become disabled while submitting (prevents double submit).
Forms: labels above inputs, inline field errors after blur/submit, an error summary for long
forms, and the submit button never silently does nothing.

Destructive actions: confirmation dialog naming the object ("Delete project 'Acme Site'?"),
or undo toast for low-risk deletes.

## 4. Copy

- No lorem ipsum, "Test", "Foo", or developer jargon in the UI. Write real, short, specific copy.
- Buttons are verbs: "Create project", not "Submit". Titles are nouns: "Projects".
- Errors say what happened and how to fix it: "That email is already registered. Sign in instead?" — never "Error 409".
- Empty states teach: "No clients yet. Add your first client to start logging time."
- Consistent capitalization (sentence case) and terminology (don't mix "project"/"workspace" for the same thing).

## 5. Responsive behaviour

- Design mobile-first; verify at 375 px, 768 px, 1280 px.
- Navigation collapses to a menu on small screens; tables become stacked cards or scroll horizontally inside their container (never the whole page).
- Touch targets ≥ 44×44 px; inputs ≥ 16 px font on mobile (prevents iOS zoom).
- No horizontal page scroll at any width — the smoke test checks this.
- Images responsive (`max-width: 100%`, explicit dimensions to avoid layout shift).

## 6. Accessibility essentials

- Semantic HTML: `button` for actions, `a` for navigation, headings in order, `main`/`nav`/`header` landmarks, lists for lists, tables for tabular data.
- Every input has a `<label>`; errors linked with `aria-describedby`; required fields marked.
- Visible focus ring on everything focusable (`:focus-visible`), logical tab order, no keyboard traps; dialogs trap focus while open and return focus on close; Escape closes.
- Status messages announced (`role="status"` / `aria-live="polite"`); errors `role="alert"`.
- Colour is never the only signal (add icon/text). Contrast ≥ 4.5:1 for text, 3:1 for large text and UI components.
- `prefers-reduced-motion` respected; no auto-playing motion that can't be paused.
- `lang` attribute on `<html>`; meaningful `alt` text; decorative images `alt=""`.

## 7. Visual self-review checklist (P5, with screenshots)

Open each screenshot and check:
- [ ] Would a stranger believe this is a real, shipped product?
- [ ] Clear primary action; nothing competes with it
- [ ] Consistent spacing, alignment, radii, font sizes across pages
- [ ] No overflow, clipped text, overlapping elements, or horizontal scroll (mobile and desktop)
- [ ] Empty, error, and loading states exist and look intentional
- [ ] No placeholder copy, raw JSON, `undefined`, `NaN`, `[object Object]`, or ISO timestamps shown to users
- [ ] Dark mode (if supported) has no unreadable text
- [ ] Focus ring visible when tabbing
- [ ] Favicon and page titles set
