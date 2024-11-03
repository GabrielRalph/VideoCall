import { SvgPlus, Vector } from "../SvgPlus/4.js";
import * as Webcam from "../Utilities/Webcam.js"
import { predictGesture } from "./gesture.js";
import { Icons } from "../Utilities/icons.js";

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
  

}


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
  chargeRate = 0.03;
  dischargeRate = 0.07;
  chargeValues = {}

  addScore(name, score) {
    if (name != "None") {
      if (!(name in this.chargeValues)) this.chargeValues[name] = 0;
      this.chargeValues[name] += score * this.chargeRate;
    }
    this.lastScore = name;
  }

  update(){
    let charges = this.chargeValues;
    let charged = null;
    for (let key in charges) {
      if (key != this.lastScore) charges[key] -=  this.dischargeRate;
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
    let list = Object.keys(this.chargeValues).map(k => [k, this.chargeValues[k]]);
    list.sort((a, b) => b[1] - a[1])
    return list[0]
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
    })
  }

  set best([value, score]) {
    this.progress = score;
    this.text.innerHTML = value
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

class EmojiReactions extends SvgPlus {
  constructor() {
    super("emoji-reactions");

  
    

    let shadow = this.attachShadow({mode: "open"})
    let rel = this.createChild("div", {class: "rel"});
    shadow.appendChild(rel);

    this.container = rel.createChild("div", {class: "emoji-container"});

    let emojiSettings = rel.createChild(PopUp, {
      class: "emoji-list",
    });
    this.emojiSettings = emojiSettings;
    this.gestureIcon = emojiSettings.createChild("div", {class: "btn", 
      events: {
        click: () => this.recognising = !this.recognising
      }
    })
    this.gestureTick = this.gestureIcon.createChild("div", {class: "icon",content: Icons.tick})
    this.gestureIcon.createChild("span", {content: "Gesture Recognition ✋👍👎🤟"})
    this.recognising = false;

    this.emojiCharger = this.container.createChild(ChargeCircle)

    let emojiList = rel.createChild(PopUp, {
      class: "emoji-list",
    });
    this.emojiList = emojiList;

    let list = emojiList.createChild("ul");
    this.emojis = {}
    for (let k in Emojis) {
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
    this.setupStyles();
    this.setupGestures();
  }

  setupGestures(){
    let charges = new ScoreCharges();
    Webcam.addProcessListener((e) => {
      if (!!e.result) {

        let {gestures} = e.result;
        console.log(e.result);
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
            this.raiseHand()
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
      
    }, "gestures")
  }

  set recognising(val){
    this.gestureTick.styles = {opacity: val ? null : "0"}
    this._recognising = val;
    if (val) Webcam.startProcessing("gestures")
    else Webcam.stopProcessing("gestures")

    // if (val) this.gestureIcon.innerHTML = "Gesture Recognition ✋👍👎🤟"
    // else 
  }
  get recognising(){
    return this._recognising;
  }

  set firebaseFrame(fb) {
    this._fb = fb;
    fb.onChildAdded(null, (value, path) => {
      let {user, type} = value;
      if (user != fb.uid) {
        if (type == "raiseHand") {
          this.showRaisedHand(false);
        } else if (type === "lower"){
          this.showRaisedHand(false, "")
        } else {
          this.animateEmoji(type);
        }
      } else {
        if (type !== "raiseHand") {
          setTimeout(() => {
            fb.set(path, null)
          }, 3000);
        }
      }
    })
  }
  
  get firebaseFrame(){
    return this._fb;
  }

  async setupStyles(){
    this.shadowRoot.adoptedStyleSheets = [await stylesPromise]
  }


  show() {
    this.emojiList.shown = true;
    this.emojiSettings.shown = false;
  }

  showSettings(){
    this.emojiSettings.shown = true;
    this.emojiList.shown = false;

  }


  animateEmoji(type) {
    // place the element inside the container
    const emojiEl = this.container.createChild("div", {
      class: "emoji-animate",
      content: Emojis[type]
    });
    
    let target = this.emojis[type];

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


  showRaisedHand(isMe, value = `<span style="padding: 0 0.2em; font-size: 2em">🤚</span>`){
    let sview = document.querySelector("session-view");
    sview.setIcon(value, isMe);
  }


  raiseHand() {
    const {firebaseFrame} = this;
    if (this.raised != null)  {

      this.showRaisedHand(true, "");
      this.raisedIcon.innerHTML = "Raise Hand 🤚"

      if (firebaseFrame) {
        firebaseFrame.set(this.raised, null)
        let pref = firebaseFrame.push(null);
        firebaseFrame.set(pref, {
          user: firebaseFrame.uid,
          type: "lower",
        })
      }
      this.raised = null;
    } else {
      this.raised = true;
      this.showRaisedHand(true);
      this.raisedIcon.innerHTML = "Lower Hand"
      if (firebaseFrame) {
        let pref = firebaseFrame.push(null);
        this.raised = pref;
        firebaseFrame.set(pref, {
          user: firebaseFrame.uid,
          type: "raiseHand",
        })
      }
    }
  }


  handleEmojiClick(type) {
    // get emoji from clicked element
    this.animateEmoji(type);
    const {firebaseFrame} = this;
    if (firebaseFrame) {
      let pref = firebaseFrame.push(null);
      firebaseFrame.set(pref, {
        user: firebaseFrame.uid,
        type: type,
      })
    }
  }
}

export {EmojiReactions}
  

