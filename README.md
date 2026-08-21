# Kigali Coffee Lab (KCL): E-Commerce Backend

Node.js + Express + **MySQL** (via Sequelize) API powering the KCL coffee-machine
store, the KCL drink menu, roles & permissions, orders (with proof-of-payment
upload), and an admin analytics dashboard.

## Setup

1. Create a MySQL database (MySQL 5.7+/8+ or MariaDB both work):
   ```sql
   CREATE DATABASE kigali_coffee_lab;
   CREATE USER 'kcl'@'localhost' IDENTIFIED BY 'your_password';
   GRANT ALL PRIVILEGES ON kigali_coffee_lab.* TO 'kcl'@'localhost';
   FLUSH PRIVILEGES;
   ```

2. Install dependencies and configure environment:
   ```bash
   npm install
   cp .env_example .env   # fill in DB_HOST/DB_NAME/DB_USER/DB_PASSWORD, PASSWORD_KEY, JWT_KEY
   ```

3. Run the server. Tables are created/updated automatically on boot via
   `sequelize.sync({ alter: true })`, no manual migrations needed for this project:
   ```bash
   npm run dev             # nodemon
   # or
   npm start
   ```

## Seed demo data (coffee machines, drinks, admin/manager users, settings)

```bash
node seed.js
```

Default accounts created by the seed script:

| Role    | Email                          | Password     |
|---------|---------------------------------|--------------|
| Admin   | admin@kigalicoffeelab.rw        | Admin@123    |
| Manager | manager@kigalicoffeelab.rw      | Manager@123  |

**Change these passwords immediately in production.**

## Roles & Permissions

- **admin**, full access to everything (products, drinks, orders, users, settings, dashboard).
- **manager**, access only to what the admin has switched on for them, per permission:
  `manageProducts`, `manageDrinks`, `manageOrders`, `manageUsers`, `manageSettings`, `viewDashboard`.
- **guest**, a normal registered client. Can browse, add to wishlist/cart, place orders,
  upload payment proof, and cancel their own pending orders.

## Data model (MySQL / Sequelize)

MongoDB's document/embedded arrays were normalised into real tables + foreign keys:

| Table          | Notes |
|----------------|-------|
| `users`        | role, permissions (JSON column), isAdmin, active |
| `products`     | coffee machines; `listedById` → users.id |
| `ratings`      | one row per user review (was an embedded array in Mongo) |
| `drinks`       | KCL menu items |
| `carts` / `cart_items` | one cart per user, line items as child rows |
| `orders` / `order_items` | payment fields flattened into columns (see below) |
| `settings`     | singleton row, payment toggles as boolean columns |
| `visits`       | one row per page visit, for dashboard analytics |
| `wishlists`    | many-to-many join table between users and products |

**API compatibility note:** the JSON API still returns a Mongo-style `_id` string
(mirroring the integer `id`) on every object, and `orders` still expose a nested
`paymentIntent: { id, amount, currency, status, method }` object, both reconstructed
on the way out in `utils/transform.js`, so the existing React frontend needed **no changes**.

## Key endpoints

- `POST /auth/register` / `POST /auth/login`
- `GET /products` (public, active only) · staff CRUD at `POST/PUT/DELETE /products` (multipart `image` field)
- `GET /drinks` (KCL menu) · staff CRUD at `POST/PUT/DELETE /drinks`
- `GET /carts/get-cart`, `POST /carts`, ...
- `POST /orders` (create order) · `POST /orders/:id/proof` (upload proof of payment, multipart `proof` field)
  · `PUT /orders/:id/cancel` (client cancels) · staff: `GET /orders`, `PUT /orders/:id`
- `GET /settings/public` (payment toggles visible to storefront) · staff: `GET/PUT /settings`
- `GET /dashboard` (staff, `viewDashboard` permission), visits/orders/cancellations broken down
  daily/weekly/monthly/yearly/lifetime, revenue, top products, 14-day trend.
- `POST /users/staff` (admin creates manager/admin accounts) · `PUT /users/staff/:id` (admin edits role/permissions)

Uploaded images are served statically from `/uploads/...`.

## Verified

This backend was tested against a **real, running MySQL/MariaDB instance** (not just
syntax-checked): seeding, login, product/category listing, wishlist toggle,
add-to-cart with stock validation, full checkout (stock decrement + cart clear),
proof-of-payment upload + static serving, admin order status updates, cancel-order
guard rails, drinks CRUD, settings payment toggles, staff/permission boundaries
(403 on unpermitted actions), and product ratings all passed end-to-end.

## What's new in this update

- **Pagination + search** across products, drinks, users, and orders (`?page=&limit=&search=`).
- **Hashed product URLs**: `GET /products/:id` accepts either a raw numeric id or an
  obfuscated hash (see `utils/idHash.js`) - the storefront now links to
  `/product/<hash>` instead of exposing sequential ids.
- **Product galleries**: `POST/PUT /products` now accepts a primary `image` plus up to
  5 `gallery` files (multipart), powering an auto-rotating photo carousel on the
  storefront card.
- **Barista training module**: `BaristaSession` (published by staff) and
  `BaristaApplication` (submitted by the public) models, gated behind a new
  `manageBarista` permission. See `/barista/*` routes.
- **Settings**: added `mtnCode` (MTN MoMo Pay merchant code) alongside the existing
  `mtnNumber`, `stripeEnabled`, `mtnEnabled`, `codEnabled`, `manualProofEnabled`.
- New `manageBarista` permission added to the default permission set on `User`.

All of the above was verified against a real running MySQL instance, not just
syntax-checked: pagination, search, hashed id lookups (including rejecting bad
hashes), barista session/application flow with permission enforcement (a manager
without `manageBarista` correctly gets a 403), and the settings/payment toggle flow.
