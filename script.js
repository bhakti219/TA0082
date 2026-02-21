// --- Global Variables ---
let map, marker;
let userLat = 28.7041, userLng = 77.1025; // Default to central location
let watchId;
let timerInterval;
let mediaRecorder;
let audioChunks = [];

// Mock Data: Trusted Auto Drivers
const trustedDrivers = [
    { name: "Ramesh (Gate 1)", phone: "1234567890", rating: 4.8 },
    { name: "Suresh (Hostel Block)", phone: "0987654321", rating: 4.9 },
    { name: "Campus Shuttle", phone: "1122334455", rating: 5.0 }
];

// --- Initialization ---
window.onload = function() {
    loadAutoDrivers();
    getLocation();

    // Stop audio playback when the modal is closed (via cross button or clicking outside)
    const evidenceModal = document.getElementById('evidenceModal');
    if (evidenceModal) {
        evidenceModal.addEventListener('hidden.bs.modal', () => {
            const audio = document.getElementById('audioPlayback');
            if (audio) {
                audio.pause();
                audio.currentTime = 0; // Reset to start
            }
        });
    }
};

// --- 1. Google Maps & Geolocation ---
function initMap() {
    // Default to a central location if geo fails initially
    const defaultLoc = { lat: 28.7041, lng: 77.1025 }; 
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 15,
        center: defaultLoc,
        disableDefaultUI: true // Clean look
    });
    marker = new google.maps.Marker({
        position: defaultLoc,
        map: map,
        title: "You are here",
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#4285F4",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "white",
        },
    });
}

function getLocation() {
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                userLat = position.coords.latitude;
                userLng = position.coords.longitude;
                const pos = { lat: userLat, lng: userLng };

                document.getElementById("locationStatus").innerHTML = 
                    `<i class="fas fa-map-marker-alt text-success"></i> Location Active: ${userLat.toFixed(4)}, ${userLng.toFixed(4)}`;

                if(map && marker) {
                    marker.setPosition(pos);
                    map.setCenter(pos);
                }
            },
            (error) => {
                document.getElementById("locationStatus").innerText = "Location Access Denied. SOS features limited.";
                alert("Please enable location services for SurakshaPath to work.");
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

// --- 2. SOS Functionality (WhatsApp + Audio) ---
async function triggerSOS() {
    // A. Visual Feedback
    const btn = document.querySelector('.btn-sos');
    btn.style.backgroundColor = "darkred";
    btn.innerText = "SENDING...";

    // B. Start Audio Recording
    startRecording();

    // Show 'I Reached Safely' button to allow stopping the recording manually
    document.getElementById("safeBtn").style.display = "block";

    // C. Send WhatsApp Message
    const phone = document.getElementById("emergencyPhone1").value;
    const mapLink = `https://www.google.com/maps?q=${userLat},${userLng}`;
    const message = `🚨 SOS! I feel unsafe. Here is my live location: ${mapLink}. Audio evidence is being recorded.`;
    
    // Send to Backend API (Automatic) - Removes the "Open App" popup
    const apiUrl = 'http://localhost:3000/send-sos';

    fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone, message: message })
    })
    .catch(error => {
        console.error("Backend failed, falling back to manual WhatsApp");
        // Only open WhatsApp manually if the automatic backend fails
        const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
    });

    // Reset Button UI after delay
    setTimeout(() => {
        btn.style.backgroundColor = "#e63946";
        btn.innerText = "SOS";
    }, 3000);
}

// --- 3. Audio Recording Logic (MediaRecorder API) ---
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        document.getElementById("recordingStatus").style.display = "block";

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            // Stop all audio tracks to release microphone hardware
            stream.getTracks().forEach(track => track.stop());

            // Use the actual recording format (fixes playback issues on different devices)
            const mimeType = mediaRecorder.mimeType || 'audio/webm';
            const audioBlob = new Blob(audioChunks, { type: mimeType });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = document.getElementById('audioPlayback');
            audio.src = audioUrl;
            
            // Show Modal for Demo purposes
            const evidenceModal = new bootstrap.Modal(document.getElementById('evidenceModal'));
            evidenceModal.show();
            
            document.getElementById("recordingStatus").style.display = "none";
        };

        mediaRecorder.start();
        
    } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Microphone access required for evidence recording.");
    }
}

// --- 4. Smart Travel Timer ---
function startTimer() {
    const minutes = parseInt(document.getElementById("timeSelect").value);
    let timeRemaining = minutes * 60;
    
    document.getElementById("timerControls").style.display = "none";
    document.getElementById("timerDisplay").style.display = "block";
    document.getElementById("safeBtn").style.display = "block";

    timerInterval = setInterval(() => {
        const m = Math.floor(timeRemaining / 60);
        const s = timeRemaining % 60;
        document.getElementById("timerDisplay").innerText = 
            `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

        timeRemaining--;

        if (timeRemaining < 0) {
            clearInterval(timerInterval);
            alert("⚠️ Timer Expired! Sending Alert...");
            triggerSOS(); // Auto-trigger SOS
            resetTimerUI();
        }
    }, 1000);
}

function markSafe() {
    clearInterval(timerInterval);
    
    // Stop Audio Recording if it is active
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
    }

    const phone = document.getElementById("emergencyPhone1").value;
    const message = "✅ I have reached my destination safely.";
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');

    alert("✅ Glad you are safe! Timer stopped.");
    resetTimerUI();
}

function resetTimerUI() {
    document.getElementById("timerControls").style.display = "block";
    document.getElementById("timerDisplay").style.display = "none";
    document.getElementById("safeBtn").style.display = "none";
}

// --- 5. Trusted Auto Drivers ---
function loadAutoDrivers() {
    const list = document.getElementById("autoList");
    list.innerHTML = "";
    trustedDrivers.forEach(driver => {
        const item = document.createElement("div");
        item.className = "driver-item";
        item.innerHTML = `
            <div>
                <strong>${driver.name}</strong><br>
                <small class="text-muted"><i class="fas fa-star text-warning"></i> ${driver.rating}</small>
            </div>
            <div class="btn-group">
                <a href="tel:${driver.phone}" class="btn btn-outline-danger btn-sm" title="Call">
                    <i class="fas fa-phone-alt"></i>
                </a>
                <a href="https://wa.me/${driver.phone}" target="_blank" class="btn btn-outline-success btn-sm" title="WhatsApp">
                    <i class="fab fa-whatsapp"></i>
                </a>
                <a href="sms:${driver.phone}" class="btn btn-outline-secondary btn-sm" title="SMS">
                    <i class="fas fa-comment-alt"></i>
                </a>
            </div>
        `;
        list.appendChild(item);
    });
}

// --- 6. Helper Functions ---
function callContact(inputId) {
    const phone = document.getElementById(inputId).value;
    if(phone) {
        window.location.href = `tel:${phone}`;
    } else {
        alert("Please enter a number first.");
    }
}

function waContact(inputId) {
    const phone = document.getElementById(inputId).value;
    if(phone) {
        window.open(`https://wa.me/${phone}`, '_blank');
    } else {
        alert("Please enter a number first.");
    }
}

function smsContact(inputId) {
    const phone = document.getElementById(inputId).value;
    if(phone) {
        window.location.href = `sms:${phone}?body=Emergency! Please help.`;
    } else {
        alert("Please enter a number first.");
    }
}

function addCustomDriver() {
    const name = document.getElementById("newDriverName").value;
    const phone = document.getElementById("newDriverPhone").value;
    if(name && phone) {
        trustedDrivers.push({ name: name + " (Custom)", phone: phone, rating: 5.0 });
        loadAutoDrivers();
        document.getElementById("newDriverName").value = "";
        document.getElementById("newDriverPhone").value = "";
    } else {
        alert("Enter name and phone.");
    }
}