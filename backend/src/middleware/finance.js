import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "change-me-in-production";
const SCOPE = "finance";

// Short-lived (15 min) scoped token, issued only after bcrypt.compare succeeds
// on the caller-supplied finance password. Signed with the same JWT_SECRET but
// scoped so a normal admin JWT can never satisfy the finance gate.
export function signFinanceToken(sub) {
  return jwt.sign({ sub, scope: SCOPE }, SECRET, { expiresIn: "15m" });
}

// Second-factor middleware. Runs AFTER the normal admin auth on /finance*.
// Rejects if the X-Finance-Token header is missing, invalid, expired, or not
// scoped to finance — even for callers with a valid admin JWT.
export function requireFinanceUnlock(req, res, next) {
  const token = req.headers["x-finance-token"];
  if (!token || typeof token !== "string") {
    return res.status(423).json({ error: "Finance module locked" });
  }
  try {
    const payload = jwt.verify(token, SECRET);
    if (payload.scope !== SCOPE) {
      return res.status(423).json({ error: "Finance module locked" });
    }
    req.financeUnlockedFor = payload.sub;
    next();
  } catch {
    return res.status(423).json({ error: "Finance module locked" });
  }
}
