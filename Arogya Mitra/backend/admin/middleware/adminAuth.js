// ================= ADMIN AUTHENTICATION MIDDLEWARE =================
// File: backend/admin/middleware/adminAuth.js

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'aarogya-mitra-admin-secret-key-2025';
const JWT_EXPIRES_IN = '8h';

// ========== VERIFY JWT TOKEN ==========
export function verifyAdminToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        
        req.adminUser = {
            id: decoded.id,
            username: decoded.username,
            role: decoded.role,
            email: decoded.email,
            fullName: decoded.fullName
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired. Please login again.' });
        }
        return res.status(401).json({ error: 'Invalid token.' });
    }
}

// ========== ROLE-BASED ACCESS CONTROL ==========
export function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.adminUser) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        if (!allowedRoles.includes(req.adminUser.role)) {
            return res.status(403).json({ 
                error: 'Access denied. Insufficient permissions.',
                requiredRoles: allowedRoles,
                yourRole: req.adminUser.role
            });
        }

        next();
    };
}

// ========== SPECIFIC ROLE CHECKS ==========
export const requireSuperAdmin = requireRole('super_admin');
export const requireOperator = requireRole('super_admin', 'aarogya_operator');
export const requireDoctor = requireRole('super_admin', 'doctor');
export const requireHospitalAdmin = requireRole('super_admin', 'hospital_admin');
export const requirePharmacy = requireRole('super_admin', 'pharmacy_operator');
export const requireLab = requireRole('super_admin', 'lab_operator');

// ========== VERIFY DOCTOR OWNERSHIP ==========
export function verifyDoctorOwnership(req, res, next) {
    const { role, id } = req.adminUser;
    
    if (role === 'super_admin') {
        return next();
    }

    if (role === 'doctor') {
        const db = req.app.get('db');
        
        db.get(
            'SELECT doctor_id FROM admin_users WHERE id = ?',
            [id],
            (err, row) => {
                if (err || !row || !row.doctor_id) {
                    return res.status(403).json({ error: 'Doctor account not linked.' });
                }
                
                req.doctorId = row.doctor_id;
                next();
            }
        );
    } else {
        return res.status(403).json({ error: 'Not authorized as doctor.' });
    }
}

// ========== VERIFY HOSPITAL OWNERSHIP ==========
export function verifyHospitalOwnership(req, res, next) {
    const { role, id } = req.adminUser;
    
    if (role === 'super_admin') {
        return next();
    }

    if (role === 'hospital_admin') {
        const db = req.app.get('db');
        
        db.get(
            'SELECT hospital_id FROM admin_users WHERE id = ?',
            [id],
            (err, row) => {
                if (err || !row || !row.hospital_id) {
                    return res.status(403).json({ error: 'Hospital account not linked.' });
                }
                
                req.hospitalId = row.hospital_id;
                next();
            }
        );
    } else {
        return res.status(403).json({ error: 'Not authorized as hospital admin.' });
    }
}

// ========== VERIFY PHARMACY OWNERSHIP ==========
export function verifyPharmacyOwnership(req, res, next) {
    const { role, id } = req.adminUser;
    
    if (role === 'super_admin') {
        return next();
    }

    if (role === 'pharmacy_operator') {
        const db = req.app.get('db');
        
        db.get(
            'SELECT pharmacy_id FROM admin_users WHERE id = ?',
            [id],
            (err, row) => {
                if (err || !row || !row.pharmacy_id) {
                    return res.status(403).json({ error: 'Pharmacy account not linked.' });
                }
                
                req.pharmacyId = row.pharmacy_id;
                next();
            }
        );
    } else {
        return res.status(403).json({ error: 'Not authorized as pharmacy operator.' });
    }
}

// ========== AUDIT LOGGING MIDDLEWARE ==========
export function auditLog(action, tableName = null) {
    return (req, res, next) => {
        const db = req.app.get('db');
        const adminUserId = req.adminUser?.id;
        
        if (!adminUserId) return next();

        const originalJson = res.json.bind(res);
        
        res.json = function(data) {
            db.run(`
                INSERT INTO audit_logs 
                (admin_user_id, action, table_name, ip_address)
                VALUES (?, ?, ?, ?)
            `, [
                adminUserId,
                action,
                tableName,
                req.ip || req.connection.remoteAddress
            ]);

            return originalJson(data);
        };

        next();
    };
}

// ========== GENERATE JWT TOKEN ==========
export function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            role: user.role,
            email: user.email,
            fullName: user.full_name
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

// ========== CHECK IF USER IS ACTIVE ==========
export function checkActiveUser(req, res, next) {
    const db = req.app.get('db');
    
    db.get(
        'SELECT is_active FROM admin_users WHERE id = ?',
        [req.adminUser.id],
        (err, row) => {
            if (err || !row || row.is_active !== 1) {
                return res.status(403).json({ 
                    error: 'Account deactivated. Contact administrator.' 
                });
            }
            next();
        }
    );
}