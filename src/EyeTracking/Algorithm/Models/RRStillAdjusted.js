import {EyeGazeModelInterface, Vector} from "./ModelInterface.js"
import {ridgeregvec} from "./RidgeReg/ridgereg.js"

// function getFaceTransform(X){
//   let [a, b, c] = X.facePoints.plane;

//   let ab = b.v3d.sub(a);
//   let ac = c.v3d.sub(a);

//   let n = ab.cross(ac);
//   n = n.div(norm(n));

//   return [a, n];
// }

const FeatureExtractors = {
  moving: (X) => {
    let newX = [];
    for (let key of ["lefteye", "righteye"]) {
        for (let v of X.facePoints[key].all) {
            newX.push(v.v3d.x);
            newX.push(v.v3d.y);
            newX.push(v.v3d.z);
        }
    }
    return newX;
  }, 
  static: (X) => {
    let newX = [];

    let [a, b, c] = X.facePoints.plane;

    let ab = b.v3d.sub(a);
    let ac = c.v3d.sub(a);

    let n = ab.cross(ac);
    n = n.div(norm(n));
    
    return newX;
  },
  m2: (X, M1) => {
    let X_model_1 = FeatureExtractors.moving(X);
    let y0 = M1.predict(X_model_1);

    let {offset, direction} = X.transform;
    let X_model_2 = [y0.x, y0.y, offset.v3d.x, offset.v3d.y, offset.v3d.z, direction.x, direction.y, direction.z];

    return X_model_2;
  }
}



export default class RRStillAdjusted extends EyeGazeModelInterface {
  train(data) {
   
    // Train Model 1
    let train_moving = []; // moving eye still head
    for (let {X, y} of data) {
        try {
            if (X.method == "moving") {
              let X_model_1 = FeatureExtractors.moving(X);
              train_moving.push({X: X_model_1, y: y});
            }
        } catch(e) {console.log(e);}
    }
    this.M1 = ridgeregvec(train_moving);



    // Train Model 2
    let train_static = []
    for (let {X, y} of data) {
      try {
        let X_model_2 = FeatureExtractors.m2(X, this.M1);
        train_static.push({X: X_model_2, y: y})
      } catch (e) {

      }
    }
    this.M2 = ridgeregvec(train_static);
    console.log(this.M2);
  
  }

  predict(X) {
    let y = null;
    if (this.M1 && this.M2) {
      try {
        let X_2 = FeatureExtractors.m2(X, this.M1);
        y = this.M2.predict(X_2);
        // console.log(y);
      } catch (e) {
        console.log(e);
      }
    }
    return y;
  }
}
