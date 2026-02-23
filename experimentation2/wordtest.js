import { ConnectNew, AnalogKeyCode } from './wooting-js.js';

if ("hid" in navigator) {
  console.log("The WebHID API is supported by this browser.");
} else {
  alert("The WebHID API is not supported by this browser.");
  console.assert(false, "The WebHID API is not supported by this browser.");
}

// =======================
// Config
// =======================
const MAX_LEVEL = 255;

const LIGHT_THRESHOLD = 0.05;
const MED_THRESHOLD = 0.35;
const MED_HIGH_THRESHOLD = 0.7;
const FULL_THRESHOLD = 0.98;

// Number of phrases/sentences per test (around 2 sentences as requested)
const NUM_WORDS = 2;

// Loaded phrases from word.txt (one phrase per line). Fallback to COMMON_WORDS if empty.
let PHRASES = [];

// Utility: Fisher-Yates shuffle
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// Load phrases from local word.txt (served alongside index.html).
async function loadPhrases() {
  try {
    const res = await fetch('word.txt');
    if (!res.ok) throw new Error('Failed to fetch word.txt');
    const txt = await res.text();
    PHRASES = txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    console.log(`Loaded ${PHRASES.length} phrases from word.txt`);
  } catch (err) {
    console.warn('Could not load word.txt, falling back to COMMON_WORDS:', err);
    PHRASES = [];
  }
}

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

// Key code mapping (HID usage IDs)
// NOTE: space (44) still exists, but we auto-skip spaces so the user never needs to press it.
const KEY_CODE_MAP = {
  'a': 4, 'b': 5, 'c': 6, 'd': 7, 'e': 8, 'f': 9, 'g': 10, 'h': 11,
  'i': 12, 'j': 13, 'k': 14, 'l': 15, 'm': 16, 'n': 17, 'o': 18, 'p': 19,
  'q': 20, 'r': 21, 's': 22, 't': 23, 'u': 24, 'v': 25, 'w': 26, 'x': 27,
  'y': 28, 'z': 29, ' ': 44
};

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

// Prevent spacebar activating controls that could regenerate words when test is NOT active.
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.key === ' ') {
    const ae = document.activeElement;
    if (!isTestActive && ae) {
      // If focus is on the Start/Reset buttons or the pressureMode select, block space from activating them
      if (ae.id === 'startTest' || ae.id === 'resetTest' || ae.id === 'pressureMode') {
        e.preventDefault();
      }
    }
  }
});

// =======================
// State
// =======================
let k, kb;
let isTestActive = false;

// Now each word is: { text: string, targetPressure: {name,min,max} }
let testWords = [];

let currentCharIndex = 0;          // cursor across full string incl spaces
let pressureMode = 3;
let testStartTime = null;

let testStats = {
  accuracy: 0,
  totalAttempts: 0,
  successfulHits: 0,
  averageDeviation: 0,  // (not fully implemented here)
  wpm: 0,
};

let attemptHistory = [];

let currentKeyCodeRequired = null;
let currentTargetPressure = null;  // word-level target (same for all letters in the word)

let keyIsPressed = false;
let maxPressureOnKeyHold = 0;
let allowRetypeMode = false; // when true, allow typing the final highlighted char after test end

// Intervals (so they don’t stack on every Start)
let vizIntervalId = null;
let wpmIntervalId = null;
let pressureIntervalId = null;

// =======================
// DOM
// =======================
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

// =======================
// Helpers
// =======================
function getTargetPressure() {
  const levels = PRESSURE_LEVELS[pressureMode];
  return levels[Math.floor(Math.random() * levels.length)];
}

function getTotalChars() {
  // Total letters + spaces between words
  return testWords.reduce((sum, w) => sum + w.text.length, 0) + (testWords.length - 1);
}

function isSpaceIndex(idx) {
  // Space positions occur after each word except last
  let count = 0;
  for (let w = 0; w < testWords.length - 1; w++) {
    count += testWords[w].text.length;
    if (idx === count) return true;
    count += 1; // skip the space
  }
  return false;
}

function skipSpaces() {
  while (currentCharIndex < getTotalChars() && isSpaceIndex(currentCharIndex)) {
    currentCharIndex++;
  }
}

function getWordIndexFromCharIndex(idx) {
  // returns 0..testWords.length (completed word count effectively)
  let count = 0;
  for (let w = 0; w < testWords.length; w++) {
    const len = testWords[w].text.length;
    if (idx < count + len) return w; // currently inside word w
    count += len;
    if (w < testWords.length - 1) {
      // idx == count means we're on the space -> next word
      if (idx === count) return w + 1;
      count += 1; // consume space
    }
  }
  return testWords.length;
}

function getCharAtGlobalIndex(idx) {
  let count = 0;
  for (let w = 0; w < testWords.length; w++) {
    const word = testWords[w].text;
    for (let i = 0; i < word.length; i++) {
      if (count === idx) return { char: word[i], wordIndex: w };
      count++;
    }
    if (w < testWords.length - 1) {
      if (count === idx) return { char: ' ', wordIndex: w }; // space after word w
      count++;
    }
  }
  return { char: '', wordIndex: testWords.length - 1 };
}

function updateStats() {
  accuracySpan.textContent = Math.round(testStats.accuracy);
  attemptsSpan.textContent = testStats.totalAttempts;
  successSpan.textContent = testStats.successfulHits;
  avgDevSpan.textContent = Math.round(testStats.averageDeviation);
  wpmSpan.textContent = testStats.wpm;
}

function updateDisplay() {
  // Render the whole sequence as spans and highlight currentCharIndex
  let displayHTML = '';
  let charCount = 0;

  testWords.forEach((wobj, wordIdx) => {
    const word = wobj.text;
    for (const ch of word) {
      const isTarget = charCount === currentCharIndex;
      const className = isTarget ? 'target-char' : 'normal-char';
      displayHTML += `<span class="${className}">${ch}</span>`;
      charCount++;
    }

    if (wordIdx < testWords.length - 1) {
      const isTarget = charCount === currentCharIndex;
      const className = isTarget ? 'target-char' : 'normal-char';
      displayHTML += `<span class="${className}"> </span>`;
      charCount++;
    }
  });

  wordsDisplay.innerHTML = displayHTML;

  // Progress: chars
  progressSpan.textContent = currentCharIndex;
  totalCharsSpan.textContent = getTotalChars();

  // Progress: words
  const completedWords = getWordIndexFromCharIndex(currentCharIndex);
  wordProgressSpan.textContent = completedWords;
  totalWordsSpan.textContent = testWords.length;
}

function updateKeyVisualization() {
  if (!kb) return;

  for (const key in AnalogKeyCode) {
    if (isNaN(Number(key))) continue;

    const element = document.getElementById(key);
    if (!element) continue;

    try {
      const pressure = kb.buffer[key];
      const pressureNormalized = pressure / MAX_LEVEL;

      let hue = 120; // green
      if (pressureNormalized > FULL_THRESHOLD) hue = 0;         // red
      else if (pressureNormalized > MED_HIGH_THRESHOLD) hue = 30; // orange
      else if (pressureNormalized > MED_THRESHOLD) hue = 60;      // yellow

      const saturation = Math.min(100, pressureNormalized * 150);
      const lightness = 50 - (pressureNormalized * 30);

      element.style.background = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    } catch (err) { }
  }
}

function updateCurrentKeyInfo() {
  if (currentCharIndex >= getTotalChars()) return;

  const { char, wordIndex } = getCharAtGlobalIndex(currentCharIndex);

  // If the current char is a space, treat its target as 'Any' (no specific pressure)
  if (char === ' ') {
    currentTargetPressure = null;
  } else {
    // Word-level pressure: inherit from the word you're currently typing
    currentTargetPressure = testWords[wordIndex]?.targetPressure ?? null;
  }

  currentKeyCodeRequired = KEY_CODE_MAP[(char || ' ').toLowerCase()] || null;

  currentKeySpan.textContent = char ? char.toUpperCase() : '';
  pressureTargetSpan.textContent = currentTargetPressure
    ? `Target: ${currentTargetPressure.name} (${Math.round(currentTargetPressure.min * 100)}-${Math.round(currentTargetPressure.max * 100)}%)`
    : `Target: Any`;
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

  // NOTE: averageDeviation not implemented (you can add it if you want)
  updateStats();

  // Determine if we're on the final character
  const lastIndex = getTotalChars() - 1;
  const isLastChar = currentCharIndex === lastIndex;

  // Reset hold state
  keyIsPressed = false;
  maxPressureOnKeyHold = 0;

  if (isLastChar) {
    // Do NOT advance past the last character — keep it highlighted so user can retype it.
    // Show results immediately but allow retyping the final char.
    allowRetypeMode = true;
    endTest(/*keepRetype=*/ true);
    // Keep currentCharIndex unchanged so highlight remains on final char.
    updateDisplay();
    updateCurrentKeyInfo();
  } else {
    // Advance one character
    currentCharIndex++;

    // Auto-skip spaces (no space key needed)
    skipSpaces();

    if (currentCharIndex >= getTotalChars()) {
      // If advancing lands past end (edge-case), end test normally
      endTest();
    } else {
      updateDisplay();
      updateCurrentKeyInfo();
    }
  }
}

function endTest() {
  // Default behaviour: end the test and clear running intervals.
  // If allowRetypeMode is active we still show results but keep the final char active.
  isTestActive = false;

  testStatusSpan.textContent = 'Complete!';
  startTestBtn.textContent = 'Start Test';
  startTestBtn.disabled = false;
  pressureModeSelect.disabled = false;

  // stop WPM timer for cleanliness
  if (wpmIntervalId) {
    clearInterval(wpmIntervalId);
    wpmIntervalId = null;
  }
}

function updateTimeAndWPM() {
  if (!isTestActive || !testStartTime) return;

  const elapsedSeconds = (Date.now() - testStartTime) / 1000;
  const elapsedMinutes = elapsedSeconds / 60;
  timeElapsedSpan.textContent = Math.round(elapsedSeconds);

  if (elapsedMinutes > 0) {
    const units = testStats.successfulHits;
    testStats.wpm = Math.round(units / elapsedMinutes);
    updateStats();
  }
}

function generateTestSequence() {
  testWords = [];

  const n = NUM_WORDS;
  if (PHRASES.length > 0) {
    // Sample n unique phrases randomly
    const indices = Array.from({ length: PHRASES.length }, (_, i) => i);
    shuffleArray(indices);
    const chosen = indices.slice(0, Math.min(n, indices.length));

    // Build balanced distribution of pressure level indices for even coverage
    const levels = PRESSURE_LEVELS[pressureMode];
    const m = levels.length;
    let levelIndices = [];
    for (let r = 0; r < Math.ceil(n / m); r++) {
      for (let k = 0; k < m; k++) levelIndices.push(k);
    }
    levelIndices = levelIndices.slice(0, n);
    shuffleArray(levelIndices);

    for (let i = 0; i < chosen.length; i++) {
      const phrase = PHRASES[chosen[i]];
      const lvl = levels[levelIndices[i]];
      testWords.push({ text: phrase, targetPressure: lvl });
    }
  } else {
    // Fallback: use COMMON_WORDS as before
    for (let i = 0; i < n; i++) {
      const w = COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)];
      testWords.push({ text: w, targetPressure: getTargetPressure() });
    }
  }

  currentCharIndex = 0;
  attemptHistory = [];
  testStats = { accuracy: 0, totalAttempts: 0, successfulHits: 0, averageDeviation: 0, wpm: 0 };

  testStartTime = null;
  keyIsPressed = false;
  maxPressureOnKeyHold = 0;

  // Clear retype mode whenever a new sequence is generated
  allowRetypeMode = false;

  currentTargetPressure = null;
  currentKeyCodeRequired = null;

  updateDisplay();
  updateStats();
}


// Events
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

    // Visualization interval (avoid stacking)
    if (vizIntervalId) clearInterval(vizIntervalId);
    vizIntervalId = setInterval(updateKeyVisualization, 50);

    // Pressure monitor interval (avoid stacking)
    if (pressureIntervalId) clearInterval(pressureIntervalId);
    pressureIntervalId = setInterval(() => {
      if (isTestActive && keyIsPressed && kb && currentKeyCodeRequired != null) {
        maxPressureOnKeyHold = Math.max(
          maxPressureOnKeyHold,
          kb.buffer[currentKeyCodeRequired] || 0
        );
      }
    }, 10);
  });
});

pressureModeSelect.addEventListener("change", (e) => {
  pressureMode = parseInt(e.target.value, 10);
  generateTestSequence();
});

startTestBtn.addEventListener("click", () => {
  if (isTestActive) return;

  isTestActive = true;

  generateTestSequence();
  updateCurrentKeyInfo();

  testStartTime = Date.now();

  startTestBtn.textContent = 'Test Running...';
  startTestBtn.disabled = true;
  pressureModeSelect.disabled = true;
  testStatusSpan.textContent = 'Running...';

  // WPM interval (avoid stacking)
  if (wpmIntervalId) clearInterval(wpmIntervalId);
  wpmIntervalId = setInterval(updateTimeAndWPM, 100);
});

resetTestBtn.addEventListener("click", () => {
  isTestActive = false;

  generateTestSequence();

  testStatusSpan.textContent = 'Idle';
  startTestBtn.textContent = 'Start Test';
  startTestBtn.disabled = false;
  pressureModeSelect.disabled = false;
  timeElapsedSpan.textContent = '0';

  if (wpmIntervalId) {
    clearInterval(wpmIntervalId);
    wpmIntervalId = null;
  }
});

// Keyboard listener
if ("hid" in navigator) {
  document.addEventListener("keydown", (e) => {
    // Allow handling while test is active OR when in retype mode for final char
    if (!(isTestActive || allowRetypeMode) || !kb) return;

    // prevent browser scroll etc.
    if (e.code === 'Space' || e.key === ' ') e.preventDefault();

    const key = (e.key || '').toLowerCase();
    if (key.length !== 1) return; // ignore Shift, Enter, etc.

    const keyCode = KEY_CODE_MAP[key];
    if (keyCode && keyCode === currentKeyCodeRequired && !keyIsPressed) {
      keyIsPressed = true;
      maxPressureOnKeyHold = 0;
    }
  });

  document.addEventListener("keyup", (e) => {
    // Allow handling while test is active OR when in retype mode for final char
    if (!(isTestActive || allowRetypeMode) || !kb || !keyIsPressed) return;

    const key = (e.key || '').toLowerCase();
    if (key.length !== 1) return;

    const keyCode = KEY_CODE_MAP[key];
    if (keyCode && keyCode === currentKeyCodeRequired) {
      const pressureNormalized = maxPressureOnKeyHold / MAX_LEVEL;

      const target = currentTargetPressure;
      let success;

      // If target is null => this is a space or 'Any' => accept any pressure
      if (!target) {
        success = true;
      } else {
        success =
          pressureNormalized >= target.min &&
          pressureNormalized <= target.max;
      }

      recordAttempt(keyCode, pressureNormalized, success);

      // If we're still in active test mode, update the current key info. If we are in
      // retype mode (test has ended but user can retry final char), keep the display as-is.
      if (isTestActive) updateCurrentKeyInfo();
    }
  });
}

// =======================
// Init
// =======================
// Load phrases from word.txt then generate initial sequence. If loading fails, generate using fallback.
loadPhrases().then(() => generateTestSequence());
