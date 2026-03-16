// Module-based app that maps analog keyboard pressure to formatting
import { ConnectNew, ConnectPrev } from '../experimentation2/wooting-js.js';

let rawPressure = 0;             // latest raw pressure 0-255
let currentPressure = 0;         // latest percent 0-100
let peakRawPressure = 0;         // highest raw pressure seen during current press
let peakPressure = 0;            // highest percent seen during current press
let connectedKeyboards = [];

// Tune this: how long to wait after keydown so analog pressure can settle
const PRESSURE_SETTLE_MS = 35;

// DOM elements
const pressureValueEl = document.getElementById('pressureValue');
const statusEl = document.getElementById('status');
const connectBtn = document.getElementById('connectBtn');
const editor = document.getElementById('editor');

const btnNormal = document.getElementById('btnNormal');
const btnBold = document.getElementById('btnBold');
const btnItalic = document.getElementById('btnItalic');

// Thresholds (percent)
// 0%          => normal
// 1-34%       => italic
// 35-97%      => bold
// 98-100%     => normal
const LIGHT_THRESHOLD = 35;
const FULL_THRESHOLD = 98;

// Update displayed/latest pressure and keep track of peak pressure
function setPressure(rawValue) {
  rawPressure = Number(rawValue) || 0;
  rawPressure = Math.max(0, Math.min(255, rawPressure));

  currentPressure = Math.round((rawPressure / 255) * 100);

  // Track the highest pressure reached during this press
  if (rawPressure > peakRawPressure) {
    peakRawPressure = rawPressure;
    peakPressure = Math.round((peakRawPressure / 255) * 100);
  }

  if (pressureValueEl) {
    pressureValueEl.textContent = String(currentPressure);
  }
}

function resetPeakPressure() {
  peakRawPressure = rawPressure;
  peakPressure = currentPressure;
}

// Helper for toolbar simulation
function setPressurePercent(percent) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const raw = Math.round((pct / 100) * 255);
  setPressure(raw);
  peakRawPressure = raw;
  peakPressure = pct;
}

// Choose style using the PEAK pressure reached, not just the latest sample
function pressureToStyleFromPercent(percent) {
  if (percent === 0) return 'normal';
  if (percent < LIGHT_THRESHOLD) return 'italic';
  if (percent < FULL_THRESHOLD) return 'bold';
  return 'normal';
}

function placeCaretAtEnd(element) {
  element.focus();

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);

  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function getEditorRange() {
  const sel = window.getSelection();

  if (!sel || sel.rangeCount === 0) {
    placeCaretAtEnd(editor);
    const newSel = window.getSelection();
    if (!newSel || newSel.rangeCount === 0) return null;
    return newSel.getRangeAt(0);
  }

  let range = sel.getRangeAt(0);

  if (!editor.contains(range.commonAncestorContainer)) {
    placeCaretAtEnd(editor);
    const newSel = window.getSelection();
    if (!newSel || newSel.rangeCount === 0) return null;
    range = newSel.getRangeAt(0);
  }

  return range;
}

function insertFormattedChar(char, style) {
  if (!editor) return;

  editor.focus();
  const range = getEditorRange();
  if (!range) return;

  range.deleteContents();

  if (char === '\n') {
    const br = document.createElement('br');
    range.insertNode(br);
    range.setStartAfter(br);
    range.setEndAfter(br);
  } else {
    const span = document.createElement('span');
    span.textContent = char;

    if (style === 'bold') {
      span.style.fontWeight = '700';
      span.style.fontStyle = 'normal';
    } else if (style === 'italic') {
      span.style.fontStyle = 'italic';
      span.style.fontWeight = '400';
    } else {
      span.style.fontWeight = '400';
      span.style.fontStyle = 'normal';
    }

    range.insertNode(span);
    range.setStartAfter(span);
    range.setEndAfter(span);
  }

  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// Small async delay helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Listen for analog pressure updates
window.addEventListener('akeydown', (e) => {
  const d = e.detail || {};
  const v = Number(d.value || 0);
  setPressure(v);
});

window.addEventListener('akeyup', (e) => {
  const d = e.detail || {};
  const v = Number(d.value || 0);
  setPressure(v);

  // When released, reset peak tracking so next press starts fresh
  if (rawPressure === 0) {
    peakRawPressure = 0;
    peakPressure = 0;
  }
});

// Handle normal keyboard typing
window.addEventListener('keydown', async (ev) => {
  if (!editor) return;

  // Ignore shortcuts
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

  // Prevent held-key spam
  if (ev.repeat) return;

  // Let browser handle backspace/delete
  if (ev.key === 'Backspace' || ev.key === 'Delete') return;

  // Only intercept Enter, Space, and printable characters
  const isEnter = ev.key === 'Enter';
  const isSpace = ev.key === ' ';
  const isPrintable = ev.key.length === 1;

  if (!isEnter && !isSpace && !isPrintable) return;

  ev.preventDefault();

  // Start peak tracking fresh for this key press
  resetPeakPressure();

  // Wait briefly so analog pressure can reach the intended level
  await sleep(PRESSURE_SETTLE_MS);

  const chosenPressure = peakPressure;
  const style = pressureToStyleFromPercent(chosenPressure);

  if (isEnter) {
    insertFormattedChar('\n', 'normal');
  } else if (isSpace) {
    insertFormattedChar(' ', style);
  } else {
    insertFormattedChar(ev.key, style);
  }
});

// Toolbar buttons
if (btnNormal) {
  btnNormal.addEventListener('click', () => {
    setPressurePercent(100);
    if (editor) editor.focus();
  });
}

if (btnBold) {
  btnBold.addEventListener('click', () => {
    setPressurePercent(50);
    if (editor) editor.focus();
  });
}

if (btnItalic) {
  btnItalic.addEventListener('click', () => {
    setPressurePercent(20);
    if (editor) editor.focus();
  });
}

// Connect button
if (connectBtn) {
  connectBtn.addEventListener('click', async () => {
    if (statusEl) statusEl.textContent = 'Requesting device...';

    try {
      let devices = [];

      if (typeof ConnectNew === 'function') {
        devices = await ConnectNew();
      } else if (typeof ConnectPrev === 'function') {
        devices = await ConnectPrev();
      } else {
        if (statusEl) statusEl.textContent = 'No helper available';
        alert('Connect functions not available. Check the import path to wooting-js.js.');
        return;
      }

      if (devices && devices.length > 0) {
        connectedKeyboards = devices;
        if (statusEl) statusEl.textContent = `Connected ${devices.length} device(s)`;
      } else {
        if (statusEl) statusEl.textContent = 'No compatible devices found';
      }
    } catch (err) {
      console.error(err);
      if (statusEl) statusEl.textContent = 'Error connecting';
    }
  });
}

// Keep editor focused
if (editor) {
  editor.addEventListener('click', () => editor.focus());

  window.addEventListener('load', () => {
    editor.focus();
    placeCaretAtEnd(editor);
  });
}