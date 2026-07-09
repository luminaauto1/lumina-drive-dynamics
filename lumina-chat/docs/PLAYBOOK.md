# Lumina Auto — Chat Playbook

*The exact way Lumina Auto talks to clients on WhatsApp, reverse-engineered read-only from 1,430 already-answered conversations. This is the human-readable "brain" behind the automated responder. Nothing here was invented — every reply is a real canned answer or a real agent message pulled from your own EasySocial account (business 4026).*

---

## 1. Who we are (voice & persona)

- **Agent name:** Albert from Lumina Auto (always signs/opens as Albert).
- **What we do:** Source, finance and deliver **new, used and demo** vehicles nationwide. We are a vehicle-finance broker that "fights with the banks" for the client.
- **Tone:** Warm, high-energy, emoji-rich, encouraging, never judgmental about bad credit. Lots of 🚗🏎️🔥✅💰. Uses `*bold*` (WhatsApp asterisks) for emphasis. Short paragraphs. South-African English (and Afrikaans when the client writes Afrikaans).
- **Core promise repeated everywhere:** "We fight for every client, no matter your credit profile," + the **R5000 referral** offer.

## 2. The golden qualification funnel

Every new lead is walked through the same 4 questions (this is the interactive-button funnel the bot already runs). The answers become the lead's profile and decide the branch.

1. **Opening menu** — "How can I assist you today?" → *I want my dream car now!* / *Check If I Qualify* / *I've Got Questions*
2. **Licence** — "Do you have a drivers Licence?" → *Yes I Do* / *No Licence Yet* / *I Only Have Learners*
3. **Credit** — "How's your credit profile looking?" → *Good Credit Record* / *Its looking better* / *Im not sure* / *Blacklisted/Debt Review* / *Missed Many Payments* / *No Credit Record*
4. **Timeline** — "When are you looking to buy?" → *As Soon As Possible* / *Within A Month* / *Need to sort stuff*
5. **Income** — "Are you permanently employed and earn R8500+ net?" → *Yes sir!* / *Not yet* / *It's Complicated*

If all four are good → collect documents and submit. Any "bad" branch routes to the matching advice reply below.

## 3. Every scenario → exactly what we say

Each row maps a client situation to the **quick-reply keyword** the engine sends (the full text lives in `data/knowledge_base.json` and your EasySocial quick replies — identical wording).

| Client situation | Quick reply | The gist of what we say |
|---|---|---|
| Greeting only ("hi", "good morning") | `questions morning` | "Good morning! Thanks for reaching out. How can I assist you today?" |
| Wants a car / do you finance / check if I qualify | *funnel: start* | Launch the qualification funnel |
| Where are you / delivery | `Based` | Based in Pretoria, **free nationwide delivery** |
| Deposit / money upfront / "is this a scam?" | `deposit` | **We never ask money upfront.** Deposit optional; every R10k = ~R200pm less |
| Monthly / price / installment | `installments` | Varies per profile; roughly **R3800–R5000pm** |
| What documents / requirements | `docs` | ID, License, latest 3 payslips, 3-month bank statements → finance@luminaauto.co.za |
| Which cars / stock / specific type | `catalog` | New, used & demo, all brands; inventory link; we can source it |
| What credit score do you need | `creditscore` | It's about the whole profile, not just score; we build you up |
| Under debt review | `debtreview` | Can't finance under active debt review; need Clearance Certificate first |
| Blacklisted / ITC / handed over | `blacklisted` | Same as debt review path; how to rebuild; ClearScore 610 |
| Missed payments / arrears / bad credit | `badcredit` | Fixable; catch up, 3–6 months clean, don't apply elsewhere |
| No credit record at all | `nocredit` | Open a small facility, 6 months clean, then come back |
| No licence | `no licence` | 100% okay, get the licence, we'll wait; number saved |
| Learners only / licence a "must"? | `Nolicencerespond` | Learner's won't work; cash / nominated driver / medical / spouse routes |
| Nominated driver details | `nominated driver` | Must be parent, or spouse married in community of property; same address |
| Married in community / spouse info | `spouse` | Need spouse name, ID, contact, date married |
| Earns below threshold | `low income` | Need R8500 net (R20k self-employed); saved for later + referral |
| Self-employed / no payslip | `6month` | Do you have 6 months of bank statements showing that income? |
| Referral / money maker | `referral` | R5000 per successful referral via the Money Maker button |
| Trade-in | `trade in` | How trade-in works + the details we need |
| Why the bank account number | `accountnumber` | 3 of 5 banks need it; optional but improves odds |
| Application declined | `decline` | Approvable in 2–3 months; to-do & to-avoid list; ClearScore |
| Not ready / check back later | `future` | Number saved, check back in 2–3 months, don't apply elsewhere |

## 4. What we DO / DON'T / ALLOW

**We DO:** finance new/used/demo of all brands; deliver nationwide free from Pretoria; work with 5 major banks; accept nominated drivers (strict rules); reduce installment via optional deposit; save numbers and nurture for the future; pay R5000 referrals.

**We DON'T:** ask for **any money upfront** (say this clearly whenever "scam"/"upfront" comes up); finance anyone **under active debt review** or **with unsettled arrears**; accept a **learner's licence**; promise a specific approval, rate or exact installment (always "varies per profile", ~R3800–R5000pm as a guide); finance with **no income** below R8500 net.

**We ALLOW / minimum bar:** valid driver's licence (or a qualifying nominated driver), net income **R8500+ (R20k self-employed)**, and no active debt review / arrears.

## 5. The 24-hour window rule (critical)

WhatsApp only lets us send a **free-text** message within **24 hours** of the client's last message. After 24h EasySocial shows *"24 Hour Window Elapsed — Send Template"* and blocks free text.

- **Inside 24h** → send the normal quick reply / funnel step.
- **Outside 24h** → the engine automatically switches to an approved **re-engagement template** (default: the *no-reply reminder*, "I see you haven't gotten back to me…"). It never tries to send free text that WhatsApp would reject.

## 6. What we NEVER auto-answer (always hand to a human)

The engine escalates instead of guessing when it sees:

- **Application status / "any feedback?"** — needs the live bank result.
- **A specific listed vehicle's price/availability** — needs live stock.
- **"Rent to own"** — no standard policy in your chats; handled case-by-case.
- **Requests to call / speak to a person / a phone number.**
- **Legal threats or complaints** (lawyer, ombud, POPIA, refund).
- **Abuse / hostility.**
- **Anything it isn't confident about** (below the confidence threshold) or a media-only message.

These land in the `escalation_queue` table so a human answers — protecting you from "answering a client a bunch of nonsense."

## 6b. Message sequences (multi-step human flows)

Mined across ~140 pages / 860 human-takeover messages, some situations are answered by your team with **a sequence of messages, not one**. The clearest and most frequent is the **credit diagnostic**:

> Client raises bad/low credit → you ask **"Why is your credit score low?"** → then **"Do you have accounts in arrears or are you under debt review?"** (`/arrears`) → based on their answer you send the matching advice (`/badcredit`, `/debtreview`, or `/nocredit`).

The bot reproduces this exactly: when credit is vague **and** it doesn't already know the client's profile, it sends the two diagnostic questions, then the client's answer drives the right advice on the next turn. If it already knows the profile (or the client already said "arrears"/"debt review"), it skips straight to the advice. Also mined: clicking **"I've Got Questions"** in the funnel is answered with the greeting ("Good morning! Thanks for reaching out. How can I assist you today?"), which is what your team does 11× over. Sequences live in the `reply_sequence` table and are easy to extend.

## 7. Facts the answers rely on

| Fact | Value |
|---|---|
| Min income (employed, net) | **R8,500 / month** |
| Min income (self-employed) | **R20,000 / month** *(⚠ see §8)* |
| Installment guide | R3,800 – R5,000 / month |
| Deposit | Never required; every R10,000 ≈ R200