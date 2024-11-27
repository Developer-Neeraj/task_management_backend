const createError = require("http-errors");
const JWT = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const User = require("../models/user.model");
const { successResponse } = require("./response.controller");
const {
  jwtActivationKey,
  expireJwtForActivateAccount,
  appName,
  clientURL,
  jwtPasswordResetKey,
  expireJwtForResetPassword,
  jwtAccessKey,
  accessTokenExpireTime,
  jwtRefreshTokenKey,
  refreshTokenExpireTime,
} = require("../secret");
const { createJWT } = require("../helper/createJWT");
const { findWithId } = require("../helper/findWithId");
const { findWithEmail } = require("../helper/findWithEmail");
const sendEmail = require("../helper/sendEmail");
const Task = require("../models/task.model");
const {
  setAccessTokenCookie,
  setRefreshTokenCookie,
} = require("../helper/cookie");
const FailedTask = require("../models/failedTask.model");

// GET user by ID
const getUserById = async (req, res, next) => {
  try {
    const id = req.params.id;

    // Validate the user ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw createError(404, "Invalid user ID");
    }

    // Fetch the user while excluding the password field
    const user = await User.findById(id).select("-password");

    // Check if the user exists
    if (!user) {
      throw createError(404, "User not found");
    }

    return successResponse(res, {
      statusCode: 200,
      message: "User was returned successfully",
      payload: { user },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE user
const deleteUserById = async (req, res, next) => {
  try {
    const id = req.params.id;

    // Validate the user ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw createError(404, "Invalid user ID");
    }

    // Find the user, excluding the password
    const user = await User.findById(id).select("-password");

    if (!user) {
      throw createError(404, "User not found");
    }

    // Find and delete all tasks associated with the user
    const userTasks = await Task.deleteMany({ createdToTask: id });

    // Ensure the user is not an admin before deletion
    if (user.isAdmin) {
      throw createError(
        403,
        "This user cannot be deleted. Assign admin rights to another user first."
      );
    }

    // Delete the user
    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      throw createError(404, "Failed to delete the user");
    }

    return successResponse(res, {
      statusCode: 200,
      message: "User and associated tasks were deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};


// for create new user and send email activation notification
const createNewUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw createError(409, "Email is already registered. Please log in.");
    }

    // Generate JWT token for activation
    const token = Buffer.from(
      JWT.sign({ name, email, password }, jwtActivationKey, {
        expiresIn: expireJwtForActivateAccount,
      })
    ).toString("base64");

    // Prepare email content
    const emailData = {
      email,
      subject: `Activate your ${appName} Account`,
      text: "Verify your account",
      html: `
        <h2>Hello ${name}</h2>
        <h3>Thanks for registering your ${appName} account</h3>
        <h4>
          Please click <a href="${clientURL}/verify-email/${token}" target="_blank">here</a> to activate your account. 
          The link will expire after ${expireJwtForActivateAccount}.
        </h4>
      `,
    };

    // Send activation email
    await sendEmail(emailData);

    return successResponse(res, {
      statusCode: 200,
      message: `A verification email has been sent to ${email}. Please check your email to complete the registration process.`,
      payload: { token },
    });
  } catch (error) {
    next(error);
  }
};

// for activate user account
const activateUserAccount = async (req, res, next) => {

  try {
    const token = req.body.token;
    if (!token) throw createError(404, "Token not found");

    try {
      // Decode the base64 token and verify it
      const decodedToken = JWT.verify(
        Buffer.from(token, 'base64').toString(),
        jwtActivationKey
      );

      if (!decodedToken) {
        throw createError(401, "Unable to verify user account");
      }

      // Check if a user with the decoded email already exists
      const userExists = await User.findOne({ email: decodedToken.email });
      if (userExists) {
        throw createError(409, "User already exists. Please sign in");
      }

      // Hash the password before saving
      console.log('decodedToken.password',decodedToken.password)
      console.log('decodedToken.password.1',decodedToken.email)
      const hashedPassword = await bcrypt.hash(decodedToken.password, 10);

      // Create a new user with the provided details
      const newUser = new User({
        name: decodedToken.name,
        email: decodedToken.email,
        password: hashedPassword, // Save the hashed password
      });

      await newUser.save();

      // Send success response
      return successResponse(res, {
        statusCode: 201,
        message: "Your account has been activated successfully. Please login",
        payload: { user: { name: newUser.name, email: newUser.email } }, // Exclude sensitive fields
      });

    } catch (error) {
      // Handle specific JWT errors
      if (error.name === "TokenExpiredError") {
        throw createError(401, "Token has expired");
      } else if (error.name === "JsonWebTokenError") {
        throw createError(401, "Invalid Token");
      } else {
        throw error; // Re-throw other errors
      }
    }

  } catch (error) {
    next(error);
  }
};


// Update user
const updateUserById = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const allowedFields = ["name", "password"];
    let updates = {};

    // Loop through request body and apply allowed fields
    for (const key in req.body) {
      if (allowedFields.includes(key)) {
        updates[key] = req.body[key];
      } else if (key === "email") {
        throw createError(404, "Email cannot be updated");
      }
    }

    // Find user by ID and update the fields
    const user = await User.findByIdAndUpdate(userId, updates, { new: true });
    if (!user) {
      throw createError(404, "User with this ID does not exist");
    }

    // Remove password field before sending back the user data
    const updatedUser = user.toObject();
    delete updatedUser.password;

    // Clear existing cookies
    res.clearCookie("accessToken", {
      path: "/",
      secure: true,
      sameSite: "none",
    });
    res.clearCookie("refreshToken", {
      path: "/",
      secure: true,
      sameSite: "none",
    });

    // Create new access token
    const accessToken = JWT.sign({ user: updatedUser }, jwtAccessKey, { expiresIn: accessTokenExpireTime });
    setAccessTokenCookie(res, accessToken);

    // Create new refresh token
    const refreshToken = JWT.sign({ user: updatedUser }, jwtRefreshTokenKey, { expiresIn: refreshTokenExpireTime });
    setRefreshTokenCookie(res, refreshToken);

    // Send success response
    return successResponse(res, {
      statusCode: 200,
      message: "User profile was updated successfully",
      payload: updatedUser,
    });

  } catch (error) {
    next(error);
  }
};

// Update user password
const updateUserPassword = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { oldPassword, newPassword, confirmPassword } = req.body;

    // Check if the new password and confirm password match
    if (newPassword !== confirmPassword) {
      throw createError(400, "New Password and Confirm Password do not match");
    }

    // Find the user by ID
    const user = await findWithId(User, userId);
    if (!user) {
      throw createError(404, "User not found");
    }

    // Check if the old password is correct
    const isPasswordMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordMatch) {
      throw createError(400, "Old Password is incorrect");
    }

    // Hash the new password before updating it
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password in the database
    user.password = hashedPassword;
    await user.save();

    // Remove the password field before returning the user
    const updatedUser = user.toObject();
    delete updatedUser.password;

    // Return the success response with the updated user
    return successResponse(res, {
      statusCode: 200,
      message: "Password was updated successfully",
      payload: { updatedUser },
    });
  } catch (error) {
    next(error);
  }
};

// Forget user password
const forgetUserPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Find the user by email
    const userData = await findWithEmail(User, email);
    if (!userData) {
      throw createError(404, "User not found with this email");
    }

    // Create a token for password reset
    const token = btoa(
      createJWT({ email }, jwtPasswordResetKey, expireJwtForResetPassword)
    );

    // Prepare the email data
    const emailData = {
      email,
      subject: "Reset your password", // Subject line
      text: "Reset your password", // plain text body
      html: `
        <h2>Hello ${userData.name}</h2>
        <h3>Thanks for requesting to reset your password.</h3>
        <h4>Please click here to <a href="${clientURL}/reset-password/${token}" target="_blank">reset your password</a>. The Link will expire after ${expireJwtForResetPassword}.</h4>
      `, // html body
    };

    // Send the password reset email
    sendEmail(emailData);

    // Send success response
    return successResponse(res, {
      statusCode: 200,
      message: `A reset password link has been sent to ${email}. Please check your email to reset your password.`,
      payload: {},
    });
  } catch (error) {
    next(error);
  }
};

// Forget user password
const resetUserPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    // Decode and verify the token
    const decoded = JWT.verify(atob(token), jwtPasswordResetKey);
    if (!decoded) throw createError(400, "Unable to verify user account");

    // Hash the new password before saving it
    const hashedPassword = await bcrypt.hash(password, 10); // 10 rounds of hashing

    // Update the user's password in the database
    const [rowsUpdated] = await User.update(
      { password: hashedPassword },
      {
        where: { email: decoded.email },
        returning: true, // Return the updated user(s)
        plain: true,
      }
    );
    
    if (rowsUpdated === 0) {
      throw createError(400, "Password reset failed. Please try again");
    }

    return successResponse(res, {
      statusCode: 200,
      message: "Password reset successfully",
      payload: {},
    });
  } catch (error) {
    next(error);
  }
};

// GET All user with their task status count
const getAllUsersWithTaskStatusCounts = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    let message;

    // Fetch all users except the current user in one query
    const users = await User.find({ _id: { $ne: currentUserId } })
      .select('-password') // Exclude password field
      .exec();

    if (!users || users.length === 0) {
      message = "No user found...";
      return successResponse(res, {
        statusCode: 200,
        message: message,
        payload: [],
      });
    }

    // Fetch tasks and failed tasks for all users in one batch query
    const userIds = users.map((user) => user._id);

    const tasks = await Task.aggregate([
      { $match: { createdToTask: { $in: userIds } } },
      { $group: { _id: "$createdToTask", status: { $push: "$status" } } },
    ]);

    const failedTasks = await FailedTask.aggregate([
      { $match: { createdToTask: { $in: userIds } } },
      { $group: { _id: "$createdToTask", status: { $push: "$status" } } },
    ]);

    // Merge tasks and failed tasks
    const allTasks = [...tasks, ...failedTasks];

    // Aggregate tasks by user
    const tasksByUser = allTasks.reduce((acc, task) => {
      if (!acc[task._id]) {
        acc[task._id] = [];
      }
      acc[task._id] = acc[task._id].concat(task.status);
      return acc;
    }, {});

    // Prepare response data
    const response = users.map((user) => {
      const userTasks = tasksByUser[user._id] || [];
      const statusCounts = userTasks.reduce((acc, status) => {
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      return {
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        status: Object.keys(statusCounts).map((status) => ({
          status: parseInt(status, 10),
          count: statusCounts[status],
        })),
      };
    });

    message = "Users with task status counts were retrieved successfully";

    return successResponse(res, {
      statusCode: 200,
      message: message,
      payload: response,
    });

  } catch (error) {
    next(error);
  }
};


module.exports = {
  getUserById,
  deleteUserById,
  createNewUser,
  activateUserAccount,
  updateUserById,
  updateUserPassword,
  forgetUserPassword,
  resetUserPassword,
  getAllUsersWithTaskStatusCounts,
};
