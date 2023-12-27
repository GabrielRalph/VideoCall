import {SvgPlus, Vector} from "../src/SvgPlus/4.js"
import {HideShow, SvgResize} from "../Utilities/basic-ui.js"
import {parallel, dotGrid, delay} from "../Utilities/usefull-funcs.js"

import {Webcam} from "./Algorithm/EyeGaze.js"
import {FeedbackFrame} from "./UI/feedback-frame.js"
import {CalibrationFrame} from "./UI/calibration-frame.js"

export class EyeTrackingFrame extends SvgPlus {
  onconnect(){
    // super("eye-tracking-frame")
    this.styles = {
      display: "block",
      width: "100%",
      height: "100%",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      position: "absolute",
      "pointer-events": "none",
    };

    let rel = this.createChild("div");

    let grid = rel.createChild(SvgResize);
    grid.styles = {
      width: `calc(100% - 2em)`,
      height: `calc(100% - 2em)`,
      margin: '1em',
      opacity: 0.3,
      position: "absolute",
      top: 0,
      left: 0,
    };
    grid.createGrid(7);
    this.grid = grid;

    this.feedback = rel.createChild(FeedbackFrame);
    this.feedback.styles = {
      "pointer-events": "all",
    }
    this.feedback.align = "center"
    this.feedback.hideEyes();
    this.feedback.size = 0.5;

    let pointers = rel.createChild(SvgResize);
    pointers.styles = {
      position: "absolute",
      top: 0,
      left: 0,
    }
    pointers.shown = true;
    this.cursor = pointers.createPointer("simple", 5, "red");
    this.blob = pointers.createPointer("blob", 15);
    this.pointers = pointers;
    this.pointers.start();


    this.calibrator = rel.createChild(CalibrationFrame);
    this.calibrator.styles = {
      "pointer-events": "all",
    }
    Webcam.addProcessListener((input) => this.onPrediction(input));

    this.Webcam = Webcam;
  }

  async stop(){
    Webcam.stopProcessing();
    Webcam.stopWebcam();
    this.grid.shown = false;
    this.blob.shown = false;
    this.feedback.shown = false;
  }

  async start(){
    console.log("starting webcam");
    let webcam_on = await Webcam.startWebcam();
    console.log("webcam " + (webcam_on ? "started" : "failed to start"));
    if (webcam_on) {
      Webcam.startProcessing();
      await delay(100);
      // await this.feedback.show();
      // await this.feedback.moveTo(new Vector(0, 0), 0.2);
    }
    return webcam_on;
  }

  async calibrate(){
    await this.calibrator.show();
    this.feedback.size = 0.2;
    await this.calibrator.calibrate();
    await this.calibrator.hide();
    this.grid.start();

    await this.grid.show();
  }

  onPrediction(input){
    let {result} = input;
    let rel = null;
    if (result) {
      if (result.x > 1) result.x = 1;
      if (result.x < 0) result.x = 0;
      if (result.y > 1) result.y = 1;
      if (result.y < 0) result.y = 0;
      let [pos, size] = this.bbox;
      rel = result.mul(size).add(pos);
    }
    const event = new Event("prediction");
    event.pos = rel;
    this.dispatchEvent(event);
  }
}

SvgPlus.defineHTMLElement(EyeTrackingFrame)
