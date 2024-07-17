import { SvgPlus, Vector } from "./SvgPlus/4.js";
import {HideShow} from "./Utilities/basic-ui.js"
import {delay} from "./Utilities/usefull-funcs.js"
import {Icons} from "./Utilities/icons.js"

const CommunicationGrid = [
    {
      name: "Like",
      color: "#f9eed2",
      img: "https://session-app.squidly.com.au/assets/ComGrid/r1_Like.svg"
    },
    {
      name: "Dislike",
      color: "#f9eed2",
      img: "https://session-app.squidly.com.au/assets/ComGrid/r1_Dislike.svg"
    },
    {
      name: "More",
      color: "rgb(249 226 210)",
      img: "https://session-app.squidly.com.au/assets/ComGrid/r1_more.svg"
    },
    
    
    {
      name: "You",
      color: "#c8e2c8",
      img: "https://session-app.squidly.com.au/assets/ComGrid/r1_You.svg"
    },
    {
      color: "#c8e2c8",
      name: "I",
      utterance: "I...",
      img: "https://session-app.squidly.com.au/assets/ComGrid/r1_I.svg"
    },
  
    {
      name: "Help",
      color: "#fef",
      img: "https://session-app.squidly.com.au/assets/ComGrid/r1_Help.svg"
    },
    
  
    {
      name: "Stop",
      color: "#ebeeff",
      img: "https://session-app.squidly.com.au/assets/ComGrid/r1_Stop.svg"
    },
    {
      name: "Play",
      color: "#ebeeff",
      img: "https://session-app.squidly.com.au/assets/ComGrid/r1_play.svg"
    },
    {
      name: "Repeat",
      color: "#ebeeff",
      img: "https://session-app.squidly.com.au/assets/ComGrid/r1_Repeat.svg"
  
    },
    
  ]
  
  class CommunicationIcon extends SvgPlus {
    constructor(icon){
      super('communication-icon');
      this.name = icon.name;
      this.utteranceText = icon.utterance ? icon.utterance : icon.name;
      let rel = this.createChild("div");
      this.styles = {
        background: icon.color ? icon.color : ""
      }
      rel.createChild("div", {content: icon.name})
      if (icon.img) {
        rel.createChild("div", {class: "image"}).createChild("img", {src: icon.img})
      }
  
      this.svg = this.createChild("svg", {class: "load", viewBox: "-7 -7 14 14"});
      this.path = this.svg.createChild("path");
      this.progress = 0;
  
      this.update();
    }

    onclick(){this.speak()}
  
    async update() {
      while(true) {
        await delay();
        if (!this.hasAttribute("hover")) {
          this.progress -= 0.02;
        }
      }
    }
  
    onOver(){
      this.progress += 0.02;
      this.over = true;
    }
  
    set progress(num) {
      if (num > 1) num = 1;
      if (num < 0) num = 0;
      let angle = Math.PI * 2 * (1 - num)
      let p1 = new Vector(0, 5);
      let p2 = p1.rotate(angle);
      if (num == 1 && this._progress < 1) {
        this.speak();
      }
      if (num > 0 && num < 1) {
        this.path.props = {d: `M${p1}A5,5,1,${angle > Math.PI ? 0 : 1},0,${p2}`};
      } else if (num == 1) {
        this.path.props = {d: `M0,5A5,5,0,0,0,0,-5A5,5,0,0,0,0,5`}
      }else {
        this.path.props = {d: ""};
      }
      this._progress = num;
    }
    get progress(){
      return this._progress;
    }
  
    speak(){
      let sync = window.speechSynthesis;
      const utterThis = new SpeechSynthesisUtterance(this.utteranceText);
      utterThis.voice = sync.getVoices()[0];
      sync.speak(utterThis);
    }
  }
  export class CommunicationBoard extends SvgPlus {
    constructor(){
      super('communication-board');
      this.icon = this.createChild(HideShow, {
        class: "coms-icon icon",
        content: Icons.arrow,
        events: {
          click: () => {
            this.show(!this.shown);
          }
        }
      }, "div");
      this.buffer = [];
  
      this.icon.children[0].style.transform = "scaleX(-1)"
  
      this.content = this.createChild("div", {
        class: "coms-content",
      })
  
      window.addEventListener("mousemove", (e) => {
        this.onVector(new Vector(e));
        this.eyePosition = new Vector(e);
      })
  
      this.renderGrid();
      this.sprogress = 0;
      this.updateProgress();
    }
  
    /** @param {Vector} e */
    set eyePosition(e) {
      if (this.shown) {
        let item = this.getItemAtVector(e);
        for (let i of this.content.children) i.toggleAttribute("hover", false);
        
        if (item != null) {
          item.toggleAttribute("hover", true);
          item.onOver();
        }
      } 
      this.onVector(e, true);
    }
  
    getItemAtVector(v) {
      let res = null;
      for (let item of this.content.children) {
        let [pos, size] = item.bbox;
        if (v.x > pos.x && v.x < pos.x + size.x && v.y > pos.y && v.y < pos.y + size.y) {
          res = item;
        }
      }
      return res;
    }
  
  
    renderGrid(grid = CommunicationGrid, size = 3){
      this.content.innerHTML = "";
      grid.map((icon, i) => {
        this.content.createChild(CommunicationIcon, {
          styles: {
            "grid-column": 1+i%size,
          }
        }, icon)
      })
    }
  
  
    show(bool) {
      this._shown = bool;
      this.waveTransition((t) => {
        this.styles = {"--slide": t}
      }, 350, bool);
      this.icon.children[0].style.transform = bool ? null : "scaleX(-1)"
  
    }
    get shown(){
      return this._shown;
    }
  
  
    set sprogress(val) {
      if (val > 1) val = 1;
      if (val < 0) val = 0;
  
      if (this.sprogress < 1 && val == 1) {
        this.show(!this.shown);
      }
      this._sprogress = val;
    }
    get sprogress(){
      return this._sprogress;
    }
  
    async updateProgress(){
      while(true) {
        if (!this._over) {
          this.sprogress -= 0.02;
        }
        await delay();
      }
    }
  
  
    get iconCenter(){
      let center = new Vector();
      let parent = this.offsetParent;
      if (parent != null) {
        let [origin, size] = parent.bbox;
        if (!this.shown) {
          center = origin;
        } else {
          center = origin.addH(size.x);
        }
      }
      return center;
    }
  
  
    async onVector(v, isEye = false) {
      let {iconCenter, shown} = this;
      let dist = iconCenter.dist(v);
      let over = dist < 100;
      this._over = over
  
      if (!shown) {
          if (isEye && over) {
            this.sprogress += 0.02;
          }
  
          if (!this.fading) {
            this.fading = true;
            if (over) {
              await this.icon.show();
            } else {
              await this.icon.hide();
            }
            this.fading = false;
          }
      } else {
        if (isEye && over) {
          this.sprogress += 0.02;
        }
        this.icon.shown = true;
      }
    }
  }
  
  