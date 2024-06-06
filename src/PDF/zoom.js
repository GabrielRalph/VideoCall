import {Vector} from "../SvgPlus/4.js"

function bBoxToVV(bbox) {
  return [new Vector(bbox), new Vector(bbox.width, bbox.height)]
}

class ViewBox {
  constructor(svg) {
    this._offset = new Vector;
    this._scale = 1;
    this._pos = new Vector;
    this._size = new Vector;

    let updating = false
    this.update = () => {
      if (!updating) {
        updating = true;
        window.requestAnimationFrame(() => {
          this.updateViewBox();
          updating = false;
        })
      }

      window.onresize = () => {
        this.updateSize();
      }
    }

    this.updateSize = () => {
      let {size, pos} = this;
      let [spos, ssize] = bBoxToVV(svg.getBoundingClientRect())
      let sr = ssize.dir().mul(size.norm());
      let ratio = sr.div(size);
      this.size = sr;

      size = size.mul(this.scale).round(3);
      let delta = size.mul(ratio.mul(-0.5).add(0.5));
      this.pos = pos.add(delta);
    }

    this.updateViewBox = () => {
      let {size, pos} = this;
      let viewBox = "";

      size = size.mul(this.scale).round(3);
      pos = pos.add(this.offset).round(3);
      if (pos && size) viewBox = `${pos.x} ${pos.y} ${size.x} ${size.y}`
      // this.pos = pos;
      // this.size = size;
      svg.setAttribute("viewBox", viewBox);
      if (this.onupdate instanceof Function) {
        this.onupdate();
      }
    }

    this.getContentBBox = () => {
      let bbox = svg.getBBox();
      return bBoxToVV(bbox);
    }
    this.getScreenBBox = () => {
      let bbox = svg.getBoundingClientRect();
      this._spos = new Vector(bbox);
      this._ssize = new Vector(bbox.width, bbox.height);
      return [this._spos.clone(), this._ssize.clone()]
    }
  }

  get ssize(){return this._ssize;}
  get spos(){return this._spos;}

  set scale(v) {
    this._scale = v;
    this.update();
  }
  set offset(v) {
    if (v instanceof Vector) {
      this._offset = v;
      this.update();
    }
  }

  get offset(){return this._offset;}
  get scale(){return this._scale;}


  displayRealSize(){
    let [spos, ssize] = this.getScreenBBox();
    let [cpos, csize] = this.getContentBBox();

    let ratio = 254 / 96;
    let pr = window.devicePixelRatio
    if (pr) ratio = pr;
    let vsize = ssize.mul(ratio);

    let vpos = cpos.add(csize.div(2)).sub(vsize.div(2));


    this.viewbox = [vpos, vsize];
  }


  set viewbox([pos, size]) {
    this._size = size;
    this._pos = pos;
    this.update();
  }
  get viewbox(){return [this.pos, this.size]}

  get absoluteViewbox() {return [this.pos.add(this.offset), this.size.mul(this.scale)]}

  get size() {
    if (this._size instanceof Vector) {
      return this._size.clone();
    }
    return null;
  }
  set size(size) {
    size = new Vector(size);
    this._size = size;
    this.update();
  }

  get pos() {
    if (this._pos instanceof Vector) {
      return this._pos.clone();
    }
    return null;
  }
  set pos(pos) {
    pos = new Vector(pos);
    this._pos = pos;
    this.update();
  }

  scaleAtPoint(sDelta, screenPoint) {
    let [pos, size] = this.viewbox;
    let offset = this.offset
    pos = pos.add(offset);

    let scale = this.scale;
    sDelta = 1 + sDelta;
    let newScale = sDelta * scale;

    let relP = screenPoint.sub(pos);
    let delta = relP.sub(relP.mul(newScale/scale));

    // min scale
    if (scale + sDelta > 0.05) {
      this.offset = offset.add(delta);
      this.scale = newScale;
    }
  }
  drag(delta) {
    let [spos, ssize] = this.getScreenBBox();
    delta = delta.mul(this.size.div(ssize)).mul(this.scale);
    this.offset = this.offset.sub(delta);
  }
  screenToSVG(p) {
    p = new Vector(p);
    let [spos, ssize] = this.getScreenBBox();
    let [vpos, vsize] = this.viewbox;
    vpos = vpos.add(this.offset);
    vsize = vsize.mul(this.scale);
    let deltaPercent = p.sub(spos).mul(vsize.div(ssize));
    let pos = vpos.add(deltaPercent);
    return pos;
  }

  addPanAndZoomEvents(svg) {
    let mdown = false;
    svg.addEventListener("mousedown", () => {
      mdown = true;
    })

    let lastDragPoint = null;
    svg.addEventListener("mousemove", (e) => {
      if (mdown) {
        let point = new Vector(e);
        if (lastDragPoint == null) lastDragPoint = point.clone();

        let delta = point.sub(lastDragPoint);
        this.drag(delta);

        lastDragPoint = point;
      }
    });

    svg.addEventListener("mouseleave", (e) => {mdown = false})

    svg.addEventListener("wheel", (e) => {
      let deltaS = e.deltaY * 0.002;
      let point = this.screenToSVG(e);

      this.scaleAtPoint(deltaS, point);

      e.preventDefault();
    })

    svg.addEventListener("mouseup", () => {
      mdown = false;
      lastDragPoint = null;
    })
  }
}
 export {ViewBox}
