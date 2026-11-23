import bcrypt from "bcryptjs";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { betterAuth } from "better-auth";
import { ObjectId } from "mongodb";
import { getClient, getDB } from "./db.js";
import { CLIENT_ORIGINS } from "./stripe.js";

export const BETTER_AUTH_BASE_PATH = "/api/better-auth";

/**
 * BetterAuth is optional at runtime so the legacy JWT API still boots when the
 * secret is absent. Deployment verification treats it as required.
 */
export function isBetterAuthConfigured() {
  return Boolean(process.env.BETTER_AUTH_SECRET);
}

/** Google OAuth is available only when both server-only keys and BetterAuth exist. */
export function isGoogleAuthConfigured() {
  return Boolean(
    isBetterAuthConfigured() &&
      String(process.env.GOOGLE_CLIENT_ID || "").trim() &&
      String(process.env.GOOGLE_CLIENT_SECRET || "").trim()
  );
}

function createSecondaryStorage() {
  const store = new Map();
  const timers = new Map();

  const clearTimer = (key) => {
    const timer = timers.get(key);

    if (timer) {
      clearTimeout(timer);
      timers.delete(key);
    }
  };

  return {
    get(key) {
      const entry = store.get(key);

      if (!entry) return null;

      if (entry.expiresAt && entry.expiresAt <= Date.now()) {
        store.delete(key);
        clearTimer(key);
        return null;
      }

      return entry.value;
    },
    set(key, value, ttlSeconds) {
      clearTimer(key);

      const ttl = ttlSeconds === undefined ? null : Number(ttlSeconds);

      // A non-positive TTL means the record has already expired. Keeping it
      // forever would leak sessions/verification tokens in this in-memory store.
      if (ttl !== null && (!Number.isFinite(ttl) || ttl <= 0)) {
        store.delete(key);
        return;
      }

      const expiresAt = ttl !== null ? Date.now() + ttl * 1000 : null;

      store.set(key, { value, expiresAt });

      if (expiresAt) {
        const timer = setTimeout(() => {
          store.delete(key);
          timers.delete(key);
        }, ttl * 1000);

        if (typeof timer.unref === "function") timer.unref();
        timers.set(key, timer);
      }
    },
    getAndDelete(key) {
      const value = this.get(key);
      store.delete(key);
      clearTimer(key);
      return value;
    },
    increment(key, ttlSeconds) {
      const existing = store.get(key);
      const next = Number(existing?.value || 0) + 1;

      // Fixed-window counters must keep the original expiry instead of
      // extending it on every increment.
      const remainingTtl =
        existing?.expiresAt && existing.expiresAt > Date.now()
          ? Math.max(1, Math.ceil((existing.expiresAt - Date.now()) / 1000))
          : ttlSeconds;

      this.set(key, String(next), remainingTtl);
      return next;
    },
    delete(key) {
      const existed = store.has(key);
      store.delete(key);
      clearTimer(key);
      return existed ? key : null;
    },
  };
}

const secondaryStorage = createSecondaryStorage();

/**
 * BetterAuth always builds a `user` and an `account` table. We map both to the
 * existing `users` collection, then keep credential accounts in memory so no
 * account documents are written into `users` and no fifth collection appears.
 * Sessions and verification records live in secondaryStorage for the same
 * reason. The MongoDB adapter still owns all real user reads/writes.
 */
const credentialAccounts = new Map();

const normalize = (value) => {
  if (value && typeof value.toHexString === "function") return value.toHexString();
  if (value instanceof Date) return value.getTime();
  return value;
};

const looseEqual = (actual, expected, mode) => {
  if (actual === undefined || actual === null) {
    return expected === undefined || expected === null;
  }

  const left = normalize(actual);
  const right = normalize(expected);

  if (mode === "insensitive" && typeof left === "string" && typeof right === "string") {
    return left.toLowerCase() === right.toLowerCase();
  }

  return left === right;
};

const matchesWhere = (record, where = []) => {
  if (!where.length) return true;

  let result = true;

  where.forEach((condition, index) => {
    const { field, value, operator = "eq", connector = "AND", mode } = condition;
    const actual = record[field];
    const expected = Array.isArray(value) ? value : [value];
    const insensitive = mode === "insensitive";
    let matched = false;

    switch (operator.toLowerCase()) {
      case "eq":
        matched = looseEqual(actual, value, insensitive ? "insensitive" : undefined);
        break;
      case "ne":
        matched = !looseEqual(actual, value, insensitive);
        break;
      case "in":
        matched = expected.some((item) => looseEqual(actual, item, insensitive));
        break;
      case "not_in":
        matched = !expected.some((item) => looseEqual(actual, item, insensitive));
        break;
      case "contains":
        matched = String(actual ?? "")
          .toLowerCase()
          .includes(String(value ?? "").toLowerCase());
        break;
      case "starts_with":
        matched = String(actual ?? "")
          .toLowerCase()
          .startsWith(String(value ?? "").toLowerCase());
        break;
      case "ends_with":
        matched = String(actual ?? "")
          .toLowerCase()
          .endsWith(String(value ?? "").toLowerCase());
        break;
      case "gt":
        matched = normalize(actual) > normalize(value);
        break;
      case "gte":
        matched = normalize(actual) >= normalize(value);
        break;
      case "lt":
        matched = normalize(actual) < normalize(value);
        break;
      case "lte":
        matched = normalize(actual) <= normalize(value);
        break;
      default:
        matched = looseEqual(actual, value, insensitive);
    }

    if (index === 0) result = matched;
    else if (connector.toUpperCase() === "OR") result = result || matched;
    else result = result && matched;
  });

  return result;
};

const selectFields = (record, select) => {
  if (!Array.isArray(select)) return record;

  return select.reduce((selected, field) => {
    if (field in record) selected[field] = record[field];
    return selected;
  }, {});
};

const userIdFromWhere = (where = []) => {
  const candidate = where.find(
    (item) => ["id", "userId", "accountId"].includes(item.field) && item.value
  );

  return candidate ? String(candidate.value) : null;
};

/**
 * Seeded users only have a bcrypt hash on `users.password`, so synthesize a
 * credential account the first time BetterAuth looks one up. This keeps the
 * documented demo credentials working without adding account documents.
 */
async function ensureSeededCredentialAccount(where) {
  const userId = userIdFromWhere(where);

  if (!userId || credentialAccountsForUser(userId).length) return;
  if (!ObjectId.isValid(userId)) return;

  const user = await getDB().collection("users").findOne(
    { _id: new ObjectId(userId) },
    { projection: { password: 1, createdAt: 1, updatedAt: 1 } }
  );

  if (!user?.password) return;

  credentialAccounts.set(userId, {
    id: userId,
    userId,
    accountId: userId,
    providerId: "credential",
    password: user.password,
    createdAt: user.createdAt || new Date(),
    updatedAt: user.updatedAt || new Date(),
  });
}

const credentialAccountsForUser = (userId) => {
  if (!userId) return [];

  const id = String(userId);

  return [...credentialAccounts.values()].filter(
    (item) => String(item.userId) === id
  );
};

/**
 * BetterAuth changes passwords through the in-memory account proxy. Mirror the
 * hash back to `users.password` so the legacy bcrypt login stays in sync.
 */
async function syncPasswordHash(userId, passwordHash) {
  if (!userId || !passwordHash || !ObjectId.isValid(String(userId))) return;

  await getDB()
    .collection("users")
    .updateOne(
      { _id: new ObjectId(String(userId)) },
      { $set: { password: String(passwordHash), updatedAt: new Date() } }
    );
}

function wrapMongoAdapter(adapterFactory) {
  return (options) => {
    const base = adapterFactory(options);

    /**
     * BetterAuth's `findAccountOwnerByKey` reads accounts with `join: { user: true }`
     * and classifies a missing user as an `orphaned` account (which aborts OAuth
     * with `unable_to_link_account`). Our account rows live in memory, so the
     * Mongo adapter's own join cannot see them. Resolve the joined user here.
     */
    const attachJoinedUsers = async (records, joinUser) => {
      if (!joinUser || !Array.isArray(records)) return records;

      return Promise.all(
        records.map(async (record) => {
          const user = record?.userId
            ? await base.findOne({
                model: "user",
                where: [{ field: "id", value: record.userId }],
              })
            : null;

          if (!user) return { ...record, user: null };

          const { account: _nestedAccount, ...safeUser } = user;
          return { ...record, user: safeUser };
        })
      );
    };

    const wrapped = {
      ...base,
      create: async (input) => {
        if (input.model !== "account") return base.create(input);

        const record = { ...input.data };
        record.id = record.id || new ObjectId().toString();
        credentialAccounts.set(String(record.id), record);
        return selectFields(record, input.select);
      },
      findOne: async (input) => {
        if (input.model === "account") {
          await ensureSeededCredentialAccount(input.where);
          const record = [...credentialAccounts.values()].find((item) =>
            matchesWhere(item, input.where)
          );

          if (!record) return null;

          const [withUser] = await attachJoinedUsers([record], input.join?.user);
          return selectFields(withUser, input.select);
        }

        const result = await base.findOne(input);

        // BetterAuth resolves `includeAccounts` joins through the adapter. The
        // Mongo adapter cannot see our in-memory credential accounts, so attach
        // them here after its normal transformation.
        if (result && input.join?.account) {
          await ensureSeededCredentialAccount([
            { field: "userId", value: result.id },
          ]);

          return {
            ...result,
            account: credentialAccountsForUser(result.id),
          };
        }

        return result;
      },
      findMany: async (input) => {
        if (input.model === "account") {
          let records = [...credentialAccounts.values()].filter((item) =>
            matchesWhere(item, input.where)
          );

          if (input.sortBy) {
            const direction = input.sortBy.direction === "desc" ? -1 : 1;
            records.sort((a, b) => {
              const left = normalize(a[input.sortBy.field]);
              const right = normalize(b[input.sortBy.field]);
              return left > right ? direction : left < right ? -direction : 0;
            });
          }

          if (input.offset) records = records.slice(input.offset);
          if (typeof input.limit === "number") records = records.slice(0, input.limit);

          const joined = await attachJoinedUsers(records, input.join?.user);
          return joined.map((record) => selectFields(record, input.select));
        }

        const results = await base.findMany(input);

        if (input.join?.account && Array.isArray(results)) {
          return Promise.all(
            results.map(async (item) => {
              await ensureSeededCredentialAccount([
                { field: "userId", value: item.id },
              ]);

              return {
                ...item,
                account: credentialAccountsForUser(item.id),
              };
            })
          );
        }

        return results;
      },
      count: (input) => {
        if (input.model !== "account") return base.count(input);

        return [...credentialAccounts.values()].filter((item) =>
          matchesWhere(item, input.where)
        ).length;
      },
      update: async (input) => {
        if (input.model !== "account") return base.update(input);

        const records = [...credentialAccounts.values()].filter((item) =>
          matchesWhere(item, input.where)
        );

        if (!records.length) return null;

        if (input.update?.password) {
          await Promise.all(
            records.map((item) =>
              syncPasswordHash(item.userId, input.update.password)
            )
          );
        }

        const record = records[0];
        Object.assign(record, input.update);
        credentialAccounts.set(String(record.id), record);
        return selectFields(record, input.select);
      },
      updateMany: async (input) => {
        if (input.model !== "account") return base.updateMany(input);

        const records = [...credentialAccounts.values()].filter((item) =>
          matchesWhere(item, input.where)
        );

        if (input.update?.password) {
          await Promise.all(
            records.map((item) =>
              syncPasswordHash(item.userId, input.update.password)
            )
          );
        }

        records.forEach((record) => {
          Object.assign(record, input.update);
          credentialAccounts.set(String(record.id), record);
        });

        return records.length;
      },
      delete: async (input) => {
        if (input.model !== "account") return base.delete(input);

        const record = [...credentialAccounts.values()].find((item) =>
          matchesWhere(item, input.where)
        );

        if (record) credentialAccounts.delete(String(record.id));
      },
      deleteMany: async (input) => {
        if (input.model !== "account") return base.deleteMany(input);

        const records = [...credentialAccounts.values()].filter((item) =>
          matchesWhere(item, input.where)
        );

        records.forEach((record) => credentialAccounts.delete(String(record.id)));
        return records.length;
      },
    };

    // Keep account operations inside BetterAuth transactions on the wrapped
    // adapter; otherwise they would bypass the in-memory proxy.
    wrapped.transaction = async (callback) => callback(wrapped);

    return wrapped;
  };
}

let authPromise = null;

export async function getAuth() {
  if (!isBetterAuthConfigured()) {
    throw new Error("BETTER_AUTH_SECRET is missing from .env file");
  }

  if (!authPromise) {
    authPromise = (async () => {
      const baseAdapter = mongodbAdapter(getClient().db(getDB().databaseName), {
        client: getClient(),
        transaction: false,
      });

      const configuredBaseUrl =
        process.env.BETTER_AUTH_URL ||
        `http://localhost:${process.env.PORT || 5000}`;

      let baseURL;

      try {
        baseURL = new URL(configuredBaseUrl).origin;
      } catch {
        baseURL = `http://localhost:${process.env.PORT || 5000}`;
      }

      return betterAuth({
        secret: process.env.BETTER_AUTH_SECRET,
        baseURL,
        basePath: BETTER_AUTH_BASE_PATH,
        // Google's callbackURL points at this API origin, so BetterAuth must
        // trust it in addition to the browser client origins.
        trustedOrigins: [...new Set([...CLIENT_ORIGINS, baseURL])],
        database: wrapMongoAdapter(baseAdapter),
        secondaryStorage,
        // Internal auth.api calls carry no request headers; a shared rate
        // limit bucket could otherwise return 429 during login/register.
        rateLimit: { enabled: false },
        // Use the Mongo adapter's ObjectId generator so BetterAuth can still
        // find users whose `_id` was migrated to ObjectId by the legacy flow.
        ...(isGoogleAuthConfigured()
          ? {
              socialProviders: {
                google: {
                  clientId: String(process.env.GOOGLE_CLIENT_ID).trim(),
                  clientSecret: String(process.env.GOOGLE_CLIENT_SECRET).trim(),
                },
              },
            }
          : {}),
        user: {
          modelName: "users",
          additionalFields: {
            // Never accept role/plan from the public BetterAuth sign-up route;
            // the legacy controller assigns them after a successful sign-up.
            role: { type: "string", required: false, input: false },
            plan: {
              type: "string",
              required: false,
              input: false,
              defaultValue: "free",
            },
            profileImage: { type: "string", required: false },
            phone: { type: "string", required: false },
            bio: { type: "string", required: false },
            location: { type: "string", required: false },
          },
        },
        account: {
          // Both logical tables resolve to `users`; account rows are kept in
          // memory by the wrapper above, so the collection stays clean.
          modelName: "users",
          // Keep the OAuth state in an encrypted cookie instead of secondary
          // storage. Google login can take minutes (password + consent), and an
          // in-memory state can vanish on a Render restart or a second instance,
          // which surfaces as a generic "unexpected" sign-in failure.
          storeStateStrategy: "cookie",
          // Legacy users were created without `emailVerified`, so the default
          // `requireLocalEmailVerified: true` blocks linking a Google account
          // that reuses an existing email (`account_not_linked`). Google already
          // verifies email ownership, and role/plan remain DB-controlled via
          // `input: false` above, so implicit linking is safe here.
          accountLinking: {
            enabled: true,
            disableImplicitLinking: false,
            requireLocalEmailVerified: false,
            trustedProviders: ["google"],
          },
        },
        emailAndPassword: {
          enabled: true,
          minPasswordLength: 8,
          maxPasswordLength: 128,
          password: {
            hash: (password) => bcrypt.hash(password, 12),
            verify: ({ hash, password }) => bcrypt.compare(password, hash),
          },
        },
      });
    })().catch((error) => {
      authPromise = null;
      throw error;
    });
  }

  return authPromise;
}
