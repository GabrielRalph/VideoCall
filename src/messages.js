import { SvgPlus } from "./SvgPlus/4.js";
import {Icons} from "./Utilities/icons.js"
import { addAppDatabase, getUserType, addStateListener} from "./WebRTC/webrtc.js"


class AutoSize extends SvgPlus {
    constructor() {
        super("textarea");
        
        this.props = {
            styles: {
                resize: "none",
            },
            rows: 1,
            cols: 40,
            events: {
                input: () => {
                    this.updateRows();
                }
            }
        }

        this.height0 = null;
    }


    updateRows(){
        let {clientHeight} = this;
        if (this.height0 == null) this.height0 = clientHeight;

        // var range = document.createRange();
        // range.selectNode(this);
        // if (range.getBoundingClientRect) {
        //     var rect = range.getBoundingClientRect();
        // }

        let n = Math.round(this.scrollHeight/this.height0)
        if (this.value == "") {
            n = 1;
        }

        this.setAttribute("rows", n);

        window.requestAnimationFrame(() => {
            let delta = clientHeight - this.clientHeight;
            const event = new Event("resize");
            event.deltaY = delta;
            this.dispatchEvent(event);
        })
    }
}



function toDateString(ts){
    let now = new Date();
    let date = new Date(ts);
    let str = "";

    // Same Day
    if (now - ts < 1000 * 60 * 60 * 48 && now.getDate() == date.getDate()) {
        let hours = date.getHours();
        let pmam = "am";
        if (hours == 0) hours = 12;
        if (hours > 12) {
            hours -= 12;
            pmam = "pm"
        }
        str = hours + ":" + date.getMinutes().toString().padStart(2,'0') + pmam;
    // Different Day
    } else {
        str = date.getDay() + "/" + date.getMonth() 
    }

    return str;
}
class Message extends SvgPlus{
    constructor({sender, date, content}) {
        super("div")
        let isSender = sender == getUserType();
        this.props = {
            sender: isSender,
            class: "i-message"
        }
        let msg = this.createChild("div", {class: "i-text-bubble"})
        
        this.isSender = isSender;
        
        msg.createChild("div", {
            content: content,
        })

        this.date = date;
        
        this.createChild("div", {class: "i-message-date", content: toDateString(date)})
    }

    compare(msg) {
        if (msg == null) return false;
        else if (msg.isSender != this.isSender) return false;
        else return  Math.abs(this.date - msg.date) < 1000 * 60 * 5;
    }

    set type(type) {
        this.props = {type: type}
    }
}

export class Messages extends SvgPlus {
    constructor(init){
        super("message-panel");
        addStateListener(this);
        addAppDatabase("messages", this)
        let title = this.createChild("div", {class: "title"});
        title.createChild("div", {content: "Messages"});
        this.close = title.createChild("div", {class: "icon", content: Icons["close"]});

        let main = this.createChild("div", {class: "main-items"});

        this.messageFeed = main.createChild("div", {class: "message-feed"});
        let messageInput = main.createChild("div", {class: "message-input"});
        this.textarea = messageInput.createChild(AutoSize, {
            events: {
                keydown:  (e) => {
                    if (e.key == "Enter" && !e.shiftKey) {
                        this.sendMessage();
                        e.preventDefault();
                    }
                },
                resize: (e) => {
                    console.log(e.deltaY);
                    console.log(this.messageFeed.scrollTop);
                    this.messageFeed.scrollTo(0, -e.deltaY + this.messageFeed.scrollTop);
                }
            }
        })


        // this.textarea.onkeydown =
        messageInput.createChild("div", {
            class:"icon", 
            content: Icons.send,
            events: {
                click: () => {
                    this.sendMessage();
                }
            }
        });
        
    }


    initialise(){
        if (!this.init) {
            this.init = true;
            this.onChildAdded(null, (data) => {
                this.addMessage(data)
            })
        }
    }


    get input(){
        return this.textarea.value;
    }
    set input(value){
        this.textarea.value = value;
        this.textarea.updateRows();
    }

    set state(state) {
        if (state) {
            this.initialise();
        }
    }


    sendMessage(){
        if (this.input.match(/[^\s]/)) {
            const event = new Event("message");
            event.data = this.input;
            // this.addMessage(this.input, true);
            this.input = "";
            
            let key = this.push();
            this.set(key, {
                sender: getUserType(),
                content: event.data,
                date: (new Date()).getTime()
            })
            this.dispatchEvent(event);
        }
    }


    addMessage(content) {
        let {messageFeed} = this;
        let newm = messageFeed.createChild(Message, {}, content);

        newm.scrollIntoView();

        let messages = messageFeed.children;

        for (let i = 0; i < messages.length; i++) {
            let ni = i + 1;
            let li = i - 1;

            let m = messages[i];
            let ns = ni < messages.length ? messages[ni] : null;
            let ls = li >= 0 ? messages[li] : null;

            let isIso = !m.compare(ns) && !m.compare(ls);
            let isStart = m.compare(ns) && !m.compare(ls);
            let isEnd = !m.compare(ns) && m.compare(ls);
            let isMid = m.compare(ns) && m.compare(ls);
            m.type = isIso ? "isolated" : isEnd ? "end" : isStart ? "start" : isMid ? "middle" : null;
        }
    }

}