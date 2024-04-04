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
    this._displayType = null;
    this._wait_for_load = new Promise((resolve, reject) => {
      this._end_load = resolve;
    })
  }
  onconnect(){
    let loader = this.querySelector("[name = 'loader']");
    this.loader = loader;
    this.innerHTML = "";
    this.image = this.createChild("img");
    this.canvas = this.createChild("canvas", {width: 1000, height: 1000});
    let icons = this.createChild("div", {class: "pdf-controls"});
    this.icons = icons;
    this.middle_icon = icons.createChild("div", {class: "bottom-middle"});
  }

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
  }
  get displayType(){
    return this._displayType;
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
    if (contentInfo == null) {
      this.displayType = null;
      this._url = null;
    } else {
      let {url, page, type} = contentInfo;
      
      if (url != this.url) {
        this.displayType = type;
        if (type == "pdf") {
          this.page = page;
          console.log(this.page, page);
          await this.loadPDF(url);
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
        let t0 = performance.now();
        let pdfDoc = await PDF.getDocument(url).promise
        this.pdfDoc = pdfDoc;
        this._url = url;
        console.log(`pdf took ${performance.now() - t0}ms`)
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
    console.log('waiting for load', this._wait_for_load);
    while (!this._loaded) {
      await delay(50);
    }
    // await this._wait_for_load;
    console.log('loaded');
  }

  async renderPage(){
    let {canvas, pdfDoc, pageNum} = this;
    if (pdfDoc) {
      if (this._render_prom instanceof Promise) {
        await this._render_prom
      }else {
        let [pos, size] = this.bbox;
        let maxDimension = Math.max(size.x, size.y) * 2;
        this._render_prom = renderPDF(canvas, pdfDoc, pageNum, maxDimension);
        this._render_prom = await this._render_prom;
      };
    }
  }

  get render_prom(){
    return this._render_prom;
  }

  static get observedAttributes() {return ["src"]}
}


export {PdfViewer}
