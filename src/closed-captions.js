import { SvgPlus } from "./SvgPlus/4.js";
import { Slider } from "./Utilities/basic-ui.js";
import { Icons } from "./Utilities/icons.js";
import { FirebaseFrame } from "./Firebase/rtc-signaler.js";


class FontSize extends SvgPlus {
    maxFont = 24;
    minFont = 14;
    constructor(){
        super("div")
        this.class = "font-size"
        this.createChild("div", {content: "Font size:"})
        let sb1 = this.createChild("div")
        let ssbox = sb1.createChild("div")
        this.slider = ssbox.createChild(Slider, {
            events: {
                "change": (e) => {
                    this.display.innerHTML = this.value;
                    this.dispatchEvent(new Event("change"))
                }
            }
        });
        let nssbox = ssbox.createChild("div");
        nssbox.createChild("div", {content: "small"});
        nssbox.createChild("div", {content: "large"});
        this.display = sb1.createChild("div");


    }

    set value(value){
        let {maxFont, minFont} = this;
        value = value > maxFont ? maxFont : (value < minFont ? minFont : value)
        let p = (value - minFont) / (maxFont - minFont);
        this.slider.value = p;
        this.display.innerHTML = Math.round(value);
    }

    get value(){return Math.round(this.slider.value * (this.maxFont - this.minFont) + this.minFont)}
    get scale(){return this.slider.value}

}
const FONT_COLOR_SELECTION = [
    "white",
    "gold",
    "#ff5959", 
    "#bc76ff",
    "#7ea3ff",
    "#93ff45",
]
class FontColors extends SvgPlus {
    constructor(title){
        super("div")
        this.class = "font-colors"
        this.createChild("div", {content: title})
        let colors = this.createChild("div");
        this.colorIcons = FONT_COLOR_SELECTION.map(c => {
            let i = colors.createChild("div", {
                class: "font-colors-icon", 
                styles: {background: c},
                events: {
                    click: () => {
                        this.value = c;
                        this.dispatchEvent(new Event("change"))
                    }
                }
            })
            i.color = c;
            return i;
        })

    }

    set value(value) {
        for (let icon of this.colorIcons) {
            icon.toggleAttribute("selected", icon.color == value);
        }
        this._value = value;
    }
    get value(){
        return this._value;
    }
}
const DEFAULT_VALUE = {
    myFontColor: "gold",
    theirFontColor: "white",
    fontSize: 18,
}
const KEY_2_CSS = {
    myFontColor: "--my-captions-color",
    theirFontColor: "--their-captions-color",
    fontSize: "--captions-font-size",
}

class CaptionsSettingsFirebase extends FirebaseFrame {
    onSettings = () => {}
    constructor(){
        super("cc-settings");

    }
    onconnect(){
        this.onValue(null, (e) => {
            this.onSettings(e)
        })
    }
    set value(value){
        try{
            this.set(null, value)
        } catch(e){}
    }
}
let captionsSettingsFirebase = new CaptionsSettingsFirebase();
export class CaptionSettings extends SvgPlus {
    constructor(){
        super("div")
        this.class = "caption-settings"
        this.createChild("b", {content: "Captions"})
        this.fontSize = this.createChild(FontSize)
        this.myFontColor = this.createChild(FontColors, {}, "My Captions");
        this.theirFontColor = this.createChild(FontColors, {}, "Their Captions");
        for (let key in this.value) {
            this[key].addEventListener("change", () => this.updateStyles())
        }   
        this.value = DEFAULT_VALUE
        captionsSettingsFirebase.onSettings = (value) => {
            this.value = value
            this.updateStyles(false);
        }

    }

    updateStyles(updateFB = true){
        let {value} = this;
        for (let key in value) {
            document.documentElement.style.setProperty(KEY_2_CSS[key], value[key])
        }
        if (updateFB) captionsSettingsFirebase.value = value;
    }

    get value() {
        return {
            fontSize: this.fontSize.value,
            myFontColor: this.myFontColor.value,
            theirFontColor: this.theirFontColor.value
        }
    }

    set value(value) {
        let oldValue = this.value;
        for (let key in oldValue) {
            if (key in value) {
                oldValue[key] = value[key]
            }
            this[key].value = oldValue[key]
        }
    }
}

let icon = null;
let recognition = null;
let captionsDiv = null;
let fbf = new FirebaseFrame("cc");
fbf.onconnect = () => {
    fbf.onValue("on", (on) => {
        if (on) startRecognition();
        else endRecognition();
    })
    let timeout = null;
    fbf.onValue("text", (data) => {
        captionsDiv.innerHTML = "";
        if (data) {
            clearTimeout(timeout)

            let content = false;
            if (fbf.uid in data) {
                captionsDiv.createChild("div", {content: data[fbf.uid]})
                content = content || (data[fbf.uid] != "")
                delete data[fbf.uid]
            }
            for (let k in data) {
                content = content || (data[k] != "")
                captionsDiv.createChild('div', {class: "other", content: data[k]})
            }

            captionsDiv.toggleAttribute("shown", content)
            timeout = setTimeout(() => {
                fbf.set(`text/${fbf.uid}`, null)
                captionsDiv.toggleAttribute("shown", false)
            }, 2000)

        }
    })
}
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

