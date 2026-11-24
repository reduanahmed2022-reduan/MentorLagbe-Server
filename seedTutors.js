
import { connectDB, getDB } from "./config/db.js";

const tutors = [
  {
    name: "Sarah Ahmed",
    subject: "Mathematics",
    qualification: "BSc in Mathematics",
    location: "Sylhet",
    experience: 5,
    rating: 4.9,
    reviews: 120,
    hourlyRate: 500,
    mode: "Online & Offline",
    image: "https://i.pravatar.cc/300?img=47",
    verified: true,
    bio: "Experienced mathematics tutor helping students achieve excellent academic results."
  },
  {
    name: "Rahim Hasan",
    subject: "English",
    qualification: "BA in English",
    location: "Dhaka",
    experience: 4,
    rating: 4.8,
    reviews: 95,
    hourlyRate: 400,
    mode: "Online",
    image: "https://i.pravatar.cc/300?img=12",
    verified: true,
    bio: "English language tutor specializing in grammar, writing and spoken English."
  },
  {
    name: "Nusrat Jahan",
    subject: "Physics",
    qualification: "MSc in Physics",
    location: "Chattogram",
    experience: 6,
    rating: 5.0,
    reviews: 86,
    hourlyRate: 600,
    mode: "Online & Offline",
    image: "https://i.pravatar.cc/300?img=44",
    verified: true,
    bio: "Physics tutor focused on building strong concepts and problem-solving skills."
  },
  {
    name: "Tanvir Ahmed",
    subject: "Chemistry",
    qualification: "BSc in Chemistry",
    location: "Sylhet",
    experience: 3,
    rating: 4.7,
    reviews: 65,
    hourlyRate: 350,
    mode: "Offline",
    image: "https://i.pravatar.cc/300?img=13",
    verified: false,
    bio: "Friendly chemistry tutor for school and college students."
  },
  {
    name: "Ayesha Rahman",
    subject: "Biology",
    qualification: "MSc in Biology",
    location: "Dhaka",
    experience: 7,
    rating: 4.9,
    reviews: 150,
    hourlyRate: 700,
    mode: "Online",
    image: "https://i.pravatar.cc/300?img=49",
    verified: true,
    bio: "Biology educator with experience in preparing students for examinations."
  },
  {
    name: "Sabbir Hossain",
    subject: "ICT",
    qualification: "BSc in CSE",
    location: "Rajshahi",
    experience: 4,
    rating: 4.8,
    reviews: 72,
    hourlyRate: 450,
    mode: "Online & Offline",
    image: "https://i.pravatar.cc/300?img=60",
    verified: true,
    bio: "ICT tutor teaching computer fundamentals and programming basics."
  },
  {
    name: "Mehedi Hasan",
    subject: "Mathematics",
    qualification: "MSc in Mathematics",
    location: "Dhaka",
    experience: 8,
    rating: 4.9,
    reviews: 110,
    hourlyRate: 800,
    mode: "Offline",
    image: "https://i.pravatar.cc/300?img=11",
    verified: true,
    bio: "Mathematics specialist experienced in teaching secondary and higher secondary students."
  },
  {
    name: "Fatema Akter",
    subject: "English",
    qualification: "MA in English",
    location: "Sylhet",
    experience: 5,
    rating: 4.8,
    reviews: 78,
    hourlyRate: 450,
    mode: "Online & Offline",
    image: "https://i.pravatar.cc/300?img=32",
    verified: true,
    bio: "English teacher helping learners improve communication and writing skills."
  },
  {
    name: "Arif Chowdhury",
    subject: "Physics",
    qualification: "BSc in Physics",
    location: "Rajshahi",
    experience: 3,
    rating: 4.6,
    reviews: 42,
    hourlyRate: 400,
    mode: "Online",
    image: "https://i.pravatar.cc/300?img=15",
    verified: false,
    bio: "Dedicated physics tutor explaining difficult topics with practical examples."
  },
  {
    name: "Mim Akter",
    subject: "Biology",
    qualification: "BSc in Zoology",
    location: "Chattogram",
    experience: 4,
    rating: 4.9,
    reviews: 91,
    hourlyRate: 550,
    mode: "Online & Offline",
    image: "https://i.pravatar.cc/300?img=25",
    verified: true,
    bio: "Biology tutor making science lessons simple and engaging."
  },
  {
    name: "Rakibul Islam",
    subject: "Chemistry",
    qualification: "MSc in Chemistry",
    location: "Dhaka",
    experience: 6,
    rating: 4.8,
    reviews: 105,
    hourlyRate: 650,
    mode: "Offline",
    image: "https://i.pravatar.cc/300?img=53",
    verified: true,
    bio: "Chemistry instructor specializing in board examination preparation."
  }
];

// Every catalog row now maps to a real email. Demo login accounts keep their
// existing addresses; catalog-only tutors get deterministic addresses so no
// profile is ever written with an empty email.
const accountEmails = {
  "Sarah Ahmed": "sarah@mentorlagbe.com",
  "Rahim Hasan": "rahim@mentorlagbe.com",
  "Nusrat Jahan": "nusrat@mentorlagbe.com",
  "Sabbir Hossain": "sabbir@mentorlagbe.com",
  "Ayesha Rahman": "ayesha@mentorlagbe.com",
  "Tanvir Ahmed": "tanvir@mentorlagbe.com",
  "Mehedi Hasan": "mehedi@mentorlagbe.com",
  "Fatema Akter": "fatema@mentorlagbe.com",
  "Arif Chowdhury": "arif@mentorlagbe.com",
  "Mim Akter": "mim@mentorlagbe.com",
  "Rakibul Islam": "rakibul@mentorlagbe.com",
};

const emailForTutor = (name) =>
  accountEmails[name] ||
  `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")}@mentorlagbe.com`;

async function seedTutors() {
  try {
    await connectDB();

    const db = getDB();

    // Tutor profiles live on `users` documents with role:"tutor"; there is no
    // separate tutors collection to insert into.
    const users = db.collection("users");
    let added = 0;
    let linked = 0;

    for (const tutor of tutors) {
      const email = emailForTutor(tutor.name);

      let user = await users.findOne({ email }, { projection: { _id: 1 } });

      if (!user) {
        const inserted = await users.insertOne({
          email,
          name: tutor.name,
          role: "tutor",
          image: tutor.image || "",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        user = { _id: inserted.insertedId };
        added += 1;
      } else {
        linked += 1;
      }

      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            ...tutor,
            email,
            role: "tutor",
            // The public catalog's userId mirrors this user's own _id.
            userId: user._id.toString(),
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        }
      );
    }

    console.log(
      `${added} tutor accounts added, ${linked} linked to existing users.`
    );

    const total = await users.countDocuments({
      role: "tutor",
      subject: { $exists: true },
    });

    console.log(`Total tutor profiles in database: ${total}`);

    process.exit(0);
  } catch (error) {
    console.error("Failed to insert tutors:", error.message);
    process.exit(1);
  }
}

seedTutors();
