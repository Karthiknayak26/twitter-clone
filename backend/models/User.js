import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  displayName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    default: "https://api.dicebear.com/7.x/adventurer/svg?seed=anonymous"
  },
  bio: {
    type: String,
    maxlength: 160,
    default: "Software developer passionate about building great products"
  },
  location: {
    type: String,
    maxlength: 30,
    default: "Earth"
  },
  website: {
    type: String,
    default: "example.com"
  },
  coverImage: {
    type: String,
    default: ""
  },
  joinedDate: {
    type: String,
    default: () => {
      const date = new Date();
      const options = { month: 'long', year: 'numeric' };
      return `Joined ${date.toLocaleDateString('en-US', options)}`;
    }
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

const User = mongoose.model("User", UserSchema);
export default User;
