importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.13.0/dist/tf.min.js');
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd');
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow-models/face-landmarks-detection');

let cocoModel, faceModel;
let width = 0, height = 0;
let lastNoFaceStart = null, lastLookAwayStart = null;

function sendEvent(event) {
  postMessage(event);
}

self.onmessage = async function(e) {
  const data = e.data;
  if (data.type === 'init') {
    try {
      cocoModel = await cocoSsd.load();
      faceModel = await faceLandmarksDetection.load(faceLandmarksDetection.SupportedPackages.mediapipeFacemesh);
      console.log('models loaded');
    } catch (e) {
      console.error('model load fail', e);
    }
  } else if (data.type === 'attach') {
    width = data.width;
    height = data.height;
  } else if (data.type === 'frame') {
    const arrBuf = data.image;
    const blob = new Blob([arrBuf], { type: 'image/jpeg' });
    const imgBitmap = await createImageBitmap(blob);

    // run face detection
    let faces = [];
    try {
      faces = await faceModel.estimateFaces({ input: imgBitmap, returnTensors: false, flipHorizontal: false });
    } catch (e) { console.warn('face error', e); }

    if (!faces || faces.length === 0) {
      if (!lastNoFaceStart) lastNoFaceStart = Date.now();
      else if (Date.now() - lastNoFaceStart > 10000) {
        sendEvent({ interviewId: 'local', timestamp: new Date().toISOString(), eventType: 'NO_FACE', details: { duration: Date.now() - lastNoFaceStart } });
        lastNoFaceStart = Date.now();
      }
    } else {
      lastNoFaceStart = null;
      if (faces.length > 1) {
        sendEvent({ interviewId: 'local', timestamp: new Date().toISOString(), eventType: 'MULTIPLE_FACES', details: { count: faces.length } });
      }
      // head-pose heuristic: compare nose to image center
      try {
        const face = faces[0];
        const keypoints = face.scaledMesh || face.keypoints;
        const nose = keypoints[1] || keypoints[4] || keypoints[0];
        const nx = nose[0], ny = nose[1];
        const dx = (nx - width / 2) / (width / 2);
        const dy = (ny - height / 2) / (height / 2);
        const ang = Math.sqrt(dx * dx + dy * dy);
        if (ang > 0.25) {
          if (!lastLookAwayStart) lastLookAwayStart = Date.now();
          else if (Date.now() - lastLookAwayStart > 5000) {
            sendEvent({ interviewId: 'local', timestamp: new Date().toISOString(), eventType: 'LOOKING_AWAY', details: { duration: Date.now() - lastLookAwayStart } });
            lastLookAwayStart = Date.now();
          }
        } else {
          lastLookAwayStart = null;
        }
      } catch (e) { }
    }

    // object detection at low frequency (every ~1s): simple throttle
    if (!self._lastObj || Date.now() - self._lastObj > 1000) {
      self._lastObj = Date.now();
      try {
        const objs = await cocoModel.detect(imgBitmap);
        objs.forEach(o => {
          const className = o.class.toLowerCase();
          if (['cell phone', 'book', 'cellphone', 'mobile phone', 'laptop', 'potted plant'].includes(className) || className.includes('phone')) {
            if (o.score > 0.5) {
              sendEvent({ interviewId: 'local', timestamp: new Date().toISOString(), eventType: 'ITEM_DETECTED', details: { itemType: o.class, score: o.score, bbox: o.bbox } });
            }
          }
        });
      } catch (e) { console.warn('obj err', e); }
    }

    imgBitmap.close();
  }
}