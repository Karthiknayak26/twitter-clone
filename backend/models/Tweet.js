import mongoose from "mongoose";

const TweetSchema = new mongoose.Schema({
  user: {
    displayName: { type: String, required: true },
    username: { type: String, required: true },
    avatar: { type: String, required: true },
    isVerified: { type: Boolean, default: true }
  },
  content: {
    type: String,
    required: true,
    maxlength: 200
  },
  image: {
    type: String,
    default: ""
  },
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
    type: String,
    default: "1"
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

const Tweet = mongoose.model("Tweet", TweetSchema);
export default Tweet;
