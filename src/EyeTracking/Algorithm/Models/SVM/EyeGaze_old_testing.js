import {Vector} from "../SvgPlus/vector.js"
import {ridgereg, KalmanFilter} from "./RidgeReg/ridgereg.js"

function linspace(start, end, incs) {
  let range = end - start;
  let dx = range / (incs - 1);
  let space = [];
  for (let i = 0; i < incs; i ++) space.push(start + i * dx);
  return space;
}

function sampleSelect(points, num_samples){
  let samples = [];
  let remainder = [];
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

let SVM = await libsvm;

let Models = {};
const ModelParams = {
  svm: {
    kernel: SVM.KERNEL_TYPES.RBF, // The type of kernel I want to use
    type: SVM.SVM_TYPES.EPSILON_SVR,    // The type of SVM I want to run
    gamma: 1,                     // RBF kernel gamma parameter
  },
  ridge: Math.pow(10,-5)
}
const ModelTrainers = {
  svm: (train) => {
    let kfilter = KalmanFilter.default(0.5);

    const mx = new SVM(ModelParams.svm);
    const my = new SVM(ModelParams.svm);
    mx.train(train.map(u => u[0]), train.map(u => u[1].x));
    my.train(train.map(u => u[0]), train.map(u => u[1].y));
    return {
      mx: mx,
      my: my,
      predict: (x) => {
        let sx = mx.predictOne(x);
        let sy = my.predictOne(x);
        let v = new Vector(kfilter.update([sx, sy]));

        return v;
      }
    }
  },
  ridge: (train) => {
    let mx = ridgereg(train.map(u => [u[1].x]), train.map(u => u[0]), ModelParams.ridge);
    let my = ridgereg(train.map(u => [u[1].y]), train.map(u => u[0]), ModelParams.ridge);
    return {
      mx: mx,
      my: my,
      predict: (x, kfilt = false) => {
        let v = new Vector(0)
        for (let i = 0; i < x.length; i++) {
          v.x += x[i] * mx[i];
          v.y += x[i] * my[i];
        }
        return v;
      }
    }
  },
  ridgekalman: (train) => {
    let kfilter = KalmanFilter.default(0.5);
    let mx = ridgereg(train.map(u => [u[1].x]), train.map(u => u[0]), ModelParams.ridge);
    let my = ridgereg(train.map(u => [u[1].y]), train.map(u => u[0]), ModelParams.ridge);

    return {
      mx: mx,
      my: my,
      predict: (x, kfilt = true) => {
        let v = new Vector(0)
        for (let i = 0; i < x.length; i++) {
          v.x += x[i] * mx[i];
          v.y += x[i] * my[i];
        }

        if (kfilt) {
          v = new Vector(kfilter.update([v.x, v.y]));
        }

        return v;
      }
    }
  }
}

function validate_models(val_data) {
  let n = val_data.length;
  let errors = {};
  let stats = {
    avg: {},
    best: {},
  }
  for (let mname in Models) {
    errors[mname] = []
    stats.avg[mname] = 0;
    stats.best[mname] = 0;
  }

  for (let [x, y] of val_data) {
    for (let mname in Models) {
      let error = Models[mname].predict(x).dist(y);
      errors[mname].push(error);
    }
  }

  for (let i = 0; i < n; i++) {
    let bestname = null;
    for (let mname in errors) {
      let error = errors[mname][i];
      stats.avg[mname] += error;
      if (bestname == null || error < errors[bestname][i]){
        bestname = mname;
      }
    }
    stats.best[bestname] += 1;
  }

  for (let type in stats)
    for (let mname in stats[type]) stats[type][mname] /= n;

  return stats;
}

export function trainModel(data, modelName, samples = Math.round(data.length * 0.5)) {
  let [train, validate] = sampleSelect(data, samples);
  return ModelTrainers[modelName](train);
}

export function train_all_models(data, samples) {
  let [train, validate] = sampleSelect(data, samples);

  let models = {};
  for (let mname in ModelTrainers) {
    models[mname] = ModelTrainers[mname](data);
  }
  Models = models;

  let stats = validate_models(validate);

  console.log(stats);
  // console.log(`A ${modelName} model was trained on ${train.length} samples and experienced ${error} average error (max ${max}) accross ${validate.length} samples`);
  // console.log(Model);
}

export function predict(x, all = {}) {
  let y = null;

  for (let mname in Models) {
    y = Models[mname].predict(x);
    all[mname] = y;
  }
  // if (!!Model && Model.predict instanceof Function) {
  //   y = Model.predict(x);
  // }
  return y;
}
