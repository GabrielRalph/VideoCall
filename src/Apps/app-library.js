import { SquidlyApp } from "./app-class.js";
const APPS_FILES = [
    "https://eyepaint.squidly.com.au/index.js",
    "/TestQuiz/quiz-app.js",
    "http://127.0.0.1:5502/index.js",
]

let Apps = {};
let root = import.meta.url.split("/").slice(0, -1).join("/")
for (let url of APPS_FILES) {
    try {
        if (url.charAt(0) == "/") {
            url = root + url;
        }
        let base = url.split("/").slice(0, -1).join("/")
        let module = (await import(url));
        let app = module.default
        if (Array.isArray(app.styleSheets) && app.styleSheets.length > 0) {
            let css = [];
            for (let src of app.styleSheets) {
                try {
                    let ss = new CSSStyleSheet();
                    ss.replaceSync(await (await fetch(base + "/" + src)).text())
                    css.push(ss)
                } catch (e) {
                    console.log(`The app stylesheet ${src} was unable to load.`, e)
                }
            }
            console.log(css);
            app._CSSStyleSheets = css;
        }
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