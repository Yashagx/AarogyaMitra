// healthRecordsServer.js - Health Records Module
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory structure
const UPLOADS_DIR = path.join(__dirname, '../uploads');

const createUploadDirs = () => {
    ['health-records', 'prescriptions', 'lab-reports'].forEach(dir => {
        const fullPath = path.join(UPLOADS_DIR, dir);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
    });
};

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const category = req.body.category || 'health-records';
        const uploadPath = path.join(UPLOADS_DIR, category);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only images, PDFs, and documents are allowed'));
        }
    }
});

// Initialize database tables
export function initializeHealthRecordsTables(db) {
    createUploadDirs();

    db.serialize(() => {
        // Health Records table
        db.run(`
            CREATE TABLE IF NOT EXISTS health_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                user_name TEXT,
                user_mobile TEXT,
                title TEXT NOT NULL,
                description TEXT,
                category TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_type TEXT,
                file_size INTEGER,
                uploaded_by TEXT NOT NULL,
                uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `, (err) => {
            if (err) console.error('Error creating health_records table:', err);
        });

        // Prescriptions table
        db.run(`
            CREATE TABLE IF NOT EXISTS prescriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                user_name TEXT,
                user_mobile TEXT,
                doctor_name TEXT,
                hospital_name TEXT,
                prescription_date TEXT,
                medications TEXT,
                title TEXT NOT NULL,
                description TEXT,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_type TEXT,
                file_size INTEGER,
                uploaded_by TEXT NOT NULL,
                uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `, (err) => {
            if (err) console.error('Error creating prescriptions table:', err);
        });

        // Lab Reports table
        db.run(`
            CREATE TABLE IF NOT EXISTS lab_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                user_name TEXT,
                user_mobile TEXT,
                test_type TEXT,
                lab_name TEXT,
                test_date TEXT,
                title TEXT NOT NULL,
                description TEXT,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_type TEXT,
                file_size INTEGER,
                uploaded_by TEXT NOT NULL,
                uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `, (err) => {
            if (err) console.error('Error creating lab_reports table:', err);
        });
    });

    console.log("✅ Health Records tables initialized");
}

// Helper function to get user ID from session or patient details
async function getUserId(db, sessionUserId, patientName, patientMobile) {
    return new Promise((resolve, reject) => {
        if (sessionUserId) {
            // For logged-in users
            resolve(sessionUserId);
        } else if (patientName && patientMobile) {
            // For admin uploads - find user by name and mobile
            db.get(
                'SELECT id FROM users WHERE name = ? AND mobile = ?',
                [patientName, patientMobile],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else if (row) {
                        resolve(row.id);
                    } else {
                        reject(new Error('Patient not found'));
                    }
                }
            );
        } else {
            reject(new Error('No user identification provided'));
        }
    });
}

// Register routes
export function registerHealthRecordsRoutes(app, db) {
    
    // ================= HEALTH RECORDS ROUTES =================
    
    // Upload health record
    app.post('/api/health-records/upload', upload.single('file'), async (req, res) => {
        try {
            const { title, description, uploadedBy, patientName, patientMobile } = req.body;
            const file = req.file;

            if (!file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            // Get user ID
            const userId = await getUserId(db, req.session.userId, patientName, patientMobile);

            // Get user details
            db.get('SELECT name, mobile FROM users WHERE id = ?', [userId], (err, user) => {
                if (err || !user) {
                    // Delete uploaded file if user not found
                    fs.unlink(file.path, () => {});
                    return res.status(404).json({ error: 'User not found' });
                }

                db.run(`
                    INSERT INTO health_records 
                    (user_id, user_name, user_mobile, title, description, category, file_name, file_path, file_type, file_size, uploaded_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    userId,
                    user.name,
                    user.mobile,
                    title,
                    description || '',
                    'health-records',
                    file.originalname,
                    file.path,
                    file.mimetype,
                    file.size,
                    uploadedBy || 'user'
                ], function(err) {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ error: 'Failed to save record' });
                    }
                    res.json({ 
                        success: true, 
                        recordId: this.lastID,
                        message: 'Health record uploaded successfully'
                    });
                });
            });
        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({ error: error.message || 'Upload failed' });
        }
    });

    // Get all health records for user
    app.get('/api/health-records', (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Session expired' });
        }

        db.all(`
            SELECT id, title, description, file_name, file_type, file_size, uploaded_by, uploaded_at
            FROM health_records
            WHERE user_id = ?
            ORDER BY uploaded_at DESC
        `, [req.session.userId], (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to fetch records' });
            }
            res.json(rows || []);
        });
    });

    // Download health record
    app.get('/api/health-records/download/:id', (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        db.get(`
            SELECT file_path, file_name, file_type
            FROM health_records
            WHERE id = ? AND user_id = ?
        `, [req.params.id, req.session.userId], (err, record) => {
            if (err || !record) {
                return res.status(404).json({ error: 'Record not found' });
            }

            if (!fs.existsSync(record.file_path)) {
                return res.status(404).json({ error: 'File not found' });
            }

            res.download(record.file_path, record.file_name);
        });
    });

    // Delete health record
    app.delete('/api/health-records/:id', (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        db.get(`
            SELECT file_path FROM health_records
            WHERE id = ? AND user_id = ?
        `, [req.params.id, req.session.userId], (err, record) => {
            if (err || !record) {
                return res.status(404).json({ error: 'Record not found' });
            }

            // Delete file
            fs.unlink(record.file_path, (err) => {
                if (err) console.error('File deletion error:', err);
            });

            // Delete database entry
            db.run(`
                DELETE FROM health_records WHERE id = ?
            `, [req.params.id], (err) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Failed to delete record' });
                }
                res.json({ success: true, message: 'Record deleted successfully' });
            });
        });
    });

    // ================= PRESCRIPTIONS ROUTES =================
    
    app.post('/api/prescriptions/upload', upload.single('file'), async (req, res) => {
        try {
            const { title, description, doctorName, hospitalName, prescriptionDate, medications, uploadedBy, patientName, patientMobile } = req.body;
            const file = req.file;

            if (!file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            // Get user ID
            const userId = await getUserId(db, req.session.userId, patientName, patientMobile);

            db.get('SELECT name, mobile FROM users WHERE id = ?', [userId], (err, user) => {
                if (err || !user) {
                    fs.unlink(file.path, () => {});
                    return res.status(404).json({ error: 'User not found' });
                }

                db.run(`
                    INSERT INTO prescriptions 
                    (user_id, user_name, user_mobile, title, description, doctor_name, hospital_name, 
                    prescription_date, medications, file_name, file_path, file_type, file_size, uploaded_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    userId,
                    user.name,
                    user.mobile,
                    title,
                    description || '',
                    doctorName || '',
                    hospitalName || '',
                    prescriptionDate || new Date().toISOString().split('T')[0],
                    medications || '',
                    file.originalname,
                    file.path,
                    file.mimetype,
                    file.size,
                    uploadedBy || 'user'
                ], function(err) {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ error: 'Failed to save prescription' });
                    }
                    res.json({ 
                        success: true, 
                        prescriptionId: this.lastID,
                        message: 'Prescription uploaded successfully'
                    });
                });
            });
        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({ error: error.message || 'Upload failed' });
        }
    });

    app.get('/api/prescriptions', (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Session expired' });
        }

        db.all(`
            SELECT id, title, description, doctor_name, hospital_name, prescription_date, 
                   medications, file_name, file_type, file_size, uploaded_by, uploaded_at
            FROM prescriptions
            WHERE user_id = ?
            ORDER BY prescription_date DESC, uploaded_at DESC
        `, [req.session.userId], (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to fetch prescriptions' });
            }
            res.json(rows || []);
        });
    });

    app.get('/api/prescriptions/download/:id', (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        db.get(`
            SELECT file_path, file_name
            FROM prescriptions
            WHERE id = ? AND user_id = ?
        `, [req.params.id, req.session.userId], (err, record) => {
            if (err || !record) {
                return res.status(404).json({ error: 'Prescription not found' });
            }

            if (!fs.existsSync(record.file_path)) {
                return res.status(404).json({ error: 'File not found' });
            }

            res.download(record.file_path, record.file_name);
        });
    });

    app.delete('/api/prescriptions/:id', (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        db.get(`
            SELECT file_path FROM prescriptions
            WHERE id = ? AND user_id = ?
        `, [req.params.id, req.session.userId], (err, record) => {
            if (err || !record) {
                return res.status(404).json({ error: 'Prescription not found' });
            }

            fs.unlink(record.file_path, (err) => {
                if (err) console.error('File deletion error:', err);
            });

            db.run(`DELETE FROM prescriptions WHERE id = ?`, [req.params.id], (err) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Failed to delete prescription' });
                }
                res.json({ success: true, message: 'Prescription deleted successfully' });
            });
        });
    });

    // ================= LAB REPORTS ROUTES =================
    
    app.post('/api/lab-reports/upload', upload.single('file'), async (req, res) => {
        try {
            const { title, description, testType, labName, testDate, uploadedBy, patientName, patientMobile } = req.body;
            const file = req.file;

            if (!file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            // Get user ID
            const userId = await getUserId(db, req.session.userId, patientName, patientMobile);

            db.get('SELECT name, mobile FROM users WHERE id = ?', [userId], (err, user) => {
                if (err || !user) {
                    fs.unlink(file.path, () => {});
                    return res.status(404).json({ error: 'User not found' });
                }

                db.run(`
                    INSERT INTO lab_reports 
                    (user_id, user_name, user_mobile, title, description, test_type, lab_name, 
                    test_date, file_name, file_path, file_type, file_size, uploaded_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    userId,
                    user.name,
                    user.mobile,
                    title,
                    description || '',
                    testType || '',
                    labName || '',
                    testDate || new Date().toISOString().split('T')[0],
                    file.originalname,
                    file.path,
                    file.mimetype,
                    file.size,
                    uploadedBy || 'user'
                ], function(err) {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ error: 'Failed to save lab report' });
                    }
                    res.json({ 
                        success: true, 
                        reportId: this.lastID,
                        message: 'Lab report uploaded successfully'
                    });
                });
            });
        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({ error: error.message || 'Upload failed' });
        }
    });

    app.get('/api/lab-reports', (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Session expired' });
        }

        db.all(`
            SELECT id, title, description, test_type, lab_name, test_date, 
                   file_name, file_type, file_size, uploaded_by, uploaded_at
            FROM lab_reports
            WHERE user_id = ?
            ORDER BY test_date DESC, uploaded_at DESC
        `, [req.session.userId], (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to fetch lab reports' });
            }
            res.json(rows || []);
        });
    });

    app.get('/api/lab-reports/download/:id', (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        db.get(`
            SELECT file_path, file_name
            FROM lab_reports
            WHERE id = ? AND user_id = ?
        `, [req.params.id, req.session.userId], (err, record) => {
            if (err || !record) {
                return res.status(404).json({ error: 'Lab report not found' });
            }

            if (!fs.existsSync(record.file_path)) {
                return res.status(404).json({ error: 'File not found' });
            }

            res.download(record.file_path, record.file_name);
        });
    });

    app.delete('/api/lab-reports/:id', (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        db.get(`
            SELECT file_path FROM lab_reports
            WHERE id = ? AND user_id = ?
        `, [req.params.id, req.session.userId], (err, record) => {
            if (err || !record) {
                return res.status(404).json({ error: 'Lab report not found' });
            }

            fs.unlink(record.file_path, (err) => {
                if (err) console.error('File deletion error:', err);
            });

            db.run(`DELETE FROM lab_reports WHERE id = ?`, [req.params.id], (err) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Failed to delete lab report' });
                }
                res.json({ success: true, message: 'Lab report deleted successfully' });
            });
        });
    });

    console.log("✅ Health Records routes registered");
}