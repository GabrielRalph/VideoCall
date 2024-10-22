
import { SvgPlus } from "./SvgPlus/4.js";
import { Icons } from "./Utilities/icons.js";

let icon = new SvgPlus("div")

icon.innerHTML = Icons["video"]
if (!('webkitSpeechRecognition' in window)) {
    icon.styles = {opacity: "0.5", "--ic1": "red"}
}
icon.events = {
    click: () => {
        if (recognition) {
            endRecognition()
        } else {
            startRecognition();
        }
    }
}
let recognition = null;
export function startRecognition(){
    if ('webkitSpeechRecognition' in window) {
        icon.styles = {"--ic1": "red"}

        recognition = new webkitSpeechRecognition();
        recognition.continuous = true; // Keep recognizing
        recognition.interimResults = true; // Show interim results
        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            console.log(transcript);
            // captionsDiv.innerText = transcript;
        };
        recognition.onerror = (event) => {
            console.error('Error occurred in recognition: ', event.error);
        };
        recognition.onend = () => {
            console.log('Speech recognition service disconnected');
        };

        recognition.start();
    } else {
    }
}


export function endRecognition(){
    if (recognition) {
        recognition.stop();
        icon.styles = {"--ic1": null}

    }
    recognition = null;
}

export function getIcon(){
    return icon;
}