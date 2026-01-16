// ================= SYMPTOM CHECKER MODULE WITH MULTI-LANGUAGE =================
// symptomServer.js - Handles symptom checking with user's preferred language
// Using Groq API for fast, reliable AI responses

import dotenv from 'dotenv';
dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY_2;

// Language mappings
const LANGUAGE_NAMES = {
    en: 'English',
    hi: 'Hindi',
    ta: 'Tamil',
    te: 'Telugu',
    kn: 'Kannada',
    ml: 'Malayalam',
    mr: 'Marathi',
    bn: 'Bengali',
    gu: 'Gujarati',
    pa: 'Punjabi'
};

// Helper function to call Groq API with language support
async function callGroqAPI(prompt, responseLang = 'en') {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    
    const langName = LANGUAGE_NAMES[responseLang] || 'English';
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: `You are a medical AI assistant for rural healthcare in India. Provide compassionate, helpful guidance in ${langName}. Always respond in ${langName} language, even if the input is in a different language.`
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Groq API Error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
        
    } catch (error) {
        console.error('Groq API error:', error);
        throw error;
    }
}

// Helper function to extract symptom keywords (multi-language)
function extractSymptomKeywords(text) {
    const commonSymptoms = [
        // English
        'fever', 'cough', 'cold', 'headache', 'pain', 'nausea', 'vomiting',
        'diarrhea', 'fatigue', 'weakness', 'dizziness', 'breathlessness',
        'chest pain', 'stomach pain', 'body ache', 'sore throat', 'runny nose',
        'congestion', 'rash', 'itching', 'swelling', 'bleeding', 'chills',
        // Hindi
        'बुखार', 'खांसी', 'सिर दर्द', 'दर्द', 'उलटी', 'कमजोरी', 'चक्कर',
        // Tamil
        'காய்ச்சல்', 'இருமல்', 'தலைவலி',
        // Telugu
        'జ్వరం', 'దగ్గు', 'తలనొప్పి',
        // Kannada
        'ಜ್ವರ', 'ಕೆಮ್ಮು', 'ತಲೆನೋವು'
    ];
    
    const found = [];
    const lowerText = text.toLowerCase();
    
    commonSymptoms.forEach(symptom => {
        if (lowerText.includes(symptom)) {
            found.push(symptom);
        }
    });
    
    return [...new Set(found)];
}

// Initialize database tables
function initializeSymptomTables(db) {
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS symptom_checks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                symptoms_text TEXT NOT NULL,
                age INTEGER,
                gender TEXT,
                duration TEXT,
                severity TEXT,
                response_language TEXT DEFAULT 'en',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS symptom_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                check_id INTEGER NOT NULL,
                ai_response TEXT NOT NULL,
                possible_conditions TEXT,
                recommendations TEXT,
                urgency_level TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(check_id) REFERENCES symptom_checks(id)
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS symptom_keywords (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                check_id INTEGER NOT NULL,
                symptom_name TEXT NOT NULL,
                FOREIGN KEY(check_id) REFERENCES symptom_checks(id)
            )
        `);
    });

    console.log("✅ Symptom Checker tables initialized");
}

// Register symptom checker routes
function registerSymptomRoutes(app, db) {
    
    // Main symptom checker endpoint with multi-language support
    app.post("/api/symptom-check", async (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: "Session expired" });
        }

        const { symptoms, age, gender, duration, severity } = req.body;

        if (!symptoms || symptoms.trim().length === 0) {
            return res.status(400).json({ error: "Please describe your symptoms" });
        }

        try {
            // Get user info including language preference
            const user = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT name, gender, age, preferred_language FROM users WHERE id = ?`,
                    [req.session.userId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            const userLanguage = user.preferred_language || 'en';
            const langName = LANGUAGE_NAMES[userLanguage] || 'English';

            // Build context-aware prompt
            const prompt = `
RESPOND IN ${langName.toUpperCase()} LANGUAGE ONLY.

Patient Information:
- Gender: ${gender || user.gender || 'Not specified'}
- Age: ${age || user.age || 'Not specified'}
- Symptom Duration: ${duration || 'Not specified'}
- Severity: ${severity || 'Not specified'}

Symptoms Described:
${symptoms}

Please provide a complete health analysis in ${langName} language with:

1. संभावित स्थितियां (Possible Conditions): 2-3 most likely conditions
2. गंभीरता मूल्यांकन (Severity Assessment): Mild/Moderate/Severe/Emergency
3. स्व-देखभाल सिफारिशें (Self-care Recommendations): What they can do at home
4. कब तत्काल चिकित्सा सहायता लें (When to seek immediate help)
5. सामान्य स्वास्थ्य सलाह (General Health Advice)

CRITICAL INSTRUCTIONS:
- Write EVERYTHING in ${langName}
- Use simple, clear language appropriate for rural patients
- Be empathetic and reassuring
- Consider Indian rural healthcare context
- If symptoms are severe (chest pain, difficulty breathing, severe bleeding), clearly state "तुरंत चिकित्सा सहायता लें" or equivalent
- Format with clear sections

Response:`;

            // Call Groq API with user's language
            const aiResponse = await callGroqAPI(prompt, userLanguage);

            // Determine urgency level
            const urgencyKeywords = {
                en: ['immediate', 'emergency', 'urgent', 'seek medical'],
                hi: ['तुरंत', 'आपातकाल', 'चिकित्सा सहायता', 'डॉक्टर से मिलें'],
                ta: ['உடனடி', 'அவசர', 'மருத்துவ உதவி'],
                te: ['తక్షణ', 'అత్యవసర', 'వైద్య సహాయం'],
                kn: ['ತಕ್ಷಣ', 'ತುರ್ತು', 'ವೈದ್ಯಕೀಯ ಸಹಾಯ'],
                ml: ['ഉടനടി', 'അടിയന്തിര', 'വൈദ്യസഹായം'],
                mr: ['तात्काळ', 'आपत्कालीन', 'वैद्यकीय मदत'],
                bn: ['অবিলম্বে', 'জরুরি', 'চিকিৎসা সাহায্য']
            };

            const checkUrgency = (text) => {
                const lowerText = text.toLowerCase();
                const keywords = urgencyKeywords[userLanguage] || urgencyKeywords['en'];
                return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
            };

            const isUrgent = checkUrgency(aiResponse);
            const urgencyLevel = isUrgent ? 'URGENT' : (severity === 'severe' ? 'HIGH' : 'NORMAL');

            // Extract symptom keywords
            const keywords = extractSymptomKeywords(symptoms);

            // Save to database
            db.run(
                `INSERT INTO symptom_checks 
                 (user_id, symptoms_text, age, gender, duration, severity, response_language)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    req.session.userId,
                    symptoms,
                    age || user.age,
                    gender || user.gender,
                    duration,
                    severity,
                    userLanguage
                ],
                function(err) {
                    if (err) {
                        console.error('Error saving symptom check:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }

                    const checkId = this.lastID;

                    // Save AI response
                    db.run(
                        `INSERT INTO symptom_responses
                         (check_id, ai_response, urgency_level)
                         VALUES (?, ?, ?)`,
                        [checkId, aiResponse, urgencyLevel],
                        (err) => {
                            if (err) console.error('Error saving response:', err);
                        }
                    );

                    // Save keywords
                    keywords.forEach(keyword => {
                        db.run(
                            `INSERT INTO symptom_keywords (check_id, symptom_name)
                             VALUES (?, ?)`,
                            [checkId, keyword],
                            (err) => {
                                if (err) console.error('Error saving keyword:', err);
                            }
                        );
                    });

                    // Return response
                    res.json({
                        success: true,
                        checkId: checkId,
                        response: aiResponse,
                        urgencyLevel: urgencyLevel,
                        keywords: keywords,
                        language: userLanguage,
                        timestamp: new Date().toISOString()
                    });
                }
            );

        } catch (error) {
            console.error('Symptom check error:', error);
            res.status(500).json({ 
                error: 'Unable to process symptoms. Please try again.' 
            });
        }
    });

    // Get symptom check history
    app.get("/api/symptom-history", (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: "Session expired" });
        }

        db.all(
            `SELECT 
                sc.id,
                sc.symptoms_text,
                sc.severity,
                sc.response_language,
                sc.created_at,
                sr.urgency_level,
                sr.ai_response
             FROM symptom_checks sc
             LEFT JOIN symptom_responses sr ON sc.id = sr.check_id
             WHERE sc.user_id = ?
             ORDER BY sc.created_at DESC
             LIMIT 10`,
            [req.session.userId],
            (err, rows) => {
                if (err) {
                    console.error('Error fetching history:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json({ history: rows || [] });
            }
        );
    });

    // Get specific symptom check details
    app.get("/api/symptom-check/:id", (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: "Session expired" });
        }

        const checkId = req.params.id;

        db.get(
            `SELECT 
                sc.*,
                sr.ai_response,
                sr.urgency_level
             FROM symptom_checks sc
             LEFT JOIN symptom_responses sr ON sc.id = sr.check_id
             WHERE sc.id = ? AND sc.user_id = ?`,
            [checkId, req.session.userId],
            (err, row) => {
                if (err) {
                    console.error('Error fetching check:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                if (!row) {
                    return res.status(404).json({ error: 'Check not found' });
                }

                // Get keywords
                db.all(
                    `SELECT symptom_name FROM symptom_keywords WHERE check_id = ?`,
                    [checkId],
                    (err, keywords) => {
                        if (err) {
                            console.error('Error fetching keywords:', err);
                        }
                        res.json({
                            ...row,
                            keywords: keywords ? keywords.map(k => k.symptom_name) : []
                        });
                    }
                );
            }
        );
    });

    console.log("✅ Multi-language Symptom Checker routes registered");
}

export {
    initializeSymptomTables,
    registerSymptomRoutes
};
