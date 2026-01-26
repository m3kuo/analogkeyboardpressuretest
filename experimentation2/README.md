# Experimentation 2 - Word Typing with Pressure Control

This folder contains a word-based typing test interface that combines typing speed with analog pressure control on a Wooting keyboard. Unlike the first experimentation folder which focuses on individual key pressure testing, this version tests complete words while maintaining specific pressure levels.

## Features

- **Direct WebHID Connection**: Same WebHID API connection as analogTyping interface
- **Word-Based Testing**: Type common English words with real-time visual feedback
- **Pressure Level Modes**:
  - 2 Levels: Mid (35-70%) and Full (98-100%)
  - 3 Levels: Light (5-35%), Medium (35-70%), Full (98-100%) - **Default**
  - 4 Levels: Light (5-25%), MediumLow (25-35%), MediumHigh (35-70%), Full (98-100%)
- **Real-time Statistics**:
  - WPM (Words Per Minute) tracking
  - Accuracy percentage
  - Correct keys pressed
  - Average pressure deviation
- **Visual Keyboard Feedback**: Pressure heatmap shows real-time key pressure
- **Progress Tracking**: Character and word completion progress
- **Word Highlighting**: Current character highlighted, typed words dimmed

## How to Use

### 1. Open in Browser

Open `index.html` in a modern web browser that supports WebHID API:

```bash
# Option 1: Use a local web server (Python)
python -m http.server 8000
# Then visit http://localhost:8000/experimentation2/

# Option 2: Use VS Code Live Server extension
# Right-click on index.html and select "Open with Live Server"
```

### 2. Connect Your Keyboard

1. Click the **"Connect!"** button
2. Select your Wooting keyboard from the browser's HID device dialog
3. Device name and Product ID should appear once connected

### 3. Configure Test

1. Select your preferred pressure level mode from the dropdown
2. Click **"Start Test"** to begin

### 4. Type the Words

1. You'll see 5 random words displayed
2. The current character is highlighted in **gold**
3. Type each word letter by letter
4. Each keystroke must match the target pressure level shown
5. Release the key when you've reached the target pressure
6. Continue until all words are typed

## Statistics Explained

- **WPM**: Words Per Minute - calculated based on successfully typed characters
- **Accuracy %**: Percentage of keystrokes that hit the target pressure range
- **Correct**: Number of successfully typed characters within pressure range
- **Total**: Total number of characters attempted
- **Avg Dev %**: Average deviation from target pressure (0% is perfect)

## Pressure Ranges Explained

### 2-Level Mode

- **Mid**: 35-70% of key travel (standard typing depth)
- **Full**: 98-100% of key travel (bottoming out)

### 3-Level Mode (Default)

- **Light**: 5-35% of key travel (feather-light touch)
- **Medium**: 35-70% of key travel (normal typing)
- **Full**: 98-100% of key travel (full depression)

### 4-Level Mode

- **Light**: 5-25% of key travel (ghost keypress)
- **MediumLow**: 25-35% of key travel (light touch)
- **MediumHigh**: 35-70% of key travel (normal typing)
- **Full**: 98-100% of key travel (full bottom-out)

## Color Coding

The keyboard visualization uses HSL color gradients to show pressure:

- **Green (Hue 120°)**: 0-20% pressure (light)
- **Yellow (Hue 60°)**: 20-50% pressure (medium)
- **Orange (Hue 30°)**: 50-80% pressure (heavy)
- **Red (Hue 0°)**: 80%+ pressure (very heavy)

## File Structure

```
experimentation2/
├── index.html          # Main HTML interface
├── wordtest.js         # Word typing test logic and event handlers
├── style.css           # Styling (extended from experimentation)
├── wooting-js.js       # WebHID API wrapper for Wooting keyboards
└── README.md           # This file
```

## Technical Details

### Connection Method

- **WebHID API** (not WebSocket)
- Direct browser-to-keyboard communication
- No backend server required
- Works locally without network dependency

### Test Configuration

- **Word Count**: 5 words per test
- **Word Source**: Curated list of common English words
- **Test Duration**: ~30-60 seconds depending on typing speed
- **Pressure Sampling**: 10ms intervals for accurate pressure tracking

### Key Features

- **Real-time Pressure Monitoring**: Continuously tracks maximum pressure during key hold
- **Character Progress**: Shows current character, total progress, and word count
- **Visual Feedback**: Target character highlighted, previously typed words dimmed
- **Automatic Advancement**: Moves to next character on key release
- **Statistics Aggregation**: Updates accuracy and WPM in real-time

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
- Enable experimental features if needed

### Keyboard not connecting

1. Ensure keyboard firmware is up to date
2. Try disconnecting/reconnecting USB cable
3. Reload the page and try again
4. Check browser console for error messages

### Words not showing or typing not registering

1. Verify keyboard is properly connected
2. Ensure you're pressing keys that are in the word
3. Check that keyboard is in the correct layout (QWERTY)
4. Try clicking "Reset" button to restart the test

### Pressure readings seem off

- Ensure you're pressing keys fully when testing full pressure
- Light touches should register pressure between 5-25%
- Normal typing is typically 35-70%

## Development Notes

This interface was created by extending the single-key pressure testing approach to support:

- Multi-key word sequences
- Real-time WPM calculation
- Progress tracking through word sets
- Character-by-character feedback
- Adaptive pressure requirements per key

To modify test parameters, edit the following in `wordtest.js`:

- `COMMON_WORDS`: Change the word list for testing
- `PRESSURE_LEVELS`: Modify pressure level configurations
- `numWords`: Change how many words per test (currently 5)
- Sampling intervals: Change pressure monitoring frequency

## Performance Tips

- Close other browser tabs to reduce CPU usage
- Ensure keyboard firmware is up to date for best pressure readings
- Test on a stable USB connection for consistent results
- Use the same typing style for each pressure level to build muscle memory
