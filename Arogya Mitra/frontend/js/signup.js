// =====================================================
// SIGNUP LOGIC WITH LANGUAGE PERSISTENCE
// File: frontend/js/signup.js
// =====================================================

// Toggle mobile number visibility
const toggleEye = document.getElementById("toggleEye");
const mobileInput = document.getElementById("mobile");

if (toggleEye && mobileInput) {
    toggleEye.addEventListener("click", () => {
        if (mobileInput.type === "password") {
            mobileInput.type = "text";
            toggleEye.textContent = "🙈";
        } else {
            mobileInput.type = "password";
            toggleEye.textContent = "👁";
        }
    });
}

// Handle form submission
const signupForm = document.getElementById("signupForm");

if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("name").value.trim();
        const mobile = document.getElementById("mobile").value.trim();
        const language = document.getElementById("langSelect")?.value || 'en';

        // Validation
        if (!name || !mobile) {
            alert("Please fill in all fields");
            return;
        }

        if (!/^[0-9]{10}$/.test(mobile)) {
            alert("Please enter a valid 10-digit mobile number");
            return;
        }

        // Store in sessionStorage for persistence
        sessionStorage.setItem("am_name", name);
        sessionStorage.setItem("am_mobile", mobile);
        sessionStorage.setItem("user_language", language);

        // Redirect to ABHA verification with language parameter
        window.location.href = `/auth/abha/login?name=${encodeURIComponent(name)}&mobile=${mobile}&language=${language}`;
    });
}

// Language selector change handler
const langSelect = document.getElementById("langSelect");

if (langSelect) {
    langSelect.addEventListener("change", (e) => {
        const selectedLang = e.target.value;
        
        // Store the language preference
        sessionStorage.setItem("user_language", selectedLang);
        
        // Translate the current page immediately
        if (window.setLanguage) {
            window.setLanguage(selectedLang);
        }
    });
    
    // Set initial language from session if available
    const savedLang = sessionStorage.getItem("user_language");
    if (savedLang) {
        langSelect.value = savedLang;
        if (window.setLanguage) {
            window.setLanguage(savedLang);
        }
    }
}