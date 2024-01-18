import {SvgPlus} from "../SvgPlus/4.js"
import { IconLibrary } from "../../assets/icon-library.js";
let Icons = {
}

const DEFAULT_HEIGHT = 17.5;
for (let name in IconLibrary) {
  try {
    let svgString = IconLibrary[name];
    let svg = SvgPlus.parseSVGString(svgString);
    for (let e of svg.querySelectorAll("defs, style, script"))e.remove();
    for (let e of svg.querySelectorAll("*")) {
      if (e instanceof SVGGeometryElement) {
        e.classList.add("i-fill");
        e.classList.add(e.getAttribute("id"));
      }
    }
  
    let h = parseFloat(svg.getAttribute("viewBox").split(" ")[3]);
    svg.style.setProperty("--ws", Math.round(1000*h/DEFAULT_HEIGHT)/1000);
  
    Icons[name] = svg.outerHTML;

  } catch(e) {

  }
}
export {Icons}
