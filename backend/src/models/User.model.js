import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const UserSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: [true, 'Username is required'],
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  displayName: { 
    type: String, 
    required: [true, 'Display name is required'],
    trim: true
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    index: true
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    select: false, // Don't return password by default
    minlength: 8
  },
  avatar: { 
    type: String, 
    default: "" 
  },
  bio: { 
    type: String, 
    default: "",
    maxlength: 160
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
    default: () => {
      const date = new Date();
      return `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
    }
  },
  phoneNumber: {
    type: String,
    default: "",
    sparse: true
  },
  lastPasswordResetDate: {
    type: Date,
    default: null
  },
  subscriptionPlan: {
    type: String,
    enum: ["Free", "Bronze", "Silver", "Gold"],
    default: "Free"
  },
  subscriptionId: {
    type: String,
    default: null // Stripe subscription ID
  },
  customerId: {
    type: String,
    default: null // Stripe customer ID
  },
  preferredLanguage: {
    type: String,
    default: "English",
    enum: ["English", "Spanish", "Hindi", "Portuguese", "Chinese", "French"]
  },
  loginHistory: [{
    browser: String,
    os: String,
    device: String,
    ipAddress: String,
    loginTime: { type: Date, default: Date.now }
  }]
}, { 
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      delete ret.password; // Ensure password is never sent in JSON
      return ret;
    }
  }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return next();

  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Instance method to check password
UserSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

const User = mongoose.model('User', UserSchema);
export default User;
