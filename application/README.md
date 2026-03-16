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

Which `wooting-js.js` file is used?

- By default this app imports the helper module from `../experimentation2/wooting-js.js` (see the import at the top of `application/app.js`). That module exports `ConnectNew`/`ConnectPrev` and dispatches `window` events named `akeydown` and `akeyup` with `detail: { key, value }` (the `value` is the pressure/force reading).
- The repository contains other copies (for example `experimentation/wooting-js.js`). If you prefer another copy, change the relative import path at the top of `application/app.js` to point at the desired file.

Notes
 - WebHID requires a secure context (HTTPS) or `localhost`; serving the files locally (as above) satisfies this requirement.
 - If you see import or permission errors, check the browser console and verify the relative import path in `application/app.js`.
 - Use a recent Chromium-based browser (Chrome or Edge) for best WebHID support.

Notes & assumptions
- This app assumes `wooting-js.js` from `../experimentation2/wooting-js.js` is present and that it dispatches `window` events `akeydown`/`akeyup` as in the repo.
- The code uses the most-recent pressure value as the style for the next typed character (simple approach; mapping by key code could be added).
- Thresholds are configurable in `app.js`.

Next steps (optional)
- Map force readings to the exact physical key rather than using the last pressure globally.
- Add selection formatting (apply style to selected text) and richer document model (saving, exporting, undo/redo).
