import { ConstantAspectRatio, HideShow, Vector } from "../Utilities/basic-ui.js"
import { Icons } from "../Utilities/icons.js"
import { CopyIcon } from "../Utilities/animation-icons.js"
import { elementAtCursor, getCursorPosition, delay } from "../Utilities/usefull-funcs.js"
import { endSession, muteTrack, addStateListener, getKey, makeKeyLink } from "./webrtc.js"

function check_snap(p0, p1, size) {
    let [ innerWidth, innerHeight ] = [size.x, size.y];
    let crns = [new Vector(0, 0), new Vector(innerWidth, 0), new Vector(innerWidth, innerHeight), new Vector(0, innerHeight)];
    let mind = innerWidth * innerWidth;
    let minv = null;
    for (let v of crns) {
        if (v.dist(p1) < mind) {
            mind = v.dist(p1);
            minv = v;
        }
    }
    if (mind < minv.dist(p0) && mind < 20) {
        return minv;
    } else {
        return p1;
    }
}

class VideoDisplay extends HideShow {
    constructor(el = "video-display") {
        super(el);
        this.class = "video-display"
        this.styles = {
            position: "relative",
        }
        this.block = this.createChild("svg", {class: "aspect"})
        this.video = this.createChild("video", { autoplay: true, playsinline: true, styles: {
            position: "absolute",
            top: 0, 
            left: 0,
            bottom: 0,
            right: 0,
        } });
        this.buttons = this.createChild("div", {
            styles: {
                position: "absolute",
                top: 0, 
                left: 0,
                gap: "0px",
                display: "flex",
            }
        })
        this.topLeft = this.buttons.createChild("div", {
            class: "icon-slot",
            // styles: {
            //     position: "absolute",
            //     top: 0,
            //     left: 0
            // }
        });
        this.topRight = this.createChild("div", {
            class: "icon-slot top-right",
            styles: {
                position: "absolute",
                top: 0,
                right: 0
            }
        });
        this.bottomRight = this.createChild("div", {
            class: "icon-slot name",
            styles: {
                position: "absolute",
                bottom: 0,
                left: 0
            }
        });
        this.bottomLeft = this.buttons.createChild("div", {
            class: "icon-slot",
            // styles: {
            //     position: "absolute",
            //     bottom: 0,
            //     left: 0
            // }
        });
    }

    /**
     * @param {boolean} value
     */
    set video_muted(value) {
        if (value === false) {
            this.setIcon("bottomLeft", "video", () => this.update("video"));
        } else if (value === true) {
            this.setIcon("bottomLeft", "novideo", () => this.update("video"));
        } else {
            this.setIcon("bottomLeft", null);
        }
    }

    /**
     * @param {boolean} value
     */
    set audio_muted(value) {
        if (value === false) {
            this.setIcon("topLeft", "unmute", () => this.update("audio"));
        } else if (value === true) {
            this.setIcon("topLeft", "mute", () => this.update("audio"));
        } else {
            this.setIcon("topLeft", null);
        }
    }

    

    update(type) {
        muteTrack(type, this.type);
    }

    setIcon(location, iconName, cb) {
        if (iconName == null) {
            this[location].innerHTML = "";
            this[location].onclick = null;
        } else {
            this[location].innerHTML = Icons[iconName];
            this[location].onclick = () => {
                // if (!this.matches("[dragging] *")) {
                    if (cb instanceof Function) cb();
                // }
            }
        }
    }

    set name(name) {
        this.bottomRight.innerHTML = name;
    }

    set photo(src){
        // this.video.styles = {"background": `red`}
    }

    set type(val) {
        if (val == "local") this.video.muted = true;
        this.setAttribute("type", val);
    }
    get type(){
        return this.getAttribute("type")
    }

    get aspect(){
        return this._aspect;
    }

    set srcObject(src) {
        // check for video aspect ratio until it is defined
        let next = () => {
            try {
                let settings = src.getVideoTracks()[0].getSettings();
                let ratio = settings.width / settings.height;
                if (Number.isNaN(ratio)) {
                    ratio = 0;
                    window.requestAnimationFrame(next);
                } else {
                    this.shown = true;
                }
                this.styles = {
                    "--aspect": ratio,
                }
                this.block.props = {viewBox: `0 0 ${100 * ratio} ${100}`}
                this._aspect = ratio;
            } catch (e) {

            }
        }

        this.video.srcObject = src;
        if (src == null) {
            this.shown = false;
        } else {
            next();
        }

    }

    get srcObject() { return this.video.srcObject; }


    /**
     * @param {Object} obj
     */
    set state(obj) {
        if (typeof obj === "object" && obj !== null && typeof this.type === "string" && this.type in obj){
            let sub = obj[this.type];
            if ("audio_muted" in sub) this.audio_muted = sub.audio_muted;
            if ("video_muted" in sub) this.video_muted = sub.video_muted;
            if ("stream" in sub) this.srcObject = sub.stream;
            if ("name" in sub) {
                let name = sub.name;
                if (sub.pronouns) name = name + ` (${sub.pronouns})`;
                this.name = name;
            }
            if ("photo" in sub) this.photo = sub.photo;
        }
    }
}


class DragCollapseWidget extends HideShow {
    constructor(el){
        super(el);
        this.margin = 3;
        this.rel = this.createChild("div", { class: "rel" });
        this.main_content = this.rel.createChild("div", { class: "main-content" });
        this.side_bar = this.createChild("div", { class: "side-bar" });
        this.minimise = this.side_bar.createChild("div", { class: "minimise" });
        this.minimise.createChild("div");
        this.tools = this.side_bar.createChild("div", { class: "tools" })

        this.side_bar.onclick = (e) => {
            if (this.dragging) {
                e.preventDefault();
            }
        }

        this.main_content.onclick = (e) => {
            if (this.dragging) {
                e.preventDefault();
            }
        }

        this.minimise.onclick = () => {
            if (!this.hold && !(this.old instanceof Promise)) {
                this.shrinkContent();
            }
        }

        let selected = false;
        let drag = false;
        let dragend = 0;
        let p0 = null;
        let m0 = null;
        let bs = null;
        this.position = [-0.5, 0];
        window.addEventListener("mousedown", () => {
            let el = elementAtCursor();
            selected = this.isSameNode(el) || this.contains(el);
            [p0, bs] = this.bbox;
            m0 = new Vector(getCursorPosition());
        })

        window.addEventListener("mousemove", (e) => {
            if (selected && !this.hold) {
                e.preventDefault();
                let [p1, bs] = this.bbox;
                let p = new Vector(e);
                let delta = (new Vector(p)).sub(m0);
                m0 = p;
                if (delta.norm() > 0.5) {
                    drag = true;
                    this.toggleAttribute("dragging", true);
                    this.moveDelta(delta);
                }
            }
        })

        window.addEventListener("mouseup", (e) => {
            if (drag) {
                dragend = performance.now();
                setTimeout(() => { this.toggleAttribute("dragging", false) }, 100)
                if (this.small) {
                    this.setLandscape(true);
                }
            }
            selected = false;
            drag = false;
        })

        window.addEventListener("resize", () => {
            this.position = this.relativePosition;
        })

        let oldSize = new Vector();
        let next = () => {
            let size = this.screenSize;
            let delta = size.dist(oldSize);
            if (delta > 1e-3) {
                this.position = this.relativePosition;
            }
            oldSize = size;
            window.requestAnimationFrame(next);

        }
        window.requestAnimationFrame(next);



        let timeout = null;
        let tf = () => {
            let el = elementAtCursor();
            if (!this.isSameNode(el) && !this.contains(el) && !this.hold) {
                this.toggleAttribute("show-icons", false);
                timeout = null;
            } else {
                timeout = setTimeout(tf, 500)
            }
        }
        this.onmousemove = () => {
            this.toggleAttribute("show-icons", true);
            if (timeout != null) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(tf, 500)
        }
    }

    async setLandscape(bool) {
        let x = this._pos.x / window.innerWidth;
        if (x < 0.2 || x > 0.8) {
            bool = false;
        }
        this.toggleAttribute("notrans", true);
        this.toggleAttribute("landscape", bool)
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                this.toggleAttribute("notrans", false);
                resolve();
            }, 50)
        });
    }

    get dragging() {
        return this.hasAttribute("dragging");
    }

    get landscape() {
        return this.hasAttribute("landscape");
    }

    get small() {
        return this.hasAttribute("small");
    }

    async shrinkContent() {
        if (this.landscape) {
            await this.setLandscape(false);
        }
        this.toggleAttribute("small");
        let {rel} = this;
        let w1 = rel.bbox[1].x;
        let w0 = this.main_content.bbox[1].x;
        this.old = rel.waveTransition((t) => {
            rel.styles = { width: `${w0 * t}px` }
            if (t == 1) {
                rel.styles = { width: null }
            }
        }, 500, !this.small);
        await this.old;
        this.old = null;
        if (this.small) {
            this.setLandscape(true);
        }
    }

    /**
     * @param {number | Vector} v
     */
    set position(v) {
        v = new Vector(v);

        let { innerWidth, innerHeight } = window;
        let size = this.screenSize;
        if (v.x < 0) v.x = -1 * v.x * size.x;
        if (v.y < 0) v.y = -1 * v.y * size.y;

        let m = this.margin;
        if (v.x < m) v.x = m;
        if (v.y < m) v.y = m;
        if (v.x > size.x - m) v.x = size.x - m;
        if (v.y > size.y - m) v.y = size.y - m;
        let trns = v.sub(m).div(size.x - 2 * m, size.y - 2 * m).mul(-100);
        this.styles = {
            top: `${v.y}px`,
            left: `${v.x}px`,
            transform: `translate(${trns.x}%, ${trns.y}%)`
        }
        this._pos = v;
        this._rel_pos = v.div(size).mul(-1);
        const event = new Event("move");
        this.dispatchEvent(event);
    }
    get position(){
        let pos = this._pos;
        if (pos instanceof Vector) pos = pos.clone();
        return pos;
    }
    get relativePosition(){
        let pos = this._rel_pos;
        if (pos instanceof Vector) {
            pos = pos.clone();
        }
        return pos;
    }

    get screenSize(){
        let ofp = this.offsetParent;
        let size = new Vector(window.innerWidth, window.innerHeight);
        if (ofp && Array.isArray(ofp.bbox)) {
            size = ofp.bbox[1];
            if (!(size instanceof Vector)) size = new Vector(window.innerWidth, window.innerHeight);
        }
        if (size.x < 1e-2) size.x = 1e-2;
        if (size.y < 1e-2) size.y = 1e-2;
        return size;
    }

 
    moveDelta(delta) {

        // let { innerWidth, innerHeight } = window;
        let size = this.screenSize;

        delta = new Vector(delta);
        let bs = this.bbox[1];
        let p0 = this._pos;

        let a = bs.div(size);
        let denom = (new Vector(1)).sub(a);
        let deltaAd = delta.div(denom);

        let newPos = this._pos.add(deltaAd);

        if (newPos.x < 1) newPos.x = 1;
        if (newPos.y < 1) newPos.y = 1;
        this.position = check_snap(p0, newPos, size);
    }

}

export class VideoCallScreen extends ConstantAspectRatio {
    constructor(el = "video-call-screen"){
        super(el);
        this.v1 = this.createChild(VideoDisplay);
        this.v1.type = "local";
        this.v1.toggleAttribute("show-icons", true);
        this.v2 = this.createChild(VideoDisplay);
        this.v2.type = "remote";
        this.v2.toggleAttribute("show-icons", true);


        addStateListener(this);
    }

    getAspectRatio(){
        let [pos1, size1] = this.v1.bbox;
        let [pos2, size2] = this.v2.bbox;
        let ratio = (size1.norm() > 1 ? this.v1.aspect : 0) + (size2.norm() > 1 ? this.v2.aspect : 0)
        return ratio;
    }

    getParentSize(){
        let gap = parseFloat(window.getComputedStyle(this).gap);
        let size = this.bbox[1];
        size = size.sub(2 * gap);
        return size;
    }

    set state(obj) {
        if (obj == null) return;
        if ("type" in obj) {
            this.setAttribute("type", obj.type)
            if (!this.shown) this.show();
        }
        this.v1.state = obj;
        this.v2.state = obj;
    }
}

export class VideoCallWidget extends DragCollapseWidget {
    constructor(el = "video-call-widget") {
        super(el);
        this.copy_icon = this.tools.createChild(CopyIcon);
        let end_icon = this.tools.createChild("div", { class: "icon", type: "end-call", content: Icons["end"] });
        end_icon.onclick = () => endSession();
        this.v1 = this.main_content.createChild(VideoDisplay);
        this.v1.type = "local";
        this.v2 = this.main_content.createChild(VideoDisplay);
        this.v2.type = "remote";

        addStateListener(this);
    }


    set state(obj) {
        if (obj == null) return;
        if ("type" in obj) {

            this.setAttribute("type", obj.type)

            this.copy_icon.text = getKey();
            this.copy_icon.value = makeKeyLink(getKey());
            this.copy_icon.onclick = async () => {
                this.hold = true;
                await this.copy_icon.showText();
                this.hold = false;
            }
        }
        this.v1.state = obj;
        this.v2.state = obj;
    }
}
