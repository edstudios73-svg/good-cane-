# GoodCane Weekly Pre-order

A mobile-first prototype that helps GoodCane turn social-media interest into **repeat orders** and **predictable weekly demand**. Built for the CODED × GoodCane Virtual Paid Gig (EP11).

> **Prototype.** All customers, orders and sales are labelled sample data. No live payments, no messages sent. Not an official GoodCane service.

- **Customers:** pre-order the next weekly batch before the cutoff, track the status (Requested → Confirmed → Paid → Delivered), cancel before the cutoff, and reorder with **"Same again?"**. Reminders are opt-in.
- **GoodCane team:** confirmed vs requested bottles per flavour, a suggested batch size, order actions, reminder previews (sending disabled), and the four pilot measures.

## Docs
- [Written explanation: problem, assumptions, approach, rollout](docs/WRITEUP.md)
- [Measurement and pilot plan](docs/MEASUREMENT.md)
- [Demo video script](docs/VIDEO_SCRIPT.md)

## Run it
```bash
npm install
npm run dev      # http://localhost:5173
npm test         # domain tests (batches, order lifecycle, demand, metrics, reminders)
npm run build    # static site in dist/
```
Demo tips:
- The **GoodCane team** switch in the header opens the business view.
- Sample customers use the numbers `0000000001` to `0000000016` in "My orders".
- **Reset demo data** restores the sample set.
- Add `?src=tiktok` to the URL to tag orders with their channel.

## How it's built
- Vite + React + TypeScript with a hash router, so it deploys as a static site to any host.
- `src/domain/` holds the business logic (batch schedule, order lifecycle, demand and forecast, metrics, reminders), and that's the code the tests cover.
- State is stored in the browser's `localStorage`. The customer and business views share it on one device and stay in sync across tabs. A pilot would swap this for a hosted database (see the rollout plan).
