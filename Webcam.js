const camParams = {
  video: {
    width: { min: 320, ideal: 640, max: 1920 },
    height: { min: 240, ideal: 480, max: 1080 },
    facingMode: "user",
  },
  audio: true,
};
let Canvas = document.createElement("canvas");
let Ctx = Canvas.getContext("2d", {willReadFrequently: true});
let Video = document.createElement("video");
let Stream = null;
let Process = null;
let webcam_on = false;
var stopCapture = false;
let capturing = false;
let processListeners = [];

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
    window.requestAnimationFrame(resolve);
  })
}

// ~~~~~~~~ PRIVATE METHODS ~~~~~~~~
async function runProcess(){
  let t0 = window.performance.now();
  captureFrame();
  let t1 = window.performance.now();
  let input = {video: Video, canvas: Canvas, context: Ctx};
  input.width = Canvas.width;
  input.height = Canvas.height;
  if (Process instanceof Function){
    try {
      input.result = await Process(input);
    } catch (e) {
      input.error = e;
    }
  }
  let pd = window.performance.now();
  input.times = {start: t0, capture: t1, process: pd}

  for (let listener of processListeners) {
    try {
      listener(input);
    } catch (e) {
      console.log(e);
    }
  }

  return input;
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

// ~~~~~~~~ PUBLIC METHODS ~~~~~~~~
export function setProcess(algorithm){
  if (algorithm instanceof Function) {
    Process = algorithm;
  }
}

export async function startWebcam(params = camParams){
  if (webcam_on) stopWebcam();
  webcam_on = false;
  try {
    setUserMediaVariable();
    // Get the users video media stream
    let stream = await navigator.mediaDevices.getUserMedia( params );
    if (!stream) {
      webcam_off = false;
      throw 'no stream'
    }
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
    return true
  } catch (e) {
    console.log(e);
    webcam_on = false;
  }
  console.log(webcam_on);
  return webcam_on;
}

export function stopWebcam(){
  try {
    for (let track of Stream.getTracks()) {
      track.stop();
    }
  } catch(e) {}
  stopProcessing();
  webcam_on = false;
}

export async function startProcessing(){
  if (capturing) return;
  capturing = true;
  while (!stopCapture) {
    // console.log(stopCapture);
    await parallel(runProcess(), nextFrame());
  }
  capturing = false;
  stopCapture = false;
}

export function stopProcessing() {
  // console.log("stop result");
  stopCapture = true;
}

export function addProcessListener(listener) {
  if (listener instanceof Function) {
    processListeners.push(listener);
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

export function getStream(){return Stream;}
