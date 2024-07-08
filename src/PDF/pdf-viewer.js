import {SvgPlus, Vector} from "../SvgPlus/4.js"
import * as PDF from "./pdfjs/build/pdf.mjs"
import * as PDFWorker from './pdfjs/build/pdf.worker.mjs';

PDF.GlobalWorkerOptions.workerSrc = PDFWorker;


function hasKey(object, key) {
  if (typeof object === "object" && object !== null) {
    return key in object;
  }
  return false;
}

console.log(PDF);
async function delay(time) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, time);
  });
}



async function renderPDF(canvas, pdfDoc, pageNum, maxDimension){
  // console.log("rendering page", pageNum);
  let t0 = performance.now();
  let page = await pdfDoc.getPage(pageNum);

  // Set scale
  const VP = page.getViewport({scale: 1});
  const maxVPD = Math.max(VP.height, VP.width);
  const scale = maxDimension / maxVPD;
  const viewport = page.getViewport({scale: scale})
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({
    canvasContext: canvas.getContext("2d", {willReadFrequently: true}),
    viewport: viewport
  }).promise;

  console.log("pdf render took: ", performance.now() - t0);
  // console.log("page rendered");
}



// async function openImage(){
//   let input = new SvgPlus("input");
//   input.props = {type: "file", accept: "image"};
//   return new Promise((resolve) => {
//     input.click();
//     input.onchange = () => {
//       if (input.files.length > 0) {
//         const reader = new FileReader();
//         reader.onload = (evt) => {
//           resolve(evt.target.result);
//         };
//         reader.readAsDataURL(input.files[0]);
//       }
//     }
//   });
// }



class PdfViewer extends SvgPlus {
  constructor(el = "pdf-viewer") {
		super(el);
		if (typeof el === "string") this.onconnect();
    this._pageNumber = 1;
    this._scale = 1;
    this._offset = new Vector();
    this._displayType = null;
    this._wait_for_load = new Promise((resolve, reject) => {
      this._end_load = resolve;
    })
  }
  onconnect(){
    let loader = this.querySelector("[name = 'loader']");
    this.loader = loader;

    this.innerHTML = "";
    this.image = this.createChild("img", {
      'draggable': 'false',
      events: {
        'dragstart': e => e.preventDefault()
      }
    });
   
    this.canvas = this.createChild("canvas", {width: 1000, height: 1000});
    this.video = this.createChild("video", {playsinline: true, muted: true, autoplay: true});
    let icons = this.createChild("div", {class: "pdf-controls"});
    this.icons = icons;
    this.middle_icon = icons.createChild("div", {class: "bottom-middle"});
    
    
    this.addEventListener("mousewheel", (e) => {
      if (this.transformable) {
        let pixelPos = new Vector(e.clientX, e.clientY);
        let wscale = 600 / this.scale;
        if (e.ctrlKey) wscale = 7000 / this.scale;
        this.scaleAtPoint(pixelPos, e.wheelDeltaY/wscale);
        e.preventDefault();
      }
    });



    let selected = false;
    this.addEventListener("mousedown", (e) => {
      selected = true;
    })


    let last = null;
    this.addEventListener("mousemove",(e) => {
      if (selected) {
        if (e.buttons == 1 && this.transformable) {
          let point = new Vector(e.clientX, e.clientY);
          if (last == null) last = point;
          let delta = point.sub(last);
          let [pos, size] = this.displayBBox;
          let deltaRel = delta.div(size);
          this.offset = this.offset.add(deltaRel);
          last = point;
          this.transformEvent();
        }
      }
    })
    this.addEventListener("mouseup", () => {last =null;selected = false;});
    this.addEventListener("mouseleave", () => {last =null;selected = false;});

    this.addEventListener("dblclick", () => {
      if (this.transformable) {
        this.resetTransform();
      }
    })
  }

  transformEvent(mode = "I", scale=this.scale, offset=this.offset){
    const event = new Event("transform", {bubbles: true});
    event.transform = `${scale.toPrecision(5)},${offset},${mode}`;
    this.dispatchEvent(event);
  }

  resetTransform(){
    let dscale = this.scale - 1;
    let offset = this.offset;
    this.transformEvent("T", 1, new Vector());
    this.waveTransition((t) => {
      this.scale = 1 + dscale * t;
      this.offset = offset.mul(t);
    }, 500, false);
  };
  
  scaleAtPoint(point, scaleDelta) {
    let scale = this.scale;
    let scale2 = scale + scaleDelta;
    if (scale2 < 0.3) scale2 = 0.3;
    if (scale2 > 8) scale2 = 8;

    let [pos, size] = this.displayBBox;
    let center = pos.add(size.div(2));

    let offset = point.sub(center);


    let o2 = offset.mul(scale2/scale);
    let delta = o2.sub(offset).div(size.mul(scale2/scale));

    this.scale = scale2;
    this.offset = this.offset.mul(scale/scale2).sub(delta);
    this.transformEvent()
  }


  set contentTransform(trans) {
    let [scale, ox, oy, type] = trans.split(",");
    scale = parseFloat(scale);
    let offset = new Vector(parseFloat(ox), parseFloat(oy));
    if (type == "T") {
      let o1 = this.offset;
      let s1 = this.scale;
      this.waveTransition((t) => {
        this.scale = s1 * (1 - t) + scale*t;
        this.offset = o1.mul(1-t).add(offset.mul(t));
      }, 500, true)
    } else {
      this.scale = scale;
      this.offset = offset;
    }
  }
  set scale(x) {
    this.styles = {"--scale": x}; 
    this._scale = x
  };
  set offset(v) {
    this.styles = {"--offset-x": v.x*100 + "%", "--offset-y": v.y * 100 + "%"}; 
    this._offset = v.clone()
  }
  get scale(){return this._scale;}
  get offset(){return this._offset;}

  set page(value) {
    if (value < 1) value = 1;
    let {totalPages, pdfDoc} = this;
    if (value > totalPages && pdfDoc) value = totalPages;
    this._pageNumber = value;
    this.renderPage();
  }
  get page() {
    return this._pageNumber;
  }
  get pageNum() {
    return this._pageNumber;
  }
  get totalPages() {
    if (hasKey(this.pdfDoc, "numPages")) {
      return this.pdfDoc.numPages
    }
    return 0;
  }

  set displayType(type) {
    this._displayType = type;
    this.canvas.styles = {display: type == "pdf" ? null : "none"};
    this.image.styles = {display: type == "image" ? null : "none"};
    this.video.styles = {display: type == "stream" ? null : "none"};
  }

  get displayType(){
    return this._displayType;
  }

  get displayBBox(){
    if (this.displayType == "pdf") return this.canvas.bbox;
    else if (this.displayType == "stream") return this.video.bbox;
    else return this.image.bbox;
  }
  // async openFile(){
  //   return await openFile();
  // }

  /**
   * @param {Object} contentInfo 
   * @param {String} contentInfo.url
   * @param {String} contentInfo.page
   * @param {String} contentInfo.type
   */
  async updateContentInfo(contentInfo) {
    console.log("content update", contentInfo);
    if (contentInfo == null) {
      this.displayType = null;
      this._url = null;
    } else {
      let {url, page, type} = contentInfo;
      console.log(url == this.url ? "same pdf" : "new pdf");
      if (url != this.url) {
        this.displayType = type;
        if (type == "pdf") {
          this._pageNumber = page;
          await this.loadPDF(url);
        } else if (type == "stream") {
          // this.video.srcObject = url;
        } else {
          this.image.props = {src: url};
          this._url = url;
        }
      } else if (page != this.page) {
          this.page = page;
      }
    }
  }

  async loadPDF(url) {
    this._loaded = false;
    this.displayType = null;
    let load = async () => {
      try {
        console.log("loading pdf...");
        this._url = url;
        let t0 = performance.now();
        let pdfDoc = await PDF.getDocument(url).promise
        this.pdfDoc = pdfDoc;
        console.log(`load pdf took ${performance.now() - t0}ms`)
        if (this.pageNum < 1 || this.pageNum > this.totalPages) this._pageNumber = 1;
        await this.renderPage();
        this.displayType = "pdf";
        return true;
      } catch(e) {
        console.log(e);
        this._url = null;
        this._pageNumber = null;
        return false;
      }
    }
    if (this._loading_prom instanceof Promise) {
      await this._loading_prom;
    } else {
      this._loading_prom = load();
      this._loading_prom = await this._loading_prom;
    }
  }

  get loading_prom() {
    return this._loading_prom;
  }

  get url() {
    return this._url;
  }

  // set url(url) {
  //   this.loadPDF(url);
  // }

  // set src(value) {
  //   console.log("src");
  //   this.url = value;
  // }

  async waitForLoad(){
    // console.log('waiting for load', this._wait_for_load);
    while (!this._loaded) {
      await delay(50);
    }
    // await this._wait_for_load;
    // console.log('loaded');
  }

  async renderPage(){
    let {canvas, pdfDoc, pageNum} = this;
    if (pdfDoc) {
      if (this._render_prom instanceof Promise) {
        await this._render_prom
      }

      let maxDimension = Math.max(window.innerWidth, window.innerHeight) * 3;
      this._render_prom = renderPDF(canvas, pdfDoc, pageNum, maxDimension);
      await this._render_prom;
      this._render_prom = null;
    }
  }

  get render_prom(){
    return this._render_prom;
  }

  static get observedAttributes() {return ["src"]}
}


export {PdfViewer}
