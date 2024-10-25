
import { SvgPlus } from "./SvgPlus/4.js";
import { Icons } from "./Utilities/icons.js";





let icon = null;
let recognition = null;
let captionsDiv = null;
let fbf = null;
let recognising = false;
export function startRecognition(){
    if ('webkitSpeechRecognition' in window) {
        icon.styles = {
            "--ic1": "var(--ic3)",
            "--ic2": "var(--ic4)",
        }
        
        // let timeout = null;
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true; // Keep recognizing
        recognition.interimResults = true; // Show interim results
        recognition.onresult = (event) => {
            

            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            if (fbf) fbf.set(`text/${fbf.uid}`, transcript)
            
        };
        recognition.onerror = (event) => {
            console.error('Error occurred in recognition: ', event.error);
        };
        recognition.onend = () => {
            console.log("ended");
            if (recognising) startRecognition();
            console.log("restarting");
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
    recognising = false;
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
            } else {
                fbf.set("on", true);
            }
        }
    }
}

export function setFBFrame(fb) {
    fb.onValue("on", (on) => {
        if (on) startRecognition();
        else endRecognition();
    })
    let timeout = null;
    fb.onValue("text", (data) => {
        captionsDiv.innerHTML = "";
        if (data) {
            clearTimeout(timeout)

            let content = false;
            if (fb.uid in data) {
                captionsDiv.createChild("div", {content: data[fb.uid]})
                content = content || (data[fb.uid] != "")
                delete data[fb.uid]
            }
            for (let k in data) {
                content = content || (data[k] != "")
                captionsDiv.createChild('div', {class: "other", content: data[k]})
            }

            captionsDiv.toggleAttribute("shown", content)
            timeout = setTimeout(() => {
                fb.set(`text/${fb.uid}`, null)
                captionsDiv.toggleAttribute("shown", false)
            }, 2000)

        }
    })
    fbf = fb;
}