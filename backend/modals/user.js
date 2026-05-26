import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true 
  },
  displayName: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  avatar: { 
    type: String, 
    default: "" 
  },
  bio: { 
    type: String, 
    default: "" 
  },
  location: { 
    type: String, 
    default: "" 
  },
  website: { 
    type: String, 
    default: "" 
  },
  coverImage: { 
    type: String, 
    default: "" 
  },
  joinedDate: { 
    type: String, 
    default: "May 2026" 
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
