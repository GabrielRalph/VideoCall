import { SvgPlus, Vector } from "../../SvgPlus/4.js";
import { SvgResize } from "../../Utilities/basic-ui.js";
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

    let dpath = points.length == 1 ? `M${points[0]}L${points[0]}` : `M${points.join("L")}`
    if (points.length > 2) {
        try {
            let r = (n) => n.map(v => Math.round(v));
            let curves = fitCurve(points.map(v => [v.x, v.y]), 1);
            dpath = `M${curves.map(s => `${r(s[0])}C${r(s[1])},${r(s[2])}`).join(',')},${r(curves[curves.length-1][3])}`;
        } catch (e) {

        }
    }

   
    return dpath;
}

class SizeSelection extends SvgPlus {
    constructor(){
        super("div");
    }
}

class DrawingTools extends SvgPlus {
    constructor(){
        super("div");
        this.colorPicker = this.createChild(ColorPicker);
        this.createChild(SizeSelection);
    }

    get penColor(){ return this.colorPicker.color}
    get penThickness(){return 3}
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
        }
        this._value = {}
        this.value = {
            stroke: "black",
            "stroke-width": 1,
            d: ""
        }
    }


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

        /** @type {DrawingApp} */
        this.app = app;

        /** @type {SvgResize} */
        let svg = this.createChild(SvgResize);
        svg.shown = true;
        svg.styles = {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            "pointer-events": "none"
        }
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


    makePath(e){
        let {app, svg} = this;
        let v = new Vector(e)
        this.points = [v];
        this.ewa = null;
        this.path = svg.createChild(PenPath, {
            id: app.push("paths"),
        })
        this.path.value = this.getPathStyle();
        this.path.d = `M${v}L${v}`
        this.changed = true;
    }


    updatePath(e) {
        let {ewa, path, points, ewa_smoothing} = this;
        let v = new Vector(e);
        if (ewa == null) ewa = v;
        v = v.mul(ewa_smoothing).add(ewa.mul(1-ewa_smoothing));
        this.ewa = v;

        points.push(v);

        path.d = points2Dpath(points),

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



       

        window.addEventListener("mousedown", (e) => {
            this.makePath(e);
        })
        
        window.addEventListener("mousemove", (e) => {
           if (e.buttons == 1) {
              this.updatePath(e); 
           } 
        });

        let drawEnd = () => {
            const event = new Event("end");
            this.dispatchEvent(event);
        }
        window.addEventListener("mouseup", drawEnd);
        this.addEventListener("mouseleave", drawEnd)

        setInterval(() => {
            if (this.changed) {
                this.sendUpdate(this.path)
                this.changed = false;
            }
        }
        , 50);


        let meta = false
        window.addEventListener("keydown", (e) => {
            meta = e.key == "Meta" ? true : meta
            console.log(e.key, meta);
            if (e.key == "z" && meta && svg.children.length > 0) {
                let path = svg.children[svg.children.length - 1];
                path.remove();
                this.sendUpdate(path, true);
            }
        })
        window.addEventListener("keyup", (e) => {
            meta = e.key == "Meta" ? false : meta;
        })
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
        this.drawingWindow = new DrawingWindow(sender, this);
        // this.drawingWindow.data = initData;
        if (true) {
            this.drawingTools = new DrawingTools();
            this.drawingWindow.editable = true;
            this.drawingWindow.getPathStyle = () => {return this.drawingTools.penStyles}
            // this.drawingWindow.addEventListener("change", (e) => {
            //     let path = e.path;
            //     this.set("paths/"+path.id, path.outerHTML)
            // })
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


    static get name(){
        return "draw"
    }

    static get userType(){
        return "host"
    }

    static get appIcon() {
        let svg = new SvgPlus("svg");
        svg.props = {viewBox: "0 0 10.86 5.45"}
        svg.innerHTML = `<path class="cls-1" d="m.5,5.45c-.11,0-.23-.04-.32-.12-.21-.18-.24-.49-.06-.7.42-.49.64-1.33.85-2.14C1.25,1.4,1.52.36,2.35.07c.52-.19,1.14,0,1.87.54.63.47,1.18.98,1.65,1.43.84.79,1.5,1.42,2.16,1.37.54-.04,1.17-.53,1.93-1.5.17-.22.48-.26.7-.08.22.17.25.48.08.7-.96,1.22-1.8,1.82-2.64,1.88-1.1.08-1.94-.72-2.92-1.64-.48-.45-.98-.92-1.56-1.36-.6-.45-.86-.43-.95-.4-.32.11-.56,1.01-.75,1.73-.23.88-.49,1.87-1.05,2.53-.1.12-.24.18-.38.18Z"/>`
        return svg;
    }
}