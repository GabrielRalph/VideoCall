import {EyeGazeModelInterface, Vector} from "./ModelInterface.js"
import {ridgeregvec} from "./RidgeReg/ridgereg.js"

function getCombFeature(X) {
  let X2 = [...X.left.pixels, ...X.right.pixels];
  for (let key of ["left", "right"]) {
    for (let pname of ["topLeft", "bottomLeft", "topRight"]) {
      for (let comp of "xyz") {
        X2.push(X[key].box[pname].v3d[comp])
      }
    }
  }
  return X2;
}

export default class RRCombined extends EyeGazeModelInterface{
  train(data) {
    let fdata = data.map(({X, y}) => {return {X: getCombFeature(X), y: y}});
    this.M = ridgeregvec(fdata);
  }

  predict(X){
    let y = null;
    if (this.M) {
      let Xc = getCombFeature(X);
      y = this.M.predict(Xc);
    }
    return y;
  }
}
