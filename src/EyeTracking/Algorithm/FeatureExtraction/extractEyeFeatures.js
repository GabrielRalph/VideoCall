import {Vector3, Vector} from "./vector3.js"

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Default Parameters ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
const WIDTH = 20;
const HEIGHT = 10;
const H2T = 0.5;         // Represents the ratio of the height of the eye to the center
const BLINKRATIO = 0.17; // If the distance from the top of the eye to the bottom (height)
                         // is less than the width of the eye times the blink ratio
                         // the feature extraction will fail
const MINSIZERATIO = 0.9 // If the width of the eye is less than the min size ratio
                         // times the fixed width and height feature extraction
                         // will fail

/** Extract Eye Features, given the eye points object determines a 3D bounding box
    and extracts pixel information from the provided canvas.
 * @param {FacePoints} eyePoints (see FacePointIdxs in FaceMesh.js)
 * @param {HTMLCanvasElement} canvas
 * @param {Number} w Width of eye box in pixels (defaults to WIDTH)
 * @param {Number} w Height of eye box in pixels (defaults to HEIGHT)
 * @returns {Features} (See below for definition)
*/
/*
Features {
  right/left: {
    pixels: [Number], Gray scale pixel data for left eye
    box: {
      topLeft: Vector, bottomLeft: Vector, bottomRight: Vector, topRight: Vector,
      eyeTop: Vector, eyeBottom: Vector,
      warning: string, i.e. if blinking, no eye detected or the eyes are too small
    }
  },
  errors: string, comma seperated list of all errors detected
}
*/
export function extractEyeFeatures(facePoints, canvas, w = WIDTH, h = HEIGHT) {
 let features = {};
 let errors = [];
 try {
   for (let key of ["left", "right"]) {
     let eyeBox = {warning: "not detected"};
     let eyePixels = null;
     let pkey = key + "eye";

     if (pkey in facePoints) {
       eyeBox = getEyeBoundingBox(facePoints[pkey], h/w, w * MINSIZERATIO);
       eyePixels = extractEyeBoxPixels(eyeBox, canvas, w, h);
       eyePixels = equalizeHistogram(eyePixels, 5);
       eyePixels = im2double(eyePixels);
     }

     features[key] = {
       box: eyeBox,
       pixels: eyePixels
     }
     if (eyeBox.warning) errors.push(`The ${key} eye is ${eyeBox.warning}`);
   }
   if (errors.length != 0) features.errors = errors.join(", ");
 } catch (e) {
   console.log(e);
   features.errors = e;
 }

 return features;
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Helper Functions ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Pre Processing ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
let CA = document.createElement("canvas");
let CTX = CA.getContext("2d", {willReadFrequently: true});

function grayscale(pixels){
  let {width, height} = pixels;
  pixels = pixels.data;
  var gray = new Uint8ClampedArray(pixels.length >> 2);
  var p = 0;
  var w = 0;
  for (var i = 0; i < height; i++) {
    for (var j = 0; j < width; j++) {
      var value = pixels[w] * 0.299 + pixels[w + 1] * 0.587 + pixels[w + 2] * 0.114;
      gray[p++] = value;

      w += 4;
    }
  }
  gray.width = width;
  gray.height = height;
  gray.render = (canvas) => renderGray(gray, canvas, 1);
  return gray;
};

function equalizeHistogram (src, step = 5) {
  var srcLength = src.length;
  let dst = src;
  if (!step) step = 5;

  // Compute histogram and histogram sum:
  var hist = Array(256).fill(0);

  for (var i = 0; i < srcLength; i += step) {
    ++hist[src[i]];
  }

  // Compute integral histogram:
  var norm = 255 * step / srcLength,
  prev = 0;
  for (var i = 0; i < 256; ++i) {
    var h = hist[i];
    prev = h += prev;
    hist[i] = h * norm; // For non-integer src: ~~(h * norm + 0.5);
  }

  // Equalize image:
  for (var i = 0; i < srcLength; ++i) {
    dst[i] = hist[src[i]];
  }
  return dst;
};

function im2double(utf8){
 let norms = [];
 for (let val of utf8) {
   norms.push(val/255);
 }
 norms.width = utf8.width;
 norms.height = utf8.height;
 norms.render = (canvas) => renderGray(norms, canvas, 255);
 return norms;
}

export function renderGray(gray, canvas, mult) {
  if (typeof gray === "string") gray = decodeUTF8(gray);
  let ctx = canvas.getContext('2d');
  let [w, h] = [WIDTH, HEIGHT];
  canvas.width = w;
  canvas.height = h;
  let data = new Uint8ClampedArray(gray.length * 4);

  for (let i = 0; i < gray.length; i++) {
    data[i*4] = gray[i] * mult;
    data[i*4 + 1] = gray[i] * mult;
    data[i*4 + 2] = gray[i] * mult;
    data[i*4 + 3] = 255;
  }

  ctx.putImageData(new ImageData(data, w, h), 0, 0);
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Eye Box Extraction ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
function extractEyeBoxPixels(eyeBox, canvas, w = WIDTH, h = HEIGHT) {
  CA.height = canvas.height;
  CA.width = canvas.width;
  let {topLeft, topRight, bottomLeft} = eyeBox;
  let lr = topRight.sub(topLeft);
  let angle = Math.atan(Math.abs(lr.y)/Math.abs(lr.x));
  if (lr.y > 0) angle *= -1;

  let ws = w/lr.norm();
  let hs = h/topLeft.dist(bottomLeft);
  CTX.resetTransform();
  CTX.scale(ws, hs);
  CTX.rotate(angle);
  CTX.translate(-topLeft.x, -topLeft.y);
  CTX.drawImage(canvas, 0, 0);
  CTX.save();
  let data = CTX.getImageData(0, 0, w, h);

  let gray = grayscale(data, w, h);
  return gray;
}

// Given the points on the top, bottom, left and right of the eye find the cor
function getEyeBoundingBox(eyePoints, w2h, minW, h2t = H2T){
  let {left, right, top, bottom} = eyePoints
  let warning = null;
  let lr = right.v3d.sub(left.v3d);
  let tb = bottom.v3d.sub(top.v3d);

  let w = lr.norm();
  let h = w * w2h;
  let tbn = tb.norm();

  if (tbn < w * BLINKRATIO) warning = 'blinking'
  if (w < minW) warning = 'to small'

  // Transform lr and tb by the y angle and z angle of lr
  // such that lr runs only along the x axis
  let ay = Math.atan(lr.z / lr.x);
  // console.log(Math.round(ay * 180/Math.PI) + "deg");
  let lr_ = lr.rotateY(ay);
  let tb_ = tb.rotateY(ay);
  let az = Math.atan(lr_.y / lr_.x);
  lr_ = lr_.rotateZ(-az);
  tb_ = tb_.rotateZ(-az);

  // set the transformed tb vector's x compent to 0 making it perpendicular
  // with the transformed lr vector
  tb_.x = 0;

  // transform tb back
  let tbr = tb_.rotateZ(az).rotateY(-ay);
  let up = tbr.dir().mul(h * h2t);
  let down = tbr.dir().mul(h - h*h2t);

  // return 2d vectors with stored 3d vectors
  let x13 = left.v3d.sub(up);
  let x1 = new Vector(x13);
  x1.v3d = x13;

  let x23 = left.v3d.add(down);
  let x2 = new Vector(x23);
  x2.v3d = x23;

  let x33 = right.v3d.add(down);
  let x3 = new Vector(x33);
  x3.v3d = x33;

  let x43 = right.v3d.sub(up);
  let x4 = new Vector(x43);
  x4.v3d = x43;

  return {topLeft: x1, bottomLeft: x2, bottomRight: x3, topRight: x4, eyeTop: top, eyeBottom: bottom, warning: warning}
}
