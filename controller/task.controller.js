const createError = require("http-errors");
const Task = require("../models/task.model");
const { successResponse } = require("./response.controller");
const User = require("../models/user.model");
const { findTaskWithId } = require("../helper/findTaskWithId");
const FailedTask = require("../models/failedTask.model");
const mongoose = require("mongoose")

// GET all tasks by admin with status or not status
const getAllTasks = async (req, res, next) => {
  try {
    const { status, name } = req.body;
    let whereClause = {};
    let message;

    if (status && status !== "") {
      let setStatus;
      if (status === "PENDING") setStatus = 0;
      else if (status === "INPROGRESS") setStatus = 1;
      else if (status === "COMPLETED") setStatus = 2;
      else if (status === "FAILED") setStatus = 3;
      else throw createError(404, "Invalid status");

      whereClause.status = setStatus;
    }

    const tasks = await Task.find(whereClause).populate([
      { path: "createdByTask", select: "name" },
      { path: "createdToTask", select: "name" },
    ]);

    const failedTasks = await FailedTask.find(whereClause).populate([
      { path: "createdByTask", select: "name" },
      { path: "createdToTask", select: "name" },
    ]);

    // Filter by `name` in the populated fields
    let allTasks = [...tasks, ...failedTasks];
    if (name && name !== "") {
      allTasks = allTasks.filter(
        (task) =>
          task.createdToTask.name.toLowerCase().includes(name.toLowerCase()) ||
          task.createdByTask.name.toLowerCase().includes(name.toLowerCase())
      );
    }

    allTasks = allTasks.sort((a, b) => b.createdAt - a.createdAt);

    if (allTasks.length > 0) {
      message = "Tasks were returned successfully";
    } else {
      message = "Task not available...";
    }

    return successResponse(res, {
      statusCode: 200,
      message: message,
      payload: { totalTask: allTasks.length, allTasks },
    });
  } catch (error) {
    next(error);
  }
};



// GET All Task For Single User by User ID with status or not status
const getAllTaskForSingleUser = async (req, res, next) => {
  try {
    const { id, status } = req.body;
    let message;

    // Base filter for MongoDB
    const filter = { createdToTask: id };

    // Apply status filter if provided
    if (status && status !== "") {
      let setStatus;
      if (status === "PENDING") {
        setStatus = 0;
      } else if (status === "INPROGRESS") {
        setStatus = 1;
      } else if (status === "COMPLETED") {
        setStatus = 2;
      } else if (status === "FAILED") {
        setStatus = 3;
      } else {
        throw createError(404, "Invalid status");
      }
      filter.status = setStatus;
    }
    console.log('filter',filter)
    // Query tasks and failed tasks
    const tasksQuery = Task.find(filter).populate({
      path: "createdByTask",
      select: "name", // Only fetch the `name` field
    });
   

    const failedTasksQuery = FailedTask.find(filter).populate({
      path: "createdByTask",
      select: "name", // Only fetch the `name` field
    });

    // Execute queries in parallel
    const [tasks, failedTasks] = await Promise.all([
      tasksQuery.sort({ createdAt: -1 }).exec(),
      failedTasksQuery.sort({ createdAt: -1 }).exec(),
    ]);

    console.log('tasks',tasks)
    console.log('failedTasks',failedTasks)
    // Merge results and sort by creation date
    const allTasks = [...tasks, ...failedTasks].sort(
      (a, b) => b.createdAt - a.createdAt
    );

    // Check the result and set response message
    if (allTasks.length > 0) {
      message =
        "For this particular ID, tasks have been counted and returned successfully.";
    } else {
      message = "Task not available...";
    }

    // Send response
    return successResponse(res, {
      statusCode: 200,
      message: message,
      payload: { totalTask: allTasks.length, allTasks },
    });
  } catch (error) {
    next(error);
  }
};


// GET task by ID
const getTaskById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw createError(400, "Invalid task ID");
    }

    const task = await findTaskWithId(id);

    if (!task) {
      throw createError(404, "Task not found");
    }

    return successResponse(res, {
      statusCode: 200,
      message: "Task was returned successfully",
      payload: { task },
    });
  } catch (error) {
    next(error);
  }
};


// for create new Task
const createNewTask = async (req, res, next) => {
  try {
    const createdByTask = req.body.id;
    const { title,  description, deadline, hour, minute, createdToTask } =
      req.body;

    // Check if the user is trying to assign a task to themselves
    if (createdByTask === createdToTask) {
      throw createError(404, "You are not allowed to create a task for yourself.");
    }

    // Validate createdToTask as a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(createdToTask)) {
      throw createError(400, "Invalid user ID for createdToTask.");
    }

    // Check if a task with the same title already exists for the user
    const checkingExistingTask = await Task.findOne({
      createdToTask,
      title,
    });

    if (checkingExistingTask) {
      throw createError(409, "Same task already assigned for this user.");
    }

    // Fetch the user's email for createdToTask
    const user = await User.findById(createdToTask, { email: 1 });
    if (!user) {
      throw createError(404, "User not found for createdToTask.");
    }
    console.log('createdByTask',createdByTask);
    // Create the new task
    const newTask = new Task({
      email: user.email,
      title,
      description,
      deadline,
      hour,
      minute,
      createdByTask: createdByTask,
      createdToTask,
    });

    const task = await newTask.save();

    return successResponse(res, {
      statusCode: 201,
      message: "Task created successfully",
      payload: { task },
    });
  } catch (error) {
    next(error);
  }
};


// for delete Task
const deleteTaskById = async (req, res, next) => {
  try {
    const id = req.params.id;

    // Validate the task ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw createError(400, "Invalid task ID.");
    }

    // Find the task in either the Task or FailedTask collections
    const task = await Task.findById(id) || await FailedTask.findById(id);

    if (!task) {
      throw createError(404, "Task not found.");
    }

    // Try deleting the task from the Task collection
    const deleteFromTaskTable = await Task.findByIdAndDelete(id);

    if (!deleteFromTaskTable) {
      // If not found in Task collection, try deleting from FailedTask collection
      await FailedTask.findByIdAndDelete(id);
    }

    return successResponse(res, {
      statusCode: 200,
      message: "Task was deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};


// Edit Task by Admin
const editTaskById = async (req, res, next) => {
  try {
    const taskId = req.params.id;

    // Validate the task ID
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      throw createError(404, "Invalid task ID");
    }

    const now = new Date();
    let updates = {};

    // Allowed fields for updates
    const allowedFields = [
      "title",
      "tag",
      "description",
      "deadline",
      "hour",
      "minute",
    ];

    // Iterate through the fields in the request body
    for (const key in req.body) {
      if (allowedFields.includes(key)) {
        if (key === "deadline") {
          const deadline = new Date(req.body[key]);
          if (deadline < now) {
            throw createError(400, "Deadline cannot be in the past");
          } else if (deadline.toDateString() === now.toDateString()) {
            const hour = parseInt(req.body.hour);
            const minute = parseInt(req.body.minute);

            if (hour < now.getHours()) {
              throw createError(400, "Hour cannot be in the past");
            } else if (hour === now.getHours() && minute <= now.getMinutes()) {
              throw createError(400, "Must be an upcoming time to set deadline");
            }
          }
        } else if ((key === "hour" || key === "minute") && req.body.deadline) {
          const hour = parseInt(req.body.hour);
          const minute = parseInt(req.body.minute);
          if (
            isNaN(hour) ||
            hour < 0 ||
            hour > 23 ||
            isNaN(minute) ||
            minute < 0 ||
            minute > 59
          ) {
            throw createError(400, "Invalid time");
          }
        }
        updates[key] = req.body[key];
      } else if (key === "status") {
        throw createError(
          404,
          "You cannot modify the status. It is assigned by default when the task is created."
        );
      }
    }

    // Find and update the task
    const updatedTask = await Task.findByIdAndUpdate(taskId, updates, {
      new: true, // Return the updated document
      runValidators: true, // Ensure validation rules are applied
    });

    if (!updatedTask) {
      throw createError(
        404,
        "Something went wrong. Couldn't update the task. Please try again."
      );
    }

    return successResponse(res, {
      statusCode: 200,
      message: "Task was updated successfully",
      payload: updatedTask,
    });
  } catch (error) {
    next(error);
  }
};

// Edit Task status
const editTaskStatusById = async (req, res, next) => {
  try {
    const taskId = req.params.id;

    // Validate the task ID
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      throw createError(404, "Invalid task ID");
    }

    const allowedFields = ["status"];
    const updates = {};

    // Validate the request body
    for (const key in req.body) {
      if (
        ["title", "description", "deadline", "tag"].includes(key)
      ) {
        throw createError(404, `Updating "${key}" is not allowed`);
      }
      if (allowedFields.includes(key)) {
        updates[key] = req.body[key];
      }
    }

    // Check if the updates object is empty
    if (Object.keys(updates).length === 0) {
      throw createError(404, "Status field is required");
    }

    // Update the task status
    const updatedTask = await Task.findByIdAndUpdate(taskId, updates, {
      new: true, // Return the updated document
      runValidators: true, // Ensure validation rules are applied
    });

    if (!updatedTask) {
      throw createError(404, "Task with this ID does not exist");
    }

    return successResponse(res, {
      statusCode: 200,
      message: "Status updated successfully",
      payload: updatedTask,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createNewTask,
  getAllTasks,
  deleteTaskById,
  getTaskById,
  editTaskById,
  editTaskStatusById,
  getAllTaskForSingleUser,
};
