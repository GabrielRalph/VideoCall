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
const pc = new RTCPeerConnection(config);

let selfVideo = null;
let remoteVideo = null;

export function start(svid, rvid, stream) {
  selfVideo = svid;
  remoteVideo = rvid;
  if (signaler.key) {
    // try {
      // const stream = await navigator.mediaDevices.getUserMedia(constraints);

      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }
      selfVideo.srcObject = stream;
    // } catch (err) {
    //   console.error(err);
    // }
  } else {
    console.log("signal server not connected");
  }
}

pc.ontrack = ({ track, streams }) => {
  console.log("track received");
  track.onunmute = () => {
    if (remoteVideo.srcObject) {
      return;
    }
    console.log("track set");
    remoteVideo.srcObject = streams[0];
  };
};

let makingOffer = false;

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
  console.log(pc.iceConnectionState);
  if (pc.iceConnectionState === "failed") {
    pc.restartIce();
  } else if (pc.iceConnectionState === "disconnected") {
    remoteVideo.srcObject = null;
    if (!signaler.polite) {
      pc.restartIce();
    }

  }
};

pc.onicecandidate = ({ candidate }) => {
  console.log("candidate -->");
  signaler.send({ candidate });
}

let ignoreOffer = false;

signaler.onmessage = async ({ data: { description, candidate } }) => {
  // console.log(signaler.polite ? "polite" : "impolite");
  try {
    if (description) {
      console.log("description <-- " + description.type);
      const offerCollision =
        description.type === "offer" &&
        (makingOffer || pc.signalingState !== "stable");

      ignoreOffer = !signaler.polite && offerCollision;
      if (ignoreOffer) {
        console.log("ignored");
        return;
      }

      await pc.setRemoteDescription(description);
      if (description.type === "offer") {
        await pc.setLocalDescription();
        signaler.send({ description: pc.localDescription });
      }
    } else if (candidate) {
      try {
        await pc.addIceCandidate(candidate);
        console.log("candidate <--");
      } catch (err) {
        if (!ignoreOffer) {
          throw err;
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
};
