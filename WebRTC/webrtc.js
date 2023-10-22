import {RTCSignaler} from "../Firebase/firebase.js"
import {SvgPlus, HideShow, Vector} from "../Utilities/basic-ui.js"
import {Icons} from "../assets/icons.js"
import {CopyIcon} from "../copy-icon.js"
import {elementAtCursor, getCursorPosition} from "../Utilities/usefull-funcs.js"
function makeKeyLink(key, option = null) {
  let {origin, pathname} = window.location;
  if (typeof option === "string") option = `.${option}`;
  else option = "";
  return `${origin}${pathname}?${key}${option}`
}

const config = {
    iceServers: [
      {
        urls: [
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
        ],
      },
    ],
    iceCandidatePoolSize: 10,
};

let remoteContentStatus = {
  video: null,
  audio: null,
  data_send: null,
  data_receive: null,
  ice_state: null,
  sent: null,
  recv: null,
}
function isStatusReady(){
  let {video, audio, data_send, data_receive, ice_state} = remoteContentStatus;
  return video && audio && data_send == "open" && data_receive == "open" && ice_state == "connected";
}

let localStream = null;
let remoteStream = null;

let sendChannel;
let receiveChannel;

let onUpdateHandler = () => {};

let pc = new RTCPeerConnection(config);
pc.ondatachannel = receiveChannelCallback;
pc.ontrack = ontrackadded
pc.onnegotiationneeded = onnegotiationneeded;
pc.oniceconnectionstatechange = oniceconnectionstatechange;
pc.onicecandidate = onicecandidate;

window.show_rtc_base = true;
function rtc_base_log(str) {
    if (window.show_rtc_base) {
      console.log("%c\t" + str, 'color: #bada55');
    }
}
function rtc_log_state() {
  let {video, audio, data_send, data_receive, ice_state, sent, recv} = remoteContentStatus;
  let cc = (val) => `color: ${val ? "green" : "red"}`
  data_send = data_send == "open";
  data_receive = data_receive == "open";
  ice_state = ice_state == "connected";
  console.log("%cvid %caud %cin %cout %cice %csent %crecv", cc(video), cc(audio), cc(data_receive), cc(data_send), cc(ice_state), cc(sent), cc(recv));
}
function rtc_l1_log(str) {
  console.log("%c" + str, 'color: #00a3fd');
}


let widgets = [];
function addWidget(widget) {
  widgets.push(widget);
}

function widgetUpdate(widget_update) {
  for (let widget of widgets) {
    widget.state = widget_update;
  }
}


function muteTrack(track = "auido", source = "local", bool = null) {
  let res = null;
  if (localStream && source == "local") {
    let tracks = localStream[`get${track[0].toUpperCase() + track.slice(1)}Tracks`]();
    let t = tracks[0];
    if (bool == null) bool = t.enabled;
    t.enabled = !bool;
    let msg = {};
    msg[track + "_muted"] = bool;
    widgetUpdate({local: msg})
    sendMessage(msg);
    res = bool;
  } else if (source == "remote" && sessionState == "open") {
    let msg = {};
    msg["request_"+track+"_muted"] = true;
    sendMessage(msg);
  }
  return res;
}
function muteTrackRequest(type) {
  console.log("requested mute " + type);
  let track = localStream[`get${type[0].toUpperCase() + type.slice(1)}Tracks`]()[0];
  if (track.enabled) {
    muteTrack(type)
  }
}

export async function makeSession() {
  let key = await RTCSignaler.make();
  return key;
}
window.makeSession = makeSession;

export async function start(key, stream, onupdate, forceParticipant){
  ended = false;
  await RTCSignaler.join(key, onSignalerReceive, forceParticipant)
  remoteStream = null;
  localStream = stream;
  if (onupdate instanceof Function) onUpdateHandler = onupdate;
  startMessageChannel();
  for (const track of stream.getTracks()) {
    pc.addTrack(track, stream);
  }
  widgetUpdate({
    type: getUserType(),
    local: {
      stream: localStream,
      audio_muted: !localStream.getAudioTracks()[0].enabled,
      video_muted: !localStream.getVideoTracks()[0].enabled,
    }
  })
  updateHandler("status")
}

export function getUserType(){
  return RTCSignaler.getUserType();
}

let sessionState = "closed";
let ended = false;
function updateHandler(type, data){
  console.log(ended);
  if (ended) return;

  let new_update = null;
  let widget_update = null;
  if (type == "state") {
    if (data == "ended") {
      ended = true;
      new_update = {status: "ended"}
      rtc_l1_log("ended");

    }
    // Session is open and has now started
    // Send message to remote caller telling them we are open
    if (sessionState == "closed" && isStatusReady()) {
      sendMessage({request_status: true});
      remoteContentStatus.sent = true;

    // Session has closed
    } else if (sessionState == "open") {
      sessionState = "closed";
      remoteContentStatus.sent = false;
      remoteContentStatus.recv = false;
      new_update = {status: "closed"};
      widget_update = {remote: {stream: null}}

      rtc_l1_log("closed");
    }
    rtc_log_state();

  // Data has been received from the remote caller
  } else if (type == "data") {
    // If the session is open
    if ("request_status" in data) {
      sendMessage({
        status_result: true,
        audio_muted: !localStream.getAudioTracks()[0].enabled,
        video_muted: !localStream.getVideoTracks()[0].enabled,
      });
    } else if ("status_result" in data) {
      sessionState = "open"
      remoteContentStatus.recv = true;
      data.remote_stream = remoteStream;
      widget_update = {remote: {stream: remoteStream}};
      data.status = "open";
      rtc_log_state();
      rtc_l1_log("open");
    }


    for (let key of ["video", "audio"]) {
      let wkey = key+"_muted"
      if (wkey in data) {
        if (widget_update == null) widget_update = {remote: {}};
        widget_update.remote[wkey] = data[wkey];
      }
      let rkey = "request_"+wkey;
      if (rkey in data) {
        muteTrackRequest(key);
      }
    }

    if (sessionState == "open"){
      new_update = data;
    }
  }


  widgetUpdate(widget_update);
  if (new_update != null) {
    onUpdateHandler(new_update)
  }
}

// WebRTC negotiation event handlers
let makingOffer = false;
let ignoreOffer = false;
async function onSignalerReceive({ data: { description, candidate, session_ended } }) {
  try {
    if (session_ended) {
      updateHandler("state", "ended")
    }else if (description) {
      rtc_base_log("description <-- " + description.type);
      rtc_base_log(pc.signalingState);
      const offerCollision =
      description.type === "offer" &&
      (makingOffer || pc.signalingState !== "stable");

      ignoreOffer = !RTCSignaler.isPolite() && offerCollision;
      if (ignoreOffer) {
        // console.log("ignored");
        return;
      }
      try {
        // if (signaler.polite && pc.signalingState == "has-local-")
        await pc.setRemoteDescription(description);
        if (description.type === "offer") {
          // console.log("sending");
          await pc.setLocalDescription();
          rtc_base_log("description --> " + pc.localDescription.type);

          RTCSignaler.send({ description: pc.localDescription });
        }
      } catch (e) {

        console.log(e, e.code);
        throw `description failure`
      }

    } else if (candidate) {
      try {
        await pc.addIceCandidate(candidate);
        rtc_base_log("candidate <--");
      } catch (e) {
        if (!ignoreOffer) {
          console.log(e);
          throw 'candidate failure';
        }
      }
    }
  } catch (e) {
  }
}

function onicecandidate(data) {
  rtc_base_log("candidate -->");
  RTCSignaler.send(data);
}

function oniceconnectionstatechange(){
  if (pc.iceConnectionState === "failed") {
    pc.restartIce();
  } else if (pc.iceConnectionState == "connected"){
  } else if (pc.iceConnectionState === "disconnected") {
    sendChannel = null;
  }
  remoteContentStatus.ice_state = pc.iceConnectionState;
  updateHandler("state");
}

async function onnegotiationneeded(){
  rtc_base_log("negotiation needed " );
  try {
    makingOffer = true;
    await pc.setLocalDescription();
    rtc_base_log("description --> " + pc.localDescription.type);
    RTCSignaler.send({ description: pc.localDescription });
  } catch (err) {
    console.error(err);
  } finally {
    makingOffer = false;
  }
}

function ontrackadded({ track, streams }){
  rtc_base_log(`track received ${track.kind} [${streams[0].id.split("-")[0]}]`);
  remoteStream = streams[0];
  track.onunmute = () => {
    rtc_base_log("track unmuted " + track.kind);
    remoteContentStatus[track.kind] = track;
    updateHandler("state");
  };
  track.onmute = () => {
    rtc_base_log("track muted " + track.kind);
    let update = {
      remove_stream: true,
    }
    remoteContentStatus[track.kind] = null;
    updateHandler("state");
  }
}


// WebRTC data channel functions
export function sendMessage(message) {
  if (sendChannel && sendChannel.readyState == "open") {
    sendChannel.send(JSON.stringify(message));
  }
}

function receiveChannelCallback(event) {
  if (sendChannel == null) {
    startMessageChannel();
  }
  receiveChannel = event.channel;
  receiveChannel.onmessage = handleReceiveMessage;
  receiveChannel.onopen = handleReceiveChannelStatusChange;
  receiveChannel.onclose = handleReceiveChannelStatusChange;
}

function handleReceiveMessage(event) {
  updateHandler("data", JSON.parse(event.data));
}

function handleReceiveChannelStatusChange(event) {
  if (receiveChannel) {
    remoteContentStatus.data_receive = receiveChannel.readyState
    updateHandler("state");
  }
}

function handleSendChannelStatusChange(event) {
  if (sendChannel) {
    const state = sendChannel.readyState;
    remoteContentStatus.data_send = state
    if (state == "closed") {
      sendChannel = null;
    }
    updateHandler("state")
  }
}

function startMessageChannel(){
  sendChannel = pc.createDataChannel("sendChannel");
  sendChannel.onopen = handleSendChannelStatusChange;
  sendChannel.onclose = handleSendChannelStatusChange;
}


/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/

class VideoDisplay extends HideShow {
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

  set video_muted(value) {
    if (value === false) {
      this.setIcon("bottomLeft", "video", ()=>this.update("video"));
    } else if (value === true) {
      this.setIcon("bottomLeft", "novideo", ()=>this.update("video"));
    } else {
      this.setIcon("bottomLeft", null);
    }
  }
  set audio_muted(value) {
    if (value === false) {
      this.setIcon("topLeft", "unmute", ()=>this.update("audio"));
    } else if (value === true) {
      this.setIcon("topLeft", "mute", ()=>this.update("audio"));
    } else {
      this.setIcon("topLeft", null);
    }
  }

  update(type) {
    console.log(type, this.type);
    muteTrack(type, this.type);
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

function check_snap(p0, p1) {
  let {innerWidth, innerHeight} = window;
  let crns = [new Vector(0,0), new Vector(innerWidth, 0), new Vector(innerWidth, innerHeight), new Vector(0, innerHeight)];
  let mind = innerWidth*innerWidth;
  let minv = null;
  for (let v of crns) {
    if (v.dist(p1) < mind) {
      mind = v.dist(p1);
      minv = v;
    }
  }
  if (mind < minv.dist(p0) && mind < 20) {
    return minv;
  } else {
    return p1;
  }
}

export class VideoCallWidget extends HideShow {
  constructor() {
    super("div");
    this.class = "v-container";
    this.rel = this.createChild("div", {class: "rel"});
    let a = this.createChild("div", {class: "hs-icon"});
    let hider = a.createChild("div", {class: "hider"});
    hider.createChild("div");
    let ex = a.createChild("div", {class: "tools"})
    ex.createChild("div", {class: "icon", content: Icons["calibrate"]})
    ex.createChild("div", {class: "icon", content: Icons["end"]}).onclick = () => {
      RTCSignaler.remove();
    }
    a.onclick = (e) => {
      let dt = performance.now() - dragend;
      if (dt < 50) {
        e.preventDefault();
      }
    }
    hider.onclick = () => {
      if (!this.hold && !(this.old instanceof Promise)) {
        this.shrinkRel();
      }
    }
    this.video_displays = [this.rel.createChild(VideoDisplay), this.rel.createChild(VideoDisplay)];
    this.icons = ex
    this.hs = a;

    let selected = false;
    let drag = false;
    let dragend = 0;
    let p0 = null;
    let m0 = null;
    let bs = null;
    this.position = [0.5, 3];
    window.addEventListener("mousedown", () => {
      let el = elementAtCursor();
      selected = this.isSameNode(el) || this.contains(el);
      [p0, bs] = this.bbox;
      m0 = new Vector(getCursorPosition());
    })
    window.addEventListener("mousemove", (e) => {
      if (selected && !this.hold) {
        e.preventDefault();
        let [p1, bs] = this.bbox;
        let p = new Vector(e);
        let delta = (new Vector(p)).sub(m0);
        m0 = p;
        if (delta.norm() > 2) {
          drag = true;
          this.toggleAttribute("dragging", true);
          this.moveDelta(delta);
        }
      }
    })
    window.addEventListener("mouseup", (e) => {
      if (drag) {
        dragend = performance.now();
        setTimeout(() => {this.toggleAttribute("dragging", false)}, 50)
        if (this.small) {
          this.setLandscape(true);
        }
      }
      selected = false;
      drag = false;
    })
    window.addEventListener("resize", () => {
      this.position = this._pos;
    })


    let timeout = null;
    let tf = () => {
      let el = elementAtCursor();
      if (!this.isSameNode(el) && !this.contains(el) && !this.hold) {
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

    addWidget(this);
  }

  async setLandscape(bool) {
    let x = this._pos.x/window.innerWidth;
    if (x < 0.2 || x > 0.8) {
      bool = false;
    }

    this.toggleAttribute("notrans", true);
    this.toggleAttribute("landscape", bool)
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        this.toggleAttribute("notrans", false);
        resolve();
      }, 50)
    });
  }
  get landscape(){
    return this.hasAttribute("landscape");
  }
  get small(){
    return this.hasAttribute("small");
  }

  async shrinkRel(){
    if (this.landscape) {
      await this.setLandscape(false);
    }
    this.toggleAttribute("small");
    let [v1, v2] = this.video_displays;
    let sp = window.getComputedStyle(this.rel)["gap"];
    let w0 = v1.bbox[1].x + v2.bbox[1].x + parseFloat(sp);
    let w1 = this.rel.bbox[1].x;
    this.old = this.rel.waveTransition((t) => {
      this.rel.styles = {width: `${w0*t}px`}
      if (t == 1) {
        this.rel.styles = {width: null}
      }
    }, 500, w1 < 5);
    await this.old;
    this.old = null;
    if (w1 > 5) {
      this.setLandscape(true);
    }
  }

  set position(v) {

    v = new Vector(v);
    let {innerWidth, innerHeight} = window;
    if (v.x > 0 && v.x < 1) v.x = v.x * innerWidth;
    if (v.y > 0 && v.y < 1) v.y = v.y * innerHeight;

    let m = 3;
    if (v.x < m) v.x = m;
    if (v.y < m) v.y = m;
    if (v.x > innerWidth - m) v.x = innerWidth - m;
    if (v.y > innerHeight - m) v.y = innerHeight - m;
    let trns = v.sub(m).div(innerWidth-2*m, innerHeight-2*m).mul(-100);
    this.styles = {
      top: `${v.y}px`,
      left: `${v.x}px`,
      transform: `translate(${trns.x}%, ${trns.y}%)`
    }
    this._pos = v;
  }
  moveDelta(delta) {
    delta = new Vector(delta);
    let bs = this.bbox[1];
    let {innerWidth, innerHeight} = window;

    let p0 = this._pos;


    // let f0 = p0.sub(p0.div(innerWidth, innerHeight).mul(bs));
    // let f1 = f0.add(delta);
    let a = bs.div(innerWidth, innerHeight);
    let denom = (new Vector(1)).sub(a);
    let deltaAd = delta.div(denom);
    // console.log(deltaAd);
    let newPos = this._pos.add(deltaAd);
    if (newPos.x < 1) newPos.x = 1;
    if (newPos.y < 1) newPos.y = 1;
    this.position = check_snap(p0, newPos);
  }

  makeKey(){
    let keyi = new CopyIcon();
    this.icons.prepend(keyi);
    keyi.text = RTCSignaler.getKey();
    keyi.value = makeKeyLink(RTCSignaler.getKey());
    keyi.onclick = async () => {
      this.hold = true;
      await keyi.showText();
      this.hold = false;
    }

  }

  set state(obj){
    if (obj == null) return;
    if ("type" in obj) {
      this.setAttribute("type", obj.type)
      console.log(obj.type);
      let [ri, li] = [0, 1];
      if (obj.type == "host") {
        this.makeKey();
        [ri, li] = [1, 0];
      }
      this.videos = {
        remote: this.video_displays[ri],
        local: this.video_displays[li],
      }
      this.videos.remote.type = "remote";
      this.videos.local.type = "local";
      this.videos.local.video.muted = true;

      if (!this.shown) this.show();
    }

    for (let key in obj) {
      let vinfo = obj[key];
      if (key in this.videos) {
        if ("stream" in vinfo) this.setSrc(key, vinfo.stream)
        for (let k of ["video_muted", "audio_muted"]) {
          if (k in vinfo) {
            this.videos[key][k] = vinfo[k];
          }
        }
      }
    }
  }

  setIcon(name, location, iconName, cb) {
    this.videos[name].setIcon(location, iconName, cb);
  }

  setSrc(name, src) {
    this.videos[name].srcObject = src;
    this.videos[name].shown = src !== null;
  }
  getSrc(name) {
    return this.videos[name].srcObject;
  }
}
