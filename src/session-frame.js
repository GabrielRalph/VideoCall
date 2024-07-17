import {SvgPlus, Vector} from "./SvgPlus/4.js"
import {WaveyCircleLoader, CopyIcon, FileLoadIcon} from "./Utilities/animation-icons.js"
import {FloatingBox, HideShow, ConstantAspectRatio, SvgResize, POINTERS} from "./Utilities/basic-ui.js"
import {parallel, getCursorPosition, delay} from "./Utilities/usefull-funcs.js"
import {VideoCallScreen, VideoCallWidget} from "./WebRTC/video-call-widget.js"
import * as WebRTC from "./WebRTC/webrtc.js"
import {Icons} from "./Utilities/icons.js"
import * as EyeGaze from "./EyeTracking/Algorithm/EyeGaze.js"
import {CalibrationFrame} from "./EyeTracking/UI/calibration-frame.js"
import {FeedbackFrame} from "./EyeTracking/UI/feedback-frame.js"
import {PdfViewer} from "./PDF/pdf-viewer.js"
import {getApps, SquidlyApp} from "./Apps/app-library.js"
import { CommunicationBoard } from "./communication-board.js"
import {Messages} from "./messages.js"
const Webcam = EyeGaze.Webcam;

const Apps = getApps();

console.log(Apps);


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

const symbols = /[\r\n%#()<>?[\\\]^`{|}]/g;
function encodeSVG (data) {
  // Use single quotes instead of double to avoid encoding.
  data = data.replace(/"/g, `'`);

  data = data.replace(/>\s{1,}</g, `><`);
  data = data.replace(/\s{2,}/g, ` `);

  // Using encodeURIComponent() as replacement function
  // allows to keep result code readable
  return data.replace(symbols, encodeURIComponent);
}


function setMouseSVG(svg) {
    let svghtml = svg.outerHTML;
    let g = svg.querySelector('g')
    let [pos, size] = g.svgBBox;
    let cursor = new SvgPlus("svg");
    cursor.props = {width: size.x, height: size.y, xmlns: "http://www.w3.org/2000/svg", viewBox: `${pos.x} ${pos.y} ${size.x} ${size.y}`};
    cursor.innerHTML = g.innerHTML;
    let uri = encodeSVG(cursor.outerHTML);
    document.body.style.setProperty("--cursor", `url("data:image/svg+xml,${uri}"), auto`);
}



class ToolBar extends SvgPlus {
  constructor(el = "tool-bar"){
    super(el);

    this.list = this.createChild("div", {class: "tool-bar-list"})


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

    


    this.imute = this.createChild("div", {class: "icon tbs", type: "audio", content: Icons["mute"]});
    this.imute.onclick = () => WebRTC.muteTrack("audio", "local");

    this.ivideo = this.createChild("div", {class: "icon tbs", type: "video", content: Icons["video"]});
    this.ivideo.onclick = () => WebRTC.muteTrack("video", "local");

    
    
    this.calibrate = this.createChild("div", {class: "icon tbs", type: "calibrate", content: Icons["calibrate"]});
    
    this.bubbleHidden = false;
    this.viewBubble = this.createChild("div", {class: "icon tbs", type: "view-bubble", content: Icons["eye"]});
    this.viewBubble.onclick = () => {
      WebRTC.setSessionFieldState("bubbleState", this.bubbleHidden == true ? null : 'hidden');
    }
    
 
    this.share = this.createChild("div", {class: "tbs icon", type: "file"});
    
    this.file = new SvgPlus("div");
    this.file.props = {class: "tbs icon", type: "file", content: Icons["file"]}
    
    this.screenShare = new SvgPlus("div")
    console.log(Icons.screen);
    this.screenShare.props = {class: "icon tbs", type: "settings", content: Icons.screen};

    this.share.onclick = () => this.showListAt(this.share, [this.file, this.screenShare], "");

    let fl = this.share.createChild(FileLoadIcon);
    fl.shown = true;
    fl.progress = 1;
    fl.props = {class: "icon"};
    this.fileProgress = fl;

    this.more = this.createChild("div", {class: "icon tbs", type: "settings", content: Icons["more"]});
    this.msg = this.createChild("div", {class: "icon tbs", type: "msg", content: Icons["msg"]});
    this.apps = this.createChild("div", {class: "icon tbs", type: "apps", content: Icons["apps"]});
    this.apps.remove();
    this.settings = this.createChild("div", {class: "icon tbs", type: "settings", content: Icons["settings"]});
    this.settings.remove();
    this.msg.remove();
    this.more.onclick = () => this.showListAt(this.more, [this.apps, this.settings, this.msg], "");


    let i4 = this.createChild("div", {class: "icon tbs", type: "end-call", content: Icons["end"]});
    i4.onclick = () => WebRTC.endSession();
    

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

  showListAt(icon, list, style = "middle") {
    console.log(list);
    this.list.innerHTML = "";
    let pos = icon.bbox[0];
    let pos0 = icon.offsetParent.getBoundingClientRect().x
    for (let child of list) 
      this.list.appendChild(child);
    this.list.setAttribute("pos", style)
    this.list.styles = {left: `calc(${pos.x - pos0}px - var(--sp))`}
    this.list.toggleAttribute("shown", true);

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
    } else if (pdf.displayType == "image" || pdf.displayType == "stream") {
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

      if ("bubbleState" in state) {
        if (state.bubbleState === "hidden") {
          this.bubbleHidden = true;
          this.viewBubble.innerHTML = Icons["noeye"];
        } else {
          this.bubbleHidden = false;
          this.viewBubble.innerHTML = Icons["eye"];
        }
      }
    }
  }


  get isMouseOver(){
    let e = getCursorPosition();
    let list = this.list.bbox[1].y
    if (this.top) return e.y < (this.range + list);
    else return e.y > (window.innerHeight - this.range - list)
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
      if (!toshow) this.list.toggleAttribute("shown", false);
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


/** 
 * 
 *  MouseSelection
 * 
 */
class MouseSelection extends SvgPlus {
  constructor(){
    super("div");

    this.type = '01';
    this.class = "mouse-icons"
    this.createChild("b", {content: "Select Cursor Icon"})
    this.r1 = this.createChild("div");
    this.r2 = this.createChild("div");
    this.update2();

  }


  update2(){
    let {r2, r1} = this;
    r2.innerHTML = "";
    r1.innerHTML = "";
    [0, 1, 2].forEach(a => {
      let i = r1.createChild("svg", {viewBox: "0 0 25 25"}).createChild(POINTERS.cursor);
      i.position = new Vector((25 - 11.4)/2, (25-15.5)/2);
      i.type = "0" + a;
      i.shown = true;
      let s = i.parentNode;
      if (a+"" === this.type[1]) s.toggleAttribute("selected", true);
      s.onclick = () => {
        this.type = this.type[0] + a;
        this.update2();
      }
    });
    [0, 1, 2].forEach(a => {
      let  i = r2.createChild("svg", {viewBox: "0 0 52 52"}).createChild(POINTERS.cursor);
      i.position = new Vector((52 - 11.4*(1+a))/2, (52-15.5*(1+a))/2);
      i.type = a + this.type[1];
      i.shown = true;
      let s = i.parentNode;
      if (a+"" === this.type[0]) s.toggleAttribute("selected", true);
      s.onclick = () => {
        this.type = a + this.type[1];
        this.update2();
      }
    });

    setMouseSVG(this.r2.children[parseInt(this.type[0])]);
    // const blob = new Blob([svghtml],{type: 'image/svg+xml'});
    // var a = new FileReader();
    // a.onload = (e) => {
    // }
    // a.readAsDataURL(blob);
   
  }
}


/** 
 * 
 *  App Panel
 * 
 */
class AppsPanel extends SvgPlus{
  constructor(){
    super("apps-panel");
    this.appShown = false;
    let title = this.createChild("div", {class: "title"});
    title.createChild("div", {
      class: "icon", 
      type: "close-app",
      content: Icons.back,
      events: {
        click: () => {
          const event = new Event("close-app", {bubbles: true});
          this.dispatchEvent(event);
        }
      }
    })
    let titleText = title.createChild("div", {content: "Apps"});
    let close = title.createChild("div", {class: "icon", content: Icons["close"]});
    this.close = close;

    this.titleText = titleText;

    this.main = this.createChild("div", {class: "main-items"});
    this.main.innerHTML = "Coming Soon"
  }

  renderApps() {
    this.removeAttribute("app");
    this.titleText.innerHTML = "Apps"
    this.main.innerHTML = "";
    let icons = this.main.createChild("div", {class: "icons-container"})
    for (let appName in Apps) {

      let appEntry = icons.createChild("div", {class: "app-entry"})
      
      let wrapper = appEntry.createChild("div", {
        class: "icon-wrapper",
        events: {
          click: () => {
            console.log("here");
            const event = new CustomEvent("app-selection", {bubbles: true});
            event.appName = appName;
            this.dispatchEvent(event);
          }
        }
      })
      wrapper.appendChild(Apps[appName].appIcon);
      
      let details = appEntry.createChild("div", {class: "app-details"})
      details.createChild("div", {class: "app-name", content: appName});
      details.createChild("div", {class: "app-description", content: Apps[appName].description})

      

    }
  }

  set app(app) {
    this.setAttribute("app", app.constructor.name)
    this.titleText.innerHTML = app.constructor.name;
    this.appShown = app.sideWindow != null;
    if (app.sideWindow != null) {
      this.main.innerHTML = "";
      this.main.appendChild(app.sideWindow);
    }
  }
}

/** 
 * 
 *  Settings Panel
 * 
 */
class SettingsPanel extends SvgPlus{
  constructor(){
    super("settings-panel");
    let title = this.createChild("div", {class: "title"});
    title.createChild("div", {content: "Settings"});
    let close = title.createChild("div", {class: "icon", content: Icons["close"]});
    this.close = close;

    this.main = this.createChild("div", {class: "main-items"});

    let sessionFrame = () => document.querySelector("session-frame");
    let viewControls = this.main.createChild("div");
    let my = viewControls.createChild("div", {class: "my-view"});
    my.createChild("b", {content: "My View"});
    this.views = my.createChild("div", {class: "views"});
    this.views.createChild("div", {class: "icon", content: Icons["v-widget"]}).onclick = () => sessionFrame().setView(null);
    this.views.createChild("div", {class: "icon", content: Icons["v-top"], view: "top"}).onclick = () => sessionFrame().setView("top");
    this.views.createChild("div", {class: "icon", content: Icons["v-side"], view: "side"}).onclick = () => sessionFrame().setView("side");
    
    let pv = viewControls.createChild("div", {class: "participant-view"});
    pv.createChild("b", {content: "Participants View"});
    let v2 = pv.createChild("div", {class: "views"});
    v2.createChild("div", {class: "icon", content: Icons["v-widget"]}).onclick = () => sessionFrame().setView(null, true);
    v2.createChild("div", {class: "icon", content: Icons["v-top"], view: "top"}).onclick = () => sessionFrame().setView("top", true);
    v2.createChild("div", {class: "icon", content: Icons["v-side"], view: "side"}).onclick = () => sessionFrame().setView("side", true);
    
    this.mouseSelection = this.main.createChild(MouseSelection);
    this.devicesList = this.main.createChild("div", {class: "device"});

    
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

}

/** 
 * 
 *  Session View
 * 
 */
class SessionView extends HideShow {
  constructor(){
    super("session-view")
    let rel = this.createChild("div", {class: "rel"});


    /* Content View  */
    let splitContent = rel.createChild("div", {class: "split-content"});
    let rel2 = splitContent.createChild("div", {class: "rel"});

    this.communicationBoard = this.createChild(CommunicationBoard)
    let contentView = new ConstantAspectRatio("div");
    contentView.aspectRatio = 1.2;
    contentView.class = "content-view"
    contentView.watchAspectRatio();
    rel2.appendChild(contentView);

    this.content_view = contentView;
    let mainContentView = contentView.createChild("div");
    this.pdf = mainContentView.createChild(PdfViewer);
    this.widget = rel.createChild(VideoCallWidget);
    this.widget.shown = true;
    this.feedback_window = mainContentView.createChild(FeedbackWindow);
    this.feedback_window.align = "center";
    this.main_app_window = mainContentView.createChild("div", {class: "main-app-window"});

    contentView.createChild("div", {class: "overlay top"})
    contentView.createChild("div", {class: "overlay bottom"})
    contentView.createChild("div", {class: "overlay left"})
    contentView.createChild("div", {class: "overlay right"})


    let splitWidget = rel.createChild(VideoCallScreen);
    splitWidget.shown = true;
    splitWidget.class = "split-widget"
    let pullTab = splitWidget.createChild("div", {class: "pull-tab"})

   
    /* Default View */
    let defaultView = rel.createChild(VideoCallScreen);
    defaultView.class = "default-view"
    defaultView.watchAspectRatio();
    this.default_view = defaultView;

    let pointers = rel.createChild(SvgResize);
    pointers.styles = {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      "z-index": 3000,
      "pointer-events": "none"
    }

    this.cursors = rel.createChild(SvgResize);
    this.cursors.styles = pointers.styles;
    this.cursors.start();
    this.cursor = this.cursors.createPointer("cursor");
    this.cursor.shown = true;

    this.grid = pointers.createGrid();
    this.grid.shown = true;
    this.blob = pointers.createPointer("blob", 50);
    this.blob.shown = true;
    this.pointers = pointers;

    this.tool_bar = rel.createChild(ToolBar);



    let offset = 0;
    let sidePull = false;
    window.addEventListener("mousemove", (e) => {
      let [pos, size] = pullTab.bbox;
      let {x, y} = e;
      if (x > pos.x - size.x/2 && x < pos.x + 2*size.x && y > pos.y && y < pos.y + size.y) {
        if (e.buttons == 1) {
          sidePull = true;
        }
      }



      if (sidePull == true){
        let st = window.getComputedStyle(splitWidget);

        let gap = parseFloat(st["gap"]);


        let size = splitWidget.bbox[1];
        let width0 = size.x - offset;

        let maxh = size.y - 3 * gap;

        let v1 = splitWidget.v1.bbox[1];
        let v2 = splitWidget.v2.bbox[1];
        let h = v1.y + v2.y;
        let w = v1.x;

        let maxoffset = maxh * w/h - width0 + 3 * gap;
        offset -= e.movementX
        
       
        if (offset < 0) offset = 0;
        if (offset > maxoffset) offset = maxoffset;
        this.styles = {"--side-offset": offset + "px"}
      }
    })

    window.addEventListener("mouseup", () => {
      sidePull = false

    });

    window.addEventListener("mouseleave", () => {
      sidePull = false

    });

    this.widget.addEventListener("move", () => {
      let ypos = -1 * this.widget.relativePosition.y;
      this.tool_bar.top = this.widget.offsetParent != null && ypos > 0.5;
      
    });
  }

  async toContentView(bool = true){
    if (this.contentShown != bool) {
      this._contentShown = bool;
      this.toggleAttribute("content", bool)
      if (bool) {
        await parallel(this.default_view.hide(), this.content_view.show());
      } else {
        await parallel(this.default_view.show(), this.cursors.hide(), this.content_view.hide());
      }
    }
  }
  get contentShown(){return this._contentShown;}
  set contentShown(bool){
    this.toContentView(bool);
  }

}

/*
<session-frame>
  <main>
    <rel>
    
    </rel>
  </main>

  <side-window>
  </side-window>
</session-frame>
*/
class SessionFrame extends SvgPlus {
  async onconnect(){
    this.lambda = 0.6;
    this.frameContent = this.innerHTML;
    this.innerHTML = "";
    let rel = this.createChild("div", {class: "rel"})
    let session_view = rel.createChild(SessionView);
    this.side_window = rel.createChild("side-window");

    this.session_view = session_view;
    this.tool_bar = session_view.tool_bar;
    this.pdf = session_view.pdf;
    this.feedback_window = session_view.feedback_window;
    this.pointers = session_view.pointers;
    this.blob = session_view.blob;
    this.grid = session_view.grid;
    this.cursor = session_view.cursor;
    this.cursors = session_view.cursors;
    this.default_view = session_view.default_view;
    this.content_view = session_view.content_view;
    this.main_app_window = session_view.main_app_window;
    this.communicationBoard = session_view.communicationBoard;

    this.content_view.addEventListener("aspect-ratio", (e) => {
      if (this.type === "participant")
        WebRTC.setSessionFieldState("aspectRatio", e.aspectRatio);
    })


    this.addEventListener("app-selection", (e) => {
      console.log(e);
      this.openApp(e.appName)
    })

    this.addEventListener("close-app", (e) => {
      this.closeApp()
    })
 
    this.fileProgress = this.tool_bar.fileProgress;
    this.popup_info = new FloatingBox("popup-info");
    this.popup_info.align = new Vector(0.5, 0.2);
    rel.appendChild(this.popup_info);

    
    this.apps_panel = new AppsPanel();
    this.messages = new Messages();
    this.apps_panel.renderApps();
    this.apps_panel.close.onclick = () =>  this.hideInSideWindow("apps");
    this.settings_panel = new SettingsPanel();
    this.settings_panel.close.onclick = () => this.hideInSideWindow("settings");
    this.side_window_items = {
      settings: this.settings_panel,
      apps: this.apps_panel,
      messages: this.messages
    }

    this.calibration_frame = rel.createChild(CalibrationFrame);
    this.feedback_window.continue.onclick = () => this.calibrate();
    this.feedback_window.cancel.onclick = () => this.cancel_calibration();

    this.loader = rel.createChild(WaveyCircleLoader);
    this.loader.styles = {width: "30%"};
    this.loader.align = "center";
    this.loader.shown = true;

    this.error_frame = new FloatingBox("error-frame");
    this.error_frame.align = "center";
    this.error_frame.styles = {"font-size": "3em", "text-align": "center"};
    this.appendChild(this.error_frame);

    this.tool_bar.calibrate.onclick = () => this.start_calibration();
    this.tool_bar.file.onclick = () => this.openFile();

    this.tool_bar.left.onclick = () => this.setPage(-1);
    this.tool_bar.right.onclick = () => this.setPage(1);
    this.tool_bar.deletePdf.onclick = () => this.removeFile();
    this.tool_bar.deleteImage.onclick = () => this.removeFile();
    this.tool_bar.apps.onclick = () => this.showInSideWindow("apps");
    this.tool_bar.settings.onclick = () => {
      this.settings_panel.updateDevices();
      this.showInSideWindow("settings")
    }
    this.tool_bar.msg.onclick = () => this.showInSideWindow("messages");

    this.tool_bar.screenShare.onclick = () => this.shareScreen();


    this.mouse_change = false;
    this.mouse_event = null;
    window.addEventListener("mousemove", (e) => {
        this.mouse_event = e;
        this.mouse_change = true;
    })
    this.updateMouse();


    this.addEventListener("transform", (e) => {
      WebRTC.setSessionFieldState("contentTransform", e.transform);
    })


    WebRTC.addDataListener(this);
    WebRTC.addStateListener(this);
    Webcam.addProcessListener((e) => this.onEyePosition(e));

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

  

  _updateApp(info) {
    console.log(info);
    if (info != null) {
      let {name, sender} = info
      if (name in Apps) {

        let appClass = Apps[name];
        
        // A different App is open, close it
        if (!(this.squidlyApp instanceof appClass)) {
          console.log("remove app");
          this._removeApp();
        }
  
        // No app is open so open the correct app
        if (!(this.squidlyApp instanceof SquidlyApp)) {
            console.log("add app");
            try {
              let app = new appClass(sender == this.type, (a)=>WebRTC.addAppDatabase(appClass.name, a));
              this.squidlyApp = app;
              console.log(app);
            
              this.apps_panel.app = app;
              this.tool_bar.toggleAttribute("app-shown", this.apps_panel.appShown)
              let main = app.mainWindow;
              if (main !== null) {
                this.main_app_window.appendChild(main);
              }
              
              this.session_view.toContentView();
            } catch(e) {
              console.log(e);
            }

        // The correct App is open so update its data
        } 
        // else {
        //   this.squidlyApp.data = data;
        // }
      } 
    } else {
      this._removeApp();
    }
  }

  _removeApp(){
    console.log("remove");
    if (this.squidlyApp instanceof SquidlyApp) this.squidlyApp.close();
    this.tool_bar.toggleAttribute("app-shown", false);
    if (this.type == "participant") {
      console.log("here");
      this.hideInSideWindow("apps");
    }
    this.apps_panel.renderApps();
    this.main_app_window.innerHTML = "";
    this.squidlyApp = null;
    console.log(this.hasContent);
    this.session_view.toContentView(this.hasContent);
  }


  openApp(appName){
    console.log("opening app", appName);
    WebRTC.setSessionFieldState("appInfo", {
      name: appName,
      sender: this.type,
      data: ""
    })
  }

  closeApp() {
    console.log("close");
    WebRTC.setSessionFieldState("appInfo", null);
  }



  async shareScreen() {
    
    if (await WebRTC.updateShareScreen()) {
      WebRTC.setSessionFieldState("content", {type: "stream", url: "stream"})
      this.setFile({type: "stream", url: "stream"})
      // this.pdf.video.srcObject = ss.stream;
      // ss.stream.oninactive = () => {
      //   WebRTC.setSessionFieldState(null);
      //   this.setFile(null);
      // }
    }
  }

  async updateMouse(){
    while(true){
      this.onMouseMove()
      this.mouse_change = false;
      await delay()
    }
  }



  async hideInSideWindow(name) {
    if (name in this.side_window_items) {
      let window = this.side_window_items[name];
      if (this.side_window.contains(window)) {
        if (this.side_window.children.length == 1 && this._side_open) {
          await this.toggleSideWindow(false);
        }
        window.remove();
      } else {
        // this.showInSideWindow(name);
      }
    }
  }

  showInSideWindow(name) {
    if (name in this.side_window_items) {
      let window = this.side_window_items[name];
      if (!this.side_window.contains(window)) {
        if (this.side_window.children.length == 2) {
          this.side_window.children[0].remove();
        }
        this.side_window.appendChild(window);
        if (!this._side_open) {
          this.toggleSideWindow(true);
        }
      } else {
        this.hideInSideWindow(name);
      }
    }
  }

  async toggleSideWindow(bool = !this._side_open) {
    this._side_open = bool;
    await this.waveTransition((t) => {
      this.styles = {"--side-window-percent": t}
    }, 250, bool);
  }



  /* Broadcast mouse position relative to content if user is host.
  */ 
  onMouseMove(e = this.mouse_event){
      if (e != null && this.hasContent && this.type == "host") {
        try {
          let mouse = new Vector(e);
          let bbox = this.referenceBBox;
          let rel = mouse.sub(bbox[0]).div(bbox[1]);
          let type = this.settings_panel.mouseSelection.type;
          if (this.mouse_change) {
            WebRTC.sendData({mouse: {x: rel.x, y: rel.y, type: type}})
          }
        } catch(e) {
        }
      }
  }

  setCursor(rel) {
    this.cursors.show();
    this.cursor.type = rel.type;
    let [pos, size] = this.referenceBBox;
    let absolute = size.mul(rel).add(pos);
    this.cursor.position = absolute
  }

  onEyePosition(input) {
    let {result} = input;
    let lambda = this.lambda;

    if (result) {
      let {x, y} = result;
      // console.log(x,y);
      if (typeof this.ex !== "number") this.ex = x;
      if (typeof this.ey !== "number") this.ey = y;

      this.ey = this.ey * (1 - lambda) + y * lambda;
      this.ex = this.ex * (1 - lambda) + x * lambda;

      x = this.ex;
      y = this.ey;
      if (x > 1) x = 1;
      if (x < 0) x = 0;
      if (y > 1) y = 1;
      if (y < 0) y = 0;


      let [pos, size] = this.bbox;
      let screen = (new Vector(x, y)).mul(size).add(pos);

      if (this.blob.shown) {
        if (this.squidlyApp instanceof SquidlyApp) {
          this.squidlyApp.eyeData = screen;
        }
        this.communicationBoard.eyePosition = screen;
      }
      let [pdfPos, pdfSize] = this.referenceBBox;
      let rel2content = screen.sub(pdfPos).div(pdfSize);
      this.blob.position = screen.sub(this.pointers.bbox[0]);
      WebRTC.sendData({eye: {x: rel2content.x, y: rel2content.y}})
    }

    WebRTC.sendData({calibrating: this._calibrating})
    if (this._calibrating == 1 && input.features) {
      this.feedback_window.renderFeatures(input.features, input.canvas);
      WebRTC.sendData({features: input.features.serialise()})
    } 
  }

  async openFile(){
    WebRTC.closeShare();
    let contentFile = await openContent();
    WebRTC.uploadSessionContent(contentFile, (p) => {
      this.fileProgress.progress = p;
    });
    this.pdf.resetTransform();
    await this.setFile({
      url: contentFile.url,
      page: 1,
      type: contentFile.type.indexOf("pdf") == -1 ? "image" : "pdf"
    });
  }

  removeFile(){
    WebRTC.closeShare();
    WebRTC.uploadSessionContent(null);
    this.setFile(null);
  }

  async setFile(contentInfo){
    await this.pdf.updateContentInfo(contentInfo);
    if (this.type === "host") {
      this.tool_bar.updatePDFControls(this.pdf);
    }
    await this.session_view.toContentView(this.hasContent)
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

  get referenceBBox(){
    return this.content_view.bbox;
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

      if ("calibrating" in data) {
       this.calibration_state_host = data.calibrating;
      }

      if ("calibration_results" in data) {
        if (typeof data.calibration_results === 'string') {
          this.calibration_frame.showMessage(data.calibration_results);
        } else {
          this.calibration_frame.std = data.calibration_results;
        }
      }

      if ("mouse" in data) {
        this.setCursor(data.mouse);
      }

      if ("eye" in data) {
        let [pos, size] = this.referenceBBox;
        let rel = (new Vector(data.eye)).mul(size).add(pos);
        this.blob.position = rel.sub(this.pointers.bbox[0]);
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
        if (state.type == "participant") {
          this.settings_panel.mouseSelection.remove();
        } else {
          this.pdf.transformable = true;
        }
        this.type = state.type;
        this.setAttribute("user-type", state.type)
      }
      if ("status" in state) {
        if (state.status == "started") this.tool_bar.active = true;
        this.loader.show(400, state.status == "open");
        if (state.status == "open") {
          // if (this.type == "host") WebRTC.refreshShare();
          // if (this.type == "participant") WebRTC.closeShare();
        } else {
          this.session_view.toContentView(this.hasContent);
        } 
      }
      if ("remote" in state && this.type == "host") {
        if ("stream" in state.remote) {
          this.feedback_window.frame.videoStream = state.remote.stream;
        }
      }

      if ("contentInfo" in state) {
        if (this.type == "host" && state.contentInfo.type == "stream") {
          this.removeFile();
        } else {
          this.setFile(state.contentInfo);
        }
      }

      if ("bubbleState" in state) {
        this.blob.shown = state.bubbleState !== "hidden";
      }

      if ("contentTransform" in state) {
        this.pdf.contentTransform = state.contentTransform;
      }

      if ("participantView" in state) {
        if (this.type == "participant") {
          this._view = [state.participantView, ""]
        } else {
          this._view = [state.participantView, "p-"]
        }
      }

      if ("aspectRatio" in state) {
        this.content_view.aspectRatio = parseFloat(state.aspectRatio);
      }

      if ("screenStream" in state) {
        console.log(state.screenStream);
        if (state.screenStream == null) {
          this.removeFile()
        } else {
          this.pdf.video.srcObject = state.screenStream;
        }
      }

      if ("appInfo" in state) {
        this._updateApp(state.appInfo)
      }

     
    }
  }


  set _view(p) {
    let [view, value] = p;
    if (view != null && value == "") {
      this.tool_bar.top = false
    } 
    this.setAttribute(value + "view", view);
    if (view == null) this.removeAttribute(value + "view");
  }
  setView(view, user = null) {
    if (this.type == "participant" || (this.type == "host" && user != null)) {
      WebRTC.setSessionFieldState("participantView", view)
    } else {
      this._view = [view, ""]
    }
  }

  get hasContent(){
    return this.pdf.displayType !== null || this.squidlyApp instanceof SquidlyApp;
  }

  /**
   * @param {Number} state
   */
  set calibration_state_host(state) {
    if (state != this._c_state) {
      this._c_state = state;
      switch(state) {
        case 0:
          this.session_view.contentShown = this.hasContent;
          this.feedback_window.hide();
          break;
        case 4: // calibrated
          this.session_view.contentShown = true;
          this.pointers.show();
          this.feedback_window.hide();
          break;
        case 1: // calibrated and in feedback
          this.session_view.contentShown = true;
          this.pointers.hide();
          this.feedback_window.show();
          this.loader.hide();
          break;
        case 2: // not calibrated and calibrating
          this.session_view.contentShown = false;
          this.feedback_window.hide();
          this.loader.setText("calibrating")
          this.loader.show();
          break;
        case 3:
          this.calibration_results();
          this.session_view.contentShown = true;
          break;
      }
    }
  }

  get calibration_state_host(){
    return this._c_state;
  }


  async start_calibration(){
    if (this.type == "host") {
      WebRTC.sendData({calibrate: 1})
    } else if (this._calibrating != 1){
      this._calibrating = 1;
      Webcam.startProcessing();
      await parallel(this.session_view.toContentView(), this.pointers.hide());
      await this.feedback_window.show();
    }
  }

  async cancel_calibration(){
    if (this.type == "host") {
      WebRTC.sendData({calibrate: 0})
    } else {
      this._calibrating = this._calibrated === true ? 4 : 0;
      await this.feedback_window.hide();
      if (this._calibrated === true) this.pointers.show();
      await this.session_view.toContentView(this.hasContent || this._calibrated === true);
    }
  }

  async calibrate(){
    if (this.type == "host") {
      WebRTC.sendData({calibrate: 2})
    } else if (this._calibrating == 1){
      await this.feedback_window.hide();
      this._calibrating = 2;
      await this.calibration_frame.show();
      try {
        await this.calibration_frame.calibrate();
        this._calibrating = 3;
        WebRTC.sendData({calibration_results: this.calibration_frame.std});
        await this.calibration_frame.show_results();
        await this.calibration_frame.hide();
        this._calibrating = 4;
        this._calibrated = true;
        this.pointers.start();
        await this.pointers.show();
      } catch (e) {
        console.log(e);
        WebRTC.sendData({calibration_results: "Error during calibration please try again."});
        await this.calibration_frame.showMessage("Error during calibration please try again.")
        await delay(3000);
        this._calibrating = 1;
        this.feedback_window.show();
        this.calibration_frame.hide();
      }
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
        this.default_view.show();
        this.session_view.show();
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
