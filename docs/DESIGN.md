# ARIA — Design Document

> **Audience:** Designers and developers maintaining or extending the ARIA agent UI.

---

## Design Philosophy

ARIA's visual identity is built around a single concept: **a premium developer tool**, not a generic chatbot. The design deliberately avoids the clichés of AI product UIs — white backgrounds, rounded-everything, and teal/purple gradients on cream — in favour of a dark, precise, terminal-adjacent aesthetic that signals capability.

Every decision flows from three principles:

1. **Depth over flatness** — Layered backgrounds, subtle borders, and gradient accents create visual hierarchy without adding noise.
2. **Motion as signal** — Animations communicate system state (loading, new message, tool running), never decoration.
3. **Information density** — The interface carries a lot of information (messages, status, tabs, preview) without feeling cluttered, through careful use of size and colour contrast.

---

## Colour System

### Base Palette

The palette uses a deep navy-black as its foundation — closer to `#06060e` than pure black. This reduces eye strain and creates space for subtle lighter surfaces.

```
Background       #06060e    ← Page root — near-black, slight blue cast
Surface          #0d0d1a    ← Message bubbles, input field
Surface Elevated #0f0f20    ← Status pills, badge hover states
Border           #131325    ← Subtle bubble borders
Border Muted     #1a1a2e    ← Input borders, panel dividers
```

### Accent Colours

The primary brand accent is **Indigo 500** (`#6366f1`), paired with **Blue 500** (`#3b82f6`) for gradients. Indigo was chosen over the common "AI purple" (#7c3aed) because it reads as more technical and precise — closer to an IDE highlight colour than a marketing gradient.

```
Indigo (primary)      #6366f1    ← Logo, active tabs, send button, dots
Blue   (gradient end) #3b82f6    ← Gradient pair for depth
Indigo Light          #818cf8    ← Tab labels, status text
Indigo XLight         #a5b4fc    ← Badge text, app name in preview badge
```

### Text Hierarchy

```
Primary text      #e2e8f0    ← Headings, strong elements
Secondary text    #94a3b8    ← Message body, paragraph text
Muted text        #64748b    ← Preview chrome URL bar
Dim / Disabled    #334155    ← Placeholder, inactive tab labels
```

### Semantic Colours (used in preview chrome)

```
Red    #ef4444    ← Close button dot
Amber  #f59e0b    ← Minimise button dot
Green  #22c55e    ← Expand button dot
```

These only appear in the preview panel's fake browser chrome and carry no interactive meaning.

---

## Typography

### Typeface Choices

**DM Sans** (primary) — A geometric sans-serif with a contemporary, confident character. Chosen over Inter (too ubiquitous), Space Grotesk (too stylised), and system fonts (too generic). DM Sans's slightly wide letterforms work well at the 13–15px chat message size.

**JetBrains Mono** (code) — The reference monospace for developer tooling. Paired with Fira Code as fallback. Used exclusively inside code blocks to maintain clear visual distinction between prose and code.

```css
font-family: 'DM Sans', 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
/* Code blocks: */
font-family: 'JetBrains Mono', 'Fira Code', monospace;
```

### Type Scale

| Label | Size | Weight | Usage |
|-------|------|--------|-------|
| xs | 11px | 500–700 | Badges, language labels, sub-labels |
| sm | 12px | 500–600 | Buttons, tab labels, metadata |
| base | 13.5px | 400 | Chat message body (most text) |
| md | 15px | 700 | ARIA brand name, section headings |
| lg | 18px | 700 | Send button icon |

### Letter Spacing

- Brand name ("ARIA"): `letter-spacing: -0.02em` — tight for display weight
- Sub-label ("AI AGENT"): `letter-spacing: 0.05em` — open for label style
- Language labels in code blocks: `letter-spacing: 0.08em`, `text-transform: uppercase` — reads as a badge

---

## Spacing System

ARIA uses an ad-hoc spacing scale based on multiples of 4px. There's no formal utility framework — all spacing is inline.

| Token | Value | Used for |
|-------|-------|---------|
| xs | 4px | Icon internal padding, gap between dots |
| sm | 6–8px | Gap between avatar and bubble, list item gap |
| md | 10–12px | Bubble padding vertical, input padding |
| lg | 16px | Bubble padding horizontal, panel padding |
| xl | 20px | Page/section padding |

---

## Component Inventory

### Message Bubble

Two variants — user and assistant — differentiated by:

| Property | User | Assistant |
|----------|------|-----------|
| `justify-content` | `flex-end` | `flex-start` |
| Background | `linear-gradient(135deg, #6366f1, #4f46e5)` | `#0d0d1a` |
| Border | None | `1px solid #131325` |
| Border radius | `18px 18px 4px 18px` | `4px 18px 18px 18px` |
| Text colour | `#fff` | Rendered via `<MD>` |
| Box shadow | `0 4px 20px #6366f133` | `0 2px 12px #00000066` |

The asymmetric border radius creates the "tail" effect pointing toward the sender — a universal chat convention maintained here.

### Typing Indicator

Three dots with staggered `pulse` animation:

```
Dot 1: animation-delay: 0ms
Dot 2: animation-delay: 220ms
Dot 3: animation-delay: 440ms
```

The 220ms stagger with a 1200ms total duration creates a smooth, wave-like motion that doesn't feel frantic.

### Status Pill

Appears in the header only during API calls. Uses `slideUp` animation on mount. Contains three dots (same timing as typing indicator) plus a text label that updates as tools are invoked:

```
"Thinking…"            ← Default during API call
"Building Pomodoro…"   ← When build_app tool is invoked
```

### Logo / Brand

The ⚡ emoji inside a rounded square with the indigo-blue gradient uses an infinite `glow` keyframe animation with a 3-second cycle — long enough to be subtle, short enough to feel alive.

```css
@keyframes glow {
  0%, 100% { box-shadow: 0 0 20px #6366f133; }
  50%       { box-shadow: 0 0 40px #6366f166; }
}
```

### Tab Switcher

Only rendered when an app has been built (`hasApp === true`). Active tab uses a gradient background + indigo border; inactive uses transparent background + dim text. The transition is 180ms ease — fast enough to feel responsive without being jarring.

### Preview Panel — Browser Chrome

The faux browser chrome (traffic light dots + URL bar + close button) serves two functions:
1. **Contextual frame** — Signals to the user that the content below is a separate app, not part of the ARIA UI
2. **Action target** — The close button navigates back to chat

The white background of the preview panel is intentional — generated apps may have any design, and a neutral white frame avoids colour conflicts.

### Send Button

The send button has three visual states:

| State | Background | Shadow |
|-------|-----------|--------|
| Ready | `linear-gradient(135deg, #6366f1, #4f46e5)` | `0 0 20px #6366f155` |
| Empty input | `#0d0d1a` | None |
| Loading | `#0d0d1a` | None |

The glow shadow on the ready state draws attention to the primary action without being overwhelming.

---

## Animation Catalogue

| Name | Duration | Easing | Property | Trigger |
|------|---------|--------|----------|---------|
| `pulse` | 1200ms | ease | `opacity` 1→0.3→1 | Typing dots, status dot |
| `slideUp` | 250ms | ease | `opacity` + `translateY(8px→0)` | New message, status pill |
| `glow` | 3000ms | ease-in-out | `box-shadow` | Logo (infinite) |
| Tab transition | 180ms | ease | `background`, `color`, `border-color` | Tab click |
| Badge hover | 150ms | ease | `background`, `border-color` | App badge hover |
| Send button | 200ms | ease | `background`, `box-shadow`, `color` | Input change |

---

## Responsive Behaviour

ARIA is designed for the Claude.ai artifact panel, which is roughly 500–900px wide. The layout is a single vertical column with no breakpoints.

Key responsive decisions:
- **Message max-width: 80%** — Prevents bubbles from spanning the full width on wider panels, preserving readability
- **Textarea max-height: 130px** — Caps the input at ~4 lines; content scrolls beyond that
- **Tab switcher** — Compact pill at top right, doesn't wrap

For very narrow panels (<360px), the preview panel will stack below chat. This isn't currently implemented but can be added by listening to container width via a `ResizeObserver`.

---

## Accessibility Notes

| Concern | Current state | Improvement path |
|---------|--------------|-----------------|
| Keyboard navigation | ✅ Enter to send, Tab between controls | — |
| Button disabled states | ✅ `cursor: not-allowed`, colour dim | Add `aria-disabled` attribute |
| Screen reader labels | ⚠️ Icon buttons lack aria-label | Add `aria-label="Send message"` etc. |
| Colour contrast | ✅ Text on dark surfaces meets AA | Verify with contrast checker |
| Motion preference | ⚠️ Animations always play | Add `@media (prefers-reduced-motion)` |
| Focus rings | ⚠️ `outline: none` on textarea | Add custom focus ring |

---

## Maintenance Checklist

When updating the design:

- [ ] Update colour tokens in this document if the palette changes
- [ ] Re-verify text contrast ratios after any background colour change
- [ ] Test animation timing on both fast and slow machines
- [ ] Confirm the preview panel chrome still looks appropriate for new iframe content
- [ ] Check that the tab switcher appears/disappears correctly when `hasApp` changes
- [ ] Verify the textarea auto-grow still works after any layout changes
