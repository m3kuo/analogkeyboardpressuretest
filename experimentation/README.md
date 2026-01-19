# Experimentation - Analog Keyboard Pressure Test

This folder contains a standalone pressure testing interface for Wooting analog keyboards, cloned from the `analogTyping/interface` implementation but with enhanced pressure testing capabilities.

## Features

- **Direct WebHID Connection**: Uses the same WebHID API connection method as the analogTyping interface
- **Pressure Level Testing**: Test at different pressure ranges (Light, Medium, Mid, Full)
- **Dual Mode Support**: 
  - 2 Levels: Mid (10-90%) and Full (100%)
  - 3 Levels: Light (10-40%), Medium (41-80%), and Full (100%)
- **Real-time Statistics**: Track accuracy, attempts, successful hits, and average pressure deviation
- **Visual Keyboard Feedback**: HSL color gradient showing pressure intensity on each key
- **Home Row Testing**: Focuses on ASDFGHJKL keys for consistency

## How to Use

### 1. Open in Browser
Open `index.html` in a modern web browser that supports WebHID API (Chrome, Edge, Opera):

```bash
# Option 1: Use a local web server
python -m http.server 8000
# Then visit http://localhost:8000

# Option 2: Use Live Server extension in VS Code
# Right-click on index.html and select "Open with Live Server"
```

### 2. Connect Your Keyboard
1. Click the **"Connect!"** button
2. Select your Wooting keyboard from the browser's HID device dialog
3. Device name and Product ID should appear once connected

### 3. Start Testing
1. Select your preferred pressure level mode:
   - **2 Levels**: Mid and Full pressure
   - **3 Levels**: Light, Medium, and Full pressure (default)
2. Click **"Start Test"** to begin
3. Follow the on-screen prompts for which key to press and at what pressure
4. Press and hold the target key at the required pressure level
5. Release when you feel you've reached the target pressure

## Statistics Explained

- **Accuracy %**: Percentage of attempts that hit the target pressure range
- **Attempts**: Total number of key presses performed
- **Success**: Number of successful pressure matches
- **Avg Dev %**: Average deviation from the target pressure range (0% is perfect)

## File Structure

```
experimentation/
├── index.html          # Main HTML interface
├── pressuretest.js     # Test logic and event handlers
├── style.css           # Styling (cloned from analogTyping)
├── wooting-js.js       # WebHID API wrapper for Wooting keyboards
└── README.md           # This file
```

## Technical Details

### Connection Method
- Uses **WebHID API** (not WebSocket)
- Direct browser-to-keyboard communication
- No backend server required
- Works locally without network dependency

### Pressure Ranges
- **Light**: 10-40% of key travel
- **Medium**: 41-80% of key travel
- **Mid**: 10-90% of key travel (2-level mode)
- **Full**: 95-100% of key travel

### Color Coding
Keys are color-coded by pressure intensity:
- Red (High): Heavy pressure
- Yellow (Medium): Medium pressure
- Green (Low): Light pressure
- Blue: No pressure

## Requirements

- Modern browser with WebHID support:
  - Chrome/Chromium 89+
  - Edge 89+
  - Opera 75+
- Wooting analog keyboard (One, Two, or successor models)
- WebHID must be enabled in browser settings

## Troubleshooting

### "The WebHID API is not supported by this browser"
- Use Chrome, Edge, or Opera browser
- Enable WebHID in experimental features if needed

### Keyboard not connecting
1. Ensure keyboard firmware is up to date
2. Try disconnecting/reconnecting USB cable
3. Reload the page and try again
4. Check browser console for error messages

### No pressure data showing
- Verify keyboard is properly connected
- Ensure keyboard firmware supports analog reporting
- Check that you're pressing the home row keys (ASDFGHJKL)

## Development Notes

This interface was created by cloning the `analogTyping/interface` implementation and adding:
- Pressure level selection system
- Test sequence generation
- Attempt tracking and statistics
- Real-time accuracy feedback
- Enhanced keyboard visualization

To modify test parameters, edit the following in `pressuretest.js`:
- `PRESSURE_LEVELS`: Add or modify pressure level configurations
- `HOME_ROW_KEYS`: Change which keys are tested
- Test sequence length: Modify the loop count in `generateTestSequence()`
