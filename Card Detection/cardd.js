// Get elements from the DOM
const video = document.getElementById('videoElement');
const canvas = document.createElement('canvas');
const capturedPhoto = document.getElementById('capturedPhoto');
const cardTypeElement = document.getElementById('cardTypeResult');
const cameraSection = document.getElementById('cameraSection');
const resultSection = document.getElementById('resultSection');
const startButton = document.getElementById('startDetection');
const stopButton = document.getElementById('stopDetection');
const captureButton = document.getElementById('capturePhoto');
const manualDetectButton = document.getElementById('manualDetect');
const cardNumberInput = document.getElementById('cardNumber');
const cancelButton = document.getElementById('cancelProcess');

// Initialize variables for the detection process
let stream = null;
let currentFacingMode = 'environment'; // Default camera mode (back camera)

// Access the user's camera with higher resolution
function startCamera(facingMode = 'environment') {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 600 }, // Request higher resolution for better detection
                height: { ideal: 720 },
                facingMode: facingMode
            }
        })
        .then(function(mediaStream) {
            stream = mediaStream;
            video.srcObject = mediaStream;
            video.play();
            cameraSection.style.display = 'block'; // Show the camera section
            captureButton.disabled = false; // Enable Capture Image button
            stopButton.disabled = false; // Enable Stop Detection button
            cancelButton.disabled = false; // Enable Cancel button
            startButton.style.display = 'none'; // Hide the start detection button
        })
        .catch(function(err) {
            console.error("Error accessing camera: ", err);
            alert('Unable to access your camera. Please ensure it is enabled.');
        });
    }
}

// Stop the camera and clear the previous data
function stopCamera() {
    if (stream) {
        let tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        stream = null;
        video.srcObject = null;
    }

    // Clear previous data and reset the interface
    capturedPhoto.src = ""; // Clear the image source
    capturedPhoto.style.display = 'none'; // Hide the captured photo
    cardTypeElement.textContent = "No card detected"; // Reset the card type display
    cardNumberInput.value = ""; // Clear manual card number input

    // Return to the main camera view
    cameraSection.style.display = 'none'; // Hide the camera section
    resultSection.style.display = 'none'; // Hide the result section
    startButton.style.display = 'block'; // Show the Start Detection button again
}

// Capture photo from video stream, preprocess image, and perform OCR
function capturePhoto() {
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Preprocess image: Adjust contrast and brightness only
    context.filter = 'contrast(2) brightness(1.3)'; // Removed grayscale effect
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get the image data URL from the canvas and display it
    const imageDataUrl = canvas.toDataURL('image/png');
    capturedPhoto.src = imageDataUrl;
    capturedPhoto.style.display = 'block';

    // Show captured image and result, keep the camera running for next capture
    resultSection.style.display = 'block';
    captureButton.disabled = false; // Allow the user to capture another image immediately

    // Perform OCR on the captured image
    Tesseract.recognize(
        imageDataUrl,
        'eng',
        {
            logger: info => console.log(info), // Log progress
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' // Only allow alphanumeric characters
        }
    ).then(({ data: { text } }) => {
        console.log('Recognized text:', text); // Log the recognized text for debugging
        checkIdentityCard(text.trim()); // Check if recognized text is a valid card number
    });
}

// Verhoeff algorithm for Aadhar validation
const verhoeffTableD = [
    [0,1,2,3,4,5,6,7,8,9],
    [1,2,3,4,0,6,7,8,9,5],
    [2,3,4,0,1,7,8,9,5,6],
    [3,4,0,1,2,8,9,5,6,7],
    [4,0,1,2,3,9,5,6,7,8],
    [5,9,8,7,6,0,4,3,2,1],
    [6,5,9,8,7,1,0,4,3,2],
    [7,6,5,9,8,2,1,0,4,3],
    [8,7,6,5,9,3,2,1,0,4],
    [9,8,7,6,5,4,3,2,1,0]
];
const verhoeffTableP = [
    [0,1,2,3,4,5,6,7,8,9],
    [1,5,7,6,2,8,3,0,9,4],
    [5,8,0,3,7,9,6,1,4,2],
    [8,9,1,6,0,4,3,5,2,7],
    [9,4,5,3,1,2,6,8,7,0],
    [4,2,8,6,5,7,3,9,0,1],
    [2,7,9,3,8,0,6,4,1,5],
    [7,0,4,6,9,1,3,2,5,8]
];

// Verhoeff algorithm check digit function
function verhoeffValidate(num) {
    let c = 0;
    const myArray = num.split("").reverse().map(x => Number(x));
    for (let i = 0; i < myArray.length; i++) {
        c = verhoeffTableD[c][verhoeffTableP[i % 8][myArray[i]]];
    }
    return (c === 0);
}

// Check for Aadhar card and PAN card numbers using regex
function checkIdentityCard(text) {
    const aadharRegex = /\b\d{4} ?\d{4} ?\d{4}\b/; // Aadhar format (12 digits with optional spaces)
    const panRegex = /\b[A-Z]{5}\d{4}[A-Z]\b/;  // PAN card format

    let cardType = "No valid card detected";

    // Check for Aadhar card
    const aadharMatch = text.match(aadharRegex);
    if (aadharMatch) {
        const detectedNumber = aadharMatch[0].replace(/\s/g, ''); // Remove spaces
        if (verhoeffValidate(detectedNumber)) {
            cardType ="Valid Aadhar Card  " + detectedNumber;
            //cardType ="Valid Aadhar Card + (${detectedNumber}) ";
        } else {
            cardType = "Invalid Aadhar Card (Checksum Failed)";
        }
    }

    // Check for PAN card
    const panMatch = text.match(panRegex);
    if (panMatch) {
        cardType = 'Detected: PAN Card (${panMatch[0]})';
        cardType = 'Detected: PAN Card '+ panMatch;
    }

    cardTypeElement.textContent = cardType;
}

// Manually detect card type based on input
function detectCardType() {
    const cardNumber = cardNumberInput.value.trim();
    let cardType = "Invalid Input";

    // Check if it's a valid 12-digit Aadhar number
    if (/^\d{12}$/.test(cardNumber)) {
        if (verhoeffValidate(cardNumber)) {
            cardType = "Valid Aadhar Card";
        } else {
            cardType = "Invalid Aadhar Card (Checksum Failed)";
        }
    } else if (/[A-Z]{5}\d{4}[A-Z]/.test(cardNumber)) {
        cardType = "Detected: PAN Card";
    }

    cardTypeElement.textContent = cardType; // Display result
}

// Event listeners for buttons
startButton.addEventListener('click', () => startCamera(currentFacingMode));
stopButton.addEventListener('click', stopCamera);
captureButton.addEventListener('click', capturePhoto);
manualDetectButton.addEventListener('click', detectCardType);
cancelButton.addEventListener('click', stopCamera);