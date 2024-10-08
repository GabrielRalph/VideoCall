import { SquidlyApp } from "./app-class.js";
const APPS_FILES = [
    "./DrawApp/draw-app.js",
    "https://eyepaint.squidly.com.au/index.js",
    "http://127.0.0.1:5502/index.js",
]

let Apps = {};
for (let url of APPS_FILES) {
    try {
        let app = (await import(url)).default
        Apps[app.name] = app;
    } catch (e) {
        console.log(`The app at ${url} was unable to load.`, e)
    }
}

function getApps(){
    let apps = {};
    for (let key in Apps) {
        apps[key] = Apps[key];
    }
    return apps;
}

export {getApps, SquidlyApp}