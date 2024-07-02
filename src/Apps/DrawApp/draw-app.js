import { SvgPlus, Vector } from "../../SvgPlus/4.js";
import { SvgResize } from "../../Utilities/basic-ui.js";
import { SquidlyApp } from "../app-class.js";


class ColorPallete extends SvgPlus {
    constructor(){
        super("div");
    }
}

class SizeSelection extends SvgPlus {
    constructor(){
        super("div");
    }
}

class DrawingTools extends SvgPlus {
    constructor(){
        super("div");
        this.createChild(ColorPallete);
        this.createChild(SizeSelection);
    }

    get penColor(){}
    get penThickness(){}
    get penSettings(){
        return {color: this.penColor, thickness: this.penThickness}
    }
}


class DrawingWindow extends SvgPlus {
    constructor(editable){
        super("div");

        let svg = this.createChild(SvgResize);
        svg.shown = true;
        svg.start();
        svg.styles = {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            "pointer-events": "none"
        }
        this.svg = svg;

        console.log("editable", editable);
        if (editable) {
            let points = [];
            let path = null;
            window.addEventListener("mousedown", (e) => {
                points = [];
                path = svg.createChild("path", {stroke: "black", fill: "none"})
            })
    
            window.addEventListener("mousemove", (e) => {
               if (e.buttons == 1) points.push(new Vector(e));
               path.setAttribute("d", "M" + points.join("L"));
               const event = new Event("change");
               this.dispatchEvent(event);
            })
        }

    }

    clear(){
        this.svg.innerHTML = "";
        const event = new Event("change");
               this.dispatchEvent(event);
    }

    set penColor(color) {}
    set penThickness(thickes) {}
    set penSettings(settings){}

    get data(){ return this.svg.innerHTML}
    set data(value) {this.svg.innerHTML = value}

}

export default class DrawingApp extends SquidlyApp {
    constructor(sender) {
        super(sender);
        this.init = true;
        this.drawingWindow = new DrawingWindow(sender);
        // this.drawingWindow.data = initData;
        if (true) {
            this.drawingTools = new DrawingTools();
            this.drawingWindow.editable = true;
            this.drawingWindow.addEventListener("change", (e) => {
                this.update()
            })
            this.drawingTools.addEventListener("change", (e) => {
                this.drawingWindow.penSettings = this.appTools.penSettings;
            });
        }
    }

    getData() {
        return this.drawingWindow.data;
    }

    setData(data) {
        console.log(data);
        if (!this.isSender || this.init) {
            this.drawingWindow.data = data;
            this.init = false;
        }
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