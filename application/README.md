Analog Pressure Editor

A minimal web editor that demonstrates using an analog (Wooting-style) keyboard pressure to change formatting of typed characters.

Behavior
- Full press -> normal text
- Medium press -> bold text
- Light press -> italics

Files
- index.html — main editor UI
- app.js — app logic (listens for `akeydown`/`akeyup` and keyboard `keydown`)
- style.css — simple styling

How to run

Quick (may work for simple file testing)
1. Open `application/index.html` in a modern Chromium-based browser that supports WebHID (Chrome/Edge). Note: opening via `file://` can cause module import or permission issues in some browsers.

Recommended (PowerShell)
1. From the repository root start a simple local server so module imports and WebHID work correctly. In PowerShell run one of these commands:

```powershell
# If `python` is available:
python -m http.server 8000

# Or with the Windows `py` launcher:
py -3 -m http.server 8000
```

2. Open the browser and go to:

	http://localhost:8000/application/index.html

3. Click "Connect Keyboard" and accept the browser HID prompt. Then type in the editor — different press strengths will change the style of the next inserted character.



Next steps (optional)
- Map force readings to the exact physical key rather than using the last pressure globally.
- Add selection formatting (apply style to selected text) and richer document model (saving, exporting, undo/redo).
