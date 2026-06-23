import express from "express";
import multer from "multer";

// JSON body parser with generous limit for base64 image payloads
export const jsonMiddleware = express.json({ limit: '50mb' });

// Multer for audio/image uploads - increased limits to accept extremely large serialized text field parameters safely
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fieldSize: 100 * 1024 * 1024, // 100MB
  },
});
