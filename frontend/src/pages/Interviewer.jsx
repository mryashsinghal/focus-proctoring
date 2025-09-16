import React, { useEffect, useState } from "react";
import socket from "../utils/socket";

export default function Interviewer() {
  const [sessionId, setSessionId] = useState("session-123");
  const [events, setEvents] = useState([]);
  const [report, setReport] = useState(null);

  useEffect(() => {
    // when we join a session, server will send eventLogs
    socket.emit("join-session", sessionId);

    socket.on("eventLogs", (logs) => {
      setEvents(logs);
    });

    socket.on("eventUpdate", ({ sessionId: sid, event }) => {
      if (sid === sessionId) {
        setEvents((prev) => [...prev, event]);
      }
    });

    return () => {
      socket.off("eventLogs");
      socket.off("eventUpdate");
    };
  }, [sessionId]);

  const fetchReport = async () => {
    try {
      const res = await fetch(`https://focus-proctoring-backend.onrender.com/api/events/report/${sessionId}`);
      const json = await res.json();
      setReport(json);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Interviewer</h2>

      <div className="mb-4">
        <label className="mr-2">Session ID: </label>
        <input value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="border p-1" />
        <button className="ml-2 bg-blue-600 text-white px-3 py-1 rounded" onClick={fetchReport}>Fetch Report</button>
      </div>

      <div className="mb-6">
        <h3 className="font-semibold">Real-time events</h3>
        <ul className="list-disc ml-6">
          {events.map((ev, i) => (
            <li key={i}>
              <strong>{ev.type}</strong> — {ev.message} <em>({new Date(ev.timestamp).toLocaleTimeString()})</em>
            </li>
          ))}
        </ul>
      </div>

      {report && (
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-lg font-semibold">Proctoring Report</h3>
          <p><strong>Session:</strong> {report.sessionId}</p>
          <p><strong>Total Events:</strong> {report.totalEvents}</p>
          <p><strong>Focus Lost Count:</strong> {report.focusLostCount}</p>
          <p><strong>No Face Count:</strong> {report.noFaceCount}</p>
          <p><strong>Multiple Faces:</strong> {report.multipleFacesCount}</p>
          <p><strong>Phone Detected:</strong> {report.phoneDetectedCount}</p>
          <p><strong>Notes Detected:</strong> {report.notesDetectedCount}</p>
          <p><strong>Integrity Score:</strong> {report.integrityScore}</p>

          <h4 className="mt-3 font-semibold">Events</h4>
          <ul className="list-disc ml-6">
            {report.events.map((e, i) => <li key={i}>{e.type} — {e.message} <small>({new Date(e.timestamp).toLocaleTimeString()})</small></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
