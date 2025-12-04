const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const app = express();

// --- MIDDLEWARE ---
// 1. Parse JSON bodies (from React Native App / Postman JSON)
app.use(express.json());
// 2. Parse URL-encoded bodies (from standard HTML forms or Postman x-www-form-urlencoded)
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/todoapp";
const JWT_SECRET = process.env.JWT_SECRET || "secret_key_change_me";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

// UPDATED SCHEMA WITH CATEGORY
const TaskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  description: { type: String },
  deadline: { type: Date },
  priority: {
    type: String,
    enum: ["Low", "Medium", "High"],
    default: "Medium",
  },
  category: { type: String, default: "General" },
  isCompleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", UserSchema);
const Task = mongoose.model("Task", TaskSchema);

const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Access Denied" });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: "Invalid Token" });
  }
};

// --- ROUTES ---

// ✅ 1. ADDED ROOT ROUTE WITH DB CHECK (Helps Debugging)
app.get("/", (req, res) => {
  const dbStatus =
    mongoose.connection.readyState === 1 ? "Connected ✅" : "Disconnected ❌";
  res.send(`API is running live! 🚀 <br/> Database Status: ${dbStatus}`);
});

app.post("/api/register", async (req, res) => {
  try {
    // Debug log to see what the server is receiving
    console.log("Register Request Body:", req.body);

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: "User already exists" });
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    console.log("Login Request Body:", req.body);

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ error: "Invalid email or password" });
    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass)
      return res.status(400).json({ error: "Invalid email or password" });
    const token = jwt.sign({ _id: user._id }, JWT_SECRET, { expiresIn: "1d" });
    res.json({ token, email: user.email });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

app.get("/api/tasks", authMiddleware, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user._id });
    res.json(tasks);
  } catch (err) {
    console.error("Fetch Tasks Error:", err);
    res.status(500).json({ error: "Error fetching tasks" });
  }
});

app.post("/api/tasks", authMiddleware, async (req, res) => {
  try {
    const { title, description, deadline, priority, category } = req.body;
    const newTask = new Task({
      userId: req.user._id,
      title,
      description,
      deadline,
      priority,
      category: category || "General",
    });
    const savedTask = await newTask.save();
    res.json(savedTask);
  } catch (err) {
    console.error("Create Task Error:", err);
    res.status(500).json({ error: "Error creating task" });
  }
});

app.put("/api/tasks/:id", authMiddleware, async (req, res) => {
  try {
    const updatedTask = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true }
    );
    res.json(updatedTask);
  } catch (err) {
    console.error("Update Task Error:", err);
    res.status(500).json({ error: "Error updating task" });
  }
});

app.delete("/api/tasks/:id", authMiddleware, async (req, res) => {
  try {
    await Task.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ message: "Task deleted" });
  } catch (err) {
    console.error("Delete Task Error:", err);
    res.status(500).json({ error: "Error deleting task" });
  }
});

// --- VERCEL CONFIGURATION ---
module.exports = app;

// Only listen if NOT in production (Vercel handles the port automatically)
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
