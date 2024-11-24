const camParams2 = {
  video: {
    width: { min: 320, ideal: 640, max: 1920 },
    height: { min: 240, ideal: 480, max: 1080 },
    facingMode: "user",
  },
  audio: {
    noiseSuppression: true,
    echoCancellation: true
  },
};
const camParams1 = {
  video: {
    width: { min: 320, ideal: 640, max: 1920 },
    height: { min: 240, ideal: 480, max: 1080 },
    facingMode: "user",
  },
  audio: false,
};

let Canvas = document.createElement("canvas");
let Ctx = Canvas.getContext("2d", {willReadFrequently: true});
let Video = document.createElement("video");
Video.style.setProperty("opacity", "0");
document.body.prepend(Video);
let Stream = null;
let Stream2 = null;
let webcam_on = false;
var stopCapture = false;
let capturing = false;

let ProcessRunning = {};
let Process = {};
let processListeners = {};

Video.setAttribute("autoplay", "true");
Video.setAttribute("playsinline", "true");
Video.muted = true;
Video.onunmute = () => {
  console.log('xx');
}

// ~~~~~~~~ HELPFULL METHODS ~~~~~~~~
async function parallel() {
  let res = [];
  for (let argument of arguments) {
    res.push(await argument);
  }
  return res;
}

async function nextFrame(){
  return new Promise((resolve, reject) => {
    setTimeout(resolve, 30);
    window.requestAnimationFrame(resolve);
  })
}

// ~~~~~~~~ PRIVATE METHODS ~~~~~~~~
async function runProcess(name = "default"){
  if (name in Process) {
    let input = {video: Video, canvas: Canvas, context: Ctx};
    input.width = Canvas.width;
    input.height = Canvas.height;
    if (Process[name] instanceof Function){
      try {
        input.result = await Process[name](input);
      } catch (e) {
        input.error = e;
      }
    }
    // let pd = window.performance.now();
    // input.times = {start: t0, capture: t1, process: pd}
    for (let listener of processListeners[name]) {
      try {
        listener(input);
      } catch (e) {
        console.log(e);
      }
    }
  }

}

function captureFrame(){
  Canvas.width = Video.videoWidth;
  Canvas.height = Video.videoHeight;

  let {width, height} = Canvas;

  Ctx.drawImage(Video, 0, 0, Canvas.width, Canvas.height);
}

function setUserMediaVariable(){
  if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
  }

  if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = async (constraints) => {

      // gets the alternative old getUserMedia is possible
      var getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

      // set an error message if browser doesn't support getUserMedia
      if (!getUserMedia) {
        return Promise.reject(new Error("Unfortunately, your browser does not support access to the webcam through the getUserMedia API. Try to use the latest version of Google Chrome, Mozilla Firefox, Opera, or Microsoft Edge instead."));
      }

      // uses navigator.getUserMedia for older browsers
      return new Promise((resolve, reject) => {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    }
  }
}

function isRunning(){
  for (let key in ProcessRunning) {
    if (processListeners[key]) return true;
  }
  return falsek
}

async function runProcessingLoop(){
  if (capturing) {
    if (stopCapture) stopCapture = false;
    return;
  }
  capturing = true;
  let lastTime = -1
  while (!stopCapture) {
    await nextFrame();
    let {currentTime} = Video;
    if (currentTime != lastTime) {
      captureFrame();
      let proms = Object.keys(ProcessRunning)
      .map(k => [k, ProcessRunning[k]])
      .filter(([k, v]) => v)
      .map(a => runProcess(a[0]));
      await parallel(...proms);
    }
    lastTime = currentTime;
  }
  capturing = false;
  stopCapture = false;
}

let Filter = null;
let AudioContext = null;
function createAudioFilteredStream(stream, bandrange = [60, 1000]){
  if (!stream) return
  // Separate the audio and video tracks
  const audioTracks = stream.getAudioTracks();
  const videoTracks = stream.getVideoTracks();

  if (audioTracks.length === 0) {
    console.warn("Error filtering audop: No audio tracks found in the stream.");
    return;
  }

  // Create an AudioContext for processing audio
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (!audioContext) {
    console.warn("Audio context not found");
    return;
  }
  AudioContext = audioContext;

  // Create a MediaStreamSource from the audio track
  const audioSource = audioContext.createMediaStreamSource(new MediaStream(audioTracks));
  
  // Create a bandpass filter
  // Configure High-Pass Filter
  const highPass = audioContext.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.setValueAtTime(200, audioContext.currentTime);

  // Configure Low-Pass Filter
  const lowPass = audioContext.createBiquadFilter();
  lowPass.type = "lowpass";
  lowPass.frequency.setValueAtTime(3000, audioContext.currentTime);

  // Configure Compressor
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-50, audioContext.currentTime);
  compressor.knee.setValueAtTime(40, audioContext.currentTime);
  compressor.ratio.setValueAtTime(4, audioContext.currentTime);
  compressor.attack.setValueAtTime(0.01, audioContext.currentTime);
  compressor.release.setValueAtTime(0.1, audioContext.currentTime);

  // Connect nodes
  audioSource.connect(highPass);
  highPass.connect(lowPass);
  // lowPass.connect(compressor)

  // Connect the source to the filter and then to the destination
  const audioDestination = audioContext.createMediaStreamDestination();
  lowPass.connect(audioDestination);

  // Create a new MediaStream with the original video tracks and the filtered audio track
  const processedStream = new MediaStream();
  videoTracks.forEach(track => processedStream.addTrack(track)); // Add video tracks
  audioDestination.stream.getAudioTracks().forEach(track => processedStream.addTrack(track)); // Add filtered audio track

  return processedStream
}

window.adjustFilter = (mid, q) => {
  Filter.frequency.setValueAtTime(mid, AudioContext.currentTime); 
  Filter.Q.setValueAtTime(q, AudioContext.currentTime); 
}

// ~~~~~~~~ PUBLIC METHODS ~~~~~~~~

export function setProcess(algorithm, name = "default"){
  if (algorithm instanceof Function) {
    Process[name] = algorithm;
    processListeners[name] = [];
    ProcessRunning[name] = false;
  }
}

export async function startWebcam(params = camParams1){
  if (webcam_on) {
    return true;
  }
  webcam_on = false;
  try {
    setUserMediaVariable();
    // Get the users video media stream
    let stream = await navigator.mediaDevices.getUserMedia( params );
    let stream2 = await navigator.mediaDevices.getUserMedia( camParams2 );
    stream2 = createAudioFilteredStream(stream2);
    if (!stream) {
      webcam_off = false;
      throw 'no stream'
    }
    Stream = stream;
    Stream2 = stream2;
    Video.srcObject = stream;

    webcam_on = await new Promise((resolve, reject) => {
      let onload = () => {
        webcam_on = true;
        Video.removeEventListener("loadeddata", onload);
        resolve(true)
      };
      Video.addEventListener("loadeddata", onload);
    });
  } catch (e) {
    console.log(e);
    webcam_on = false;
  }
  console.log(Process);
  if (webcam_on && isRunning()) {
    runProcessingLoop();
  }

  return webcam_on;
}

export function stopWebcam(){
  try {
    for (let track of Stream.getTracks()) {
      track.stop();
    }
  } catch(e) {}
  stopProcessingAll();
  webcam_on = false;
}


export function startProcessing(name = "default") {
  if (name in ProcessRunning) {

    ProcessRunning[name] = true;

    if (!capturing && webcam_on) {
      runProcessingLoop();
    }
  }
}

export function stopProcessing(name = "default") {
  ProcessRunning[name] = false;
  if (!isRunning()) stopCapture = true;
}

export function addProcessListener(listener, name = "default") {
  if (listener instanceof Function) {
    if (!(name in processListeners)) processListeners[name] = []
    processListeners[name].push(listener);
  }
}

export function copyFrame(destinationCanvas) {
  destinationCanvas.width = Canvas.width;
  destinationCanvas.height = Canvas.height;
  let destCtx = destinationCanvas.getContext('2d');
  destCtx.drawImage(Canvas, 0, 0);
}

export function isOn(){return webcam_on;}

export function isProcessing(){return capturing;}

export function getStream(i) {
  if (i == 2) {
    return Stream2;
  } else {
    return Stream;
  }
}

export async function setStream(stream) {
  Stream = stream;
  Video.srcObject = stream;
  return new Promise((resolve, reject) => {
    let onload = () => {
      webcam_on = true;
      Video.removeEventListener("loadeddata", onload);
      resolve(true)
    };
    Video.addEventListener("loadeddata", onload);
  });
}

export async function getTrackSelection(type) {
  let devices = [...await navigator.mediaDevices.enumerateDevices()]
  return devices;
}
