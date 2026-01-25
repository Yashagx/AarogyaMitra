// ================= ADMIN DATABASE SETUP =================
// File: backend/admin/adminDbSetup.js

import bcrypt from 'bcryptjs';

export function initializeAdminTables(db) {
    db.serialize(() => {
        
        // ========== ADMIN USERS TABLE ==========
        db.run(`
            CREATE TABLE IF NOT EXISTS admin_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                email TEXT UNIQUE,
                role TEXT NOT NULL CHECK(role IN (
                    'super_admin',
                    'aarogya_operator',
                    'doctor',
                    'hospital_admin',
                    'pharmacy_operator',
                    'lab_operator'
                )),
                full_name TEXT NOT NULL,
                mobile TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                last_login TEXT,
                created_by INTEGER,
                doctor_id INTEGER,
                hospital_id INTEGER,
                pharmacy_id INTEGER,
                lab_id INTEGER,
                FOREIGN KEY(created_by) REFERENCES admin_users(id),
                FOREIGN KEY(doctor_id) REFERENCES doctors(id),
                FOREIGN KEY(hospital_id) REFERENCES hospitals(id),
                FOREIGN KEY(pharmacy_id) REFERENCES pharmacies(id)
            )
        `);

        // ========== AUDIT LOGS TABLE ==========
        db.run(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_user_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                table_name TEXT,
                record_id INTEGER,
                old_value TEXT,
                new_value TEXT,
                ip_address TEXT,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(admin_user_id) REFERENCES admin_users(id)
            )
        `);

        console.log("✅ Admin Portal Tables Initialized");
    });
}

// ========== SEED DEFAULT SUPER ADMIN ==========
export async function seedDefaultAdmin(db) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM admin_users WHERE role = "super_admin"', async (err, row) => {
            if (err) {
                console.error('❌ Error checking admin:', err);
                reject(err);
                return;
            }

            if (!row) {
                try {
                    const hashedPassword = await bcrypt.hash('Admin@123', 10);
                    
                    db.run(`
                        INSERT INTO admin_users 
                        (username, password_hash, email, role, full_name, mobile, is_active)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [
                        'superadmin',
                        hashedPassword,
                        'admin@aarogyamitra.gov.in',
                        'super_admin',
                        'System Administrator',
                        '9999999999',
                        1
                    ], (err) => {
                        if (err) {
                            console.error('❌ Error creating default admin:', err);
                            reject(err);
                        } else {
                            console.log('✅ Default Super Admin Created');
                            console.log('   Username: superadmin');
                            console.log('   Password: Admin@123');
                            console.log('   🔒 CHANGE THIS PASSWORD IMMEDIATELY!');
                            resolve();
                        }
                    });
                } catch (error) {
                    console.error('❌ Error hashing password:', error);
                    reject(error);
                }
            } else {
                resolve();
            }
        });
    });
}