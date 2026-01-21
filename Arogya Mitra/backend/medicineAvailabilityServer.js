// medicineAvailabilityServer.js - Medicine Availability Module
import dotenv from 'dotenv';
dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY_2;
const GEOAPIFY_API_KEY = process.env.Geoapify_API_KEY;

// ================= ENVIRONMENT CHECK =================
function checkEnvironmentVariables() {
    console.log('\n🔍 Medicine Module Environment Check:');
    console.log('================================');
    console.log('GROQ_API_KEY_2 present:', !!GROQ_API_KEY);
    console.log('Geoapify_API_KEY present:', !!GEOAPIFY_API_KEY);
    console.log('================================\n');
}

checkEnvironmentVariables();

// ================= INITIALIZE TABLES =================
export function initializeMedicineTables(db) {
    db.serialize(() => {
        // Pharmacies table
        db.run(`
            CREATE TABLE IF NOT EXISTS pharmacies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                address TEXT,
                phone TEXT,
                distance REAL,
                latitude REAL,
                longitude REAL,
                is_24x7 INTEGER DEFAULT 0,
                home_delivery INTEGER DEFAULT 0,
                prescription_required INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Medicine inventory
        db.run(`
            CREATE TABLE IF NOT EXISTS medicine_inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pharmacy_id INTEGER NOT NULL,
                medicine_name TEXT NOT NULL,
                generic_name TEXT,
                category TEXT,
                manufacturer TEXT,
                price REAL,
                stock_status TEXT DEFAULT 'available',
                quantity INTEGER DEFAULT 0,
                expiry_date TEXT,
                requires_prescription INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(pharmacy_id) REFERENCES pharmacies(id)
            )
        `);

        // User medicine searches
        db.run(`
            CREATE TABLE IF NOT EXISTS medicine_searches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                medicine_name TEXT NOT NULL,
                symptoms TEXT,
                search_date TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `);

        // Prescription orders
        db.run(`
            CREATE TABLE IF NOT EXISTS prescription_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT UNIQUE NOT NULL,
                user_id INTEGER NOT NULL,
                pharmacy_id INTEGER NOT NULL,
                prescription_file TEXT,
                medicines_requested TEXT,
                delivery_type TEXT DEFAULT 'pickup',
                delivery_address TEXT,
                status TEXT DEFAULT 'pending',
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(pharmacy_id) REFERENCES pharmacies(id)
            )
        `);

        // Medicine reminders
        db.run(`
            CREATE TABLE IF NOT EXISTS medicine_reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                medicine_name TEXT NOT NULL,
                dosage TEXT,
                frequency TEXT,
                start_date TEXT,
                end_date TEXT,
                reminder_times TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `);
    });

    console.log("✅ Medicine Availability tables initialized");
}

// ================= HELPER: GROQ API CALL =================
async function makeGroqAPICall(prompt, temperature = 0.7, maxTokens = 800) {
    try {
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

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error('❌ Groq API Error:', error.message);
        throw error;
    }
}

// ================= GEOAPIFY FUNCTIONS =================
async function getCoordinatesFromAddress(address, pincode, state) {
    try {
        const query = encodeURIComponent(`${address}, ${pincode}, ${state}, India`);
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

// ================= SEARCH PHARMACIES =================
async function searchNearbyPharmacies(latitude, longitude) {
    const allPharmacies = new Map();
    const categoryGroups = [
        'commercial.pharmacy',
        'healthcare.pharmacy',
        'commercial.chemist'
    ];

    const searches = [
        { radius: 1000, limit: 20 },
        { radius: 3000, limit: 20 },
        { radius: 5000, limit: 15 }
    ];

    console.log('🔍 Searching for nearby pharmacies...');

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
                                   'Medical Store';
                        
                        name = name.trim();
                        if (/^\d+$/.test(name) || name.length < 3) {
                            name = `Pharmacy ${Math.floor(distance * 10)}`;
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
                        
                        if (!allPharmacies.has(key) && distance <= 10) {
                            allPharmacies.set(key, {
                                name: name,
                                address: address,
                                latitude: coords[1],
                                longitude: coords[0],
                                distance: distance,
                                phone: phone
                            });
                        }
                    });
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`Search failed:`, error.message);
            }
            
            if (allPharmacies.size >= 15) break;
        }
        if (allPharmacies.size >= 15) break;
    }

    const results = Array.from(allPharmacies.values())
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 12);
    
    console.log(`✅ Found ${results.length} pharmacies`);
    return results;
}

// ================= GENERATE MEDICINE INVENTORY WITH AI =================
async function generateMedicineInventory(pharmacy) {
    try {
        const prompt = `Generate realistic medicine inventory for: ${pharmacy.name}

Generate 15-20 commonly available medicines with these details:
- medicine_name: Common brand names (e.g., Crocin, Dolo, Paracetamol, Aspirin, Cough Syrup)
- generic_name: Generic/scientific name
- category: Pain Relief, Fever, Antibiotics, Vitamins, Digestive, Respiratory, etc.
- manufacturer: Indian pharma companies (Sun Pharma, Cipla, Dr. Reddy's, Lupin, etc.)
- price: ₹20-500 (realistic Indian prices)
- stock_status: available/limited/out_of_stock (mostly available)
- quantity: 10-200 units
- requires_prescription: 0 for OTC, 1 for prescription-required

Include common medicines for:
- Fever & Pain (Paracetamol, Ibuprofen)
- Cold & Cough (Syrups, tablets)
- Digestive (Antacids, ORS)
- Vitamins (Multivitamins, Vitamin C)
- First Aid (Antiseptics, Band-aids)
- Chronic conditions (if prescription)

Return JSON array ONLY:
[
  {
    "medicine_name": "...",
    "generic_name": "...",
    "category": "...",
    "manufacturer": "...",
    "price": 50,
    "stock_status": "available",
    "quantity": 100,
    "requires_prescription": 0
  }
]

NO markdown, NO explanation, ONLY JSON array.`;

        const data = await makeGroqAPICall(prompt, 0.8, 1500);
        let content = data.choices[0].message.content;
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        const medicines = JSON.parse(content);
        
        console.log(`✅ Generated ${medicines.length} medicines for ${pharmacy.name}`);
        return medicines;

    } catch (error) {
        console.error(`❌ Medicine generation failed for ${pharmacy.name}:`, error.message);
        return getFallbackMedicines();
    }
}

// ================= FALLBACK MEDICINES =================
function getFallbackMedicines() {
    return [
        {
            medicine_name: "Crocin 650mg",
            generic_name: "Paracetamol",
            category: "Pain Relief",
            manufacturer: "GSK",
            price: 25,
            stock_status: "available",
            quantity: 150,
            requires_prescription: 0
        },
        {
            medicine_name: "Dolo 650",
            generic_name: "Paracetamol",
            category: "Fever",
            manufacturer: "Micro Labs",
            price: 30,
            stock_status: "available",
            quantity: 120,
            requires_prescription: 0
        },
        {
            medicine_name: "Disprin",
            generic_name: "Aspirin",
            category: "Pain Relief",
            manufacturer: "Reckitt Benckiser",
            price: 15,
            stock_status: "available",
            quantity: 100,
            requires_prescription: 0
        },
        {
            medicine_name: "Vicks Cough Syrup",
            generic_name: "Dextromethorphan",
            category: "Respiratory",
            manufacturer: "P&G",
            price: 85,
            stock_status: "available",
            quantity: 50,
            requires_prescription: 0
        },
        {
            medicine_name: "Cetirizine 10mg",
            generic_name: "Cetirizine",
            category: "Allergy",
            manufacturer: "Cipla",
            price: 20,
            stock_status: "available",
            quantity: 80,
            requires_prescription: 0
        }
    ];
}

// ================= RECOMMEND MEDICINES FOR SYMPTOMS =================
async function recommendMedicinesForSymptoms(symptoms) {
    try {
        const prompt = `Based on these symptoms, recommend appropriate OTC medicines available in India:

Symptoms: ${symptoms}

Provide 5-7 medicine recommendations with:
- medicine_name: Common brand name
- generic_name: Generic name
- category: Medicine category
- usage: How to use
- dosage: Recommended dosage
- price_range: Typical price in ₹
- prescription_required: true/false
- caution: Any warnings

Return JSON array ONLY:
[
  {
    "medicine_name": "...",
    "generic_name": "...",
    "category": "...",
    "usage": "...",
    "dosage": "...",
    "price_range": "₹20-50",
    "prescription_required": false,
    "caution": "..."
  }
]

Focus on safe, commonly available OTC medicines. NO markdown, ONLY JSON.`;

        const data = await makeGroqAPICall(prompt, 0.7, 1000);
        let content = data.choices[0].message.content;
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        return JSON.parse(content);

    } catch (error) {
        console.error('Medicine recommendation error:', error);
        return [];
    }
}

// ================= SAVE TO DATABASE =================
function savePharmaciesAndInventory(db, pharmacies) {
    return new Promise((resolve) => {
        db.serialize(() => {
            pharmacies.forEach(pharmacy => {
                db.run(
                    `INSERT INTO pharmacies (name, address, phone, distance, latitude, longitude, is_24x7, home_delivery) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        pharmacy.name, 
                        pharmacy.address, 
                        pharmacy.phone, 
                        pharmacy.distance,
                        pharmacy.latitude, 
                        pharmacy.longitude, 
                        pharmacy.is_24x7 || 0,
                        pharmacy.home_delivery || 0
                    ],
                    function(err) {
                        if (err) return;
                        
                        const pharmacyId = this.lastID;
                        
                        if (pharmacy.medicines && pharmacy.medicines.length > 0) {
                            pharmacy.medicines.forEach(medicine => {
                                db.run(
                                    `INSERT INTO medicine_inventory 
                                    (pharmacy_id, medicine_name, generic_name, category, manufacturer, price, stock_status, quantity, requires_prescription) 
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                    [
                                        pharmacyId,
                                        medicine.medicine_name,
                                        medicine.generic_name,
                                        medicine.category,
                                        medicine.manufacturer,
                                        medicine.price,
                                        medicine.stock_status,
                                        medicine.quantity,
                                        medicine.requires_prescription
                                    ]
                                );
                            });
                        }
                    }
                );
            });
            resolve();
        });
    });
}

function generateOrderId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `MED${timestamp}${random}`.toUpperCase();
}

// ================= ROUTES =================
export function registerMedicineRoutes(app, db) {
    
    // Get nearby pharmacies
    app.post('/api/medicines/pharmacies/nearby', async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { pincode, state, district } = req.body;
            
            const userCoords = await getCoordinatesFromAddress(district || '', pincode, state);
            
            if (!userCoords) {
                return res.status(400).json({ error: 'Unable to locate address' });
            }
            
            const pharmacies = await searchNearbyPharmacies(userCoords.latitude, userCoords.longitude);
            
            // Generate inventory for each pharmacy
            for (let pharmacy of pharmacies) {
                const medicines = await generateMedicineInventory(pharmacy);
                pharmacy.medicines = medicines;
                await new Promise(resolve => setTimeout(resolve, 600));
            }
            
            // Save to database
            await savePharmaciesAndInventory(db, pharmacies);

            res.json({ pharmacies });
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ error: 'Failed to fetch pharmacies' });
        }
    });

    // Search medicine availability
    app.post('/api/medicines/search', (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { medicineName, symptoms } = req.body;

        // Save search history
        db.run(
            `INSERT INTO medicine_searches (user_id, medicine_name, symptoms) VALUES (?, ?, ?)`,
            [req.session.userId, medicineName, symptoms || null]
        );

        // Search in inventory
        db.all(
            `SELECT 
                mi.*,
                p.name as pharmacy_name,
                p.address as pharmacy_address,
                p.phone as pharmacy_phone,
                p.distance,
                p.is_24x7,
                p.home_delivery
             FROM medicine_inventory mi
             INNER JOIN pharmacies p ON mi.pharmacy_id = p.id
             WHERE mi.medicine_name LIKE ? OR mi.generic_name LIKE ?
             ORDER BY p.distance ASC, mi.price ASC`,
            [`%${medicineName}%`, `%${medicineName}%`],
            (err, rows) => {
                if (err) {
                    console.error('Search error:', err);
                    return res.status(500).json({ error: 'Search failed' });
                }
                res.json({ results: rows || [] });
            }
        );
    });

    // Get medicine recommendations based on symptoms
    app.post('/api/medicines/recommend', async (req, res) => {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { symptoms } = req.body;
            const recommendations = await recommendMedicinesForSymptoms(symptoms);
            
            res.json({ recommendations });
        } catch (error) {
            console.error('Recommendation error:', error);
            res.status(500).json({ error: 'Failed to get recommendations' });
        }
    });

    // Submit prescription order
    app.post('/api/medicines/order/prescription', (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const {
            pharmacyId,
            medicinesRequested,
            deliveryType,
            deliveryAddress,
            notes,
            prescriptionFile
        } = req.body;

        const orderId = generateOrderId();

        db.run(
            `INSERT INTO prescription_orders 
             (order_id, user_id, pharmacy_id, prescription_file, medicines_requested, delivery_type, delivery_address, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                orderId,
                req.session.userId,
                pharmacyId,
                prescriptionFile || null,
                JSON.stringify(medicinesRequested),
                deliveryType,
                deliveryAddress,
                notes
            ],
            function(err) {
                if (err) {
                    console.error('Order error:', err);
                    return res.status(500).json({ error: 'Failed to place order' });
                }

                res.json({
                    success: true,
                    orderId: orderId,
                    message: 'Prescription order submitted successfully'
                });
            }
        );
    });

    // Get user's orders
    app.get('/api/medicines/orders', (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        db.all(
            `SELECT 
                po.*,
                p.name as pharmacy_name,
                p.address as pharmacy_address,
                p.phone as pharmacy_phone
             FROM prescription_orders po
             INNER JOIN pharmacies p ON po.pharmacy_id = p.id
             WHERE po.user_id = ?
             ORDER BY po.created_at DESC`,
            [req.session.userId],
            (err, rows) => {
                if (err) {
                    console.error('Orders fetch error:', err);
                    return res.status(500).json({ error: 'Failed to fetch orders' });
                }
                res.json({ orders: rows || [] });
            }
        );
    });

    console.log('✅ Medicine Availability routes registered');
}