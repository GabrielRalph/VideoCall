import { SvgPlus } from "../SvgPlus/4.js";


console.log();
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
  "Heart": "❤️",
  "Thumbs up": "👍",
  "Party popper": "🎉",
  "Clapping hands": "👏",
  "Laughing": "😂",
  "Surprised face": "😯",
  // "Crying face": "😢",
  // "Thinking face": "🤔",
  // "Thumbs down": "👎",
}


class EmojiReactions extends SvgPlus {
  constructor() {
    super("emoji-reactions");

    let shadow = this.attachShadow({mode: "open"})
    let rel = this.createChild("div", {class: "rel"});
    shadow.appendChild(rel);

    this.container = rel.createChild("div", {class: "emoji-container"});

    let tid = null;
    let emojiList = rel.createChild("div", {
      class: "emoji-list",
      events: {
        mouseleave: () => {
          clearTimeout(tid)
          if (this._shown) {
            tid = setTimeout(() => {
              this.emojiList.toggleAttribute("shown", false)
              this._shown = false;
            }, 1000)
          }
        },
        mouseenter: () => {
          console.log("--in");
          clearTimeout(tid);
        }
      }
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
      events: {click: () => {this.raiseHand()}}
    })
    this.setupStyles();
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
    this._shown = true;
    this.emojiList.toggleAttribute("shown", true);
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
  

