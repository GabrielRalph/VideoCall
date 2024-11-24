import { SvgPlus, Vector } from "../SvgPlus/4.js";
import * as Webcam from "../Utilities/Webcam.js"
import { predictGesture } from "./gesture.js";
import { Icons } from "../Utilities/icons.js";
import { predictASLLetter } from "./tfjs-asl.js";
import { FirebaseFrame } from "../Firebase/rtc-signaler.js";

Webcam.setProcess((input) => {
  return predictGesture(input.video)
}, "gestures");

async function getStyles(url) {
  let base = import.meta.url.split("/");
  base.pop();
  base = base.join("/");
  url = base + url;
  let cssText = await (await fetch(url)).text();
  let cssStyle = new CSSStyleSheet()
  cssStyle.replaceSync(cssText);
  return cssStyle
}
const stylesPromise = getStyles("/style.css");


class EmojiFirebase extends FirebaseFrame {
  emojiClearTime = 3;
  onchange = (type, data) => {}
  constructor() {
    super("emoji");
  }
  onconnect(){
    this.onChildAdded("emotes", (value, ref) => {
      let {user, type} = value;
      if (user == this.uid) {
        setTimeout(() => {
          this.set(`emotes/${ref}`, null)
        }, this.emojiClearTime * 1000)
      } else {
        this.runEvent("emote", type)
      }
    })
    
    this.onChildAdded("raise-hand", (isRaised, uid) => {
      this.runEvent("raise-hand", [isRaised, uid == this.uid]);
    });
    this.onChildChanged("raise-hand", (isRaised, uid) => {
      this.runEvent("raise-hand", [isRaised, uid == this.uid]);
    });

    this.onValue("recognising", (mode) => {
      this.runEvent("recognising", mode)
    })

    this.onChildAdded("asl-text", (text, uid) => {
      if (this.uid != uid) {
        this.runEvent("asl-text", text);
      }
    });
    this.onChildChanged("asl-text", (text, uid) => {
      if (this.uid != uid) {
        this.runEvent("asl-text", text);
      }
    })
  }

  raiseHand() {
    this.set(`raise-hand/${this.uid}`, true)
  }

  lowerHand() {
    this.set(`raise-hand/${this.uid}`, false)
  }

  setASLText(text) {
    this.set(`asl-text/${this.uid}`, text);
  }

  setRecognising(mode) {
    this.set("recognising", mode)
  }

  sendEmote(type) {
    let eref = this.push("emotes");
    let user = this.uid
    console.log(eref);
    this.set(`emotes/${eref}`, {type, user})
  }


  runEvent(type, data) {
    if (this.onchange instanceof Function) this.onchange(type, data)
  }
}


const Emojis = {
  "ILoveYou": "❤️",
  "Thumb_Up": "👍",
  "Party popper": "🎉",
  "Clapping hands": "👏",
  "Laughing": "😂",
  "Surprised face": "😯",
   "Open_Palm": "✋",
  "Thinking face": "🤔",
  "Thumb_Down": "👎",
  "Victory": "✌️",
  "Pointing_Up": "👆",
  "Closed_Fist": "✊"


}
const EmojiSet = [
  "ILoveYou",
  "Thumb_Up",
  "Party popper",
  "Clapping hands",
  "Laughing",
  "Surprised face"
];


class PopUp extends SvgPlus {
  constructor(el = "div") {
    super(el);
    let tid = null;

    this._shown = false;
    this.events =  {
      mouseleave: () => {
        clearTimeout(tid)
        
        if (this.shown) {
          tid = setTimeout(() => {
            this.shown = false;
          }, 1000)
        }
      },
      mouseenter: () => {
        clearTimeout(tid);
      }
    }
  }

  set shown(val) {
    this.toggleAttribute("shown", val);
    this._shown = val;
  }
  get shown(){
    return this._shown;
  }
}

class ScoreCharges {
  chargeTime = 2;
  dischargeTime = 1;
  chargeValues = {};
  lastTime = -1;

  addScore(name, score) {
    if (name != "None") {
      let time = performance.now();
      if (this.lastTime == -1) this.lastTime = time;
      let dt = time - this.lastTime;

      if (!(name in this.chargeValues)) this.chargeValues[name] = 0;
      let dc= score * (dt / (this.chargeTime * 1000));
      this.chargeValues[name] += dc;
    }
    this.lastScore = name;
  }

  update(){
    let time = performance.now();
    if (this.lastTime == -1) this.lastTime = time;
    let dt = time - this.lastTime;
    this.lastTime = time;

    let charges = this.chargeValues;
    let charged = null;
    let dc = dt / (this.dischargeTime * 1000)
    for (let key in charges) {
      if (key != this.lastScore) charges[key] -=  dc;
      if (charges[key] < 0) {
        charges[key] = 0;
      }
      if (charges[key] > 1) {
        charged = key;
        this.reset();
        break;
      }
    }
    this.lastScore = null;
    return charged;
  }

  reset(){
    let charges = this.chargeValues
    for (let key in charges) {
      charges[key] = 0;
    }
  }

  get currentBest(){
    let keys = Object.keys(this.chargeValues);
    let best = ["None", 0];
    if (keys.length > 0) {
      let list = Object.keys(this.chargeValues).map(k => [k, this.chargeValues[k]]);
      list.sort((a, b) => b[1] - a[1])
      best = list[0]
    }
    return best;
  }
}

class ChargeCircle extends SvgPlus {
  constructor() {
    super("svg")
    this.class = "charge-circle"
    this.props = {viewBox: "-7 -7 14 14"}
    this.path = this.createChild("path")
    this.text = this.createChild("text", {
      "text-anchor": "middle",
      "font-size": "4",
      y: 1.3
    });
    this.g1 = this.createChild("g");
    this.toggleAttribute("hide", true)
  }

  spaceIcon(){
    this.g1.innerHTML = `<path d = "M-2,-.5L-2,.5L2,.5L2-.5" />`;
  }

  delIcon(){
    this.g1.innerHTML = `
      <polygon class="cls-1" points="-.91 -1.38 2.28 -1.38 2.28 1.38 -.91 1.38 -2.28 0 -.91 -1.38"/>
      <line class="cls-2" x1="1.07" y1="-.55" x2="-.04" y2=".55"/>
      <line class="cls-2" x1="-.04" y1="-.55" x2="1.07" y2=".55"/>
    `
  }

  set best([value, score]) {
    if (score == 0) {
      value = ""
    }
    this.toggleAttribute("hide", value == "")
    this.progress = score;
    this.text.innerHTML = "";
    this.g1.innerHTML = "";
    if (this[value + "Icon"] instanceof Function) {
      this[value+"Icon"]();
    } else {
      this.text.innerHTML = value
    }
  }

  set progress(num) {
    if (num > 1) num = 1;
    if (num < 0) num = 0;
    let angle = Math.PI * 2 * (1 - num)
    let p1 = new Vector(0, 5);
    let p2 = p1.rotate(angle);
    if (num > 0 && num < 1) {
      this.path.props = {d: `M${p1}A5,5,1,${angle > Math.PI ? 0 : 1},0,${p2}`};
    } else if (num == 1) {
      this.path.props = {d: `M0,5A5,5,0,0,0,0,-5A5,5,0,0,0,0,5`}
    }else {
      this.path.props = {d: ""};
    }
    this._progress = num;
  }
}

class ASLTextBoxes extends SvgPlus {
  timeOutPeriod = 5;
  constructor(){
    super("div")
    this.class = "asl-text-box";
    this.me = this.createChild("div", {class: "me"});
    this.them = this.createChild("div", {class: "them"});
    this.hide();

  }

  hide(){
    if (this._hidden ) return;
    console.log("hidding text");
    this._hidden = true;
    this.clearHideCountdown();
    this.toggleAttribute("hide", true);
    this._hidding = setTimeout(() => {
      console.log("text-cleared");
      this.set("", true)
      this.set("", false)
      this.dispatchEvent(new Event("cleared"));
      this._hidding = null;
    }, 300)
  }
  show(){
    if (!this._hidden) return;
    this._hidden = false;
    if (this._hidding) clearTimeout(this._hidding);
    this.toggleAttribute("hide", false);
    this.clearHideCountdown();
  }
  clearHideCountdown(){
    clearTimeout(this.timeOutId);
    this.timeOutId = null;
  }
  startHideCountdown(){
    if (this.timeOutId == null) {
      this.timeOutId = setTimeout(() => {
        this.hide();
      }, this.timeOutPeriod * 1000)
    }
  }

  get isEmpty() {
    let [a,b] = ["me", "them"].map(v=>this[v].innerHTML == "");
    return a && b
  }

  get(isMe = true) {
    return this[isMe ? "me" : "them"].textContent;
  }

  set(text, isMe = true) {
    let user = isMe ? "me" : "them"
    let textBox = this[user];
    textBox.textContent = text;
    if (this.isEmpty) {
      this.hide()
    } else {
      this.show();
    }
  }

  add(value, isMe = true) {
    let user = isMe ? "me" : "them"
    let textBox = this[user];
    switch (value) {
      case "del":
        textBox.innerHTML = textBox.innerHTML.slice(0, -1);
        break;
      case "space":
        textBox.innerHTML += "&nbsp;";
        break;
      default:
        textBox.innerHTML += value;
        break;
    }
    if (this.isEmpty) {
      this.hide()
    } else {
      this.show();
    }
  }
}

class EmojiReactions extends SvgPlus {
  constructor() {
    super("emoji-reactions");
    let shadow = this.attachShadow({mode: "open"})
    let rel = this.createChild("div", {class: "rel"});
    shadow.appendChild(rel);

    this.container = rel.createChild("div", {class: "emoji-container"});

    this.textBox = rel.createChild(ASLTextBoxes, {
      events: {
        cleared: () => {
          if (this.firebaseFrame && this.firebaseFrame.isConnected) {
            console.log("clearing asl");
            this.firebaseFrame.setASLText("");
          }
        }
      }
    });

    this.emojiCharger = this.container.createChild(ChargeCircle)

    let emojiList = rel.createChild(PopUp, {
      class: "emoji-list",
    });
    this.emojiList = emojiList;

    let list = emojiList.createChild("ul");
    this.emojis = {}
    for (let k of EmojiSet) {
      this.emojis[k] = 
      list.createChild("li").createChild("button", {
        class: `${k} emoji`,
        content: Emojis[k],
        events: {click: () => this.handleEmojiClick(k)}
      });
    }

    this.raisedIcon = emojiList.createChild("div", {
      content: "Raise Hand 🤚",
      class: "btn", 
      events: {click: () => {this.raiseHand()}}
    })

    this.gestureIcon = emojiList.createChild("div", {
      class: "btn",
      events: {
        click: () => {
          let recog = this.recognising == "GestureDetection" ? null : "GestureDetection"
          if (this.firebaseFrame) {
            this.firebaseFrame.setRecognising(recog);
          } else {
            this.recognising = recog;
          }
        }
      },
      content: "Gesture Recognition ✋👍"
    })
    
    this.aslIcon = emojiList.createChild("div", {
      class: "btn",
      events: {
        click: () => {
          let recog = this.recognising == "ASLDetection" ? null : "ASLDetection";
          if (this.firebaseFrame) {
            this.firebaseFrame.setRecognising(recog);
          } else {
            this.recognising = recog;
          }
        }
      },
      content: "ASL Recognition"
    })


    this.setupStyles();
    this.setupGestures();
    this.setupFirebase();
  }


  onGestureDetection(e){
    let charges = this.gestureCharges
    if (!!e.result) {
      let {gestures} = e.result;
      for (let gg of gestures) {
        for (let {categoryName, score} of gg) {
          charges.addScore(categoryName, score);
        }
      }
    }
    let value = charges.update();
    if (value) {
      if (value in Emojis) {
        if (value == "Open_Palm") {
          this.raiseHand(false)
        } else {
          this.handleEmojiClick(value)
        }
      }
    } else {
      let best = charges.currentBest;
      if (best[0] in Emojis) {
        best[0] = Emojis[best[0]]
        this.emojiCharger.best = best
      } else {
        this.emojiCharger.best = ["", 0]
      }
    }
  }

  onASLDetection(e){
    let charges = this.aslCharges;
    let y = predictASLLetter(e)
    if (y != null) {
      let bestScore = y.scores[y.best];
      charges.addScore(y.best, bestScore);
    }
    let value = charges.update();
    let best = charges.currentBest;
    this.emojiCharger.best = best;
    if (value) {
      this.textBox.add(value);
      if (this.firebaseFrame) {
        this.firebaseFrame.setASLText(this.textBox.get())
      }
    } else if (best[1] == 0) {
      this.textBox.startHideCountdown();
    }  else {
      this.textBox.clearHideCountdown();
    }
  }

  setupGestures(){
    this.gestureCharges = new ScoreCharges();
    this.aslCharges = new ScoreCharges();
    // this.aslCharges.chargeRate = 0.02
    Webcam.addProcessListener((e) => {
      this["on"+this.recognising](e);
    }, "gestures")
  }

  setupFirebase(){
    let fb = new EmojiFirebase();
      fb.onchange = (type, data) => {
        console.log(type, data);
        switch (type) {
          case "emote": 
            this.animateEmoji(data);
            break;

          case "raise-hand":
            let [raised, isMe] = data;
            this.showRaisedHand(isMe, raised);
            break;

          case "asl-text": 
            if (this.recognising) this.textBox.set(data, false);
            break;

          case "recognising": 
            this.recognising = data;
            break;
        }
      }
      this._fb = fb;
  }

  set recognising(val){
    this.gestureIcon.toggleAttribute("on", val == "GestureDetection");
    this.aslIcon.toggleAttribute("on", val == "ASLDetection");
    if (val !== null) {
      Webcam.startProcessing("gestures");
    } else {

      Webcam.stopProcessing("gestures");
      this.textBox.hide();
      this.emojiCharger.best = ["", 0]
    }
    this._recognising = val;
  }

  get recognising(){
    return this._recognising;
  }

  get firebaseFrame(){
    return this._fb;
  }

  async setupStyles(){
    this.shadowRoot.adoptedStyleSheets = [await stylesPromise]
  }

  show() {
    this.emojiList.shown = true;
  }

  animateEmoji(type) {
    // place the element inside the container
    const emojiEl = this.container.createChild("div", {
      class: "emoji-animate",
      content: Emojis[type]
    });
    
    let key = type;
    
    if (!(key in this.emojis)) {
      let keys = Object.keys(this.emojis)
      key = keys[Math.round(Math.random() * (keys.length - 1))]
    }

    let target = this.emojis[key];
     // get dynamic positions
     const { height, left } = target.getBoundingClientRect();
     const { bottom, top, width } = this.container.getBoundingClientRect();
 
     // animation
     const animation = emojiEl.animate(
       [
         { 
           opacity: 1, 
           transform: `translate(${left}px, ${bottom}px)` },
         {
           opacity: 0,
           transform: `translate(${width / 2}px, ${top - height}px)`,
         },
       ],
       {
         duration: 2000,
         easing: "cubic-bezier(.47,.48,.44,.86)",
       }
     );
 
     // remove element once has finished animating
     animation.onfinish = () => emojiEl.remove();
  }

  showRaisedHand(isMe, raised){
    let value = raised ? `<span style="padding: 0 0.2em; font-size: 2em">🤚</span>` : ""
    if (isMe) {
      this.raisedIcon.innerHTML = raised ? "Lower Hand" : "Raise Hand 🤚";
      this.raised = raised;
    }
    let sview = document.querySelector("session-view");
    sview.setIcon(value, isMe);

  }

  raiseHand(toggle = true) {
    const {firebaseFrame} = this;
    if (this.raised)  {
      if (toggle) {
        this.showRaisedHand(true, "");
        if (firebaseFrame) {
          firebaseFrame.lowerHand();
        }
      }
    } else {
      this.showRaisedHand(true);
      if (firebaseFrame) {
        firebaseFrame.raiseHand();
      }
    }
  }

  handleEmojiClick(type) {
    // get emoji from clicked element
    this.animateEmoji(type);
    const {firebaseFrame} = this;
    if (firebaseFrame) {
      firebaseFrame.sendEmote(type);
    }
  }
}



export {EmojiReactions}
  

