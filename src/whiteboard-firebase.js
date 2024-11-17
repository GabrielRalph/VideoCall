// import { WhiteBoard } from "http://127.0.0.1:5501/whiteboard.js";
import { WhiteBoard } from "https://whiteboard.w4v.es/whiteboard.js";
import { ElementChangeEvent } from "https://whiteboard.w4v.es/Element/interface.js";
// import { ElementChangeEvent } from "http://127.0.0.1:5501/Element/interface.js";

import { FirebaseFrame } from "./Firebase/rtc-signaler.js";


const minimumUpdateInterval = 40;//ms
let instaceID = Math.round(Math.random() * 100000);

const specific_change_types = ["styleSet", "data", "trans", "order"];
class WhiteboardFirebaseFrame extends FirebaseFrame {
    constructor(reference, whiteboard){
        super(reference);

        let elementListeners = {}
        this.sentUpdateIds = new Set();
        this.lastUpdatTS = {};
        let isInit = {}
        this.changeBuffers = {}


        this.onChildRemoved(null, (oldData, id) => {
            if (id in elementListeners) {
                for (let end of elementListeners[id]) end();
                delete elementListeners[id]
                this._onChange({
                    type: "deletion",
                    data: this.fromFBData(oldData),
                    id: id,
                    upid: oldData.upid,
                    light: oldData.light
                })
            }
        })

        this.onChildAdded(null, (data, id) => {
            this._onChange({
                type: "creation",
                data: this.fromFBData(data),
                id: id,
                upid: data.upid,
                light: data.light
            })
            isInit[id] = {};
            elementListeners[id] = specific_change_types.map(k => {
                isInit[id][k] = false;
                return this.onValue(`${id}/${k}`, (d) => {
                    if (!isInit[id][k]) {
                        isInit[id][k] = true;
                    } else if (d != null) {
                        this._onChange({
                            type: k,
                            data: this.fromFBData(d),
                            id: id,
                            upid: d.upid,
                            light: d.light
                        })
                    }
                })
            })
            if (data.light) {
                let createdListener = this.onValue(`${id}/light`, async (light) => {
                    if (light === false) {
                        createdListener();
                        let cdata = await this.get(id);
                        console.log(cdata);
                        this._onChange({
                            type: "creation",
                            data: this.fromFBData(cdata),
                            id: id,
                            upid: cdata.upid,
                            light: cdata.light
                        })
                    }
                })
            }
        })
    

        /** @param {ElementChangeEvent} cData */
        this.onChange = (cData) => {
            whiteboard.pushChange(cData)
            whiteboard.updateSelection();
        }


        whiteboard.lockElement = async (e) => {
            try {
                await this.set(`${e.id}/locked`, this.uid);
                return true;
            } catch (e) {
                return false;
            }
        }

        whiteboard.releaseElement = async (e) => {
            try {
                await this.set(`${e.id}/locked`, false);
            } catch (e){

            }
        }
        
        whiteboard.onElementChangeDB = (e) => {
            this.addChange(e);
        }

        this.watchChanges();
    }

    _onChange(e) {
        if (e.upid) {
            if (this.sentUpdateIds.has(e.upid)) {
                this.sentUpdateIds.delete(e.upid);
            } else {
                let [ts, uid, iid] = e.upid.split("-");
                let e2 = new ElementChangeEvent(e.id, e.type, e.data, ts, e.light)
                e2.isMe = uid === this.uid;
                e2.isInstance = iid === instaceID;
                this.onChange(e2);
            }
        }
    }

    toFBData(json) {
        let r = (o) => {
            let res = o;
            if (Array.isArray(o)) {
                res = {isArray: o.length}
                if ("light" in o) res.light = o.light;
                if ("upid" in o) res.upid = o.upid;
                for (let i = 0; i < o.length; i++) res[i] = r(o[i])
            } else if (o !== null && typeof o === "object") {
                res = {};
                for (let key in o) res[key] = r(o[key]);
            } 
            return res;
        }

        return r(json);
    }
    fromFBData(json) {
        let r = (o) => {
            let res = o;
            if (o !== null && typeof o === "object") {
                if (o.isArray) {
                    res = new Array(o.isArray);
                    for (let i = 0; i < o.isArray; i++) res[i] = r(o[i])
                } else {
                    res = {};
                    for (let key in o) {
                        if (key !== "upid" && key !== "light") {
                            res[key] = r(o[key])
                        }
                    }
                }
            }
            return res;
        }

        return r(json);
    }


    async watchChanges(){
        if (this._isWatching) return;
        this._isWatching = true;
        this.stopWatching = false;
        while (!this.stopWatching) {
            this.sendChanges();
            await new Promise((resolve, reject) => {setTimeout(resolve, minimumUpdateInterval)})
        }
    }

    async sendChanges(){
        // for every change type and changes for that type
        for (let type of [...specific_change_types,"deletion", "creation"]) {
            if (type in this.changeBuffers) {
                for (let id in this.changeBuffers[type]) {
                    let change = this.changeBuffers[type][id];
                    if (change != null) {
                        // send the most recent change
                        this.sendChange(change); 
                        delete this.changeBuffers[type][id]
                    }
                }
            }
        }
    }

    async sendChange(e) {
        try {
            let type = e.changeType
            let id = e.elementId;
            let path = id;
            let json = e.data;
            let upid = `${e.ts}-${this.uid}-${instaceID}`
            json.light = e.light;
            json.upid = upid;
    
            switch (type) {
                case "deletion": 
                    json = null;
                    break;
                case "styleSet":
                case "trans":
                case "data":
                case "order":
                    path = `${id}/${type}`
                    break;
            }
            
            this.sentUpdateIds.add(upid);
            if (type === "deletion") {
                await this.set(`${id}/upid`, upid)
            } 
            this.lastUpdatTS[id] = e.ts;
            let parsed = this.toFBData(json)
            await this.set(path, parsed);
        } catch (x) {

        }
    }

    /** @param {ElementChangeEvent} e */
    addChange(e){
        // console.log(e);
        let type = e.changeType
        let id = e.elementId;

        if (!(type in this.changeBuffers)) {
            this.changeBuffers[type] = {}
        }
        this.changeBuffers[type][id] = e;
        // console.log(this.changeBuffers);
    }
        
}

export {WhiteboardFirebaseFrame, WhiteBoard}
