import React from "react";
import VideoRecorder from "../components/VideoRecorder";

export default function Candidate() {
  const sessionId = "session-123"; // in production this should be created per interview
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Candidate</h2>
      <p className="mb-4">Session ID: <strong>{sessionId}</strong></p>
      <VideoRecorder sessionId={sessionId} />
    </div>
  );
}
