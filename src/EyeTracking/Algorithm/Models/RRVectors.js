import {EyeGazeModelInterface, Vector} from "./ModelInterface.js"
import {ridgeregvec} from "./RidgeReg/ridgereg.js"

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
        newX.push(p.z);
    }
    return newX;
}

export default class RRVectors extends EyeGazeModelInterface {
  train(data) {
    let myX = [];
    for (let {X, y} of data) {
        try {
            let Xp = getFacePointFeatures(X);
            myX.push({X: Xp, y: y});
        } catch(e) {
            console.log('IDP');
        }
    }
    this.MP = ridgeregvec(myX);
  }
  predict(X) {
    let y = null;
    if (this.MP) {
      try {
        let x = getFacePointFeatures(X);
        y = this.MP.predict(x);
      } catch (e) {
        console.log('IDP');

      }
    }
    return y;
  }
}
