import {EyeGazeModelInterface, Vector} from "./ModelInterface.js"
import {ridgeregvec} from "./RidgeReg/ridgereg.js"

function getEyePixelFeature(X) {
  return [...X.left.pixels, ...X.right.pixels];
}

function getFacePointsSelect(X) {
  let newX = [];

  for (let key of ["lefteye", "righteye"]) {
    for (let v of X.facePoints[key].all) {
      newX.push(v.v3d);
    }
  }
 
  for (let v of X.facePoints.plane) {
    newX.push(v.v3d);
  }

  return newX;
}

function getFacePointFeatures(X) {
  let fps = getFacePointsSelect(X);
  let newX = [];
  for (let p of fps) {
    newX.push(p.x);
    newX.push(p.y);
    // newX.push(p.y * p.y);
    newX.push(p.z);
    // newX.push(p.z * p.z);
  }

  return newX;
}

function getEyeGeometryFeature(X, yp1, steady_avg) {
  let fps = getFacePointsSelect(X);
  console.log(steady_avg);

  let newX = [];
  for (let i = 0; i < fps.length; i++) {
    let p = fps[i].sub(steady_avg[i]);
    newX.push(p.x);
    newX.push(p.y);
    newX.push(p.z);
  }

  newX.push(yp1.x);
  newX.push(yp1.y);
  return newX;
}

export default class RRAdjusted extends EyeGazeModelInterface {
  train_old(data) {
    console.log(data);
    // Train model using steady calibration data
    let steady = [];
    let steady_avg = null;
    for (let {X, y} of data) {
      if (X.method === "steady") {
        let Xp = getEyePixelFeature(X);
        let fps = getFacePointsSelect(X);
        if (steady_avg == null) {
          steady_avg = fps;
        } else {
          for (let i = 0; i < steady_avg; i++) {
            steady_avg[i] = steady_avg[i].add(fps[i])
          }
        }
        steady.push({X: Xp, y: y});
      }
    }
    steady_avg = steady_avg.map(x => x.div(steady.length));
    let MSteady = ridgeregvec(steady);

    let adjust = [];
    for (let {X, y} of data) {
      let Xp = getEyePixelFeature(X);
      let yp1 = MSteady.predict(Xp);
      let Xg = getEyeGeometryFeature(X, yp1, steady_avg);
      adjust.push({X: Xg, y: y});
    }
    this.steady_avg = steady_avg;
    let MAdjust = ridgeregvec(adjust);
    this.MSteady = MSteady;
    this.MAdjust = MAdjust;
  }

  train(data) {
    let myX = [];
    for (let {X, y} of data) {
      try {
        let Xp = getFacePointFeatures(X);
        myX.push({X: Xp, y: y});
      } catch(e) {console.log(e);}
    }
    console.log(myX);
    this.MP = ridgeregvec(myX);
    console.log(this.MP);
  }
  predict(X) {
    let y = null;
    if (this.MP) {
      try {
        let x = getFacePointFeatures(X);
        y = this.MP.predict(x);
      } catch (e) {
        console.log(e);
      }
    }
    return y;
  }

  predict_old(X){
    let y = null;
    if (this.MSteady && this.MAdjust) {
      let Xp = getEyePixelFeature(X);
      let yp1 = this.MSteady.predict(Xp);
      let Xg = getEyeGeometryFeature(X, yp1, this.steady_avg);
      y = this.MAdjust.predict(Xg);
    }
    return y;
  }
}


/*

         X                                    y
 [x1, y1, z1, ...] * [w1, w2, w3, ...] = x_pos_on_screen

 x1*w1 + y1*w2 + z1*w3 + x2 * w4

 [x1, y1, z1, ...] * [q1, q2, q3, ...] = y_pos_on_screen

 */