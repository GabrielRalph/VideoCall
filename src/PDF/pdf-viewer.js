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

  let page = await pdfDoc.getPage(pageNum);

  // Set scale
  const VP = page.getViewport({scale: 1});
  const maxVPD = Math.max(VP.height, VP.width);
  const scale = maxDimension / maxVPD;
  const viewport = page.getViewport({scale: scale})
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({
    canvasContext: canvas.getContext("2d"),
    viewport: viewport
  }).promise;

  // console.log("page rendered");
}

async function openFile(){
  let input = new SvgPlus("input");
  input.props = {type: "file", accept: "image/*, .pdf"};
  return new Promise((resolve) => {
    input.click();
    input.onchange = () => {
      if (input.files.length > 0) {
        let file = input.files[0];
        let type = file.type.indexOf("pdf") == -1 ? "image" : "pdf";
        let bfunc = type == "pdf" ? "readAsArrayBuffer" : "readAsDataURL";
        const reader = new FileReader();
        reader.onload = (evt) => {
          resolve({
            type: type,
            buffer: evt.target.result
          });
        };
        reader[bfunc](input.files[0]);
      }
    }
  });
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

    // this.onclick = async () => {
    //   let buffer = await loadPDFFile();
    //   console.log(buffer);
    //   this.loadPDF(buffer);
    // }
  }

  set page(value) {
    if (value < 1) value = 1;
    let {totalPages} = this;
    if (value > totalPages) value = totalPages;
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
    this.canvas.styles = {display: type == "canvas" ? null : "none"};
    this.image.styles = {display: type == "image" ? null : "none"};
  }
  get displayType(){
    return this._displayType;
  }

  async openFile(){
    return await openFile();
  }


  async loadFile(file) {
    this._pageNumber = 1;
    this.pdfDoc = null;
    if (file) {
      let type = file.name ? file.name : file.type;
      if (type == "pdf") {
        await this.loadPDF(file.buffer);
      } else {
        this.image.props = {src: file.buffer};
        this.displayType = "image";
      }
    }
  }

  async loadPDF(url) {
    this._loaded = false;
    this.displayType = null;
    let load = async () => {
      try {
        let pdfDoc = await PDF.getDocument(url).promise
        this.pdfDoc = pdfDoc;
        this._url = url;
        if (this.pageNum < 1 || this.pageNum > this.totalPages) this._pageNumber = 1;
        await this.renderPage();
        this.displayType = "canvas";
        return true;
      } catch(e) {
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

  set url(url) {
    this.loadPDF(url);
  }

  set src(value) {
    console.log("src");
    this.url = value;
  }

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
