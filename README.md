# SokoShamba — Connecting Kenya's Agricultural Community

A Kenyan AgriTech marketplace and farm-management platform built with **HTML5, CSS3 and vanilla JavaScript (ES modules)**.
No React, no Vue, no Tailwind, no Bootstrap, no jQuery, no build step.

## 🟢 Current status: connected to Supabase (production data mode)

- Project: `wihsjgaqfpzrigofzfzb.supabase.co`
- Auth, profiles, products, orders, storage, services, advisory, market
  prices, notifications and admin metrics all read/write **real Supabase
  tables** via `js/api.js`.
- Payments (Paystack) and automation webhooks are still stubbed out — see
  the integration guides below to add them.
- Before the app is usable end-to-end, you must run
  [`supabase/schema.sql`](./supabase/schema.sql) once in your Supabase SQL
  Editor. Full walk-through in [`supabase/README.md`](./supabase/README.md).

If you want to preview the app **without any Supabase account**, blank out
`SUPABASE.url` in `js/config.js` and the whole app instantly reverts to
demo mode (localStorage-backed, no network calls).

---

## 1. Running the project

1. Download / clone the folder and **open it in VS Code**.
2. Install the **Live Server** extension (`ritwickdey.LiveServer`) if you do not have it.
3. Right-click **`index.html`** → **“Open with Live Server”**.
4. The app opens at `http://127.0.0.1:5500/index.html`. Explore demo mode.

> ⚠️ You must serve the folder over HTTP. Opening `index.html` directly with `file://` will fail because the browser
> blocks ES module imports on the file protocol. Any static server works:
> `python3 -m http.server 5500` or `npx serve .`

### Demo credentials

Demo authentication accepts **any password of 6+ characters** for the demo emails below (no password is ever stored):

| Role | Email | Password |
|------|-------|----------|
| Farmer | `farmer@sokoshamba.demo` | any 6+ characters |
| Buyer | `buyer@sokoshamba.demo` | any 6+ characters |
| Supplier | `supplier@sokoshamba.demo` | any 6+ characters |
| Service Provider | `services@sokoshamba.demo` | any 6+ characters |
| Admin | `admin@sokoshamba.demo` | any 6+ characters |

The login page also has one-click **persona chips** (Farmer / Buyer / Supplier / Service) that sign you in instantly.

---

## 2. Folder structure

```
sokoshamba/
├── index.html                     Landing page
├── README.md
├── pages/
│   ├── login.html                 Authentication
│   ├── register.html
│   ├── forgot-password.html
│   ├── reset-password.html
│   ├── verify-email.html
│   ├── marketplace.html           Commerce
│   ├── product.html
│   ├── cart.html
│   ├── checkout.html
│   ├── orders.html
│   ├── order-details.html
│   ├── sell.html
│   ├── dashboard.html             Dashboards
│   ├── farmer-dashboard.html
│   ├── buyer-dashboard.html
│   ├── supplier-dashboard.html
│   ├── service-dashboard.html
│   ├── admin.html
│   ├── services.html              Tools & content
│   ├── service-detail.html
│   ├── advisory.html
│   ├── article.html
│   ├── calculator.html
│   ├── market-prices.html
│   ├── notifications.html
│   ├── profile.html
│   ├── settings.html
│   ├── about.html                 Company
│   ├── contact.html
│   ├── privacy.html
│   └── terms.html
├── css/
│   ├── variables.css   Design tokens (colour, type, spacing, shadows)
│   ├── reset.css       Modern reset + a11y helpers
│   ├── main.css        Layout, header, footer, page shells
│   ├── components.css  Buttons, cards, badges, toasts, modals, tables, states
│   ├── forms.css       Inputs, validation, toggles, choice cards, uploader
│   ├── dashboard.css   Dashboard shell, stats, charts, lists
│   ├── pages.css       Page-specific (hero, auth, marketplace, checkout…)
│   └── responsive.css  Mobile/tablet/desktop/print layers (loaded last)
├── js/
│   ├── config.js       Public configuration + Supabase/Paystack placeholders
│   ├── storage.js      Safe localStorage wrapper
│   ├── state.js        Central store + pub/sub
│   ├── api.js          Backend service abstraction (products, orders, payments…)
│   ├── auth.js         auth.login/register/logout/resetPassword/getCurrentUser
│   ├── validation.js   Rules, form validation, inline errors
│   ├── cart.js         Cart logic + totals
│   ├── ui.js           renderHeader/Footer/ProductCard/toast/modal/states
│   ├── app.js          Global bootstrap + delegated actions (every page)
│   ├── dashboard.js    Shared dashboard shell + role views
│   ├── calculator.js   Farm cost calculations
│   ├── advisory.js     Advisory list + reader
│   ├── services.js     Services directory + booking
│   ├── notifications.js Notifications page
│   └── pages/          Thin page controllers
│       ├── home.js  auth-ui.js  marketplace.js  product.js  cart-page.js
│       ├── checkout.js  orders.js  sell.js  profile.js  settings.js
│       ├── admin.js  market-prices.js  contact.js
├── data/
│   └── demo-data.js    Users, products, orders, services, articles, prices
└── assets/             images / icons / logos (SVG data-URI placeholders in use)
```

> Structure note: the page-specific controllers live in `js/pages/` while reusable domain modules stay in `js/`.
> This keeps the module graph obvious (`page → domain module → api.js → backend`).

---

## 3. What already works (frontend, demo mode)

- Responsive header with active nav state, working mobile menu, cart badge, notifications dropdown, account menu.
- Landing page: animated placeholder stats, live featured listings, how-it-works, user types, CTAs, full footer.
- **Auth UI**: login, register (with account-type cards, password strength, confirm match), forgot password, reset
  password, email verification state, persona quick-login, session persistence, redirect by role.
- **Marketplace**: text search, multi-category filter, county filter, price range, verified/in-stock filters, sorting,
  active filter chips, pagination **and** load-more, skeleton loading, empty and error states.
- **Product page**: image gallery with thumbnails, quantity stepper with live subtotal, add to cart, buy now,
  contact-seller modal, save product, spec table, related products.
- **Sell**: full validated listing form, drag-and-drop image previews with removal, draft save/load/delete,
  publish, edit and delete listings.
- **Cart**: add/remove, increment/decrement, quantity input with stock cap, county-based delivery estimate,
  subtotal/total, clear cart with confirmation, empty state, localStorage persistence.
- **Checkout**: 5-step flow (Cart → Delivery → Payment → Review → Confirmation), validated delivery form,
  M-Pesa/Card/Bank selection, order review, order creation, and payment **pending / success / failed / cancelled**
  states via an explicit demo simulator.
- **Orders**: list with search + status filter, order detail page with items, timeline, address, seller status
  updates, cancellation with confirmation.
- **Dashboards**: farmer, buyer, supplier, service provider and admin summary — stats, quick actions, recent orders,
  stock levels, CSS bar chart, saved products, recommendations.
- **Farm calculator**: real arithmetic — total cost, cost per acre, expected yield/revenue, profit, margin, ROI,
  cost per unit, break-even price, break-even yield, ranked cost breakdown, reset, print/export, saved locally.
- **Advisory**: 8 full articles, category chips, search, saved articles, reader with reading-progress bar and print.
- **Services**: directory with type/county/search filters, provider self-listing form, detail page with booking request.
- **Market prices**: filterable reference table with trend indicators, clearly labelled as demo data.
- **Notifications**: dropdown + full page, type filters, unread badges, mark read / mark all read.
- **Profile & settings**: editable profile, avatar preview upload, tabbed settings (account, security, notifications,
  preferences), working toggles, password change, demo-data reset.
- **Admin console**: metrics, users/products/orders/reports/categories/advisory tabs with an explicit authorization warning.
- Global: toasts, modals, confirmation dialogs, loading/empty/error states, image fallbacks, keyboard focus rings,
  semantic HTML, ARIA labels, skip links, print styles.

## 4. Prepared but NOT connected

| Area | Abstraction | Status |
|------|-------------|--------|
| Auth | `js/auth.js` | Demo session. Swap the marked branches for `supabase.auth.*`. |
| Database | `js/api.js` (`products`, `orders`, `profiles`, `services`, `advisory`, `marketPrices`) | Reads/writes localStorage; Supabase queries marked `// PRODUCTION:`. |
| Storage | `profiles.uploadAvatar`, listing images | Base64 preview only; bucket names in `config.js`. |
| Payments | `payments.createPayment / checkPaymentStatus / handleSuccess / handleFailure` | Calls your serverless endpoints once configured. |
| Wallet / payouts | `wallet.balance`, `wallet.requestWithdrawal` | Withdrawals intentionally return “requires backend”. |
| Automation | `automation.sendEvent(EVENT, data)` | Logs events; POSTs to your proxy when `AUTOMATION.enabled = true`. |
| Realtime / messaging | Contact-seller modal | Records a notification; needs a `messages` table + realtime. |

Automation events already emitted: `USER_REGISTERED`, `ORDER_CREATED`, `SELLER_NEW_ORDER`, `PAYMENT_COMPLETED`,
`PASSWORD_RESET_REQUESTED`, `EMAIL_VERIFICATION_RESENT`, `SERVICE_BOOKING_REQUESTED`, `SUPPORT_MESSAGE`.

---

## 5. Future Supabase database design

| Table | Key columns | Relationships |
|-------|-------------|---------------|
| `profiles` | `id` (=`auth.users.id`), full_name, phone, account_type, county, location, bio, avatar_url, verified, rating | 1-1 with `auth.users` |
| `categories` | id, slug, name, icon, sort_order | referenced by `products` |
| `products` | id, seller_id→profiles, category_id→categories, name, description, price, unit, quantity, county, sub_county, location, delivery_option, availability, status, created_at | 1-N `product_images` |
| `product_images` | id, product_id→products, url, position | |
| `orders` | id, buyer_id→profiles, seller_id→profiles, subtotal, delivery_fee, total, status, payment_status, address_id→addresses, created_at | 1-N `order_items` |
| `order_items` | id, order_id→orders, product_id→products, name_snapshot, price_snapshot, unit, qty | |
| `payments` | id, order_id→orders, provider, reference, channel, amount, status, raw_response, verified_at | 1-1/N with orders |
| `cart_items` | id, user_id→profiles, product_id→products, qty, updated_at | unique (user_id, product_id) |
| `favorites` | user_id→profiles, product_id→products | composite PK |
| `addresses` | id, user_id→profiles, name, phone, county, town, line, notes, is_default | |
| `services` | id, provider_id→profiles, type, name, description, price, unit, county, location, verified | |
| `service_bookings` | id, service_id→services, user_id→profiles, date, qty, notes, status | |
| `advisory_articles` | id, category, title, slug, author, body, image_url, published_at, is_published | |
| `saved_articles` | user_id→profiles, article_id→advisory_articles | composite PK |
| `notifications` | id, user_id→profiles, type, title, body, read, created_at | |
| `market_prices` | id, crop, market, county, price, unit, recorded_on, source | |
| `reviews` | id, order_id→orders, reviewer_id→profiles, subject_id→profiles, product_id→products, rating, comment | |

### Where Row Level Security is required (all tables: `ENABLE ROW LEVEL SECURITY`)

- `profiles` — read: public columns only; write: `auth.uid() = id`.
- `products` / `product_images` / `services` — read: anyone (published rows); insert/update/delete: `auth.uid() = seller_id / provider_id`.
- `orders` / `order_items` — select: `auth.uid() = buyer_id OR auth.uid() = seller_id`; buyers insert; sellers may update `status` only.
- `payments` — **no client writes**. Inserted/updated only by the service role inside the webhook function.
- `cart_items`, `favorites`, `saved_articles`, `addresses`, `notifications` — `auth.uid() = user_id` for all operations.
- `advisory_articles`, `categories`, `market_prices` — public read; write restricted to admins.
- Admin access — a `profiles.role = 'admin'` check inside policies **or** an admin-only edge function. Never trust the browser.

---

## 6. Supabase integration guide

1. **Create the project** at supabase.com; note the Project URL and the **anon** public key.
2. **Create the tables** above in the SQL editor (plus foreign keys and indexes on `seller_id`, `category_id`, `county`, `created_at`).
3. **Authentication** → enable Email/Password, configure the confirmation and reset redirect URLs
   (`/pages/verify-email.html`, `/pages/reset-password.html`).
4. **Storage** → create buckets `product-images` and `avatars`; public read, authenticated write scoped to `auth.uid()`.
5. **Configuration** → in `js/config.js` set:
   ```js
   export const SUPABASE = { url: 'https://xxxx.supabase.co', anonKey: 'eyJhbGciOi…', buckets: {…} };
   ```
   `getMode()` automatically flips the whole app from `demo` to `production`.
6. **Client** → in `js/api.js`, `getSupabaseClient()`: uncomment the `createClient` import
   (`https://esm.sh/@supabase/supabase-js@2`) and return the client.
7. **Auth service** → in `js/auth.js` replace the demo branches with `signInWithPassword`, `signUp`, `signOut`,
   `resetPasswordForEmail`, `updateUser`, and hydrate `store.setUser()` from the `profiles` row on `onAuthStateChange`.
8. **Products** → replace bodies of `products.list/get/create/update/remove/mine` with `.from('products').select(...)`
   queries; upload files to the storage bucket and insert `product_images`.
9. **Orders** → `orders.create` becomes a transaction (insert order + items) or an edge function; `orders.list/get`
   become filtered selects; keep the same return shape `{ data, error }`.
10. **Payments** → point `PAYSTACK.initializeEndpoint` / `verifyEndpoint` at your edge functions (below).
11. **RLS** → enable and write the policies in §5, then re-test each page while signed in as each role.

Because every page only talks to `js/api.js` / `js/auth.js`, **no HTML or CSS changes are needed**.

---

## 7. Paystack integration guide

**Never put a Paystack secret key in this repository.** Only `pk_…` public keys may appear client-side, and even then
initialisation and verification must happen server-side.

Flow to implement:

```
Frontend (checkout.js → payments.createPayment)
        ↓  POST /api/payments/initialize  { orderId }
Secure backend / Supabase Edge Function   (holds PAYSTACK_SECRET_KEY)
        ↓  POST https://api.paystack.co/transaction/initialize
Paystack  → returns authorization_url + reference
        ↓  frontend redirects / opens checkout (M-Pesa STK or card)
Customer pays
        ↓  Paystack webhook  →  /api/payments/webhook  (verify x-paystack-signature HMAC-SHA512)
Backend verifies transaction, then writes to Supabase with the service role:
        payments.status = 'success', orders.payment_status = 'Paid', orders.status = 'Confirmed'
        ↓
Frontend polls payments.checkPaymentStatus() / receives realtime update
        ↓
Notification + email sent via automation.sendEvent('PAYMENT_COMPLETED', …)
```

Server-side responsibilities: amount must be recomputed from the database (never trusted from the client), currency
`KES`, amounts in the smallest unit, idempotent webhook handling, and signature verification on every webhook call.

---

## 8. Email / Zapier automation

`automation.sendEvent(name, payload)` posts to `AUTOMATION.proxyEndpoint` when `AUTOMATION.enabled = true`.
Point that endpoint at your own function which holds the Zapier/Make webhook URL or SMTP credentials.
Never embed a private webhook URL in the frontend — anyone could then spam your automations.

---

## 9. Security notes

- ✅ Only public configuration lives in `js/config.js` (Supabase URL + anon key, Paystack **public** key).
- ⛔ Never add: `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`, SMTP passwords, private webhook secrets.
- The anon key is safe **only** with Row Level Security enabled on every table.
- `localStorage` holds cart, UI preferences, demo session and demo records only — never passwords or card data.
- Frontend validation is UX; every rule must be re-validated server-side and in database constraints.
- The admin console is a UI shell. Authorization must be enforced by RLS/edge functions, not by hiding buttons.
- Operations flagged **“MUST MOVE TO BACKEND”** in `js/api.js`: payment initialisation, payment verification,
  payouts/withdrawals, admin writes, automation dispatch.

---

## 10. Known limitations (demo build)

- No real backend: refreshing keeps data because it is stored in your browser, not on a server.
- Messaging between users records a notification instead of creating a thread.
- Payment states are simulated explicitly and labelled as such — nothing is charged.
- Market prices, platform statistics and reviews are sample data.
- Product images are hot-linked stock photography with an automatic SVG fallback if a request fails; a production
  build should upload optimised images to Supabase Storage.
- Kiswahili localisation and 2FA are surfaced as “coming soon” rather than faked.

---

© SokoShamba demo build. Sample data only — no listing, seller, price or statistic on this site represents a real business.
# sokoshamba3.0
