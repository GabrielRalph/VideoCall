import * as FaceMesh from "./FeatureExtraction/FaceMesh.js"
import {extractEyeFeatures} from "./FeatureExtraction/extractEyeFeatures.js"
import * as Webcam from "../../Utilities/Webcam.js"
import ModelLibrary from "./Models/ModelLibrary.js"

const SampleMethods = {
  "steady": "head is kept still whilst calibrating",
  "moving": "head is moving whilst calibrating",
}
let Models = null;
let I = 0;
let Meta = false;
window.addEventListener("keydown", (e) => {
  console.log(e.key, Meta);
  if (e.key == "Meta") {
    Meta = true;
    setTimeout(3000, () => {Meta = false})
  } else if (Meta && e.key == "m") {
    console.log("Change Model");
    if (Models) {
      let keys = Object.keys(Models)
      let n = keys.length;
      I = (I + 1) % n;
      console.log("Model " + keys[I]);
    }
    e.preventDefault();
  }
})
window.addEventListener("keyup", (e) => {
  if (e.key == "Meta") Meta = false;
})


let SampleData = [];
let MethodID = null;
let is_sampling = false;
let GetScreenPosition = null;


function sample(features) {
  if (is_sampling && GetScreenPosition instanceof Function) {
    features.method = MethodID;
    // console.log(features);
    SampleData.push({X: features, y: GetScreenPosition()})
  }
}
function processFrame(input) {
  let points = FaceMesh.getFacePointsFromVideo(input.video);
  input.points = points;

  let features = extractEyeFeatures(points, input.canvas);
  input.features = features;

  if (features.errors) {
    // console.log(features.errors);
    throw features.errors;
  }

  sample(features);

  let position = predictScreenPosition(features);
  // console.log(position);
  return position;
}

export function trainModel(sampleRate = 0.8){
  Webcam.stopProcessing();
  Models = {};
  let stats = [];
  for (let model in ModelLibrary) {
    Models[model] = new ModelLibrary[model].model();
    stats.push(Models[model].trainAndValidate(SampleData, sampleRate));
  }
  Webcam.startProcessing();
  SampleData = [];
  return stats;
}
function predictScreenPosition(X, kfilter = true) {
  let y = null;
  if (Models) {
    try {
      let model = Models[Object.keys(Models)[I]];
      y = model.predictAndFilter(X);
    } catch(e) {console.log(e);}
  }
  return y;
}

export function startSampling(methodID){
  if (methodID in SampleMethods) {
    MethodID = methodID;
    is_sampling = true;
  } else {
    throw "not a valid sampling method"
  }
}
export function stopSampling(){
  is_sampling = false;
}
export function setCalibrationPositionGetter(posGetter) {
  if (posGetter instanceof Function) {
    GetScreenPosition = posGetter;
  }
}

Webcam.setProcess((input) => processFrame(input));

let load = FaceMesh.load;
export {Webcam, load}
