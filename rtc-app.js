import {SvgPlus} from "./SvgPlus/4.js"
import {CopyIcon, WaveyCircleLoader} from "./copy-icon.js"
import * as VideoCall from "./webrtc.js"
import * as Webcam from "./Webcam.js"
import {Icons} from "./assets/icons.js"

window.webcam = Webcam;
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

// const ICONS = {
//   mute: `<svg style = "--ws: 1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14.94 17.41"><path class="i-fill" d="m9.78,4v-1.69c0-1.28-1.04-2.31-2.31-2.31s-2.31,1.04-2.31,2.31v5.13l4.63-3.44Z"/><path class="i-fill" d="m6.16,10.9c.37.26.82.41,1.31.41,1.28,0,2.31-1.04,2.31-2.31v-.79l-3.62,2.69Z"/><path class="i-fill" d="m3.51,8.67v-2.01c0-.38-.31-.68-.68-.68s-.68.31-.68.68v2.33c0,.22.03.44.06.65l1.31-.97Z"/><path class="i-fill" d="m12.55,6.14l-1.12.83v2.01c0,2.19-1.78,3.96-3.96,3.96-1.03,0-1.96-.4-2.67-1.05l-1.11.82c.82.82,1.88,1.39,3.09,1.55v1.77h-2.41c-.38,0-.68.31-.68.68s.31.68.68.68h6.18c.38,0,.68-.31.68-.68s-.31-.68-.68-.68h-2.4v-1.77c2.62-.34,4.65-2.58,4.65-5.28v-2.33c0-.21-.1-.39-.25-.52Z"/><path class="i-fill" d="m.69,13.55c-.21,0-.42-.1-.55-.28-.23-.3-.16-.73.14-.96L13.85,2.23c.3-.23.73-.16.96.14.23.3.16.73-.14.96L1.09,13.41c-.12.09-.27.14-.41.14Z"/></svg>`,
//   unmute: `<svg style = "--ws: 1"  id="Layer_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10.66 17.41"><path class="i-fill" d="m7.65,2.31c0-1.28-1.04-2.31-2.31-2.31s-2.31,1.04-2.31,2.31v6.67c0,1.28,1.04,2.31,2.31,2.31s2.31-1.04,2.31-2.31V2.31Z"/><path class="i-fill" d="m10.66,8.99v-2.33c0-.38-.31-.68-.68-.68s-.68.31-.68.68v2.33c0,2.19-1.78,3.96-3.96,3.96s-3.96-1.78-3.96-3.96v-2.33c0-.38-.31-.68-.68-.68s-.68.31-.68.68v2.33c0,2.71,2.03,4.95,4.65,5.28v1.77h-2.41c-.38,0-.68.31-.68.68s.31.68.68.68h6.18c.38,0,.68-.31.68-.68s-.31-.68-.68-.68h-2.4v-1.77c2.62-.34,4.65-2.58,4.65-5.28Z"/></svg>`,
//   video: `<svg style = "--ws: 0.583" id="Layer_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15.31 10.15"><path class="i-fill" d="m15.02,1.45c-.17-.08-.38-.06-.53.07l-1.76,1.47V.5c0-.28-.22-.5-.5-.5H.5C.22,0,0,.22,0,.5v9.15c0,.28.22.5.5.5h11.73c.28,0,.5-.22.5-.5v-2.48l1.76,1.47c.15.12.36.15.53.07.18-.08.29-.26.29-.45V1.9c0-.19-.11-.37-.29-.45Z"/></svg>`,
//   v2: `<svg style = "--ws: 0.583" id="Layer_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15.57 10.15"><path class="cls-1" d="m14.63,1.93l-1.88,1.51V1.39c0-.77-.62-1.39-1.39-1.39H1.39C.62,0,0,.62,0,1.39v7.37c0,.77.62,1.39,1.39,1.39h9.97c.77,0,1.39-.62,1.39-1.39v-2.04l1.88,1.51c.38.3.94.03.94-.45V2.38c0-.49-.56-.76-.94-.45Z"/></svg>`,
//   novideo: `<svg style = "--ws: 0.82" id="Layer_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19.95 14.28"><path class="i-fill" d="m14.12,2.24H4.06c-.28,0-.5.22-.5.5v6.85L14.12,2.24Z"/><path class="i-fill" d="m18.58,3.69c-.17-.08-.38-.06-.53.07l-1.76,1.47v-.47l-10.98,7.64h10.48c.28,0,.5-.22.5-.5v-2.48l1.76,1.47c.15.12.36.15.53.07.18-.08.29-.26.29-.45v-6.35c0-.19-.11-.37-.29-.45Z"/><path class="i-fill" d="m.65,14.28c-.21,0-.41-.1-.53-.28-.21-.29-.13-.7.16-.9L18.93.12c.3-.2.7-.13.9.16.21.29.13.7-.16.9L1.02,14.16c-.11.08-.24.12-.37.12Z"/></svg>`,
//   calibrate: `<svg style = "--ws: 0.886" id="Layer_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15.42 15.42"><circle class="cali-fill" cx="7.71" cy="7.67" r="4.44"/><path class="cali-fill" d="m7.71,15.42C3.46,15.42,0,11.96,0,7.71S3.46,0,7.71,0s7.71,3.46,7.71,7.71-3.46,7.71-7.71,7.71Zm0-14.02C4.23,1.4,1.4,4.23,1.4,7.71s2.83,6.31,6.31,6.31,6.31-2.83,6.31-6.31S11.19,1.4,7.71,1.4Z"/></svg>`
// }


class VideoDisplay extends SvgPlus {
  constructor(){
    super("div");
    this.styles = {
      position: "relative",
    }
    this.video = this.createChild("video", {autoplay: true, playsinline: true});

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

  setIcon(location, iconName, cb) {
    if (iconName == null) {
      this[location].innerHTML = "";
      this[location].onclick = null;
    } else {
      this[location].innerHTML = Icons[iconName];
      this[location].onclick = cb;
    }
  }

  set srcObject(src) {this.video.srcObject = src;}
  get srcObject() {return this.video.srcObject;}
}

class VideoPannel extends SvgPlus {
  constructor(mode = "participant") {
    super("div");
    this.class = "v-container";
    let local = this.createChild(VideoDisplay);
    local.video.muted = true;
    local.styles = {"display": "none"}
    local.setIcon("bottomLeft", "video", () => this.toggleLocalVideo());
    local.setIcon("topLeft", "unmute", () => this.toggleLocalAudio());


    let remote = this.createChild(VideoDisplay);
    remote.styles = {"display": "none"}
    remote.setIcon("topLeft", "unmute", () => this.muteRemote());
    if (mode == "host") {
      remote.setIcon("topRight", "calibrate");
    }
    this.videos = {remote, local}

    let timeout = null;
    let tf = () => {
      let el = document.elementFromPoint(mx, my);
      if (!this.isSameNode(el) && !this.contains(el)) {
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


    // let next = () => {
    //   let rsrc = this.getSrc("remote");
    //   if (rsrc != null) {
    //     let audio = rsrc.getTracks()[0];
    //     console.log(audio.enabled);
    //     if (audio.enabled != !this.remote_muted) {
    //       this.remote_muted = !audio.enabled;
    //       this.videos.remote.setIcon("topLeft", audio.enabled ? "unmute" : "mute");
    //     }
    //   }
    //   window.requestAnimationFrame(next);
    // }
    // window.requestAnimationFrame(next);
  }

  toggleLocalVideo(){
    let mute = VideoCall.muteTrack("video");
    this.videos.local.setIcon("bottomLeft", mute ? "novideo" : "video", () => this.toggleLocalVideo());
  }
  toggleLocalAudio(){
    let mute = VideoCall.muteTrack("audio");
    this.videos.local.setIcon("topLeft", mute ? "mute" : "unmute", () => this.toggleLocalAudio());
  }




  setIcon(name, location, iconName, cb) {
    this.videos[name].setIcon(location, iconName, cb);
  }

  setSrc(name, src) {
    this.videos[name].srcObject = src;
    this.videos[name].styles = {
      "display": src == null ? "none" : "inherit"
    }
  }
  getSrc(name) {
    return this.videos[name].srcObject;
  }
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




    let next = () => {
      let msg = {};
      if (change_flag) {
        change_flag = false;
        let coords = {x,y,w,h};
        for (let key in coords) msg[key] = coords[key];
        VideoCall.sendMessage(msg);
      }

      window.requestAnimationFrame(next);
    }
    window.requestAnimationFrame(next);
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
    // this.createChild("overlay")
    // let signaler = VideoCall.signaler;
    // VideoCall.setElement(vce);

    // b1.onclick = async () =>
    // setInterval(() => {
    //   // information from video call stored in video-call-element
    //   console.log(vce.numberOfParticipants);
    // }, 1000)
    this.btns = btns;
    let key = getQueryKey();
    if (key != null) {
      let forceParticipant = key.option == "force";
      await this.joinSession(key.key, forceParticipant);
    }

    if (!this.session_started) {
      btns.create = this.createChild("div", {
        content: "Create Session",
        class: "btn",
        style: {
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)"
        }
      });
      btns.create.onclick = () => {
        this.createSession();
      }

    }
  }

  calibrate(){
    VideoCall.sendMessage({calibrating: true})
    let cwindow = this.createChild("div", {
      content: "Calibrating",
      style: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "#fff5",
        "font-size": "3em",
        "text-align": "center"
    }})
    setTimeout(() => {
      cwindow.remove();
      VideoCall.sendMessage({calibrating: false});
    }, 2000)
  }




  onupdate(e) {
    if ("status" in e) {
      console.log(e);
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

  askCalibration(){
    VideoCall.sendMessage({calibrate: true})
  }

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
