let model = undefined;
let getFeatures = undefined;
let models = {
    reflected: {
        url: "/tfjs-asl-model-cr/model.json",
        getFeatures: (X, tf) => {
            let landmarks = X.result?.landmarks?.[0]
            if (Array.isArray(landmarks)) {
                let points = landmarks.map(v => [v.x, v.y, v.z]);
                let p0 = points[0];
                let centered = points.slice(1).map(p => p.map((c, i) => c - p0[i]));
                return tf.tensor3d([centered]);
            }
            return null;
        }
    },
    original: {
        url: "/tfjs-asl-model/model.json",
        getFeatures: (X, tf) => {
            let landmarks = X.result?.landmarks?.[0]
            if (Array.isArray(landmarks)) {
                let points = landmarks.map(v => [v.x, v.y, v.z]);
                return tf.tensor3d([points]);
            }
            return null;
        }
    }
}


async function importTFJS(mtype, tfjs_url = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest') {
    let root = import.meta.url.split("/").slice(0, -1).join("/")
    if (!window.tf) {
        console.log("emoji: tensor flow not imported");
        let script = document.querySelector(`script[src='${tfjs_url}']`);
        if (!script) {
            script = document.createElement("script");
            script.src = tfjs_url
            document.head.appendChild(script);
        }
        await new Promise((resolve, reject) => {
            script.addEventListener("load", resolve)
        })
    }
    model = await tf.loadLayersModel(root+models[mtype].url);
    getFeatures = (X) => models[mtype].getFeatures(X, tf);
}
importTFJS("original");



const keys = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','del','space'];



function sort_indecies(arr, cb = (a, b) => a > b ? -1 : 1) {
    return [...arr].map((x, i) => [x, i]).sort((a, b) => cb(a[0], b[0])).map(a => a[1])
}

export function predictASLLetter(input){
    if (model) {
        let X = getFeatures(input);
        if ( X != null) {
            let pred = model.predict(X);
            let buff = pred.bufferSync().values;
            let sort_y = sort_indecies(buff);
        
            let scores = {}
            for (let i = 0; i < 5; i++) {
                let yi = sort_y[i]
                scores[keys[yi]] = buff[yi]
            }
            let best = keys[sort_y[0]]
            return {scores, best};
        }
    }
    return null;
}
