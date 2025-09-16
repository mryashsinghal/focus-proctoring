const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// configure multer to store chunks
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const sessionId = req.body.sessionId || "anon";
    const id = uuidv4();
    const ext = path.extname(file.originalname) || ".webm";
    cb(null, `${sessionId}-${Date.now()}-${id}${ext}`);
  }
});

const upload = multer({ storage });

/**
 * POST /api/upload
 * form-data: videoChunk (file), sessionId
 */
router.post("/", upload.single("videoChunk"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "videoChunk is required" });
  res.json({ success: true, filename: req.file.filename, path: `/uploads/${req.file.filename}` });
});

module.exports = router;
