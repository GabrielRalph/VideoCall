import { SvgPlus, Vector } from "./SvgPlus/4.js";
import {HideShow, Slider} from "./Utilities/basic-ui.js"
import {delay} from "./Utilities/usefull-funcs.js"
import {Icons} from "./Utilities/icons.js"

import { addAppDatabase, getUserType, addStateListener} from "./WebRTC/webrtc.js"

import {
  BlobReader,
  BlobWriter,
  TextReader,
  TextWriter,
  ZipReader,
  ZipWriter,
} from "https://deno.land/x/zipjs/index.js";


const GridTemplate = {
  color: (val) => {
    if (!val) val = "white";
    return val;
  },
  name: (val) => {
    if (!val) val = "empty"
    return val;
  },
  filename: (val, el) => {
    if (!val) val = el.name;
    return val;
  },
  utterance: (val, el) => {
    if (!val) val = el.name;
    return val;
  }
}
function splitRow(row) {
  let si = 0;
  let ei = 0;
  let inQuote = false;
  let nrow = [];
  for (let c of row) {
    if (!inQuote && c == ',') {
      nrow.push(row.slice(si, ei))
      ei++;
      si = ei;
    } else if (c == '"') {
      inQuote = !inQuote;
      ei++;
    } else {
      ei++;
    }
  }
  return nrow;
}
function parseCSV(csv) {
  let data = []
  for (let row of csv.split(/\r*\n\r*/)) {
    
      if (row != '') {
        data.push(splitRow(row))
      }
  }
  let data2 = []
  for (let i = 1; i < data.length; i++) {
      let entry = {}
      for (let j = 0; j < data[0].length; j++) {
          entry[data[0][j].toLowerCase()] = data[i][j]
      }
      data2.push(entry)
  }
  return data2
}
function parseGridSpecs(csv) {
  let specs0 = parseCSV(csv);
  return specs0.map(el => {
    let nel = {};
    for (let key in GridTemplate) {
      nel[key] = GridTemplate[key](el[key], el)
    }
    return nel;
  });
}
function toDataURL(blob){
  return new Promise((resolve, reject) => {
    var a = new FileReader();
    a.onload = function(e) {resolve(e.target.result);}
    a.readAsDataURL(blob);
  })
}
async function blob2grid(blob) {
  const zipFileReader = new BlobReader(blob);
  
  const zipReader = new ZipReader(zipFileReader);
  const entries = await zipReader.getEntries()
  const csvFile = entries.filter((a) => a.filename.endsWith(".csv"))[0];
  const csvText = await csvFile.getData(new TextWriter());
  let specs = parseGridSpecs(csvText)
  for (let entry of specs) {
    let img = entries.filter(b => b.filename.startsWith(entry.filename))[0];
    if (img) {
      let ftype = img.filename.split('.').pop();
      if (ftype == "svg") ftype += '+xml'
      let data = await img.getData(new BlobWriter('image/'+ftype));
      entry.img = await toDataURL(data);
    }
  }

  await zipReader.close();
  return specs
}

fetchGrid();
async function fetchGrid(url) {
  let res = await fetch("../assets/ComGrid/GRID2/Archive.zip");
  let blob = await res.blob();
  return await blob2grid(blob);
}


async function openGrid(){
  let file = await new Promise((resolve, reject) => {
    let input = new SvgPlus("input");
    input.props = {
      "type": "file",
      events: {
        input: async (e) => {
          resolve(input.files[0]);
        }
      }
    }
    input.click();
  })
  return await blob2grid(file);
}


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
    constructor(icon, board){
      super('communication-icon');

      this.board = board;

      this.name = icon.name;
      this.utteranceText = icon.utterance ? icon.utterance : icon.name;
      let rel = this.createChild("div");
      this.styles = {
        background: icon.color ? icon.color : ""
      }

      rel.createChild("div", {content: icon.name})
      if (icon.img) {
        rel.createChild("div", {class: "image", styles: {"background-image": `url(${icon.img})`}});
      }
  
      this.svg = this.createChild("svg", {class: "load", viewBox: "-7 -7 14 14"});
      this.path = this.svg.createChild("path");
      this.progress = 0;
      this.update();
    }


    get dwellTime(){
      return this.board.dwellTime;
    }

    get dwellRelease(){
      return this.board.dwellRelease;
    }
    

    onclick(){this.speak()}
  
    async update() {
      let lastt = performance.now();
      while(true) {
        await delay();

          let t = performance.now();
          let dt = (t - lastt) / 1000; // seconds
          let dp = this.over ? dt / this.dwellTime : -dt / this.dwellRelease;
          
          this.progress += dp;
          lastt = t;
      }
    }


    set hover(bool){
      this.over = bool
      this.toggleAttribute("hover", bool);
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
  
    async speak(){
      if (!this.speaking) {
        this.speaking = true;
        let sync = window.speechSynthesis;
        const utterThis = new SpeechSynthesisUtterance(this.utteranceText);
        utterThis.voice = sync.getVoices()[0];
        await new Promise((resolve, reject) => {
          utterThis.onend = resolve
          sync.speak(utterThis);
        })
        this.speaking = false;
      }
    }
  }
  export class CommunicationBoard extends SvgPlus {
    constructor(){
      super('communication-board');
      this.events = {
        // contextmenu: (e) => {
        //   e.preventDefault();
        //   this.openGrid();
        // }
      }
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

      this._dwellTime = 0.7;
      this._dwellRelease = 1;

      addAppDatabase("com-board", this);
      addStateListener(this);
    }

    initialise(){
      if (!this.init) {
        this.init = true;
        console.log("init");
        this.onValue("shown", (shown) => {
          this._show(shown);
        });

        this.onValue("dwellTime", (time) => {
          if (time != null) {
            this._dwellTime = time;
            this.setDwellTime(time);
          }
        });
        this.onValue("dwellRelease", (time) => {
          if (time != null) {
            this._dwellRelease = time;
          }
        })
      }
    }


    set dwellTime(num){
      this.set("dwellTime", num);
      this._dwellTime = num;
    }
    get dwellTime(){
      return this._dwellTime
    }

    set dwellRelease(num){
      this.set("dwellRelease", num);
      this._dwellRelease = num;
    }
    get dwellRelease(){
      return this._dwellRelease;
    }

    set state(state){
      if (state) {
        this.initialise()
      }
    }
  
    /** @param {Vector} e */
    set eyePosition(e) {
      if (this.shown) {
        let item = this.getItemAtVector(e);
        for (let i of this.content.children) i.hover = false;
        
        if (item != null) {
          item.hover = true;
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


     makeSettings(){
      let dwell = new SvgPlus("div");
      dwell.createChild("b", {content: "Dwell Time"})
      let r = dwell.createChild("div", {styles: {display: "flex", "align-items": "center", "flex-direction": "row-reverse"}})
      let ts = r.createChild("span", {content: "0.7s", styles: {"user-select": "none", width: "2em"}});
      let dwellTime = r.createChild(Slider, {
        events: {
          change: () => {
            console.log(dwellTime.value);
            let t = dwellTime.value * 2.7 + 0.3;
            this.dwellTime = t
            ts.innerHTML = Math.round(t*10)/10 + "s";
          }
        }
      });

      this.setDwellTime = (t) => {
        dwellTime.value = (t-0.3)/2.7;
        ts.innerHTML = Math.round(t*10)/10 + "s";
      }

      this.setDwellTime(0.7);

      return dwell;
     }

    
    async openGrid(){
      let grid = await openGrid();
      await this.renderGrid(grid)
      
    }
  
    async renderGrid(grid = CommunicationGrid, size = 3){
      this.content.innerHTML = "";
      grid.map((icon, i) => {
        this.content.createChild(CommunicationIcon, {
          styles: {
            "grid-column": 1+i%size,
          }
        }, icon, this)
      })
    }
  
    show(bool){
      console.log("show", bool);
      this._show(bool);
      this.set("shown", bool);
    }
    _show(bool) {
      if (bool != this.shown) {
        this._shown = bool;
        this.waveTransition((t) => {
          this.styles = {"--slide": t}
        }, 350, bool);
        this.icon.children[0].style.transform = bool ? null : "scaleX(-1)"
      }
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
  
  