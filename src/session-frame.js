import {SvgPlus, Vector} from "./SvgPlus/4.js"
import {WaveyCircleLoader} from "./Utilities/animation-icons.js"
import {FloatingBox, HideShow, SvgResize} from "./Utilities/basic-ui.js"
import {parallel, getCursorPosition, delay} from "./Utilities/usefull-funcs.js"
import {VideoCallScreen, VideoCallWidget} from "./WebRTC/video-call-widget.js"
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
    this.imute = this.createChild("div", {class: "icon", type: "audio", content: Icons["mute"]});
    this.imute.onclick = () => WebRTC.muteTrack("audio", "local");
    this.ivideo = this.createChild("div", {class: "icon", type: "video", content: Icons["video"]});
    this.ivideo.onclick = () => WebRTC.muteTrack("video", "local");
    this.calibrate = this.createChild("div", {class: "icon", type: "calibrate", content: Icons["calibrate"]});
    let i4 = this.createChild("div", {class: "icon", type: "end-call", content: Icons["end"]});
    let i5 = this.createChild("div", {class: "icon", type: "file", content: Icons["hide"]});

    let timeout;
    let tf = () => {
      if (!this.isMouseOver || !this.active) {
          this.hide()
          timeout = null;
      } else {
          timeout = setTimeout(tf, 500)
      }
    }

    window.addEventListener("mousemove", (e) => {
      if (this.isMouseOver && this.active) {
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

  /**
   * @param {{ local: { audio_muted: any; video: any; }; type: any; } | null} state
   */
  set state(state) {
    if (state != null) {
      if ("local" in state) {
        if ("audio_muted" in state.local) this.imute.innerHTML = state.local.audio_muted ? Icons.mute : Icons.unmute
        if ("video" in state.local) this.imute.innerHTML = state.local.video ? Icons.novideo : Icons.video
      }
      if ("type" in state) {
        this.setAttribute("type", state.type);
      }
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

class FeedbackWindow extends FloatingBox {
  constructor(el = "feedback-window") {
    super(el);
    this.frame = this.createChild(FeedbackFrame);
    this.frame.shown = true;
    this.message = this.createChild("div", {class: "message", content: "Make sure you're eyes are visible and highlighted with green boxes<br/>"});
    // this.message.createChild("small", {content: "The two images of you're eyes will be used to track your eyes, make sure they are clear."})
    let buttons = this.createChild("div", {class: "buttons"});
    this.cancel = buttons.createChild("div", {class: "btn", content: "cancel"})
    this.continue = buttons.createChild("div", {class: "btn", content: "continue"})
    this.align = "center";
    this.styles = {"width": "50vmin"}
  }

  async waitClick() {
    return new Promise((resolve, reject) => {
      this.cancel.onclick = () => {
        this.cancel.onclick = null;
        resolve("cancel");
      }
      this.continue.onclick = () => {
        this.continue.onclick = null;
        resolve("continue");
      }
    })
  }
}

/* 

calibrated: true, false
             1     0
calibrating: not-calibrating feedback, calibration, results
                0               1         2           3 
*/


class SessionFrame extends SvgPlus {
  async onconnect(){
    this.frameContent = this.innerHTML;
    this.innerHTML = "";

    this.session_content = this.createChild("div")

  
    this.web_rtc = this.createChild("div");
    this.video_widget = this.web_rtc.createChild(VideoCallWidget);
    this.video_call_screen = this.web_rtc.createChild(VideoCallScreen);
    this.tool_bar = this.web_rtc.createChild(ToolBar);
    this.video_widget.addEventListener("move", () => {
      let ypos = getCursorPosition().y / window.innerHeight;
      this.tool_bar.top = ypos > 0.5;
    });


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
    this.feedback_window = this.calibration_content.createChild(FeedbackWindow);
    this.feedback_window.align = "center"
    this.feedback_window.continue.onclick = () => this.calibrate();
    this.feedback_window.cancel.onclick = () => this.cancel_calibration();
    
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

    this.tool_bar.calibrate.onclick = () => this.start_calibration();
    
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


  async toWidget(){
    await parallel(this.video_call_screen.hide(), this.video_widget.show());
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
      this.blob.position = rel;
      WebRTC.sendData({eye: {x: result.x, y: result.y}})
    }

    WebRTC.sendData({calibrating: this._calibrating})
    if (this._calibrating == 1 && input.features) {
      WebRTC.sendData({features: input.features.serialise()})
    } 
  }


  /**
   * @param {{ calibrate: number; calibrating: any; calibration_results: any; eye: number | undefined; features: any; } | null} data
   */
  set data(data){
    if (data != null) {
      if ("calibrate" in data) {
        if (data.calibrate == 1) {
          this.start_calibration();
        } else if (data.calibrate == 2){
          this.calibrate();
        } else {
          this.cancel_calibration();
        }
      } 

      if ("calibrating" in data) {
       this.calibration_state_host = data.calibrating;
      }

      if ("calibration_results" in data) {
        this.calibration_frame.std = data.calibration_results;
      }

      if ("eye" in data) {
        let [pos, size] = this.pointers.bbox;
        let rel = (new Vector(data.eye)).mul(size).add(pos);
        this.blob.position = rel;
      }

      if ("features" in data) {
        this.feedback_window.frame.renderFace({features: EyeGaze.deserialiseFeatures(data.features)})
      }
    }
  }

  /**
   * @param {{ type: any; status: string; remote: { stream: any; }; } | null} state
   */
  set state(state){
    if (state != null) {
      if ("type" in state) {
        this.type = state.type;
      }
      if ("status" in state) {
        if (state.status == "started") this.tool_bar.active = true;
        this.loader.show(400, state.status == "open");
      }
      if ("remote" in state && this.type == "host") {
        if ("stream" in state.remote) {
          this.feedback_window.frame.videoStream = state.remote.stream;
        }
      }
    }
  }



  /**
   * @param {Number} state
   */
  set calibration_state_host(state) {
    if (state != this._c_state) {
      console.log(state, this._c_state);
      this._c_state = state;
      switch(state) {
        case 0:
          this.feedback_window.hide();
        case 4: // not calibrated not calibrating
          this.pointers.show();
          break;
        case 1: // calibrated and in feedback
          this.toWidget();
          this.pointers.hide();
          this.feedback_window.show();
          break;
        case 2: // not calibrated and calibrating
          this.feedback_window.hide();
          this.loader.setText("calibrating")
          this.loader.show();
          break;
        case 3:
          this.calibration_results();
          break;
      }
    }
  }


  async start_calibration(){
    if (this.type == "host") {
      WebRTC.sendData({calibrate: 1})
    } else if (this._calibrating != 1){
      this._calibrating = 1;
      Webcam.startProcessing();
      await parallel(this.toWidget(), this.pointers.hide());
      await this.feedback_window.show();
    }
  }

  async cancel_calibration(){
    if (this.type == "host") {
      WebRTC.sendData({calibrate: 0})
    } else {
      this._calibrating = 0;
      await this.feedback_window.hide();
    }
  }

  async calibrate(){
    if (this.type == "host") {
      WebRTC.sendData({calibrate: 2})
    } else if (this._calibrating == 1){
      await this.feedback_window.hide();
      this._calibrating = 2;
      await this.calibration_frame.show();
      await this.calibration_frame.calibrate();
      this._calibrating = 3;
      WebRTC.sendData({calibration_results: this.calibration_frame.std});
      await this.calibration_frame.show_results();
      await this.calibration_frame.hide();
      this._calibrating = 4;
      this.pointers.start();
      await this.pointers.show();
    }
  }

  async calibration_results(val){
    await this.loader.hide()
    await parallel(this.calibration_frame.show(), this.calibration_frame.show_results(val));
    this.loader.setText("")
    await this.calibration_frame.hide();
    await this.pointers.show();
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
        this.video_call_screen.show();
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
