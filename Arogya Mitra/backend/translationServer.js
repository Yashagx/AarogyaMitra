// =====================================================
// BACKEND TRANSLATION MODULE
// File: backend/translationServer.js
// Real-time AI-powered translation using Groq API
// =====================================================

import dotenv from 'dotenv';
dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY_1;


// Language names for better translation context
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

// Cache for translations (optional, for performance)
const translationCache = new Map();

// Generate cache key
function getCacheKey(text, targetLang) {
    return `${targetLang}:${text.toLowerCase().trim()}`;
}

// Call Groq API for translation
async function translateWithGroq(texts, sourceLang, targetLang) {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    
    // Prepare the text batch
    const textsToTranslate = texts.map((text, index) => `${index + 1}. ${text}`).join('\n');
    
    const prompt = `You are a professional translator. Translate the following texts from ${LANGUAGE_NAMES[sourceLang]} to ${LANGUAGE_NAMES[targetLang]}.

IMPORTANT INSTRUCTIONS:
- Maintain the exact same formatting, numbers, and special characters
- Preserve line breaks and structure
- Keep technical terms and proper nouns as they are (like ABHA, Aarogya Mitra, etc.)
- Return ONLY the translated texts in the same numbered format
- Do NOT add any explanations or notes
- Ensure natural, culturally appropriate translations for ${LANGUAGE_NAMES[targetLang]} speakers in India

Texts to translate:
${textsToTranslate}

Translated texts:`;

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
                        content: `You are a professional translator specializing in Indian languages. Provide accurate, natural translations that are culturally appropriate for rural Indian users.`
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3, // Lower temperature for more consistent translations
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Groq API Error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const translatedText = data.choices[0].message.content;
        
        // Parse the numbered responses
        const translations = parseNumberedTranslations(translatedText, texts.length);
        
        return translations;
        
    } catch (error) {
        console.error('Groq translation error:', error);
        throw error;
    }
}

// Parse numbered translations from AI response
function parseNumberedTranslations(response, expectedCount) {
    const lines = response.split('\n').filter(line => line.trim());
    const translations = [];
    
    for (let i = 1; i <= expectedCount; i++) {
        // Look for pattern like "1. translated text" or "1) translated text"
        const pattern = new RegExp(`^${i}[\\.\\)]\\s*(.+)$`, 'm');
        const match = response.match(pattern);
        
        if (match) {
            translations.push(match[1].trim());
        } else {
            // Fallback: try to extract by line
            const line = lines[i - 1];
            if (line) {
                // Remove number prefix if present
                const cleaned = line.replace(/^\d+[\\.\\)]\s*/, '').trim();
                translations.push(cleaned);
            } else {
                translations.push(''); // Empty if not found
            }
        }
    }
    
    return translations;
}

// Main translation function with caching
async function translateTexts(texts, sourceLang, targetLang) {
    if (targetLang === sourceLang || targetLang === 'en') {
        return texts; // No translation needed
    }
    
    // Check cache first
    const cachedTranslations = [];
    const textsToTranslate = [];
    const textIndices = [];
    
    texts.forEach((text, index) => {
        const cacheKey = getCacheKey(text, targetLang);
        const cached = translationCache.get(cacheKey);
        
        if (cached) {
            cachedTranslations[index] = cached;
        } else {
            textsToTranslate.push(text);
            textIndices.push(index);
        }
    });
    
    // If all cached, return immediately
    if (textsToTranslate.length === 0) {
        return cachedTranslations;
    }
    
    // Translate remaining texts
    try {
        const newTranslations = await translateWithGroq(textsToTranslate, sourceLang, targetLang);
        
        // Merge cached and new translations
        const result = [...texts]; // Start with original texts
        
        // Fill in cached translations
        cachedTranslations.forEach((translation, index) => {
            if (translation) {
                result[index] = translation;
            }
        });
        
        // Fill in new translations and cache them
        newTranslations.forEach((translation, i) => {
            const originalIndex = textIndices[i];
            const originalText = textsToTranslate[i];
            
            result[originalIndex] = translation;
            
            // Cache the translation
            const cacheKey = getCacheKey(originalText, targetLang);
            translationCache.set(cacheKey, translation);
        });
        
        return result;
        
    } catch (error) {
        console.error('Translation failed:', error);
        // Return original texts if translation fails
        return texts;
    }
}

// Register translation routes
// Register translation routes
function registerTranslationRoutes(app) {
    
    // Main translation endpoint
    app.post('/api/translate', async (req, res) => {
        try {
            const { texts, targetLanguage, sourceLang = 'en' } = req.body;
            
            if (!texts || !Array.isArray(texts)) {
                return res.status(400).json({ error: 'Invalid texts array' });
            }
            
            if (!targetLanguage) {
                return res.status(400).json({ error: 'Target language required' });
            }
            
            // Translate the texts
            const translations = await translateTexts(texts, sourceLang, targetLanguage);
            
            res.json({
                success: true,
                translations: translations,
                targetLanguage: targetLanguage
            });
            
        } catch (error) {
            console.error('Translation API error:', error);
            res.status(500).json({ 
                error: 'Translation failed',
                message: error.message 
            });
        }
    });
    
    // Clear translation cache endpoint (for admin use)
    app.post('/api/translate/clear-cache', (req, res) => {
        translationCache.clear();
        res.json({ success: true, message: 'Translation cache cleared' });
    });
    
    // Get cache statistics
    app.get('/api/translate/stats', (req, res) => {
        res.json({
            cacheSize: translationCache.size,
            languages: LANGUAGE_NAMES
        });
    });
    
    console.log("✅ Translation routes registered");
}

// Use ES module export instead of module.exports
export {
    registerTranslationRoutes,
    translateTexts
};