import {SvgPlus} from "./SvgPlus/4.js"
function delay(t) {
  return new Promise(function(resolve, reject) {
    setTimeout(resolve, t);
  });
}
class CopyIcon extends SvgPlus {
  onconnect(){

    let icon = this.innerHTML;
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

  onclick(){
    let value = this.getAttribute("value");
    let text = this.getAttribute("text");
    if (!text) text = value;

    value = Function("", `"use strict";return (${value});`)();
    text = Function("", `"use strict";return (${text});`)();

    this.showText(value, text);
  }

}

export {CopyIcon}
// SvgPlus.defineHTMLElement(CopyIcon);
