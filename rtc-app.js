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
class RTCApp extends SvgPlus {
  async onconnect(){
    let btns = {};
    let vc = this.createChild("div", {class: "v-container"});
    this.v1 = vc.createChild("video", {autoplay: true, playsinline: true});
    this.v1.muted = true;
    this.v2 = vc.createChild("video", {autoplay: true, playsinline: true});

    this.vc = vc;
    this.vc.innerHTML = "";
    // let signaler = VideoCall.signaler;
    // VideoCall.setElement(vce);

    // b1.onclick = async () =>
    // setInterval(() => {
    //   // information from video call stored in video-call-element
    //   console.log(vce.numberOfParticipants);
    // }, 1000)
    let key = getQueryKey();
    if (key != null) {
      let forceParticipant = key.option == "force";
      console.log(key);
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
    console.log(e);
    if ("remote_stream" in e) {
      if (this.v2.srcObject == null) {
        this.v2.srcObject = e.remote_stream;
        this.vc.appendChild(this.v2);
      }
    }
  }


  async createSession(){
    if (await Webcam.startWebcam()) {
      this.v1.srcObject = Webcam.getStream();
      this.vc.appendChild(this.v1);
      let key = await signaler.make();
      await signaler.join(key);
      VideoCall.start((e) => this.onupdate(e), Webcam.getStream());
      this.session_started = true;
    } else {
      alert("Webcam is not accessible.")
    }
  }

  async joinSession(key, forceParticipant = false){
    if (await Webcam.startWebcam()) {
      this.v1.srcObject = Webcam.getStream();
      this.vc.appendChild(this.v1);
      let res = await signaler.join(key, forceParticipant);
      if (res == null) {
        alert("Session not available.");
        return;
      }
      VideoCall.start((e) => this.onupdate(e), Webcam.getStream())
      this.session_started = true;
    } else {
      alert("Webcam is not accessible.")
    }
  }
}

SvgPlus.defineHTMLElement(RTCApp)
