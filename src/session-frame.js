import {SvgPlus, Vector} from "./SvgPlus/4.js"
import {WaveyCircleLoader} from "./Utilities/animation-icons.js"
import {FloatingBox, SvgResize} from "./Utilities/basic-ui.js"
import {parallel, getCursorPosition, delay} from "./Utilities/usefull-funcs.js"
import {VideoCallWidget} from "./WebRTC/video-call-widget.js"
import * as WebRTC from "./WebRTC/webrtc.js"
import {Icons} from "./Utilities/icons.js"
import * as EyeGaze from "./EyeTracking/Algorithm/EyeGaze.js"
import {CalibrationFrame} from "./EyeTracking/UI/calibration-frame.js"
import {FeedbackFrame} from "./EyeTracking/UI/feedback-frame.js"
const Webcam = EyeGaze.Webcam;


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

async function waitClick(elem){
  return new Promise((resolve, reject) => {
    elem.onclick = () => {
      elem.onclick = null;
      resolve(true);
    }
  })
}


class ToolBar extends SvgPlus {
  constructor(el = "tool-bar"){
    super(el);
    this.range = 100;
    this.imute = this.createChild("div", {class: "icon", content: Icons["mute"]});
    this.imute.onclick = () => WebRTC.muteTrack("audio", "local");
    this.ivideo = this.createChild("div", {class: "icon", content: Icons["video"]});
    this.ivideo.onclick = () => WebRTC.muteTrack("video", "local");
    this.calibrate = this.createChild("div", {class: "icon", content: Icons["calibrate"]});
    let i4 = this.createChild("div", {class: "icon", content: Icons["end"]});
    let i5 = this.createChild("div", {class: "icon", content: Icons["hide"]});
    let i6 = this.createChild("div", {class: "icon", content: Icons["game"]});

    let timeout = null;
    let tf = () => {
      if (!this.isMouseOver) {
          this.hide()
          timeout = null;
      } else {
          timeout = setTimeout(tf, 500)
      }
    }

    window.addEventListener("mousemove", (e) => {
      if (this.isMouseOver) {
        this.show();
        tf();
      }
    })

    WebRTC.addStateListener(this);
  }

  onconnect(){
    let vcw = document.querySelector("video-call-widget");
    console.log(vcw);
    vcw.addEventListener("move", (e) => {
      let yrel = -1 * vcw.relativePosition.y;
      if (yrel > 0.5) this.top = true;
      else this.top = false;
    })
  }

  set state(state) {
    if (state != null && "local" in state) {
      if ("audio_muted" in state.local) this.imute.innerHTML = state.local.audio_muted ? Icons.mute : Icons.unmute
      if ("video" in state.local) this.imute.innerHTML = state.local.video ? Icons.novideo : Icons.video
    }
  }


  get isMouseOver(){
    let e = getCursorPosition();
    if (this.top) return e.y < this.range;
    else return e.y > window.innerHeight - this.range;
  }

  set top(value){
    this.toggleAttribute("top", value)
  }

  get top(){
    return this.hasAttribute("top")
  }

 
  async hide(){await this.show(false)}
  async show(toshow = true) {
    if (toshow != this.shown && this.showing == null) {
      this.shown = toshow;
      this.showing = this.waveTransition((t) => {
        this.styles = {
          "--hsr": t
        }
      }, 500, !toshow);
      await this.showing;
      this.showing = null;
    }
  }
}

class SessionFrame extends SvgPlus {
  async onconnect(){
    this.frameContent = this.innerHTML;
    this.innerHTML = "";

    this.session_content = this.createChild("div")
    this.web_rtc = this.createChild("div");
    this.video_widget = this.web_rtc.createChild(VideoCallWidget);
    this.tool_bar = this.createChild(ToolBar);

    let pointers = this.createChild(SvgResize);
    pointers.styles = {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      "pointer-events": "none"
    }
    this.blob = pointers.createPointer("blob", 15);
    this.blob.shown = true;
    this.pointers = pointers;

    this.calibration_content = this.createChild("div");
    this.calibration_frame = this.calibration_content.createChild(CalibrationFrame);
    this.feedback_frame = this.calibration_content.createChild(FeedbackFrame);
    
    this.loader = this.createChild(WaveyCircleLoader);
    this.loader.styles = {width: "30%"};
    this.loader.align = "center";
    this.loader.shown = true;

    this.error_frame = new FloatingBox("error-frame");
    this.error_frame.align = "center";
    this.error_frame.styles = {"font-size": "3em", "text-align": "center"};
    this.appendChild(this.error_frame);

    WebRTC.addDataListener(this);
    WebRTC.addStateListener(this);
    Webcam.addProcessListener((e) => this.onEyePosition(e));

    this.tool_bar.onclick = () => this.calibrate();
    
    let key = getQueryKey();
    if (key != null) {
      let forceParticipant = key.option == "force";
      await parallel(WebRTC.load(), EyeGaze.load());
      await this.joinSession(key.key, forceParticipant);
    } else {
      this.error_frame.innerHTML = "This is not a valid session link."
      await parallel(this.loader.hide(), this.error_frame.show());
    }
  }


  onEyePosition(input) {
    let {result} = input;
    let rel = null;

    if (result) {
      if (result.x > 1) result.x = 1;
      if (result.x < 0) result.x = 0;
      if (result.y > 1) result.y = 1;
      if (result.y < 0) result.y = 0;
      let [pos, size] = this.pointers.bbox;
      rel = result.mul(size).add(pos);
      console.log(rel);
      this.blob.position = rel;
      WebRTC.sendData({eye: {x: result.x, y: result.y}})
    }
    // const event = new Event("prediction");
    // event.pos = rel;
    // this.dispatchEvent(event);
  }


  set data(data){
    if (data != null) {
      if ("calibrate" in data) {
        this.calibrate();
      } 
      if ("eye" in data) {
        if (!this.pointers.shown) this.pointers.show();
        let [pos, size] = this.pointers.bbox;
        let rel = (new Vector(data.eye)).mul(size).add(pos);
        // console.log(rel, da);
        this.blob.position = rel;
      }
    }
  }

  set state(state){
    if (state != null) {
      if ("type" in state) {
        this.type = state.type;
      }
      if ("status" in state) {
        this.loader.show(400, state.status == "open");
      }
    }
  }


  async calibrate(){
    if (this.type == "host") {
      WebRTC.sendData({calibrate: true})
    } else {
      Webcam.startProcessing();
      this.feedback_frame.size = 0.5;
      this.feedback_frame.align = "center"
      await this.feedback_frame.show();
      await waitClick(this.feedback_frame);
      await this.feedback_frame.hide();
      await this.calibration_frame.show();
      // await delay(10000);
      await this.calibration_frame.calibrate();
      await this.calibration_frame.hide();
      this.pointers.start();
      await this.pointers.show();
    }
  }




  async joining(){
    this.loader.setText("JOINING");
    if (!this.loader.shown) await this.loader.show();
  }

  async joinSession(key, forceParticipant = false){
    await parallel(this.joining(), this.error_frame.hide());
    if (await Webcam.startWebcam()) {
      let stream = Webcam.getStream(2)
      // this.videos.setSrc("local", stream);
      try {
        await WebRTC.start(key, stream, forceParticipant);
        this.loader.setText("")
      } catch (e) {
        console.log(e);
        this.error_frame.innerHTML = e;
        await parallel(this.loader.hide(), this.error_frame.show())
      }
    } else {
      this.error_frame.innerHTML = "Please enable webcam access to continue.<br/>"
      this.error_frame.createChild("div", {style: {"font-size": "0.5em"}, content: "Try Again", class: "btn"}).onclick = () => {
        this.joinSession(key, forceParticipant);
      }
      await parallel(this.loader.hide(), this.error_frame.show())
    }
  }
}

SvgPlus.defineHTMLElement(SessionFrame)
