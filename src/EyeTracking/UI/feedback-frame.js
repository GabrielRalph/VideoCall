import {Vector} from "../../SvgPlus/4.js"
import {FloatingBox, HideShow, SvgCanvas, SvgPlus} from "../../Utilities/basic-ui.js"
// import {Webcam} from "../Algorithm/EyeGaze.js"

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
    // Webcam.addProcessListener((input) => this.renderFace(input));
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


  renderTransfromVector(features) {
    let svg = this.svgCanvas.svg;
    let {offset, direction} = features.transform;
    let p2 = offset.v3d.sub(direction.mul(50));
    svg.createChild("path", {
      stroke: "black",
      "stroke-width": 3,
      d: `M${offset}L${p2.x},${p2.y}`
    })
    
  }


  renderFeatures(features, canvas) {
    if (!canvas) {
      canvas = new SvgPlus("canvas");
      canvas.width = features.videoWidth;
      canvas.height = features.videoHeight;
    } 
    this.svgCanvas.updateCanvas(canvas);

    let svg = this.svgCanvas.svg;

    try {
    //  this.renderTransfromVector(features);
    } catch (e){}
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

  /**
   * @param {any} stream
   */
  set videoStream(stream) {
    this.svgCanvas.video.srcObject = stream;
  }
}
