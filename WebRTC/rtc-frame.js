import {SvgPlus, Vector} from "../SvgPlus/4.js"
import {CopyIcon, WaveyCircleLoader} from "../copy-icon.js"
import {HideShow, FloatingBox} from "../Utilities/basic-ui.js"
import {parallel} from "../Utilities/usefull-funcs.js"
import * as Webcam from "../Webcam.js"
// import {VideoCallWidget} from "./video-call-widget.js"
let VideoCall = null;
const VideoCallProm = import("./webrtc.js");

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

class RTCFrame extends SvgPlus {
  async onconnect(){
    this.frameContent = this.innerHTML;
    this.innerHTML = "";

    this.main_frame = this.createChild("div");
    this.error_frame = new FloatingBox("error-frame");
    this.error_frame.align = "center";
    this.error_frame.styles = {"font-size": "3em", "text-align": "center"};

    this.loader = this.createChild(WaveyCircleLoader);
    this.loader.styles = {width: "30%"};
    this.loader.align = "center";
    this.loader.shown = true;
    this.appendChild(this.error_frame);

    VideoCall = await VideoCallProm;
    this.video_widget = this.createChild(VideoCall.VideoCallWidget);

    let key = getQueryKey();
    if (key != null) {
      let forceParticipant = key.option == "force";
      await this.joinSession(key.key, forceParticipant);
    } else {
      this.error_frame.innerHTML = "This is not a valid session link."
      await parallel(this.loader.hide(), this.error_frame.show());
    }
  }


  onupdate(e) {
    if ("status" in e) {
      // console.log(e);

      if (e.status == "open") {
        this.loader.hide()
      } else if (e.status == "ended") {
        this.ended = true;
        this.error_frame.innerHTML = "This session has ended."
        this.video_widget.hide();
         this.error_frame.show();
         if (this.loader.shown) this.loader.hide();
      } else if (!this.ended){
        this.loader.show();
      }
    }

  }

  // loaded(){
  //   this.loader_pannel.styles = {"visibility": "hidden"};
  // }
  //
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
        await VideoCall.start(key, stream, (e) => this.onupdate(e), forceParticipant);
        this.loader.setText("")
        let userType = VideoCall.getUserType();
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

SvgPlus.defineHTMLElement(RTCFrame)
