import express from "express";
import User from "../models/User.js";

const router = express.Router();

// Register a new user account
router.post("/register", async (req, res) => {
  try {
    const { email, password, username, displayName } = req.body;
    
    if (!email || !password || !username || !displayName) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const formattedUsername = username.replace("@", "").toLowerCase();
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { username: formattedUsername }] 
    });

    if (existingUser) {
      return res.status(400).json({ message: "Username or Email already registered" });
    }

    const newUser = new User({
      email: email.toLowerCase(),
      password, // Stored directly for simplicity of this custom learning server
      username: formattedUsername,
      displayName
    });

    await newUser.save();
    
    // Return standard User profile matching the frontend expectations
    res.status(201).json({
      id: newUser._id.toString(),
      email: newUser.email,
      username: newUser.username,
      displayName: newUser.displayName,
      avatar: newUser.avatar,
      bio: newUser.bio,
      location: newUser.location,
      website: newUser.website,
      coverImage: newUser.coverImage,
      joinedDate: newUser.joinedDate
    });

  } catch (error) {
    console.error("Registration endpoint failure:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Authenticate user login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || user.password !== password) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    res.status(200).json({
      id: user._id.toString(),
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      bio: user.bio,
      location: user.location,
      website: user.website,
      coverImage: user.coverImage,
      joinedDate: user.joinedDate
    });

  } catch (error) {
    console.error("Login endpoint failure:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
