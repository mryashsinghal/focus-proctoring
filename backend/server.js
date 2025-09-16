const express = require("express");
const http = require("http");
const cors = require("cors");
const morgan = require("morgan");
const { Server } = require("socket.io");
const path = require("path");

const eventRoutes = require("./routes/events");
const uploadRoutes = require("./routes/upload");
const eventStore = require("./models/eventStore");

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Routes
app.use("/api/events", eventRoutes);
app.use("/api/upload", uploadRoutes);

// Serve uploaded chunks (static)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);

  socket.on("join-session", (sessionId) => {
    const logs = eventStore.getEvents(sessionId);
    socket.emit("eventLogs", logs);
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

// When eventStore emits a new event, broadcast
eventStore.on("newEvent", (sessionId, event) => {
  io.emit("eventUpdate", { sessionId, event });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Backend listening at http://localhost:${PORT}`);
});
