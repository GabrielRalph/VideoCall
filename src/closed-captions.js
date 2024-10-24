
import { SvgPlus } from "./SvgPlus/4.js";
import { Icons } from "./Utilities/icons.js";





let icon = null;
let recognition = null;
let captionsDiv = null;
let fbf = null;
export function startRecognition(){
    if ('webkitSpeechRecognition' in window) {
        icon.styles = {
            "--ic1": "var(--ic3)",
            "--ic2": "var(--ic4)",
        }
        
        let timeout = null;
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true; // Keep recognizing
        recognition.interimResults = true; // Show interim results
        recognition.onresult = (event) => {
            clearTimeout(timeout)

            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            captionsDiv.innerText = transcript;
            captionsDiv.toggleAttribute("shown", transcript != "")

            timeout = setTimeout(() => {
                captionsDiv.toggleAttribute("shown", false)
            }, 2000)
        };
        recognition.onerror = (event) => {
            console.error('Error occurred in recognition: ', event.error);
        };
        recognition.onend = () => {
            // recognition.start();
        };

        recognition.start();
    } else {
    }
}


export function endRecognition(){
    if (recognition) {
        captionsDiv.toggleAttribute("shown", false)
        recognition.stop();
        icon.styles = {"--ic1": null, "--ic2": null}
    }
    recognition = null;
}

export function setCaptionElement(el) {
    captionsDiv = el;
}

export function setIcon(i){
    icon = i;
    icon.innerHTML = Icons.cc;
    if (!('webkitSpeechRecognition' in window)) {
        icon.styles = {
            opacity: "0.5", 
            "pointer-events": "none"
        }
    }
    
    icon.events = {
        click: () => {
            if (recognition) {
                fbf.set("on", false);
                // endRecognition()
            } else {
                fbf.set("on", true);
                // startRecognition();
            }
        }
    }
}

export function setFBFrame(fb) {
    fb.onValue("on", (on) => {
        if (on) startRecognition();
        else endRecognition();
    })
    fbf = fb;
}