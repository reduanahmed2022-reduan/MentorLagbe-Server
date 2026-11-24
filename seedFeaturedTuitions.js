import dotenv from "dotenv";
import { connectDB, closeDB, getDB } from "./config/db.js";

dotenv.config();

// Budget-friendly approved batches for the homepage "Latest approved batches
// for you" section. Fees stay inside the $500-$800 range shown there.
const tutors = {
  "sarah@mentorlagbe.com": "Sarah Ahmed",
  "rahim@mentorlagbe.com": "Rahim Hasan",
  "nusrat@mentorlagbe.com": "Nusrat Jahan",
  "sabbir@mentorlagbe.com": "Sabbir Hossain",
  "ayesha@mentorlagbe.com": "Ayesha Rahman",
  "tanvir@mentorlagbe.com": "Tanvir Ahmed",
};

const image = (id) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;

const batches = [
  ["Primary Mathematics Basics", "Mathematics", "Class 5", "Online", "Dhaka", 500, 2, "photo-1509062522246-3755977927d7", "Friendly foundational math classes with plenty of guided practice.", "sarah@mentorlagbe.com"],
  ["English Conversation Club", "English", "SSC", "Online", "Online", 550, 2, "photo-1513258496099-48168024aec0", "Build everyday speaking confidence through interactive conversation drills.", "sarah@mentorlagbe.com"],
  ["Junior Physics Made Easy", "Physics", "Class 9", "Offline", "Sylhet", 600, 3, "photo-1636466497217-26a8cbeaf0aa", "Core physics concepts explained with simple examples and homework support.", "nusrat@mentorlagbe.com"],
  ["Creative Coding for Kids", "ICT", "Class 8", "Online", "Online", 650, 2, "photo-1526379095098-d400fd0bf935", "A playful introduction to programming through small projects and puzzles.", "sabbir@mentorlagbe.com"],
  ["Biology Basics for Beginners", "Biology", "Class 10", "Offline", "Rajshahi", 700, 3, "photo-1530026405186-ed1f139313f8", "Chapter-wise biology foundations with diagrams and quick revision notes.", "ayesha@mentorlagbe.com"],
  ["Chemistry Quick Revision", "Chemistry", "HSC", "Online", "Online", 780, 3, "photo-1554475901-4538ddfbccc2", "Fast, focused HSC chemistry revision with reaction mechanisms and past questions.", "tanvir@mentorlagbe.com"],
  ["Advanced Mathematics Practice", "Mathematics", "Class 11", "Online", "Dhaka", 750, 3, "photo-1635070041078-e363dbe005cb", "Exam-focused mathematics practice with step-by-step problem solving.", "sarah@mentorlagbe.com"],
  ["English Writing Masterclass", "English", "HSC", "Online", "Online", 800, 2, "photo-1503676260728-1c00da094a0b", "Upgrade essays, letters and composition writing with guided feedback.", "sarah@mentorlagbe.com"],
];

// Repair banners on existing listings: one URL was a dead Unsplash photo and
// another listing had no banner at all. Re-running this seed keeps both fixed.
const bannerFixes = [
  ["Chemistry Quick Revision", "tanvir@mentorlagbe.com", "photo-1554475901-4538ddfbccc2"],
  ["Mathematics Tutor Needed for Class 10", "tutor1@example.com", "photo-1635070041078-e363dbe005cb"],
];

// Bring three popular mathematics listings into the $500-$800 budget range.
const feeFixes = [
  ["Algebra Mastery for HSC", "sarah@mentorlagbe.com", 750],
  ["Mathematics Tutor Needed for Class 10", "tutor1@example.com", 500],
  ["Calculus Foundations", "sarah@mentorlagbe.com", 800],
];

// These three are the ones requested by name, so let them lead the homepage
// section. Staggering createdAt keeps the API's existing newest-first order.
const priorityTitles = [
  ["Algebra Mastery for HSC", "sarah@mentorlagbe.com"],
  ["Mathematics Tutor Needed for Class 10", "tutor1@example.com"],
  ["Calculus Foundations", "sarah@mentorlagbe.com"],
];

// Rewrite the two initially Biology-labelled budget batches to the subjects the
// section actually needs. Matching on the old title keeps this idempotent.
const subjectFixes = [
  {
    match: { title: "Cell Biology Essentials", tutorEmail: "ayesha@mentorlagbe.com" },
    set: {
      title: "Advanced Mathematics Practice",
      subject: "Mathematics",
      classLevel: "Class 11",
      mode: "Online",
      location: "Dhaka",
      monthlyFee: 750,
      daysPerWeek: 3,
      bannerImage: image("photo-1635070041078-e363dbe005cb"),
      description: "Exam-focused mathematics practice with step-by-step problem solving.",
      tutorName: "Sarah Ahmed",
      tutorEmail: "sarah@mentorlagbe.com",
    },
  },
  {
    match: { title: "Human Physiology Crash Course", tutorEmail: "ayesha@mentorlagbe.com" },
    set: {
      title: "English Writing Masterclass",
      subject: "English",
      classLevel: "HSC",
      mode: "Online",
      location: "Online",
      monthlyFee: 800,
      daysPerWeek: 2,
      bannerImage: image("photo-1503676260728-1c00da094a0b"),
      description: "Upgrade essays, letters and composition writing with guided feedback.",
      tutorName: "Sarah Ahmed",
      tutorEmail: "sarah@mentorlagbe.com",
    },
  },
];

async function seedFeaturedTuitions() {
  await connectDB();

  try {
    const tuitions = getDB().collection("tuitions");
    const now = Date.now();
    let inserted = 0;

    for (const [
      title,
      subject,
      classLevel,
      mode,
      location,
      monthlyFee,
      daysPerWeek,
      photoId,
      description,
      tutorEmail,
    ] of batches) {
      const result = await tuitions.updateOne(
        { title, tutorEmail },
        {
          $set: { approvalStatus: "approved", isActive: true },
          $setOnInsert: {
            title,
            subject,
            classLevel,
            mode,
            location,
            monthlyFee,
            daysPerWeek,
            bannerImage: image(photoId),
            description,
            tutorName: tutors[tutorEmail],
            tutorEmail,
            createdAt: new Date(now - inserted * 3600000),
          },
        },
        { upsert: true }
      );

      if (result.upsertedCount) inserted += 1;
    }

    for (const [title, tutorEmail, photoId] of bannerFixes) {
      await tuitions.updateOne(
        { title, tutorEmail },
        { $set: { bannerImage: image(photoId) } }
      );
    }

    for (const { match, set } of subjectFixes) {
      await tuitions.updateOne(match, { $set: set });
    }

    for (const [title, tutorEmail, monthlyFee] of feeFixes) {
      await tuitions.updateOne(
        { title, tutorEmail },
        { $set: { monthlyFee, approvalStatus: "approved", isActive: true } }
      );
    }

    for (const [index, [title, tutorEmail]] of priorityTitles.entries()) {
      await tuitions.updateOne(
        { title, tutorEmail, isActive: true },
        { $set: { createdAt: new Date(now - index * 1000) } }
      );
    }

    // If the script was run before and after a subject rename, two documents can
    // share the same title. Keep the oldest live and archive the extras (never
    // delete data) so the public listing stays at one row per batch.
    for (const title of ["Advanced Mathematics Practice", "English Writing Masterclass"]) {
      const matches = await tuitions.find({ title }).sort({ createdAt: 1 }).toArray();
      for (const duplicate of matches.slice(1)) {
        await tuitions.updateOne(
          { _id: duplicate._id },
          { $set: { title: `${title} (archived duplicate)`, isActive: false } }
        );
      }
    }

    const total = await tuitions.countDocuments({
      approvalStatus: "approved",
      isActive: true,
      monthlyFee: { $gte: 500, $lte: 800 },
    });

    console.log(`Featured tuitions inserted: ${inserted}`);
    console.log(`Approved tuitions in $500-$800 range: ${total}`);
  } finally {
    await closeDB();
  }
}

seedFeaturedTuitions().catch((error) => {
  console.error("Failed to seed featured tuitions:", error.message);
  process.exitCode = 1;
});
