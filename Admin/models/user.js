const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    department: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    contact_number: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    start_working_time: {
        type: String,
        required: true
    },
    end_working_time: {
        type: String,
        required: true
    },
    face_features: {
        type: [Number],
        required: true,
        validate: {
            validator: values => values.length === 128,
            message: "Face descriptor must contain 128 values."
        }
    },
    face_image: {
        type: String,
        default: null
    }
});

module.exports = mongoose.model("User", userSchema);