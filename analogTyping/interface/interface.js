import { ConnectNew, AnalogKeyCode } from './wooting-js.js';

if ("hid" in navigator) {
    console.log("The WebHID API is supported by this browser.");
} else {
    alert("The WebHID API is not supported by this browser.");
    console.assert(false, "The WebHID API is not supported by this browser.");
}

var k, kb;
document.getElementById("connect").addEventListener("click", () => {
    k = ConnectNew();
    k.then((res) => {
        kb = res[0];
        setInterval(() => {
            for (const key in AnalogKeyCode) {
                if (isNaN(Number(key))) {
                    continue;
                }

                try {
                    document.getElementById(key).style.color = colourize(kb.buffer[key]);
                } catch (err) { }
            }
        }, 50);
        document.getElementById("deviceName").innerText = kb.deviceName;
        document.getElementById("productId").innerText = kb.device.productId;
    });
});

function byte2Hex(n) {
    var nybHexString = "0123456789ABCDEF";
    return String(nybHexString.substr((n >> 4) & 0x0F, 1)) + nybHexString.substr(n & 0x0F, 1);
}

function colourize(i) {
    const frequency = 1;
    const red = 255 - i; //Math.sin(frequency*i + 0) * 127 + 128;
    const green = 255 - i; //Math.sin(frequency*i + 2) * 127 + 128;
    const blue = 255; //Math.sin(frequency*i + 4) * 127 + 128;
    return '#' + byte2Hex(red) + byte2Hex(green) + byte2Hex(blue);
}