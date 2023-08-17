import { configuration } from "./Config.js";
import { getRefFromDb, getMeeting, dbRef, get, set, child, onValue, onChildAdded, onChildRemoved, remove } from "./Firebase.js";
import { eventListenerGen, randomString } from "./misc.js";

let peerConnection = null;
let localStream = null;
let remoteStream = null;

// create meeting id as a random string of length 10
let meetingId = randomString(10);

let isParticipant = false;

function hideElement(elementId) {
  document.getElementById(elementId).style.display = "none";
}

// initialise button listeners
function init() {
  eventListenerGen('#cameraBtn', openUserMedia);
  eventListenerGen('#leaveBtn', leaveMeeting);
  eventListenerGen('#createBtn', createMeeting);
  eventListenerGen('#joinBtn', joinMeeting);
  hideElement("joinDialog");
  hideElement("connectingView");
}

// create meeting
async function createMeeting() {
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;

  const meetingRef = getRefFromDb(`meetings/${meetingId}`);

  console.log('Create PeerConnection with configuration: ', configuration);
  peerConnection = new RTCPeerConnection(configuration);

  registerPeerConnectionListeners();

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // collecting ICE candidates
  peerConnection.addEventListener('icecandidate', event => {
    if (!event.candidate) {
      console.log('Got final candidate!');
      return;
    }
    console.log('Got candidate: ', event.candidate);

    // create candidate id as string of length 8
    let hostCandidateId = randomString(8);
    let hostCandidateRef = getRefFromDb(`meetings/${meetingId}/hostCandidates/${hostCandidateId}`)
    set(hostCandidateRef, event.candidate.toJSON());
  });

  // creating a meeting
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  console.log('Created offer:', offer);

  let rtdbOfferRef = getRefFromDb(`meetings/${meetingId}/offer`);

  const meetingOffer = {
    type: offer.type,
    sdp: offer.sdp,
  };

  await set(rtdbOfferRef, meetingOffer);

  console.log(`New meeting created with SDP offer. meeting ID: ${meetingId}`);

  document.querySelector(
      '#currentMeeting').innerText = `Meeting ID: ${meetingId} - You are the host!`;

  peerConnection.addEventListener('track', event => {
    console.log('Got remote track:', event.streams[0]);
    event.streams[0].getTracks().forEach(track => {
      console.log('Add a track to the remoteStream:', track);
      remoteStream.addTrack(track);
    });
  });

  let answerRef = getRefFromDb(`meetings/${meetingId}/answer`);

  // Listening for remote session description
  onValue(answerRef, async (snapshot) => {
    const data = snapshot.val();
    
    // if (!peerConnection.currentRemoteDescription && data) {
    if (data) {
      console.log('Got remote description: ', data);
      const rtcSessionDescription = new RTCSessionDescription(data);
      await peerConnection.setRemoteDescription(rtcSessionDescription);
    }
  })

  // Listen for remote ICE candidates
  let rtdbParticipantCandidatesRef = getRefFromDb(`meetings/${meetingId}/participantCandidates`);
  onChildAdded(rtdbParticipantCandidatesRef, async (snapshot) => {
    let data = snapshot.val();
    console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
    await peerConnection.addIceCandidate(new RTCIceCandidate(data));
  })

  // onChildRemoved(rtdbParticipantCandidatesRef, async (snapshot) => {
  //   let data = snapshot.val();
  //   console.log(`Removed remote ICE candidate: ${JSON.stringify(data)}`);
  //   await peerConnection.removeIceCandidate(new RTCIceCandidate(data));
  // })
}

function joinMeeting() {
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;

  document.querySelector('#confirmJoinBtn').
    addEventListener('click', async () => {
      meetingId = document.querySelector('#meeting-id').value;
      console.log('Join meeting: ', meetingId);
      document.querySelector(
          '#currentMeeting').innerText = `Meeting ID: ${meetingId} - You are the participant!`;
      await joinMeetingById(meetingId);
    }, {once: true});

  document.querySelector('#cancelJoinBtn').
    addEventListener('click', async () => {
      document.querySelector('#createBtn').disabled = false;
      document.querySelector('#joinBtn').disabled = false;
      document.getElementById("joinDialog").style.display = "none";
    }, {once: true});
  document.getElementById("joinDialog").style.display = "block";
}

async function joinMeetingById(meetingId) {
  let snapshot = await getMeeting(meetingId);

  document.getElementById("joinDialog").style.display = "none";
  document.getElementById("connectingView").style.display = "block";
  console.log('Got meeting:', snapshot.exists());

  if (snapshot.exists()) {
    console.log('Create PeerConnection with configuration: ', configuration);
    peerConnection = new RTCPeerConnection(configuration);
    registerPeerConnectionListeners();
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  
    // collecting ICE candidates
    peerConnection.addEventListener('icecandidate', event => {
      if (!event.candidate) {
        console.log('Got final candidate!');
        return;
      }
      console.log('Got candidate: ', event.candidate);
      let participantCandidateId = randomString(8);
      const rtdbParticipantCandidateRef = getRefFromDb(`meetings/${meetingId}/participantCandidates/${participantCandidateId}`);
      set(rtdbParticipantCandidateRef, event.candidate.toJSON());
    });
  
    peerConnection.addEventListener('track', event => {
      console.log('Got remote track:', event.streams[0]);
      event.streams[0].getTracks().forEach(track => {
        console.log('Add a track to the remoteStream:', track);
        remoteStream.addTrack(track);
      });
    });

    
  
    // creating SDP answer
    // const offerSnapshot = await get(child(dbRef, `meetings/${meetingId}/offer`));

    // if (offerSnapshot.exists()) {
      let data = snapshot.val().offer;
      console.log('Got offer:', data);

      await peerConnection.setRemoteDescription(new RTCSessionDescription(data));

      // peer connection answer is not cleared properly
      const answer = await peerConnection.createAnswer();
      console.log('Created answer:', answer);
      await peerConnection.setLocalDescription(answer);
  
      let meetingWithAnswerRef = getRefFromDb(`meetings/${meetingId}/answer`);
  
      const meetingWithAnswer = {
          type: answer.type,
          sdp: answer.sdp,
      };
  
      await set(meetingWithAnswerRef, meetingWithAnswer);
    // } else {
    //   console.log("No data available");
    // };
  
    // Listening for remote ICE candidates
    let rtdbHostCandidatesRef = getRefFromDb(`meetings/${meetingId}/hostCandidates`);

    onChildAdded(rtdbHostCandidatesRef, async (snapshot) => {
      let data = snapshot.val();
      console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
      await peerConnection.addIceCandidate(new RTCIceCandidate(data));

      document.getElementById("connectingView").style.display = "none";

      isParticipant = true;
    });
  }
}

async function openUserMedia(e) {
  const stream = await navigator.mediaDevices.getUserMedia(
      {video: true, audio: true});
  document.querySelector('#localVideo').srcObject = stream;
  localStream = stream;
  remoteStream = new MediaStream();
  document.querySelector('#remoteVideo').srcObject = remoteStream;

  console.log('Stream:', document.querySelector('#localVideo').srcObject);
  document.querySelector('#cameraBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = false;
  document.querySelector('#createBtn').disabled = false;
  document.querySelector('#leaveBtn').disabled = false;
}

function stopLocalTracks() {
  const tracks = document.querySelector('#localVideo').srcObject.getTracks();
  tracks.forEach(track => {
    track.stop();
  });
}

// cleanup elements for fresh start
function cleanupAfterLeaving() {
  document.querySelector('#localVideo').srcObject = null;
  document.querySelector('#remoteVideo').srcObject = null;
  document.querySelector('#cameraBtn').disabled = false;
  document.querySelector('#joinBtn').disabled = true;
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#leaveBtn').disabled = true;
  document.querySelector('#currentMeeting').innerText = '';
}

// remove ref at a particular address
async function removeRefAt(address) {
  const givenRef = getRefFromDb(address);
  await remove(givenRef);
}

// leave a meeting
async function leaveMeeting(e) {
  console.log(isParticipant);

  if (isParticipant) {
    participantLeavesMeeting(e)
  } else {
    hostLeavesMeeting(e);
  }
}

// participant leaves meeting
async function participantLeavesMeeting(e) {
  stopLocalTracks();

  cleanupAfterLeaving();

  // delete candidates and answer on hangup
  if (meetingId) await removeRefAt(`meetings/${meetingId}/participantCandidates`);
  if (meetingId) await removeRefAt(`meetings/${meetingId}/answer`);

  document.location.reload(true);
}

// host leaves a meeting
async function hostLeavesMeeting(e) {
  stopLocalTracks();

  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
  }

  if (peerConnection) {
    peerConnection.close();
  }

  cleanupAfterLeaving();

  // delete meeting on hangup
  if (meetingId) await removeRefAt(`meetings/${meetingId}`);

  document.location.reload(true);
}

// register the peer connection listeners
function registerPeerConnectionListeners() {
  peerConnection.addEventListener('icegatheringstatechange', () => {
    console.log(
        `ICE gathering state changed: ${peerConnection.iceGatheringState}`);
  });

  peerConnection.addEventListener('connectionstatechange', () => {
    let connectionState = peerConnection.connectionState;
    console.log(`Connection state change: ${connectionState}`);

    // if connection 'disconnected'
    if (connectionState === 'disconnected') {
      document.querySelector('#remoteVideo').srcObject = null;
    }

    // if connection 'failed'
    // if (connectionState === 'failed') {
    //   // peerConnection.
    // }
  });

  peerConnection.addEventListener('signalingstatechange', () => {
    console.log(`Signaling state change: ${peerConnection.signalingState}`);
  });

  peerConnection.addEventListener('iceconnectionstatechange ', () => {
    console.log(
        `ICE connection state change: ${peerConnection.iceConnectionState}`);
  });
}

init();
