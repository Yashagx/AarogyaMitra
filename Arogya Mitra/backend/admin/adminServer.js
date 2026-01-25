// ================= ADMIN PORTAL SERVER (INTEGRATED) =================
// File: backend/admin/adminServer.js

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import dotenv from "dotenv";

// Import admin modules
import { initializeAdminTables, seedDefaultAdmin } from './adminDbSetup.js';
import { verifyAdminToken, checkActiveUser } from './middleware/adminAuth.js';
import adminAuthRoutes from './routes/adminAuth.js';
import superAdminRoutes from './routes/superAdmin.js';
import operatorRoutes from './routes/operatorRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import hospitalPharmacyLabRoutes from './routes/hospitalPharmacyLabRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================= APP SETUP =================
const app = express();
const PORT = process.env.ADMIN_PORT || 5001;

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ================= ADMIN FRONTEND =================
const ADMIN_FRONTEND_PATH = path.resolve(__dirname, "../../admin-frontend");
app.use(express.static(ADMIN_FRONTEND_PATH));

// ================= SQLITE DATABASE =================
// Use the SAME database as your main application
const db = new sqlite3.Database(
    path.join(__dirname, "../aarogya.db"),
    async (err) => {
        if (err) {
            console.error("❌ Database connection error:", err);
        } else {
            console.log("✅ Admin Portal - SQLite connected (shared DB)");
            
            // Initialize admin tables
            initializeAdminTables(db);
            
            // Seed default admin
            try {
                await seedDefaultAdmin(db);
            } catch (error) {
                console.error("❌ Error seeding default admin:", error);
            }
        }
    }
);

app.set('db', db);

// ================= PUBLIC ROUTES =================
app.use('/api/admin/auth', adminAuthRoutes);

// Health check
app.get('/api/admin/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Admin Portal API is running',
        timestamp: new Date().toISOString()
    });
});

// ================= PROTECTED ROUTES =================
app.use('/api/admin/super', verifyAdminToken, checkActiveUser, superAdminRoutes);
app.use('/api/admin/operator', verifyAdminToken, checkActiveUser, operatorRoutes);
app.use('/api/admin/doctor', verifyAdminToken, checkActiveUser, doctorRoutes);
app.use('/api/admin', verifyAdminToken, checkActiveUser, hospitalPharmacyLabRoutes);

// ================= CATCH-ALL FOR FRONTEND =================
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(ADMIN_FRONTEND_PATH, 'adminlogin.html'));
    } else {
        res.status(404).json({ error: 'API endpoint not found' });
    }
});

// ================= ERROR HANDLING =================
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ================= START SERVER =================
app.listen(PORT, () => {
    console.log(`\n🏥 ===============================================`);
    console.log(`🚀 Aarogya Mitra Admin Portal`);
    console.log(`📍 Running on http://localhost:${PORT}`);
    console.log(`🏥 ===============================================\n`);
    console.log('📋 API Routes:');
    console.log('   - POST /api/admin/auth/login');
    console.log('   - GET  /api/admin/super/dashboard/stats');
    console.log('   - GET  /api/admin/operator/dashboard/stats');
    console.log('   - GET  /api/admin/doctor/dashboard/stats');
    console.log('\n🔐 Default Login:');
    console.log('   Username: superadmin');
    console.log('   Password: Admin@123');
    console.log('   ⚠️  CHANGE PASSWORD IMMEDIATELY!\n');
});

// ================= GRACEFUL SHUTDOWN =================
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Admin Portal...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('✅ Database connection closed');
        }
        process.exit(0);
    });
});