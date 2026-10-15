# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Existing codebase: Nuxt 4 (`app/` directory), Nuxt UI v4, Pinia, VueUse, Chart.js via `vue-chartjs`, Lucide icons (`i-lucide-*`). Backend is a separate NestJS + Prisma package (`../back`).

## Users
One person: the author, using it as a personal money tracker. Used mostly from a phone, in the moment (logging a spend, checking what is left in a jar), with occasional desktop sessions for review. Single-user data model per account; other accounts exist only as isolated copies, not collaboration.

## Product Purpose
Personal money management: record income, split it across jars by percentage, track daily spending on a kanban board, move money between jars, track debts in both directions (including lending to yourself from savings), and undo the last action. Success is knowing, at a glance and with confidence, how much is actually available to spend and where every amount went.

## Positioning
Not a generic expense list. The product's mechanism is jar-based budgeting: income is split by percent across spending and savings jars, daily expenses live as draggable cards per day and per jar, debts move real balances (not just notes), and every money action is a reversible history entry.

## Operating Context
- Phone-first, quick one-handed entry of amounts; amounts shown as `1 000 000 ₸` (KZT, Russian number formatting).
- Daily rhythm: log expenses to the day's column, review jars, occasionally record income or debts.
- Dates are calendar days compared as `yyyy-mm-dd`, never timezone-shifted.

## Capabilities and Constraints
- Jars: SPENDING (can be spent from, appear as kanban columns) and SAVINGS (not available to spend, managed by transfers and income share). Two separate totals: "Доступно к тратам" and "Накоплено"; never summed.
- Operations that would take a jar below zero are rejected (new expense, transfer, lending, repaying a debt); undo is the exception.
- Debts: "мне должны" debits jars immediately; "я должен" credits chosen jars immediately and repays from jars later; forgiving never moves money.
- History with per-type icon/colour, type filters, show-undone toggle; undo applies to the last action only.
- Statistics: average per day over the real range (not a fixed 30 days), per-jar pie chart using each jar's own colour.
- Money inputs use the custom `MoneyInput` (live thousand separators), not `UInputNumber`; percentage inputs use `UInputNumber`.
- Interface language is Russian.

## Brand Commitments
- Dark theme by default and as the designed theme.
- Visual direction chosen by the user: classic premium dark fintech (Mercury/Ramp style): cool blue-black neutrals, indigo accent, quiet bordered cards, large tabular amounts. A felt-ornament experiment was tried and rejected; do not reintroduce it.
- Jar colours are user-chosen hex values from a preset palette and are reused on tiles and charts.

## Evidence on Hand
No real third-party content, testimonials or metrics. All data is the author's own, local or on the deployed instance. Nothing to fabricate and nothing to claim.

## Product Principles
1. Money truth first: the numbers on screen must always match real balances; every action is explainable in history and reversible.
2. Fast entry beats ceremony: recording an amount should take seconds on a phone.
3. Distinguish spendable from saved at every glance; never blend the two totals.
4. Make asymmetric rules visible (who owes whom, where money went) instead of hiding them in forms.
5. Calm, premium and dense enough to scan; no decoration that costs legibility of amounts.

## Accessibility & Inclusion
No product-specific requirement was established in this interview. Sensible defaults apply: readable contrast on the dark theme, touch targets sized for phone use.
