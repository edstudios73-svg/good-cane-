# Measurement and pilot plan

The prototype calculates all four measures in the **GoodCane team → Results** tab. The numbers shown there come from sample history.

## The four measures

| Measure | Definition | Where it comes from | Pilot target (to agree with GoodCane) |
|---|---|---|---|
| **Repeat-order rate** | Of customers with ≥1 confirmed order in the period, the share with confirmed orders in **2+ different weeks** | Orders table (status ∈ confirmed, paid, delivered) | ≥ 40% over 4 weeks |
| **Confirmed weekly orders** | Number of orders per batch that GoodCane confirmed (confirmed, paid or delivered) | Orders table, grouped by batch | Week 4 at least 1.5× week 1 |
| **Cancellation rate** | Cancelled orders ÷ all orders placed (split by who cancelled: customer or business) | Status history | ≤ 10%; business-side "sold out" cancellations tracked separately |
| **Forecast accuracy** | `1 − |forecast − sold| ÷ sold` per batch, averaged (equivalent to 1 − absolute percentage error) | Forecast saved at cutoff + bottles sold entered after batch day | ≥ 85% by week 4 |

Supporting signals, all already captured in the data:
- **Source of first orders:** TikTok, Instagram, WhatsApp or direct, from `?src=`. Shows which channel turns discovery into orders.
- **Reorder share:** orders created through "Same again?" or a reminder link (`source = reorder | reminder`).
- **Reminder opt-in rate and opt-outs:** whether customers want reminders at all.
- **Request → confirmed rate:** feeds the forecast, and shows whether GoodCane can confirm everything people ask for.
- **Waste:** bottles made − bottles sold, the real cost the forecast aims to reduce.

## How forecast accuracy is captured

1. At cutoff, the Demand tab shows a **suggested batch** (confirmed + pending × confirm rate). Staff tap **Save forecast**.
2. After batch day, staff enter **bottles made** and **bottles sold**.
3. Results shows accuracy per batch and on average.

Pre-orders don't cover walk-ins, so we also track *pre-order share of sales*, i.e. pre-ordered bottles ÷ sold. As that share grows, the forecast covers more of real demand.

## Small pilot to validate demand (4 weeks)

**Who:** 20–30 people who have already bought from GoodCane on WhatsApp and agree to take part. TikTok followers can join through a tagged bio link.

**Baseline (week 0):** record each customer's orders over the past 4 weeks from GoodCane's WhatsApp history and sales notes. This gives a "before" repeat rate and a weekly order count. Also record bottles made vs sold for the last 4 batches.

**Weekly routine:**
| Day | Action |
|---|---|
| Fri–Thu | Pre-orders open for Saturday's batch |
| Wed | GoodCane approves the reminder text; staff send it to opted-in customers who haven't ordered |
| Thu 18:00 | Cutoff. Staff confirm or cancel requests, then **save the forecast** |
| Sat | Produce, fulfil, mark paid and delivered |
| Sun | Enter bottles made and sold. Five-minute review of the Results tab |

**What counts as validated demand:**
- At least 60% of pilot customers place one or more pre-orders.
- Repeat-order rate of 40% or higher (vs the WhatsApp baseline).
- Forecast accuracy of 85% or higher in weeks 3–4, with less waste than baseline.
- Cancellation rate of 10% or lower.

**What we'd learn even if targets are missed:**
- **Low pre-orders but high walk-ins:** people prefer spontaneous buying, so focus on stock alerts instead.
- **High cancellations:** the cutoff is too early or the confirmation is too slow.
- **Low reminder opt-in:** remove reminders and rely on "Same again?" from WhatsApp Status.

**Feedback:** a 3-question WhatsApp check-in at week 2 and week 4:
1. Was ordering easy?
2. Would you keep pre-ordering?
3. What almost stopped you?

GoodCane approves it before it's sent.
