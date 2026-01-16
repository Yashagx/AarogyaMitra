// frontend/js/aarogyaconnect.js
// ================= STATE =================
let userProfile = null;
let allHospitals = [];
let filteredHospitals = [];

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    try {
        await fetchUserProfile();
        await fetchNearbyHospitals();
        setupEventListeners();
        renderHospitals();
        showContent();
    } catch (error) {
        showError(error.message);
    }
}

// ================= FETCH USER PROFILE =================
async function fetchUserProfile() {
    try {
        const response = await fetch('/api/abha/profile', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Please login to access Aarogya Connect');
        }

        userProfile = await response.json();
        displayUserProfile();
    } catch (error) {
        throw new Error(error.message || 'Failed to fetch user profile');
    }
}

function displayUserProfile() {
    document.getElementById('userName').textContent = userProfile.name;
    document.getElementById('userAbha').textContent = userProfile.abhaId;
    document.getElementById('userAge').textContent = `${userProfile.age} years`;
    document.getElementById('userGender').textContent = userProfile.gender;
    document.getElementById('userPincode').textContent = userProfile.address?.pincode || 'Not set';
    document.getElementById('userState').textContent = userProfile.state;
}

// ================= FETCH HOSPITALS =================
async function fetchNearbyHospitals() {
    try {
        const response = await fetch('/api/hospitals/nearby', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                pincode: userProfile?.address?.pincode || '600001',
                state: userProfile?.state || 'Tamil Nadu',
                gender: userProfile?.gender || 'general',
                age: userProfile?.age || 40
            })
        });

        if (!response.ok) {
            throw new Error('Failed to fetch hospitals');
        }

        const data = await response.json();
        allHospitals = data.hospitals;
        filteredHospitals = allHospitals;
    } catch (error) {
        console.error('Error fetching hospitals:', error);
        showError('Failed to load hospitals. Please try again later.');
    }
}

// ================= EVENT LISTENERS =================
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const specialtyFilter = document.getElementById('specialtyFilter');

    searchInput.addEventListener('input', handleFilter);
    specialtyFilter.addEventListener('change', handleFilter);
}

function handleFilter() {
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    const selectedSpecialty = document.getElementById('specialtyFilter').value;

    filteredHospitals = allHospitals.filter(hospital => {
        const matchesSearch = hospital.name.toLowerCase().includes(searchQuery);
        const matchesSpecialty = selectedSpecialty === 'all' || 
            hospital.doctors.some(d => d.specialization === selectedSpecialty);
        return matchesSearch && matchesSpecialty;
    });

    renderHospitals();
}

// ================= RENDER HOSPITALS =================
function renderHospitals() {
    const hospitalsList = document.getElementById('hospitalsList');
    const noResults = document.getElementById('noResults');

    if (filteredHospitals.length === 0) {
        hospitalsList.innerHTML = '';
        noResults.style.display = 'block';
        return;
    }

    noResults.style.display = 'none';
    hospitalsList.innerHTML = filteredHospitals.map(hospital => createHospitalCard(hospital)).join('');

    // Add event listeners to book buttons
    document.querySelectorAll('.book-btn').forEach(btn => {
        btn.addEventListener('click', handleBookAppointment);
    });
}

function createHospitalCard(hospital) {
    return `
        <div class="hospital-card">
            <div class="hospital-header">
                <div class="hospital-name">${escapeHtml(hospital.name)}</div>
                <div class="hospital-info">
                    <div class="hospital-info-item">
                        <span>📍</span>
                        <span>${escapeHtml(hospital.address)}</span>
                    </div>
                    <div class="hospital-info-item">
                        <span>📞</span>
                        <span>${escapeHtml(hospital.phone)}</span>
                    </div>
                    <div class="distance-badge">${hospital.distance} km away</div>
                </div>
            </div>
            <div class="doctors-section">
                <div class="doctors-title">Available Doctors</div>
                <div class="doctors-grid">
                    ${hospital.doctors.map(doctor => createDoctorCard(doctor, hospital.name)).join('')}
                </div>
            </div>
        </div>
    `;
}

function createDoctorCard(doctor, hospitalName) {
    return `
        <div class="doctor-card">
            <div class="doctor-header">
                <div>
                    <div class="doctor-name">${escapeHtml(doctor.name)}</div>
                    <div class="doctor-specialty">${escapeHtml(doctor.specialization)}</div>
                </div>
                <div class="rating-badge">
                    <span>⭐</span>
                    <span>${doctor.rating}</span>
                </div>
            </div>
            <div class="doctor-details">
                <div class="doctor-detail-item">
                    <span class="detail-icon">💼</span>
                    <span>${doctor.experience_years} years experience</span>
                </div>
                <div class="doctor-detail-item">
                    <span class="detail-icon">💰</span>
                    <span class="fee">₹${doctor.consultation_fee}</span>
                </div>
                <div class="doctor-detail-item">
                    <span class="detail-icon">📅</span>
                    <span>${escapeHtml(doctor.available_days)}</span>
                </div>
                <div class="doctor-detail-item">
                    <span class="detail-icon">🕒</span>
                    <span>${escapeHtml(doctor.available_time)}</span>
                </div>
                <div class="languages">
                    ${doctor.languages.map(lang => `<span class="language-tag">${escapeHtml(lang)}</span>`).join('')}
                </div>
            </div>
            <button class="book-btn" 
                    data-doctor="${escapeHtml(doctor.name)}" 
                    data-hospital="${escapeHtml(hospitalName)}"
                    data-specialty="${escapeHtml(doctor.specialization)}"
                    data-fee="${doctor.consultation_fee}">
                Book Appointment
            </button>
        </div>
    `;
}

// ================= BOOK APPOINTMENT =================
function handleBookAppointment(event) {
    const doctorName = event.target.dataset.doctor;
    const hospitalName = event.target.dataset.hospital;
    const specialty = event.target.dataset.specialty;
    const fee = event.target.dataset.fee;
    
    // Store appointment details in sessionStorage for the booking page
    sessionStorage.setItem('appointmentDetails', JSON.stringify({
        doctorName,
        hospitalName,
        specialty,
        consultationFee: fee,
        userProfile: {
            name: userProfile.name,
            abhaId: userProfile.abhaId,
            mobile: userProfile.mobile
        }
    }));
    
    // Redirect to book appointment page
    window.location.href = 'book-appointment.html';
}

// ================= UTILITY FUNCTIONS =================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ================= UI STATE MANAGEMENT =================
function showContent() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
}

function showError(message) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'flex';
    document.getElementById('error-message').textContent = message;
}