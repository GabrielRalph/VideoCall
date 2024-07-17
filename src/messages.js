import { SvgPlus } from "./SvgPlus/4.js";
import {Icons} from "./Utilities/icons.js"


export class Messages extends SvgPlus {
    constructor(){
        super("message-panel");

        let title = this.createChild("div", {class: "title"});
        title.createChild("div", {content: "Messages"});
        this.close = title.createChild("div", {class: "icon", content: Icons["close"]});

        this.createChild("div", {class: "main-items"});
    }
}