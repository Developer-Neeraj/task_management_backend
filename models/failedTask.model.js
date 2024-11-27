const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

const failedTaskSchema = new Schema(
  {
    _id: {
      type: String, // MongoDB's ObjectId will handle this by default
      default: () => new Types.ObjectId(),
    },
    email: {
      type: String,
      required: [true, "User email is required"],
      validate: {
        validator: function (v) {
          return /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
        },
        message: "Must be a valid email address",
      },
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [3, "Title should contain at least 3 characters"],
      maxlength: [50, "Title cannot exceed 50 characters"],
    },
    tag: {
      type: String,
      required: [true, "Tag is required"],
      trim: true,
      minlength: [3, "Tag should contain at least 3 characters"],
      maxlength: [30, "Tag cannot exceed 30 characters"],
    },
    description: {
      type: String,
      required: [true, "Task description is required"],
      trim: true,
    },
    deadline: {
      type: String,
      required: true,
    },
    hour: {
      type: Number,
      default: 0,
      min: [0, "Hour cannot be less than 0"],
      max: [23, "Hour cannot exceed 23"],
    },
    minute: {
      type: Number,
      default: 0,
      min: [0, "Minute cannot be less than 0"],
      max: [59, "Minute cannot exceed 59"],
    },
    status: {
      type: Number,
      default: 3,
    },
    createdByTask: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      validate: {
        validator: async function (value) {
          const user = await mongoose.model("User").findById(value);
          if (!user) {
            throw new Error("Invalid createdByTask value. User not found.");
          }
        },
      },
    },
    createdToTask: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      validate: {
        validator: async function (value) {
          const user = await mongoose.model("User").findById(value);
          if (!user) {
            throw new Error("Invalid createdToTask value. User not found.");
          }
        },
      },
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // Automatically handles createdAt and updatedAt
  }
);

// Create the FailedTask model
const FailedTask = model("FailedTask", failedTaskSchema);

module.exports = FailedTask;
