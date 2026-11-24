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
  ["English Conversation Club", "English", "SSC", "Online", "Online", 550, 2, "photo-1513258496099-48168024aec0", "Build everyday speaking confidence through interactive conversation drills.", "rahim@mentorlagbe.com"],
  ["Junior Physics Made Easy", "Physics", "Class 9", "Offline", "Sylhet", 600, 3, "photo-1636466497217-26a8cbeaf0aa", "Core physics concepts explained with simple examples and homework support.", "nusrat@mentorlagbe.com"],
  ["Creative Coding for Kids", "ICT", "Class 8", "Online", "Online", 650, 2, "photo-1526379095098-d400fd0bf935", "A playful introduction to programming through small projects and puzzles.", "sabbir@mentorlagbe.com"],
  ["Biology Basics for Beginners", "Biology", "Class 10", "Offline", "Rajshahi", 700, 3, "photo-1530026405186-ed1f139313f8", "Chapter-wise biology foundations with diagrams and quick revision notes.", "ayesha@mentorlagbe.com"],
  ["Chemistry Quick Revision", "Chemistry", "HSC", "Online", "Online", 780, 3, "photo-1554475901-4538ddfbccc2", "Fast, focused HSC chemistry revision with reaction mechanisms and past questions.", "tanvir@mentorlagbe.com"],
];

// Repair banners on existing listings: one URL was a dead Unsplash photo and
// another listing had no banner at all. Re-running this seed keeps both fixed.
const bannerFixes = [
  ["Chemistry Quick Revision", "tanvir@mentorlagbe.com", "photo-1554475901-4538ddfbccc2"],
  ["Mathematics Tutor Needed for Class 10", "tutor1@example.com", "photo-1635070041078-e363dbe005cb"],
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
