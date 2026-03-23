import { ConnectNew, ConnectPrev } from './wootingconnect.js';

const LIGHT_THRESHOLD = 33;
const FULL_THRESHOLD = 66;
const PRESSURE_SETTLE_MS = 50;

const editor = document.getElementById('editor');
const pressureValueEl = document.getElementById('pressureValue');
const statusEl = document.getElementById('status');
const connectBtn = document.getElementById('connectBtn');
const btnNormal = document.getElementById('btnNormal');
const btnBold = document.getElementById('btnBold');
const btnItalic = document.getElementById('btnItalic');

let rawPressure = 0;
let peakPressure = 0;
let connectedKeyboards = [];

function updatePressure(raw) {
  rawPressure = Math.max(0, Math.min(255, Number(raw) || 0));

  const percent = Math.round((rawPressure / 255) * 100);
  peakPressure = Math.max(peakPressure, percent);

  if (pressureValueEl) {
    pressureValueEl.textContent = String(percent);
  }
}

function resetPeakPressure() {
  peakPressure = Math.round((rawPressure / 255) * 100);
}

function setFakePressure(percent) {
  const raw = Math.round((percent / 100) * 255);
  rawPressure = raw;
  peakPressure = percent;

  if (pressureValueEl) {
    pressureValueEl.textContent = String(percent);
  }
}

function getStyleFromPressure(percent) {
  if (percent === 0) return 'normal';
  if (percent < LIGHT_THRESHOLD) return 'italic';
  if (percent < FULL_THRESHOLD) return 'bold';
  return 'normal';
}

function focusEditor() {
  if (!editor) return;
  editor.focus();

  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);

  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

function getRange() {
  const sel = window.getSelection();

  if (!sel || sel.rangeCount === 0) {
    focusEditor();
    const newSel = window.getSelection();
    return newSel && newSel.rangeCount > 0 ? newSel.getRangeAt(0) : null;
  }

  const range = sel.getRangeAt(0);

  if (!editor.contains(range.commonAncestorContainer)) {
    focusEditor();
    const newSel = window.getSelection();
    return newSel && newSel.rangeCount > 0 ? newSel.getRangeAt(0) : null;
  }

  return range;
}

function insertChar(char, style) {
  if (!editor) return;

  editor.focus();
  const range = getRange();
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

    if (style === 'italic') {
      span.style.fontStyle = 'italic';
    } else if (style === 'bold') {
      span.style.fontWeight = '700';
    }

    range.insertNode(span);
    range.setStartAfter(span);
    range.setEndAfter(span);
  }

  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

window.addEventListener('akeydown', (e) => {
  updatePressure(e.detail?.value || 0);
});

window.addEventListener('akeyup', (e) => {
  updatePressure(e.detail?.value || 0);

  if (rawPressure === 0) {
    peakPressure = 0;
  }
});

window.addEventListener('keydown', async (ev) => {
  if (!editor) return;
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (ev.repeat) return;
  if (ev.key === 'Backspace' || ev.key === 'Delete') return;

  const isEnter = ev.key === 'Enter';
  const isSpace = ev.key === ' ';
  const isPrintable = ev.key.length === 1;

  if (!isEnter && !isSpace && !isPrintable) return;

  ev.preventDefault();

  resetPeakPressure();
  await sleep(PRESSURE_SETTLE_MS);

  const style = getStyleFromPressure(peakPressure);

  if (isEnter) insertChar('\n', 'normal');
  else if (isSpace) insertChar(' ', style);
  else insertChar(ev.key, style);
});

btnNormal?.addEventListener('click', () => {
  setFakePressure(100);
  editor?.focus();
});

btnBold?.addEventListener('click', () => {
  setFakePressure(50);
  editor?.focus();
});

btnItalic?.addEventListener('click', () => {
  setFakePressure(20);
  editor?.focus();
});

connectBtn?.addEventListener('click', async () => {
  if (statusEl) statusEl.textContent = 'Requesting device...';

  try {
    let devices = [];

    if (typeof ConnectNew === 'function') {
      devices = await ConnectNew();
    } else if (typeof ConnectPrev === 'function') {
      devices = await ConnectPrev();
    }

    connectedKeyboards = devices || [];

    if (statusEl) {
      statusEl.textContent = connectedKeyboards.length
        ? `Connected ${connectedKeyboards.length} device(s)`
        : 'No compatible devices found';
    }
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = 'Error connecting';
  }
});

if (editor) {
  editor.addEventListener('click', focusEditor);
  window.addEventListener('load', focusEditor);
}