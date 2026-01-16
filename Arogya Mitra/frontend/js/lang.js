// =====================================================
// DYNAMIC LANGUAGE MANAGER WITH REAL-TIME TRANSLATION
// File: frontend/js/lang.js
// =====================================================

// Language configuration
const LANGUAGES = {
    en: { name: 'English', code: 'en', native: 'English' },
    hi: { name: 'Hindi', code: 'hi', native: 'हिंदी' },
    ta: { name: 'Tamil', code: 'ta', native: 'தமிழ்' },
    te: { name: 'Telugu', code: 'te', native: 'తెలుగు' },
    kn: { name: 'Kannada', code: 'kn', native: 'ಕನ್ನಡ' },
    ml: { name: 'Malayalam', code: 'ml', native: 'മലയാളം' },
    mr: { name: 'Marathi', code: 'mr', native: 'मराठी' },
    bn: { name: 'Bengali', code: 'bn', native: 'বাংলা' },
    gu: { name: 'Gujarati', code: 'gu', native: 'ગુજરાતી' },
    pa: { name: 'Punjabi', code: 'pa', native: 'ਪੰਜਾਬੀ' }
};

// Get current language from sessionStorage
function getCurrentLanguage() {
    return sessionStorage.getItem('user_language') || 'en';
}

// Set language and persist in session
function setLanguage(langCode) {
    if (!LANGUAGES[langCode]) {
        console.error('Invalid language code:', langCode);
        return;
    }
    
    sessionStorage.setItem('user_language', langCode);
    
    // Update language selector if it exists
    const selector = document.getElementById('langSelect');
    if (selector) {
        selector.value = langCode;
    }
    
    // Translate the entire page
    translatePage();
}

// Initialize language on page load
function initializeLanguage() {
    const currentLang = getCurrentLanguage();
    
    // Set language selector
    const selector = document.getElementById('langSelect');
    if (selector) {
        selector.value = currentLang;
    }
    
    // If not English, translate the page
    if (currentLang !== 'en') {
        translatePage();
    }
}

// Translate entire page content
async function translatePage() {
    const currentLang = getCurrentLanguage();
    
    if (currentLang === 'en') {
        return; // No translation needed for English
    }
    
    // Show loading indicator
    showTranslationLoading();
    
    try {
        // Collect all text content to translate
        const textsToTranslate = collectTextsFromPage();
        
        if (textsToTranslate.length === 0) {
            hideTranslationLoading();
            return;
        }
        
        // Call backend translation API
        const translations = await translateTexts(textsToTranslate, currentLang);
        
        // Apply translations to the page
        applyTranslations(translations);
        
        hideTranslationLoading();
    } catch (error) {
        console.error('Translation error:', error);
        hideTranslationLoading();
    }
}

// Collect all translatable texts from the page
function collectTextsFromPage() {
    const texts = [];
    const elements = [];
    
    // Get all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const text = el.textContent.trim();
        if (text && text.length > 0) {
            texts.push(text);
            elements.push({ element: el, type: 'text' });
        }
    });
    
    // Get all elements with data-i18n-placeholder attribute
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const placeholder = el.placeholder;
        if (placeholder && placeholder.length > 0) {
            texts.push(placeholder);
            elements.push({ element: el, type: 'placeholder' });
        }
    });
    
    // Get headings, paragraphs, buttons, labels that don't have data-i18n
    const selectors = 'h1:not([data-i18n]), h2:not([data-i18n]), h3:not([data-i18n]), p:not([data-i18n]), button:not([data-i18n]), label:not([data-i18n]), .feature-card h3, .feature-card p';
    
    document.querySelectorAll(selectors).forEach(el => {
        // Skip if inside a data-i18n element
        if (el.closest('[data-i18n]')) return;
        
        const text = el.textContent.trim();
        if (text && text.length > 0 && !text.includes('�')) {
            texts.push(text);
            elements.push({ element: el, type: 'text' });
        }
    });
    
    // Store elements for later use
    window._translationElements = elements;
    
    return texts;
}

// Call backend translation API
async function translateTexts(texts, targetLang) {
    const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            texts: texts,
            targetLanguage: targetLang,
            sourceLang: 'en'
        })
    });
    
    if (!response.ok) {
        throw new Error('Translation failed');
    }
    
    const data = await response.json();
    return data.translations;
}

// Apply translations to the page
function applyTranslations(translations) {
    const elements = window._translationElements || [];
    
    translations.forEach((translation, index) => {
        if (elements[index]) {
            const { element, type } = elements[index];
            
            if (type === 'placeholder') {
                element.placeholder = translation;
            } else {
                element.textContent = translation;
            }
        }
    });
}

// Show translation loading indicator
function showTranslationLoading() {
    let loader = document.getElementById('translationLoader');
    
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'translationLoader';
        loader.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(11, 94, 215, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        loader.innerHTML = `
            <div style="width: 16px; height: 16px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
            Translating...
        `;
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(loader);
    }
    
    loader.style.display = 'flex';
}

// Hide translation loading indicator
function hideTranslationLoading() {
    const loader = document.getElementById('translationLoader');
    if (loader) {
        loader.style.display = 'none';
    }
}

// Translate dynamic content (for AJAX loaded content)
async function translateDynamicContent(text, targetLang = null) {
    if (!targetLang) {
        targetLang = getCurrentLanguage();
    }
    
    if (targetLang === 'en') {
        return text;
    }
    
    try {
        const response = await fetch('/api/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                texts: [text],
                targetLanguage: targetLang,
                sourceLang: 'en'
            })
        });
        
        const data = await response.json();
        return data.translations[0] || text;
    } catch (error) {
        console.error('Translation error:', error);
        return text;
    }
}

// Helper function to translate multiple texts
async function translateMultiple(texts) {
    const currentLang = getCurrentLanguage();
    
    if (currentLang === 'en') {
        return texts;
    }
    
    try {
        const response = await fetch('/api/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                texts: texts,
                targetLanguage: currentLang,
                sourceLang: 'en'
            })
        });
        
        const data = await response.json();
        return data.translations;
    } catch (error) {
        console.error('Translation error:', error);
        return texts;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeLanguage();
});

// Export functions for global use
window.getCurrentLanguage = getCurrentLanguage;
window.setLanguage = setLanguage;
window.translateDynamicContent = translateDynamicContent;
window.translateMultiple = translateMultiple;
window.translatePage = translatePage;