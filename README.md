# mosaic-module-finance

Personal income and expense tracker for the Mosaic framework. Log transactions in custom categories, import from CSV, view monthly summaries, and track inventory sale proceeds automatically.

---

## Features

| Feature | Detail |
|---|---|
| Categories | Custom income and expense categories, each with a name, type, colour, and emoji |
| Transactions | Amount, type (income/expense), date, category, notes, optional source reference |
| CSV import | Bulk import up to 500 transactions from a CSV file |
| Monthly summary | Income vs expense totals broken down by category |
| Inventory income | Sales from Inventory module items appear automatically as income transactions |
| Reports | Weekly and monthly summaries for the Reports page |

---

## API

Base path: `/api/finance/`

### Categories

| Method | Path | Description |
|---|---|---|
| `GET` | `/categories` | List categories (`type`: `income`\|`expense`) |
| `POST` | `/categories` | Create category (`name`, `type`, `color`, `emoji`) |
| `PUT` | `/categories/:id` | Update category |
| `DELETE` | `/categories/:id` | Delete category |

### Transactions

| Method | Path | Description |
|---|---|---|
| `GET` | `/transactions` | List transactions (`month`: `YYYY-MM`, `type`, `categoryId`) |
| `POST` | `/transactions` | Create transaction (`amount`, `type`, `date`, `categoryId`, `notes`, `source`, `sourceId`) |
| `GET` | `/transactions/:id` | Get transaction |
| `PUT` | `/transactions/:id` | Update transaction |
| `DELETE` | `/transactions/:id` | Delete transaction |
| `POST` | `/transactions/import` | Bulk import from CSV (up to 500 rows) |

### Summary and Reports

| Method | Path | Description |
|---|---|---|
| `GET` | `/summary` | Income vs expense totals for a month (`month`: `YYYY-MM`) |
| `GET` | `/inventory-income` | Inventory sales logged as income for a month |
| `GET` | `/reports/weekly` | Weekly income and expense totals (`start`, `end` date params) |
| `GET` | `/reports/summary` | All-time totals for the Reports summary page |

---

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| `better-sqlite3` | peer | SQLite driver (provided by framework) |
| `express` | peer | HTTP server (provided by framework) |
| `@opentelemetry/api` | peer | Observability (provided by framework) |

---

## Project structure

```
mosaic-module-finance/
├── index.ts            # Module manifest — slug, nav, report hooks
├── src/
│   └── routes/
│       └── index.ts    # Finance router + /ui.js
├── public/
│   └── ui.js           # Frontend IIFE — served via GET /api/finance/ui.js
└── tests/
    └── unit/           # Vitest unit tests
```
