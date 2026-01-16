// backend/aarogyaconnect.js
// ================= IMPORTS =================
import dotenv from 'dotenv';
dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY_2;
const GEOAPIFY_API_KEY = process.env.Geoapify_API_KEY;

// ================= ENVIRONMENT CHECK (NEW) =================
function checkEnvironmentVariables() {
    console.log('\n🔍 Environment Variables Check:');
    console.log('================================');
    console.log('GROQ_API_KEY_2 present:', !!GROQ_API_KEY);
    console.log('GROQ_API_KEY_2 length:', GROQ_API_KEY?.length || 0);
    console.log('Geoapify_API_KEY present:', !!GEOAPIFY_API_KEY);
    console.log('Geoapify_API_KEY length:', GEOAPIFY_API_KEY?.length || 0);
    console.log('================================\n');

    if (!GROQ_API_KEY) {
        console.error('⚠️ WARNING: GROQ_API_KEY_2 is not set! AI features will not work.');
    }
    if (!GEOAPIFY_API_KEY) {
        console.error('⚠️ WARNING: Geoapify_API_KEY is not set! Location features will not work.');
    }
}

// Call it immediately
checkEnvironmentVariables();

// ================= INITIALIZE TABLES =================
export function initializeAarogyaConnectTables(db) {
    db.serialize(() => {
        // Hospitals table
        db.run(`
            CREATE TABLE IF NOT EXISTS hospitals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                address TEXT,
                phone TEXT,
                distance REAL,
                latitude REAL,
                longitude REAL,
                facilities TEXT,
                emergency_available INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Doctors table
        db.run(`
            CREATE TABLE IF NOT EXISTS doctors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hospital_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                specialization TEXT,
                experience_years INTEGER,
                consultation_fee INTEGER,
                rating REAL,
                available_days TEXT,
                available_time TEXT,
                languages TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
            )
        `);

        // User saved hospitals
        db.run(`
            CREATE TABLE IF NOT EXISTS user_saved_hospitals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                hospital_id INTEGER NOT NULL,
                saved_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(hospital_id) REFERENCES hospitals(id),
                UNIQUE(user_id, hospital_id)
            )
        `);

        // Enhanced Appointments table
        db.run(`
            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                booking_id TEXT UNIQUE,
                user_id INTEGER NOT NULL,
                doctor_id INTEGER NOT NULL,
                hospital_id INTEGER NOT NULL,
                appointment_date TEXT,
                appointment_time TEXT,
                symptoms TEXT,
                status TEXT DEFAULT 'pending',
                notes TEXT,
                pre_tests TEXT,
                consultation_fee INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(doctor_id) REFERENCES doctors(id),
                FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
            )
        `);
    });
}

// ================= HELPER: GROQ API CALL (NEW) =================
async function makeGroqAPICall(prompt, temperature = 0.7, maxTokens = 400) {
    try {
        console.log('🔄 Making Groq API call...');
        
        if (!GROQ_API_KEY || GROQ_API_KEY === 'undefined') {
            throw new Error('GROQ_API_KEY not configured');
        }
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: temperature,
                max_tokens: maxTokens
            })
        });

        console.log('📡 Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error Response:', errorText);
            throw new Error(`API returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('✅ API call successful');
        return data;

    } catch (error) {
        console.error('❌ Groq API Error:', error.message);
        throw error;
    }
}

// ================= GEOAPIFY FUNCTIONS =================
async function getCoordinatesFromPincode(pincode, state) {
    try {
        const query = encodeURIComponent(`${pincode}, ${state}, India`);
        const url = `https://api.geoapify.com/v1/geocode/search?text=${query}&apiKey=${GEOAPIFY_API_KEY}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Geocoding failed');
        
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
            const coords = data.features[0].geometry.coordinates;
            return {
                latitude: coords[1],
                longitude: coords[0]
            };
        }
        
        throw new Error('No coordinates found');
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return Math.round(distance * 10) / 10;
}

// ================= SIMPLIFIED HOSPITAL SEARCH - RETURN 10 =================
async function searchHospitalsMultiRadius(latitude, longitude) {
    const allHospitals = new Map();
    const categoryGroups = [
        'healthcare.hospital',
        'healthcare.clinic', 
        'healthcare.doctor',
        'healthcare'
    ];

    const searches = [
        { radius: 1000, limit: 20 },
        { radius: 3000, limit: 20 },
        { radius: 5000, limit: 20 },
        { radius: 10000, limit: 15 }
    ];

    console.log('🔍 Searching for top 10 hospitals...');

    for (const category of categoryGroups) {
        for (const search of searches) {
            try {
                const url = `https://api.geoapify.com/v2/places?categories=${category}&filter=circle:${longitude},${latitude},${search.radius}&bias=proximity:${longitude},${latitude}&limit=${search.limit}&apiKey=${GEOAPIFY_API_KEY}`;
                
                const response = await fetch(url);
                if (!response.ok) continue;
                
                const data = await response.json();
                
                if (data.features && data.features.length > 0) {
                    data.features.forEach(feature => {
                        const props = feature.properties;
                        const coords = feature.geometry.coordinates;
                        const distance = calculateDistance(latitude, longitude, coords[1], coords[0]);
                        
                        let name = props.name || 
                                   props.address_line1 || 
                                   props.street ||
                                   'Healthcare Center';
                        
                        name = name.trim();
                        if (/^\d+$/.test(name) || name.length < 3) {
                            name = `Healthcare Facility ${Math.floor(distance * 10)}`;
                        }
                        
                        const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
                        const locationKey = `${coords[1].toFixed(3)}-${coords[0].toFixed(3)}`;
                        const key = `${normalizedName}-${locationKey}`;
                        
                        const phone = props.datasource?.raw?.phone || 
                                     props.contact?.phone ||
                                     'Not available';
                        
                        const address = props.formatted || 
                                       props.address_line2 ||
                                       `${props.street || ''} ${props.city || ''}`.trim() ||
                                       'Address not available';
                        
                        if (!allHospitals.has(key) && distance <= 15) {
                            allHospitals.set(key, {
                                name: name,
                                address: address,
                                latitude: coords[1],
                                longitude: coords[0],
                                distance: distance,
                                phone: phone,
                                category: category
                            });
                        }
                    });
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`Search failed:`, error.message);
            }
            
            if (allHospitals.size >= 15) break;
        }
        if (allHospitals.size >= 15) break;
    }

    const results = Array.from(allHospitals.values())
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10);
    
    console.log(`✅ Found ${results.length} hospitals`);
    return results;
}

// ================= GENERATE DOCTORS WITH AI =================
async function generateDoctorsForHospital(hospital, userProfile) {
    try {
        const { gender = 'general', age = 40 } = userProfile;
        const isHospital = hospital.name.toLowerCase().includes('hospital');
        const numDoctors = isHospital ? 5 : 3;

        const prompt = `Generate ${numDoctors} realistic doctors for: ${hospital.name} (${hospital.distance}km away)

Hospital Type: ${isHospital ? 'Full Hospital' : 'Clinic/Healthcare Center'}
Patient: ${gender}, age ${age}

Generate doctors with these details:
- name: Indian doctor names with Dr. prefix (use diverse surnames: Kumar, Sharma, Patel, Singh, Reddy, Rao, Iyer, Mehta, Verma, Gupta, Desai, Nair)
- specialization: ${isHospital ? 'Mix of General Physician, Cardiologist, Orthopedic, Gynecologist, Pediatrician, Dermatologist' : 'Mostly General Physician, 1-2 specialists'}
- experience_years: 5-35 years (realistic variation)
- consultation_fee: ₹300-3000 (vary by experience and specialization, no restrictions)
- rating: 3.5-4.0 (MUST be single decimal like 3.7, 3.9, 4.0 - keep it realistic and below 4.1)
- available_days: realistic schedules (Mon-Sat, Mon-Fri, Tue-Sun, Mon,Wed,Fri,Sat)
- available_time: realistic hours (e.g., "9:00 AM - 1:00 PM, 5:00 PM - 8:00 PM" or "10:00 AM - 6:00 PM")
- languages: array of 3-5 languages including English and regional (Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Punjabi)

Return JSON array ONLY:
[
  {
    "name": "Dr. ...",
    "specialization": "...",
    "experience_years": 10,
    "consultation_fee": 500,
    "rating": 3.8,
    "available_days": "Mon-Sat",
    "available_time": "9:00 AM - 6:00 PM",
    "languages": ["English", "Hindi", "Tamil"]
  }
]

NO markdown, NO explanation, ONLY JSON array.`;

        const data = await makeGroqAPICall(prompt, 0.8, 1500);
        let content = data.choices[0].message.content;
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        const doctors = JSON.parse(content);
        
        doctors.forEach(doc => {
            if (doc.rating > 4.0) doc.rating = 4.0;
            doc.rating = Math.round(doc.rating * 10) / 10;
        });
        
        console.log(`✅ Generated ${doctors.length} REAL doctors for ${hospital.name}`);
        return doctors;

    } catch (error) {
        console.error(`❌ Doctor generation failed for ${hospital.name}:`, error.message);
        return null;
    }
}

// ================= FALLBACK DOCTORS =================
function getFallbackDoctors(isHospital) {
    const specializations = ['General Physician', 'Cardiologist', 'Orthopedic', 'Pediatrician', 'Dermatologist'];
    const surnames = ['Kumar', 'Sharma', 'Patel', 'Singh', 'Reddy', 'Mehta', 'Gupta', 'Verma', 'Rao', 'Iyer'];
    const numDoctors = isHospital ? 5 : 3;
    
    return Array.from({ length: numDoctors }, (_, i) => ({
        name: `Dr. ${surnames[i % surnames.length]}`,
        specialization: specializations[i % specializations.length],
        experience_years: 8 + (i * 4),
        consultation_fee: 350 + (i * 150),
        rating: Math.round((3.5 + (i * 0.1)) * 10) / 10,
        available_days: i % 2 === 0 ? 'Mon-Sat' : 'Mon-Fri',
        available_time: '9:00 AM - 6:00 PM',
        languages: ['English', 'Hindi', 'Tamil']
    }));
}

// ================= GENERATE HOSPITALS WITH DOCTORS =================
async function generateNearbyHospitals(userProfile) {
    try {
        const { pincode = '600001', state = 'Tamil Nadu' } = userProfile;
        
        console.log(`🔍 Searching hospitals near ${pincode}, ${state}...`);
        
        const userCoords = await getCoordinatesFromPincode(pincode, state);
        
        if (!userCoords) {
            console.log('❌ Geocoding failed, using mock data');
            return getMockHospitals(userProfile);
        }
        
        console.log(`📍 User location: ${userCoords.latitude.toFixed(4)}, ${userCoords.longitude.toFixed(4)}`);
        
        const hospitals = await searchHospitalsMultiRadius(userCoords.latitude, userCoords.longitude);
        
        if (hospitals.length === 0) {
            console.log('❌ No facilities found, using mock data');
            return getMockHospitals(userProfile);
        }
        
        console.log(`⚙️ Generating doctors for ${hospitals.length} hospitals...`);
        
        const hospitalsWithRealDoctors = [];
        const hospitalsWithMockDoctors = [];
        
        for (let i = 0; i < hospitals.length; i++) {
            const hospital = hospitals[i];
            
            console.log(`Processing ${i + 1}/${hospitals.length}: ${hospital.name}`);
            
            const doctors = await generateDoctorsForHospital(hospital, userProfile);
            
            const isHospital = hospital.name.toLowerCase().includes('hospital');
            const facilities = isHospital 
                ? "ICU, Emergency, OPD, Lab, X-Ray, Pharmacy, CT Scan"
                : "OPD, Consultation, Lab, Pharmacy";
            
            const hospitalData = {
                name: hospital.name,
                address: hospital.address,
                distance: hospital.distance,
                latitude: hospital.latitude,
                longitude: hospital.longitude,
                phone: hospital.phone,
                facilities: facilities,
                emergency_available: isHospital ? 1 : 0,
                doctors: doctors || getFallbackDoctors(isHospital),
                hasRealData: doctors !== null
            };
            
            if (doctors !== null) {
                hospitalsWithRealDoctors.push(hospitalData);
                console.log(`✅ REAL DATA for ${hospital.name}`);
            } else {
                hospitalsWithMockDoctors.push(hospitalData);
                console.log(`⚠️ MOCK DATA for ${hospital.name}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 600));
        }

        const processedHospitals = [...hospitalsWithRealDoctors, ...hospitalsWithMockDoctors];
        
        console.log(`✅ Total: ${processedHospitals.length} hospitals (${hospitalsWithRealDoctors.length} with real data, ${hospitalsWithMockDoctors.length} with mock data)`);
        
        return processedHospitals;

    } catch (error) {
        console.error('❌ Critical error:', error);
        return getMockHospitals(userProfile);
    }
}

// ================= HEALTH FACTS GENERATOR =================
async function generateHealthFact() {
    try {
        const topics = [
            'recent medical breakthroughs',
            'disease prevention tips',
            'nutrition and wellness',
            'mental health awareness',
            'seasonal health tips',
            'common health myths debunked',
            'exercise and fitness',
            'sleep and health',
            'immunity boosting tips',
            'chronic disease management'
        ];
        
        const randomTopic = topics[Math.floor(Math.random() * topics.length)];
        
        const prompt = `Generate 1 interesting, recent health fact about: ${randomTopic}

Requirements:
- Should be factual and helpful
- Include current year (2025-2026) context if relevant
- Keep it concise (2-3 sentences)
- Make it engaging and actionable
- Focus on practical health information

Return ONLY the fact text, no JSON, no formatting, just the fact.`;

        const data = await makeGroqAPICall(prompt, 0.7, 200);
        const fact = data.choices[0].message.content.trim();
        
        console.log('✅ Generated health fact');
        return fact;

    } catch (error) {
        console.error('Error generating health fact:', error);
        const fallbackFacts = [
            "Regular physical activity reduces the risk of chronic diseases by up to 50%. Just 30 minutes of moderate exercise daily can significantly improve heart health, mental well-being, and overall longevity.",
            "Proper hydration is crucial for health. Drinking 8-10 glasses of water daily helps maintain body temperature, aids digestion, and improves cognitive function. Dehydration can lead to fatigue and reduced concentration.",
            "Getting 7-9 hours of quality sleep strengthens immunity, improves memory, and reduces stress. Poor sleep is linked to obesity, diabetes, and cardiovascular diseases.",
            "A balanced diet rich in fruits, vegetables, whole grains, and lean proteins provides essential nutrients. Limiting processed foods and sugar intake can prevent many lifestyle diseases.",
            "Mental health is as important as physical health. Regular meditation, social connections, and seeking help when needed can significantly improve overall well-being and life quality."
        ];
        return fallbackFacts[Math.floor(Math.random() * fallbackFacts.length)];
    }
}

// ================= MOCK DATA =================
function getMockHospitals(userProfile) {
    const { pincode = '600001', state = 'Tamil Nadu' } = userProfile;

    return [
        {
            name: "Apollo Hospitals",
            address: `21 Greams Lane, Near ${pincode}, ${state}`,
            distance: 2.3,
            latitude: 13.0569,
            longitude: 80.2425,
            phone: "+91 44 2829 3333",
            facilities: "ICU, Emergency, Pharmacy, Lab, X-Ray, MRI, CT Scan",
            emergency_available: 1,
            hasRealData: false,
            doctors: [
                {
                    name: "Dr. Rajesh Kumar",
                    specialization: "Cardiologist",
                    experience_years: 15,
                    consultation_fee: 800,
                    rating: 3.9,
                    available_days: "Mon-Sat",
                    available_time: "9:00 AM - 5:00 PM",
                    languages: ["English", "Hindi", "Tamil"]
                },
                {
                    name: "Dr. Priya Sharma",
                    specialization: "General Physician",
                    experience_years: 10,
                    consultation_fee: 500,
                    rating: 3.8,
                    available_days: "Mon-Fri",
                    available_time: "10:00 AM - 6:00 PM",
                    languages: ["English", "Hindi"]
                }
            ]
        },
        {
            name: "City Health Clinic",
            address: `Main Road, ${pincode}, ${state}`,
            distance: 1.5,
            latitude: 13.0500,
            longitude: 80.2400,
            phone: "Not available",
            facilities: "OPD, Consultation, Lab, Pharmacy",
            emergency_available: 0,
            hasRealData: false,
            doctors: [
                {
                    name: "Dr. Anil Mehta",
                    specialization: "General Physician",
                    experience_years: 12,
                    consultation_fee: 400,
                    rating: 3.7,
                    available_days: "Mon-Sat",
                    available_time: "9:00 AM - 6:00 PM",
                    languages: ["English", "Hindi", "Tamil"]
                }
            ]
        }
    ];
}

// ================= AI RECOMMENDATION =================
async function getAIRecommendation(userProfile, symptoms, hospitals) {
    try {
        const nearby = hospitals.slice(0, 10);
        
        const prompt = `Recommend the BEST hospital for this patient.

Patient: Age ${userProfile.age}, ${userProfile.gender}
Symptoms: ${symptoms || 'General consultation'}
Location: ${userProfile.address?.pincode || 'Not specified'}

Hospitals:
${nearby.map((h, i) => `${i + 1}. ${h.name} - ${h.distance}km
   Doctors: ${h.doctors.map(d => d.specialization).join(', ')}
   Emergency: ${h.emergency_available ? 'Yes' : 'No'}`).join('\n\n')}

Return JSON:
{
  "recommendedHospital": "exact name",
  "reason": "why (mention distance, specialty)",
  "urgencyLevel": "routine/urgent/emergency",
  "suggestedTests": [],
  "alternativeHospitals": ["name2", "name3"]
}

ONLY JSON, no markdown.`;

        const data = await makeGroqAPICall(prompt, 0.4, 500);
        let content = data.choices[0].message.content;
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(content);
    } catch (error) {
        console.error('Recommendation error:', error);
        return {
            recommendedHospital: hospitals[0]?.name || 'N/A',
            reason: `Nearest facility at ${hospitals[0]?.distance}km with appropriate services.`,
            urgencyLevel: 'routine',
            suggestedTests: [],
            alternativeHospitals: hospitals.slice(1, 3).map(h => h.name)
        };
    }
}

// ================= SAVE TO DATABASE =================
function saveHospitalsToDatabase(db, hospitals) {
    return new Promise((resolve) => {
        db.serialize(() => {
            hospitals.forEach(hospital => {
                db.run(
                    `INSERT INTO hospitals (name, address, phone, distance, latitude, longitude, facilities, emergency_available) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [hospital.name, hospital.address, hospital.phone, hospital.distance, 
                     hospital.latitude, hospital.longitude, hospital.facilities, hospital.emergency_available],
                    function(err) {
                        if (err) return;
                        
                        const hospitalId = this.lastID;
                        
                        hospital.doctors.forEach(doctor => {
                            db.run(
                                `INSERT INTO doctors (hospital_id, name, specialization, experience_years, consultation_fee, rating, available_days, available_time, languages) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [hospitalId, doctor.name, doctor.specialization, doctor.experience_years,
                                 doctor.consultation_fee, doctor.rating, doctor.available_days,
                                 doctor.available_time, JSON.stringify(doctor.languages)]
                            );
                        });
                    }
                );
            });
            resolve();
        });
    });
}

function generateBookingId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `AM${timestamp}${random}`.toUpperCase();
}

// ================= ROUTES =================
export function registerAarogyaConnectRoutes(app, db) {
    
    // Get health fact
    app.get('/api/health/fact', async (req, res) => {
        try {
            const fact = await generateHealthFact();
            res.json({ fact });
        } catch (error) {
            console.error('Error:', error);
            res.json({ fact: 'Stay healthy, stay active! Regular exercise and balanced diet are key to wellness.' });
        }
    });

    // Get nearby hospitals
    app.post('/api/hospitals/nearby', async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const userProfile = req.body;
            const hospitals = await generateNearbyHospitals(userProfile);
            await saveHospitalsToDatabase(db, hospitals);

            res.json({ hospitals });
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ 
                error: 'Failed to fetch hospitals',
                hospitals: getMockHospitals(req.body)
            });
        }
    });

    // Get recent symptoms
    app.get('/api/symptoms/recent', (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        db.get(
            `SELECT symptoms_text, created_at FROM symptom_checks 
             WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
            [req.session.userId],
            (err, row) => {
                if (err || !row) return res.json({ symptoms: null });
                res.json({ symptoms: row.symptoms_text, date: row.created_at });
            }
        );
    });

    // Get recommendation
    app.post('/api/hospitals/recommend', async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { userProfile, symptoms, hospitals } = req.body;
            const recommendation = await getAIRecommendation(userProfile, symptoms, hospitals);
            res.json(recommendation);
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ error: 'Failed' });
        }
    });

// ================= BOOK APPOINTMENT =================
app.post('/api/appointments/book', (req, res) => {
    console.log('📅 POST /api/appointments/book called');
    console.log('👤 User ID:', req.session.userId);

    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
        hospitalName,
        doctorName,
        appointmentDate,
        appointmentTime,
        symptoms,
        notes,
        preTests
    } = req.body;

    db.get(
        `SELECT h.id AS hospital_id, d.id AS doctor_id, d.consultation_fee
         FROM hospitals h
         INNER JOIN doctors d ON h.id = d.hospital_id
         WHERE h.name = ? AND d.name = ?
         LIMIT 1`,
        [hospitalName, doctorName],
        (err, row) => {
            if (err) {
                console.error('❌ Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            if (!row) {
                return res.status(404).json({ error: 'Hospital or doctor not found' });
            }

            const bookingId = generateBookingId();

            db.run(
                `INSERT INTO appointments
                 (booking_id, user_id, doctor_id, hospital_id,
                  appointment_date, appointment_time,
                  symptoms, notes, pre_tests, consultation_fee, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
                [
                    bookingId,
                    req.session.userId,
                    row.doctor_id,
                    row.hospital_id,
                    appointmentDate,
                    appointmentTime,
                    symptoms,
                    notes,
                    preTests,
                    row.consultation_fee
                ],
                function (err) {
                    if (err) {
                        console.error('❌ Insert error:', err);
                        return res.status(500).json({ error: 'Failed to book appointment' });
                    }

                    res.json({
                        success: true,
                        bookingId,
                        appointmentId: this.lastID,
                        consultationFee: row.consultation_fee
                    });
                }
            );
        }
    );
});


// ================= APPOINTMENT HISTORY (USER ID ONLY) =================
app.get('/api/appointments/history', (req, res) => {
    console.log('📅 GET /api/appointments/history called');

    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    db.all(
        `SELECT 
            a.appointment_date,
            a.appointment_time,
            a.status,
            a.symptoms,
            a.consultation_fee,
            d.name AS doctor_name,
            d.specialization,
            h.name AS hospital_name
         FROM appointments a
         LEFT JOIN doctors d ON a.doctor_id = d.id
         LEFT JOIN hospitals h ON a.hospital_id = h.id
         WHERE a.user_id = ?
         ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
        [req.session.userId],
        (err, rows) => {
            if (err) {
                console.error('History fetch error:', err);
                return res.status(500).json({ appointments: [] });
            }

            res.json({ appointments: rows });
        }
    );
});



// ================= GET APPOINTMENT BY BOOKING ID =================
// ✅ SAFE ROUTE — NO COLLISION
app.get('/api/appointments/booking/:bookingId', (req, res) => {
    console.log('📋 GET /api/appointments/booking/:bookingId called');

    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const bookingId = req.params.bookingId;

    db.get(
        `SELECT a.*,
                u.name AS patient_name, u.age, u.gender, u.mobile, u.abha_id,
                h.name AS hospital_name, h.address AS hospital_address, h.phone AS hospital_phone,
                d.name AS doctor_name, d.specialization, d.experience_years
         FROM appointments a
         INNER JOIN users u ON a.user_id = u.id
         INNER JOIN hospitals h ON a.hospital_id = h.id
         INNER JOIN doctors d ON a.doctor_id = d.id
         WHERE a.booking_id = ? AND a.user_id = ?`,
        [bookingId, req.session.userId],
        (err, row) => {
            if (err) {
                console.error('❌ Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            if (!row) {
                return res.status(404).json({ error: 'Appointment not found' });
            }

            res.json(row);
        }
    );
});





    // Check specialty match with AI (FIXED VERSION)
    app.post('/api/ai/check-specialty-match', async (req, res) => {
        console.log('🤖 POST /api/ai/check-specialty-match called');
        console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
        
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            const { symptoms, specialty } = req.body;

            if (!symptoms || symptoms.length === 0) {
                console.log('ℹ️ No symptoms provided, returning default match');
                return res.json({ 
                    isMatch: true,
                    message: 'No specific symptoms to analyze',
                    suggestedSpecialty: null
                });
            }

            if (!GROQ_API_KEY || GROQ_API_KEY === 'undefined') {
                console.error('❌ GROQ_API_KEY is not set!');
                return res.json({ 
                    isMatch: true,
                    message: 'Unable to verify specialty match at this time',
                    suggestedSpecialty: null
                });
            }

            const prompt = `Analyze if these symptoms match the doctor's specialty:

Symptoms: ${symptoms.join(', ')}
Doctor Specialty: ${specialty}

Evaluate:
1. Are these symptoms appropriate for this specialty?
2. Should the patient see a different specialist first?

Return JSON only:
{
  "isMatch": true/false,
  "message": "explanation in 1-2 sentences",
  "suggestedSpecialty": "specialty name if not a match, null otherwise"
}

NO markdown, ONLY JSON.`;

            const data = await makeGroqAPICall(prompt, 0.3, 300);
            
            let content = data.choices[0].message.content;
            content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const result = JSON.parse(content);

            console.log('✅ Specialty match result:', result);
            res.json(result);

        } catch (error) {
            console.error('❌ Error in specialty match:', error);
            res.json({ 
                isMatch: true,
                message: 'Unable to verify specialty match. Please proceed with your choice.',
                suggestedSpecialty: null
            });
        }
    });

    // Get AI doctor recommendation (FIXED VERSION)
    app.post('/api/ai/doctor-recommendation', async (req, res) => {
        console.log('🤖 POST /api/ai/doctor-recommendation called');
        console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
        
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            const { doctorName, specialty, hospitalName, symptoms, userProfile } = req.body;

            if (!GROQ_API_KEY || GROQ_API_KEY === 'undefined') {
                console.error('❌ GROQ_API_KEY is not set!');
                return res.json({
                    recommendation: `${doctorName} at ${hospitalName} appears to be a suitable choice for your consultation. Arrive 15 minutes early with any relevant medical records.`
                });
            }

            const prompt = `Provide a recommendation for this healthcare choice:

Patient: Age ${userProfile?.age || 'unknown'}, ${userProfile?.gender || 'unknown'}
Location: ${userProfile?.address?.pincode || 'not specified'}
Symptoms: ${symptoms && symptoms.length > 0 ? symptoms.join(', ') : 'General consultation'}

Choice:
- Doctor: ${doctorName}
- Specialty: ${specialty}
- Hospital: ${hospitalName}

Analyze:
1. Is this a good choice for the patient's symptoms and location?
2. What should the patient expect?
3. Any preparations needed?

Provide a helpful, reassuring recommendation in 3-4 sentences. Be specific and practical.

Return ONLY the recommendation text, no JSON, no formatting.`;

            const data = await makeGroqAPICall(prompt, 0.7, 400);
            const recommendation = data.choices[0].message.content.trim();

            console.log('✅ Generated recommendation');
            res.json({ recommendation });

        } catch (error) {
            console.error('❌ Error in doctor recommendation:', error);
            const { doctorName, hospitalName } = req.body;
            res.json({
                recommendation: `${doctorName} at ${hospitalName} is ready to help you. Make sure to arrive 15 minutes early and bring any relevant medical records or previous test results.`
            });
        }
    });

    // DEBUG ENDPOINT - Remove in production
    app.get('/api/debug/appointments', (req, res) => {
        db.all('SELECT booking_id, user_id, status, created_at FROM appointments ORDER BY created_at DESC LIMIT 5', 
        (err, rows) => {
            res.json({ 
                recent: rows, 
                sessionUserId: req.session.userId,
                hasSession: !!req.session.userId
            });
        });
    });

    console.log('✅ All Aarogya Connect routes registered successfully');
}