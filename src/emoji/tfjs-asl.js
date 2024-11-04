let model = undefined;
async function importTFJS(){
    if (!window.tf) {
        let script = document.querySelector("script[src='https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest'");
        if (!script) {
            script = document.createElement("script");
            document.head.appendChild(script);
        }
        await new Promise((resolve, reject) => {
            script.addEventListener("load", resolve)
        })
    }
    model = await tf.loadLayersModel("./tfjs-asl-model/model.json");
}
importTFJS();



const keys = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','del','space'];

function getFeatures(X) {
    let landmarks = X.result?.landmarks?.[0]
    if (Array.isArray(landmarks)) {
        return tf.tensor3d([landmarks.map(v => {
            return [v.x, v.y, v.z];
        })]);
    }
    return null;
}

function sort_indecies(arr, cb = (a, b) => a > b ? -1 : 1) {
    return [...arr].map((x, i) => [x, i]).sort((a, b) => cb(a[0], b[0])).map(a => a[1])
}

export function predictASLLetter(input){
    let X = getFeatures(input);
    if (X != null) {
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
    } else {
        return null;
    }
}
