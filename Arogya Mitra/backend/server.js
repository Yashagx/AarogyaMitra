// ================= IMPORTS =================
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import session from "express-session";

import { initializeHealthRecordsTables, registerHealthRecordsRoutes } from "./healthRecordsServer.js";
import { initializeSymptomTables, registerSymptomRoutes } from "./symptomServer.js";
import { registerTranslationRoutes } from "./translationServer.js";
import { initializeAarogyaConnectTables, registerAarogyaConnectRoutes } from "./aarogyaconnect.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================= APP SETUP =================
const app = express();
const PORT = 5000;

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ================= SESSION =================
app.use(
    session({
        secret: "aarogya-mitra-secret-key",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 // 24 hours
        }
    })
);

// ================= FRONTEND =================
const FRONTEND_PATH = path.resolve(__dirname, "../frontend");
app.use(express.static(FRONTEND_PATH));

// ================= SQLITE =================
const db = new sqlite3.Database(
    path.join(__dirname, "aarogya.db"),
    () => console.log("✅ SQLite connected")
);

// ================= INDIAN STATES =================
const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
    "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
    "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
    "West Bengal"
];

// ================= INITIALIZE ALL TABLES =================
db.serialize(() => {
    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            abha_id TEXT UNIQUE,
            name TEXT,
            mobile TEXT,
            gender TEXT,
            dob TEXT,
            age INTEGER,
            home_state TEXT,
            preferred_language TEXT DEFAULT 'en',
            verified_at TEXT,
            UNIQUE(name, mobile)
        )
    `);

    // Addresses table
    db.run(`
        CREATE TABLE IF NOT EXISTS addresses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            state TEXT,
            district TEXT,
            tehsil TEXT,
            pincode TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);

    // Initialize all module tables
    initializeSymptomTables(db);
    initializeAarogyaConnectTables(db);
    initializeHealthRecordsTables(db);
});

// ================= UTILITY FUNCTIONS =================
function hashCode(str) {
    let h = 0;
    for (let c of str) h = (h << 5) - h + c.charCodeAt(0);
    return Math.abs(h);
}

function generateAbhaId(seed) {
    return `91-${seed % 9000 + 1000}-${seed % 9000 + 1000}-${seed % 9000 + 1000}`;
}

function getRandomHomeState(seed) {
    return INDIAN_STATES[seed % INDIAN_STATES.length];
}

// ================= AUTH ROUTES =================
app.get("/auth/abha/login", (req, res) => {
    const { name, mobile, language } = req.query;
    if (!name || !mobile) return res.status(400).send("Missing data");

    if (language) {
        req.session.preferredLanguage = language;
    }

    res.redirect(
        `/auth/abha/mock-callback?name=${encodeURIComponent(name)}&mobile=${mobile}&language=${language || 'en'}`
    );
});

app.get("/auth/abha/mock-callback", (req, res) => {
    const { name, mobile, language = 'en' } = req.query;
    const seed = hashCode(`${name}_${mobile}`);
    const abhaId = generateAbhaId(seed);
    const homeState = getRandomHomeState(seed);

    db.get(
        `SELECT * FROM users WHERE name=? AND mobile=?`,
        [name, mobile],
        (err, user) => {
            if (user) {
                db.run(
                    `UPDATE users SET preferred_language=? WHERE id=?`,
                    [language, user.id],
                    () => {
                        req.session.userId = user.id;
                        req.session.abhaId = user.abha_id || abhaId;
                        req.session.preferredLanguage = language;
                        return res.redirect("/verified.html");
                    }
                );
                return;
            }

            db.run(
                `INSERT INTO users
                (abha_id, name, mobile, gender, dob, age, home_state, preferred_language, verified_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    abhaId,
                    name,
                    mobile,
                    seed % 2 ? "Female" : "Male",
                    "1985-01-01",
                    40,
                    homeState,
                    language,
                    new Date().toISOString()
                ],
                function () {
                    req.session.userId = this.lastID;
                    req.session.abhaId = abhaId;
                    req.session.preferredLanguage = language;
                    res.redirect("/verified.html");
                }
            );
        }
    );
});

app.get("/api/abha/profile", (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: "Session expired" });
    }

    db.get(
  `SELECT u.*, a.state, a.district, a.tehsil, a.pincode
   FROM users u
   LEFT JOIN addresses a 
     ON u.id = a.user_id
   WHERE u.id = ?
   ORDER BY a.id DESC
   LIMIT 1`,
  [req.session.userId],
  (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    if (!row) return res.status(404).json({ error: "Not found" });

    res.json({
      abhaId: row.abha_id,
      name: row.name,
      mobile: row.mobile,
      gender: row.gender,
      dob: row.dob,
      age: row.age,
      homeState: row.home_state,
      state: row.state || row.home_state,
      preferredLanguage: row.preferred_language || 'en',
      address: row.district
        ? {
            state: row.state,
            district: row.district,
            tehsil: row.tehsil,
            pincode: row.pincode
          }
        : null
    });
  }
);

});

app.post("/api/user/address", (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: "Session expired" });
    }

    const { state, district, tehsil, pincode } = req.body;

    db.run(
        `INSERT INTO addresses (user_id, state, district, tehsil, pincode)
        VALUES (?, ?, ?, ?, ?)`,
        [req.session.userId, state, district, tehsil, pincode],
        () => res.json({ success: true })
    );
});

app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ success: true });
    });
});

// ================= REGISTER ALL MODULE ROUTES =================
// IMPORTANT: Register routes AFTER all table initialization
registerTranslationRoutes(app);
registerSymptomRoutes(app, db);
registerAarogyaConnectRoutes(app, db);
registerHealthRecordsRoutes(app, db);

// ================= TEST ROUTE =================
app.get('/api/test', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Server is running',
        session: req.session.userId ? 'Active' : 'None'
    });
});

// ================= START SERVER =================
app.listen(PORT, () => {
    console.log(`🚀 Aarogya Mitra running on http://localhost:${PORT}`);
    console.log('📋 Available routes:');
    console.log('   - POST /api/appointments/book');
    console.log('   - GET  /api/appointments/:bookingId');
    console.log('   - POST /api/hospitals/nearby');
    console.log('   - GET  /api/symptoms/recent');
    console.log('   - GET  /api/appointments/stats');
});