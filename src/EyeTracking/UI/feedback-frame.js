import {Vector} from "../../SvgPlus/4.js"
import {FloatingBox, HideShow, SvgCanvas, SvgPlus} from "../../Utilities/basic-ui.js"
import {Webcam} from "../Algorithm/EyeGaze.js"

export class FeedbackFrame extends HideShow{
  constructor(el = "feedback-frame"){
    super(el);
    this.size = 1;
  
    // Eye box
    this.eyebox = this.createChild("div", {styles: {overflow: "hidden", display: "flex", position: "relative"}});
    this.right = this.eyebox.createChild("canvas", {styles: {width: "50%"}});
    this.left = this.eyebox.createChild("canvas", {styles: {width: "50%"}});

      // FeedbackFrame
    this.svgCanvas = this.createChild(SvgCanvas);
    Webcam.addProcessListener((input) => this.renderFace(input));
  }

  hideEyes(){
    this.showEyes(false);
  }
  showEyes(show = true){
    if (show && !!this.eyes_hidden) {
      this.eyebox.styles = {height: "auto"}
      this.eyes_hidden = false;
    } else if (!show && !this.eyes_hidden) {
      this.eyebox.styles = {height: "0px"}
      this.eyes_hidden = true;
    }
  }

  ondblclick(){
    console.log(this.eyes_hidden);
    this.showEyes(!!this.eyes_hidden)
  }

  renderFace(input) {
    let canvas = new SvgPlus("canvas");
    canvas.width = input.features.videoWidth;
    canvas.height = input.features.videoHeight;
    if (input.canvas) {
      canvas = input.canvas;
    } 
    this.svgCanvas.updateCanvas(canvas);
    let features = input.features;
    let svg = this.svgCanvas.svg;
    for (let key of ["left", "right"]) {
      if (features[key].box.topLeft) {
        let {topLeft, topRight, bottomRight, bottomLeft, warning} = features[key].box;
        svg.createChild("path", {
          d: `M${topLeft}L${topRight}L${bottomRight}L${bottomLeft}Z`,
          fill: warning ? "#ff000044" : "#00ff0044"
        })
      }
      if (features[key].pixels) {
        features[key].pixels.render(this[key]);
      }
    }
  }

  set videoStream(stream) {
    console.log(stream);
    this.svgCanvas.video.srcObject = stream;
  }

  // async moveTo(end, size = this.size, duration = 400) {
  //   if (typeof end === "string" && end in FloatingBox.positions) end = FloatingBox.positions[end];
  //   end = new Vector(end.x, end.y);
  //   try {
  //     let start = this.alignment;
  //     let starts = this.size;
  //     await this.waveTransition((t) => {
  //       this.align = start.mul(1 - t).add(end.mul(t));
  //       this.size = starts * (1-t) + size * t;
  //     }, duration, true);
  //   } catch (e) {}
  // }
}
