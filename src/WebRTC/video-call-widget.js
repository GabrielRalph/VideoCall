import { HideShow, Vector } from "../Utilities/basic-ui.js"
import { Icons } from "../Utilities/icons.js"
import { CopyIcon } from "../Utilities/animation-icons.js"
import { elementAtCursor, getCursorPosition } from "../Utilities/usefull-funcs.js"
import { muteTrack, addStateListener, getKey, makeKeyLink } from "./webrtc.js"

function check_snap(p0, p1) {
    let { innerWidth, innerHeight } = window;
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
        this.video = this.createChild("video", { autoplay: true, playsinline: true });
        this.topLeft = this.createChild("div", {
            class: "icon-slot",
            styles: {
                position: "absolute",
                top: 0,
                left: 0
            }
        });
        this.topRight = this.createChild("div", {
            class: "icon-slot",
            styles: {
                position: "absolute",
                top: 0,
                right: 0
            }
        });
        this.bottomRight = this.createChild("div", {
            class: "icon-slot",
            styles: {
                position: "absolute",
                bottom: 0,
                right: 0
            }
        });
        this.bottomLeft = this.createChild("div", {
            class: "icon-slot",
            styles: {
                position: "absolute",
                bottom: 0,
                left: 0
            }
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

    set srcObject(src) {
        // check for video aspect ratio until it is defined
        let next = () => {
            let settings = src.getVideoTracks()[0].getSettings();
            let ratio = settings.width / settings.height;
            if (Number.isNaN(ratio)) {
                ratio = 0;
                window.requestAnimationFrame(next);
            } else {
                this.shown = true;
            }
            this.video.styles = {
                "--aspect": ratio,
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
        console.log(w0);
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
        if (v.x < 0) v.x = -1 * v.x * innerWidth;
        if (v.y < 0) v.y = -1 * v.y * innerHeight;

        let m = this.margin;
        if (v.x < m) v.x = m;
        if (v.y < m) v.y = m;
        if (v.x > innerWidth - m) v.x = innerWidth - m;
        if (v.y > innerHeight - m) v.y = innerHeight - m;
        let trns = v.sub(m).div(innerWidth - 2 * m, innerHeight - 2 * m).mul(-100);
        this.styles = {
            top: `${v.y}px`,
            left: `${v.x}px`,
            transform: `translate(${trns.x}%, ${trns.y}%)`
        }
        this._pos = v;
        this._rel_pos = v.div(new Vector(innerWidth, innerHeight)).mul(-1);
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

 
    moveDelta(delta) {
        let { innerWidth, innerHeight } = window;
        delta = new Vector(delta);
        let bs = this.bbox[1];
        let p0 = this._pos;

        let a = bs.div(innerWidth, innerHeight);
        let denom = (new Vector(1)).sub(a);
        let deltaAd = delta.div(denom);

        let newPos = this._pos.add(deltaAd);
        if (newPos.x < 1) newPos.x = 1;
        if (newPos.y < 1) newPos.y = 1;
        this.position = check_snap(p0, newPos);
    }

}

export class VideoCallWidget extends DragCollapseWidget {
    constructor(el = "video-call-widget") {
        super(el);
        this.copy_icon = this.tools.createChild(CopyIcon);
        let end_icon = this.tools.createChild("div", { class: "icon", content: Icons["end"] });
        this.v1 = this.main_content.createChild(VideoDisplay);
        this.v1.type = "local";
        this.v2 = this.main_content.createChild(VideoDisplay);
        this.v2.type = "remote";

        addStateListener(this);
    }

   
    makeKey() {
        let keyi = new CopyIcon();
        this.tools.prepend(keyi);
        
    }

    set state(obj) {
        if (obj == null) return;
        if ("type" in obj) {

            this.setAttribute("type", obj.type)
            if (!this.shown) this.show();

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
