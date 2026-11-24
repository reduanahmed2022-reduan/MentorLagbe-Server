/**
 * One-time data cleanup: rename duplicate tuition titles so every card is
 * unique and duplicates use a different subject. Keeps the oldest copy,
 * renames later copies, and syncs snapshot fields on applications/bookmarks.
 *
 * Usage (from the server directory):
 *   npm run fix:duplicates
 */
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is missing from .env");

const DB_NAME = "MantorLagbe";

// Known public duplicates -> a distinct title and subject. Subjects must be in
// the client's SUBJECTS list so the filter dropdown keeps working.
const RENAMES = {
  "English Conversation Club": {
    title: "IELTS Speaking Workshop",
    subject: "IELTS",
  },
};

const ALTERNATE_SUBJECTS = [
  "IELTS",
  "Language",
  "Music",
  "Coding",
  "Biology",
  "Chemistry",
  "Physics",
];

const clientOptions = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  serverSelectionTimeoutMS: 20000,
};

if (/(mongodb\+srv:\/\/|\.mongodb\.net)/i.test(uri)) {
  clientOptions.tls = true;
}

const client = new MongoClient(uri, clientOptions);

try {
  await client.connect();
  const db = client.db(DB_NAME);
  const tuitions = db.collection("tuitions");

  const all = await tuitions
    .find({}, { projection: { title: 1, subject: 1, createdAt: 1 } })
    .toArray();

  const usedTitles = new Set(all.map((tuition) => tuition.title));
  const seen = new Map();
  const changes = [];

  for (const tuition of [...all].sort(
    (a, b) => (a.createdAt?.getTime?.() || 0) - (b.createdAt?.getTime?.() || 0)
  )) {
    if (seen.has(tuition.title)) {
      const subject =
        RENAMES[tuition.title]?.subject ||
        ALTERNATE_SUBJECTS.find((item) => item !== tuition.subject) ||
        "English";

      let title = RENAMES[tuition.title]?.title || `${tuition.title} (${subject} track)`;
      let suffix = 2;
      while (usedTitles.has(title)) {
        title = `${RENAMES[tuition.title]?.title || tuition.title} (${subject} track ${suffix++})`;
      }
      usedTitles.add(title);

      changes.push({ tuition, title, subject });
    } else {
      seen.set(tuition.title, tuition);
    }
  }

  if (!changes.length) {
    console.log("No duplicate tuition titles found. Nothing to change.");
  }

  for (const { tuition, title, subject } of changes) {
    const tuitionId = tuition._id.toString();

    await tuitions.updateOne(
      { _id: tuition._id },
      { $set: { title, subject, updatedAt: new Date() } }
    );

    await db.collection("applications").updateMany(
      { tuitionId },
      { $set: { tuitionTitle: title, subject } }
    );

    await db.collection("users").updateMany(
      { "bookmarks.tuitionId": tuitionId },
      {
        $set: {
          "bookmarks.$[bookmark].tuitionTitle": title,
          "bookmarks.$[bookmark].subject": subject,
        },
      },
      { arrayFilters: [{ "bookmark.tuitionId": tuitionId }] }
    );

    console.log(`Renamed duplicate "${tuition.title}" -> "${title}" (${subject})`);
  }
} finally {
  await client.close();
}
