import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./modals/user.js";
import Tweet from "./modals/Tweet.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Support large base64 custom avatar uploads!
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Root verification diagnostic endpoint
app.get("/", (req, res) => {
  res.send("Twiller backend is running successfully");
});

const port = process.env.PORT || 5000;
const url = process.env.MONGO_URI || process.env.MONGODB_URL;

// Mongoose connection setup
mongoose
  .connect(url)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
  });

// Register Endpoint
app.post("/register", async (req, res) => {
  try {
    const existinguser = await User.findOne({ email: req.body.email });
    
    // If user already exists, return existing user with 200 OK (seamless registration/login)
    if (existinguser) {
      return res.status(200).send(existinguser);
    }
    
    const newuser = new User({
      username: req.body.username,
      displayName: req.body.displayName,
      email: req.body.email,
      password: req.body.password,
      avatar: req.body.avatar || "",
      bio: req.body.bio || "",
      location: req.body.location || "",
      website: req.body.website || "",
      coverImage: req.body.coverImage || "",
      joinedDate: req.body.joinedDate || "May 2026"
    });

    await newuser.save();
    res.status(201).send(newuser);

  } catch (error) {
    console.error("Registration failure:", error);
    res.status(500).send(error);
  }
});

// Logged In User Endpoint
app.get("/loggedinuser", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).send({ message: "Email parameter is required" });
    }
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
    // Return user profile if found, otherwise return null with 200 OK (graceful fallback)
    if (user) {
      res.status(200).send(user);
    } else {
      res.status(200).send(null);
    }
  } catch (error) {
    console.error("Logged in user lookup failure:", error);
    res.status(500).send(error);
  }
});

// Update Profile Endpoint
app.put("/profile", async (req, res) => {
  try {
    const { userId, displayName, bio, location, website, avatar, coverImage } = req.body;
    if (!userId) {
      return res.status(400).send({ message: "User ID is required" });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }
    
    if (displayName !== undefined) user.displayName = displayName;
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (website !== undefined) user.website = website;
    if (avatar !== undefined) user.avatar = avatar;
    if (coverImage !== undefined) user.coverImage = coverImage;
    
    await user.save();
    res.status(200).send(user);

  } catch (error) {
    console.error("Profile update failure:", error);
    res.status(500).send(error);
  }
});

// Tweet APIs

// Create a new tweet
app.post("/post", async (req, res) => {
  try {
    const { content, image, user } = req.body;
    if (!content) {
      return res.status(400).send({ message: "Tweet content is required" });
    }
    if (!user || !user.displayName || !user.username) {
      return res.status(400).send({ message: "User profile information is required" });
    }

    const newTweet = new Tweet({
      content,
      image: image || "",
      user: {
        displayName: user.displayName,
        username: user.username,
        avatar: user.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=anon",
        isVerified: user.isVerified !== undefined ? user.isVerified : true
      },
      likedBy: [],
      repostedBy: [],
      bookmarkedBy: [],
      replies: 0,
      views: "1"
    });

    await newTweet.save();
    res.status(201).send(newTweet);
  } catch (error) {
    console.error("Post creation failure:", error);
    res.status(500).send({ error: error.message });
  }
});

// Get all tweets sorted by newest first
app.get("/post", async (req, res) => {
  try {
    const tweets = await Tweet.find().sort({ createdAt: -1 });
    res.status(200).send(tweets);
  } catch (error) {
    console.error("Fetch tweets failure:", error);
    res.status(500).send({ error: error.message });
  }
});

// Toggle Like status on a tweet
app.post("/post/:id/like", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).send({ message: "User ID is required" });
    }

    const tweet = await Tweet.findById(id);
    if (!tweet) {
      return res.status(404).send({ message: "Tweet not found" });
    }

    const index = tweet.likedBy.indexOf(userId);
    if (index === -1) {
      // Like the tweet
      tweet.likedBy.push(userId);
    } else {
      // Unlike the tweet
      tweet.likedBy.splice(index, 1);
    }

    await tweet.save();
    res.status(200).send(tweet);
  } catch (error) {
    console.error("Like toggle failure:", error);
    res.status(500).send({ error: error.message });
  }
});

// Toggle Repost status on a tweet
app.post("/post/:id/repost", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).send({ message: "User ID is required" });
    }

    const tweet = await Tweet.findById(id);
    if (!tweet) {
      return res.status(404).send({ message: "Tweet not found" });
    }

    const index = tweet.repostedBy.indexOf(userId);
    if (index === -1) {
      // Repost
      tweet.repostedBy.push(userId);
    } else {
      // Undo Repost
      tweet.repostedBy.splice(index, 1);
    }

    await tweet.save();
    res.status(200).send(tweet);
  } catch (error) {
    console.error("Repost toggle failure:", error);
    res.status(500).send({ error: error.message });
  }
});

// Toggle Bookmark status on a tweet
app.post("/post/:id/bookmark", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).send({ message: "User ID is required" });
    }

    const tweet = await Tweet.findById(id);
    if (!tweet) {
      return res.status(404).send({ message: "Tweet not found" });
    }

    const index = tweet.bookmarkedBy.indexOf(userId);
    if (index === -1) {
      // Bookmark
      tweet.bookmarkedBy.push(userId);
    } else {
      // Undo Bookmark
      tweet.bookmarkedBy.splice(index, 1);
    }

    await tweet.save();
    res.status(200).send(tweet);
  } catch (error) {
    console.error("Bookmark toggle failure:", error);
    res.status(500).send({ error: error.message });
  }
});

// Alias PUT endpoints matching Vimeo tutorial routing styles

app.put("/like/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).send({ message: "User ID is required" });
    }

    const tweet = await Tweet.findById(id);
    if (!tweet) {
      return res.status(404).send({ message: "Tweet not found" });
    }

    const index = tweet.likedBy.indexOf(userId);
    if (index === -1) {
      tweet.likedBy.push(userId);
    } else {
      tweet.likedBy.splice(index, 1);
    }

    await tweet.save();
    res.status(200).send(tweet);
  } catch (error) {
    console.error("Like toggle failure:", error);
    res.status(500).send({ error: error.message });
  }
});

app.put("/retweet/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).send({ message: "User ID is required" });
    }

    const tweet = await Tweet.findById(id);
    if (!tweet) {
      return res.status(404).send({ message: "Tweet not found" });
    }

    const index = tweet.repostedBy.indexOf(userId);
    if (index === -1) {
      tweet.repostedBy.push(userId);
    } else {
      tweet.repostedBy.splice(index, 1);
    }

    await tweet.save();
    res.status(200).send(tweet);
  } catch (error) {
    console.error("Retweet toggle failure:", error);
    res.status(500).send({ error: error.message });
  }
});
