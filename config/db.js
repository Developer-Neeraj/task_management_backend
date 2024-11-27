const mongoose = require("mongoose");
const { dbHost, dbUserName, dbPass, dbName, dbPort } = require("../secret");

const connectDB = async () => {
  try {
    // Construct MongoDB URI
    const dbUri = `mongodb+srv://freelancersoftwaredev:e82ADeRpznaRJU2@codestare.1n4ca.mongodb.net/?retryWrites=true&w=majority&appName=codestare`;

    // Connection options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };

    // If using authentication (e.g., username/password)
    if (dbUserName && dbPass) {
      options.auth = { username: dbUserName, password: dbPass };
    }

    // Connect to MongoDB
    await mongoose.connect(dbUri, options);

    console.log("MongoDB connection established successfully.");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    process.exit(1); // Exit the process with failure
  }
};

module.exports = { connectDB };
