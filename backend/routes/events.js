const express = require("express");
const { v4: uuidv4 } = require("uuid");
const eventStore = require("../models/eventStore");

const router = express.Router();

/**
 * POST /api/events
 * body: { sessionId, type, message, details }
 */
router.post("/", (req, res) => {
  const { sessionId, type, message, details } = req.body;
  if (!sessionId || !type) return res.status(400).json({ error: "sessionId and type required" });

  const event = {
    id: uuidv4(),
    sessionId,
    type,
    message: message || "",
    details: details || {},
    timestamp: new Date().toISOString(),
  };

  eventStore.addEvent(sessionId, event);
  return res.status(201).json({ success: true, event });
});

// GET events for session
router.get("/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const events = eventStore.getEvents(sessionId);
  res.json(events);
});

// GET /api/events/report/:sessionId
router.get("/report/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const report = eventStore.generateReport(sessionId);
  res.json(report);
});

module.exports = router;
