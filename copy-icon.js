import {SvgPath, SvgPlus, Vector} from "../SvgPlus/svg-path.js"

function delay(t) {
  return new Promise(function(resolve, reject) {
    setTimeout(resolve, t);
  });
}
const icon = `<svg width = "1em" viewBox="0 0 14.82 12.9"><defs><style>.cls-1,.cls-2{fill:none;stroke:#fff;stroke-linejoin:round;stroke-width:1.5px;}.cls-2{stroke-linecap:round;}</style></defs><circle class="cls-1" cx="10.76" cy="4.06" r="3.31"/><polyline class="cls-2" points="8.42 6.39 4.42 10.4 2.83 11.99 .75 9.91"/><line class="cls-2" x1="4.71" y1="10.11" x2="1.97" y2="7.38"/></svg>`
class CopyIcon extends SvgPlus {
  constructor(el = "copy-icon"){
    super(el);
    this.styles = {display: "flex", "align-items": "center"}
    this.innerHTML = "";
    this.svg = this.createChild("svg", {viewBox: "0 0 0.1 100", styles: {height: "1em"}});
    this.icon = this.createChild("div", {content: icon});

  }

  async showText(value, textValue = value) {
    if (this.hideText instanceof Function) {
      this.hideText();
    } else {
      let {svg} = this;
      let styles = getComputedStyle(this);
      let color = styles.color;
      let margin = parseFloat(this.getAttribute("margin") | 35);
      svg.innerHTML = "";
      let text = svg.createChild("text", {
        content: textValue,
        "font-size": 80,
        x: 0,
        y: 80,
        fill: color,
        style: {
          "font-family": "inherit",
          "color": "inherit",

        }
      });
      await this.waveTransition((a) => {
        let [tpos, tsize] = text.svgBBox;
        let width = (tsize.x + margin) * a;
        svg.props = {viewBox: `0 0 ${width} 100`}
      }, 300, true);

      this.hideText = async () => {
        this.hideText = null;
        await this.waveTransition((a) => {
          let [tpos, tsize] = text.svgBBox;
          let width = (tsize.x + margin) * a + 0.01;
          svg.props = {viewBox: `0 0 ${width} 100`};
        }, 300, false);
      }
      if (await this.copy(value)) {
        await this.waveTransition((a) => {
          this.styles = {opacity: a};
        }, 100, false);
        await this.waveTransition((a) => {
          this.styles = {opacity: a};
        }, 100, true);
        await delay(500);
        await this.hideText();
      }
    }
  }

  async copy(text){
    let success = false;
    if (!navigator.clipboard) {
      success = fallbackCopyTextToClipboard(text);
    } else {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch(e) {
      }
    }

    return success
  }

  set text(value){
    this.setAttribute("text", value);
  }
  set value(value){
    this.setAttribute("value", value);
  }

  onclick(){
    let value = this.getAttribute("value");
    let text = this.getAttribute("text");
    if (!text) text = value;

    // value = Function("", `"use strict";return (${value});`)();
    // text = Function("", `"use strict";return (${text});`)();

    this.showText(value, text);
  }

}



class WaveyCircleLoader extends SvgPlus {
  constructor(el = "loader"){
    super(el);
    this.styles = {display: "block"};
    let r = 10;
    let rpad = r * 1.2;

    let svg = this.createChild("svg", {
      viewBox: `${-rpad} ${-rpad} ${2*rpad} ${2*rpad}`,
      style: {
        width: "100%",
      }
    })
    let text = svg.createChild("text", {
      content: "LOADING",
      "font-size": 2.5,
      "text-anchor": "middle",
      y: 1
    })
    let main = svg.createChild("g", {style: {
      "stroke": "black",
      "fill": "none",
      "stroke-linecap": "round"
    }});
    let next = () => {
      let t = 0.5 + 0.5 * Math.cos(performance.now() / 1000);
      let theta1 = Math.PI * (2 * t + 1.5);
      let theta2 = theta1 + 2 * Math.PI * (0.5 + 0.5 * Math.sin(performance.now() / 1222)) / 3;

      let p1 = new Vector(Math.cos(theta1) * r, Math.sin(theta1)*r);
      let p2 = new Vector(Math.cos(theta2) * r, Math.sin(theta2) * r);

      let path = `<path d = "M${p1}A${r},${r},0,${theta2 - theta1 > Math.PI ? 1 : 0},1,${p2}"></path>`
      main.innerHTML = path;
      window.requestAnimationFrame(next);
    }
    window.requestAnimationFrame(next);
  }
}


class ProgressLoader extends SvgPlus {
  onconnect(){
    let r = 10;
    let rpad = r * 1.2;
    this.svg = this.createChild("svg", {
      viewBox: `${-rpad} ${-rpad} ${2*rpad} ${2*rpad}`,
      style: {
        width: "100%",
      }
    });
    this.r = r;
  }


  set progress(value) {
    let {svg, r} = this;

    svg.innerHTML = "";
    if (typeof value === "number") {
      let theta1 = Math.PI / 2;
      let theta2 = Math.PI / 2 + 2 * Math.PI * value;

      let p1 = new Vector(Math.cos(theta1) * r, -Math.sin(theta1) * r);
      let p2 = new Vector(Math.cos(theta2) * r, -Math.sin(theta2) * r);

      let html =
      svg.innerHTML = `
      <path style = "fill: none; stroke: black; stroke-linecap: round;" d = "M${p1}A${r},${r},0,${value > 0.5 ? 1 : 0},0,${p2}"></path>
      `;
      svg.createChild("text", {
        content: `${Math.round(value * 100)}%`,
        "font-size": 2.5,
        "text-anchor": "middle",
        y: 1
      });
    }
  }
}


export {CopyIcon, WaveyCircleLoader, ProgressLoader}
// SvgPlus.defineHTMLElement(CopyIcon);
