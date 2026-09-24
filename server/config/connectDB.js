const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB connected: ${connectionInstance.connection.host}`);
    return connectionInstance;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    // Do not crash the entire process, allow server to remain up and retry
  }
};

module.exports = connectDB;