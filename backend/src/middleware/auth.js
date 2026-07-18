import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "change-me-in-production";

export function signToken(payload, opts = {}) {
  // 30-minute expiry — matches frontend inactivity timeout.
  return jwt.sign(payload, SECRET, { expiresIn: "30m", ...opts });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }
  try {
    req.user = jwt.verify(header.slice(7), SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
