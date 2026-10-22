

const radiusInput = document.getElementById("radius");
const radiusError = document.getElementById("radiusError");
const saveBtn = document.getElementById("saveBtn");

document.getElementById("getLocation").addEventListener("click", () => {

    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            document.getElementById("latitude").textContent =
                latitude.toFixed(6);

            document.getElementById("longitude").textContent =
                longitude.toFixed(6);
        },

        (error) => {
            alert("Location error: " + error.message);
            console.error(error);
        },

        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }
    );
});












function validateRadius() {
    const value = radiusInput.value;
    const number = Number(value);

    if (
        value === "" ||
        !Number.isInteger(number) ||
        number < 1 ||
        number > 100
    ) {
        radiusError.textContent =
            "Please enter a whole number between 1 and 100.";
        radiusInput.classList.add("is-invalid");
        saveBtn.disabled = true;
        return false;
    }

    radiusError.textContent = "";
    radiusInput.classList.remove("is-invalid");
    saveBtn.disabled = false;
    return true;
}

radiusInput.addEventListener("input", validateRadius);

radiusInput.form.addEventListener("submit", (event) => {
    if (!validateRadius()) {
        event.preventDefault();
    }
});






navigator.geolocation.getCurrentPosition((position) => {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;

    document.getElementById("latitude").textContent =
        latitude.toFixed(6);

    document.getElementById("longitude").textContent =
        longitude.toFixed(6);

    // Update hidden inputs
    document.getElementById("latitudeInput").value = latitude;
    document.getElementById("longitudeInput").value = longitude;
});























const mapElement = document.getElementById("map");

if (mapElement && typeof L !== "undefined") {
    const latitude = Number(mapElement.dataset.lat);
    const longitude = Number(mapElement.dataset.lng);

    if (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
    ) {
        const map = L.map("map").setView(
            [latitude, longitude],
            17
        );

        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                attribution: "&copy; OpenStreetMap contributors"
            }
        ).addTo(map);

        // Red marker for saved college location
        L.circleMarker([latitude, longitude], {
            radius: 9,
            color: "red",
            fillColor: "red",
            fillOpacity: 1,
            weight: 2
        })
            .addTo(map)
            .bindPopup("Saved College Location")
            .openPopup();
    } else {
        console.error("Database latitude/longitude invalid aahet.");
    }
} else {
    console.error("Map element kiwa Leaflet load zalele nahi.");
}


















