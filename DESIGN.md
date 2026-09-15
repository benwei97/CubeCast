---
name: CubeCast
description: Virtual speedcubing prediction markets with a restrained trading-board interface.
colors:
  background: "#f7f8fb"
  surface: "#ffffff"
  ink: "#151923"
  muted: "#667085"
  line: "#d9dee8"
  yes: "#05603a"
  no: "#b42318"
  accent: "#2557d6"
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

**Creative North Star: "The Compact Trading Desk"**

CubeCast should feel like a focused prediction-market workstation for speedcubing: dense, legible, fast to scan, and restrained. The interface is not a marketing site. It is an operating surface where users compare markets, choose YES or NO, review cost and payout, and confirm a virtual trade.

The visual system uses neutral surfaces, crisp borders, compact rows, and clear semantic color. Green means YES or profit. Red means NO, loss, or risk. Blue is reserved for navigation and low-frequency emphasis. Contract prices display as cents, while implied likelihood displays as percentages.

**Key Characteristics:**

- Dense market-board layouts over decorative card grids.
- Clear YES/NO controls visible at browsing level.
- Calm neutral structure with strong semantic trading colors.
- Explicit review and confirmation before balance-changing actions.
- Small radius, simple borders, and minimal visual ornament.

## Colors

The palette is a light trading dashboard system: cool neutral pages, white surfaces, dark text, and semantic YES/NO action colors.

### Primary

- **Desk Ink** (`#151923`): Primary text and primary button background.
- **Market Blue** (`#2557d6`): Links, focus rings, and selective navigation emphasis.

### Secondary

- **Yes Green** (`#05603a`): YES actions, positive values, winning/profit states.
- **No Red** (`#b42318`): NO actions, errors, losses, and risk states.

### Neutral

- **Board Background** (`#f7f8fb`): App background.
- **Surface White** (`#ffffff`): Cards, modals, panels, rows.
- **Muted Text** (`#667085`): Secondary labels, helper copy, table metadata.
- **Rule Line** (`#d9dee8`): Borders, dividers, input strokes.

### Named Rules

**The Semantic Color Rule.** Green and red belong to market sides and account outcomes. Do not use them as decoration.

## Typography

**Display Font:** ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif  
**Body Font:** ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif  
**Label Font:** ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif

**Character:** The current type system is utilitarian and system-native. It should read as quick, familiar, and data-oriented, with weight and size doing the hierarchy work.

### Hierarchy

- **Display** (800, `clamp(42px, 7vw, 76px)`, 0.95): Home and auth hero title only.
- **Headline** (800, `clamp(34px, 5vw, 58px)`, 1): Major page titles and market detail questions.
- **Title** (700-800, 20-30px): Section headings, card titles, modal headings, metric values.
- **Body** (400, 16-18px, 1.45-1.6): Supporting copy and row content.
- **Label** (700-800, 12-13px): Table headers, metadata labels, controls, compact captions.

## Layout

The app uses a centered max-width shell around `1120px` with page stacks spaced at `32px`. Trading and admin surfaces use grid rows, compact tables, and two-column desktop layouts that collapse to one column under `760px`.

Market browsing should prefer rows over same-size cards when the task is comparison or trading. Cards remain appropriate for summaries, forms, portfolio panels, and isolated details.

## Elevation & Depth

The system is flat by default. Depth is primarily conveyed with borders, tonal row backgrounds, and layout hierarchy. Shadows are reserved for overlays such as quick-trade modals.

### Shadow Vocabulary

- **Modal Lift** (`0 24px 80px rgb(21 25 35 / 28%)`): Dialogs and protected-focus overlays.

## Shapes

Controls and surfaces use modest radii. Standard cards and rows use `8px`; controls use `6px`; modals may use `10px`; pills are reserved for filters and compact status chips. Avoid nested cards and large rounded decorative containers.

## Components

### Buttons

- **Shape:** Compact rectangle with `6px` radius and at least `40px` height.
- **Primary:** Dark ink background, white text, solid border.
- **Secondary:** White background, dark text, ink or line border.
- **Hover / Focus:** Subtle lift on hover and visible blue focus outline.
- **YES / NO action buttons:** Tinted semantic background at rest; full semantic color on hover when used for direct trading actions.

### Market Boards

- **Style:** White surface with a single outer border and row dividers.
- **Rows:** Question and competition metadata on the left; YES, NO, volume, and status values aligned in fixed columns.
- **Behavior:** YES/NO controls open a review flow directly when the user is browsing an actionable market.
- **Display:** Executable YES/NO prices use cents, such as `57¢`. Probability or chance context uses percentages, such as `57% chance`.

### Cards / Containers

- **Corner Style:** `8px`.
- **Background:** White surface.
- **Border:** One-pixel `line` border.
- **Shadow Strategy:** None at rest.
- **Internal Padding:** Usually 18-24px depending on density.

### Inputs / Fields

- **Style:** White surface, `6px` radius, `line` border, 42px minimum height.
- **Focus:** Blue focus outline with offset.
- **Error:** Red text with direct recovery copy.

### Navigation

The header is a simple three-part grid: brand, centered navigation, account controls. It stays utilitarian and visible across the app.

## Do's and Don'ts

### Do:

- **Do** make YES and NO prices clickable wherever a user expects to trade.
- **Do** show market prices as cents and probability context as percentages.
- **Do** show cost, payout, profit, and remaining balance before a purchase is submitted.
- **Do** use compact market rows for comparison-heavy surfaces.
- **Do** keep admin actions visibly separate from user trading actions.

### Don't:

- **Don't** introduce real-money language into the CubeCoin MVP.
- **Don't** use green or red for non-market decoration.
- **Don't** add large marketing hero sections to operational app surfaces.
- **Don't** hide the full market detail page; users still need rules, activity, and admin resolution context.
