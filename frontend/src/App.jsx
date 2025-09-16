import React from "react";
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import Candidate from "./pages/Candidate";
import Interviewer from "./pages/Interviewer";

export default function App() {
  return (
    <Router>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-4">Focus & Object Detection — Proctoring</h1>
        <nav className="mb-4 space-x-4">
          <Link to="/candidate" className="text-blue-600 ">Candidate</Link>
          <Link to="/interviewer" className="text-green-600">Interviewer</Link>
        </nav>
        <Routes>
          <Route path="/" element={<Navigate to="/candidate" replace />} />
          <Route path="/candidate" element={<Candidate />} />
          <Route path="/interviewer" element={<Interviewer />} />
        </Routes>
      </div>
    </Router>
  );
}
