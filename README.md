# Product Inventory Management System

A full-stack CRUD web application for managing products, categories, suppliers, and stock movements — built as part of the Deimos Tech Web Development Internship Assessment.

---

## Live Demo
- **Frontend:** https://inventory-management-system-enus.vercel.app/
- **Backend API:** https://inventory-management-system-omega-livid.vercel.app/api
- **Database:** Neon (managed cloud PostgreSQL)

No login required — the app is open and seeded with sample data.

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

> These steps are for running the project locally. A live version is already deployed — see the Live Demo section above.

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

> Note: `frontend/api.js` points to `http://localhost:4000/api` by default. Update `API_BASE` in that file if your backend runs elsewhere.

---

## Testing

Automated unit tests were not included as part of the core scope; instead, each route was verified with **self-contained smoke-test scripts** in `backend/test-manual/`. Each script boots the Express app on a dedicated test port, fires a sequence of real HTTP requests covering the happy path *and* the documented edge cases (validation errors, duplicate SKUs, delete-protection, insufficient stock, etc.), and prints the results.

Run them (with the database seeded, per Setup above):
```bash
cd backend
node test-manual/test-categories.js
node test-manual/test-suppliers.js
node test-manual/test-products.js
node test-manual/test-stock-movements.js
```

---

## API Reference

All responses are JSON. All errors follow the shape:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

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

**Query params for `GET /api/products`:**
- `search` — matches `name` or `sku`, case-insensitive, partial match
- `category` — filter by `category_id`
- `supplier` — filter by `supplier_id`
- `status` — one of `in_stock` (≥10), `low_stock` (1–9), `out_of_stock` (0)

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
- **UX polish**: debounced search input, custom-styled dropdowns, an intro splash animation, and a small summary dashboard (total / in-stock / low-stock / out-of-stock counts) on the Products page.
- **Live deployment**: frontend and backend deployed separately on Vercel, backed by a managed Postgres database on Neon (see Live Demo section above for links).
- The remaining optional stretch goals (authentication, full analytics dashboard, CSV export/import, automated test suite, Docker) were not implemented — priority was making the core CRUD, search/filter/pagination, and stock-movement requirements fully correct and well-tested first.

## Known Limitations
- No automated test suite (Jest/Mocha) — verified instead via manual smoke-test scripts (see Testing section above).
- No authentication — all endpoints are open, as auth was a stretch goal, not a core requirement.
- Frontend does not debounce category/supplier filter dropdowns (not needed — only the free-text search is debounced).
- No live deployment; this submission runs locally per the Setup instructions above.
