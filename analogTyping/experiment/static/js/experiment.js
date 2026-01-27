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


// Global state
let k, kb;
let isTestActive = false;
let currentTrials;
let pressureMode = 3;
let currentLevel = 0;
let currentBlock = 0;
let currentTrial = 0;
let startTime = 0;
let endTime = 0;
let id = "0";

const onHeld = new Map();

// DOM Elements
const connectBtn = document.getElementById("connect");
const testStatusSpan = document.getElementById("testStatus");
const targetInfoSpan = document.getElementById("targetInfo");
const pressInfoSpan = document.getElementById("pressInfo");
const mode = document.getElementById("pressureMode");
const block = document.getElementById("currentBlock");

// initial variable
const idElement = document.getElementById('inputID');
const IDJsonString = idElement.getAttribute('data-id');
// console.log(IDJsonString)
const participantID = JSON.parse(IDJsonString); // Convert JSON string to JavaScript object
// console.log(participantID)
id = participantID.id;

const trialsElement = document.getElementById('inputTrials');
const trialsJsonString = trialsElement.getAttribute('data-trials');
// console.log(trialsJsonString)
currentTrials = JSON.parse(trialsJsonString); // Convert JSON string to JavaScript object

const statusElement = document.getElementById('inputStatus');
const StatusJsonString = statusElement.getAttribute('data-status');
const currentStatus = JSON.parse(StatusJsonString); // Convert JSON string to JavaScript object
// console.log(currentStatus)
currentLevel = currentStatus.level;
currentBlock = currentStatus.block;
currentTrial = currentStatus.trial;

console.log(currentTrials)
console.log(currentLevel)
console.log(currentBlock)
console.log(currentTrial)


function initialInterface() {
    pressureMode = parseInt(currentTrials[currentLevel].levelCount);
    if (pressureMode === 2) mode.textContent = `2 Levels (Light, Full)`;
    else if (pressureMode === 3) mode.textContent = `3 Levels (Light, Medium, Full)`;
    else if (pressureMode === 4) mode.textContent = `4 Levels (Light, MediumLow, MediumHigh, Full)`;
    else mode.textContent = `Wrong levels`;

    block.textContent = `block: ${currentBlock}`;

}



function getTargetLabel(pressure) {
    if (pressureMode == 2) {
        if (pressure === "light") return "Light (10–99%)";
        if (pressure === "full") return "Full (100%)";
    }
    else if (pressureMode == 3) {
        if (pressure === "light") return "Light (10–50%)";
        if (pressure === "medium") return "Medium (51–99%)";
        if (pressure === "full") return "Full (100%)";
    }
    else if (pressureMode == 4) {
        if (pressure === "light") return "Light (10–40%)";
        if (pressure === "mediumLow") return "Medium Low (41–70%)";
        if (pressure === "mediumHigh") return "Medium High (71–99%)";
        if (pressure === "full") return "Full (100%)";
    }
    return "";
}

function isSuccessForRange(target, value) {
    if (pressureMode == 2) {
        if (target === "light") {
            if (value >= MAX_LEVEL * FULL_THRESHOLD) return { success: false, pressed: "full", reason: "lighter" };
            else if (value >= MAX_LEVEL * LIGHT_THRESHOLD) return { success: true, pressed: "light", reason: "" };
            else return { success: false, pressed: "", reason: "harder" };
        }
        else if (target === "full") {
            if (value >= MAX_LEVEL * FULL_THRESHOLD) return { success: true, pressed: "full", reason: "" };
            else if (value >= MAX_LEVEL * LIGHT_THRESHOLD) return { success: false, pressed: "light", reason: "harder" };
            else return { success: false, pressed: "", reason: "harder" };
        }
    }
    else if (pressureMode == 3) {
        if (target === "light") {
            if (value >= MAX_LEVEL * FULL_THRESHOLD) return { success: false, pressed: "full", reason: "lighter" };
            else if (value >= MAX_LEVEL * MED_THRESHOLD) return { success: false, pressed: "medium", reason: "lighter" };
            else if (value >= MAX_LEVEL * LIGHT_THRESHOLD) return { success: true, pressed: "light", reason: "" };
            else return { success: false, pressed: "", reason: "harder" };
        }
        if (target === "medium") {
            if (value >= MAX_LEVEL * FULL_THRESHOLD) return { success: false, pressed: "full", reason: "lighter" };
            else if (value >= MAX_LEVEL * MED_THRESHOLD) return { success: true, pressed: "medium", reason: "" };
            else if (value >= MAX_LEVEL * LIGHT_THRESHOLD) return { success: false, pressed: "light", reason: "harder" };
            else return { success: false, pressed: "", reason: "harder" };
        }
        if (target === "full") {
            if (value >= MAX_LEVEL * FULL_THRESHOLD) return { success: true, pressed: "full", reason: "" };
            else if (value >= MAX_LEVEL * MED_THRESHOLD) return { success: false, pressed: "medium", reason: "harder" };
            else if (value >= MAX_LEVEL * LIGHT_THRESHOLD) return { success: false, pressed: "light", reason: "harder" };
            else return { success: false, pressed: "", reason: "harder" };
        }
    }
    else if (pressureMode == 4) {
        if (target === "light") {
            if (value >= MAX_LEVEL * FULL_THRESHOLD) return { success: false, pressed: "full", reason: "lighter" };
            else if (value >= MAX_LEVEL * MED_HIGH_THRESHOLD) return { success: false, pressed: "mediumHigh", reason: "lighter" };
            else if (value >= MAX_LEVEL * MED_THRESHOLD) return { success: false, pressed: "mediumLow", reason: "lighter" };
            else if (value >= MAX_LEVEL * LIGHT_THRESHOLD) return { success: true, pressed: "light", reason: "" };
            else return { success: false, pressed: "", reason: "harder" };
        }
        if (target === "mediumLow") {
            if (value >= MAX_LEVEL * FULL_THRESHOLD) return { success: false, pressed: "full", reason: "lighter" };
            else if (value >= MAX_LEVEL * MED_HIGH_THRESHOLD) return { success: false, pressed: "mediumHigh", reason: "lighter" };
            else if (value >= MAX_LEVEL * MED_THRESHOLD) return { success: true, pressed: "mediumLow", reason: "" };
            else if (value >= MAX_LEVEL * LIGHT_THRESHOLD) return { success: false, pressed: "light", reason: "harder" };
            else return { success: false, pressed: "", reason: "harder" };
        }
        if (target === "mediumHigh") {
            if (value >= MAX_LEVEL * FULL_THRESHOLD) return { success: false, pressed: "full", reason: "lighter" };
            else if (value >= MAX_LEVEL * MED_HIGH_THRESHOLD) return { success: true, pressed: "mediumHigh", reason: "" };
            else if (value >= MAX_LEVEL * MED_THRESHOLD) return { success: false, pressed: "mediumLow", reason: "harder" };
            else if (value >= MAX_LEVEL * LIGHT_THRESHOLD) return { success: false, pressed: "light", reason: "harder" };
            else return { success: false, pressed: "", reason: "harder" };
        }
        if (target === "full") {
            if (value >= MAX_LEVEL * FULL_THRESHOLD) return { success: true, pressed: "full", reason: "" };
            else if (value >= MAX_LEVEL * MED_HIGH_THRESHOLD) return { success: false, pressed: "mediumHigh", reason: "harder" };
            else if (value >= MAX_LEVEL * MED_THRESHOLD) return { success: false, pressed: "mediumLow", reason: "harder" };
            else if (value >= MAX_LEVEL * LIGHT_THRESHOLD) return { success: false, pressed: "light", reason: "harder" };
            else return { success: false, pressed: "", reason: "harder" };
        }
    }

    return { success: false, pressed: "", reason: "" };
}


function recordAttempt(keyCode, value) {
    if (currentTrial >= currentTrials[currentLevel].trialBlock[currentBlock].sequence.length) return;

    endTime = Date.now()

    const currentTarget = currentTrials[currentLevel].trialBlock[currentBlock].sequence[currentTrial];

    if (currentTarget.key !== keyCode) return;
    const ret = isSuccessForRange(currentTarget.pressure, value);
    // const deviation = computeDeviationForRange(currentTarget.targetPressure, value);

    // attemptHistory.push({
    //     keyCode,
    //     targetPressure: currentTarget.targetPressure,
    //     actualPressure: value,
    //     // deviation: Math.round(deviation),
    //     success: ret.success,
    //     timestamp: Date.now(),
    // });

    if (!ret.success) pressInfoSpan.textContent = `feedback: press ${ret.reason}`;

    // Highlight success/failure
    const keyElement = document.getElementById(currentTarget.key);
    if (keyElement) {
        try {
            keyElement.style.background = `linear-gradient(90deg, rgba(40,40,40,1) 0%, rgba(34,34,34,1) 50%, rgba(40,40,40,1) 100%)`;
        }
        catch (err) { console.log(err) }

        keyElement.style.boxShadow = ret.success ? '0 0 20px #00FF00' : '0 0 20px #FF0000';
        setTimeout(() => {
            keyElement.style.boxShadow = '';
        }, 500);
    }


    // Move to next    
    let result = {
        "id": id,
        "level": currentLevel,
        "block": currentBlock,
        "trial": currentTrial,
        "levelCounts": pressureMode,
        "targetKey": AnalogKeyCode[currentTarget.key],
        "targetLevel": currentTarget.pressure,
        "pressedLevel": ret.pressed,
        "pressedRaw": value,
        "isSuccessful": ret.success,
        "startTime": startTime,
        "endTime": endTime,
        "time": endTime - startTime,
    };

    currentTrial++;
    // log file, update trial
    let updateinfo = {
        "id": id,
        "level": currentLevel,
        "block": currentBlock,
        "trial": currentTrial,
    }

    fetch("/typing/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, updateinfo })
    })
        .then(res => {
            res.json()
            if (currentTrial === currentTrials[currentLevel].trialBlock[currentBlock].sequence.length) {
                endTest();
            } else {
                updateTargetInfo();
            }
        }
        )
        .catch(err => {
            console.log(err);
        });





}

function updateTargetInfo() {

    if (currentTrial < currentTrials[currentLevel].trialBlock[currentBlock].sequence.length) {
        const target = currentTrials[currentLevel].trialBlock[currentBlock].sequence[currentTrial];
        console.log(AnalogKeyCode[target.key]);
        targetInfoSpan.textContent = `${AnalogKeyCode[target.key]} - ${getTargetLabel(target.pressure)}`;

        const targetKey = document.getElementById(target.key);
        //if (!element) return;

        try {
            if (target.pressure === "light") targetKey.style.background = `#FCF3CF`;
            else if (target.pressure === "medium" || target.pressure === "mediumLow") targetKey.style.background = `#F4D03F`;
            else if (target.pressure === "mediumHigh") targetKey.style.background = `#E67E22`;
            else targetKey.style.background = `#943126`;
        }
        catch (err) { console.log(err) }

        testStatusSpan.textContent = `Trial ${currentTrial + 1} / ${currentTrials[currentLevel].trialBlock[currentBlock].sequence.length}`;

        startTime = Date.now()
    }
    else {
        endTest();
    }
}

function endTest() {
    isTestActive = false;
    testStatusSpan.textContent = 'Complete!';
    fetch("/typing/endblock", { method: 'POST' }).then(
        response => {
            if (response.redirected) {
                window.location = response.url;
            } else {
                console.error('HTTP error', response.status);
            }
        }
    )

}

// Event Listeners
connectBtn.addEventListener("click", () => {
    k = ConnectNew();
    k.then((res) => {
        kb = res[0];
        document.getElementById("deviceName").innerText = kb.deviceName;
        document.getElementById("productId").innerText = kb.device.productId;

        connectBtn.textContent = 'Reconnect';
    });
});


window.addEventListener("akeydown", (e) => {
    //console.log("akeydown:" + e.detail.key);
    if (e.detail.value < MAX_LEVEL * LIGHT_THRESHOLD) return;
    const element = document.getElementById(e.detail.key);
    //if (!element) return;

    try {
        // const pressure = e.detail.value;
        // const percent = (pressure / 255) * 100;

        // Color visualization based on pressure
        // const hue = percent > 80 ? 0 : percent > 50 ? 30 : percent > 20 ? 60 : 120;
        // const saturation = Math.min(100, pressure);
        // element.style.background = `hsl(${hue}, ${saturation}%, ${50 - pressure / 5}%)`;

        pressInfoSpan.textContent = '';

        // Show pressure percentage on target key
        // if (isTestActive && e.detail.key == targetKeyCode) {
        //     element.textContent = Math.round(percent) + '%';
        // }

        // update map
        if (onHeld.has(e.detail.key)) {
            let value = Math.max(onHeld.get(e.detail.key), e.detail.value);
            onHeld.set(e.detail.key, value);
        }
        else {
            onHeld.set(e.detail.key, e.detail.value);
        }
        //console.log(onHeld.size);
    } catch (err) { console.log(err) }
});

window.addEventListener("akeyup", (e) => {
    //console.log(e.detail);
    const element = document.getElementById(e.detail.key);
    if (!element) return;

    try {
        // Color visualization based on pressure
        // element.style.background = `linear-gradient(90deg, rgba(40,40,40,1) 0%, rgba(34,34,34,1) 50%, rgba(40,40,40,1) 100%)`;

        // update map
        if (onHeld.has(e.detail.key)) {
            // check if space or not
            if (e.detail.key === "44") {
                if (!isTestActive) {
                    isTestActive = true;
                    testStatusSpan.textContent = 'Running...';
                    updateTargetInfo();                    
                }
            }

            // check correct or not
            recordAttempt(e.detail.key, onHeld.get(e.detail.key));

            // let percent = (onHeld.get(e.detail.key) / 255) * 100;
            // pressInfoSpan.textContent = `Pressed: ${Math.round(percent)} %`;
            console.log("max: " + onHeld.get(e.detail.key));
            onHeld.delete(e.detail.key);
        }

    } catch (err) { console.log(err) }
});


initialInterface();