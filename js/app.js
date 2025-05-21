let mediaRecorder;
let audioChunks = [];
let audioBlob;
let avatarSynthesizer;  // TTS for the avatar
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusDiv = document.getElementById('status');

// Start listening when the "Start Speaking" button is clicked
startButton.onclick = async function() {
    startButton.disabled = true;
    stopButton.disabled = false;
    statusDiv.innerText = "Listening...";

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = function(event) {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = function() {
            audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            audioChunks = [];
            // Send the audio data to Azure Function for recognition
            sendAudioToFunction(audioBlob);
        };

        mediaRecorder.start();
    } catch (error) {
        console.error("Error accessing microphone:", error);
        statusDiv.innerText = "Error accessing microphone!";
    }
};

// Stop listening when the "Stop Speaking" button is clicked
stopButton.onclick = function() {
    mediaRecorder.stop();
    startButton.disabled = false;
    stopButton.disabled = true;
    statusDiv.innerText = "Stopped listening.";
};

function sendAudioToFunction(audioBlob) {
    // Convert the audioBlob to Base64 encoding for sending
    const reader = new FileReader();
    reader.onloadend = function() {
        const audioBase64 = reader.result.split(',')[1]; // Get Base64 encoded audio
        fetch('/api/speechRecognition', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: audioBase64 })  // Send Base64 audio
        })
        .then(response => response.json())
        .then(data => {
            console.log("Recognized Text:", data.recognizedText);
            statusDiv.innerText = `Recognized: ${data.recognizedText}`;
            // Pass recognized text to avatar TTS
            speakWithAvatar(data.recognizedText);
        })
        .catch(error => {
            console.error('Error with function:', error);
            statusDiv.innerText = "Error with recognition!";
        });
    };
    reader.readAsDataURL(audioBlob);
}

function speakWithAvatar(text) {
    // Use Azure TTS (Text-to-Speech) to speak back the recognized text
    const ttsVoice = 'en-US-AvaMultilingualNeural'; // You can customize this
    const spokenSsml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">
                        <voice name="${ttsVoice}">
                            ${text}
                        </voice>
                    </speak>`;

    avatarSynthesizer.speakSsmlAsync(spokenSsml).then((result) => {
        if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
            console.log("Avatar spoke:", result.resultId);
        }
    }).catch((error) => {
        console.error("Error in speaking:", error);
    });
}
