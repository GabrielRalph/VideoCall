import { SvgPlus, Vector } from "../SvgPlus/4.js";
import { SvgResize } from "../Utilities/basic-ui.js";




  /** 
   * @typedef {(String|Array|Number|Object)} DataValue 
   * @typedef {('host'|'participant'|'both')} UserType
   * */

export class SquidlyApp{
    /**
     * @param {boolean} isSender
     * @param {function(SquidlyApp): void} db
     */
    constructor(isSender, initialiser){
        Object.defineProperty(this,  "isSender", {get: () => isSender});
        initialiser(this);
    }

    /**
     * @override
     * @return {?Element}
     */
    getSideWindow(){ }


    /**
     * @override
     * @return {?Element}
     */
    getMainWindow(){ }

    /**
     * @override
     * @param {Vector} eyeData
     */
    setEyeData(eyeData){
    }

  
    /** get, gets a value in the apps database at the path specified.
     * 
     * @param {String} path the path in the database you want to access if no 
     *                      path is provided then the app's root directory is fetched.
     * @return {Promise<DataValue>} returns a promise that resolves the value in the database.
     */
    async get(path) {
    }

    /** set, sets a value in the apps database at the path specified.
     * @param {String} path same as with get.
     * @return {Promise<void>} returns a promise that resolves nothing once setting has been completed.
     * 
     */
    async set(path, value) {
    }

    /** push, gets a new push key for the path at the database
     * 
     * @param {String} path same as with get.
     * @return {String} returns the key to push a new value.
     */
    push(path){
        return (new Date()).getTime();
    }

    /** An onValue event will trigger once with the initial data stored at this location, and then trigger
     *  again each time the data changes. The value passed to the callback will be for the location at which
     *  path specifies. It won't trigger until the entire contents has been synchronized. If the location has
     *  no data, it will be triggered with a null value.
     * 
     * @param {String} path same as with get.
     * @param {(value: DataValue) => void} callback a function that will be called at the start 
     *                                                        and for every change made.
     */
    onValue(path, callback) {
    }

    /** An onChildAdded event will be triggered once for each initial child at this location, and it will be 
     *  triggered again every time a new child is added. The value passed into the callback will reflect
     *  the data for the relevant child. It is also passed a second parameter the key of the child added.
     *  For ordering purposes, it is passed a third argument which is a string containing the key of the
     *  previous sibling child by sort order, or null if it is the first child.
     * 
     * @param {String} path same as with get.
     * @param {(value: DataValue, key: String, previousKey: String) => void} callback 
     */
    onChildAdded(path, callback){
    }

     /** An onChildRemoved event will be triggered once every time a child is removed. 
      *  The value passed into the callback will be the old data for the child that was removed.
      *  A child will get removed when it is set null. It is also passed a second parameter the 
      * key of the child removed.
      * 
      * @param {String} path same as with get.
      * @param {(value: DataValue, key: String) => void} callback
      */
    onChildRemoved(path, callback){
    }

     /**An onChildChanged event will be triggered initially and when the data stored in a child 
      * (or any of its descendants) changes. Note that a single child_changed event may represent 
      * multiple changes to the child. The value passed to the callback will contain the new child 
      * contents. It is also passed a second parameter the key of the child added. For ordering 
      * purposes, the callback is also passed a third argument which is a string containing the 
      * key of the previous sibling child by sort order, or null if it is the first child.
      * @param {String} path same as with get.
      * @param {(value: DataValue, key: String, previousKey: String) => void} callback
      */
    onChildChanged(path, callback){
    }

    /** Ends all listeners and removes the app database
     * 
     */
    close(){
    }

    /**
     * @param {Vector} eyeData
     */
    set eyeData(eyeData){
        this.setEyeData(eyeData);
    }

    /**
     * @return {?Element}
     */
    get sideWindow() {
        let window = this.getSideWindow();
        if (window instanceof Element) {
            window.classList.add("app-side-window");
        } else {
            window = null
        }
        return window;
    }

    /**
     * @return {?Element}
     */
    get mainWindow() {
        let window = this.getMainWindow();
        if (window instanceof Element) {
            window.classList.add("app-main-window");
        } else {
            window = null
        }
        return window;
    }

    /**
     * @return {String}
     */
    static get description(){
        return "Some description about the app"
    }
    

    /**
     * @return {String}
     */
    static get name(){
        return "squidlyApp"
    }

    /**
     * @return {Element}
     */
    static get appIcon() {
        return new SvgPlus("div")
    }

    /**
     * @return {UserType}
     */
    static get userType() {
        return "host" // "participant" , or 
    }

    static get CSSStyleSheets(){
        return this._CSSStyleSheets;
    }

    static get styleSheets() {
        return []
    }

    static get source(){
        return new Function('console.log(import)')
    }
    
}

export {SvgPlus, Vector, SvgResize }