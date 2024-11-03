import {
    GestureRecognizer,
    FilesetResolver,
  } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
  
  let gestureRecognizer;
  let runningMode = "VIDEO";
  
  // Before we can use HandLandmarker class we must wait for it to finish
  // loading. Machine Learning models can be large and take a moment to
  // get everything needed to run.
  const createGestureRecognizer = async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );
    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
        delegate: "GPU"
      },
      runningMode: runningMode
    });
  };
  createGestureRecognizer();
  

  
  export async function predictGesture(video) {
    let nowInMs = Date.now();
    if (gestureRecognizer) {
        return gestureRecognizer.recognizeForVideo(video, nowInMs);
    }
    return null;
  }
  
  