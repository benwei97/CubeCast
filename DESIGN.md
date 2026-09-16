---
name: CubeCast
description: Free WCA speedcubing prediction contests with a compact forecasting-game interface.
colors:
  background: "#f7f8fb"
  surface: "#ffffff"
  ink: "#151923"
  muted: "#667085"
  line: "#d9dee8"
  yes: "#05603a"
  no: "#b42318"
  accent: "#2557d6"
  warning: "#9a5b00"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(42px, 7vw, 76px)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "0"
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(34px, 5vw, 58px)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "18px"
    lineHeight: 1.6
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    letterSpacing: "0"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "40px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
---

# Design System: CubeCast

## Overview

**Creative North Star: "The Forecasting Scoreboard"**

CubeCast should feel like a compact competitive forecasting surface for speedcubing. The interface is operational: users scan a contest, compare probabilities, understand score upside/downside, select exactly 10 picks, and track results.

The app should borrow interaction clarity from prediction-market products without sounding like finance or wagering. Probability is central, but the user is making picks for points, not buying contracts.

**Key Characteristics:**

- Dense market-board and market-card layouts for quick comparison.
- Persistent `X / 10 Picks` state.
- Clear selected, locked, settled, correct, incorrect, void, and tie states.
- Probability plus point swing shown before selection.
- Calm neutral structure with semantic green/red used for outcomes and scoring.
- Minimal ornament; speed, clarity, and auditability matter more than decoration.

## Colors

The palette is a light forecasting dashboard system: cool neutral pages, white surfaces, dark text, and semantic outcome colors.

### Primary

- **Scoreboard Ink** (`#151923`): Primary text and primary button background.
- **WCA Blue** (`#2557d6`): Links, focus rings, selected navigation, and low-frequency emphasis.

### Secondary

- **Yes Green** (`#05603a`): YES, correct, positive score movement.
- **No Red** (`#b42318`): NO, incorrect, negative score movement, validation errors.
- **Review Amber** (`#9a5b00`): lock warnings, pending settlement, incomplete entries.

### Neutral

- **Board Background** (`#f7f8fb`): App background.
- **Surface White** (`#ffffff`): Cards, modals, panels, rows.
- **Muted Text** (`#667085`): Secondary labels, helper copy, table metadata.
- **Rule Line** (`#d9dee8`): Borders, dividers, input strokes.

### Named Rules

**The Game-State Color Rule.** Green, red, amber, and blue must map to game state or action meaning. Do not use them as decoration.

## Typography

**Display Font:** ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif  
**Body Font:** ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif  
**Label Font:** ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif

**Character:** The current type system is utilitarian and system-native. It should read as quick, familiar, and data-oriented, with weight and size doing the hierarchy work.

### Hierarchy

- **Display** (800, `clamp(42px, 7vw, 76px)`, 0.95): Home or contest hero only.
- **Headline** (800, `clamp(34px, 5vw, 58px)`, 1): Major contest, leaderboard, and market detail headings.
- **Title** (700-800, 20-30px): Section headings, card titles, modal headings, metric values.
- **Body** (400, 16-18px, 1.45-1.6): Supporting copy and row content.
- **Label** (700-800, 12-13px): Table headers, metadata labels, pick counters, compact captions.

## Layout

The app uses a centered max-width shell around `1120px` with page stacks spaced at `32px`. Forecasting and admin surfaces use grid rows, compact tables, and two-column desktop layouts that collapse to one column under `760px`.

Contest browsing should prioritize scannable market cards or rows where probability, point swing, competition, event, and selected state are visible without drilling into detail pages.

## Elevation & Depth

The system is flat by default. Depth is primarily conveyed with borders, tonal row backgrounds, selected states, and layout hierarchy. Shadows are reserved for overlays such as pick review modals.

### Shadow Vocabulary

- **Modal Lift** (`0 24px 80px rgb(21 25 35 / 28%)`): Protected-focus overlays such as pick review or confirmation.

## Shapes

Controls and surfaces use modest radii. Standard cards and rows use `8px`; controls use `6px`; modals may use `10px`; pills are reserved for filters, statuses, and the pick counter. Avoid nested cards and large rounded decorative containers.

## Components

### Buttons

- **Shape:** Compact rectangle with `6px` radius and at least `40px` height.
- **Primary:** Dark ink background, white text, solid border.
- **Secondary:** White background, dark text, ink or line border.
- **Pick actions:** YES/NO options use semantic tinting and must show selected state.
- **Hover / Focus:** Subtle lift on hover and visible blue focus outline.

### Pick Counter

- **Content:** Always show `X / 10 Picks`.
- **Complete State:** When exactly 10 are selected, show `10 / 10 Picks - Entry Complete`.
- **Locked State:** After lock, show read-only state and stop presenting edit affordances.
- **Invalid State:** If fewer than 10 picks at lock, explain that the entry is not official.

### Market Cards

- **Required Content:** question, competition, event, outcomes, probability, point swing, lock status/time, selected state.
- **Score Display:** Show score swing as `+40 / -60`, based on published probability.
- **Probability Display:** Show published probabilities as percentages and keep them immutable once published.
- **Interaction:** Selecting an outcome should add or update the user's pick immediately before lock.

### My Picks

- **Content:** 10 selected markets, selected outcome, probability, possible score change, competition, event, and lock time.
- **Before Lock:** Users can remove or change picks.
- **After Lock:** Read-only results view with correct/incorrect/void/tie, points earned/lost, running score, and rank.

### Leaderboard

- **Ranking:** Final score, correct predictions, hardest correct prediction, then shared rank.
- **Eligibility:** Only valid 10-pick locked entries appear on the official leaderboard.
- **States:** Make finalized, settling, and not-yet-official states explicit.

### Admin

- **Style:** Dense operation panels and tables.
- **Critical Actions:** Publishing, voiding, settlement, and finalization require confirmation and audit logs.
- **Evidence:** Settlement inspection should foreground WCA source details and immutable snapshots.

## Do's and Don'ts

### Do:

- **Do** keep `X / 10 Picks` visible on player-facing contest surfaces.
- **Do** show probability and score swing before a user picks.
- **Do** distinguish incomplete, complete, locked, settled, void, and finalized states.
- **Do** use official WCA result language for settlement and evidence.
- **Do** keep admin scoring/settlement actions auditable.

### Don't:

- **Don't** use buy, sell, stake, shares, contracts, portfolio value, balance, payout, or order-book language for V1 gameplay.
- **Don't** add XP or purchasable prediction currency.
- **Don't** imply real-money wagering or redemption.
- **Don't** hide the exactly-10 requirement behind secondary screens.
- **Don't** let frontend state be the only enforcement for lock or pick-count rules.
