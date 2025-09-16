import React, { useEffect, useRef, useState } from "react";

/**
 * Props:
 * - sessionId (string) // sessionId to use when uploading chunks and logging events
 */
export default function VideoRecorder({ sessionId = "session-123" }) {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]);

  // models references
  const modelsRef = useRef({ faceModel: null, objectModel: null });

  useEffect(() => {
    // request camera access on mount
    (async () => {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = streamRef.current;
        }
      } catch (err) {
        addLog(`Camera init error: ${err.message}`);
      }
    })();

    return () => {
      // cleanup on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const addLog = (msg) => {
    setLogs((s) => [...s, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const sendEventToBackend = async (type, message = "", details = {}) => {
    try {
      await fetch("http://localhost:4000/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, type, message, details }),
      });
    } catch (err) {
      console.warn("sendEvent error", err);
    }
  };

  const start = async () => {
    if (!streamRef.current) {
      addLog("Camera not available");
      return;
    }

    // load models if not loaded
    if (!modelsRef.current.faceModel) {
      addLog("Loading models (this may take a few seconds)...");
      try {
        // dynamic imports to avoid bundling heavy libs
        const tf = await import("@tensorflow/tfjs");
        modelsRef.current.faceModel = await import("@tensorflow-models/blazeface").then(m => m.load());
        modelsRef.current.objectModel = await import("@tensorflow-models/coco-ssd").then(m => m.load());
        addLog("Models loaded.");
      } catch (err) {
        addLog("Model load error: " + err.message);
        console.error(err);
        return;
      }
    }

    // MediaRecorder start
    try {
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, { mimeType: "video/webm" });
    } catch (err) {
      addLog("MediaRecorder not supported on this browser: " + err.message);
      return;
    }

    mediaRecorderRef.current.ondataavailable = async (e) => {
      if (e.data && e.data.size > 0) {
        const form = new FormData();
        // backend `upload` route expects field name "videoChunk"
        form.append("videoChunk", e.data, "chunk.webm");
        form.append("sessionId", sessionId);
        try {
          const res = await fetch("http://localhost:4000/api/upload", { method: "POST", body: form });
          const json = await res.json();
          // optional: store upload path
          addLog("Uploaded chunk: " + (json.filename || json.path || "ok"));
        } catch (err) {
          console.warn("upload error", err);
          addLog("Chunk upload error");
        }
      }
    };

    mediaRecorderRef.current.start(5000); // 5s chunks
    addLog("Recording started. Uploading chunks every 5s...");
    setRunning(true);

    // start detection loop
    startDetectionLoop();
    // send start event
    sendEventToBackend("INTERVIEW_STARTED", "Interview started by candidate");
  };

  const stop = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setRunning(false);
    addLog("Recording stopped.");
    sendEventToBackend("INTERVIEW_STOPPED", "Interview stopped by candidate");
  };

  // detection variables
  const detectionStateRef = useRef({
    lastFaceTimestamp: Date.now(),
    lastLookAwayStart: null,
    lookAwayThresholdMs: 5000, // 5s
    noFaceThresholdMs: 10000, // 10s
    lastObjDetectTime: 0,
    objDetectIntervalMs: 1000
  });

  const startDetectionLoop = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 640;
    canvas.height = 480;

    const loop = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        requestAnimationFrame(loop);
        return;
      }

      // draw frame
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      try {
        const faceModel = modelsRef.current.faceModel;
        const objectModel = modelsRef.current.objectModel;

        // Face detection
        const faces = await faceModel.estimateFaces(videoRef.current, false);
        const now = Date.now();

        if (!faces || faces.length === 0) {
          // no face
          if (now - detectionStateRef.current.lastFaceTimestamp > detectionStateRef.current.noFaceThresholdMs) {
            // emit no-face event and reset timestamp (throttled)
            addLog("⚠️ No face detected > 10s");
            sendEventToBackend("NO_FACE", "No face for >10s");
            detectionStateRef.current.lastFaceTimestamp = Date.now(); // throttle
          }
        } else {
          // face present
          detectionStateRef.current.lastFaceTimestamp = Date.now();
          if (faces.length > 1) {
            addLog("⚠️ Multiple faces detected");
            sendEventToBackend("MULTIPLE_FACES", "Multiple faces in frame", { count: faces.length });
          }

          // simple head/gaze heuristic: nose relative to center
          try {
            const keypoints = faces[0].landmarks || faces[0].positions || faces[0].landmarks; // vary by model version
            // BlazeFace returns topLeft/topRight & landmarks under different names; attempt to locate nose approx:
            // landmarks array often contains [x,y] points; pick a central landmark index if present
            let nose;
            if (faces[0].landmarks && faces[0].landmarks.length > 4) {
              // landmarks: [right eye, left eye, nose, mouth, ...] (index may differ)
              nose = faces[0].landmarks[2] || faces[0].landmarks[0];
            } else {
              nose = faces[0].topLeft && faces[0].bottomRight
                ? [(faces[0].topLeft[0] + faces[0].bottomRight[0]) / 2, (faces[0].topLeft[1] + faces[0].bottomRight[1]) / 2]
                : null;
            }

            if (nose) {
              const nx = nose[0], ny = nose[1];
              const dx = Math.abs(nx - canvas.width / 2) / (canvas.width / 2);
              const dy = Math.abs(ny - canvas.height / 2) / (canvas.height / 2);
              const deviation = Math.sqrt(dx * dx + dy * dy);
              // if deviated enough -> looking away
              if (deviation > 0.25) {
                // start or continue look-away timer
                if (!detectionStateRef.current.lastLookAwayStart) detectionStateRef.current.lastLookAwayStart = now;
                else if (now - detectionStateRef.current.lastLookAwayStart > detectionStateRef.current.lookAwayThresholdMs) {
                  addLog("⚠️ Looking away > 5s");
                  sendEventToBackend("LOOKING_AWAY", "Candidate looking away >5s");
                  detectionStateRef.current.lastLookAwayStart = now; // throttle
                }
              } else {
                detectionStateRef.current.lastLookAwayStart = null;
              }
            }
          } catch (err) {
            // ignore landmark errors
          }
        }

        // Object detection at a lower frequency
        if (now - detectionStateRef.current.lastObjDetectTime > detectionStateRef.current.objDetectIntervalMs) {
          detectionStateRef.current.lastObjDetectTime = now;
          try {
            const objs = await objectModel.detect(videoRef.current);
            if (Array.isArray(objs)) {
              objs.forEach((o) => {
                const cls = (o.class || "").toLowerCase();
                if (cls.includes("cell phone") || cls.includes("cellphone") || cls.includes("phone") || cls.includes("mobile")) {
                  addLog(`⚠️ Phone detected (${Math.round(o.score * 100)}%)`);
                  sendEventToBackend("ITEM_DETECTED", "Phone detected", { itemType: o.class, score: o.score, bbox: o.bbox });
                } else if (cls.includes("book") || cls.includes("paper") || cls.includes("notebook")) {
                  addLog(`⚠️ Notes / book detected (${Math.round(o.score * 100)}%)`);
                  sendEventToBackend("ITEM_DETECTED", "Book / notes detected", { itemType: o.class, score: o.score, bbox: o.bbox });
                } else if (cls.includes("laptop") || cls.includes("keyboard")) {
                  // skip laptop as allowed maybe, but still log optionally
                  // addLog(`Laptop detected (${Math.round(o.score * 100)}%)`);
                }
              });
            }
          } catch (err) {
            console.warn("object detect err", err);
          }
        }
      } catch (err) {
        console.warn("detection loop error", err);
      }

      // loop schedule
      setTimeout(() => requestAnimationFrame(loop), 250); // ~4 FPS for face + object detection at throttled rates
    };

    // start loop
    requestAnimationFrame(loop);
  };

  return (
    <div>
      <div className="text-center">
        <video ref={videoRef} autoPlay muted playsInline className="border w-96 h-72 mx-auto" />
        <div className="mt-2">
          {!running ? (
            <button onClick={start} className="bg-green-600 px-3 py-1 text-white rounded mr-2">Start Interview</button>
          ) : (
            <button onClick={stop} className="bg-red-600 px-3 py-1 text-white rounded mr-2">Stop Interview</button>
          )}
        </div>
      </div>

      <div className="mt-4 max-w-2xl mx-auto">
        <h3 className="font-semibold">Logs</h3>
        <div className="bg-gray-100 p-3 rounded h-64 overflow-y-auto">
          {logs.map((l, idx) => <div key={idx} className="text-sm">{l}</div>)}
        </div>
      </div>
    </div>
  );
}
