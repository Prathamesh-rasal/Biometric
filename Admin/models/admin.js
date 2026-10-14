const mongoose = require("mongoose");
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
  campusLocation: {
    latitude: {
      type: Number
    },
    longitude: {
      type: Number
    },
    radius: {
      type: Number,
      default: 100
    }
  }
});

module.exports = mongoose.model("Admin", adminSchema);