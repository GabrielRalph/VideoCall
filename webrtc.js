import {SignalingChannel} from "./firebase.js"
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

export const signaler = new SignalingChannel();
let pc;
let makingOffer = false;
function createPC(){
  pc = new RTCPeerConnection(config);
  pc.ondatachannel = receiveChannelCallback;

  pc.ontrack = ({ track, streams }) => {
    console.log("track received");
    track.onunmute = () => {
      let update = {
        remote_stream: streams[0],
      };
      updateHandler(update);
    };
  };


  pc.onnegotiationneeded = async () => {
    console.log("negotiation needed");
    try {
      makingOffer = true;
      await pc.setLocalDescription();
      console.log("description --> " + pc.localDescription.type);
      signaler.send({ description: pc.localDescription });
    } catch (err) {
      console.error(err);
    } finally {
      makingOffer = false;
    }
  };

  pc.oniceconnectionstatechange = () => {
    let update = {
      negotiation_state: pc.iceConnectionState
    }
    updateHandler(update);
    console.log(pc.iceConnectionState);
    if (pc.iceConnectionState === "failed") {
      pc.restartIce();
    } else if (pc.iceConnectionState == "connected"){
      // signaler.clearInfo();
      startMessageChannel();
    } else if (pc.iceConnectionState === "disconnected") {
      // remoteVideo.srcObject = null;
      // if (!signaler.polite) {
        pc.restartIce();
        signaler.restart();
        // }
      }
    };

  pc.onicecandidate = ({ candidate }) => {
    console.log("candidate -->");
    signaler.send({ candidate });
  }


}
createPC();

let onUpdateHandler = () => {};
function updateHandler(update){
  onUpdateHandler(update);
};
let sendChannel;
let receiveChannel;

function receiveChannelCallback(event) {
  receiveChannel = event.channel;
  receiveChannel.onmessage = handleReceiveMessage;
  receiveChannel.onopen = handleReceiveChannelStatusChange;
  receiveChannel.onclose = handleReceiveChannelStatusChange;
}
function handleReceiveMessage(event) {
  let update = {
    data: event.data,
  }
  updateHandler(update);
  console.log(event.data);
}


export function sendMessage(message) {
  if (sendChannel && sendChannel.readyState == "open") {
    sendChannel.send(message);
  }
}
function handleReceiveChannelStatusChange(event) {
  if (receiveChannel) {
    let update = {
      receive_data_channel_state: receiveChannel.readyState,
    }
    updateHandler(update);
    if (receiveChannel.readyState == "closed") {
      // if (!signaler.polite) {
        // signaler.clearInfo();
        // signaler.clearInfo(signaler.userType);
      // }
    }
    // console.log(
    //   `Receive channel's status has changed to ${receiveChannel.readyState}`,
    // );
  }
}
function handleSendChannelStatusChange(event) {
  if (sendChannel) {
    const state = sendChannel.readyState;
    let update = {
      send_data_channel_state: state,
    }
    updateHandler(update)
  }
}

function startMessageChannel(){
  sendChannel = pc.createDataChannel("sendChannel");
  sendChannel.onopen = handleSendChannelStatusChange;
  sendChannel.onclose = handleSendChannelStatusChange;
}

export function start(onupdate, stream) {
  if (signaler.key) {
    if (onupdate instanceof Function) onUpdateHandler = onupdate;

    console.log(window.location.origin + "/?" + signaler.key);
    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }
  } else {
    console.log("signal server not connected");
  }
}

let ignoreOffer = false;

signaler.onmessage = async ({ data: { description, candidate } }) => {
  // console.log(signalessr.polite ? "polite" : "impolite");
  try {
    if (description) {
      console.log("description <-- " + description.type);
      console.log(pc.signalingState);
      const offerCollision =
      description.type === "offer" &&
      (makingOffer || pc.signalingState !== "stable");

      ignoreOffer = !signaler.polite && offerCollision;
      if (ignoreOffer) {
        console.log("ignored");
        return;
      }
      try {
        // if (signaler.polite && pc.signalingState == "has-local-")
        await pc.setRemoteDescription(description);
        if (description.type === "offer") {
          await pc.setLocalDescription();
          signaler.send({ description: pc.localDescription });
        }
      } catch (e) {

        console.log(e, e.code);
        throw `description failure`
      }

    } else if (candidate) {
      try {
        await pc.addIceCandidate(candidate);
        console.log("candidate <--");
      } catch (e) {
        if (!ignoreOffer) {
          console.log(e);
          throw 'candidate failure';
        }
      }
    }
  } catch (e) {


  }
};
