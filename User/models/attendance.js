
const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    date: {
        type: String,
        required: true
    },

    checkIn: {
        type: Date,
        default: null
    },

    checkOut: {
        type: Date,
        default: null
    },

    status: {
        type: String,
        enum: ["Present", "Late", "Half-Day", "Absent"],
        default: "Present"
    },

    workingMinutes: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

attendanceSchema.index(
    { userId: 1, date: 1 },
    { unique: true }
);

module.exports = mongoose.model(
    "Attendance",
    attendanceSchema
);
