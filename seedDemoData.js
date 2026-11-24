import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { connectDB, getDB } from "./config/db.js";

dotenv.config();

const DEMO_PASSWORD = "Tutor@12345";
const USING_DEFAULT_ADMIN_PASSWORD = !process.env.ADMIN_PASSWORD;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@12345";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@mentorlagbe.com")
  .trim()
  .toLowerCase();

const tutors = [
  { name: "Sarah Ahmed", email: "sarah@mentorlagbe.com", plan: "pro", phone: "+8801711000001", bio: "Mathematics specialist with 8 years of teaching experience." },
  // Pro because seedFeaturedTuitions.js adds a third approved batch for Rahim;
  // keeping this tutor free would exceed the 2-tuition free-plan rule.
  { name: "Rahim Hasan", email: "rahim@mentorlagbe.com", plan: "pro", phone: "+8801711000002", bio: "English and IELTS mentor helping students build confidence." },
  { name: "Nusrat Jahan", email: "nusrat@mentorlagbe.com", plan: "pro", phone: "+8801711000003", bio: "Physics educator who makes difficult concepts simple." },
  { name: "Sabbir Hossain", email: "sabbir@mentorlagbe.com", plan: "pro", phone: "+8801711000004", bio: "Full-stack developer teaching practical programming." },
  { name: "Ayesha Rahman", email: "ayesha@mentorlagbe.com", plan: "pro", phone: "+8801711000005", bio: "Biology mentor focused on exam-oriented learning." },
  { name: "Tanvir Ahmed", email: "tanvir@mentorlagbe.com", plan: "pro", phone: "+8801711000006", bio: "Chemistry tutor with a knack for real-life examples." },
];

const students = [
  { name: "Student One", email: "student1@mentorlagbe.com", plan: "free", phone: "+8801811000001" },
  { name: "Student Two", email: "student2@mentorlagbe.com", plan: "free", phone: "+8801811000002" },
];

const image = (id) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;

// 14 approved batches (including IELTS and Programming) plus two records so the admin moderation queue is demoable.
const tuitions = [
  ["Algebra Mastery for HSC", "Mathematics", "HSC", "Online", "Dhaka", 3500, 3, "photo-1509062522246-3755977927d7", "Complete algebra course covering equations, functions and exam practice.", "sarah@mentorlagbe.com", "approved"],
  ["Calculus Foundations", "Mathematics", "University", "Online", "Online", 5000, 2, "photo-1635070041078-e363dbe005cb", "Build a strong calculus foundation with guided problem solving.", "sarah@mentorlagbe.com", "approved"],
  ["IELTS Intensive Batch", "English", "Adult", "Online", "Online", 4500, 4, "photo-1503676260728-1c00da094a0b", "Band 7+ preparation with weekly mock tests and feedback.", "rahim@mentorlagbe.com", "approved"],
  ["Spoken English for Beginners", "English", "SSC", "Offline", "Chattogram", 2500, 2, "photo-1513258496099-48168024aec0", "Conversation-focused classes to speak English confidently.", "rahim@mentorlagbe.com", "approved"],
  ["Physics for Engineering aspirants", "Physics", "HSC", "Online", "Dhaka", 4000, 3, "photo-1636466497217-26a8cbeaf0aa", "Mechanics, electricity and optics with numerical drills.", "nusrat@mentorlagbe.com", "approved"],
  ["Modern Physics Crash Course", "Physics", "University", "Online", "Online", 5500, 2, "photo-1532094349884-543bc11b234d", "Quantum mechanics and relativity explained visually.", "nusrat@mentorlagbe.com", "approved"],
  ["Full-Stack Web Development", "Coding", "Adult", "Online", "Online", 6000, 3, "photo-1498050108023-c5249f4df085", "Learn React, Node.js and MongoDB by building real projects.", "sabbir@mentorlagbe.com", "approved"],
  ["Python for Absolute Beginners", "Coding", "SSC", "Online", "Online", 3000, 2, "photo-1526379095098-d400fd0bf935", "A friendly introduction to programming with Python.", "sabbir@mentorlagbe.com", "approved"],
  ["Biology for Medical Entrance", "Biology", "HSC", "Offline", "Sylhet", 3800, 4, "photo-1530026405186-ed1f139313f8", "Chapter-wise medical entrance preparation with diagrams.", "ayesha@mentorlagbe.com", "approved"],
  ["Genetics & Evolution", "Biology", "University", "Online", "Online", 4200, 2, "photo-1532187863486-abf9dbad1b69", "Understand inheritance, DNA and evolution with examples.", "ayesha@mentorlagbe.com", "approved"],
  ["Organic Chemistry Essentials", "Chemistry", "HSC", "Offline", "Khulna", 3200, 3, "photo-1554475901-4538ddfbccc2", "Reaction mechanisms made easy with practice sheets.", "tanvir@mentorlagbe.com", "approved"],
  ["Chemistry for JEE / Engineering", "Chemistry", "University", "Online", "Online", 4800, 3, "photo-1554475901-4538ddfbccc2", "Structured problem solving for competitive exams.", "tanvir@mentorlagbe.com", "approved"],
  ["Business Statistics for Beginners", "Mathematics", "Adult", "Online", "Online", 3600, 2, "photo-1551288049-bebda4e38f71", "Practical statistics for everyday business decisions.", "sarah@mentorlagbe.com", "pending"],
  ["Data Science Bootcamp", "Coding", "Adult", "Online", "Online", 6500, 3, "photo-1551288049-bebda4e38f71", "An intensive introduction to data analysis with Python.", "sabbir@mentorlagbe.com", "rejected"],
  // Subject variety for the IELTS / Programming category links on the client.
  ["IELTS Speaking & Writing Lab", "IELTS", "Adult", "Online", "Online", 4200, 3, "photo-1503676260728-1c00da094a0b", "IELTS band 7+ speaking and writing practice with weekly feedback.", "sarah@mentorlagbe.com", "approved"],
  ["Programming with JavaScript", "Programming", "SSC", "Online", "Online", 3800, 2, "photo-1498050108023-c5249f4df085", "Hands-on JavaScript fundamentals through small browser projects.", "sabbir@mentorlagbe.com", "approved"],
];

async function upsertUser(users, user, role, password, extra = {}) {
  await users.updateOne(
    { email: user.email },
    {
      $set: {
        name: user.name,
        role,
        phone: user.phone || "",
        bio: user.bio || "",
        plan: user.plan || "free",
        ...extra,
      },
      // Never overwrite an existing password or creation date.
      $setOnInsert: {
        email: user.email,
        password: await bcrypt.hash(password, 12),
        profileImage: "",
        image: "",
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}

async function seed() {
  await connectDB();

  const db = getDB();
  const users = db.collection("users");
  const tuitionsCollection = db.collection("tuitions");
  const applications = db.collection("applications");
  const payments = db.collection("payments");

  await upsertUser(
    users,
    {
      name: process.env.ADMIN_NAME || "MentorLagbe Admin",
      email: ADMIN_EMAIL,
    },
    "admin",
    ADMIN_PASSWORD
  );

  for (const tutor of tutors) {
    await upsertUser(users, tutor, "tutor", DEMO_PASSWORD);
  }

  for (const student of students) {
    await upsertUser(users, student, "student", DEMO_PASSWORD);
  }

  const now = Date.now();
  const insertedTuitions = [];

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
    approvalStatus = "approved",
  ] of tuitions) {
    const tutor = tutors.find((item) => item.email === tutorEmail);
    const document = {
      title,
      subject,
      classLevel,
      mode,
      location,
      monthlyFee,
      daysPerWeek,
      bannerImage: image(photoId),
      description,
      tutorName: tutor.name,
      tutorEmail,
      isActive: true,
      createdAt: new Date(now - insertedTuitions.length * 86400000),
    };

    const { createdAt, ...tuitionFields } = document;

    // `$setOnInsert` alone would leave dead banners and stale plans on rows
    // created by an earlier seed run, so refresh demo-owned fields every time.
    await tuitionsCollection.updateOne(
      { title, tutorEmail },
      {
        $set: { ...tuitionFields, approvalStatus },
        $setOnInsert: { createdAt },
      },
      { upsert: true }
    );

    const saved = await tuitionsCollection.findOne({ title, tutorEmail });
    insertedTuitions.push(saved);
  }

  const sampleApplications = [
    [0, 0, "accepted", "Weekdays 6-8 PM", "I need help with exam preparation."],
    [2, 0, "pending", "Weekend mornings", "Targeting band 7 in IELTS."],
    [4, 1, "pending", "Evenings after 7 PM", "Need numerical practice."],
    [6, 1, "rejected", "Saturday 10 AM", "Interested in full-stack track."],
    [8, 0, "accepted", "Friday 5 PM", "Preparing for medical entrance."],
  ];

  for (const [tuitionIndex, studentIndex, status, schedule, note] of sampleApplications) {
    const tuition = insertedTuitions[tuitionIndex];
    const student = students[studentIndex];

    await applications.updateOne(
      {
        tuitionId: tuition._id.toString(),
        studentEmail: student.email,
      },
      {
        $setOnInsert: {
          tuitionId: tuition._id.toString(),
          tuitionTitle: tuition.title,
          subject: tuition.subject,
          monthlyFee: tuition.monthlyFee,
          tutorEmail: tuition.tutorEmail,
          studentName: student.name,
          studentEmail: student.email,
          studentPhone: student.phone,
          preferredSchedule: schedule,
          studentNote: note,
          status,
          appliedAt: new Date(now - tuitionIndex * 3600000),
          ...(status !== "pending" && {
            reviewedAt: new Date(now - tuitionIndex * 1800000),
          }),
        },
      },
      { upsert: true }
    );
  }

  // Demo transactions so the admin revenue and transactions views are populated.
  const demoPayments = [
    ["sarah@mentorlagbe.com", "Sarah Ahmed", "tutor", "Pro Tutor Plan", 15, "cs_demo_tutor_sarah"],
    ["nusrat@mentorlagbe.com", "Nusrat Jahan", "tutor", "Pro Tutor Plan", 15, "cs_demo_tutor_nusrat"],
    ["ayesha@mentorlagbe.com", "Ayesha Rahman", "tutor", "Pro Tutor Plan", 15, "cs_demo_tutor_ayesha"],
  ];

  for (const [index, [userEmail, userName, userRole, planName, amount, stripeSessionId]] of demoPayments.entries()) {
    await payments.updateOne(
      { stripeSessionId },
      {
        $setOnInsert: {
          userEmail,
          userName,
          userRole,
          planName,
          amount,
          currency: "USD",
          transactionId: `pi_demo_${stripeSessionId}`,
          stripeSessionId,
          paymentStatus: "paid",
          paidAt: new Date(now - index * 86400000),
        },
      },
      { upsert: true }
    );
  }

  console.log("Seed completed: admin, 6 tutors, 2 students, 14 approved tuitions, 2 moderation records, 5 applications and demo payments.");
  if (USING_DEFAULT_ADMIN_PASSWORD) {
    console.log(`Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  } else {
    console.log(`Admin login: ${ADMIN_EMAIL} / password is set in server .env / host environment variables`);
  }
  console.log(`Tutor login: ${tutors[0].email} / ${DEMO_PASSWORD}`);
  console.log(`Student login: ${students[0].email} / ${DEMO_PASSWORD}`);
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
