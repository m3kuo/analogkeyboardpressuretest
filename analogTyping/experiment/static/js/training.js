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

// Home row keys for testing
const HOME_ROW_KEYS = ["4", "22", "7", "9", "13", "14", "15", "51"]; // ASDF HJKL

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
let targetKeyCode = null;
const onHeld = new Map();

// DOM Elements
const connectBtn = document.getElementById("connect");
const pressureModeSelect = document.getElementById("pressureMode");
const pressInfoSpan = document.getElementById("pressInfo");


function getTrainingLabel(value) {
    if(pressureMode == 2){
        if(value >= MAX_LEVEL * FULL_THRESHOLD) return "Full";
        else if(value >= MAX_LEVEL * LIGHT_THRESHOLD) return "Light";
    }
    else if(pressureMode == 3){
        if(value >= MAX_LEVEL * FULL_THRESHOLD) return "full";
        else if(value >= MAX_LEVEL * MED_THRESHOLD) return "Medium";
        else return "Light";
    }
    else if(pressureMode == 4){
        if(value >= MAX_LEVEL * FULL_THRESHOLD) return "Full";
        else if(value >= MAX_LEVEL * MED_HIGH_THRESHOLD) return "MediumHigh";
        else if(value >= MAX_LEVEL * MED_THRESHOLD) return "MediumLow";
        else return "Light";
    }

    return "";
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

function typed(keyCode, value) {
   
    const status = getTrainingLabel(value);
    // const deviation = computeDeviationForRange(currentTarget.targetPressure, value);
    
    pressInfoSpan.textContent = `feedback: ${status}`;
}


// Event Listeners
connectBtn.addEventListener("click", () => {
    k = ConnectNew();
    k.then((res) => {
        kb = res[0];
        document.getElementById("deviceName").innerText = kb.deviceName;
        document.getElementById("productId").innerText = kb.device.productId;
        pressureModeSelect.disabled = false;
        connectBtn.textContent = 'Reconnect';
    });
});

pressureModeSelect.addEventListener("change", (e) => {
    pressureMode = parseInt(e.target.value);
});


window.addEventListener("akeydown", (e) => {
    //console.log("akeydown:" + e.detail.key);
    if(e.detail.value < MAX_LEVEL * LIGHT_THRESHOLD) return;
    const element = document.getElementById(e.detail.key);
        //if (!element) return;

        try {
            const pressure = e.detail.value;
            const percent = (pressure / 255) * 100;
            
            // Color visualization based on pressure
            const hue = percent > 80 ? 0 : percent > 50 ? 30 : percent > 20 ? 60 : 120;
            const saturation = Math.min(100, pressure);
            element.style.background = `hsl(${hue}, ${saturation}%, ${50 - pressure / 5}%)`;

            pressInfoSpan.textContent = '';
            
            // Show pressure percentage on target key
            // if (isTestActive && e.detail.key == targetKeyCode) {
            //     element.textContent = Math.round(percent) + '%';
            // }
            
            // update map
            if(onHeld.has(e.detail.key)){
                let value = Math.max(onHeld.get(e.detail.key), e.detail.value);
                onHeld.set(e.detail.key, value);
            }
            else{
                onHeld.set(e.detail.key, e.detail.value);
            }
            //console.log(onHeld.size);
        } catch (err) { console.log(err)}
});

window.addEventListener("akeyup", (e) => {
    //console.log(e.detail);
    const element = document.getElementById(e.detail.key);
        if (!element) return;

        try {
            // Color visualization based on pressure
            element.style.background = `linear-gradient(90deg, rgba(40,40,40,1) 0%, rgba(34,34,34,1) 50%, rgba(40,40,40,1) 100%)`;

            // update map
            if(onHeld.has(e.detail.key)){
                // check pressing status
                typed(e.detail.key, onHeld.get(e.detail.key));
                // let percent = (onHeld.get(e.detail.key) / 255) * 100;
                // pressInfoSpan.textContent = `Pressed: ${Math.round(percent)} %`;
                console.log("max: " + onHeld.get(e.detail.key));
                onHeld.delete(e.detail.key);
            }

        } catch (err) { console.log(err)}
});

// Initialize
generateTestSequence();

