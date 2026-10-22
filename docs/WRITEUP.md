# GoodCane Weekly Pre-order: written explanation

> Built for the CODED × GoodCane Virtual Paid Gig (EP11). Orders and texts are live, and the database was reset so it holds only real orders. No payments are connected; GoodCane records payment by hand. Demo video: https://goodcane-six.vercel.app/demo.mp4

## Links and demo access for judges

| | |
|---|---|
| **Live shop** | https://goodcane-six.vercel.app |
| **Staff dashboard** | https://goodcane-six.vercel.app/admin |
| **Staff login** | Email `admin@goodcane.app` · Password `GoodCane-YmzgvnMyHB` |
| **Demo video** | https://goodcane-six.vercel.app/demo.mp4 |
| **Full submission PDF** | https://goodcane-six.vercel.app/GoodCane-Submission.pdf ([in this repo](GoodCane-Submission.pdf)) |
| **Code** | https://github.com/edstudios73-svg/good-cane- |

The staff login is shared for judging only and will be changed afterwards. To see the full flow: place an order on the shop with your own phone number, then sign in to the dashboard and confirm it. The customer gets a text at each step.

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
| **"Order this again" one-tap reorder** | Turns order #1 into order #2. It copies the last order into the next week the customer hasn't ordered for yet. |
| **SMS: order number, status updates and an opt-in weekly reminder** | Customers always know where their order stands. Reminders are off by default, at most one a week, with a reply-STOP line. Live sending waits for GoodCane's approval. |
| **Business demand view** | Confirmed bottles vs pending requests per flavour, a suggested batch size, and the four pilot measures. |

Why not subscriptions? They need fixed prices, skipping, pausing and billing rules that GoodCane hasn't set. Weekly pre-order plus reorder delivers most of the "routine" benefit and costs much less to run. Subscriptions can come later if the pilot shows strong repeat behaviour.

Why no AI? The forecast is **confirmed bottles + pending requests × the historical confirm rate**. GoodCane can read it, check it and trust it. AI doesn't solve a clear need here yet.

## 3. How it works

There are two separate apps built from one codebase, sharing one Supabase database:

| App | URL | Who uses it |
|---|---|---|
| **Shop** | `/` | Customers. Nothing on it links to the staff side. |
| **Staff dashboard** | `/admin/` | GoodCane staff, signed in with a Supabase email account listed in `staff`. |

**Shop (mobile-first):**
1. **Discover:** links from TikTok or Instagram use `?src=tiktok`, so each order records which channel it came from.
2. **Order:**
   - Each juice has its own page.
   - Customers add bottles, then check out: pick the Saturday, pickup or delivery area, name and phone number. No payment is taken.
   - A weekly reminder text is opt-in and unticked by default.
3. **Order number by SMS:** the order is saved in the database, the order number is texted straight away, and the receipt shows the status (Awaiting confirmation → Confirmed → Paid → Collected). Customers can cancel until the cutoff.
4. **Return:**
   - On the same phone, "My orders" opens straight away.
   - On a new phone, customers sign in with a 6-digit code sent by SMS.
   - "Order this again" copies the last order into the next Saturday they haven't ordered for.

**Staff dashboard:**
- **Demand:** for each batch, *confirmed* bottles, bottles *awaiting confirmation*, cancellations, and a **suggested batch size per flavour**. It updates live as orders arrive.
- **Orders:** confirm, mark paid (by hand, since payment happens outside the app), mark delivered, or cancel with a reason. Each change texts the customer, which can be switched off per session.
- **SMS:** send the weekly reminder to opted-in customers who haven't ordered yet, and see every text with its delivery result from SasuSync.
- **Results:** repeat-order rate, confirmed orders per week, cancellation rate and forecast accuracy.

### SMS

| Text | When it's sent |
|---|---|
| Order received + order number | Customer places an order |
| Confirmed / Payment received / Delivered / Cancelled | Staff change the status, or the customer cancels |
| Weekly reminder (opt-in only, with STOP line) | Staff press "Send reminder" before the cutoff, or automatically on Thursday 9am once GoodCane switches "Last call" on |
| Ready today | Automatically at 7am on Saturday, for every confirmed order |
| Daily summary to staff | Automatically at 8pm: new orders today, bottles confirmed for Saturday, orders still to confirm |
| Sign-in code | Customer asks to see their orders on a new phone |

How sending works:
- Texts are written by `public.sms_text()` from fixed templates, all under 160 characters, so nobody can make the system send arbitrary messages.
- They are sent from the database through SasuSync using `pg_net`. The API key is stored in Supabase Vault, not in the website.
- Delivery results are read back into `sms_log` every minute.
- Scheduled texts run with `pg_cron` in Accra time (UTC). Each has its own switch in SMS → Automatic texts. The Thursday last call ships switched **off**, because reminders need GoodCane's approval.
- Sending is controlled by the `sms_live` setting and can be paused instantly.

### Security and data

- **Customers can't read tables.** Every customer action is a database function that checks its input: phone format, open batch, known juices and locations, quantity limits, and a rate limit per number.
- **Proving who you are:**
  - The phone that placed an order gets a private token.
  - Another phone needs the SMS code. Codes are hashed, expire after 10 minutes and allow 5 attempts.
  - Ordering with someone else's number doesn't reveal their orders.
- **Staff access:** staff read data through row-level security and change orders only through `staff_*` functions that enforce the allowed status steps.

### Requests vs confirmed vs paid

A request is **not** a sale. Only `confirmed`, `paid` and `delivered` count as firm demand. Requests are shown separately and weighted in the forecast by how often requests have historically been confirmed. "Paid" is set by GoodCane by hand because no payment integration exists.

### Privacy

- **Data collected:** name, phone number, flavour quantities, pickup point or delivery *area*, and an optional note. No exact address is stored; GoodCane asks for it by phone when delivering.
- **Texts:**
  - Order updates go to the number the customer gave for that order.
  - Weekly reminders are opt-in, at most one a week, and can be stopped in My orders or by replying STOP.
- **Remove my details:** wipes the customer's name and number, cancels their unpaid open orders, and keeps anonymous totals for forecasting.
- **Sample history (optional):** `supabase/sample-data.sql` adds six weeks of labelled history (`is_sample`) for testing the Results tab. Those rows are never texted, and `supabase/reset.sql` clears everything for a fresh start. The live demo runs with real orders only.

## 4. Assumptions to confirm with GoodCane

| # | Assumption | Why it matters |
|---|---|---|
| A1 | Production is **weekly**, on a fixed day (currently: Saturday) | The whole schedule is built around it |
| A2 | Pre-orders can close **~2 days before** production (currently: Thu 18:00) | Time needed to buy cane and plan the press |
| A3 | Flavour line-up matches the public posts and is stable week to week | The menu |
| A4 | Bottle size(s) and **prices**: unknown, so not shown | Totals and payment |
| A5 | Pickup points and **delivery areas/fees**: unknown, so placeholders are used | Fulfilment options |
| A6 | Payment is by mobile money or on collection, confirmed by GoodCane by hand | The "Paid" step |
| A7 | Customers are happy to get order updates and an opt-in weekly reminder by **SMS** from a "GoodCane" sender ID | Reminder channel; sender ID must be registered with SasuSync |
| A8 | Shelf life is short enough that over-production means waste | The value of forecasting |
| A9 | Someone at GoodCane can check the dashboard daily during the pre-order window | Confirmations happen in time |
| A10 | Walk-in sales continue alongside pre-orders | The forecast covers pre-orders only; GoodCane adds a walk-in buffer |

## 5. Rollout plan

| Phase | When | What |
|---|---|---|
| **0. Validate** | Week 0 | Walk through the live site with GoodCane. Confirm A1–A10. Set real flavours, sizes, prices and pickup/delivery areas. Agree SMS wording and approve live sending. |
| **1. Hand over** | Week 1 | Give GoodCane staff their logins. Register the GoodCane sender ID with SasuSync under GoodCane's account, agree the text wording, set real sizes, prices and pickup points, and delete the sample history. |
| **2. Pilot** | Weeks 2–5 | 20–30 existing WhatsApp customers who opt in. Share the link on WhatsApp Status and in the TikTok bio with `?src=` tags. Texts run on GoodCane's approved sender ID; reminders go out only when staff press Send, or on Thursday once GoodCane turns on the automatic last call. |
| **3. Review** | Week 6 | Compare against the success thresholds in [MEASUREMENT.md](./MEASUREMENT.md). Decide whether to open to everyone, add mobile-money payment (with GoodCane's approval), or try subscriptions. |
