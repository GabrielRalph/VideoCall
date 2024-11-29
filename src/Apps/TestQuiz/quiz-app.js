import { initialise } from "../../Firebase/firebase-basic.js";
import { SvgPlus, Vector } from "../../SvgPlus/4.js";
import { SvgResize, POINTERS } from "../../Utilities/basic-ui.js";
import { SquidlyApp } from "../app-class.js";

async function loadStyles() {
    let url = import.meta.url.split("/").slice(0, -1).join("/") + "/styles.css";
    let ssText = await (await fetch(url)).text();
    let ss = new CSSStyleSheet();
    ss.replaceSync(ssText);
    
}
console.log(document.styleSheets);

class DwellIcon extends SvgPlus {
    constructor(){
      super('d-icon');
  
      this.svg = this.createChild("svg", { viewBox: "-7 -7 14 14"});
      this.path = this.svg.createChild("path");
      this.progress = 0;
      this.update();
    }
  
  
    get dwellTime(){
      return 1.5
    }
  
    get dwellRelease(){
      return 1.5
    }
    
  
    onclick(){this.select()}
  
    async update() {
      let lastt = performance.now();
      while(true) {
        await new Promise((resolve, reject) => {
            window.requestAnimationFrame(resolve)
        })
  
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
        this.select();
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
  
    async select(){
      this.dispatchEvent(new Event("select"))
    }
  }

  
class ElementGrid extends SvgPlus {
    constructor(el, [cols, rows], cellElement) {
        super(el);

        this.rows = rows;
        this.cols = cols;
        let tmp_c = (new Array(cols)).fill("1fr");
        let tmp_r = (new Array(rows)).fill("1fr");
        this.styles = {
            display: "grid",
            "grid-template-columns": tmp_c.join(" "),
            "grid-template-rows": tmp_r.join(" "),
        }
        for (let r = 0; r < rows; r++) {
            let row = [];
            for (let c = 0; c < cols; c++) {
                row.push(this.createChild(cellElement, {styles: {
                    "grid-column": c+1,
                    "grid-row": r+1
                }}));
            }
            this[r] = row;
        }
    }
    forEachCell(cb) {
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                let cell = this[i][j]
                cb(cell, i, j)
            }
        }
   }
}
const quiz_sizes = [
    [[2,1], "#d7f8c6"],
    [[2,2], "#f8c6c6"],
    [[3,3], "#e7bbf3"],
    [[4,4], "#f8e5c6"],
    [[5,5], "#c6d9f8"]
]
class SGrid extends ElementGrid {
    constructor(cols, rows, type = "s-grid") {
        super("div", [cols, rows], type == "s-grid" ? "div" : DwellIcon);
        this.class = type
        this.forEachCell((cell, i, j) => {
            let value = String.fromCharCode(65 + j + i * cols)
            cell.value = value;
            cell.createChild("span", {
                content: value
            }) 
            if (type == "s-grid") {
                cell.onclick = () => {
                    this.select(i, j);
                }
            }
        })
        this.value = ["-", "-", '-']
    }


    select(i, j) {
        let value = null;
        this.forEachCell((cell, i_, j_) => {
            cell.toggleAttribute("selected", i==i_ && j==j_)
        })
        this.value = [i, j, this[i][j].value]
    }
}

class QuizSettings extends SvgPlus {
    constructor(){
        super("div")
        this.class = "q-settings"
    }


    set value(value) {
        if (value == null) {
            this.build_initial_display();
        } else {
            this.build_results_table(value);
        }
    }

    build_results_table(value){
        this.innerHTML = "";
        let res = this.createChild(ElementGrid, {class: "results"}, "div", [4, quiz_sizes.length+1], "div");
        res.styles = {"grid-template-columns": null}
        res[0][0].innerHTML = `<b>Size</b>`
        res[0][1].innerHTML = `<b>Correct</b>`
        res[0][2].innerHTML = `<b>Chosen</b>`
        res[0][3].innerHTML = `<b>Time</b>`
        for (let i = 0; i < res.rows-1; i++) {
            res[i+1][0].innerHTML = value[i][0];
            res[i+1][1].innerHTML = value[i][1];
            res[i+1][2].innerHTML = value[i][2];
            res[i+1][3].innerHTML = value[i][3];
        }

        let is_complete = value.map(([a, b, c]) => c != "-").reduce((a, b) => a&&b);
        let btns = this.createChild("div", {class: "btns"});
        if (!is_complete) {
            btns.createChild("div", {class: "btn", content: "stop", events: {
                click: () => this.dispatchEvent(new Event("stop"))
            }})
        } else {
            btns.createChild("div", {class: "btn", content: "reset", events: {
                click: () => this.dispatchEvent(new Event("stop"))
            }})
            btns.createChild("div", {class: "btn", content: "save", events: {
                click: () => this.saveData()
            }})
        }
        this.res = res;
    }

    saveData() {
        if (this.res) {
            let csv = Object.keys((new Array(this.res.rows)).fill(0)).map(i => 
                Object.keys((new Array(this.res.cols)).fill(0)).map(j => this.res[i][j].textContent).join(", ")
            ).join("\n")
            

            // Create a Blob object from the CSV string
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            
            // Create a link element
            const link = document.createElement('a');
            
            // Create a URL for the Blob and set it as the href attribute
            const url = URL.createObjectURL(blob);
            link.href = url;
            
            // Set the file name for the download
            let d = new Date();
    
            link.download = `test-quiz(${d.getMonth()}-${d.getDate()} ${d.getHours()}h${d.getMinutes()}m).csv`;
            
            // Append the link to the document body and trigger the download
            this.appendChild(link);
            link.click();
            
            // Clean up: remove the link and revoke the Blob URL
            link.remove()
            URL.revokeObjectURL(url);
        }
    }

    build_initial_display(){
        this.res = null;
        this.innerHTML = "";
        let grids = [];
        for (let [[cols, rows], color] of quiz_sizes) {
            let g = this.createChild(SGrid, {}, cols, rows)
            g.styles = {
                "--color": color
            }
            grids.push(g);
        }
  
        this.createChild("div", {
            class: "btn",
            content: "Start",
            events: {
                click: () => {
                    const event = new Event("start");
                    event.value = grids.map((g, i) => {
                        let [r,c] = quiz_sizes[i][0]
                        return [`${r}x${c}`, g.value[2], "-", "-"]
                    })
                    this.dispatchEvent(event);
                }
            }
        })
    }
}

class QuizGame extends SvgPlus {
    constructor(isSender){
        super("div")
        this.class = "quiz-game"
        this.innerHTML = isSender ? this.host_welcome_template : this.welcome_template
    }

    get welcome_template(){
        return `
        <div class = "welcome-template">
            <h1>Get ready to begin!</h1>
            <p> When the test has started use you're eyes to focus on the letters prompted by the host. </p>
        </div>`
    }
    get host_welcome_template(){
        return `
        <div class = "welcome-template">
            <h1>Welcome to the test quiz.</h1>
            <p> Navigate to the app settings pannel by selecting the apps icon.
            Select the answers the participant will be required to select.
            When you are ready click the start button. 
            
            The participant will be shown each grid, from 1x2 up to 5x5. 
            The choosen answer will be highlighted (if that option is choosen).

            </p>
        </div>`
    }

    get complete_welcome_template(){
        return `
        <div class = "welcome-template">
            <h1>Thanks for participating in the test quiz.</h1>
            <p> 
                Please wait while your host reviews your results.
            </p>
        </div>`
    }

    get progress_welcome_template(){
        return `
        <div class = "welcome-template">
            <h1>The user is in progress.</h1>
            <p> 
                Check the results in the apps settings to view updates.
            </p>
        </div>`
    }

    inProgress(){
        this.grid = null;
        this.innerHTML = this.progress_welcome_template
    }


    async delay(time){
        return new Promise((resolve, reject) => {
            let tid = setTimeout(() => {
                resolve(true);
            }, time)
            this._stop = () => {
                this.stop = null;
                clearTimeout(tid);
                resolve(false);
            }
        })
    }


    async count_down() {
        this.grid = null;
        this.innerHTML = "<div class = 'welcome-template'><h1>3</h1></div>";
        for (let i = 0; i < 3; i++) {
            if (await this.delay(1000)) {
                this.innerHTML = `<div class = 'welcome-template'><h1>${2-i}</h1></div>`
            } else {
                return false
            }
        }
        return true;
    }

    display_grid(i, selected) {
        this.innerHTML = "";
        let [[cols, rows], color] = quiz_sizes[i]
        let grid = this.createChild(SGrid, {}, cols, rows, "q-grid");
        grid.styles = {"--color": color}
        grid.forEachCell((c, i, j) => {
            if (c.value == selected) {
                grid.select(i, j);
            }
        });
        this.grid = grid;
    }

    async wait_grid_selection(){
        return new Promise((resolve, reject) => {
            this._stop = () => {
                this._stop = null;
                resolve(null);
            }
            this.grid.forEachCell((c) => {
                c.events = {
                    select: () => resolve(c.value)
                }
            })
        })
    }

    set eyePosition(v) {
        if (this.grid) {
            let distances = [];
            this.grid.forEachCell((c) => {
                let [pos, size] = c.bbox;
                let center = pos.add(size.div(2))
                distances.push([center.dist(v), c])
                c.hover = false;
            })
            distances.sort((a, b) => a[0] - b[0]);
            distances[0][1].hover = true;
        }
    }

    async start(value){
        if (this.started) return;
        this.stopped = false;
        this.started = true;
        for (let i = 0; i < value.length; i++) {
            let exit = true;
            if (await this.count_down()) {
                this.display_grid(i, value[i][1]);
                let start_time = performance.now();
                let selected = await this.wait_grid_selection();
                if (selected !== null) {
                    let end_time = performance.now();
                    let duration = Math.round((end_time - start_time)/ 10) / 100;
                    value[i][2] = selected;
                    value[i][3] = duration;

                    const event = new Event("update");
                    event.value = value;
                    this.dispatchEvent(event);
                    exit = false;
                }
            }

            if (exit || this.stopped) break;
        }
        this.complete()
        this.started = false;
    }

    complete(){
        this.grid = null;
        this.innerHTML = this.complete_welcome_template
    }

    stop(){
        console.log("stopping");
        if (this._stop instanceof Function) this._stop();
        this.stopped = true;
    }
}

export default class TestQuiz extends SquidlyApp {
    constructor(sender, initialiser) {
        super(sender, initialiser);
        this.quizGame = new QuizGame(sender);

        if (sender) {
            this.settings = new QuizSettings();
            this.onValue("results", (value) => {
                this.settings.value = value;
                if (value != null) {
                    this.quizGame.inProgress()
                }
            })
     
            this.settings.events = {
                start: (e) => {
                    this.settings.value = e.value;
                    this.set("results", e.value);
                },
                stop: () => {
                    this.set("results", null);
                }
            }
        } else {
            this.onValue("results", (value) => {
                console.log(value);
                if(value !== null && !this.quizGame.started) {
                    let is_complete = value.map(([a, b, c]) => c != "-").reduce((a, b) => a&&b);
                    if (!is_complete) this.quizGame.start(value);
                    else this.quizGame.complete();
                } else if (value === null && this.quizGame.started) {
                    this.quizGame.stop();
                }
            })
            this.quizGame.events = {
                update: (e) => {
                    this.set("results", e.value);
                }
            }
        }
        
    }

    setEyeData(v) {
        this.quizGame.eyePosition = v;
    }

    getSideWindow(){
        if (this.settings) {
            return this.settings;
        }
    }

    getMainWindow(){
        return this.quizGame;
    }

    static get description(){
        return "Test eye gaze accuracy."
    }

    static get name(){
        return "Test Quiz"
    }

    static get userType(){
        return "host"
    }

    static get appIcon() {
        let svg = new SvgPlus("svg");
        svg.props = {viewBox: "-2 0 14.86 5.45"}
        svg.innerHTML = `<path class="cls-1" d="m.5,5.45c-.11,0-.23-.04-.32-.12-.21-.18-.24-.49-.06-.7.42-.49.64-1.33.85-2.14C1.25,1.4,1.52.36,2.35.07c.52-.19,1.14,0,1.87.54.63.47,1.18.98,1.65,1.43.84.79,1.5,1.42,2.16,1.37.54-.04,1.17-.53,1.93-1.5.17-.22.48-.26.7-.08.22.17.25.48.08.7-.96,1.22-1.8,1.82-2.64,1.88-1.1.08-1.94-.72-2.92-1.64-.48-.45-.98-.92-1.56-1.36-.6-.45-.86-.43-.95-.4-.32.11-.56,1.01-.75,1.73-.23.88-.49,1.87-1.05,2.53-.1.12-.24.18-.38.18Z"/>`
        return svg;
    }

    static get styleSheets(){
        return ["styles.css"]
    }
}
