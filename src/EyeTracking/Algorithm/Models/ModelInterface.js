import {Vector} from "../../../SvgPlus/vector.js"
import {linspace} from "../../../Utilities/usefull-funcs.js"
import KalmanFilter from "./RidgeReg/kalman.js"


function sampleSelect(points, sampleRate){
  let samples = [];
  let remainder = [];
  let num_samples = Math.round(points.length * sampleRate);
  let tps = linspace(0, points.length - 1, num_samples);
  for (let pi = 0, si = 0; pi < points.length; pi++) {
    if (pi == Math.round(tps[si])) {
      samples.push(points[pi]);
      si++;
    } else {
      remainder.push(points[pi]);
    }
  }
  return [samples, remainder];
}
function getDeltaStats(deltas){
  let sum = new Vector(0);
  let n = 0;
  for (let v of deltas) {
    if (v instanceof Vector) {
      sum = sum.add(v);
      n++;
    }
  }
  let mean = sum.div(n);

  let ss = new Vector(0);
  for (let v of deltas) {
    if (v instanceof Vector) {
      let e = v.sub(mean);
      ss = ss.add(e.mul(e));
    }
  }
  let std = ss.div(n).sqrt()
  return {mean, std, deltas};
}
function getRegionStats(yp, yr, gsize = 5){
  let positions = {};
  for (let i = 0; i < yp.length; i++) {
    let gy = yr[i].mul(gsize).floor();
    let ip = gy.x + gy.y * gsize;
    if (!(ip in positions)) positions[ip] = [];
    positions[ip].push(yp[i].sub(yr[i]));
  }

  for (let i in positions) {
    positions[i] = getDeltaStats(positions[i]);
  }

  return positions;
}

class EyeGazeModelInterface {

  trainAndValidate(data, sampleRate) {
    let [train, validation] = sampleSelect(data, sampleRate);
    this.train(train);
    let trainstats = this.validate(train);
    let validstats = this.validate(validation);

    let validationResults = {train: trainstats, validation: validstats};
    this.validationResults = validationResults;
    return validationResults;
  }

  validate(validationData){
    let deltas = validationData.map(({X, y}) => {
      let yp = this.predict(X);
      let delta = null;
      if (yp instanceof Vector) {
        delta = yp.sub(y);
        delta.actual = y;
      }
      return delta
    });
    return getDeltaStats(deltas);
  }

  predictAndFilter(x){
    // If no filter function then set it to a default kalman filter
    if (!(this.filter instanceof Function)) {
      this.kalman = KalmanFilter.default();
      this.filter = (v) => {
        let vf = null;
        if (v instanceof Vector) vf = new Vector(this.kalman.update([v.x, v.y]));
        return vf;
      }
    }

    let y0 = this.predict(x);
    let y = this.filter(y0)
    return y;
  }

  /* Overwrite these methods
  */
  train(trainData) {
  }

  predict(x){
    return new Vector(0);
  }
}

export {Vector, EyeGazeModelInterface}
