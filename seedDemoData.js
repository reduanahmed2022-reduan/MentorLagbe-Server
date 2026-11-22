import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { connectDB, getDB } from "./config/db.js";

dotenv.config();

const DEMO_PASSWORD = "Tutor@12345";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@12345";

const tutors = [
  { name: "Sarah Ahmed", email: "sarah@mentorlagbe.com", plan: "pro", phone: "+8801711000001", bio: "Mathematics specialist with 8 years of teaching experience." },
  { name: "Rahim Hasan", email: "rahim@mentorlagbe.com", plan: "free", phone: "+8801711000002", bio: "English and IELTS mentor helping students build confidence." },
  { name: "Nusrat Jahan", email: "nusrat@mentorlagbe.com", plan: "pro", phone: "+8801711000003", bio: "Physics educator who makes difficult concepts simple." },
  { name: "Sabbir Hossain", email: "sabbir@mentorlagbe.com", plan: "free", phone: "+8801711000004", bio: "Full-stack developer teaching practical programming." },
  { name: "Ayesha Rahman", email: "ayesha@mentorlagbe.com", plan: "pro", phone: "+8801711000005", bio: "Biology mentor focused on exam-oriented learning." },
  { name: "Tanvir Ahmed", email: "tanvir@mentorlagbe.com", plan: "free", phone: "+8801711000006", bio: "Chemistry tutor with a knack for real-life examples." },
];

const students = [
  { name: "Student One", email: "student1@mentorlagbe.com" },
  { name: "Student Two", email: "student2@mentorlagbe.com" },
];

const image = (id) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;

const tuitions = [
  ["Algebra Mastery for HSC", "Mathematics", "HSC", "Online", "Dhaka", 3500, 3, "photo-1509062522246-3755977927d7", "Complete algebra course covering equations, functions and exam practice.", "sarah@mentorlagbe.com"],
  ["Calculus Foundations", "Mathematics", "University", "Online", "Online", 5000, 2, "photo-1635070041078-e363dbe005cb", "Build a strong calculus foundation with guided problem solving.", "sarah@mentorlagbe.com"],
  ["IELTS Intensive Batch", "English", "Adult", "Online", "Online", 4500, 4, "photo-1503676260728-1c00da094a0b", "Band 7+ preparation with weekly mock tests and feedback.", "rahim@mentorlagbe.com"],
  ["Spoken English for Beginners", "English", "SSC", "Offline", "Chattogram", 2500, 2, "photo-1513258496099-48168024aec0", "Conversation-focused classes to speak English confidently.", "rahim@mentorlagbe.com"],
  ["Physics for Engineering aspirants", "Physics", "HSC", "Online", "Dhaka", 4000, 3, "photo-1636466497217-26a8cbeaf0aa", "Mechanics, electricity and optics with numerical drills.", "nusrat@mentorlagbe.com"],
  ["Modern Physics Crash Course", "Physics", "University", "Online", "Online", 5500, 2, "photo-1532094349884-543bc11b234d", "Quantum mechanics and relativity explained visually.", "nusrat@mentorlagbe.com"],
  ["Full-Stack Web Development", "Programming", "Adult", "Online", "Online", 6000, 3, "photo-1498050108023-c5249f4df085", "Learn React, Node.js and MongoDB by building real projects.", "sabbir@mentorlagbe.com"],
  ["Python for Absolute Beginners", "Programming", "SSC", "Online", "Online", 3000, 2, "photo-1526379095098-d400fd0bf935", "A friendly introduction to programming with Python.", "sabbir@mentorlagbe.com"],
  ["Biology for Medical Entrance", "Biology", "HSC", "Offline", "Sylhet", 3800, 4, "photo-1530026405186-ed1f139313f8", "Chapter-wise medical entrance preparation with diagrams.", "ayesha@mentorlagbe.com"],
  ["Genetics & Evolution", "Biology", "University", "Online", "Online", 4200, 2, "photo-1532187863486-abf9dbad1b69", "Understand inheritance, DNA and evolution with examples.", "ayesha@mentorlagbe.com"],
  ["Organic Chemistry Essentials", "Chemistry", "HSC", "Offline", "Khulna", 3200, 3, "photo-1532634896-26909d0d4b9a", "Reaction mechanisms made easy with practice sheets.", "tanvir@mentorlagbe.com"],
  ["Chemistry for JEE / Engineering", "Chemistry", "University", "Online", "Online", 4800, 3, "photo-1554475901-4538ddfbccc2", "Structured problem solving for competitive exams.", "tanvir@mentorlagbe.com"],
];

async function upsertUser(users, user, role, password, extra = {}) {
  await users.updateOne(
    { email: user.email },
    {
      $setOnInsert: {
        name: user.name,
        email: user.email,
        password: await bcrypt.hash(password, 12),
        role,
        phone: user.phone || "",
        bio: user.bio || "",
        plan: user.plan || "free",
        image: "",
        createdAt: new Date(),
        ...extra,
      },
    },
    { upsert: true }
  );
}

async function seed() {
  await connectDB();

  const db = getDB();
  const users = db.collection("users");
  const tuitions = db.collection("tuitions");
  const applications = db.collection("applications");

  await upsertUser(
    users,
    {
      name: process.env.ADMIN_NAME || "MentorLagbe Admin",
      email: process.env.ADMIN_EMAIL || "admin@mentorlagbe.com",
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
      approvalStatus: "approved",
      isActive: true,
      createdAt: new Date(now - insertedTuitions.length * 86400000),
    };

    await tuitions.updateOne(
      { title, tutorEmail },
      { $setOnInsert: document },
      { upsert: true }
    );

    const saved = await tuitions.findOne({ title, tutorEmail });
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
          studentPhone: "+8801811000001",
          preferredSchedule: schedule,
          studentNote: note,
          status,
          appliedAt: new Date(now - tuitionIndex * 3600000),
        },
      },
      { upsert: true }
    );
  }

  console.log("Seed completed: admin, tutors, students, 12 tuitions and sample applications.");
  console.log(`Admin login: ${process.env.ADMIN_EMAIL || "admin@mentorlagbe.com"} / ${ADMIN_PASSWORD}`);
  console.log(`Tutor login: ${tutors[0].email} / ${DEMO_PASSWORD}`);
};

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
