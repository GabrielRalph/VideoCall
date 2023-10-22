import {SvgPlus} from "./SvgPlus/4.js"
import {CopyIcon, WaveyCircleLoader} from "./copy-icon.js"
import * as VideoCall from "./webrtc.js"
import * as Webcam from "./Webcam.js"
import {Icons} from "./assets/icons.js"

function getQueryKey(string = window.location.search) {
  let key = null;
  try {
    let match = string.match(/^\?([ !"%&'()*+\,\-\/0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ\^_`abcdefghijklmnopqrstuvwxyz{|}]{20})(?:\.(\w*))?$/);
    if (match) {
      if (!match[2]) match[2] = null;
      key = {
        key: match[1],
        option: match[2]
      }
    }
  } catch(e){}
  return key;
}
function makeKeyLink(key, option = null) {
  let {origin, pathname} = window.location;
  if (typeof option === "string") option = `.${option}`;
  else option = "";
  return `${origin}${pathname}?${key}${option}`
}

let mx = 0;
let my = 0;
let x = 0;
let y = 0;
let w = window.innerWidth;
let h = window.innerHeight;
let change_flag = false;
window.onmousemove = (e) => {
  mx = e.x;
  my = e.y;
  x = e.x - window.innerWidth/2;
  y = e.y - window.innerHeight/2;
  w = window.innerWidth;
  h = window.innerHeight;
  change_flag = true;
}



class RTCApp extends SvgPlus {
  async onconnect(){
    let btns = {};
    this.videos = this.createChild(VideoPannel)

    this.copy = this.createChild(CopyIcon);
    this.copy.styles = {visibility: "hidden"};


    this.fc = this.createChild("div", {style: {
      position: "fixed",
      width: "15px",
      height: "15px",
      "border-radius": "10px",
      "border": "2px solid red",
      transform: "translate(-50%, -50%)"
    }})


    // let next = () => {
    //   let msg = {};
    //   if (change_flag) {
    //     change_flag = false;
    //     let coords = {x,y,w,h};
    //     for (let key in coords) msg[key] = coords[key];
    //     VideoCall.sendMessage(msg);
    //   }
    //   window.requestAnimationFrame(next);
    // }
    // window.requestAnimationFrame(next);
    //
    //
    this.loader_pannel = this.createChild("div", {styles: {
      position: "fixed",
      top: "50%",
      left: "50%",
      width: "25vmin",
      height: "25vmin",
      transform: "translate(-50%, -50%)",
      visibility: "hidden",
    }});
    this.loader = this.loader_pannel.createChild(WaveyCircleLoader);

    this.btns = btns;
    let key = getQueryKey();
    if (key != null) {
      let forceParticipant = key.option == "force";
      await this.joinSession(key.key, forceParticipant);
    }
  }
  //
  // calibrate(){
  //   VideoCall.sendMessage({calibrating: true})
  //   let cwindow = this.createChild("div", {
  //     content: "Calibrating",
  //     style: {
  //       position: "fixed",
  //       top: 0,
  //       left: 0,
  //       right: 0,
  //       bottom: 0,
  //       background: "#fff5",
  //       "font-size": "3em",
  //       "text-align": "center"
  //   }})
  //   setTimeout(() => {
  //     cwindow.remove();
  //     VideoCall.sendMessage({calibrating: false});
  //   }, 2000)
  // }

  onupdate(e) {
    if ("status" in e) {
      // console.log(e);
      if (e.status == "open") {
        this.videos.setSrc("remote", e.remote_stream);
        this.loaded();
      } else {
        this.videos.setSrc("remote", null);
        this.loading();
      }
    }

    if ("audio_muted" in e) {
      this.videos.setIcon("remote", "topLeft", e.audio_muted ? "mute" : "unmute");
    }

    // TESTING
    if ("x" in e) {
      let nx = w/2 + w * e.x / e.w;
      let ny = h/2 + h * e.y / e.h;
      this.fc.styles = {
        top: ny + "px",
        left: nx + "px",
      }
    }
    if ("calibrate" in e) {
      this.calibrate();
    }
    if ("calibrating" in e) {
      this.toggleAttribute("remote-calibrating", e.calibrating)
    }
  }

  loaded(){
    this.loader_pannel.styles = {"visibility": "hidden"};
  }

  loading(){
    this.loader_pannel.styles = {"visibility": "visible"}
  }
  //
  // askCalibration(){
  //   VideoCall.sendMessage({calibrate: true})
  // }

  async createSession(){
    let key = await VideoCall.makeSession();
    try {
      await this.joinSession(key);
    } catch (e) {

    }
  }

  async joinSession(key, forceParticipant = false){
    if (await Webcam.startWebcam()) {
      this.loading();
      let stream = Webcam.getStream(2)
      if (this.btns.create) this.btns.create.remove();
      this.videos.setSrc("local", stream);

      try {
        await VideoCall.start(key, stream, (e) => this.onupdate(e), forceParticipant);
        this.copy.styles = {visibility: "visible"};
        this.copy.value = makeKeyLink(key);
        this.copy.text = key;
        this.session_started = true;
        let userType = VideoCall.getUserType();
        if (userType == "host") {
          this.videos.setIcon("remote", "topRight", "calibrate", () => this.askCalibration());
        }
      } catch (e) {
        alert(e);
      }
    } else {
      alert("Webcam is not accessible.");
    }
  }
}

SvgPlus.defineHTMLElement(RTCApp)
