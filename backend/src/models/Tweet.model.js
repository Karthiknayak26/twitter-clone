import mongoose from 'mongoose';

const TweetSchema = new mongoose.Schema({
  user: {
    // We store denormalized user data for fast read, but keep a reference
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    displayName: { type: String, required: true },
    username: { type: String, required: true },
    avatar: { type: String, required: true },
    isVerified: { type: Boolean, default: true }
  },
  content: {
    type: String,
    required: [true, 'Tweet must have content'],
    maxlength: [280, 'A tweet must have less or equal then 280 characters']
  },
  image: {
    type: String,
    default: ""
  },
  // ── Audio Tweet Fields ──────────────────────────────────────────────────
  tweetType: {
    type: String,
    enum: ["text", "audio"],
    default: "text"
  },
  audioUrl: {
    type: String,
    default: "" // URL from Cloudinary/S3
  },
  audioDuration: {
    type: Number,   // duration in seconds
    default: 0
  },
  audioFileName: {
    type: String,
    default: ""
  },
  // ────────────────────────────────────────────────────────────────────────
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: []
  }],
  repostedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: []
  }],
  bookmarkedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: []
  }],
  replies: {
    type: Number,
    default: 0
  },
  views: {
    type: Number, // Changed from String to Number for analytical queries
    default: 1
  }
}, { 
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance optimization
TweetSchema.index({ createdAt: -1 }); // Sorting feed by newest
TweetSchema.index({ 'user.username': 1, createdAt: -1 }); // User profile feed
TweetSchema.index({ 'user._id': 1 }); // Querying user's tweets for limits

const Tweet = mongoose.model("Tweet", TweetSchema);
export default Tweet;
