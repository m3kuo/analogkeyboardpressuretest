import { ConnectNew, AnalogKeyCode } from './wooting-js.js';

if ("hid" in navigator) {
    console.log("The WebHID API is supported by this browser.");
} else {
    alert("The WebHID API is not supported by this browser.");
    console.assert(false, "The WebHID API is not supported by this browser.");
}

// Pressure level ranges
const LIGHT_MIN = 10;
const LIGHT_MAX = 40;
const MED_MIN = 41;
const MED_MAX = 80;
const MID_MIN = 10;
const MID_MAX = 90;
const FULL_MIN = 95;

// Home row keys for testing
const HOME_ROW_KEYS = [4, 22, 7, 9, 10, 11, 13, 14, 15]; // ASDFGHJKL

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
let maxAnalog = 0;
let keyHeld = false;
let targetKeyCode = null;

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
    2: [50, 100],      // Mid & Full
    3: [25, 60, 100],  // Light, Medium, Full
};

function getTargetLabel(pressure) {
    if (pressure === 25) return "Light (10–40%)";
    if (pressure === 60) return "Medium (41–80%)";
    if (pressure === 50) return "Mid (10–90%)";
    if (pressure === 100) return "100% (Full)";
    return "";
}

function isSuccessForRange(target, percent) {
    if (target === 25) return percent >= LIGHT_MIN && percent <= LIGHT_MAX;
    if (target === 60) return percent >= MED_MIN && percent <= MED_MAX;
    if (target === 50) return percent >= MID_MIN && percent <= MID_MAX;
    if (target === 100) return percent >= FULL_MIN;
    return false;
}

function computeDeviationForRange(target, percent) {
    if (target === 25) {
        if (percent < LIGHT_MIN) return LIGHT_MIN - percent;
        if (percent > LIGHT_MAX) return percent - LIGHT_MAX;
        return 0;
    }
    if (target === 60) {
        if (percent < MED_MIN) return MED_MIN - percent;
        if (percent > MED_MAX) return percent - MED_MAX;
        return 0;
    }
    if (target === 50) {
        if (percent < MID_MIN) return MID_MIN - percent;
        if (percent > MID_MAX) return percent - MID_MAX;
        return 0;
    }
    if (target === 100) {
        return Math.max(0, 100 - percent);
    }
    return 100;
}

function generateTestSequence() {
    currentSequence = [];
    const levels = PRESSURE_LEVELS[pressureMode] || [25, 60, 100];
    
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

function recordAttempt(keyCode) {
    if (currentIndex >= currentSequence.length) return;
    
    const currentTarget = currentSequence[currentIndex];
    const percent = (maxAnalog / 255) * 100;
    const success = isSuccessForRange(currentTarget.targetPressure, percent);
    const deviation = computeDeviationForRange(currentTarget.targetPressure, percent);
    
    attemptHistory.push({
        keyCode,
        targetPressure: currentTarget.targetPressure,
        actualPressure: Math.round(percent),
        deviation: Math.round(deviation),
        success,
        timestamp: Date.now(),
    });
    
    // Update stats
    testStats.totalAttempts++;
    if (success) testStats.successfulHits++;
    testStats.accuracy = (testStats.successfulHits / testStats.totalAttempts) * 100;
    testStats.averageDeviation = (testStats.averageDeviation * (testStats.totalAttempts - 1) + deviation) / testStats.totalAttempts;
    
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
    maxAnalog = 0;
    keyHeld = false;
    
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
        targetInfoSpan.textContent = `Next: ${getTargetLabel(target.targetPressure)}`;
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
        
        // Update visualization loop
        setInterval(updateKeyVisualization, 50);
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

// Keyboard event listener
if ("hid" in navigator) {
    document.addEventListener("keydown", (e) => {
        if (!isTestActive || !kb) return;
        
        const keyCode = e.location === 1 ? e.keyCode + 100 : e.keyCode; // Handle modifiers
        
        if (keyCode === targetKeyCode && !keyHeld) {
            keyHeld = true;
            maxAnalog = kb.buffer[targetKeyCode] || 0;
        }
    });
    
    document.addEventListener("keyup", (e) => {
        if (!isTestActive || !kb || !keyHeld) return;
        
        const keyCode = e.location === 1 ? e.keyCode + 100 : e.keyCode;
        
        if (keyCode === targetKeyCode && keyHeld) {
            recordAttempt(targetKeyCode);
        }
    });
    
    // Continuous pressure monitoring
    setInterval(() => {
        if (isTestActive && keyHeld && kb && targetKeyCode) {
            maxAnalog = Math.max(maxAnalog, kb.buffer[targetKeyCode] || 0);
        }
    }, 50);
}

// Initialize
generateTestSequence();
