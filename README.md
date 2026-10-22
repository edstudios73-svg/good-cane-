# GoodCane pre-orders

Weekly pre-ordering for GoodCane's fresh sugarcane juice. Customers order for the next Saturday, get their order number and status by SMS, and reorder in one tap. GoodCane staff see confirmed vs pending demand per flavour and how many bottles to press.

- **Shop:** `/`
- **Staff dashboard:** `/admin/` (Supabase email login, staff only)

**Live demo:** https://goodcane-six.vercel.app · **Staff:** https://goodcane-six.vercel.app/admin (judges: `admin@goodcane.app` / `GoodCane-YmzgvnMyHB`) · **Video:** https://goodcane-six.vercel.app/demo.mp4 · **Submission PDF:** [docs/GoodCane-Submission.pdf](docs/GoodCane-Submission.pdf)

Docs: [write-up](docs/WRITEUP.md) · [measurement and pilot plan](docs/MEASUREMENT.md) · [demo video script](docs/VIDEO_SCRIPT.md)

## Stack

- Vite + React + TypeScript. Two pages: `index.html` (shop) and `admin/index.html` (staff).
- Supabase Postgres for orders, customers and the SMS log.
  - Customers never touch tables directly. They call the security-definer functions in [`supabase/migrations`](supabase/migrations), which validate every order.
  - Row-level security gives staff read access.
  - Realtime pushes new orders to the dashboard.
- SMS through [SasuSync](https://sms.sasusync.com), sent from the database with `pg_net`. The API key lives in Supabase Vault and never reaches the browser.

## Set up

```bash
npm install
cp .env.example .env.local     # add your Supabase URL and publishable key
npm run dev
npm test
```

Database:
1. Apply `supabase/migrations/*.sql` to the project.
2. Optional: run `supabase/reset.sql` to clear all orders and start fresh, or `supabase/sample-data.sql` to add six weeks of sample history. Those rows are flagged `is_sample` and never texted.
3. Store the SasuSync key in Vault (and use a sender ID approved on that SasuSync account):
   ```sql
   select vault.create_secret('<sasusync api key>', 'sasusync_api_key');
   update settings set value = 'GoodCane' where key = 'sms_sender';  -- your approved sender ID
   ```
4. Add a staff member: create the user in Supabase Auth, then
   ```sql
   insert into staff (user_id, name) select id, 'Name' from auth.users where email = 'person@example.com';
   ```

Sending can be paused at any time with `update settings set value = 'false' where key = 'sms_live';`.

## Layout

- `src/domain/`: batch schedule, order rules, demand forecast, metrics, SMS wording (tested)
- `src/shop/`, `src/pages/customer/`: the shop
- `src/staff/`, `src/pages/business/`: the staff dashboard
- `scripts/sample-data.ts`: generates the sample history SQL
