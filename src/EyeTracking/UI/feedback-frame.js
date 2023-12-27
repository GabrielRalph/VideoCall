import {Vector} from "../../SvgPlus/4.js"
import {FloatingBox, SvgCanvas} from "../../Utilities/basic-ui.js"
import {Webcam} from "../Algorithm/EyeGaze.js"

export class FeedbackFrame extends FloatingBox{
  constructor(el = "feedback-frame"){
    super(el);
    this.size = 1;
    this.styles = {
      overflow: "hidden",
      "border-radius": "1em",
    };
    // Eye box
    this.eyebox = this.createChild("div", {styles: {overflow: "hidden", display: "flex", position: "relative"}});
    this.right = this.eyebox.createChild("canvas", {styles: {width: "50%"}});
    this.left = this.eyebox.createChild("canvas", {styles: {width: "50%"}});

      // FeedbackFrame
    this.svgCanvas = this.createChild(SvgCanvas);
    Webcam.addProcessListener((input) => this.renderFace(input));
  }

  set size(size){
    this._size = size;
    this.styles = {
      width: `${size * 100}vmin`
    }
  }
  get size(){
    return this._size;
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
    this.svgCanvas.updateCanvas(input.canvas);
    this.styles = {
      border: !!input.error ? "2px solid red" : "none",
      padding: !!input.error ? "0px" : "2px"
    }
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

  async moveTo(end, size = this.size, duration = 400) {
    if (typeof end === "string" && end in FloatingBox.positions) end = FloatingBox.positions[end];
    end = new Vector(end.x, end.y);
    try {
      let start = this.alignment;
      let starts = this.size;
      await this.waveTransition((t) => {
        this.align = start.mul(1 - t).add(end.mul(t));
        this.size = starts * (1-t) + size * t;
      }, duration, true);
    } catch (e) {}
  }
}
