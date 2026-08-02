# Product Inventory Management System

A full-stack CRUD web application for managing products, categories, suppliers, and stock movements — built as part of the Deimos Tech Web Development Internship Assessment.

---

## Tech Stack & Reasoning

| Layer | Choice | Why |
|---|---|---|
| Backend | Node.js + Express | Single language across the whole stack (backend and frontend are both JavaScript), minimal boilerplate, and a very well-documented ecosystem — this keeps the moving parts simple and easy to debug. |
| Database | PostgreSQL | A real relational database is required by the task. Postgres gives strong support for `CHECK` constraints, foreign keys, and transactions, which this app relies on directly for its business rules. |
| DB Driver | `pg` (node-postgres) | The standard, lightweight driver — no ORM was used so that every SQL query is explicit and easy to explain line-by-line (per the assessment's requirement that AI-assisted code must be fully explainable). |
| Frontend | Plain HTML / CSS / JavaScript | No build step, no framework overhead. The task explicitly says pixel-perfect design isn't required — just usability — so a framework like React would have added complexity without adding value here. |
| Validation | `express-validator` | Declarative, readable validation rules on top of Express routes. |

---

## Project Structure

```
inventory-system/
├── backend/
│   ├── db/
│   │   ├── pool.js              # PostgreSQL connection pool
│   │   ├── migrations/
│   │   │   └── 001_init_schema.sql
│   │   └── seed/
│   │       └── seed.sql
│   ├── middleware/
│   │   ├── AppError.js          # Custom error class
│   │   └── errorHandler.js      # Central error handler -> consistent JSON error shape
│   ├── routes/
│   │   ├── categories.js
│   │   ├── suppliers.js
│   │   └── products.js          # includes stock-movement endpoints
│   ├── test-manual/              # Self-contained smoke-test scripts (see Testing section)
│   ├── server.js
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── index.html                # Products page (with summary stat cards)
    ├── categories.html
    ├── suppliers.html
    ├── style.css                 # Shared design system
    ├── api.js                    # fetch() wrapper for the backend API
    ├── common.js                 # Shared UI helpers (toast, modal, badges, custom dropdown, splash screen)
    ├── products.js
    ├── categories.js
    └── suppliers.js
```

---

## Setup

### Prerequisites
- Node.js 18+ (uses the built-in `fetch` API in test scripts)
- PostgreSQL running locally (or any reachable instance)

### 1. Install backend dependencies
```bash
cd backend
npm install
```

### 2. Configure environment
Copy `.env.example` to `.env` and fill in your Postgres credentials:
```bash
cp .env.example .env
```
```
PORT=4000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=inventory_db
DB_USER=postgres
DB_PASSWORD=your_password_here
```

### 3. Create the database and run the migration
```bash
createdb inventory_db
psql -d inventory_db -f db/migrations/001_init_schema.sql
```

### 4. Seed sample data
Loads 3 categories, 3 suppliers, 20 products, and a handful of sample stock movements.
```bash
psql -d inventory_db -f db/seed/seed.sql
```

### 5. Run the backend
```bash
node server.js
# Server running on http://localhost:4000
```

### 6. Run the frontend
The frontend is static — any static file server works. From the `frontend/` folder:
```bash
cd ../frontend
python3 -m http.server 8080
```
Then open `http://localhost:8080/index.html` in your browser.

> `frontend/api.js` automatically points at `http://localhost:4000/api` when the page is opened from `localhost`, and at the deployed backend URL otherwise — no manual editing needed.

---

## Option B: Run everything with Docker

Instead of steps 1–6 above, with [Docker](https://www.docker.com/) installed you can start the database, backend, and frontend together with one command from the project root:

```bash
docker compose up --build
```

This will:
- Start a PostgreSQL container and automatically run the schema migrations and seed data on first startup (nothing to run manually)
- Build and start the backend API on `http://localhost:4000`
- Serve the frontend (via nginx) on `http://localhost:8080`

Default login credentials (from the seed data) are the same as in the Setup section below — see `db/seed/seed_users.sql`.

To stop everything: `Ctrl+C`, then `docker compose down` (add `-v` to also wipe the database volume and start fresh next time).

---

## Testing

**Automated tests (Jest + Supertest)** — 38 tests across 6 suites covering auth, all CRUD routes, validation, delete-protection, role-based permissions, atomic stock movements, and dashboard analytics. Run with the database seeded (per Setup above):
```bash
cd backend
npm test
```

**Manual smoke-test scripts** in `backend/test-manual/` were also kept — each boots the Express app on a dedicated port and walks through a sequence of real requests with printed output, useful for eyeballing exact responses during development:
```bash
node test-manual/test-categories.js
node test-manual/test-suppliers.js
node test-manual/test-products.js
node test-manual/test-stock-movements.js
node test-manual/test-auth.js
node test-manual/test-dashboard.js
node test-manual/test-csv.js
```

---

## API Reference

Full interactive documentation (Swagger UI) is available at `/api-docs` once the backend is running (e.g. `http://localhost:4000/api-docs`), including a "try it out" mode with authentication support. The raw OpenAPI spec is at `/api-docs.json`. Summary below:

All responses are JSON. All errors follow the shape:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

Except `/api/health` and `/api/auth/*`, every endpoint below requires a `Authorization: Bearer <token>` header (obtained from `/api/auth/login`).

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Sign up — `{ name, email, password }`. Always creates a `staff` account. |
| POST | `/api/auth/login` | Log in — `{ email, password }` → `{ user, token }` |
| GET | `/api/auth/me` | Returns the currently authenticated user |

Default seeded accounts (see `db/seed/seed_users.sql`): `admin@inventory.com` / `admin123` and `staff@inventory.com` / `staff123`.

### Categories
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/categories?page=&pageSize=` | List (paginated) |
| GET | `/api/categories/:id` | Get one |
| POST | `/api/categories` | Create — `{ name, description }` |
| PUT | `/api/categories/:id` | Update |
| DELETE | `/api/categories/:id` | Delete — **409** if products still reference it |

### Suppliers
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/suppliers?page=&pageSize=` | List (paginated) |
| GET | `/api/suppliers/:id` | Get one |
| POST | `/api/suppliers` | Create — `{ name, contact_email, phone, address }` |
| PUT | `/api/suppliers/:id` | Update |
| DELETE | `/api/suppliers/:id` | Delete — **409** if products still reference it |

### Products
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/products?search=&category=&supplier=&status=&page=&pageSize=` | List with search/filter/pagination |
| GET | `/api/products/:id` | Get one |
| POST | `/api/products` | Create — `{ name, sku, description, unit_price, quantity_in_stock, category_id, supplier_id }` |
| PUT | `/api/products/:id` | Update (full replace) |
| DELETE | `/api/products/:id` | Delete (also removes its stock movement history via `ON DELETE CASCADE`) |
| POST | `/api/products/:id/stock-movements` | Record a movement — `{ type: "IN"\|"OUT", quantity, reason }`. Atomically updates `quantity_in_stock`. |
| GET | `/api/products/:id/stock-movements` | Movement history for a product, most recent first |
| GET | `/api/products/export` | Download all products as a CSV file |
| POST | `/api/products/import` | Bulk create/update products from an uploaded CSV (**admin only**) — matches existing rows by SKU |

**Query params for `GET /api/products`:**
- `search` — matches `name` or `sku`, case-insensitive, partial match
- `category` — filter by `category_id`
- `supplier` — filter by `supplier_id`
- `status` — one of `in_stock` (≥10), `low_stock` (1–9), `out_of_stock` (0)

### Dashboard
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard/summary` | Product/category/supplier counts, stock status breakdown, total inventory value |
| GET | `/api/dashboard/stock-trend?days=7` | Daily IN vs OUT totals, for a trend chart |
| GET | `/api/dashboard/category-breakdown` | Product count per category, for a pie chart |
| GET | `/api/dashboard/top-products?limit=5` | Highest inventory-value products |

---

## Design Decisions

**Referential integrity over silent deletes.** Categories and suppliers can't be deleted while products still reference them. The database enforces this with `ON DELETE RESTRICT`, and the API adds a friendlier pre-check so the error message says exactly how many products are blocking the delete, instead of surfacing a raw database error.

**Products → Stock Movements is `ON DELETE CASCADE`.** Deleting a product also removes its movement history, since that history has no meaning without the product it belongs to. This is different from the Category/Supplier case above on purpose: those are "shouldn't disappear silently" relationships, this is a "child records belong to the parent" relationship.

**Stock updates are wrapped in a database transaction.** `POST /:id/stock-movements` runs `SELECT ... FOR UPDATE` to lock the product row, checks the resulting quantity, inserts the movement, and updates `quantity_in_stock` — all inside one transaction, with `ROLLBACK` on any failure. This guarantees that (a) an `OUT` movement can never push stock below zero, and (b) two simultaneous requests against the same product can't both read a stale quantity and corrupt the stock count.

**No ORM.** Every query is raw SQL through `pg`. This was a deliberate trade-off: it's more verbose than using an ORM, but it makes every query fully transparent and easy to walk through line-by-line, which matters given the assessment's requirement that AI-assisted code be fully explainable in an interview setting.

**Business-rule constraints live in two places on purpose.** `CHECK` constraints (e.g. `unit_price >= 0`) are enforced at the database level as the last line of defense, and `express-validator` enforces the same rules at the API level to produce clean, specific error messages before a query is even sent. If the database constraint is ever hit anyway (e.g. a future code path that bypasses validation), the central error handler (`middleware/errorHandler.js`) still translates it into the same consistent error shape.

**Plain frontend, no framework.** Three static HTML pages share a single `style.css` design system and a small `api.js` fetch wrapper. Given the assessment's explicit note that visual polish isn't scored heavily, the priority was a frontend that's easy to read and modify without a build step.

---

## Stretch Goals Completed
- **Authentication**: JWT-based login/signup, with Admin and Staff roles. Staff can view/create/edit; Delete is restricted to Admins (enforced server-side, not just hidden in the UI).
- **Analytics dashboard**: summary stats, a stock-movement trend chart, category breakdown, and top products by inventory value — backed by dedicated `/api/dashboard/*` endpoints.
- **CSV export/import**: download the full product catalog as CSV, or bulk-create/update products from an uploaded CSV (admin-only), with per-row validation and a created/updated/errors summary.
- **API documentation**: interactive Swagger UI at `/api-docs`, plus a raw OpenAPI 3.0 spec at `/api-docs.json` (importable into Postman).
- **Automated tests**: 38 Jest + Supertest tests across 6 suites (see Testing section).
- **Docker**: `docker compose up` starts the database (auto-migrated and seeded), backend, and frontend together.
- **Live deployment**: frontend and backend deployed separately on Vercel, backed by a managed Postgres database on Neon (see Live Demo section above for links).
- **UX polish**: debounced search input, custom-styled dropdowns, an intro splash animation, and a light/dark theme toggle.

## Known Limitations
- The deployed (Vercel) frontend and the Docker/local setup use different backend URLs — `frontend/api.js` switches between them automatically based on hostname, so no manual edit is needed either way.
- CSV import matches categories/suppliers by exact name; it doesn't auto-create a new category/supplier if the name doesn't match — this is a deliberate choice to avoid silently creating typo'd categories, but it does mean the category/supplier must already exist before importing.
- No automated end-to-end (browser) tests — Jest/Supertest cover the API layer; the frontend was verified manually.

