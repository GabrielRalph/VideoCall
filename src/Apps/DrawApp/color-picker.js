import {SvgPlus, Vector} from "../../SvgPlus/4.js"


const { abs, min, max, round } = Math;

/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from https://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   {number}  h       The hue
 * @param   {number}  s       The saturation
 * @param   {number}  l       The lightness
 * @return  {Array}           The RGB representation
 */
function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1/3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1/3);
  }
  let a = 1;
  return {r, g, b, a};
}

function hueToRgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1/6) return p + (q - p) * 6 * t;
  if (t < 1/2) return q;
  if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
  return p;
}


function addColors(fg, bg) {
    let r = {};
    r.a = 1 - (1 - fg.a) * (1 - bg.a); 

    if (r.a == 0) {
        r.r = 0;
        r.g = 0;
        r.b = 0;
    } else {
        r.r = fg.r * fg.a / r.a + bg.r * bg.a * (1 - fg.a) / r.a;
        r.g = fg.g * fg.a / r.a + bg.g * bg.a * (1 - fg.a) / r.a; 
        r.b = fg.b * fg.a / r.a + bg.b * bg.a * (1 - fg.a) / r.a; 
    }    


    return r;
}

function colorLurp(c1, c2, t) {
    let c1a = {};
    let c2a = {}
    for (let key in c1) {
        c1a[key] = c1[key] * t;
        c2a[key] = c2[key] * (1 - t);
    }

    return addColors(c1a, c2a);
}



export class ColorPicker extends SvgPlus {
    constructor(){
        super("color-picker");
        this.styles = {display: "flex"}
        // /**
        //  * @type {HTMLCanvasElement}
        //  */
        // let canvas = this.createChild("canvas")

        let s = 5;
        let bs = 0.2;
        let br = 1.2;
        let h = 8;
        let w = 8;
        this.s = s;
        this.bs = bs;
        this.br = br;
        this.w = w;
        this.h = h;
        
        // let ctx = canvas.getContext("2d");
        // let imgData = ctx.createImageData(w, h);


        let svg = this.createChild("svg", {viewBox: `-${br} -${br} ${s*(w+1)+br *2} ${s*(h + 1) + br*2}`});
        svg.styles = {width: "100%"}


        // this.ctx = ctx;

        let g1 = svg.createChild("g");
        let g2 = svg.createChild("g");
        this.g1 = g1;
        this.g2 = g2;

        // this.renderHue(0.33)
        
        this.renderHues();
        g2.children[0].select();
    }


    selectHue(icon) {
        if (this._lastHue instanceof Element) this._lastHue.styles = {stroke: null}

        let cf = hslToRgb(icon.hue, 1, 0.4);
        icon.styles = {stroke: `rgba(${cf.r*255}, ${cf.g*255}, ${cf.b*255}, ${cf.a})`, "stroke-width": this.bs*4}

        this.renderHue(icon.hue);
        this._lastHue = icon;
    }


    selectColor(icon) {
        if (this._lastColor instanceof Element) this._lastColor.styles = {stroke: null}
        if (icon instanceof Element) {
            let col =255 * ((icon.row / (this.h - 1)) * 0.4);
            let cf = hslToRgb(icon.hue, 1, 0.5);
            icon.styles = {stroke: `rgba(${col}, ${col}, ${col}, ${1})`, "stroke-width": this.bs*4}
            this._lastColor = icon;

            this._selectedColor = icon.color;
        }
    }

    get color(){
        return this._selectedColor;
    }



    renderHues(){
        let {g2, h, w, s, br, bs} = this;
        let hfun = (hue) => Math.pow(hue, 1.3) * 0.98

        let makeIcon = (hue, r, c) => {
            let cf = hslToRgb(hue, 1, 0.5);
            let icon = g2.createChild("rect", {x: c*s, y: r*s, rx: br, ry: br, width: s-bs*2, height: s-bs*2, fill: `rgba(${cf.r*255}, ${cf.g*255}, ${cf.b*255}, ${cf.a})`});
            icon.hue = hue;
            icon.select = () => {this.selectHue(icon)}
            icon.onclick = () => icon.select()
        }

        g2.innerHTML = "";
        let r = h;
        for (let c = 0; c < w; c++) {
            let hue= hfun(c/(w+h+1))
            makeIcon(hue, r, c)
        }
        
        let c = w;
        r = h;
        let hue = hfun((w)/(h+1+w));
        makeIcon(hue, r, c);
        
        for (r = 0; r < h; r++) {
            hue = hfun((w+1+(h-r-1))/(h+1+w));
            makeIcon(hue, r, c);
        }

    }

    renderHue(hue) {
        let selr = 0;
        let selc = 0;
        if (this._lastColor instanceof Element) {
            selr = this._lastColor.row;
            selc = this._lastColor.col;
        }
        let {g1, h, w, s, bs, br} = this;
        g1.innerHTML = "";
        let i = 0;
        let c11 = hslToRgb(hue, 1, 0.5);
        let c12 = {r: 1, g:1, b:1, a: 1};

        let c21 = {r: 0, g: 0, b: 0, a: 0};
        let c22 = {r: 0, g: 0, b: 0, a: 1};
        for (let r = 0; r < h; r++) {
            for (let c = 0; c < w; c++) {
                let ca = colorLurp(c12, c11, 1-Math.cos(c/(w-1) * Math.PI/2));
                let cb = colorLurp(c21, c22, 0.15 + 0.85*(1-r/(h-1)) );
                let cf = addColors(cb, ca);
                cf = addColors(cf, c12);


                // let cf = cb;
                let icon = g1.createChild("rect", {x: c*s, y: r*s, rx: br, ry: br, width: s-bs*2, height: s-bs*2, fill: `rgba(${cf.r*255}, ${cf.g*255}, ${cf.b*255}, ${cf.a})`});
                icon.row = r;
                icon.col = c;
                icon.color = `rgba(${cf.r*255}, ${cf.g*255}, ${cf.b*255}, ${cf.a})`
                icon.hue = hue;
                icon.r = cf.r*255;
                icon.g = cf.g*255;
                icon.b = cf.b*255;
                icon.onclick = () => {
                    this.selectColor(icon);
                }
                
                if (r == selr && c == selc) {
                    this.selectColor(icon);
                }
                i+=4;
            }
        }
    }
}