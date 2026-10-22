const User = require("../models/user");
const Admin = require("../models/admin");

const checkLocation = async (latitude, longitude, id) => {
    console.log('current : ', latitude, longitude)
    try {
        const user = await User.findById(id);

        if (!user || !user.adminId) {
            console.log("User or adminId not found");
            return false;
        }

        const admin = await Admin.findById(user.adminId);

        if (!admin || !admin.campusLocation) {
            console.log("Admin or campus location not found");
            return false;
        }

        const lat = Number(latitude);
        const lng = Number(longitude);
        const campusLat = Number(admin.campusLocation.latitude);
        const campusLng = Number(admin.campusLocation.longitude);
        const radius = Number(admin.campusLocation.radius);
        console.log('set location : ', campusLat, campusLng)
        console.log('radius : ',radius)

        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lng) ||
            !Number.isFinite(campusLat) ||
            !Number.isFinite(campusLng) ||
            !Number.isFinite(radius) ||
            lat < -90 || lat > 90 ||
            lng < -180 || lng > 180 ||
            radius < 0
        ) {
            return false;
        }

        const toRadians = deg => deg * Math.PI / 180;
        const R = 6371000;

        const dLat = toRadians(campusLat - lat);
        const dLng = toRadians(campusLng - lng);

        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRadians(lat)) *
            Math.cos(toRadians(campusLat)) *
            Math.sin(dLng / 2) ** 2;

        const distance =
            R * 2 * Math.atan2(
                Math.sqrt(a),
                Math.sqrt(1 - a)
            );

        console.log("Distance from campus:", distance, "meters");

        return distance <= radius;

    } catch (err) {
        console.error("Location check error:", err);
        return false;
    }
};


const checkFace = async (face1, id) => {
    try {
        const user = await User.findById(id);

        if (!user || !user.face_features) {
            console.log("User or saved face features not found");
            return false;
        }

        if (typeof face1 === "string") {
            face1 = JSON.parse(face1);
        }

        const face2 = user.face_features;

        if (
            !Array.isArray(face1) ||
            !Array.isArray(face2) ||
            face1.length !== 128 ||
            face2.length !== 128 ||
            !face1.every(Number.isFinite) ||
            !face2.every(Number.isFinite)
        ) {
            console.log("Invalid face features");
            return false;
        }

        let sum = 0;

        for (let i = 0; i < 128; i++) {
            sum += (face1[i] - face2[i]) ** 2;
        }

        const distance = Math.sqrt(sum);

        console.log("Face distance:", distance);

        return distance < 0.6;

    } catch (err) {
        console.error("Face check error:", err);
        return false;
    }
};

module.exports = { checkLocation, checkFace };