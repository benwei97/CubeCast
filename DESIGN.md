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

Lead with a self-hosted Cubing event icon and canonical readable name (2x2x2 Cube, 3x3x3 One-Handed), never a raw event ID. Put competition metadata below. Show H2H competitors on separate aligned rows with large right-aligned, tabular percentages; keep average world ranks muted beside each name, wrapping when needed. Do not repeat the matchup or percentages in prose or recommendation reasons. Admin inclusion/review states and player pick controls retain their existing behavior.

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

- **Contest states:** Date range leads the page. Draft uses red with "Not public"; Active uses green and distinguishes selections open/locked; Complete uses a neutral treatment and final results.
- **Draft preparation:** Generate recommended markets across the contest window; all start included. Default to a quality-ranked list, with a secondary By competition view. Competitor names, event-specific world ranks, probabilities, competition, and a short recommendation reason lead each row. Admins deselect, review, and publish the group. No fixed competition or market count is displayed.
- **Weekend identity:** Lead with the fixed target Saturday-Sunday, then show featured competitions' full dates and the pick deadline separately. Multi-day competitions remain eligible if they overlap either day. Old drafts prompt regeneration before publication; expired drafts offer Prepare next contest. Published contests are unchanged.
- **Short-list recovery:** Prefer top-100 matchups and accurately label expanded top-250/top-500 results. Keep failed-registration details collapsed. If fewer than 10 markets qualify, show a clear publication blocker and keep searching within the same weekend. Do not offer discovery-window expansion or publish an incomplete contest.
- **Generation state:** Start promptly, show actual running state with automatic status refresh and cancellation, and hide stale recommendation details until completion. Keep existing markets on failure/cancellation. Submission connection failures appear inline with a reload/check instruction, not an uncaught runtime overlay.
- **Monitoring:** Active contests show complete entries, settled-market progress, pick status, and featured competition progress. Complete contests show the final leaderboard and expandable settlement evidence.
- **Continuity:** Prepare next contest opens a private draft. Publication makes that contest current after the previous pick deadline; previous contests stay accessible through expandable history with competition-level progress.

- **Primary workflow:** Current contest first, competition-grouped market selection, a persistent selection counter, and a dedicated review state before publishing.
- **Progressive disclosure:** Ranked entrants, generation settings, lifecycle status, history, and settlement tools expand on demand. Accepted counts and competitor limits stay visible with each competition.

- **Style:** Dense operation panels and tables.
- **Critical Actions:** Publishing, voiding, settlement, and finalization require confirmation and audit logs.
- **Evidence:** Settlement inspection should foreground WCA source details and immutable snapshots.

## Market and Competition Detail Pages

- Event labels and competition names are navigation links; outcome buttons remain independent pick actions. Avoid links nested inside selection buttons.
- Competition pages are scoped to a contest and preserve the player pick flow. Draft competition pages are admin-only previews.
- Market pages foreground event, question, competitors, large percentages, score swings, and deadline. Follow with real WCA PB averages/world ranks. Recent results and rules are always visible below, without disclosure controls; internal model settings and serialized evidence are not player-facing content. Keep locked probabilities legible, not faded like unavailable actions.
- Use compact comparison tables and unframed sections rather than decorative dashboards or speculative charts. Tables can scroll within their own wrapper on narrow screens.
- Draft inclusion changes persist without resetting the selected admin grouping. Preview controls never imply individual publication.
- Do not prefetch market research pages from every feed row: load research on navigation, through the shared WCA queue/cache. Research failures must not replace or alter published odds.
- Recent result rounds use readable First Round, Second Round, Third Round, and Final labels, including cutoff equivalents. Keep WCA's person-page competition/round ordering; never expose raw round codes or omit rounds simply because they have no average.

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
