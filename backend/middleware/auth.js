const jwt = require("jsonwebtoken");
const User = require("../models/User");

function getTokenFromRequest(req) {
  // 1. Support Authorization: Bearer <token>
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // 2. Support the token cookie created during login
  const cookieHeader = req.headers.cookie;

  if (cookieHeader) {
    const tokenCookie = cookieHeader
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith("token="));

    if (tokenCookie) {
      return decodeURIComponent(tokenCookie.substring("token=".length));
    }
  }

  return null;
}

const auth = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({
        message: "Invalid or expired token."
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        message: "Invalid or expired token."
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error("Authentication error:", error);

    return res.status(401).json({
      message: "Invalid or expired token."
    });
  }
};

module.exports = auth;