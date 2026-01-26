import { ConnectNew, AnalogKeyCode } from './wooting-js.js';

if ("hid" in navigator) {
    console.log("The WebHID API is supported by this browser.");
} else {
    alert("The WebHID API is not supported by this browser.");
    console.assert(false, "The WebHID API is not supported by this browser.");
}

// Pressure level ranges
const MAX_LEVEL = 255;
const LIGHT_THRESHOLD = 0.05;
const MED_THRESHOLD = 0.35;
const MED_HIGH_THRESHOLD = 0.7;
const FULL_THRESHOLD = 0.98;

// Common words for testing
const COMMON_WORDS = [
    'the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog',
    'able', 'about', 'after', 'again', 'against', 'all',
    'and', 'any', 'are', 'area', 'around', 'as', 'ask', 'away',
    'back', 'bad', 'bag', 'ball', 'band', 'bank', 'bar', 'base',
    'beach', 'bean', 'bear', 'beat', 'been', 'beer', 'before',
    'began', 'begin', 'being', 'bell', 'below', 'best', 'better',
    'big', 'bike', 'bill', 'bird', 'birth', 'black', 'blade',
    'blame', 'blank', 'blood', 'blow', 'blue', 'board', 'body',
    'boil', 'bold', 'bolt', 'bomb', 'bond', 'bone', 'book', 'boom',
    'boot', 'bore', 'born', 'both', 'bought', 'box', 'boy',
];

// Key code mapping
const KEY_CODE_MAP = {
    'a': 4, 'b': 5, 'c': 6, 'd': 7, 'e': 8, 'f': 9, 'g': 10, 'h': 11,
    'i': 12, 'j': 13, 'k': 14, 'l': 15, 'm': 16, 'n': 17, 'o': 18, 'p': 19,
    'q': 20, 'r': 21, 's': 22, 't': 23, 'u': 24, 'v': 25, 'w': 26, 'x': 27,
    'y': 28, 'z': 29, ' ': 44
};

// Global state
let k, kb;
let isTestActive = false;
let testWords = [];
let currentCharIndex = 0;
let pressureMode = 3;
let testStartTime = null;
let testStats = {
    accuracy: 0,
    totalAttempts: 0,
    successfulHits: 0,
    averageDeviation: 0,
    wpm: 0,
};
let attemptHistory = [];
let currentKeyCodeRequired = null;
let keyIsPressed = false;
let maxPressureOnKeyHold = 0;

// DOM Elements
const connectBtn = document.getElementById("connect");
const startTestBtn = document.getElementById("startTest");
const resetTestBtn = document.getElementById("resetTest");
const pressureModeSelect = document.getElementById("pressureMode");
const testStatusSpan = document.getElementById("testStatus");
const wordsDisplay = document.getElementById("wordsDisplay");
const currentKeySpan = document.getElementById("currentKey");
const pressureTargetSpan = document.getElementById("pressureTarget");
const wpmSpan = document.getElementById("wpm");
const accuracySpan = document.getElementById("accuracy");
const attemptsSpan = document.getElementById("attempts");
const successSpan = document.getElementById("success");
const avgDevSpan = document.getElementById("avgDev");
const progressSpan = document.getElementById("progress");
const totalCharsSpan = document.getElementById("totalChars");
const wordProgressSpan = document.getElementById("wordProgress");
const totalWordsSpan = document.getElementById("totalWords");
const timeElapsedSpan = document.getElementById("timeElapsed");

// Pressure level configurations
const PRESSURE_LEVELS = {
    2: [
        { name: 'Mid', min: MED_THRESHOLD, max: MED_HIGH_THRESHOLD },
        { name: 'Full', min: FULL_THRESHOLD, max: 1.0 }
    ],
    3: [
        { name: 'Light', min: LIGHT_THRESHOLD, max: MED_THRESHOLD },
        { name: 'Medium', min: MED_THRESHOLD, max: MED_HIGH_THRESHOLD },
        { name: 'Full', min: FULL_THRESHOLD, max: 1.0 }
    ],
    4: [
        { name: 'Light', min: LIGHT_THRESHOLD, max: 0.25 },
        { name: 'MediumLow', min: 0.25, max: MED_THRESHOLD },
        { name: 'MediumHigh', min: MED_THRESHOLD, max: MED_HIGH_THRESHOLD },
        { name: 'Full', min: FULL_THRESHOLD, max: 1.0 }
    ]
};

function generateTestSequence() {
    const numWords = 5; // Test with 5 words
    testWords = [];
    
    for (let i = 0; i < numWords; i++) {
        testWords.push(COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)]);
    }
    
    currentCharIndex = 0;
    attemptHistory = [];
    testStats = {
        accuracy: 0,
        totalAttempts: 0,
        successfulHits: 0,
        averageDeviation: 0,
        wpm: 0,
    };
    testStartTime = null;
    keyIsPressed = false;
    maxPressureOnKeyHold = 0;
    
    updateDisplay();
}

function getTotalChars() {
    return testWords.reduce((sum, word) => sum + word.length, 0) + (testWords.length - 1); // +1 for spaces
}

function getTargetPressure() {
    const levels = PRESSURE_LEVELS[pressureMode];
    return levels[Math.floor(Math.random() * levels.length)];
}

function updateDisplay() {
    // Update word display with cursor
    let displayHTML = '';
    let charCount = 0;
    
    testWords.forEach((word, wordIdx) => {
        word.split('').forEach((char, charIdx) => {
            const isTarget = charCount === currentCharIndex;
            const className = isTarget ? 'target-char' : 'normal-char';
            displayHTML += `<span class="${className}">${char}</span>`;
            charCount++;
        });
        
        if (wordIdx < testWords.length - 1) {
            const isTarget = charCount === currentCharIndex;
            const className = isTarget ? 'target-char' : 'normal-char';
            displayHTML += `<span class="${className}"> </span>`;
            charCount++;
        }
    });
    
    wordsDisplay.innerHTML = displayHTML;
    
    // Update progress
    progressSpan.textContent = currentCharIndex;
    totalCharsSpan.textContent = getTotalChars();
    
    const wordCount = testWords.length;
    const completedWords = testWords.slice(0, currentCharIndex > 0 ? 
        testWords.reduce((sum, w, i) => sum + w.length + (i === 0 ? 0 : 1), 0) >= currentCharIndex ? 
        Math.floor(currentCharIndex / 5) : 0 : 0);
    wordProgressSpan.textContent = completedWords;
    totalWordsSpan.textContent = wordCount;
}

function updateStats() {
    accuracySpan.textContent = Math.round(testStats.accuracy);
    attemptsSpan.textContent = testStats.totalAttempts;
    successSpan.textContent = testStats.successfulHits;
    avgDevSpan.textContent = Math.round(testStats.averageDeviation);
    wpmSpan.textContent = testStats.wpm;
}

function updateKeyVisualization() {
    for (const key in AnalogKeyCode) {
        if (isNaN(Number(key))) continue;
        const element = document.getElementById(key);
        if (!element) continue;

        try {
            const pressure = kb.buffer[key];
            const pressureNormalized = pressure / MAX_LEVEL;
            
            // Color visualization based on pressure
            let hue = 120; // Green
            if (pressureNormalized > FULL_THRESHOLD) hue = 0; // Red
            else if (pressureNormalized > MED_HIGH_THRESHOLD) hue = 30; // Orange
            else if (pressureNormalized > MED_THRESHOLD) hue = 60; // Yellow
            
            const saturation = Math.min(100, pressureNormalized * 150);
            const lightness = 50 - (pressureNormalized * 30);
            
            element.style.background = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        } catch (err) { }
    }
}

function recordAttempt(keyCode, pressureNormalized, success) {
    attemptHistory.push({
        keyCode,
        pressure: pressureNormalized,
        success,
        timestamp: Date.now(),
    });
    
    testStats.totalAttempts++;
    if (success) testStats.successfulHits++;
    testStats.accuracy = (testStats.successfulHits / testStats.totalAttempts) * 100;
    
    updateStats();
    
    // Move to next character
    currentCharIndex++;
    keyIsPressed = false;
    maxPressureOnKeyHold = 0;
    
    if (currentCharIndex >= getTotalChars()) {
        endTest();
    } else {
        updateDisplay();
        updateCurrentKeyInfo();
    }
}

function updateCurrentKeyInfo() {
    if (currentCharIndex < getTotalChars()) {
        let charCount = 0;
        let targetChar = '';
        
        for (const word of testWords) {
            for (const char of word) {
                if (charCount === currentCharIndex) {
                    targetChar = char;
                    break;
                }
                charCount++;
            }
            if (targetChar) break;
            if (charCount === currentCharIndex) {
                targetChar = ' ';
                break;
            }
            charCount++; // for space
        }
        
        const targetPressure = getTargetPressure();
        currentKeyCodeRequired = KEY_CODE_MAP[targetChar.toLowerCase()] || 44;
        currentKeySpan.textContent = targetChar === ' ' ? '⎵' : targetChar.toUpperCase();
        pressureTargetSpan.textContent = `Target: ${targetPressure.name} (${Math.round(targetPressure.min * 100)}-${Math.round(targetPressure.max * 100)}%)`;
    }
}

function endTest() {
    isTestActive = false;
    testStatusSpan.textContent = 'Complete!';
    startTestBtn.textContent = 'Start Test';
    startTestBtn.disabled = false;
    pressureModeSelect.disabled = false;
}

function updateTimeAndWPM() {
    if (!isTestActive || !testStartTime) return;
    
    const elapsedSeconds = (Date.now() - testStartTime) / 1000;
    const elapsedMinutes = elapsedSeconds / 60;
    timeElapsedSpan.textContent = Math.round(elapsedSeconds);
    
    if (elapsedMinutes > 0) {
        const words = testStats.successfulHits;
        testStats.wpm = Math.round(words / elapsedMinutes);
        updateStats();
    }
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
        updateCurrentKeyInfo();
        testStartTime = Date.now();
        startTestBtn.textContent = 'Test Running...';
        startTestBtn.disabled = true;
        pressureModeSelect.disabled = true;
        testStatusSpan.textContent = 'Running...';
        
        // Update time every 100ms
        setInterval(updateTimeAndWPM, 100);
    }
});

resetTestBtn.addEventListener("click", () => {
    isTestActive = false;
    generateTestSequence();
    updateStats();
    testStatusSpan.textContent = 'Idle';
    startTestBtn.textContent = 'Start Test';
    startTestBtn.disabled = false;
    pressureModeSelect.disabled = false;
    timeElapsedSpan.textContent = '0';
});

// Keyboard event listener
if ("hid" in navigator) {
    document.addEventListener("keydown", (e) => {
        if (!isTestActive || !kb) return;
        
        const char = String.fromCharCode(e.keyCode).toLowerCase();
        const keyCode = KEY_CODE_MAP[char];
        
        if (keyCode && keyCode === currentKeyCodeRequired && !keyIsPressed) {
            keyIsPressed = true;
            maxPressureOnKeyHold = 0;
        }
    });
    
    document.addEventListener("keyup", (e) => {
        if (!isTestActive || !kb || !keyIsPressed) return;
        
        const char = String.fromCharCode(e.keyCode).toLowerCase();
        const keyCode = KEY_CODE_MAP[char];
        
        if (keyCode && keyCode === currentKeyCodeRequired) {
            const pressureNormalized = maxPressureOnKeyHold / MAX_LEVEL;
            const targetPressure = getTargetPressure();
            const success = pressureNormalized >= targetPressure.min && pressureNormalized <= targetPressure.max;
            
            recordAttempt(keyCode, pressureNormalized, success);
            updateDisplay();
            
            if (isTestActive) {
                updateCurrentKeyInfo();
            }
        }
    });
    
    // Continuous pressure monitoring
    setInterval(() => {
        if (isTestActive && keyIsPressed && kb && currentKeyCodeRequired) {
            maxPressureOnKeyHold = Math.max(maxPressureOnKeyHold, kb.buffer[currentKeyCodeRequired] || 0);
        }
    }, 10);
}

// Initialize
generateTestSequence();
