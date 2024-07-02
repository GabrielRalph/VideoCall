import { SvgPlus, Vector } from "../SvgPlus/4.js";
import { SvgResize } from "../Utilities/basic-ui.js";

export class SquidlyApp {
    /**
     * @param {"sender"|"receiver"}
     */
    constructor(isSender){
        Object.defineProperty(this,  "isSender", {get: () => isSender});

        let updateListeners = [];
        this.addUpdateListener = (callback) => {
            if (callback instanceof Function) {
                updateListeners.push(callback);
            }
        }

        this.update = () => {
            for (let updateListener of updateListeners) {
                updateListener(this.data);
            }
        }
    }

    getSideWindow(){ }
    getMainWindow(){ }
    getData() { }
    setData(data) { }
    setEyeData(eyeData){

    }

    /**
     * @param {{x: Number, y: Number}} eyeData
     */
    set eyeData(eyeData){
        this.setEyeData(eyeData);
    }

    get data(){
        let data = this.getData();
        return data;
    }

    set data(data){
        this.setData(data);
    }


    get sideWindow() {
        let window = this.getSideWindow();
        if (window instanceof Element) {
            window.classList.add("app-side-window");
        } else {
            window = null
        }
        return window;
    }

    get mainWindow() {
        let window = this.getMainWindow();
        if (window instanceof Element) {
            window.classList.add("app-main-window");
        } else {
            window = null
        }
        return window;
    }
    

    static get name(){
        return "squidlyApp"
    }


    static get appIcon() {
        return new SvgPlus("div")
    }

    /**
     * @return {"host"|"both"|"participant"}
     */
    static get userType() {
        return "host" // "participant" , or 
    }
}

export {SvgPlus, Vector, SvgResize }