# Full-Base Analysis — all 6,702 leads

Read-only sweep of **every lead** in EasySocial business 4026 (labels + qualification profiles for all 6,702; chat transcripts sampled deeply for reply patterns). Machine-readable numbers are in `data/analytics.json`; the live dashboard recomputes them via `/api/refresh-stats`.

## Headline

- **6,702 leads** total — 6,436 read, 266 unread.
- **~3,700** have completed enough of the funnel to capture a credit/licence/income profile.
- The business is **high-volume, credit-challenged vehicle finance from paid social**.

## The typical client (what you actually get)

> A **TikTok lead**, **permanently employed earning R8,500+**, who **has a valid licence** and **banks with Capitec** — but has a **credit problem** (blacklisted / under debt review, or missed payments, or unsure of their status).

This one sentence explains the whole playbook: most conversations are about **getting a credit-challenged but employed person to a "yes"** — which is why the credit-advice replies do the heavy lifting and why a large share of applications get declined.

## By tag (label)

| Tag | Count |
|---|---|
| New Lead | 2,864 |
| Blacklisted | 1,261 |
| TikTok Ads Lead | 716 |
| Bad Credit | 671 |
| Application Declined | 454 |
| No Licence | 306 |
| Low Income | 124 |
| App Submitted | 105 |
| Application Received | 74 |
| Operational | 58 |
| Vals Done / Validations Pending / Approved-Need Docs | 5 / 3 / 2 |

## Credit profile (self-reported in funnel)

Blacklisted/Debt Review **905** · Im Not Sure **802** · Missed Many Payments **445** · Its Looking Better **324** · Good Credit Record **182** · No Credit Record **32**.

→ Roughly **4 in 5 profiled leads have a credit issue.** Only ~1 in 10 report a clean record.

## Licence & income

- **Licence:** Yes 3,167 · No 389 · Learners 151 → the large majority can qualify on licence.
- **Income:** meets threshold 3,162 · not yet 86 · complicated 66 → income is rarely the blocker; **credit is**.

## Banks (normalized top)
Capitec ~339 · FNB ~119 · Standard Bank ~53 · Nedbank ~49 · Absa ~43 · TymeBank ~8 · Discovery ~6.
(Capitec dominates — useful context; the account-number reply notes 3 of 5 banks need the number.)

## Journey / lifecycle
Active **1,714** · Resolved-or-dead **1,261** · No journey set **3,727**.

## What this means for automation

1. **The credit replies are the workhorses.** `blacklisted`, `debtreview`, `badcredit`, `nocredit`, `creditscore` cover the dominant situation. They're deterministic and already loaded.
2. **Humans mostly do two things manually:** application **status updates** ("still waiting for feedback", "we received your documents") and **credit diagnostics** ("why is your score 580?", "when was the last missed payment?"). These are pipeline/judgement conversations — per your decision they **route to you**, not the bot.
3. **Disputes are rare.** In the sampled transcripts, genuine pushback was minimal (occasional "still waiting" / "why no response"), and those correctly escalate to a human as application-status.
4. **Pre-approved / validated are hands-off** (Approved-Need Docs, Validations Pending, Vals Done) — the engine skips them entirely.

## Coverage result
Replaying real client messages: **~81% auto-answered** with your exact wording, **~19% escalated** to you (rent-to-own, live status, specific-car availability, "call me", ambiguous). The bot **never guesses** — anything unsure goes to the dashboard queue, and your typed answer there is remembered for next time.

## Data-quality notes (fix at leisure)
- Bank is free-text (Capitec/Capitac, FNB/Fnb) with a few stray numbers — normalize in the dashboard.
- Self-employed minimum income is inconsistent across your own templates (R14k/R15k/R20k/R25k) — confirm the real figure.
