# ⌨️ Pressure Type 

**Pressure Type** is an analog-sensitive typing application designed to challenge and evaluate physical keystroke precision. Developed for keyboards with analog Hall-Effect sensors and specificallu for Wooting Keyboards, it gamifies the typing experience by requiring specific pressure depths for every character and for commonly used words. This app is for human computer intearaction reserach purposes. 

## What is Pressure Type

A utility and interactive web application that measures per-key analog depth. Unlike standard typing tests, this application evaluates "How Hard" you press based on dynamic targets, providing real-time feedback and detailed analytical exports.
### Prerequisites

* **Analog Hardware:** A keyboard supporting per-key analog input (e.g., Wooting, SteelSeries, Razer).
* **Node.js:** v18.0 or higher.
* **Backend Driver:** A WebSocket server to stream HID reports to the browser.
## Installation
1. Navigate to the frontend folder and start by npm install then npm run dev
2. Seperate Terminal Window navigate to the backend and dotnet run
3. Select Wooting Keyboard


## Usage 
Click Connect Keyboard in the application header.
The connection status indicator will turn green once the handshake is complete.

**Running a Test**
To start a pressure-sensitive session:
1.Select your word count (5 or 15 words).
2.Click Start Session.
3.Follow the target pressure prompts:
Light: 10–40% depth
Medium: 41–80% depth
Full: 95%+ depth

## Results & Export
After the test concludes, the results dashboard provides:

WPM: Speed adjusted for pressure accuracy.

Accuracy: Percentage of keys hit within the target pressure range.

Average Force: Mean pressure depth across the session.

## Troubleshooting
Status: Disconnected
Ensure your Backend server is running and the port 8080 is not occupied or blocked by a firewall.

No Pressure Movement
Ensure your keyboard is in Analog Mode (e.g., Wooting Tachyon mode). Standard digital mode will only report 0% or 100%.

Wrong Keys Logged
Check the keyCodeMap in the source code. Different hardware manufacturers may use varying scan codes for specific HID reports.

   



