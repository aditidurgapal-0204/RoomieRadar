// server.js
require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cookieParser = require("cookie-parser");
const path = require("path");

// Models
const Message = require("./backend/models/Message");

// Routes
const authRoutes = require("./backend/routes/auth");
const profileRoutes = require("./backend/routes/profile");
const chatRoutes = require("./backend/routes/chat");

// Database
const connectDB = require("./backend/config/db");
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --------------------------------------------------
// Static files
// --------------------------------------------------

// Serve HTML files directly
app.use(
  express.static(
    path.join(__dirname, "frontend", "static", "templates")
  )
);

// Serve CSS / JS / images
app.use(
  express.static(
    path.join(__dirname, "frontend", "static")
  )
);

app.use(
  "/images",
  express.static(
    path.join(__dirname, "frontend", "static", "images")
  )
);

// Favicon
app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

// --------------------------------------------------
// API routes
// --------------------------------------------------

app.use("/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/chat", chatRoutes);

// --------------------------------------------------
// Friendly page routes
// --------------------------------------------------

const templatesPath = path.join(
  __dirname,
  "frontend",
  "static",
  "templates"
);

app.get("/", (req, res) => {
  res.sendFile(path.join(templatesPath, "login.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(templatesPath, "login.html"));
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(templatesPath, "signup.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(templatesPath, "dashboard.html"));
});

app.get("/profile", (req, res) => {
  res.sendFile(path.join(templatesPath, "profile.html"));
});

app.get("/preferences", (req, res) => {
  res.sendFile(path.join(templatesPath, "preferences.html"));
});

app.get("/matches", (req, res) => {
  res.sendFile(path.join(templatesPath, "matches.html"));
});

app.get("/profile_view", (req, res) => {
  res.sendFile(path.join(templatesPath, "profile_view.html"));
});

// --------------------------------------------------
// SOCKET.IO CHAT SYSTEM
// --------------------------------------------------

const onlineUsers = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Register the logged-in user
  socket.on("registerUser", (userId) => {
    if (!userId) return;

    const normalizedUserId = String(userId);

    onlineUsers[normalizedUserId] = socket.id;

    console.log(
      `User ${normalizedUserId} connected with socket ${socket.id}`
    );
  });

  // Private message
  socket.on(
    "privateMessage",
    async ({ recipientId, message }) => {
      try {
        if (!recipientId || !message) return;

        const normalizedRecipientId = String(recipientId);
        const cleanMessage = String(message).trim();

        if (!cleanMessage) return;

        // Find sender from socket
        const senderId = Object.keys(onlineUsers).find(
          (userId) => onlineUsers[userId] === socket.id
        );

        if (!senderId) {
          console.log(
            "Sender not registered for socket:",
            socket.id
          );
          return;
        }

        // Generate same chat ID used by the history controller
        const chatId = [
          String(senderId),
          String(normalizedRecipientId),
        ]
          .sort()
          .join("_");

        const savedMessage = await Message.create({
          chatId,
          senderId,
          recipientId: normalizedRecipientId,
          text: cleanMessage,
          message: cleanMessage,
          timestamp: new Date(),
        });

        console.log(
          `Message saved: ${senderId} -> ${normalizedRecipientId}`
        );

        // Send message to recipient if online
        const recipientSocket =
          onlineUsers[normalizedRecipientId];

        if (recipientSocket) {
          io.to(recipientSocket).emit("newMessage", {
            senderId,
            message: savedMessage.message,
            timestamp: savedMessage.timestamp,
          });
        }

        // Confirm to sender
        socket.emit("messageSent", {
          message: savedMessage.message,
          timestamp: savedMessage.timestamp,
        });
      } catch (err) {
        console.error("Socket message error:", err);
      }
    }
  );

  // Disconnect
  socket.on("disconnect", () => {
    for (const [userId, socketId] of Object.entries(
      onlineUsers
    )) {
      if (socketId === socket.id) {
        delete onlineUsers[userId];

        console.log(
          `User ${userId} disconnected.`
        );

        break;
      }
    }

    console.log(
      "Socket disconnected:",
      socket.id
    );
  });
});

// --------------------------------------------------
// Start server
// --------------------------------------------------

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(
    `RoomieRadar server running at http://localhost:${PORT}`
  );
});