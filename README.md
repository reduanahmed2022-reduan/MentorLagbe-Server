# MentorLagbe API (Server)

REST API for **MentorLagbe**, a tutor–student marketplace. It handles JWT authentication, tutor tuition posts with admin approval, student applications, Stripe Checkout for Pro plans, ImgBB image uploads, and admin stats/user-role management.

**Local base URL:** `http://localhost:5000`  
**Live API (placeholder):** `https://<your-api-host>`

---

## Tech Stack

- **Runtime:** Node.js (ES modules — `"type": "module"` in `package.json`)
- **Framework:** Express 5
- **Database:** MongoDB native driver (no Mongoose); database name `MantorLagbe`
- **Auth:** `jsonwebtoken` (JWT bearer tokens) + `bcryptjs` (password hashing)
- **Payments:** `stripe` (Stripe Checkout + signed webhooks)
- **Uploads:** `multer` (in-memory, 5 MB limit) → ImgBB
- **Middleware:** `cors`, `dotenv`

### Dependencies (exact versions from `package.json`)

| Package | Version |
| --- | --- |
| `@better-auth/mongo-adapter` | `^1.7.27` |
| `bcryptjs` | `^3.0.3` |
| `better-auth` | `^1.7.27` |
| `cors` | `^2.8.6` |
| `dotenv` | `^18.0.10` |
| `express` | `^5.3.0` |
| `jsonwebtoken` | `^9.0.3` |
| `mongodb` | `^7.9.0` |
| `multer` | `^2.5.0` |
| `stripe` | `^23.2.0` |

> Note: the `dev` script uses Node's built-in `node --watch`. **Nodemon is not a dependency** in this repo, so no `nodemon` install/config is required. `better-auth` and `@better-auth/mongo-adapter` are listed in `package.json`; the REST auth implemented here uses JWT + bcryptjs.

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Create your environment file

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Fill in the values (see table below). Only `MONGODB_URI` and `JWT_SECRET` are **required to boot** (the server exits without them). `CLIENT_URL`, Stripe, and ImgBB are optional/feature-specific, but set `CLIENT_URL` and the keys for features you use in production.

### 3. Run the server

```bash
npm run dev   # node --watch index.js (auto-restart on changes)
npm start     # node index.js
```

### 4. Seed demo data (optional)

```bash
npm run seed
```

This seeds the admin, 6 tutors, 2 students, 12 approved tuitions, and 5 sample applications. It is idempotent: existing users/documents are left untouched (`$setOnInsert`).

`npm run seed` uses built-in defaults if `ADMIN_EMAIL`, `ADMIN_PASSWORD`, or `ADMIN_NAME` are absent from `.env`/the host environment (`admin@mentorlagbe.com` / `Admin@12345` / `MentorLagbe Admin`). By contrast, **`npm run seed:admin` requires `ADMIN_EMAIL` and `ADMIN_PASSWORD`** to be set explicitly and fails with an error if either is missing (`ADMIN_NAME` is optional there).

> **Password changes:** because seeding never overwrites existing users, changing `ADMIN_PASSWORD` and re-running either seed does **not** rotate the password of an admin account that already exists. Update that user's password through the app or database instead.

Other available scripts:

```bash
npm run seed:admin    # node seedAdmin.js
npm run seed:tutors   # node seedTutors.js
```

---

## Environment Variables

Every variable in `.env.example` (see DEPLOYMENT.md for a "Required to boot" vs "Optional / feature-specific" breakdown):

| Variable | Purpose |
| --- | --- |
| `PORT` | Port the API listens on; defaults to `5000`. |
| `MONGODB_URI` | MongoDB connection string (Atlas or local). Required — the app throws at import if missing. |
| `JWT_SECRET` | Secret used to sign and verify access tokens. Required at startup. |
| `JWT_EXPIRES_IN` | JWT lifetime, e.g. `7d`; defaults to `7d`. |
| `CLIENT_URL` | Comma-separated allowed CORS origins, also the base URL for Stripe success/cancel redirects. |
| `STRIPE_SECRET_KEY` | Stripe secret key for Checkout sessions; payment endpoints return `503` if unset. |
| `STRIPE_WEBHOOK_SECRET` | Stripe endpoint signing secret used to verify webhook signatures. |
| `IMGBB_API_KEY` | ImgBB API key for image uploads; `/api/upload/image` returns `503` if unset. |
| `ADMIN_EMAIL` | Email used by `npm run seed` for the admin account (default `admin@mentorlagbe.com`). |
| `ADMIN_PASSWORD` | Password used by `npm run seed` for the admin account (default `Admin@12345`). |
| `ADMIN_NAME` | Display name used by `npm run seed` for the admin account (default `MentorLagbe Admin`). |

Notes: `MONGODB_URI` and `JWT_SECRET` are boot-blocking; missing Stripe/ImgBB keys only make those features return `503`; `JWT_EXPIRES_IN` and `ADMIN_NAME` are optional with defaults. The `ADMIN_*` variables are seed-only — `npm run seed` falls back to the defaults above when they are absent, but `npm run seed:admin` requires `ADMIN_EMAIL` and `ADMIN_PASSWORD`. `Admin@12345` is the documented demo default only — **change it in production**. Re-running a seed after changing `ADMIN_PASSWORD` will not rotate an existing admin's password.

Example:

```env
PORT=5000
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
IMGBB_API_KEY=your_imgbb_api_key
ADMIN_EMAIL=admin@mentorlagbe.com
ADMIN_PASSWORD=Admin@12345
ADMIN_NAME=MentorLagbe Admin
```

---

## Authentication

Protected routes expect:

```http
Authorization: Bearer <jwt_token>
```

Roles are `student`, `tutor`, and `admin`. Registration accepts only `student` or `tutor`; create the admin via seeding.

**Auth legend used below:** `Public` · `Bearer` (any logged-in user) · `Bearer: student` · `Bearer: tutor` · `Bearer: admin` · `Stripe signature` (no JWT).

---

## API Routes

### Root / health

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/` | Public | API status message. |
| GET | `/health` | Public | Health check (`status: "OK"`). Use for uptime checks. |

### `/api/auth`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Register a student or tutor; returns a JWT. |
| POST | `/api/auth/login` | Public | Log in; returns a JWT. |
| GET | `/api/auth/me` | Bearer | Get the logged-in user's profile. |
| PUT | `/api/auth/me` | Bearer | Update the logged-in user's profile. |
| GET | `/api/auth/student-dashboard` | Bearer: student | Student-only dashboard payload. |
| GET | `/api/auth/tutor-dashboard` | Bearer: tutor | Tutor-only dashboard payload. |

### `/api/tutors`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/tutors` | Public | List/search tutors (`subject`, `location`, `mode`, `minRate`, `maxRate`, `sort=price-low\|price-high\|rating`). |
| GET | `/api/tutors/:id` | Public | Get one tutor by MongoDB ObjectId. |
| POST | `/api/tutors` | Bearer: admin | Add a tutor listing. |
| PUT | `/api/tutors/:id` | Bearer: admin | Update a tutor listing. |
| DELETE | `/api/tutors/:id` | Bearer: admin | Delete a tutor listing. |

### `/api/tuitions`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/tuitions` | Public | List all approved/active tuitions. |
| GET | `/api/tuitions/:id` | Public | Get a single tuition by ID. |
| POST | `/api/tuitions` | Bearer: tutor | Create a tuition (pending admin approval). |
| GET | `/api/tuitions/admin/pending` | Bearer: admin | List tuitions awaiting review. |
| PATCH | `/api/tuitions/admin/review/:id` | Bearer: admin | Approve or reject a tuition. |
| GET | `/api/tuitions/my-tuitions` | Bearer: tutor | List the logged-in tutor's tuitions. |
| PATCH | `/api/tuitions/:id` | Bearer: tutor | Update one of your tuitions. |
| PATCH | `/api/tuitions/:id/status` | Bearer: tutor | Toggle active/closed status. |
| DELETE | `/api/tuitions/:id` | Bearer: tutor | Delete one of your tuitions. |

### `/api/applications`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/applications/my-applications` | Bearer: student | List the logged-in student's applications. |
| POST | `/api/applications` | Bearer: student | Apply to a tuition. |
| GET | `/api/applications/tutor-applicants` | Bearer: tutor | List applicants for the logged-in tutor's tuitions. |
| PATCH | `/api/applications/:id/status` | Bearer: tutor | Update an application's status (accept/reject). |
| DELETE | `/api/applications/:id` | Bearer: student | Cancel a pending application. |

### `/api/admin`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/admin/users` | Bearer: admin | List all users. |
| PATCH | `/api/admin/users/:id/role` | Bearer: admin | Change a user's role. |
| GET | `/api/admin/tuitions` | Bearer: admin | List all tuitions (any status). |
| GET | `/api/admin/stats` | Bearer: admin | Dashboard statistics. |
| GET | `/api/admin/transactions` | Bearer: admin | List payment transactions. |

### `/api/payments`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/payments/checkout` | Bearer (tutor/student) | Create a Stripe Checkout session for the Pro plan. |
| POST | `/api/payments/verify` | Bearer (tutor/student) | Verify a returned Checkout session and activate Pro. |
| POST | `/api/payments/webhook` | Stripe signature | Stripe webhook for `checkout.session.completed` / `checkout.session.async_payment_succeeded`. |

Pro plan prices (USD, in cents, from `config/stripe.js`): tutor `1500`, student `1000`.

### `/api/upload`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/upload/image` | Bearer | Upload a `multipart/form-data` file in the `image` field (image files only, max 5 MB) to ImgBB; returns `imageUrl` and `deleteUrl`. |

Unknown `/api/*` routes return a JSON `404` instead of an HTML error page.

---

## Seed / Demo Credentials

Created by `npm run seed`:

### Admin

| Email | Password |
| --- | --- |
| `admin@mentorlagbe.com` | `Admin@12345` |

(Overridable with `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME` in `.env`.)

### Tutors — all use password `Tutor@12345`

| Name | Email | Plan |
| --- | --- | --- |
| Sarah Ahmed | `sarah@mentorlagbe.com` | pro |
| Rahim Hasan | `rahim@mentorlagbe.com` | free |
| Nusrat Jahan | `nusrat@mentorlagbe.com` | pro |
| Sabbir Hossain | `sabbir@mentorlagbe.com` | free |
| Ayesha Rahman | `ayesha@mentorlagbe.com` | pro |
| Tanvir Ahmed | `tanvir@mentorlagbe.com` | free |

### Students — all use password `Tutor@12345`

| Name | Email |
| --- | --- |
| Student One | `student1@mentorlagbe.com` |
| Student Two | `student2@mentorlagbe.com` |

The seed also inserts 12 approved tuitions across Mathematics, English, Physics, Programming, Biology, and Chemistry, plus 5 sample applications with accepted/pending/rejected statuses.

---

## Implementation Notes

- **CORS** is driven by `CLIENT_URL`, split on commas and trimmed. Requests without an `Origin` header (server-to-server, health checks) are allowed; disallowed origins receive `403`. Credentials are enabled.
- **Stripe webhook raw body:** `webhookRoutes` is mounted on `/api/payments` **before** `express.json()`, and uses `express.raw({ type: "application/json" })`. Do not move it after the JSON parser or signature verification will fail.
- **JWT secret is required at startup:** if `JWT_SECRET` is missing, the server logs the error and exits. Tokens are signed with `JWT_EXPIRES_IN` (default `7d`) and verified via `Authorization: Bearer <token>`.
- **Transactions:** paid Stripe sessions are recorded in the `payments` collection with user, plan, amount, currency, `transactionId`, `stripeSessionId`, and `paidAt`. Activation is idempotent by `stripeSessionId` (webhook + success-page verify are both safe), and the user's `plan` is set to `pro`. Admins read these via `/api/admin/transactions`.
- **Database:** the code connects to the database named `MantorLagbe` (spelling as in `config/db.js`) and uses collections `users`, `tutors`, `tuitions`, `applications`, and `payments`.
- **Errors:** CORS, malformed JSON, multer, and unexpected errors are normalized to JSON responses by centralized handlers.

---

## Deployment

### Production checklist

1. Set `MONGODB_URI` to the production MongoDB Atlas connection string.
2. Generate a strong `JWT_SECRET` and set an appropriate `JWT_EXPIRES_IN`.
3. Set `CLIENT_URL` to the deployed client origin, e.g. `https://your-client.example.com`. For multiple clients, use a comma-separated list. This avoids CORS failures and controls Stripe redirect URLs.
4. Set `STRIPE_SECRET_KEY` to the live (or test) secret key.
5. Configure the Stripe webhook endpoint at `https://<api>/api/payments/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`, then put its signing secret in `STRIPE_WEBHOOK_SECRET`.
6. Set `IMGBB_API_KEY` so `/api/upload/image` works.
7. Set `PORT` (or let the host inject it) and start with `npm start`.
8. Point an uptime monitor at `GET /health` (or the placeholder live URL `https://<your-api-host>/health`).
9. Re-run `npm run seed` only if you want the demo accounts/data in that environment (remember it will not overwrite existing users).

### Environment variables (exact keys)

Set these in the hosting platform's environment/secret store (or in `.env` locally). Keys are case-sensitive and match the code exactly.

| Key | Notes |
| --- | --- |
| `PORT` | Listen port; defaults to `5000` when unset. |
| `MONGODB_URI` | MongoDB Atlas connection string. **Required** — the app throws at import if missing. |
| `JWT_SECRET` | JWT signing secret. **Required** — the server exits at startup if missing. |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d`; defaults to `7d`. |
| `CLIENT_URL` | Comma-separated allowed CORS origins. Stripe Checkout success/cancel redirects use the **first** origin only — list the primary client first. |
| `STRIPE_SECRET_KEY` | Stripe secret key; payment endpoints return `503` if unset. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the Stripe webhook endpoint. |
| `IMGBB_API_KEY` | ImgBB key for `/api/upload/image`; returns `503` if unset. |
| `ADMIN_EMAIL` | Admin email for seeding (default `admin@mentorlagbe.com`). |
| `ADMIN_PASSWORD` | Admin password for seeding (default `Admin@12345`). |
| `ADMIN_NAME` | Admin display name for seeding (default `MentorLagbe Admin`). |

### Commands

```bash
npm install          # install dependencies
npm run dev          # local development (node --watch, auto-restart)
npm start            # production (node index.js)
npm run seed         # seed full demo dataset (idempotent)
npm run seed:admin   # seed only the admin account
npm run seed:tutors  # seed only the tutor listings
```

### Smoke-test endpoints

- `GET /health` → `200` with `{ "success": true, "status": "OK" }` — use for uptime checks.
- `GET /` → `200` with the API status message.
- Unknown `/api/*` routes → JSON `404` (`{ "success": false, "message": "API route not found: ..." }`), never an HTML error page.

### Stripe webhook

- Register the endpoint at `https://<your-api-host>/api/payments/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`, and store its signing secret in `STRIPE_WEBHOOK_SECRET`.
- The route uses `express.raw({ type: "application/json" })` and is mounted on `/api/payments` **before** `express.json()` so the untouched raw body is available for signature verification. Do not move it after the JSON parser or verification will fail.
- The success-page counterpart is `POST /api/payments/verify` (Bearer token required); it verifies the returned Checkout session and activates Pro. Activation is idempotent across webhook and verify.

### CORS

`CLIENT_URL` must include the deployed client origin(s) — comma-separated and trimmed, e.g. `https://app.example.com,https://admin.example.com`. Requests without an `Origin` header (health checks, server-to-server) are allowed; disallowed origins receive `403`. Remember that Stripe redirects use only the first configured origin.

### Node / hosting notes

- Let the platform inject `PORT` (falls back to `5000` locally); `npm start` is the production entry point. No extra host/bind flag is needed.
- Use MongoDB Atlas in production and allow the host's egress IPs in the cluster's network access list.
- Keep `.env` out of git and supply values via the platform's secret manager; rotate any secret that was ever committed.
- The project uses ES modules (`"type": "module"`); use a Node.js version that supports `node --watch` for local development.
