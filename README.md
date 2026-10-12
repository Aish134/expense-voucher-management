<<<<<<< HEAD
# Vouchly Expense Voucher Management

Vouchly is a full-stack expense-voucher workflow application for the PSPL workspace.
Employees create and sign vouchers, directors approve or reject them, and accounts
users can view organization-wide voucher activity.

## Technology

- Frontend: React, Vite, React Router, Lucide icons, and Recharts
- Backend: Node.js and Express REST API
- Database: SQLite through `better-sqlite3`
- Authentication: JWT and bcrypt password hashing
- File storage: local disk for signature images
- Roles: `employee`, `director`, and `accounts`

## Project setup

### Requirements

- Node.js 20 or newer
- npm

Install dependencies in both applications:

```powershell
cd server
npm install
cd ..\client
npm install
```

### Environment configuration

Copy the server template and replace the development JWT secret:

```powershell
cd server
Copy-Item .env.example .env
```

The server template defines:

- `PORT` - API port, default `4000`
- `JWT_SECRET` - secret used to sign eight-hour JWTs
- `CLIENT_ORIGIN` - browser origin allowed by CORS

The client defaults to `http://localhost:4000/api`. To override it, copy
`client/.env.example` to `client/.env` and set `VITE_API_URL`.

### Run locally

Start the API in one terminal:

```powershell
cd server
npm run dev
```

Start the client in a second terminal:

```powershell
cd client
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.
The API creates `server/data.sqlite` and `server/uploads/` on first start.

### Demo accounts

All demo accounts use the password `Demo@123`.

| Role | Email |
| --- | --- |
| Employee | `employee@pspl.demo` |
| Director | `director@pspl.demo` |
| Accounts | `accounts@pspl.demo` |

Demo users are seeded only when the database has no users. Change demo passwords
and `JWT_SECRET` before any real deployment.

## Database schema

The application initializes the schema in `server/src/db.js`. A reproducible SQL
schema is also provided at `server/migrations/001_initial_schema.sql`.

### `users`

Stores login and role information. `email` is unique and `role` is restricted to
`employee`, `director`, or `accounts`. Passwords are stored as bcrypt hashes;
plain-text passwords are never stored.

### `vouchers`

Stores the expense request and current workflow state. Each voucher belongs to
one employee through `employee_id`. Required business fields are department,
title, category, expense date, and a positive amount. `status` is one of
`Draft`, `Pending Approval`, `Approved`, or `Rejected`.

Signature columns contain URLs such as `/uploads/<filename>` rather than binary
data. `rejection_reason` is populated for rejected vouchers and `approval_date`
is populated for approved vouchers. `created_at` and `updated_at` are ISO-8601
timestamps.

### `workflow_events`

Stores the audit history for voucher creation, edits, signatures, submission,
approval, and rejection. Each event references a voucher and the user who
performed the action.

The database file is intentionally local and is not suitable for concurrent
production deployment. A production version should use a managed relational
database and a migration runner.

## API documentation

The default API base URL is `http://localhost:4000/api`. Protected endpoints
require this header:

```http
Authorization: Bearer <jwt>
```

Errors have the form `{ "error": "message" }`.

### Authentication and health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | No | Returns API health information |
| `POST` | `/auth/login` | No | Body: `{ "email", "password" }`; returns `{ "token", "user" }` |
| `GET` | `/auth/me` | Yes | Returns the authenticated user |

### Dashboard and vouchers

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| `GET` | `/dashboard` | Any | Returns role-scoped totals, counts, and recent vouchers |
| `GET` | `/vouchers` | Any | Lists vouchers; employees see only their own |
| `GET` | `/vouchers/:id` | Any | Returns a voucher and workflow history |
| `POST` | `/vouchers` | Employee | Creates a draft |
| `PUT` | `/vouchers/:id` | Employee | Updates an owned draft |
| `DELETE` | `/vouchers/:id` | Employee | Deletes an owned draft |
| `POST` | `/vouchers/:id/employee-signature` | Employee | Uploads an owned draft signature |
| `POST` | `/vouchers/:id/director-signature` | Director | Uploads a pending voucher signature |
| `POST` | `/vouchers/:id/submit` | Employee | Submits a signed draft for approval |
| `POST` | `/vouchers/:id/approve` | Director | Approves a pending signed voucher |
| `POST` | `/vouchers/:id/reject` | Director | Rejects a pending voucher |

`GET /vouchers` supports `q`, `status`, `department`, and `category` query
parameters. Create and update requests use JSON and require `department`,
`title`, `expense_date`, `category`, and a positive `amount`.

Signature endpoints use `multipart/form-data` with a file field named
`signature`. PNG, JPEG, and WebP files up to 2 MB are accepted. Rejection uses
JSON with a required `{ "reason": "..." }` field.

## Assumptions made during development

- This is a local/demo implementation; registration, password reset, email
  notifications, and payment/reimbursement integrations are out of scope.
- SQLite and local signature storage are used for simple evaluation.
- Employees can edit and delete only their own drafts.
- Employees must upload a signature before submission; directors must upload a
  signature before approval.
- Accounts users have read-only access and cannot change voucher state.
- JWTs expire after eight hours and are stored in browser `localStorage`.
- Dates are stored as text and expected to be ISO-compatible.
- Amounts are stored as SQLite `REAL` values and displayed as whole Indian
  rupees. Accounting-grade deployments should use fixed-precision decimals.
- Uploaded files have size and MIME checks but no virus scanning or object
  storage retention policy.
- The fallback JWT secret in source code exists only for local development;
  production must always set `JWT_SECRET`.

## Useful commands

```powershell
# API development mode
cd server
npm run dev

# API start
npm start

# Client production build
cd ..\client
npm run build

# Preview the client build
npm run preview
```
=======
# expense-voucher-management
>>>>>>> f788b733faf468c526a1b84549fd49a30fc37e79
