# Deployment Checklist — MentorLagbe Server

Node/Express + MongoDB API. Deploy to Render, Railway, or any Node host.

## Host setup

- Build: `npm install`. Start: `npm start` (`node index.js`). Node **>= 20.19.0**.
- `PORT` is injected by the host; the app falls back to `5000`.
- Set the environment variables below. They are **not** all equally critical: only two are required to boot, while the rest are optional or enable a specific feature.

### Required to boot

| Variable | Example | What happens if missing |
| --- | --- | --- |
| `MONGODB_URI` | `mongodb+srv://<user>:<pass>@<cluster>/<db>` | Boot-blocking: `config/db.js` throws at import. Set the production Atlas connection string. |
| `JWT_SECRET` | `<long-random-secret>` | Boot-blocking: `index.js` throws and the server exits at startup. Generate a long random value. |

### Optional / feature-specific

| Variable | Default if unset | What happens if missing |
| --- | --- | --- |
| `PORT` | `5000` | No action needed — let the host inject it. |
| `JWT_EXPIRES_IN` | `7d` | Tokens use a 7-day lifetime; no startup impact. |
| `CLIENT_URL` | `http://localhost:3000` | Server still boots, but CORS and Stripe redirects point at localhost — **set this in production**. May be comma-separated for CORS, but **Stripe redirects use only the first origin**; put the production client origin first. |
| `STRIPE_SECRET_KEY` | — | Checkout/payment endpoints return `503` ("Stripe is not configured"). Needed only for Pro-plan payments. |
| `STRIPE_WEBHOOK_SECRET` | — | `POST /api/payments/webhook` returns `503` ("Stripe webhook is not configured"). Set it together with `STRIPE_SECRET_KEY`. |
| `IMGBB_API_KEY` | — | `/api/upload/image` returns `503` ("ImgBB is not configured"). Needed only for image uploads. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | `admin@mentorlagbe.com`, `Admin@12345`, `MentorLagbe Admin` | Not needed to boot. `npm run seed` falls back to these documented demo defaults; **`npm run seed:admin` requires `ADMIN_EMAIL` and `ADMIN_PASSWORD`** in `.env`/host env and fails if either is absent (`ADMIN_NAME` remains optional there). |

- Seeding is idempotent (`$setOnInsert`): it does **not** overwrite existing accounts. Changing `ADMIN_PASSWORD` and re-running a seed therefore does **not** rotate the existing admin's password — update it through the app or database instead.
- Run `npm run seed` **once** after the database and env vars are ready. Optional: `npm run seed:tutors` links public tutor profiles to demo accounts.

## Endpoints to verify

- `GET /health` → `200 {"success":true,"status":"OK"}` (returns `503` if MongoDB is unavailable).
- `GET /` → API running message.
- Unknown `/api/*` → JSON `404`.
- Stripe webhook: `POST /api/payments/webhook` (raw body, signature verified). Register this URL in Stripe and subscribe to `checkout.session.completed` / `checkout.session.async_payment_succeeded`.
- Stripe checkout success URL: `<CLIENT_URL>/payment/success?session_id={CHECKOUT_SESSION_ID}`.

## Common checks

- No CORS error from the deployed client origin.
- Expired/invalid JWT returns `401`; the client clears state and redirects.
- Pro plan activation survives both webhook and success-page verification (idempotent).
- Upload endpoint rejects non-images early and returns `504` if ImgBB times out.
- Keep `.env` out of git; use placeholders in `.env.example`.
