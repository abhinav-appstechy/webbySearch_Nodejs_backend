const mongoose = require("mongoose");

const mongo_uri =
  "mongodb+srv://pobav26113:8mBa2sVxjOap76Ak@cluster0.odvqpq5.mongodb.net/";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(mongo_uri);
    console.log("Mongodb Connected");
  } catch (error) {
    console.error(error);
  }
};

module.exports = connectDB;
