# ⚙️ MentorLagbe — REST API (Server)

> Express + MongoDB backend for the **MentorLagbe** tuition marketplace. It powers authentication (BetterAuth with the MongoDB adapter + JWT), tuition moderation, applications, Stripe Pro checkouts, ImgBB uploads and admin dashboards.

[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520.19-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.3.0-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.x-47a248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Checkout-635bff?logo=stripe&logoColor=white)](https://stripe.com/)
[![Render](https://img.shields.io/badge/Live-API-0f9f6e?logo=render&logoColor=white)](https://mentorlagbe-server-q3fr.onrender.com/health)

---

## 🔗 Assignment Links

| What | Link |
| --- | --- |
| 🌐 Live Website (Vercel) | https://mentorlagbe-client-weld.vercel.app |
| ⚙️ **Live API (Render)** | **https://mentorlagbe-server-q3fr.onrender.com/api** |
| 🩺 Health check | https://mentorlagbe-server-q3fr.onrender.com/health |
| 💻 Client GitHub Repository | https://github.com/reduanahmed2022-reduan/MentorLagbe |
| 🖥️ **Server GitHub Repository** | **https://github.com/reduanahmed2022-reduan/MentorLagbe-Server** |
| 📮 Contact | reduanahmed2022@gmail.com |

---

## 🔑 Demo Admin Login

| Role | Email | Password |
| --- | --- | --- |
| **Admin** | `admin@mentorlagbe.com` | `Admin@12345` |

Tutor: `sarah@mentorlagbe.com` / `Tutor@12345` · Student: `student1@mentorlagbe.com` / `Tutor@12345`

> Seeded locally with `npm run seed`. Change `ADMIN_PASSWORD` in any real deployment.

---

## ✅ Assignment Requirements Coverage

| Requirement | Status | Implementation |
| --- | --- | --- |
| Express REST API | ✅ | `index.js`, `routes/`, `controllers/` |
| MongoDB (native driver, DB `MantorLagbe`) | ✅ | `config/db.js` |
| BetterAuth + MongoDB adapter | ✅ | `config/betterAuth.js`, `@better-auth/mongo-adapter` |
| Google OAuth | ✅ | `/api/auth/google/start` → `/api/better-auth/callback/google` |
| JWT + bcrypt auth | ✅ | `jsonwebtoken`, `bcryptjs`, `middleware/authMiddleware.js` |
| Stripe payment gateway | ✅ | Checkout, webhook & verify — `config/stripe.js` |
| ImgBB image upload (with Cloudinary fallback) | ✅ | `multer` memory storage → ImgBB → Cloudinary |
| CORS for deployed client | ✅ | `CLIENT_URL` allowlist (`https://mentorlagbe-client-weld.vercel.app`) |
| Role-based access (student/tutor/admin) | ✅ | Bearer + role middleware |
| Live deployment | ✅ | Render (this API) + Vercel (client) |
| README with live URL, credentials, features, packages | ✅ | this file |
| Version control history | ✅ | 55+ meaningful server commits |

---

## ✨ Features

- 🔐 **Hybrid auth** — BetterAuth (Mongo adapter) for Google OAuth, JWT bearer tokens for all protected REST routes.
- 🧑‍🎓 **Marketplace API** — public tutor/tuition browsing with search, filters, sorting and detail endpoints.
- ✅ **Moderation workflow** — tutors post tuitions; admins approve or reject before they go live.
- 📝 **Applications** — students apply once per tuition, tutors accept/reject, admins see everything.
- 💳 **Stripe Subscriptions** — recurring monthly Pro plans (student **$10/mo**, tutor **$15/mo**) via `mode: "subscription"` Checkout, signed webhook for activation, renewals (`invoice.paid`) and cancellation, plus idempotent verification.
- 🖼️ **ImgBB uploads** — in-memory `multer` (max 5 MB), signature checked, returns image + delete URLs. If ImgBB blocks the deployment host, the API automatically falls back to Cloudinary when `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_UPLOAD_PRESET` (unsigned preset) are configured.
- 📊 **Admin endpoints** — stats, user role management, tuition queue, payment transactions.
- 🛡️ **Hardened production behavior** — JSON 404s for unknown API routes, normalized error handler, CORS allowlist, startup env validation.

---

## 🧱 Tech Stack & npm Packages

| Package | Version | Purpose |
| --- | --- | --- |
| `express` | `^5.3.0` | HTTP framework |
| `mongodb` | `^7.9.0` | Native MongoDB driver |
| `better-auth` | `^1.7.27` | OAuth / BetterAuth |
| `@better-auth/mongo-adapter` | `^1.7.27` | BetterAuth ↔ MongoDB persistence |
| `jsonwebtoken` | `^9.0.3` | JWT signing & verification |
| `bcryptjs` | `^3.0.3` | Password hashing |
| `stripe` | `^23.2.0` | Checkout + webhooks |
| `multer` | `^2.5.0` | Multipart image uploads |
| `cors` | `^2.8.6` | CORS allowlist |
| `dotenv` | `^18.0.10` | Environment loading |

> ES modules (`"type": "module"`). Dev uses Node's built-in `node --watch` — **nodemon is not required**.

---

## 🚀 Quick Start (বাংলা)

```bash
# 1. Install
npm install

# 2. Environment
copy .env.example .env        # Windows
cp .env.example .env          # macOS / Linux

# 3. Fill MONGODB_URI + JWT_SECRET (required to boot), then run
npm run dev                   # auto-restart on change → http://localhost:5000

# 4. Seed demo users, 16 tuitions (14 approved + 1 pending + 1 rejected) and sample applications (idempotent)
npm run seed
```

| Command | Description |
| --- | --- |
| `npm run dev` | `node --watch index.js` |
| `npm start` | Production entry point |
| `npm run seed` | Full demo dataset |
| `npm run seed:featured` | Budget-featured batches used by the homepage section |
| `npm run seed:admin` | Admin account only (needs `ADMIN_EMAIL` + `ADMIN_PASSWORD`) |
| `npm run seed:tutors` | Tutor catalog only |
| `node scripts/verify-env.mjs` | Pre-deploy environment check |
| `node scripts/smoke-test.mjs` | Endpoint smoke test |

---

## 🔐 Environment Variables (server-only)

Copy `.env.example`; **never commit `.env`** and never expose these in the Vercel/client project.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | **Required at boot.** MongoDB Atlas connection string. |
| `JWT_SECRET` | **Required at boot.** JWT signing secret. |
| `JWT_EXPIRES_IN` | Token lifetime; default `7d`. |
| `BETTER_AUTH_SECRET` | **Required at boot.** BetterAuth secret; also checked by the deploy preflight. |
| `BETTER_AUTH_URL` | **API origin** used for callbacks: local `http://localhost:5000`, live `https://mentorlagbe-server-q3fr.onrender.com`. |
| `CLIENT_URL` | Comma-separated allowed origins. In production Stripe uses the first non-localhost origin; locally it uses the first entry. Live value: `https://mentorlagbe-client-weld.vercel.app`. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth keys; both blank disables Google sign-in. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe Checkout + signed webhooks. |
| `IMGBB_API_KEY` | Primary image upload provider. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_UPLOAD_PRESET` | Optional fallback when ImgBB rejects the host. Use an unsigned upload preset. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Seed defaults: `admin@mentorlagbe.com` / `Admin@12345` / `MentorLagbe Admin`. |

```env
PORT=5000
# Local default; Render injects PORT=10000 automatically (see render.yaml).
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=long_random_secret
JWT_EXPIRES_IN=7d
BETTER_AUTH_SECRET=long_random_secret
BETTER_AUTH_URL=https://mentorlagbe-server-q3fr.onrender.com
CLIENT_URL=https://mentorlagbe-client-weld.vercel.app
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
IMGBB_API_KEY=your_imgbb_key
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_UPLOAD_PRESET=
ADMIN_EMAIL=admin@mentorlagbe.com
ADMIN_PASSWORD=Admin@12345
ADMIN_NAME=MentorLagbe Admin
```

> Google Console **Authorized redirect URI**:  
> `https://mentorlagbe-server-q3fr.onrender.com/api/better-auth/callback/google`

---

## 🗄️ Database

Database name: **`MantorLagbe`**

| Collection | Contents |
| --- | --- |
| `users` | Students, tutors (with public catalog fields), admins (bcrypt hashes, role, plan, profile) and BetterAuth user records. |
| `tuitions` | Tuition posts with `approvalStatus`, tutor ref, schedule and fee. |
| `applications` | Student applications with status and unique `(tuitionId, studentEmail)`. |
| `payments` | Paid Stripe checkout sessions and monthly renewal invoices: amounts, transaction/subscription IDs and payment dates. |

BetterAuth's `user`/`account` tables are mapped onto `users`; sessions and verification records live in in-memory secondary storage — no extra auth collections are created.

---

## 🔄 Authentication Flow

- **REST:** `Authorization: Bearer <jwt>` on protected routes. Roles: `student`, `tutor`, `admin`. Registration accepts only `student` / `tutor`; admin comes from seeding.
- **Google:** browser navigates to `GET /api/auth/google/start?role=student|tutor` → API sets the `better-auth.oauth_state` cookie and redirects to Google → Google returns to `GET /api/better-auth/callback/google` → `GET /api/auth/google/callback` exchanges the session for the same JWT and redirects to the client's `/auth/google/callback#token=...`. Failures redirect to `/auth/google/callback?error=...` on the **client** origin (never to Render).
- **Feature flag:** `GET /api/auth/google/status` → `{ enabled: true|false }`, no secrets exposed, so the client can disable the button when keys are absent.

---

## 📡 API Routes

**Auth legend:** `Public` · `Bearer` (any user) · `Bearer: student|tutor|admin` · `Stripe sig`

### Core

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/` | Public | API status |
| GET | `/health` | Public | Health check (`status: OK`) |
| POST | `/api/auth/register` | Public | Register student/tutor → JWT |
| POST | `/api/auth/login` | Public | Email/password → JWT |
| GET/PUT | `/api/auth/me` | Bearer | Read/update profile |
| GET | `/api/auth/student-dashboard` | Bearer: student | Student dashboard payload |
| GET | `/api/auth/tutor-dashboard` | Bearer: tutor | Tutor dashboard payload |
| GET | `/api/auth/google/status` | Public | Google OAuth availability flag |
| GET | `/api/auth/google/start` | Public | Begin Google OAuth (top-level navigation) |
| GET | `/api/auth/google/callback` | Public | BetterAuth session → JWT bridge |
| ALL | `/api/better-auth/*` | Public | BetterAuth endpoints (Mongo adapter) |

### Tutors & Tuitions

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/tutors` | Public | List/filter/search tutors |
| GET/POST/PUT/DELETE | `/api/tutors[/:id]` | Public / Bearer: admin | Tutor catalog CRUD |
| GET | `/api/tuitions` | Public | Approved/active tuitions |
| GET | `/api/tuitions/:id` | Public | Tuition details |
| POST | `/api/tuitions` | Bearer: tutor | Post a tuition (pending approval) |
| GET | `/api/tuitions/my-tuitions` | Bearer: tutor | Own posts |
| PATCH | `/api/tuitions/:id` | Bearer: tutor | Edit / change status |
| DELETE | `/api/tuitions/:id` | Bearer: tutor | Delete own post |
| GET | `/api/tuitions/admin/pending` | Bearer: admin | Moderation queue |
| PATCH | `/api/tuitions/admin/review/:id` | Bearer: admin | Approve / reject |

### Applications, Admin, Payments, Upload

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/applications/my-applications` | Bearer: student | Own applications |
| POST | `/api/applications` | Bearer: student | Apply (one per tuition) |
| GET | `/api/applications/tutor-applicants` | Bearer: tutor | Applicants for own tuitions |
| PATCH | `/api/applications/:id/status` | Bearer: tutor | Accept / reject |
| DELETE | `/api/applications/:id` | Bearer: student | Cancel pending application |
| GET/POST | `/api/bookmarks[/:tuitionId]` | Bearer: student | Saved tuitions (embedded in `users`) |
| DELETE | `/api/bookmarks/:tuitionId` | Bearer: student | Remove a saved tuition |
| GET | `/api/reviews/tuition/:tuitionId` | Public | Reviews for an approved/active tuition |
| POST | `/api/reviews` | Bearer: student | Review after an accepted application (embedded in `tuitions`) |
| GET | `/api/admin/users` | Bearer: admin | User list |
| PATCH | `/api/admin/users/:id/role` | Bearer: admin | Change role |
| GET | `/api/admin/tuitions` | Bearer: admin | All tuitions |
| GET | `/api/admin/stats` | Bearer: admin | Dashboard statistics |
| GET | `/api/admin/transactions` | Bearer: admin | Payment history |
| POST | `/api/payments/checkout` | Bearer | Create Stripe Checkout session |
| POST | `/api/payments/verify` | Bearer | Verify returned session, activate Pro |
| POST | `/api/payments/webhook` | Stripe sig | Signed webhook handler |
| POST | `/api/upload/image` | Bearer | ImgBB upload (`image` field, ≤5 MB) |

Unknown `/api/*` routes return a JSON `404`, never an HTML error page.

---

## 🚀 Deployment (Render)

1. Create a Web Service from this repo; build `npm install`, start `npm start`. `render.yaml` is included.
2. Add all environment variables above in the Render dashboard. Use the **live** `BETTER_AUTH_URL` and `CLIENT_URL` values.
3. Set the Google redirect URI listed above in Google Cloud Console.
4. Register the Stripe webhook `https://mentorlagbe-server-q3fr.onrender.com/api/payments/webhook` for `checkout.session.completed`, `invoice.paid` and `customer.subscription.deleted`; store its signing secret in `STRIPE_WEBHOOK_SECRET`.
5. **CORS:** `CLIENT_URL` must contain `https://mentorlagbe-client-weld.vercel.app`. Other origins receive `403` on preflight; requests without an `Origin` header (health checks) are allowed.
6. Verify: `curl https://mentorlagbe-server-q3fr.onrender.com/health` → `{"success":true,"status":"OK"}`.

> The Stripe webhook route is mounted **before** `express.json()` and uses `express.raw()` so signature verification sees the untouched body — do not reorder it.

---

## 📄 License

Private project — all rights reserved. Built with 💚 for the MentorLagbe assignment.
