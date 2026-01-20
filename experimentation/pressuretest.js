import { ConnectNew, AnalogKeyCode } from './wooting-js.js';

if ("hid" in navigator) {
    console.log("The WebHID API is supported by this browser.");
} else {
    alert("The WebHID API is not supported by this browser.");
    console.assert(false, "The WebHID API is not supported by this browser.");
}

// Pressure level ranges
const MAX_LEVEL = 255;
const LIGHT_THRESHOLD = 0.1;
const MED_THRESHOLD = 0.4;
const FULL_THRESHOLD = 0.95;

// Home row keys for testing
const HOME_ROW_KEYS = ["4", "22", "7", "9", "10", "11", "13", "14", "15"]; // ASDFGHJKL

// Global state
let k, kb;
let isTestActive = false;
let currentSequence = [];
let currentIndex = 0;
let pressureMode = 3;
let testStats = {
    accuracy: 0,
    totalAttempts: 0,
    successfulHits: 0,
    averageDeviation: 0,
};
let attemptHistory = [];
let targetKeyCode = null;
const onHeld = new Map();

// DOM Elements
const connectBtn = document.getElementById("connect");
const startTestBtn = document.getElementById("startTest");
const resetTestBtn = document.getElementById("resetTest");
const pressureModeSelect = document.getElementById("pressureMode");
const testStatusSpan = document.getElementById("testStatus");
const targetInfoSpan = document.getElementById("targetInfo");
const accuracySpan = document.getElementById("accuracy");
const attemptsSpan = document.getElementById("attempts");
const successSpan = document.getElementById("success");
const avgDevSpan = document.getElementById("avgDev");

// Pressure level configurations
const PRESSURE_LEVELS = {
    2: ["light", "full"],      // Mid & Full
    3: ["light", "Medium", "full"],  // Light, Medium, Full
}; 

function getTargetLabel(pressure) {
    if(pressureMode == 2){
        if (pressure === "light") return "Light (10–80%)";
        if (pressure === "full") return "Full (100%)";
    }
    else if(pressureMode == 3){
        if (pressure === "light") return "Light (10–40%)";
        if (pressure === "Medium") return "Medium (41–80%)";
        if (pressure === "full") return "Full (100%)";
    }
    return "";
}

function isSuccessForRange(target, value) {
    if(pressureMode == 2){
        if (target === "light") return value >= MAX_LEVEL * LIGHT_THRESHOLD && value < MAX_LEVEL * FULL_THRESHOLD;
        if (target === "full") return value >= MAX_LEVEL * FULL_THRESHOLD;
    }
    else if(pressureMode == 3){
        if (target === "light") return value >= MAX_LEVEL * LIGHT_THRESHOLD && value < MAX_LEVEL * MED_THRESHOLD;
        if (target === "Medium") return value >= MAX_LEVEL * MED_THRESHOLD && value < MAX_LEVEL * FULL_THRESHOLD;
        if (target === "full") return value >= MAX_LEVEL * FULL_THRESHOLD;
    }

    return false;
}

// function computeDeviationForRange(target, percent) {
//     if (target === 25) {
//         if (percent < LIGHT_MIN) return LIGHT_MIN - percent;
//         if (percent > LIGHT_MAX) return percent - LIGHT_MAX;
//         return 0;
//     }
//     if (target === 60) {
//         if (percent < MED_MIN) return MED_MIN - percent;
//         if (percent > MED_MAX) return percent - MED_MAX;
//         return 0;
//     }
//     if (target === 50) {
//         if (percent < MID_MIN) return MID_MIN - percent;
//         if (percent > MID_MAX) return percent - MID_MAX;
//         return 0;
//     }
//     if (target === 100) {
//         return Math.max(0, 100 - percent);
//     }
//     return 100;
// }

function generateTestSequence() {
    currentSequence = [];
    const levels = PRESSURE_LEVELS[pressureMode] || ["light", "Medium", "full"];
    
    // Generate 20 test items
    for (let i = 0; i < 20; i++) {
        const keyCode = HOME_ROW_KEYS[Math.floor(Math.random() * HOME_ROW_KEYS.length)];
        const targetPressure = levels[Math.floor(Math.random() * levels.length)];
        currentSequence.push({
            keyCode,
            targetPressure,
        });
    }
    
    currentIndex = 0;
    attemptHistory = [];
    updateStats();
}

function updateStats() {
    accuracySpan.textContent = Math.round(testStats.accuracy);
    attemptsSpan.textContent = testStats.totalAttempts;
    successSpan.textContent = testStats.successfulHits;
    avgDevSpan.textContent = Math.round(testStats.averageDeviation);
}

function updateKeyVisualization() {
    for (const key in AnalogKeyCode) {
        if (isNaN(Number(key))) continue;
        const element = document.getElementById(key);
        if (!element) continue;

        try {
            const pressure = kb.buffer[key];
            const percent = (pressure / 255) * 100;
            
            // Color visualization based on pressure
            const hue = percent > 80 ? 0 : percent > 50 ? 30 : percent > 20 ? 60 : 120;
            const saturation = Math.min(100, pressure);
            element.style.background = `hsl(${hue}, ${saturation}%, ${50 - pressure / 5}%)`;
            
            // Show pressure percentage on target key
            if (isTestActive && key == targetKeyCode) {
                element.textContent = Math.round(percent) + '%';
            }
        } catch (err) { }
    }
}

function recordAttempt(keyCode, value) {
    if (currentIndex >= currentSequence.length) return;
    
    const currentTarget = currentSequence[currentIndex];
    const success = isSuccessForRange(currentTarget.targetPressure, value);
    // const deviation = computeDeviationForRange(currentTarget.targetPressure, value);
    
    attemptHistory.push({
        keyCode,
        targetPressure: currentTarget.targetPressure,
        actualPressure: value,
        // deviation: Math.round(deviation),
        success,
        timestamp: Date.now(),
    });
    
    // Update stats
    testStats.totalAttempts++;
    if (success) testStats.successfulHits++;
    testStats.accuracy = (testStats.successfulHits / testStats.totalAttempts) * 100;
    // testStats.averageDeviation = (testStats.averageDeviation * (testStats.totalAttempts - 1) + deviation) / testStats.totalAttempts;
    
    updateStats();
    
    // Highlight success/failure
    const keyElement = document.getElementById(keyCode);
    if (keyElement) {
        keyElement.style.boxShadow = success ? '0 0 20px #00FF00' : '0 0 20px #FF0000';
        setTimeout(() => {
            keyElement.style.boxShadow = '';
        }, 500);
    }
    
    // Move to next
    currentIndex++;
    
    if (currentIndex >= currentSequence.length) {
        endTest();
    } else {
        updateTargetInfo();
    }
}

function updateTargetInfo() {
    if (currentIndex < currentSequence.length) {
        const target = currentSequence[currentIndex];
        targetKeyCode = target.keyCode;
        console.log(AnalogKeyCode[targetKeyCode]);
        targetInfoSpan.textContent = `${AnalogKeyCode[targetKeyCode]} - ${getTargetLabel(target.targetPressure)}`;
        // targetInfoSpan.textContent = `Next: ${getTargetLabel(target.targetPressure)}`;
        testStatusSpan.textContent = `Item ${currentIndex + 1} / ${currentSequence.length}`;
    }
}

function endTest() {
    isTestActive = false;
    testStatusSpan.textContent = 'Complete!';
    startTestBtn.textContent = 'Start Test';
    startTestBtn.disabled = false;
}

// Event Listeners
connectBtn.addEventListener("click", () => {
    k = ConnectNew();
    k.then((res) => {
        kb = res[0];
        document.getElementById("deviceName").innerText = kb.deviceName;
        document.getElementById("productId").innerText = kb.device.productId;
        
        startTestBtn.disabled = false;
        resetTestBtn.disabled = false;
        pressureModeSelect.disabled = false;
        connectBtn.textContent = 'Reconnect';
    });
});

pressureModeSelect.addEventListener("change", (e) => {
    pressureMode = parseInt(e.target.value);
    generateTestSequence();
});

startTestBtn.addEventListener("click", () => {
    if (!isTestActive) {
        isTestActive = true;
        generateTestSequence();
        updateTargetInfo();
        startTestBtn.textContent = 'Test Running...';
        startTestBtn.disabled = true;
        pressureModeSelect.disabled = true;
        testStatusSpan.textContent = 'Running...';
    }
});

resetTestBtn.addEventListener("click", () => {
    isTestActive = false;
    currentIndex = 0;
    testStats = {
        accuracy: 0,
        totalAttempts: 0,
        successfulHits: 0,
        averageDeviation: 0,
    };
    attemptHistory = [];
    generateTestSequence();
    updateStats();
    testStatusSpan.textContent = 'Idle';
    targetInfoSpan.textContent = '';
    startTestBtn.textContent = 'Start Test';
    startTestBtn.disabled = false;
    pressureModeSelect.disabled = false;
});


window.addEventListener("akeydown", (e) => {
    //console.log("akeydown:" + e.detail.key);
    if(e.detail.value < MAX_LEVEL * LIGHT_THRESHOLD) return;
    const element = document.getElementById(e.detail.key);
        //if (!element) return;

        try {
            const pressure = e.detail.value;
            const percent = (pressure / 255) * 100;
            
            // Color visualization based on pressure
            const hue = percent > 80 ? 0 : percent > 50 ? 30 : percent > 20 ? 60 : 120;
            const saturation = Math.min(100, pressure);
            element.style.background = `hsl(${hue}, ${saturation}%, ${50 - pressure / 5}%)`;
            
            // Show pressure percentage on target key
            // if (isTestActive && e.detail.key == targetKeyCode) {
            //     element.textContent = Math.round(percent) + '%';
            // }
            
            // update map
            if(onHeld.has(e.detail.key)){
                let value = Math.max(onHeld.get(e.detail.key), e.detail.value);
                onHeld.set(e.detail.key, value);
            }
            else{
                onHeld.set(e.detail.key, e.detail.value);
            }
            //console.log(onHeld.size);
        } catch (err) { console.log(err)}
});

window.addEventListener("akeyup", (e) => {
    //console.log(e.detail);
    const element = document.getElementById(e.detail.key);
        if (!element) return;

        try {
            // Color visualization based on pressure
            element.style.background = `linear-gradient(90deg, rgba(40,40,40,1) 0%, rgba(34,34,34,1) 50%, rgba(40,40,40,1) 100%)`;

            // update map
            if(onHeld.has(e.detail.key)){
                // check correct or not
                if(targetKeyCode === e.detail.key){
                    recordAttempt(e.detail.key, onHeld.get(e.detail.key));
                }                
                console.log("max: " + onHeld.get(e.detail.key));
                onHeld.delete(e.detail.key);
            }

        } catch (err) { console.log(err)}
});

// Initialize
generateTestSequence();

