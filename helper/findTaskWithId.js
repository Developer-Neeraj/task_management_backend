const createError = require("http-errors");
const { sequelize } = require("../config/db");
const Task = require("../models/task.model");
const User = require("../models/user.model");
const FailedTask = require("../models/failedTask.model");
const mongoose = require("mongoose");


const findTaskWithId = async (id) => {
  try {
    // Validate the ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw createError(400, "Invalid task id");
    }

    // Search for the task in Task collection
    let task = await Task.findById(id)
      .populate({ path: "createdByTask", select: "name" })
      .populate({ path: "createdToTask", select: "name" });

    // If not found, search in FailedTask collection
    if (!task) {
      task = await FailedTask.findById(id)
        .populate({ path: "createdByTask", select: "name" })
        .populate({ path: "createdToTask", select: "name" });
    }

    // If task still not found, throw an error
    if (!task) throw createError(404, "Task does not exist with this id");

    return task;
  } catch (error) {
    // Handle Mongoose errors
    if (error.name === "CastError") {
      throw createError(400, "Invalid task id");
    }
    throw error;
  }
};

module.exports = { findTaskWithId };
