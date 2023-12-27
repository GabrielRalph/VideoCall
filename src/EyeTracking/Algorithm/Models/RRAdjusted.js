import {EyeGazeModelInterface, Vector} from "./ModelInterface.js"
import {ridgeregvec} from "./RidgeReg/ridgereg.js"

function getEyePixelFeature(X) {
  return [...X.left.pixels, ...X.right.pixels];
}
function getEyeGeometryFeature(X, yp1) {
  let newX = [];
  for (let key of ["left", "right"]) {
    for (let pname of ["topLeft", "bottomLeft", "topRight"]) {
      for (let comp of "xyz") {
        newX.push(X[key].box[pname].v3d[comp])
      }
    }
  }
  newX.push(yp1.x);
  newX.push(yp1.y);
  return newX;
}

export default class RRAdjusted extends EyeGazeModelInterface {
  train(data) {
    console.log(data);
    // Train model using steady calibration data
    let steady = [];
    for (let {X, y} of data) {
      if (X.method === "steady") {
        let Xp = getEyePixelFeature(X);
        steady.push({X: Xp, y: y});
      }
    }
    let MSteady = ridgeregvec(steady);

    let adjust = [];
    for (let {X, y} of data) {
      let Xp = getEyePixelFeature(X);
      let yp1 = MSteady.predict(Xp);
      let Xg = getEyeGeometryFeature(X, yp1);
      adjust.push({X: Xg, y: y});
    }
    let MAdjust = ridgeregvec(adjust);
    this.MSteady = MSteady;
    this.MAdjust = MAdjust;
  }

  predict(X){
    let y = null;
    if (this.MSteady && this.MAdjust) {
      let Xp = getEyePixelFeature(X);
      let yp1 = this.MSteady.predict(Xp);
      let Xg = getEyeGeometryFeature(X, yp1);
      y = this.MAdjust.predict(Xg);
    }
    return y;
  }
}
