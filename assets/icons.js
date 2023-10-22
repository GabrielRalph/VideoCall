import {SvgPlus} from "../SvgPlus/4.js"
let Icons = {
  video: "",
  novideo: "",
  mute: "",
  unmute: "",
  calibrate: "",
  hide: "",
  end: "",
  key: "",
}

const DEFAULT_HEIGHT = 17.5;
for (let name in Icons) {
  let svgString = await (await fetch(`../assets/i_${name}.svg`)).text();
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
}
export {Icons}
