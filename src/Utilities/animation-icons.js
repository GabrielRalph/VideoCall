import {SvgPath, SvgPlus, Vector} from "../SvgPlus/svg-path.js"
import {HideShow, FloatingBox} from "./basic-ui.js"
import {Icons} from "./icons.js"

function delay(t) {
  return new Promise(function(resolve, reject) {
    setTimeout(resolve, t);
  });
}
class CopyIcon extends SvgPlus {
  constructor(el = "copy-icon"){
    super(el);
    this.innerHTML = "";
    this.svg = new SvgPlus("svg");
    this.svg.props = {
      viewBox: "0 0 0.1 100",
      class: "copy-text",
      styles: {
        position: "fixed",
      }
    };
    this.icon = this.createChild("div", {class: "icon", content: Icons["key"]});
  }

  async showText(value = this.getAttribute("value"), textValue = this.getAttribute("text")) {
    if (!textValue) textValue = value;
    if (this.moving) return;
    this.moving = true;

    if (this.hideText instanceof Function) {
      this.hideText();
    } else {
      let {svg} = this;
      document.body.appendChild(svg);
      let [pos, size] = this.bbox;
      let [ipos, isize] = this.icon.bbox;
      let h = size.y;
      let y = pos.y;
      let w = isize.x;
      let x = ipos.x;
      

      let left = 0;
      if (pos.x < window.innerWidth/2) left = 1;
      if (this.flip) left = left == 1 ? 0 : 1;
      
      svg.toggleAttribute("left", left == 1)
      svg.styles = {
        top: `${y + h/2}px`,
        left: `${x + w * left}px`,
        transform: `translate(${-100*(1-left)}%, -50%)`,
      };

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


      let hide = async () => {
        this.hideText = null;
        this.moving = true;
        await this.waveTransition((a) => {
          let [tpos, tsize] = text.svgBBox;
          let width = (tsize.x + margin) * a + 0.01;
          svg.props = {viewBox: `0 0 ${width} 100`};
        }, 300, false);
        svg.remove();
        this.moving = false;
      }

      if (await this.copy(value)) {
        await this.waveTransition((a) => {
          this.styles = {opacity: a};
        }, 100, false);
        await this.waveTransition((a) => {
          this.styles = {opacity: a};
        }, 100, true);
        await delay(500);
        await hide();
        this.moving = false;
      } else {
        this.moving = false;
        this.hideText = hide;
      }
    }
  }

  async copy(text){
    let success = false;
    if (!navigator.clipboard) {
      // success = fallbackCopyTextToClipboard(text);
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
    this.showText();
  }

}

function createPiePath(r, angle, center = new Vector(0), startAngle = 90, ccw = true) {
  let r1 = new Vector(r, 0);
  r1 = r1.rotate(-Math.PI * startAngle / 180)
  let r2 = r1.rotate(-Math.PI * angle / 180);
  if (angle >= 360) return `M${center.add(r1)}A${r},${r},0,0,0,${r1.rotate(-Math.PI).add(center)}A${r},${r},0,0,0,${r1.add(center)}`
  else return `M${center.add(r1)}A${r},${r},0,${(ccw && angle>180) || (!ccw && angle<180)?1:0},${ccw?0:1},${center.add(r2)}L${center}Z`;

}

class FileLoadIcon extends HideShow {
  constructor(el = "file-load-icon"){
    super(el)
    this.innerHTML = Icons["file-mask"];
    this.svg = new SvgPlus(this.firstChild);
    this.styles = {display: null};
    this.path = this.svg.createChild("path", {class: "i-fill", mask: "url(#myMask)"})
  }

  set progress(value){
    this.path.setAttribute("d", createPiePath(7, value*360, new Vector(13.2/2, 17.5/2)))
  }
}

class WaveyCircleLoader extends FloatingBox {
  constructor(el = "loader"){
    super(el);
    this.pointer_events = false;
    this.styles = {"pointer-events": "none"}
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
    this.setText = (value) => {
      text.innerHTML = value;
    }
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


export {CopyIcon, WaveyCircleLoader, ProgressLoader, FileLoadIcon}
