const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Low, JSONFile } = require("lowdb");
const shortid = require("shortid");

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.static("public"));

// DB setup
const adapter = new JSONFile("db.json");
const db = new Low(adapter);

async function initDB() {
  await db.read();
  db.data ||= { users: [], deposits: [], withdrawals: [] };
}
await initDB();

// Helpers
function calculateMining(user) {
  if (!user.lastMine) return;
  const now = Date.now();
  const hours = Math.floor((now - user.lastMine) / (1000 * 60 * 60));
  if (hours >= 12) {
    user.balance += 0.5; // 12 گھنٹے بعد 0.5 coin
    user.lastMine = now;
  }
}

// Register user
app.post("/register", async (req, res) => {
  const { username, password, referral } = req.body;
  if (db.data.users.find(u => u.username === username)) {
    return res.status(400).json({ error: "Username already exists" });
  }
  const user = {
    id: shortid.generate(),
    username,
    password,
    referral,
    balance: 0,
    lastMine: Date.now(),
    role: "user"
  };
  db.data.users.push(user);
  await db.write();
  res.json({ message: "User registered", user });
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = db.data.users.find(
    u => u.username === username && u.password === password
  );
  if (!user) return res.status(400).json({ error: "Invalid credentials" });
  calculateMining(user);
  await db.write();
  res.json({ message: "Login success", user });
});

// Deposit request
app.post("/deposit", async (req, res) => {
  const { userId, method, amount } = req.body;
  db.data.deposits.push({
    id: shortid.generate(),
    userId,
    method,
    amount,
    status: "pending"
  });
  await db.write();
  res.json({ message: "Deposit submitted" });
});

// Withdraw request
app.post("/withdraw", async (req, res) => {
  const { userId, amount, wallet } = req.body;
  const user = db.data.users.find(u => u.id === userId);
  if (!user || user.balance < amount) {
    return res.status(400).json({ error: "Insufficient balance" });
  }
  if (amount < 20) {
    return res.status(400).json({ error: "Minimum withdraw is 20 coins" });
  }
  db.data.withdrawals.push({
    id: shortid.generate(),
    userId,
    amount,
    wallet,
    status: "pending"
  });
  await db.write();
  res.json({ message: "Withdraw request submitted" });
});

// Admin: get all users
app.get("/admin/users", async (req, res) => {
  res.json(db.data.users);
});

// Admin: get deposits
app.get("/admin/deposits", async (req, res) => {
  res.json(db.data.deposits);
});

// Admin: get withdrawals
app.get("/admin/withdrawals", async (req, res) => {
  res.json(db.data.withdrawals);
});

app.listen(3000, () => console.log("Server running on port 3000"));
