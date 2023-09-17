import {SvgPlus} from "./SvgPlus/4.js"
import {CopyIcon} from "./copy-icon.js"
import * as VideoCall from "./webrtc.js"
import * as Webcam from "./Webcam.js"

let {signaler} = VideoCall;
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
let x = 0;
let y = 0;
let w = window.innerWidth;
let h = window.innerHeight;
let change_flag = false;
window.onmousemove = (e) => {
  x = e.x - window.innerWidth/2;
  y = e.y - window.innerHeight/2;
  w = window.innerWidth;
  h = window.innerHeight;
  change_flag = true;
}

class RTCApp extends SvgPlus {
  async onconnect(){
    let btns = {};
    let vc = this.createChild("div", {class: "v-container"});
    this.v1 = vc.createChild("video", {autoplay: true, playsinline: true});
    this.v1.muted = true;
    this.v2 = vc.createChild("video", {autoplay: true, playsinline: true});

    this.vc = vc;
    this.vc.innerHTML = "";

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
      if (change_flag) {
        VideoCall.sendMessage(JSON.stringify({x, y, w, h}));
        change_flag = false;
      }
      window.requestAnimationFrame(next);
    }
    window.requestAnimationFrame(next);
    this.loading = this.createChild("div", {styles: {
      position: "fixed",
      top: "0",
      left: "0",
      bottom: "0",
      right: "0",
      "backdrop-filter": "blur(25px)",
      background: "#0000003",
      visibility: "hidden",
      "z-index": 100,
    }});
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

  onupdate(e) {
    // console.log(e);
    if ("data" in e) {
      let data = JSON.parse(e.data);
      let nx = w/2 + w * data.x / data.w;
      let ny = h/2 + h * data.y / data.h;
      console.log(nx, ny);
      this.fc.styles = {
        top: ny + "px",
        left: nx + "px",
      }
    }
    if ("remote_stream" in e) {
      if (this.v2.srcObject == null) {
        this.v2.srcObject = e.remote_stream;
        if (this.open) { this.loaded();}

      }
    }
    if ("remove_stream" in e) {
      this.v2.srcObject = null;
      this.v2.remove();
    }
    if ("receive_data_channel_state" in e || "negotiation_state" in e) {
      this.open = false
      if (e.receive_data_channel_state == "closed" || e.negotiation_state == "disconnected") {
        this.v2.remove();
        this.v2.srcObject = null;
      } else if (e.receive_data_channel_state == "open") {
        this.open = true;
        if (this.v2.srcObject != null) {
          this.loaded();
        }
      }
    }
  }

  loaded(){
    this.vc.appendChild(this.v2);
    this.loading.styles = {"visibility": "hidden"}
  }


  async createSession(){
    if (await Webcam.startWebcam()) {
      this.loading.styles = {"visibility": "visible"}

      if (this.btns.create) this.btns.create.remove();
      this.v1.srcObject = Webcam.getStream();
      this.vc.appendChild(this.v1);
      let key = await signaler.make();
      console.log(window.location + "?" + key);
      await signaler.join(key);
      VideoCall.start((e) => this.onupdate(e), Webcam.getStream());
      this.copy.styles = {visibility: "visible"};
      this.copy.value = "'" + window.location + "?" + key + "'";
      this.copy.text = `'${key}'`;
      this.session_started = true;
    } else {
      alert("Webcam is not accessible.")
    }
  }

  async joinSession(key, forceParticipant = false){
    if (await Webcam.startWebcam()) {
      this.loading.styles = {"visibility": "visible"}

      if (this.btns.create) this.btns.create.remove();
      this.v1.srcObject = Webcam.getStream();
      this.vc.appendChild(this.v1);
      let res = await signaler.join(key, forceParticipant);
      if (res == null) {
        alert("Session not available.");
        return;
      }
      VideoCall.start((e) => this.onupdate(e), Webcam.getStream())
      this.copy.styles = {visibility: "visible"};
      this.copy.value = "'" + window.location + "?" + key + "'";
      this.copy.text = `'${key}'`;
      this.session_started = true;
    } else {
      alert("Webcam is not accessible.")
    }
  }
}

SvgPlus.defineHTMLElement(RTCApp)
