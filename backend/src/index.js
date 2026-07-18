import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { publicRouter } from "./routes/public.js";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { instructorRouter } from "./routes/instructor.js";
import { studentRouter } from "./routes/student.js";
import { requireAuth, requireRole } from "./middleware/auth.js";

const app = express();
const PORT = process.env.PORT || 4000;

// --- CORS setup (strict origin list, credentials-safe) ---
const rawOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (rawOrigins.length === 0) {
  console.warn(
    "\n[WARN] CORS_ORIGINS is empty. Every browser request will be rejected.\n" +
      "        Set CORS_ORIGINS in backend/.env to a comma-separated list of allowed origins.\n"
  );
}
if (rawOrigins.some((o) => o.includes("your-domain.tn"))) {
  console.warn(
    "\n[WARN] CORS_ORIGINS still contains the placeholder 'your-domain.tn'.\n" +
      "        Replace it with your real production domain(s) in backend/.env before going live.\n"
  );
}
if (rawOrigins.includes("*")) {
  console.warn(
    "\n[WARN] CORS_ORIGINS contains '*' which is incompatible with credentials:true.\n" +
      "        Wildcard will be dropped — list explicit origins instead.\n"
  );
}

const allowedOrigins = new Set(rawOrigins.filter((o) => o !== "*"));

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Non-browser callers (curl, server-to-server) send no Origin — allow.
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Public space — no auth
app.use("/api/public", publicRouter);

// Auth (login, refresh, me)
app.use("/api/auth", authRouter);

// Role-protected spaces
app.use("/api/admin", requireAuth, requireRole("admin"), adminRouter);
app.use("/api/instructor", requireAuth, requireRole("instructor", "admin"), instructorRouter);
app.use("/api/student", requireAuth, requireRole("student", "admin"), studentRouter);

// Centralized error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.publicMessage || (status === 500 ? "Internal error" : err.message),
  });
});

app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`);
  if (allowedOrigins.size > 0) {
    console.log(`CORS allowed origins: ${[...allowedOrigins].join(", ")}`);
  }
});
