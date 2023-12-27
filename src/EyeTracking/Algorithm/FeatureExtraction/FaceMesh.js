import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0"
import {Vector, Vector3} from "./vector3.js"
const {FaceLandmarker, FilesetResolver} = vision;

let runningMode = "VIDEO";

const FacePointIdxs = {
  leftMost: 226,
  rightMost: 446,
  righteye: {
    left: 130,
    right: 173,
    top: 159,
    bottom: 145,
    border: [112, 26, 22, 23, 24, 110, 25, 33, 246, 161, 160, 159, 158, 157, 173, 243],
    pupil: [468],
    iris: [469, 470, 471, 472],
    all: [112, 26, 22, 23, 24, 110, 25, 33, 246, 161, 160, 159, 158, 157, 173, 243, 469, 470, 471, 472, 468]
  },
  lefteye: {
    top: 386,
    bottom: 374,
    left: 398,
    right: 359,
    border: [463, 398, 384, 385, 386, 387, 388, 466, 263, 255, 339, 254, 253, 252, 256, 341],
    pupil: [473],
    iris: [474, 475, 476, 477],
    all: [463, 398, 384, 385, 386, 387, 388, 466, 263, 255, 339, 254, 253, 252, 256, 341, 474, 475, 476, 477, 473]
  },
  plane: [168, 112, 26, 22, 23, 24, 110, 25, 33, 246, 161, 160, 159, 158, 157, 173, 243, 205, 425, 200, 463, 398, 384, 385, 386, 387, 388, 466, 263, 255, 339, 254, 253, 252, 256, 341]
}
// Gets face landmark points as 2D and 3D vectors (3D vectors stored in 2D vectors
// under the key "v3d") scaled to the dimension of the webcamera. Object returned
// as per FacePointIdxs with indicies replaced with the points predicted.
function getFacePoints(prediction, width, height) {
  let data = null;
  try{
    let points = prediction.faceLandmarks[0];
    data = {};
    let size = new Vector(width, height);

    // ~~~ scaling in 3d ~~~~~
    let s3d = new Vector3(size.x,size.y,width);

    // convert all points vector objects
    let vecs = points.map((v) => {
      let v2d = new Vector(v);
      v2d = v2d.mul(size);

      // 3D vectors stored in 2D vector under key v3d
      v2d.v3d = (new Vector3(v.x, v.y, v.z)).mul(s3d);
      return v2d;
    });

    data.width = width;
    data.height = height;
    data.all = vecs;
    data.size = size;
    data.size3d = s3d;
    let recset = (n, copy) => {
      if (n !== null && typeof n === "object") {
        for (let key in n) {
          let value = null;
          let old = n[key];
          if (typeof old == 'number' && old > 0 && old < vecs.length) {
            value = vecs[old];
          } else if (Array.isArray(old)){
            value = [];
            for (let oi = 0; oi < old.length; oi++) {
              let i = old[oi];
              if (typeof i == 'number' && i > 0 && i < vecs.length) {
                value.push(vecs[i]);
              }
            }
          }
          copy[key] = value;
          if (value === null) {
            copy[key] = {};
            recset(n[key], copy[key]);
          }
        }
      }
    }
    recset(FacePointIdxs, data)
  } catch(e){}
  return data;
}

let FaceMesh = false;
// Load's model
export async function load() {
  if (FaceMesh !== false) return;
  // Read more `CopyWebpackPlugin`, copy wasm set from "https://cdn.skypack.dev/node_modules" to `/wasm`
  const filesetResolver = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );
  FaceMesh = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: "GPU"
    },
    outputFaceBlendshapes: true,
    runningMode,
    numFaces: 1
  });
}
// await load();

// Get face points from video
export function getFacePointsFromVideo(video) {
  let ts = Date.now();
  let res = FaceMesh.detectForVideo(video, ts);
  let points = getFacePoints(res, video.videoWidth, video.videoHeight);
  points.ts = ts;
  return points;
}
