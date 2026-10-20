# GoodCane Weekly Pre-order: written explanation

> Prototype for the CODED × GoodCane Virtual Paid Gig (EP11). All customers, orders, quantities, forecasts and sales in the demo are **labelled sample data**. No live payments are connected and no messages are sent.

## 1. The customer problem

GoodCane makes sugarcane juice in **weekly batches** (from its public TikTok posts: Passion fruit, Lemon ginger, Raw sugarcane, Mint lemon, Tigernut coconut). The juice has no preservatives, so it can't sit on a shelf for long. Orders currently come in through WhatsApp and walk-ins.

TikTok makes people *interested*, but interest doesn't turn into a habit:

- **For customers:** reordering takes effort. They have to remember, find the chat, retype the order, and wait to hear whether there's any juice left. Nothing prompts the second order.
- **For GoodCane:** demand only shows up as scattered chat messages. Before production day there's no reliable count of how much of each flavour people actually want. Make too much and fresh juice spoils. Make too little and sales are lost.

**Problem statement:** *People who discover GoodCane on social media have no easy routine for ordering again, so GoodCane can't predict weekly demand for a fresh, short-shelf-life product.*

## 2. Chosen approach: scheduled weekly pre-orders plus one-tap reorder

The brief offered four directions. I chose **scheduled pre-orders**, built around the batch GoodCane already makes, and added two small supports:

| Piece | Why |
|---|---|
| **Weekly batch pre-order with a cutoff** (e.g. order by Thu 18:00 for Saturday) | Matches how GoodCane already produces. Demand is known *before* the cane is bought and pressed. |
| **"Same again?" one-tap reorder** | Turns order #1 into order #2. It copies the last order into the next week the customer hasn't ordered for yet. |
| **Opt-in reminder before the cutoff** | Off by default, at most one a week, easy to turn off, with a reply-STOP line. The prototype only *previews* messages. |
| **Business demand view** | Confirmed bottles vs pending requests per flavour, a suggested batch size, and the four pilot measures. |

Why not subscriptions? They need fixed prices, skipping, pausing and billing rules that GoodCane hasn't set. Weekly pre-order plus reorder delivers most of the "routine" benefit and costs much less to run. Subscriptions can come later if the pilot shows strong repeat behaviour.

Why no AI? The forecast is **confirmed bottles + pending requests × the historical confirm rate**. GoodCane can read it, check it and trust it. AI doesn't solve a clear need here yet.

## 3. How the prototype works

**Customer (mobile-first):**
1. **Discover:** links from TikTok or Instagram use `?src=tiktok`, so each order records which channel it came from.
2. **Pre-order:** choose a batch, flavours, pickup or delivery area, then name and number. An optional reminder opt-in is unticked by default. No payment is taken.
3. **Receipt:** a clear status (Requested → Confirmed → Paid → Delivered) with plain wording such as "Your request isn't confirmed or paid yet." The customer can cancel until the cutoff.
4. **Return:** "My orders" shows the order history, a **Same again?** button, reminder settings, and "Delete my details".

**GoodCane team:**
- **Demand:** for each batch, *confirmed* bottles (accepted by GoodCane), *awaiting confirmation* (requests), cancellations, and a **suggested batch size per flavour**. It also shows where orders are going (pickup point or area).
- **Orders:** confirm, mark paid (recorded by hand, since payment happens outside the app), mark delivered, or cancel with a reason.
- **Reminders:** who is due a reminder (opted in, ordered before, no order this batch), with a message preview. **Sending is switched off.**
- **Results:** repeat-order rate, confirmed orders per week, cancellation rate and forecast accuracy, with a weekly chart showing new vs returning customers.

### Requests vs confirmed vs paid

A request is **not** a sale. Only `confirmed`, `paid` and `delivered` count as firm demand. Requests are shown separately and weighted in the forecast by how often requests have historically been confirmed. "Paid" is set by GoodCane by hand because no payment integration exists.

### Privacy and operations

- **Data collected:** name, phone number, flavour quantities, pickup point or delivery *area*, and an optional note. No exact address is stored; GoodCane asks for it on WhatsApp when delivering.
- **Reminders:** opt-in only, with WhatsApp or SMS chosen by the customer, and they can be turned off on the receipt, in My orders, or by replying STOP.
- **Cancellation:** customers can cancel unpaid orders until the cutoff. The business can cancel with a reason.
- **Delete my details:** anonymises the customer's name and number and cancels their unpaid orders for open batches. Totals are kept for forecasting.
- **Prototype limits:**
  - Data lives in the browser's local storage, so the customer and business views share data on one device.
  - The business view has no login.
  - "My orders" looks orders up by phone number without verification.
  - A pilot would add a database, a staff login and a one-time code by SMS or WhatsApp.

## 4. Assumptions to confirm with GoodCane

| # | Assumption | Why it matters |
|---|---|---|
| A1 | Production is **weekly**, on a fixed day (prototype: Saturday) | The whole schedule is built around it |
| A2 | Pre-orders can close **~2 days before** production (prototype: Thu 18:00) | Time needed to buy cane and plan the press |
| A3 | Flavour line-up matches the public posts and is stable week to week | The menu |
| A4 | Bottle size(s) and **prices**: unknown, so not shown | Totals and payment |
| A5 | Pickup points and **delivery areas/fees**: unknown, so placeholders are used | Fulfilment options |
| A6 | Payment is by mobile money or on collection, confirmed by GoodCane by hand | The "Paid" step |
| A7 | Most customers reach GoodCane through **WhatsApp**, and reminders by WhatsApp are acceptable to them | Reminder channel |
| A8 | Shelf life is short enough that over-production means waste | The value of forecasting |
| A9 | Someone at GoodCane can check the dashboard daily during the pre-order window | Confirmations happen in time |
| A10 | Walk-in sales continue alongside pre-orders | The forecast covers pre-orders only; GoodCane adds a walk-in buffer |

## 5. Rollout plan

| Phase | When | What |
|---|---|---|
| **0. Validate** | Week 0 | Walk through the prototype with GoodCane. Confirm A1–A10. Set real flavours, sizes, prices and pickup/delivery areas. Agree reminder wording and approve the channel. |
| **1. Harden** | Weeks 1–2 | Move storage to a hosted database. Add staff login and one-time-code access to "My orders". Add a WhatsApp click-to-chat confirm button for staff (sent manually by staff). |
| **2. Pilot** | Weeks 3–6 | 20–30 existing WhatsApp customers who opt in. Share the link on WhatsApp Status and in the TikTok bio with `?src=` tags. Reminders go out only after GoodCane approves each week's message. |
| **3. Review** | Week 7 | Compare against the success thresholds in [MEASUREMENT.md](./MEASUREMENT.md). Decide whether to open to everyone, add mobile-money payment (with GoodCane's approval), or try subscriptions. |
