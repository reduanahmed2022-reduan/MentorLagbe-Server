# 15-Minute Deployment Runbook — MentorLagbe Server (বাংলা + English)

`BASE` = `http://localhost:5000` (local) or `https://<api-host>` (live). DB name: `MantorLagbe`. Node **>= 20.19.0**, Express 5.
PowerShell-এ `curl` হলো `Invoke-WebRequest`-এর alias — নিচের curl কমান্ডগুলোতে `curl.exe` ব্যবহার করুন।

| Minute | কাজ / Task |
| --- | --- |
| 0–2 | Env vars সেট করুন |
| 2–4 | `npm install` + `npm start` |
| 4–6 | `npm run seed` (একবারই) |
| 6–8 | `/health` চেক |
| 8–10 | Login চেক |
| 10–12 | Endpoints smoke-test |
| 12–14 | Stripe webhook |
| 14–15 | Client CORS |

---

## 0–2 min — Environment variables / env ভেরিয়েবল

```bash
copy .env.example .env      # Windows
# cp .env.example .env      # macOS/Linux
```

`.env`-এ কেবল placeholder দিন — **real secret commit/inbox করবেন না**।

**Required (boot-blocking — থাকলেই শুধু সার্ভার উঠবে):**

```env
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/?retryWrites=true&w=majority
JWT_SECRET=<long-random-secret>
```

**Preflight-required (`node scripts/verify-env.mjs`):**

```env
BETTER_AUTH_SECRET=<long-random-secret>
BETTER_AUTH_URL=https://<api-host>
```

`BETTER_AUTH_URL` হলো **API origin** (client origin নয়) — client endpoint বানায় `${NEXT_PUBLIC_API_URL}/better-auth`। দুটি `BETTER_AUTH_*` ভ্যারিয়েবল preflight-এ বাধ্যতামূলক; সার্ভার-সাইডেই রাখতে হবে, Vercel/client-এ নয়।

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

| Var | না দিলে |
| --- | --- |
| `MONGODB_URI` | `config/db.js` import-এই throw → process exit |
| `JWT_SECRET` | `index.js` Start-এ throw → process exit |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | `scripts/verify-env.mjs` preflight_fail; শুধু `BETTER_AUTH_SECRET` না দিলে `/api/better-auth` বন্ধ থাকে, `BETTER_AUTH_URL` না দিলে local API origin ব্যবহার হয়; legacy JWT API চলে |

**Optional / feature-specific (সার্ভার উঠবে, ফিচারের উপর নির্ভর করে 503):**

| Var | Default | Effect |
| --- | --- | --- |
| `PORT` | `5000` | Host inject করুক; কিছু করতে হবে না |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `CLIENT_URL` | `http://localhost:3000` | CORS + Stripe redirect; production-এ অবশ্যই সেট করুন |
| `STRIPE_SECRET_KEY` | — | `/api/payments/checkout`, `/verify` → 503 |
| `STRIPE_WEBHOOK_SECRET` | — | `POST /api/payments/webhook` → 503 |
| `IMGBB_API_KEY` | — | `POST /api/upload/image` → 503 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | — | Google sign-in বন্ধ; `/api/auth/google/status` → `enabled:false`. শুধু server-এ রাখুন, Vercel/client-এ নয় |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | `admin@mentorlagbe.com`, `Admin@12345`, `MentorLagbe Admin` | শুধু seed-এর জন্য (`seed:admin`-এ EMAIL+PASSWORD বাধ্যতামূলক) |

`CLIENT_URL` comma-separated হতে পারে (CORS), কিন্তু **Stripe redirect শুধু প্রথম origin ব্যবহার করে** — প্রধান client-কে প্রথমে রাখুন।

Google sign-in চালু করতে দুইটি Google key server `.env`-এ দিন এবং Google Console-এ authorized redirect URI হিসেবে `${BETTER_AUTH_URL}/api/better-auth/callback/google` যোগ করুন। Client-এ কোনো Google secret দিতে হবে না; button-এর availability `/api/auth/google/status` থেকে আসে।

---

## 2–4 min — Install + start

```bash
node --version     # v20.19.0+
npm install
npm start          # node index.js — চলতে দিন
```

`npm run dev` (= `node --watch index.js`) শুধু local development-এর জন্য; production-এ `npm start`। Log-এ আসবে `MongoDB connected successfully!` এবং `MentorLagbe server running on port 5000`।

---

## 4–6 min — Seed **একবারই**

```bash
npm run seed
# optional: npm run seed:tutors   (public tutor directory + demo account link)
```

Idempotent (`$setOnInsert`): আগে থাকা user/data overwrite হয় না। **`npm run seed` বারবার চালাবেন না**; কোনো admin password বদলে re-seed করলে পুরনো password rotate হয় না — app/DB তে বদলান।

Demo credentials (documented defaults):

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@mentorlagbe.com` | `Admin@12345` |
| Tutor (৬ জন) | `sarah@mentorlagbe.com`, `rahim@…`, `nusrat@…`, `sabbir@…`, `ayesha@…`, `tanvir@…` | `Tutor@12345` |
| Student (২ জন) | `student1@mentorlagbe.com`, `student2@mentorlagbe.com` | `Tutor@12345` |

Production-এ `ADMIN_PASSWORD` বদলান; `Admin@12345` শুধু demo default।

---

## 6–8 min — Health

```bash
curl -s %BASE%/health
curl -s %BASE%/
curl -s %BASE%/api/does-not-exist
```

Expected:
- `/health` → `200 {"success":true,"status":"OK"}`
- `/` → `200 {"success":true,"message":"MentorLagbe API is running successfully!"}`
- unknown `/api/*` → JSON `404 {"success":false,"message":"API route not found: GET /api/does-not-exist"}`

`%BASE%` → নিজের host দিয়ে বদলান (local: `http://localhost:5000`)।

---

## 8–10 min — Login checks

```bash
curl -s -X POST %BASE%/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@mentorlagbe.com","password":"Admin@12345"}'
```

Expected: `200` + `{"success":true,"message":"Login successful","token":"...","user":{...}}` — role `admin`।

```bash
set TOKEN=<paste-token-here>                      # PowerShell: $TOKEN="<token>"
curl -s %BASE%/api/auth/me -H "Authorization: Bearer %TOKEN%"
curl -s %BASE%/api/admin/stats -H "Authorization: Bearer %TOKEN%"
```

 Tutor/student-এর সাথে একইভাবে `sarah@mentorlagbe.com / Tutor@12345` ও `student1@mentorlagbe.com / Tutor@12345` দিয়ে `/api/auth/login` চেক করুন। Role-ভুল হলে `401`/`403`।

---

## 10–12 min — Endpoints (কোডের আসল routes)

Public:

```bash
curl -s %BASE%/api/tutors
curl -s %BASE%/api/tuitions
curl -s %BASE%/api/tutors/<tutorId>
curl -s %BASE%/api/tuitions/<tuitionId>
```

Bearer (admin token দিয়ে):

```bash
curl -s %BASE%/api/admin/users -H "Authorization: Bearer %TOKEN%"
curl -s %BASE%/api/admin/transactions -H "Authorization: Bearer %TOKEN%"
curl -s %BASE%/api/tuitions/admin/pending -H "Authorization: Bearer %TOKEN%"
curl -s %BASE%/api/admin/tuitions -H "Authorization: Bearer %TOKEN%"
```

Role-specific / feature:

- Student token: `GET /api/applications/my-applications`, `POST /api/applications`, `DELETE /api/applications/:id`
- Tutor token: `GET /api/tuitions/my-tuitions`, `GET /api/applications/tutor-applicants`, `PATCH /api/tuitions/:id/status`
- Admin token: `PATCH /api/admin/users/:id/role`, `PATCH /api/tuitions/admin/review/:id`
- Any token: `GET /api/auth/me`, `PUT /api/auth/me`
- Upload: `POST /api/upload/image` (multipart, field `image`, JPG/PNG/GIF/WEBP, max 5 MB)
- Payments: `POST /api/payments/checkout`, `POST /api/payments/verify` (`{"sessionId":"..."}`)

---

## 12–14 min — Stripe webhook

1. Stripe Dashboard → Developers → Webhooks → Add endpoint:
   `https://<api-host>/api/payments/webhook`
   Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`
2. Signing secret (`whsec_…`) → `STRIPE_WEBHOOK_SECRET` → **restart** (`npm start`)।
3. Verify: stripe CLI দিলে `stripe listen --forward-to localhost:5000/api/payments/webhook` + `stripe trigger checkout.session.completed` → server log `Stripe subscription sync: …`, response `200 {"received":true}`।

- Raw body বাধ্যতামূলক: `webhookRoutes` `/api/payments`-এ `express.json()`-এর **আগে** mount করা আছে — সরাবেন না।
- Redirect URLs (কোড থেকে): `<CLIENT_URL>/payment/success?session_id={CHECKOUT_SESSION_ID}` এবং `<CLIENT_URL>/payment/cancel`। Pro prices: tutor `1500`, student `1000` (USD cents)।

---

## 14–15 min — Client CORS

```env
CLIENT_URL=https://app.example.com,https://admin.example.com
```

Exact scheme + host + port, trailing slash/path ছাড়া। Change করার পর **restart** করুন।

Browser DevTools → Network/Console: client origin থেকে `/api/tutors`, `/api/auth/login` কল করে error না দেখলে চলবে। Origin-বিহীন request (health/server-to-server) allowed।

---

## Troubleshooting / সমস্যা হলে

| Symptom | কারণ | করণীয় |
| --- | --- | --- |
| `503` on `/health` → `DATABASE_UNAVAILABLE` | MongoDB unreachable | `MONGODB_URI` চেক; Atlas Network Access-এ host IP whitelist; cluster/credentials চেক |
| Boot fail: `MONGODB_URI is missing…` / `JWT_SECRET is missing…` | Required var নেই | §0–2, তারপর restart |
| `503` `Stripe is not configured. Please set STRIPE_SECRET_KEY.` | Stripe key নেই | `STRIPE_SECRET_KEY` সেট + restart |
| `503` `Stripe webhook is not configured` | Webhook secret নেই | `STRIPE_WEBHOOK_SECRET` সেট + restart |
| Webhook `400` `Missing/Invalid webhook signature` | Signature নেই / body proxy-তে বদলেছে | Signed event পাঠান; raw body route অক্ষত রাখুন; secret ম্যাচ করুন |
| `503` `ImgBB is not configured. Please set IMGBB_API_KEY.` | ImgBB key নেই | `IMGBB_API_KEY` সেট + restart |
| `504` `Image host did not respond in time` (/api/upload/image) | ImgBB 15 s timeout | Retry; ImgBB status/network চেক। `502` = host rejected; `400` = ভুল format বা >5 MB |
| `403` `Origin not allowed by CORS` | Origin `CLIENT_URL`-এ নেই | Exact origin যোগ করুন + restart (Stripe-এ শুধু প্রথম origin) |
| JSON `404` `API route not found: …` | ভুল path/method — e.g. `/api/tuition` (সঠিক `/api/tuitions`) | README-এর route list ম্যাচ করুন; `/health` `/api`-র বাইরে |
| `401` | Token নেই/expired | আবার login করে নতুন `token` নিন; `JWT_EXPIRES_IN` চেক |
| `500` `Something went wrong on the server` | Unexpected error | Server log-এ `Request Error:` দেখুন |

`.env` কখনো git-এ দিবেন না — host-এর secret store ব্যবহার করুন। বিস্তারিত: `README.md`, `DEPLOYMENT.md`।
