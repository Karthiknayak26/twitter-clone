import express from "express";
import User from "../models/User.js";

const router = express.Router();

// Retrieve user details by username
router.get("/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      id: user._id.toString(),
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
    console.error("Retrieve user profile failure:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update user profile metadata details
router.put("/profile", async (req, res) => {
  try {
    const { userId, displayName, bio, location, website, avatar, coverImage } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required for profile updates" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User account not found" });
    }

    // Apply updates dynamically
    if (displayName !== undefined) user.displayName = displayName;
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (website !== undefined) user.website = website;
    if (avatar !== undefined) user.avatar = avatar;
    if (coverImage !== undefined) user.coverImage = coverImage;

    await user.save();

    res.status(200).json({
      id: user._id.toString(),
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
    console.error("Profile updates failure:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
