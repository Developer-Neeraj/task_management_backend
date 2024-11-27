const cron = require("node-cron");
const Task = require("../models/task.model");
const sendEmail = require("./sendEmail");
const FailedTask = require("../models/failedTask.model");

/*
# ┌────────────── second (optional)
# │ ┌──────────── minute
# │ │ ┌────────── hour
# │ │ │ ┌──────── day of month
# │ │ │ │ ┌────── month
# │ │ │ │ │ ┌──── day of week
# │ │ │ │ │ │
# │ │ │ │ │ │
# * * * * * *
*/

// Define a cron job to check for tasks due for a reminder
const scheduleTaskReminders = () => {
  cron.schedule("*/1 * * * *", async () => {
    console.log("=======***SCHEDULING TASK REMINDERS. IT HAS STARTED***======");

    try {
      const now = new Date();
      const targetTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes from now

      const tasks = await Task.find({
        hour: targetTime.getHours(),
        minute: { $gte: now.getMinutes(), $lte: targetTime.getMinutes() },
        status: { $in: [0, 1] }, // Scheduled or Pending
        reminderSent: false,
      });

      for (const task of tasks) {
        await sendTaskReminderEmail(task);
        task.reminderSent = true;
        await task.save();
      }
    } catch (error) {
      console.error("Error scheduling task reminders:", error);
    }
  });
};

// Function to send a reminder email for a task
const sendTaskReminderEmail = async (task) => {
  try {
    const emailData = {
      email: task.email,
      subject: "Task Reminder",
      text: `Reminder: Your task "${task.title}" is due in 15 minutes.`,
      html: `<p>Reminder: Your task "${task.title}" is due in 15 minutes.</p>`,
    };

    await sendEmail(emailData);
    console.log("Reminder email sent for task:", task._id);
  } catch (error) {
    console.error("Error sending task reminder email:", error);
  }
};

// Function to move failed tasks from the Task collection to the FailedTask collection
const movedFailedTaskRemindersSchedule = () => {
  cron.schedule("*/1 * * * *", async () => {
    console.log("========***CHECKING FOR FAILED TASKS AND MOVING...***==========");

    try {
      const now = new Date();
      const todayDate = now.toISOString().split("T")[0]; // Current date in YYYY-MM-DD format

      const failedTasks = await Task.find({
        $and: [
          { status: { $in: [0, 1] } }, // Scheduled or Pending
          {
            $or: [
              { deadline: { $lt: todayDate } }, // Deadline is before today
              {
                deadline: todayDate,
                $or: [
                  { hour: { $lt: now.getHours() } },
                  { hour: now.getHours(), minute: { $lt: now.getMinutes() } },
                ],
              },
            ],
          },
        ],
      }).sort({ deadline: 1, hour: 1, minute: 1 });

      if (failedTasks.length > 0) {
        const failedTasksData = failedTasks.map((task) => ({
          email: task.email,
          title: task.title,
          tag: task.tag,
          description: task.description,
          deadline: task.deadline,
          hour: task.hour,
          minute: task.minute,
          createdByTask: task.createdByTask,
          createdToTask: task.createdToTask,
          reminderSent: task.reminderSent,
        }));

        // Insert failed tasks into FailedTask collection
        await FailedTask.insertMany(failedTasksData);

        // Remove failed tasks from Task collection
        await Task.deleteMany({ _id: { $in: failedTasks.map((task) => task._id) } });

        console.log("Failed tasks moved successfully.");
      } else {
        console.log("No failed tasks available to move.");
      }
    } catch (error) {
      console.error("Error moving failed tasks:", error);
    }
  });
};

module.exports = { scheduleTaskReminders, movedFailedTaskRemindersSchedule };
