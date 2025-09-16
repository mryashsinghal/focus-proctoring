const { EventEmitter } = require("events");

class EventStore extends EventEmitter {
  constructor() {
    super();
    this.sessions = {}; // { sessionId: [events] }
  }

  addEvent(sessionId, event) {
    if (!this.sessions[sessionId]) this.sessions[sessionId] = [];
    this.sessions[sessionId].push(event);
    this.emit("newEvent", sessionId, event);
  }

  getEvents(sessionId) {
    return this.sessions[sessionId] || [];
  }

  generateReport(sessionId) {
    const events = this.getEvents(sessionId);
    // compute simple metrics
    const focusLostEvents = events.filter((e) => e.type === "LOOKING_AWAY" || e.type === "FOCUS_LOST").length;
    const noFaceEvents = events.filter((e) => e.type === "NO_FACE").length;
    const multipleFacesEvents = events.filter((e) => e.type === "MULTIPLE_FACES").length;
    const phoneEvents = events.filter((e) => e.type === "ITEM_DETECTED" && (e.details?.itemType?.toLowerCase()?.includes("phone") || e.details?.itemType?.toLowerCase()?.includes("cell"))).length;
    const notesEvents = events.filter((e) => e.type === "ITEM_DETECTED" && (e.details?.itemType?.toLowerCase()?.includes("book") || e.details?.itemType?.toLowerCase()?.includes("paper") || e.details?.itemType?.toLowerCase()?.includes("note"))).length;

    // sample scoring (configurable)
    const deductions = focusLostEvents * 2 + noFaceEvents * 3 + multipleFacesEvents * 5 + phoneEvents * 10 + notesEvents * 5;
    const score = Math.max(0, 100 - deductions);

    return {
      sessionId,
      totalEvents: events.length,
      focusLostCount: focusLostEvents,
      noFaceCount: noFaceEvents,
      multipleFacesCount: multipleFacesEvents,
      phoneDetectedCount: phoneEvents,
      notesDetectedCount: notesEvents,
      integrityScore: score,
      events,
    };
  }
}

module.exports = new EventStore();
