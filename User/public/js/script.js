const form = document.getElementById("addUserForm");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const preview = document.getElementById("preview");

const startBtn = document.getElementById("startBtn");
const captureBtn = document.getElementById("captureBtn");
const clearBtn = document.getElementById("clearBtn");
const addUserBtn = document.getElementById("addUserBtn");

const placeholder = document.getElementById("placeholder");
const faceGuide = document.getElementById("faceGuide");
const previewSection = document.getElementById("previewSection");
const statusText = document.getElementById("status");
const faceImageInput = document.getElementById("face_image");
const faceFeaturesInput = document.getElementById("face_features");

let cameraStream = null;
let capturedImage = "";
let processing = false;

function setStatus(message, type = "") {
    statusText.textContent = message;
    statusText.className = "status";

    if (type) {
        statusText.classList.add(type);
    }
}

// Start webcam
startBtn.addEventListener("click", async () => {
    try {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error(
                "Camera API unavailable. Use localhost or HTTPS."
            );
        }

        stopCamera();

        setStatus("Starting camera...");

        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user",
                width: { ideal: 640 },
                height: { ideal: 480 }
            },
            audio: false
        });

        video.srcObject = cameraStream;
        await video.play();

        video.classList.add("active");
        placeholder.hidden = true;
        faceGuide.classList.add("visible");

        startBtn.disabled = true;
        captureBtn.disabled = false;

        setStatus("Camera started. Position your face inside the frame.", "success");
    } catch (error) {
        console.error("Camera error:", error);

        stopCamera();

        setStatus(
            error.name === "NotAllowedError"
                ? "Camera permission denied. Allow camera access in your browser."
                : error.name === "NotFoundError"
                ? "No camera found on this device."
                : error.message || "Unable to start camera.",
            "error"
        );
    }
});














// Capture image and extract face features
captureBtn.addEventListener("click", async () => {
    try {
        if (!cameraStream || !video.videoWidth) {
            setStatus("Start the camera first.", "error");
            return;
        }

        if (!modelsLoaded) {
            setStatus("Please wait. Face models are loading.", "error");
            return;
        }

        captureBtn.disabled = true;
        setStatus("Detecting face...");

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const context = canvas.getContext("2d");
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const result = await faceapi
            .detectSingleFace(
                canvas,
                new faceapi.TinyFaceDetectorOptions()
            )
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!result) {
            throw new Error("Face not detected. Try again.");
        }

        const features = Array.from(result.descriptor);
        const image = canvas.toDataURL("image/jpeg", 0.9);

        capturedImage = image;
        faceImageInput.value = image;
        faceFeaturesInput.value = JSON.stringify(features);

        preview.src = image;
        previewSection.hidden = false;

        console.log("Face features:", features);
        console.log("Feature count:", features.length);

        setStatus(
            `Face captured! ${features.length} features extracted.`,
            "success"
        );
    } catch (error) {
        console.error("Face extraction error:", error);
        faceFeaturesInput.value = "";
        setStatus(error.message, "error");
    } finally {
        captureBtn.disabled = !cameraStream;
    }
});

// Stop webcam and release camera resources
function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    video.pause();
    video.srcObject = null;
    video.classList.remove("active");

    placeholder.hidden = false;
    faceGuide.classList.remove("visible");

    startBtn.disabled = false;
    captureBtn.disabled = true;
}








const MODEL_URL = "/models";

let modelsLoaded = false;

async function loadFaceModels() {
    try {
        setStatus("Loading face recognition models...");

        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

        modelsLoaded = true;
        setStatus("Models loaded. Start the camera.", "success");
    } catch (error) {
        console.error("Model loading error:", error);
        setStatus("Failed to load face models. Check model paths.", "error");
    }
}

loadFaceModels();













// location
form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!faceFeaturesInput.value) {
        setStatus("Please capture your face first.", "error");
        return;
    }

    if (!navigator.geolocation) {
        setStatus("Geolocation is not supported by your browser.", "error");
        return;
    }

    addUserBtn.disabled = true;
    setStatus("Getting your location...", "");

    navigator.geolocation.getCurrentPosition(
        function (position) {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            document.getElementById("latitude").value = latitude;
            document.getElementById("longitude").value = longitude;

            console.log("Latitude:", latitude);
            console.log("Longitude:", longitude);

            setStatus("Location captured. Submitting attendance...", "success");

            form.submit();
        },
        function (error) {
            addUserBtn.disabled = false;

            const messages = {
                1: "Location permission denied. Please allow location access.",
                2: "Location unavailable. Please try again.",
                3: "Location request timed out. Please try again."
            };

            setStatus(
                messages[error.code] || "Unable to get your location.",
                "error"
            );
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }
    );
});