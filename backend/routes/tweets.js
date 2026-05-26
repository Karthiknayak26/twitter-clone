import express from "express";
import Tweet from "../models/Tweet.js";

const router = express.Router();

// Retrieve all tweets ordered by creation date desc
router.get("/", async (req, res) => {
  try {
    const tweets = await Tweet.find().sort({ createdAt: -1 });
    res.status(200).json(tweets);
  } catch (error) {
    console.error("Retrieve tweets failure:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Post a new tweet
router.post("/", async (req, res) => {
  try {
    const { user, content, image } = req.body;

    if (!user || !content) {
      return res.status(400).json({ message: "User profile and content text are required" });
    }

    const newTweet = new Tweet({
      user: {
        displayName: user.displayName,
        username: user.username,
        avatar: user.avatar,
        isVerified: user.isVerified !== undefined ? user.isVerified : true
      },
      content,
      image: image || "",
      likedBy: [],
      repostedBy: [],
      bookmarkedBy: []
    });

    await newTweet.save();
    res.status(201).json(newTweet);

  } catch (error) {
    console.error("Post tweet failure:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Toggle Like
router.post("/:id/like", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "User ID is required" });

    const tweet = await Tweet.findById(req.params.id);
    if (!tweet) return res.status(404).json({ message: "Tweet not found" });

    const likedIdx = tweet.likedBy.indexOf(userId);
    if (likedIdx > -1) {
      tweet.likedBy.splice(likedIdx, 1);
    } else {
      tweet.likedBy.push(userId);
    }

    await tweet.save();
    res.status(200).json(tweet);

  } catch (error) {
    console.error("Like toggle failure:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Toggle Repost
router.post("/:id/repost", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "User ID is required" });

    const tweet = await Tweet.findById(req.params.id);
    if (!tweet) return res.status(404).json({ message: "Tweet not found" });

    const repostIdx = tweet.repostedBy.indexOf(userId);
    if (repostIdx > -1) {
      tweet.repostedBy.splice(repostIdx, 1);
    } else {
      tweet.repostedBy.push(userId);
    }

    await tweet.save();
    res.status(200).json(tweet);

  } catch (error) {
    console.error("Repost toggle failure:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Toggle Bookmark
router.post("/:id/bookmark", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "User ID is required" });

    const tweet = await Tweet.findById(req.params.id);
    if (!tweet) return res.status(404).json({ message: "Tweet not found" });

    const bookmarkIdx = tweet.bookmarkedBy.indexOf(userId);
    if (bookmarkIdx > -1) {
      tweet.bookmarkedBy.splice(bookmarkIdx, 1);
    } else {
      tweet.bookmarkedBy.push(userId);
    }

    await tweet.save();
    res.status(200).json(tweet);

  } catch (error) {
    console.error("Bookmark toggle failure:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;
