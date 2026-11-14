import express from "express";
import { randomBytes } from "node:crypto";

const app = express();
const port = 3001;

app.use(express.json());

// Dev-only CORS: the frontend is served by the Vite dev server on another port.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

type User = { email: string; password: string; name: string };

const users: User[] = [
  { email: "demo@example.com", password: "password", name: "Demo User" },
];

// In-memory sessions: token -> email
const sessions = new Map<string, string>();

type Item = {
  id: number;
  name: string;
  category: string;
  value: number;
  date: string;
};

const items: Item[] = [
  { id: 1, name: "Alpha project", category: "Development", value: 1200, date: "2026-11-01" },
  { id: 2, name: "Beta campaign", category: "Marketing", value: 3400, date: "2026-11-03" },
  { id: 3, name: "Gamma server", category: "Infrastructure", value: 560, date: "2026-10-28" },
  { id: 4, name: "Delta design", category: "Design", value: 890, date: "2026-11-05" },
  { id: 5, name: "Epsilon support", category: "Support", value: 2100, date: "2026-11-07" },
  { id: 6, name: "Zeta research", category: "Research", value: 1750, date: "2026-10-30" },
  { id: 7, name: "Eta migration", category: "Infrastructure", value: 4300, date: "2026-11-09" },
  { id: 8, name: "Theta content", category: "Marketing", value: 640, date: "2026-11-10" },
  { id: 9, name: "Iota testing", category: "Development", value: 980, date: "2026-11-11" },
  { id: 10, name: "Kappa release", category: "Development", value: 2600, date: "2026-11-12" },
];

function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const header = req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const email = sessions.get(token);
  if (!email) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.locals.email = email;
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/login", (req, res) => {
  const { email, password } = (req.body ?? {}) as {
    email?: string;
    password?: string;
  };
  const user = users.find((u) => u.email === email && u.password === password);
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const token = randomBytes(24).toString("hex");
  sessions.set(token, user.email);
  res.json({ token, user: { email: user.email, name: user.name } });
});

app.post("/api/logout", requireAuth, (req, res) => {
  const token = (req.header("Authorization") ?? "").slice("Bearer ".length);
  sessions.delete(token);
  res.status(204).end();
});

app.get("/api/me", requireAuth, (_req, res) => {
  const user = users.find((u) => u.email === res.locals.email);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ email: user.email, name: user.name });
});

app.get("/api/stats", requireAuth, (_req, res) => {
  const totalValue = items.reduce((sum, item) => sum + item.value, 0);
  const categoryCount = new Set(items.map((item) => item.category)).size;
  const latestDate = items.reduce(
    (max, item) => (item.date > max ? item.date : max),
    items[0].date,
  );
  res.json({
    totalItems: items.length,
    totalValue,
    categoryCount,
    averageValue: Math.round(totalValue / items.length),
    latestDate,
  });
});

app.get("/api/items", requireAuth, (_req, res) => {
  res.json(items);
});

app.listen(port, () => {
  console.log(`backend listening on http://localhost:${port}`);
});
