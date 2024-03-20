import {SvgPlus, Vector} from "./SvgPlus/4.js"
import {WaveyCircleLoader, CopyIcon, FileLoadIcon} from "./Utilities/animation-icons.js"
import {FloatingBox, HideShow, SvgResize} from "./Utilities/basic-ui.js"
import {parallel, getCursorPosition, delay} from "./Utilities/usefull-funcs.js"
import {VideoCallScreen, VideoCallWidget} from "./WebRTC/video-call-widget.js"
import * as WebRTC from "./WebRTC/webrtc.js"
import {Icons} from "./Utilities/icons.js"
import * as EyeGaze from "./EyeTracking/Algorithm/EyeGaze.js"
import {CalibrationFrame} from "./EyeTracking/UI/calibration-frame.js"
import {FeedbackFrame} from "./EyeTracking/UI/feedback-frame.js"
import {PdfViewer} from "./PDF/pdf-viewer.js"
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
    this.copy_icon = this.createChild(CopyIcon);
    this.copy_icon.class = "tbs"
    this.copy_icon.flip = true;
    this.copy_icon.svg.toggleAttribute("dark", true);
    this.copy_icon.onclick = async () => {
      this.keyanim = true;
      this.copy_icon.text = WebRTC.getKey();
      this.copy_icon.value = WebRTC.makeKeyLink(WebRTC.getKey());
      await this.copy_icon.showText();
      this.keyanim = false;
    }

    this.settings = this.createChild("div", {class: "icon tbs", type: "settings", content: Icons["settings"]});

    this.imute = this.createChild("div", {class: "icon tbs", type: "audio", content: Icons["mute"]});
    this.imute.onclick = () => WebRTC.muteTrack("audio", "local");

    this.ivideo = this.createChild("div", {class: "icon tbs", type: "video", content: Icons["video"]});
    this.ivideo.onclick = () => WebRTC.muteTrack("video", "local");

    this.calibrate = this.createChild("div", {class: "icon tbs", type: "calibrate", content: Icons["calibrate"]});

    let i4 = this.createChild("div", {class: "icon tbs", type: "end-call", content: Icons["end"]});
    i4.onclick = () => WebRTC.endSession();

    this.file = this.createChild("div", {class: "tbs icon", type: "file"});
    let fl = this.file.createChild(FileLoadIcon);
    fl.shown = true;
    fl.progress = 1;
    fl.props = {class: "icon"};
    this.fileProgress = fl;

    let pdf = this.createChild("div", {class: "group", styles: {display: "none"}});
    this.deletePdf = pdf.createChild("div", {class: "icon tbs", content:Icons["trash"]})
    let sub = pdf.createChild("div", {class: "subgroup", type: "pdf"})
    this.left = sub.createChild("div", {class: "icon tbs", content: "▶", style: {transform:'scale(-1, 1)'} });
    this.right = sub.createChild("div", {class: "icon tbs", content: "▶"});
    this.pdfCount = sub.createChild("div", {class: "pdf-count", content: "0"})
    this.pdfGroup = pdf;

    let image = this.createChild("div", {class: "group", styles: {display: "none"}});
    this.deleteImage = image.createChild("div", {class: "icon tbs", content:Icons["trash"]})
    this.imageGroup = image;

    let timeout;
    let tf = () => {
      if ((!this.isMouseOver || !this.active) && !this.keyanim) {
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

  updatePDFControls(pdf) {
    this.imageGroup.styles = {display: "none"};
    this.pdfGroup.styles = {display: "none"};

    if (pdf && pdf.displayType == "pdf") {
      let {page, totalPages} = pdf;
      let left = page > 1;
      let right = page < totalPages;
      this.pdfCount.innerHTML = `${page}/${totalPages}`;
      this.left.styles = {opacity: left ? 1 : 0.5, "pointer-events": left ? "all" : "none"};
      this.right.styles = {opacity: right ? 1 : 0.5, "pointer-events": right ? "all" : "none"};
      this.pdfGroup.styles = {display: null};
    } else if (pdf.displayType == "image") {
      this.imageGroup.styles = {display: null};
    }
  }



  /**
   * @param {{ local: { audio_muted: any; video: any; }; type: any; } | null} state
   */
  set state(state) {
    if (state != null) {
      if ("local" in state) {
        if ("audio_muted" in state.local) this.imute.innerHTML = state.local.audio_muted ? Icons.mute : Icons.unmute
        if ("video_muted" in state.local) this.ivideo.innerHTML = state.local.video_muted ? Icons.novideo : Icons.video
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
    this.message = this.createChild("div", {class: "message", content: "Make sure your eyes are visible and highlighted with green boxes<br/>"});
    let buttons = this.createChild("div", {class: "buttons"});
    this.cancel = buttons.createChild("div", {class: "btn", content: "cancel"})
    this.continue = buttons.createChild("div", {class: "btn", content: "continue"})
    this.align = "center";
    this.styles = {"width": "50vmin"}
    this.buttons = buttons;
  }

 

  renderFeatures(features, canvas) {
    this.continue.styles = {
      opacity: features.warning ? 0.5 : 1,
      "pointer-events": features.warning ? "none" : "all"
    }
    this.frame.renderFeatures(features, canvas);
  }
}

/* 

calibrated: true, false
             1     0
calibrating: not-calibrating feedback, calibration, results
                0               1         2           3 
*/

async function openContent(){
  let input = new SvgPlus("input");
  input.props = {type: "file", accept: "image/*, .pdf"};
  return new Promise((resolve) => {
    input.click();
    input.onchange = () => {
      if (input.files.length > 0) {
        let file = input.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => {
          file.url = evt.target.result;
          resolve(file);
        };
        reader.readAsDataURL(file);
      }
    }
  });
}


class SettingsPanel extends FloatingBox {
  constructor(){
    super("settings-panel");
    let title = this.createChild("div", {class: "title"});
    title.createChild("div", {content: "Settings"});
    let close = title.createChild("div", {class: "icon", content: Icons["close"]});
    close.onclick = () => this.hide();
    this.devicesList = this.createChild("div", {class: "device"});
    this.align = new Vector(0, 0.5)

  }

  async updateDevices(){
    let devices = await WebRTC.getTrackSelection();
    let types = {
      "audioinput": [],
      "videoinput": [],
      "audiooutput": [],
    }
    let niceNames = {
      "audioinput": "Select Microphone",
      "videoinput": "Select Camera",
      "audiooutput": "Select Speaker"
    }
    devices.forEach((a) => {if (a.kind in types) types[a.kind].push(a)})
    this.devicesList.innerHTML = "";
    this.devicesList.createChild("div", {content: "Device Inputs"})
    for (let type in types) {
      let typeList = this.devicesList.createChild("div");
      typeList.createChild("div", {content: niceNames[type]});
      for (let mdi of types[type]) {
        let icon = typeList.createChild("div", {class: "track-icon"});
        icon.createChild("span", {class: "icon", content: Icons["tick"]});
        icon.createChild("span", {content: mdi.label});
        icon.toggleAttribute("selected",mdi.selected === true)

        icon.onclick = async () => {
          if (type == "audiooutput") {
            await WebRTC.selectAudioOutput(mdi.deviceId);
            this.updateDevices();

          } else {
            await WebRTC.replaceTrack(type.replace("input", ""), mdi.deviceId);
            this.updateDevices();
          }
        }
      }
    }
  }

  // async hide(){
  //   console.log("hide");
  //   super.hide(700);
  //   await this.waveTransition((t) =>{
  //     this.align = new Vector(-0.3 * t, 0.5)
  //   }, 700, true);
  // }

  async show(duration = 700, hide = false){
    
    await this.updateDevices();
    super.show(duration, hide);
    await this.waveTransition((t) =>{
      this.align = new Vector(-0.4 * t, 0.5)
    }, duration, hide);
  }
}

class SessionFrame extends SvgPlus {
  async onconnect(){

    this.frameContent = this.innerHTML;
    this.innerHTML = "";

    this.session_content = this.createChild("div", {name: "content"});
    this.pdf = this.session_content.createChild(PdfViewer);

  
    this.web_rtc = this.createChild("div", {name: "webrtc"});
    this.video_widget = this.web_rtc.createChild(VideoCallWidget);
    this.video_call_screen = this.web_rtc.createChild(VideoCallScreen);
    this.tool_bar = this.web_rtc.createChild(ToolBar);
    this.video_widget.addEventListener("move", () => {
      let ypos = -1 * this.video_widget.relativePosition.y;
      this.tool_bar.top = ypos > 0.5;
      console.log(ypos);
      
    });
    this.fileProgress = this.tool_bar.fileProgress;
    this.popup_info = new FloatingBox("popup-info");
    this.popup_info.align = new Vector(0.5, 0.2);
    this.web_rtc.appendChild(this.popup_info);

  
    this.settings_panel = this.web_rtc.createChild(SettingsPanel)


    // this.fileProgress = this.web_rtc.createChild(FileLoadIcon);
    // this.fileProgress.show();



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
    this.tool_bar.file.onclick = () => this.openFile();
    this.tool_bar.left.onclick = () => this.setPage(-1);
    this.tool_bar.right.onclick = () => this.setPage(1);
    this.tool_bar.deletePdf.onclick = () => this.removeFile();
    this.tool_bar.deleteImage.onclick = () => this.removeFile();
    this.tool_bar.settings.onclick = () => {
      this.toggleSettings();
    }
    // this.tool_bar.settings.addEventListener("contextmenu", (e) => {
    // })



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



  async toggleSettings(){
  
    if (this.settings_panel.shown) {
      this.settings_panel.hide()
    } else {
      this.settings_panel.show();
    }
  }


  async toWidget(bool = true){
  
    if (this.widgetShown != bool) {
      this._widgetShown = bool;
      if (bool) {
        await parallel(this.video_call_screen.hide(), this.video_widget.show());
      } else {
        await parallel(this.video_call_screen.show(), this.video_widget.hide());
      }
    }
  }
  get widgetShown(){return this._widgetShown;}
  set widgetShown(bool){
    this.toWidget(bool);
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
      this.feedback_window.renderFeatures(input.features, input.canvas);
      WebRTC.sendData({features: input.features.serialise()})
    } 
  }


  async openFile(){
    let contentFile = await openContent();
    WebRTC.uploadSessionContent(contentFile, (p) => {
      this.fileProgress.progress = p;
    });
    await this.setFile({
      url: contentFile.url,
      page: 1,
      type: contentFile.type.indexOf("pdf") == -1 ? "image" : "pdf"
    });
  }

  removeFile(){
    WebRTC.uploadSessionContent(null);
    this.setFile(null);
  }


  async setFile(contentInfo){
    console.log(contentInfo);
    await this.pdf.updateContentInfo(contentInfo);
    if (this.type === "host") {
      this.tool_bar.updatePDFControls(this.pdf);
    }
    await this.toWidget(this.hasContent)
  }

  setPage(direction, inc = true) {
    if (inc) {
      this.pdf.page += direction;
    } else {
      this.pdf.page = direction;
    }
    if (!WebRTC.isPolite()) {
      WebRTC.changeSessionContentPage(this.pdf.page)
    }
    this.tool_bar.updatePDFControls(this.pdf);
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

      if ("usage" in data) {
        let minutes = data.usage.minutes.remaining;
        if (minutes > 0 && minutes < 5) {
          this.popup_info.innerHTML = "You have less than 5 minutes of usage remaining"
          this.popup_info.waveTransition((t) =>{
            this.popup_info.align = new Vector(0.5, t*0.2)
          }, 700, true);
          this.popup_info.show(700);
          setTimeout(() => {
            this.popup_info.hide(700)
            this.popup_info.waveTransition((t) => {this.popup_info.align = new Vector(0.5, t*0.2)}, 700, false);
          }, 5000)
        }
      }

      if ("contentInfo" in data) {
        this.setFile(data.contentInfo)
      }

      if ("pdf" in data) {
        this.setPage(data.pdf, false)
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
        this.feedback_window.renderFeatures(EyeGaze.deserialiseFeatures(data.features));
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
        if (state.status != "open") {
          this.toWidget(this.hasContent);
        }
      }
      if ("remote" in state && this.type == "host") {
        if ("stream" in state.remote) {
          this.feedback_window.frame.videoStream = state.remote.stream;
        }
      }
      // if ("file" in state) {
      //   this.fileProgress.progress = state.file.progress;
      //   if (state.file.progress == 1) {
      //     // setTimeout(() => this.fileProgress.hide(), 1000);
      //   } else {
      //     this.fileProgress.show();
      //   }
      // }
    }
  }

  get hasContent(){
    return this.pdf.displayType !== null;
  }



  /**
   * @param {Number} state
   */
  set calibration_state_host(state) {
    if (state != this._c_state) {
      console.log(state, this._c_state);
      this._c_state = state;
      console.log(state);
      switch(state) {
        case 0:
          this.widgetShown = this.hasContent;
          console.log(this.hasContent);
          this.feedback_window.hide();
        case 4: // calibrated
          this.widgetShown = true;
          this.pointers.show();
          break;
        case 1: // calibrated and in feedback
          this.widgetShown = true;
          this.pointers.hide();
          this.feedback_window.show();
          break;
        case 2: // not calibrated and calibrating
          this.widgetShown = false;
          this.feedback_window.hide();
          this.loader.setText("calibrating")
          this.loader.show();
          break;
        case 3:
          this.calibration_results();
          this.widgetShown = true;
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
      console.log(this.hasContent);
      await this.toWidget(this.hasContent);

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


  async waitForHost(key, forceParticipant) {
    // Show waiting room
    this.error_frame.innerHTML = "Please wait for the host to start the session.";
    await parallel(this.loader.hide(), this.error_frame.show())
    await WebRTC.waitForHost(key);
    this.joinSession(key, forceParticipant);
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
        if (e.waitForHost === true) {
          this.waitForHost(key, forceParticipant);
        } else {
          this.error_frame.innerHTML = e;
          await parallel(this.loader.hide(), this.error_frame.show())
        }
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
