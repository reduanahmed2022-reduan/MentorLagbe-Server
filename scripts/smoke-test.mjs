#!/usr/bin/env node
/**
 * MentorLagbe API smoke test (dependency-free, Node 20+).
 * Usage: node scripts/smoke-test.mjs
 *   BASE_URL=https://host ADMIN_EMAIL=... ADMIN_PASSWORD=... DEMO_EMAIL=... DEMO_PASSWORD=... node scripts/smoke-test.mjs
 * Optional: BASE_URL (default http://localhost:5000), ADMIN_*, DEMO_* (aliases: STUDENT_*).
 * Defaults are documented seed demo values; tokens and response bodies are never printed.
 */

const BASE_URL = (process.env.BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@mentorlagbe.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@12345";
const DEMO_EMAIL =
  process.env.DEMO_EMAIL || process.env.STUDENT_EMAIL || "student1@mentorlagbe.com";
const DEMO_PASSWORD =
  process.env.DEMO_PASSWORD || process.env.STUDENT_PASSWORD || "Tutor@12345";

const TIMEOUT_MS = 10_000;

async function api(method, path, body) {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "manual",
      cache: "no-store",
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      // Non-JSON or empty body; validators report the invalid payload.
    }

    return { status: response.status, data };
  } catch {
    // Never echo the error: it can contain a credential-bearing BASE_URL.
    return { status: 0, data: null, networkError: true };
  }
}

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const totalText = (data) => (Number.isFinite(data.total) ? String(data.total) : "?");

function healthCheck(result) {
  const d = result.data;
  const ok =
    result.status === 200 && isObject(d) && d.success === true && d.status === "OK";
  return {
    passed: ok,
    detail: ok
      ? "status=OK"
      : `payloadStatus=${isObject(d) ? String(d.status ?? "missing") : "non-JSON"}`,
  };
}

function loginCheck(expectedRole) {
  return (result) => {
    const d = result.data;
    if (result.status !== 200 || !isObject(d) || d.success !== true) {
      return { passed: false, detail: "login unsuccessful" };
    }
    if (typeof d.token !== "string" || d.token.trim() === "") {
      return { passed: false, detail: "token missing" };
    }
    const role = isObject(d.user) ? d.user.role : undefined;
    if (role !== expectedRole) {
      return { passed: false, detail: `role=${typeof role === "string" ? role : "missing"}` };
    }
    return { passed: true, detail: `role=${role}` };
  };
}

function listCheck({ key, max, label }) {
  return (result) => {
    const d = result.data;
    if (
      result.status !== 200 ||
      !isObject(d) ||
      d.success !== true ||
      !Array.isArray(d[key])
    ) {
      return { passed: false, detail: "invalid list payload" };
    }
    const count = d[key].length;
    return {
      passed: count > 0 && count <= max,
      detail: `${label} count=${count}, total=${totalText(d)}`,
    };
  };
}

function subjectCheck(result) {
  const d = result.data;
  if (
    result.status !== 200 ||
    !isObject(d) ||
    d.success !== true ||
    !Array.isArray(d.tutors)
  ) {
    return { passed: false, detail: "invalid tutor payload" };
  }
  const tutors = d.tutors;
  const allIct = tutors.every(
    (tutor) => String(isObject(tutor) ? tutor.subject : "").toLowerCase() === "ict"
  );
  return {
    passed: tutors.length > 0 && allIct,
    detail: `count=${tutors.length}, total=${totalText(d)}, subject=ICT${allIct ? "" : " (mismatch)"}`,
  };
}

function searchCheck(result) {
  const d = result.data;
  if (
    result.status !== 200 ||
    !isObject(d) ||
    d.success !== true ||
    !Array.isArray(d.tutors)
  ) {
    return { passed: false, detail: "invalid tutor payload" };
  }
  const tutors = d.tutors;
  const matched = tutors.some((tutor) =>
    /nusrat/i.test(String(isObject(tutor) ? tutor.name : ""))
  );
  return {
    passed: tutors.length > 0 && matched,
    detail: `count=${tutors.length}, total=${totalText(d)}, match=${matched ? "yes" : "no"}`,
  };
}

async function runCheck(name, request, validate) {
  const result = await request();
  let passed = false;
  let detail = "invalid result";

  if (result.networkError) {
    detail = "network/timeout error";
  } else {
    try {
      const outcome = validate(result);
      passed = Boolean(outcome.passed);
      detail = String(outcome.detail || "");
    } catch {
      detail = "validation error";
    }
  }

  const status = result.networkError ? "ERR" : String(result.status);
  console.log(`${passed ? "PASS" : "FAIL"} ${name} [${status}] ${detail}`.trimEnd());
  return passed;
}

const results = [];

results.push(
  await runCheck("GET /health", () => api("GET", "/health"), healthCheck)
);
results.push(
  await runCheck(
    "POST /api/auth/login (admin)",
    () =>
      api("POST", "/api/auth/login", {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      }),
    loginCheck("admin")
  )
);
results.push(
  await runCheck(
    "POST /api/auth/login (student)",
    () =>
      api("POST", "/api/auth/login", {
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      }),
    loginCheck("student")
  )
);
results.push(
  await runCheck(
    "GET /api/tutors?limit=6",
    () => api("GET", "/api/tutors?limit=6"),
    listCheck({ key: "tutors", max: 6, label: "tutors" })
  )
);
results.push(
  await runCheck(
    "GET /api/tutors?subject=ICT",
    () => api("GET", "/api/tutors?subject=ICT"),
    subjectCheck
  )
);
results.push(
  await runCheck(
    "GET /api/tutors?search=Nusrat",
    () => api("GET", "/api/tutors?search=Nusrat"),
    searchCheck
  )
);
results.push(
  await runCheck(
    "GET /api/tuitions?limit=6",
    () => api("GET", "/api/tuitions?limit=6"),
    listCheck({ key: "tuitions", max: 6, label: "tuitions" })
  )
);

const passedCount = results.filter(Boolean).length;
console.log(`${passedCount}/${results.length} checks passed.`);
process.exit(passedCount === results.length ? 0 : 1);
