import { SvgPlus, Vector } from "../../SvgPlus/4.js";
import { SvgResize, POINTERS } from "../../Utilities/basic-ui.js";
import { SquidlyApp } from "../app-class.js";
import { ColorPicker } from "./color-picker.js"
import {simplifyPoints} from "./simplify.js"
import { fitCurve } from "./fitcurve.js";


function makeSmoothPath(points, t1 = 1, t2 = 0.5, t3 = 0.5) {
    points = simplifyPoints(points, t1, t2);

    let dpath = `M${points[0]}C${points[0]},`
    for (let i = 1; i < points.length; i++) {
        let point = points[i];
        if (i < points.length - 1) {


            let last = points[i-1];
            let next = points[i+1];

            let p = point;
            let ln = 0;
            while (p != last) {
                p = p.last;
                ln++;
            }
            p = point;
            let nn = 0;
            while (p != next) {
                p = p.next;
                nn++;
            }

            console.log(ln);

            let dir = next.sub(last);
            let c1 = point.add(dir.mul(t3/(nn/10)));
            let c2 = point.add(dir.mul(t3/(ln/10)).rotate(Math.PI))
            dpath += `${c2},${point}C${c1},`
        }else {
            dpath  += `${point},${point}`
        }
    }

    return dpath;

}

let lastPoints = null
function points2Dpath(points) {

    // let t0 = performance.now();
    let dpath = points.length == 1 ? `M${points[0]}L${points[0]}` : `M${points.join("L")}`

    if (points.length > 5) {
        // points = simplifyPoints(points, 0.5, 0.1);
        try {
            let r = (n) => n.map(v => Math.round(v));
            let curves = fitCurve(points.map(v => [v.x, v.y]), 1);
            dpath = `M${curves.map(s => `${r(s[0])}C${r(s[1])},${r(s[2])}`).join(',')},${r(curves[curves.length-1][3])}`;
        } catch (e) {

        }
    }

    // console.log(`n = ${points.length}: time ${performance.now() - t0}ms`)
   
    return dpath;
}

const symbols = /[\r\n%#()<>?[\\\]^`{|}]/g;
function encodeSVG (data) {
  // Use single quotes instead of double to avoid encoding.
  data = data.replace(/"/g, `'`);

  data = data.replace(/>\s{1,}</g, `><`);
  data = data.replace(/\s{2,}/g, ` `);

  // Using encodeURIComponent() as replacement function
  // allows to keep result code readable
  return data.replace(symbols, encodeURIComponent);
}

function erasor(w = 20.02, h = 17.1){
    return `
    <svg width = "${w}" height = "${h}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10.01 8.55">
      <path class="cls-1" d="m8.62,4.63h0L4.55.01h-.98s-.02-.01-.03-.01c-.57,0-1.12.21-1.55.58l-2,1.76,1.39,1.58h0l4.07,4.62h.93c.61.02,1.21-.2,1.66-.61l1.96-1.72-1.39-1.58ZM.62,2.38l1.67-1.47c.35-.31.79-.47,1.25-.47h.02s.79,0,.79,0l1.26,1.43-1.63,1.43c-.46.4-1.05.62-1.66.62h-.34s-1.36-1.55-1.36-1.55Z"/>
    </svg>`
}
function drawIcon(color = "black") {
    return  `<svg xmlns = "http://www.w3.org/2000/svg" height = "14.84" width = "20" viewBox="0 0 10 7.42">
    <path  class="cls-1" d="m2.57,3.55s7,4.47,7.41,3.79S4.02,1.8,4.02,1.8c-.15.96-.69,1.53-1.45,1.75Z"/>
    <path  fill = "${color}" class="cls-1" d="m3.18,2.59c.58-.82.41-1.78-.21-2.26s-1.74.05-2.97-.33c0,0,.04,1.57.73,2.46.55.71,1.88.93,2.45.13Z"/>
    </svg>`
}

function toCursor(svg, offset = [0, 0]) {
    let uri = encodeSVG(svg);
    return `url("data:image/svg+xml,${uri}") ${offset[0]} ${offset[1]}, auto`;

}


function erasorCursor(){return toCursor(erasor(10.01*1.5, 8.55*1.5), [4, 3.5])}
function drawCursor(color = "black"){
   return toCursor(drawIcon(color))
}


class Slider extends SvgPlus {
    constructor(){
        super("svg");
      
        this.props = {
            styles: {
                width: "100%",
                height: "100%",
                cursor: "pointer",
            },
            viewBox: "0 0 40 10"
        };
        this.createChild("path", {
            d: "M2,5L38,5",
            stroke: "gray",
            fill: "none",
            "stroke-linecap": "round",
            "stroke-width": 2,
            events: {
                click: (e) => this.selectAt(e)
            }
        })
        this.circle = this.createChild("circle", {
            cy: 5
        })
        this.r = 1.5;
        this.cx = 2;

        this.addEventListener("mousedown", (e) => {
            this.mode = "grab"
        })
        this.addEventListener("mousemove", (e) => {
            this.mode = e.buttons == 1 ? "grab" : "over";
            if (e.buttons) this.moveCursor(e);
        })
        this.addEventListener("mouseup", (e) => {
            this.mode = "over"
        })
        this.addEventListener("mouseleave", (e) => {
            this.mode = null;
        })

        let next = () => {
            this.draw();
            // if (this.offsetParent != null)
                window.requestAnimationFrame(next);
        }
        window.requestAnimationFrame(next);

    }

    /** @param {MouseEvent} e */
    selectAt(e){
        let [pos, size] = this.bbox;
        this.cx = 40 * (e.clientX - pos.x) / size.x;
        const event = new Event("change");
        this.dispatchEvent(event);
    }

    /** @param {MouseEvent} e */
    moveCursor(e) {
        let size = this.bbox[1].x;
        let dx = 40 * e.movementX / size;
        this.cx += dx;

        const event = new Event("change");
        this.dispatchEvent(event);
    }

    draw(){
        if (this.mode === "over") {
            if (this.r < 2) this.r += 0.05;
        } else if (this.mode == "grab") {
            if (this.r > 1) this.r -= 0.15;
        } 
    }

    /** @param {number} cx */
    set r(r){
        this.circle.props = {r}
        this._r = r;
    }
    
    /** @return {number} */
    get r(){
        return this._r;
    }

    /** @param {number} cx */
    set cx(cx){
        if (cx < 2) cx = 2;
        if (cx > 38) cx = 38;
        this.circle.props = {cx}
        this._x = cx
    }

    /** @return {number} */
    get cx(){
        return this._x;
    }

    set mode(mode){
        switch (mode) {
            case "grab":
                this.styles = {cursor: "grabbing"};
                break;
            case "over":
                this.styles = {cursor: "pointer"}
                break;
            default:
                this.r = 1.5;
        }
        this._mode = mode;
    }

    get mode(){
        return this._mode;
    }


    /** @param {number} value 0 <= value <= 1 */
    set value(value) {
        if (value < 0) value = 0;
        if (value > 1) value = 1;
        this.cx = value * 36 + 2;
    }

    /** @return {number} */
    get value(){
        return (this.cx - 2)/36;
    }
}

class SizeSelection extends SvgPlus {
    constructor() {
        super("div");
        this.styles = {display: "flex"}
        this.slider = this.createChild(Slider, {
            events: {
                change: () => {
                    this.input.value = Math.round(this.slider.value * 99 + 1)
                    this.update();
                }
            }
        });
        this.input = this.createChild("input", {
            value: 1,
            styles: {
                width: "1.8em",
                border: 'none',
                "border-radius": "1em",
                "outline": "none",
                "text-align": "center",
                "font-size": "1.3em",
                background: "none",
                "font": "inherit"
            },
            events: {
                input: () => {
                    this.slider.value = parseFloat(this.input.value - 1) / 99;
                    this.update();
                }
            }
        })
    }

    update() {
        const event = new Event("change");
        this.dispatchEvent(event);
    }

    get value(){
        return parseFloat(this.input.value);
    }
}

let x = 0;
const iconstyle = {
    "aspect-ratio": 1,
    "display": "flex",
    "align-items": "center",
    "justify-items": "center",
    "border-radius": "0.2em",
    padding: "0.1em",
    "font-size": "2em"
}
class DrawingTools extends SvgPlus {
    constructor(){
        super("div");
        this.colorPicker = this.createChild(ColorPicker);
        this.sizeSlider = this.createChild(SizeSelection);
        let icons = this.createChild("div", {
            styles: {
                display: "flex",
                gap: "0.2em"
            }
        })

        this.tools = {
            pen: icons.createChild("div", {
                class: "icon", 
                styles: iconstyle, 
                content: drawIcon(),
                events: {
                    click: () => {
                        this.selectTool("pen")
                    }
                }
            }),
            erasor: icons.createChild("div", {
                class: "icon", 
                styles: iconstyle, 
                content: erasor(),
                events: {
                    click: () => {
                        this.selectTool("erasor")
                    }
                }
            }),
            mouse: icons.createChild("div", {
                class: "icon",
                styles: iconstyle,
                events: {
                    click: () => {
                        this.selectTool("mouse")
                    }
                }
            })
        }
        let i = this.tools.mouse.createChild("svg", {viewBox: "-9 -3 30 20"}).createChild(POINTERS.cursor);
        i.shown = true;


        this.selectTool("pen")
    }


    selectTool(tool) {
        for (let key in this.tools) {
            this.tools[key].styles={background: tool == key ? "darkgray" : null}
        }
        if (this.drawingWindow) {
            console.log(this.drawingWindow);
            this.drawingWindow.inactive = tool == "mouse";
        }
        this.tool = tool;
    }


    get penColor(){ return this.colorPicker.color}
    get penThickness(){return this.sizeSlider.value}
    get penStyles(){
        return {stroke: this.penColor, "stroke-width": this.penThickness}
    }
}



class PenPath extends SvgPlus {
    constructor(){
        super("path");
        this.props = {
            "stroke-linecap": "round", 
            fill: "none",
            "stroke-linejoin": "round"
        }
        this._value = {}
        this.value = {
            stroke: "black",
            "stroke-width": 1,
            d: ""
        }
        this.ewa_smoothing = 0.2;
        this.ewa = null;
        this.points = []
        this.si = 0;
        this.curves = [];
    }

    /** @param {Vector} v */
    addPoint(v) {
        let {ewa, ewa_smoothing, points} = this;

        if (ewa == null) ewa = v;
        v = v.mul(ewa_smoothing).add(ewa.mul(1-ewa_smoothing));
        this.ewa = v;

        points.push(v);
        console.log(points.length);
        this.d = points2Dpath(points);
    }

    // _update_path(){
    //     let r = (n) => n.map(v => Math.round(v));
        

        
    //     if (points.length > 5) {
    //         let new_curves = fitCurve(points.map(v => [v.x, v.y]), 1);
            
    //         let dpath = points.length == 1 ? `M${points[0]}L${points[0]}` : `M${points.join("L")}`
    //     } else {
    //         points = r(points);
    //         let dpath = points.length == 1 ? `M${points[0]}L${points[0]}` : `M${points.join("L")}`
    //     }
    // }


    set d(value) {
        this._value.d = value;
        this.props = {d: value};
    }

    set value(value){
        for (let k in value) {
            this._value[k] = value[k];
        }
        this.props = this._value;
    }

    get value(){
        return this._value;
    }


}

class DrawingWindow extends SvgPlus {
    /**
     * @param {boolean} editable
     * @param {DrawingApp} app
     */
    constructor(editable, app){
        super("div");
        
        this.styles = {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
        }
        /** @type {DrawingApp} */
        this.app = app;

        /** @type {SvgResize} */
        let svg = this.createChild(SvgResize);
        svg.shown = true;
        this.svg = svg;

        app.onChildAdded("paths", (value, key) => {
            console.log(key, value);
            this.updatePathById(value, key);
        })
        app.onChildChanged("paths", (value, key) => {
            console.log(key);
            this.updatePathById(value, key);
        })
        app.onChildRemoved("paths", (value, key) => {
            let path = this.querySelector(`#${key}`)
            if (path) path.remove();
        })

        this.ewa_smoothing = 0.2;

        let vb = null;
        if (editable) {
            svg.start();
            svg._drawbables.push({draw: () => {
                let viewBox = svg.getAttribute("viewBox");
                if (viewBox != vb) {
                    app.set("viewBox", viewBox);
                    vb = viewBox;
                }
            }})
            this.addEditListeners()
        } else {
            app.onValue("viewBox", (vb) => {
                console.log(vb);
                svg.props = {viewBox: vb}
            })
        }
    }

    set inactive(value){
        this.styles = {"pointer-events": value === true ? "none" : null}
    }


    /** @param {MouseEvent} e */
    removePathAt(e) {
        let v = new Vector(e)
        let pos = this.svg.bbox[0];
        v = v.sub(pos);

        for (let path of this.svg.querySelectorAll("path")) {
            if(path.isVectorInStroke(v)) {
                path.remove();
                this.sendUpdate(path, true);
                break;
            }
        }
    }

    /** @param {MouseEvent} e */
    makePath(e){
        let {app, svg} = this;
        let v = new Vector(e)
        let pos = this.svg.bbox[0];
        v = v.sub(pos);

        this.path = svg.createChild(PenPath, {
            id: app.push("paths"),
        });
        this.path.value = this.getPathStyle();
        this.path.addPoint(v);
        this.changed = true;
    }

    /** @param {MouseEvent} e */
    updatePath(e) {
        let {points} = this;
        let v = new Vector(e);
        let pos = this.svg.bbox[0];
        v = v.sub(pos);

        this.path.addPoint(v);
        this.changed = true;
    }


    updatePathById(value, id) {
        let path = this.querySelector(`#${id}`);
        if (path) {
            if (!path.isSameNode(this.path)) {
                path.value = value;
            }
        } else {
            path = this.svg.createChild(PenPath, {
                id: id
            })
            path.value = value;
        }
    }



    addEditListeners(){
        let {svg, app} = this;


        svg.addEventListener("mousedown", (e) => {
            this.styles = {"pointer-events": null}
            switch (app.tool) {
                case "pen":
                    this.makePath(e);
                    break;

                case "erasor": 
                    this.removePathAt(e);
                    break;

            }
        })
        
        svg.addEventListener("mousemove", (e) => {
            switch (app.tool) {
                case "pen":
                    svg.styles = {"cursor": drawCursor(this.getPathStyle().stroke)}
                    if (e.buttons == 1)this.updatePath(e); 
                    break;

                case "erasor": 
                    svg.styles = {"cursor": erasorCursor()}
                    if (e.buttons == 1) this.removePathAt(e)
                    break;
           } 
        });

        let drawEnd = () => {
            const event = new Event("end");
            this.dispatchEvent(event);
        }
        this.addEventListener("mouseup", drawEnd);
        this.addEventListener("mouseleave", drawEnd)

        setInterval(() => {
            if (this.changed) {
                this.sendUpdate(this.path)
                this.changed = false;
            }
        }
        , 50);


        let meta = false
        this.keyDown = (e) => {
            meta = e.key == "Meta" ? true : meta
            console.log(e.key, meta);
            if (e.key == "z" && meta && svg.children.length > 0) {
                let path = svg.children[svg.children.length - 1];
                path.remove();
                this.sendUpdate(path, true);
            }
        }
        this.keyUp = (e) => {
            meta = e.key == "Meta" ? false : meta;
        }
        window.addEventListener("keydown", this.keyDown);
        window.addEventListener("keyup", this.keyUp);
    }


    receiveUpdate(path, key) {
        console.log(path, key);
    }

    sendUpdate(path, remove = false) {
        const event = new Event("change");
        event.path = path;
        this.app.set("paths/"+path.id, remove ? null : path.value );
        this.dispatchEvent(event);
    }



    clear(){
        this.svg.innerHTML = "";
        const event = new Event("change");
               this.dispatchEvent(event);
    }


    getPathStyle(){
        return {stroke: "black", "stroke-width": 1}
    }

    

    get data(){ return this.svg.innerHTML}
    set data(value) {this.svg.innerHTML = value}

}

export default class DrawingApp extends SquidlyApp {
    constructor(sender, initialiser) {
        super(sender, initialiser);
        console.log(this.set);
        this.init = true;
        this.drawingWindow = new DrawingWindow(true, this);
        // this.drawingWindow.data = initData;
        this.drawingTools = new DrawingTools();
        this.drawingWindow.editable = true;
        this.drawingTools.drawingWindow = this.drawingWindow;
        this.drawingWindow.getPathStyle = () => {return this.drawingTools.penStyles}
            // this.drawingWindow.addEventListener("change", (e) => {
            //     let path = e.path;
            //     this.set("paths/"+path.id, path.outerHTML)
            // })
        // }

        this.close = () => {
            console.log("closing draw");
            let {keyDown, keyUp} = this.drawingWindow
            window.removeEventListener("keydown", keyDown);
            window.removeEventListener("keyup", keyUp);
        }
    }

   

    get lastPoints(){
        return lastPoints;
    }

    getSideWindow(){
        return this.drawingTools;
    }

    getMainWindow(){
        return this.drawingWindow;
    }

    get tool(){
        if (this.drawingTools) {
            return this.drawingTools.tool
        }
    }


    static get description(){
        return "Add annotation during your video calls."
    }

    static get name(){
        return "draw"
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
}