import {Vector, parseVector} from "./vector.js";

const SVGTagNames = {
  animate: true,
  animateMotion: true,
  animateTransform: true,
  circle: true,
  clipPath: true,
  "color-profile": true,
  defs: true,
  desc: true,
  discard: true,
  ellipse: true,
  feBlend: true,
  feColorMatrix: true,
  feComponentTransfer: true,
  feComposite: true,
  feConvolveMatrix: true,
  feDiffuseLighting: true,
  feDisplacementMap: true,
  feDistantLight: true,
  feDropShadow: true,
  feFlood: true,
  feFuncA: true,
  feFuncB: true,
  feFuncG: true,
  feFuncR: true,
  feGaussianBlur: true,
  feImage: true,
  feMerge: true,
  feMergeNode: true,
  feMorphology: true,
  feOffset: true,
  fePointLight: true,
  feSpecularLighting: true,
  feSpotLight: true,
  feTile: true,
  feTurbulence: true,
  filter: true,
  foreignObject: true,
  g: true,
  hatch: true,
  hatchpath: true,
  image: true,
  line: true,
  linearGradient: true,
  marker: true,
  mask: true,
  mesh: true,
  meshgradient: true,
  meshpatch: true,
  meshrow: true,
  metadata: true,
  mpath: true,
  path: true,
  pattern: true,
  polygon: true,
  polyline: true,
  radialGradient: true,
  rect: true,
  script: true,
  set: true,
  solidcolor: true,
  stop: true,
  style: true,
  svg: true,
  switch: true,
  symbol: true,
  text: true,
  textPath: true,
  title: true,
  tspan: true,
  unknown: true,
  use: true,
  view: true,
};

function warn(e){
  console.warning(e)
}

const ObjectClass = Object.getPrototypeOf(Object);

function isNonNullObject(obj) {return typeof obj === "object" && obj !== null;}

function make(name){
  let element = null;
  if (name in SVGTagNames) {
    element = document.createElementNS("http://www.w3.org/2000/svg", name);
  } else if (typeof name === "string"){
    element = document.createElement(name);
  }
  return element;
}
const Points = make("svg");

/*
e.g.
c1 = C: C<-B<-A
c2 = B:    B<-A
c2 is a sub class of c1 i.e. isSubClass(c2, c1) => true

an instance c of C is an instanceof B as B is a subclass of C
*/
function isSubClass(subcls, cls) {
  while (cls && subcls !== cls) {
    cls = Object.getPrototypeOf(cls);
  }
  return cls === subcls;
}

function is(obj, cdef, plus = "__+") {
  let res = false;
  if (isNonNullObject(obj)) {
    res = isSubClass(cdef, obj[plus]);
  }
  return res;
}

function printChain(cdef) {
  let i = 5;
  let str = "";
  while (cdef && i > 0) {
    if (str) str += " <- ";
    // console.log(cdef);
    let name = cdef.name;
    if (cdef === ObjectClass) {
      str += "o";
      break;
    }
    str += name;
    cdef = Object.getPrototypeOf(cdef);
    i--;
  }
  return str;
}

/*  Copies properties of prototype onto a object.
    If a property exists then it is set otherwise
    the property is defined.
*/
function addPrototype(cdef, obj, plus = "__+") {
  if (obj == null || cdef == null) return;
  let proto = cdef.prototype;
  // console.log("+", { proto.prototype });

  // for every property of the prototype
  let protoPropNames = Object.getOwnPropertyNames(proto);
  for (let propName of protoPropNames) {
    var prop = Object.getOwnPropertyDescriptor(proto, propName);

    if (propName == 'constructor'){
      // if the property is the constructor we will store it in the object
      obj[plus] = proto.constructor;
    } else {
      // otherwise the property isn't the constructor
      if (propName in obj) {
        // if the property exists then try set it
        try {
          obj[propName] = proto[propName]
        } catch(e) {
          warn("error setting " + propName)
        }
      } else {
        // if it doesn't exist then define it
        Object.defineProperty(obj, propName, prop);
      }
    }
  }
}

/* Extends the prototype of one class onto another object
   by copying all properties of that prototype onto the object.
*/
function extend(obj, cdef, plus = "__+"){
  if (isNonNullObject(obj)) {
      if (!(plus in obj)) obj[plus] = ObjectClass;

    // extend recursively down the prototype chain until the objent is an
    // instance of the prototype
    if (extendable(obj, cdef, plus)) {
      extend(obj, Object.getPrototypeOf(cdef), plus);
      addPrototype(cdef, obj, plus);
      return true;
    }
  }
  return false;
}

/*
e.g. consider the following chains
C<-B<-A<-o
X<-Y<-A<-o
B is extendable by C but not by X or Y
*/
function extendable(obj, cdef, plus = "__+") {
  let res = false;
  if (isNonNullObject(obj)) {
    if (!is(obj, cdef, plus)) {
      res = isSubClass(obj[plus], cdef);
    }
  }
  return res;
}


class SvgPlus{
  constructor(el){
    el = SvgPlus.parseElement(el)
    if (el == null) {
      throw new Error("null element")
    }
    let proto = Object.getPrototypeOf(this);
    let res = extend(el, proto.constructor);
    if (!res) {
      throw "failed to extend element with constructor chain\n" + printChain(el["__+"]) + "\n with \n" + printChain(proto.constructor);
    }
    return el;
  }


  // ~~~~~~~~~~~~~~~~~~~~~ HELPFUL SET GET PROPERTIES ~~~~~~~~~~~~~~~~~~~~~~~~
  set styles(styles){
    if (typeof styles !== 'object'){
      throw `Error setting styles:\nstyles must be set using an object, not ${typeof styles}`
      return
    }
    this._style_set = typeof this._style_set != 'object' ? {} : this._style_set;
    for (var style in styles){
      var value = `${styles[style]}`
      if (value != null){
        let set = true;
        try{
          this.style.setProperty(style, value);
        }catch(e){
          set = false;
          throw e
        }
        if (set){
          this._style_set[style] = value;
        }
      }
    }
  }

  get styles(){
    return this._style_set;
  }

  set class(val){
    this.props = {class: val}
  }

  get class(){
    return this.getAttribute('class');
  }

  set props (props){
    if (typeof props !== 'object'){
      throw `Error setting styles:\nstyles must be set using an object, not ${typeof props}`
      return
    }
    this._prop_set = typeof this._prop_set != 'object' ? {} : this._prop_set;
    for (var prop in props){
      var value = props[prop]
      if (prop == 'style' || prop == 'styles'){
        this.styles = value
      }else if (prop == "innerHTML" || prop == "content") {
        this.innerHTML = value;
      }else if (value != null){
        let set = true;
        try{
          this.setAttribute(prop,value);
        }catch(e){
          set = false;
          throw e
        }
        if (set){
          this._prop_set[prop] = value;
        }
      }
    }
  }

  get props(){
    return this._prop_set;
  }

  get bbox(){
    let bbox = this.getBoundingClientRect();
    let pos = new Vector(bbox);
    let size = new Vector(bbox.width, bbox.height);
    return [pos, size];
  }

  get svgBBox(){
    let bbox = this.getBBox();
    let pos = new Vector(bbox);
    let size = new Vector(bbox.width, bbox.height);
    return [pos, size];
  }



  createChild(){
    return this.makeChild.apply(this, arguments)
  }

  makeChild(){
    let Name = arguments[0];
    let child;

    if (Name instanceof Function && Name.prototype instanceof SvgPlus){
      if (arguments.length > 1){
        child = new Name(arguments[1]);
      }else{
        child = new Name();
      }
    }else{
      child = new SvgPlus(Name);
      try{
        if (arguments[1]){
          child.props = arguments[1];
        }
      }catch(e){
        console.error(e);
      }
    }

    this.appendChild(child);
    return child;
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~  HELPFUL FUNCTIONS  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  saveSvg(name = 'default'){
    let output = this.outerHTML;

    // Remove excess white space
    output = output.replace(/ ( +)/g, '').replace(/^(\n)/gm, '')
    output = output.replace(/></g, '>\n<')

    //Autoindent
    output = output.split('\n');
    var depth = 0;
    var newOutput = ''
    for (var i = 0; i < output.length; i++){
      depth += (output[i].search(/<\/(g|svg)>/) == -1)?0:-1;
      for (var j = 0; j < depth; j++){
        newOutput += '\t'
      }
      newOutput += output[i] + '\n';
      depth += (output[i].search(/<(g|svg)(\s|\S)*?>/) == -1)?0:1;
    }


    var blob = new Blob([newOutput], {type: "text/plain"});
    var url = null;

    if (url == null){
      url = window.URL.createObjectURL(blob);

      var a = document.createElement('a')
      a.setAttribute('href', url)
      a.setAttribute('download', name + '.svg')
      document.body.prepend(a);
      a.click()
      a.remove();
    }
  }

  watch(config, callback){
    this._mutationObserver = new MutationObserver((mutation, observer) => {
      if (!(callback instanceof Function)){
        if (this.onmutation instanceof Function){
          this.onmutation(mutation, observer);
        }else{
          return;
        }
      }else{
        callback(mutation, observer);
      }
    })

    this._mutationObserver.observe(this, config);
  }

  stopWatch(){
    if (this._mutationObserver instanceof MutationObserver){
      this._mutationObserver.disconnect();
    }
  }

  getVectorAtLength(l) {
    return new Vector(this.getPointAtLength(l));
  }

  isVectorInFill(x, y) {
    return this.isPointInFill(this.makeSVGPoint(x, y));
  }

  isVectorInStroke(x, y) {
    return this.isPointInStroke(this.makeSVGPoint(x, y));
  }

  makeSVGPoint(x, y) {
    let v = new Vector(x, y);
    let p = Points.createSVGPoint();
    p.x = v.x;
    p.y = v.y;
    return p;
  }

  /**
    Wave transistion

    @param update update(progress) function to be called on each animation frame
      update function will be passed a number from 0 to 1 which will be the
      ellapsed time mapped to a wave.

    @param dir
      true:  0 -> 1,
      false: 1 -> 0

    @param duration in milliseconds


  */
  async waveTransition(update, duration = 500, dir = false){
    if (!(update instanceof Function)) return 0;

    duration = parseInt(duration);
    if (Number.isNaN(duration)) return 0;

    return new Promise((resolve, reject) => {
      let t0;
      let end = false;

      let next = (t) => {
        let dt = t - t0;

        if (dt > duration) {
          end = true;
          dt = duration;
        }

        let theta = Math.PI * ( dt / duration  +  (dir ? 1 : 0) );
        let progress =  ( Math.cos(theta) + 1 ) / 2;

        let stop = update(progress);

        if (!end && !stop){
          window.requestAnimationFrame(next);
        }else{
          resolve(progress);
        }
      };
      window.requestAnimationFrame((t) => {
        t0 = t;
        window.requestAnimationFrame(next);
      })
    })
  }


  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~ STATIC METHODS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  static make(name){
    return make(name);
  }

  static parseElement(input = null) {
    let parsed = input;

    // if input is a string
    if (typeof input === "string") {
      // first get the element by id from the document
      parsed = document.getElementById(input);

      // if that does not work try and make an element with tag name of input
      if (parsed == null) {
        parsed = SvgPlus.make(input);
      }
    }

    if (!(parsed instanceof Element)) {
      parsed = null;
    }

    return parsed;
  }

  static parseSVGString(string){
    let parser = new DOMParser()
    let doc = parser.parseFromString(string, "image/svg+xml");
    let errors = doc.getElementsByTagName('parsererror');
    if (errors && errors.length > 0){
      throw doc
    }
    let psvg = doc.firstChild;
    let svg = make("svg");
    svg.setAttribute("viewBox", psvg.getAttribute("viewBox"));
    svg.innerHTML = psvg.innerHTML;
    return svg;
  }

  static is(el, cdef) {
    return is(el, cdef);
  }

  static extendable(el, cdef) {
    return extendable(el, cdef);
  }

  static defineHTMLElement(classDef){
    let className = classDef.name.replace(/(\w)([A-Z][^A-Z])/g, "$1-$2").toLowerCase();
    let props = Object.getOwnPropertyDescriptors(classDef.prototype);

    let setters = classDef.observedAttributes;

    let htmlClass = class extends HTMLElement{
      constructor(){
        super();
        if (!SvgPlus.is(this, classDef)) {
          new classDef(this);
        }
      }

      applyAttributes(){
        for (let setter of setters) {
          let value = this.getAttribute(setter);
          if (value != null) {
            this[setter] = value;
          }
        }
      }

      connectedCallback(){
        if (this.isConnected) {
          if (this.onconnect instanceof Function) {
            this.onconnect();
          }
        }
      }

      disconnectedCallback(){
        if (this.ondisconnect instanceof Function) {
          this.ondisconnect();
        }
      }

      adoptedCallback(){
        if (this.onadopt instanceof Function) {
          this.onadopt();
        }
      }

      attributeChangedCallback(name, oldv, newv){
        this[name] = newv;
      }

      static get observedAttributes() { return setters; }
    }

    console.log(className+ " custom element defined");
    customElements.define(className, htmlClass);
  }

  static isSubClass(subcls, cls) {
    return isSubClass(subcls, cls);
  }

  static get SVGTagNames() {
    return SVGTagNames;
  }
}

export {Vector, parseVector, SvgPlus}
