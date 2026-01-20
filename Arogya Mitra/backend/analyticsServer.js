// analyticsServer.js - Health Analytics Module
import dotenv from 'dotenv';
dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY_2;

// Helper function to calculate date ranges
function getDateRange(days) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
    };
}

// Analyze symptom patterns
function analyzeSymptoms(symptoms) {
    const keywordMap = new Map();
    const urgencyMap = new Map(['NORMAL', 0], ['HIGH', 0], ['URGENT', 0]);
    
    symptoms.forEach(symptom => {
        // Count urgency levels
        const urgency = symptom.urgency_level || 'NORMAL';
        urgencyMap.set(urgency, (urgencyMap.get(urgency) || 0) + 1);
        
        // Extract and count keywords
        const text = (symptom.symptoms_text || '').toLowerCase();
        const commonSymptoms = ['fever', 'cough', 'cold', 'headache', 'pain', 'nausea', 
                               'vomiting', 'diarrhea', 'fatigue', 'weakness', 'dizziness', 
                               'breathlessness', 'chest pain', 'stomach pain'];
        
        commonSymptoms.forEach(keyword => {
            if (text.includes(keyword)) {
                keywordMap.set(keyword, (keywordMap.get(keyword) || 0) + 1);
            }
        });
    });
    
    // Get top symptoms
    const topSymptoms = Array.from(keywordMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([symptom, count]) => ({ symptom, count }));
    
    return {
        total: symptoms.length,
        urgencyDistribution: Object.fromEntries(urgencyMap),
        topSymptoms,
        averagePerDay: Math.round(symptoms.length / 30)
    };
}

// Analyze appointment patterns
function analyzeAppointments(appointments) {
    const statusMap = new Map();
    const specialtyMap = new Map();
    const weekdayMap = new Map();
    
    appointments.forEach(appt => {
        // Count by status
        const status = appt.status || 'pending';
        statusMap.set(status, (statusMap.get(status) || 0) + 1);
        
        // Count by specialty
        const specialty = appt.specialization || 'General Physician';
        specialtyMap.set(specialty, (specialtyMap.get(specialty) || 0) + 1);
        
        // Count by weekday
        if (appt.appointment_date) {
            const date = new Date(appt.appointment_date);
            const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
            weekdayMap.set(weekday, (weekdayMap.get(weekday) || 0) + 1);
        }
    });
    
    return {
        total: appointments.length,
        statusDistribution: Object.fromEntries(statusMap),
        topSpecialties: Array.from(specialtyMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([specialty, count]) => ({ specialty, count })),
        weekdayDistribution: Object.fromEntries(weekdayMap),
        averagePerWeek: Math.round(appointments.length / 4)
    };
}

// Generate AI-powered insights
async function generateHealthInsights(analyticsData, userProfile) {
    try {
        const { symptoms, appointments, prescriptions, labReports } = analyticsData;
        const region = userProfile?.state || 'the region';
        
        const prompt = `You are a public health analyst for rural India. Analyze this community health data and provide 3 actionable insights:

Health Data Summary:
- Total symptom checks: ${symptoms.total || 0}
- Urgent cases: ${symptoms.urgencyDistribution?.URGENT || 0}
- Total appointments: ${appointments.total || 0}
- Top symptoms: ${symptoms.topSymptoms?.slice(0, 3).map(s => s.symptom).join(', ') || 'N/A'}
- Region: ${region}
- Active prescriptions: ${prescriptions?.length || 0}
- Lab reports: ${labReports?.length || 0}

Provide exactly 3 insights in this format:
1. [Insight Title]: [Brief explanation and actionable recommendation for community health]
2. [Insight Title]: [Brief explanation and actionable recommendation for community health]
3. [Insight Title]: [Brief explanation and actionable recommendation for community health]

Focus on:
- Disease prevention strategies
- Healthcare access improvements
- Community health awareness
- Seasonal health concerns relevant to ${region}

Keep each insight concise (2-3 sentences) and actionable.`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a public health expert specializing in rural healthcare in India. Provide practical, actionable insights.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 600
            })
        });

        if (!response.ok) {
            throw new Error('AI insights generation failed');
        }

        const data = await response.json();
        return data.choices[0].message.content;

    } catch (error) {
        console.error('AI insights error:', error);
        return null;
    }
}

// Register analytics routes
export function registerAnalyticsRoutes(app, db) {
    
    // Get symptom analytics
    app.get('/api/analytics/symptoms', (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const days = parseInt(req.query.days) || 30;
        const dateRange = getDateRange(days);

        db.all(`
            SELECT 
                sc.symptoms_text,
                sc.severity,
                sc.created_at,
                sr.urgency_level
            FROM symptom_checks sc
            LEFT JOIN symptom_responses sr ON sc.id = sr.check_id
            WHERE sc.created_at >= ?
            ORDER BY sc.created_at DESC
        `, [dateRange.start], (err, rows) => {
            if (err) {
                console.error('Symptom analytics error:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            const analysis = analyzeSymptoms(rows || []);
            res.json({
                dateRange,
                analysis,
                history: rows || []
            });
        });
    });

    // Get appointment analytics
    app.get('/api/analytics/appointments', (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const days = parseInt(req.query.days) || 30;
        const dateRange = getDateRange(days);

        db.all(`
            SELECT 
                a.appointment_date,
                a.appointment_time,
                a.status,
                a.symptoms,
                d.specialization,
                h.name as hospital_name
            FROM appointments a
            LEFT JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN hospitals h ON a.hospital_id = h.id
            WHERE a.appointment_date >= ?
            ORDER BY a.appointment_date DESC
        `, [dateRange.start], (err, rows) => {
            if (err) {
                console.error('Appointment analytics error:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            const analysis = analyzeAppointments(rows || []);
            res.json({
                dateRange,
                analysis,
                appointments: rows || []
            });
        });
    });

    // Get comprehensive health analytics
    app.get('/api/analytics/comprehensive', async (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            const days = parseInt(req.query.days) || 30;
            const dateRange = getDateRange(days);

            // Get user profile
            const userProfile = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM users WHERE id = ?', [req.session.userId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            // Get all analytics data in parallel
            const [symptoms, appointments, prescriptions, labReports] = await Promise.all([
                new Promise((resolve) => {
                    db.all(`
                        SELECT sc.*, sr.urgency_level
                        FROM symptom_checks sc
                        LEFT JOIN symptom_responses sr ON sc.id = sr.check_id
                        WHERE sc.created_at >= ?
                    `, [dateRange.start], (err, rows) => {
                        resolve(analyzeSymptoms(rows || []));
                    });
                }),
                new Promise((resolve) => {
                    db.all(`
                        SELECT a.*, d.specialization
                        FROM appointments a
                        LEFT JOIN doctors d ON a.doctor_id = d.id
                        WHERE a.appointment_date >= ?
                    `, [dateRange.start], (err, rows) => {
                        resolve(analyzeAppointments(rows || []));
                    });
                }),
                new Promise((resolve) => {
                    db.all(`
                        SELECT * FROM prescriptions 
                        WHERE user_id = ? AND uploaded_at >= ?
                    `, [req.session.userId, dateRange.start], (err, rows) => {
                        resolve(rows || []);
                    });
                }),
                new Promise((resolve) => {
                    db.all(`
                        SELECT * FROM lab_reports 
                        WHERE user_id = ? AND uploaded_at >= ?
                    `, [req.session.userId, dateRange.start], (err, rows) => {
                        resolve(rows || []);
                    });
                })
            ]);

            const analyticsData = { symptoms, appointments, prescriptions, labReports };

            // Generate AI insights
            const aiInsights = await generateHealthInsights(analyticsData, userProfile);

            res.json({
                dateRange,
                analytics: analyticsData,
                aiInsights,
                summary: {
                    totalHealthChecks: symptoms.total,
                    totalAppointments: appointments.total,
                    activePrescriptions: prescriptions.length,
                    labReports: labReports.length,
                    urgentCases: symptoms.urgencyDistribution?.URGENT || 0
                }
            });

        } catch (error) {
            console.error('Comprehensive analytics error:', error);
            res.status(500).json({ error: 'Failed to generate analytics' });
        }
    });

    // Get trending health conditions
    app.get('/api/analytics/trending-conditions', (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const days = parseInt(req.query.days) || 30;
        const dateRange = getDateRange(days);

        db.all(`
            SELECT symptom_name, COUNT(*) as count
            FROM symptom_keywords
            WHERE check_id IN (
                SELECT id FROM symptom_checks
                WHERE created_at >= ?
            )
            GROUP BY symptom_name
            ORDER BY count DESC
            LIMIT 10
        `, [dateRange.start], (err, rows) => {
            if (err) {
                console.error('Trending conditions error:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({
                dateRange,
                conditions: rows || []
            });
        });
    });

    // Get age group distribution
    app.get('/api/analytics/age-distribution', (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        db.all(`
            SELECT 
                CASE 
                    WHEN age < 19 THEN '0-18'
                    WHEN age < 36 THEN '19-35'
                    WHEN age < 51 THEN '36-50'
                    WHEN age < 66 THEN '51-65'
                    ELSE '65+'
                END as age_group,
                COUNT(*) as count
            FROM symptom_checks
            WHERE age IS NOT NULL
            GROUP BY age_group
            ORDER BY age_group
        `, [], (err, rows) => {
            if (err) {
                console.error('Age distribution error:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({
                distribution: rows || []
            });
        });
    });

    console.log('✅ Analytics routes registered');
}

export default registerAnalyticsRoutes;