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

// Capture face image
// captureBtn.addEventListener("click", () => {
//     if (!cameraStream || !video.videoWidth || !video.videoHeight) {
//         setStatus("Start the camera and wait for the video first.", "error");
//         return;
//     }

//     canvas.width = video.videoWidth;
//     canvas.height = video.videoHeight;

//     const context = canvas.getContext("2d");

//     // Mirror the image to match the mirrored video preview.
//     context.translate(canvas.width, 0);
//     context.scale(-1, 1);
//     context.drawImage(video, 0, 0, canvas.width, canvas.height);

//     capturedImage = canvas.toDataURL("image/jpeg", 0.9);
//     faceImageInput.value = capturedImage;

//     preview.src = capturedImage;
//     previewSection.hidden = false;

//     setStatus("Image captured successfully. You can now add the user.", "success");
// });


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

// Clear form and captured image
clearBtn.addEventListener("click", () => {
    if (processing) return;

    stopCamera();

    capturedImage = "";
    faceImageInput.value = "";
    preview.removeAttribute("src");
    previewSection.hidden = true;

    setStatus("Form cleared. Start the camera again.");
});

// Validate form before submitting
form.addEventListener("submit", event => {
    if (processing) {
        event.preventDefault();
        return;
    }

    if (!capturedImage || !faceImageInput.value) {
        event.preventDefault();

        setStatus("Please start the camera and capture your face first.", "error");
        return;
    }

    processing = true;
    addUserBtn.disabled = true;
    addUserBtn.textContent = "Adding User...";

    setStatus("Submitting user details and face image...");
});

// Release camera when leaving the page
window.addEventListener("pagehide", stopCamera);











let modelsLoaded = false;

async function loadFaceModels() {
    try {
        setStatus("Loading face models...");

        if (typeof faceapi === "undefined") {
            throw new Error(
                "face-api.js library is not loaded. Check script path."
            );
        }

        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
            faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
            faceapi.nets.faceRecognitionNet.loadFromUri("/models")
        ]);

        modelsLoaded = true;

        setStatus(
            "All face models loaded. You can start the camera.",
            "success"
        );

        console.log("All face models loaded successfully!");
    } catch (error) {
        modelsLoaded = false;

        console.error("Face model loading failed:", error);

        setStatus(
            "Model loading failed: " + error.message,
            "error"
        );
    }
}

loadFaceModels();










// set location


