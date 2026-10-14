const mongoose = require("mongoose");
const User = require("./user");
const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  contact: {
    type: Number,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
});

module.exports = mongoose.model("Admin", adminSchema);