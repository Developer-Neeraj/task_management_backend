const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId, // MongoDB's default ID
      auto: true,
    },
    name: {
      type: String,
      required: [true, "User name is required"],
      trim: true,
      minlength: [3, "Name must be at least 3 characters"],
      maxlength: [40, "Name cannot exceed 40 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      unique: true,
      
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    isAdmin: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  {
    timestamps: true, // Automatically adds `createdAt` and `updatedAt` fields
  }
);


// Export the model
const User = mongoose.model("User", userSchema);

module.exports = User;
