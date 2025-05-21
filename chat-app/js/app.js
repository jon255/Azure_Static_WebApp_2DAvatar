let mediaRecorder;
let audioChunks = [];
let audioBlob;
let avatarSynthesizer;  // TTS for the avatar

const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusDiv = document.getElementById('status');
const remoteVideoDiv = document.getElementById('remoteVideo');

// WARNING: Do NOT use hardcoded keys in production!
const subscriptionKey = '<YOUR_SPEECH_KEY>';   // Replace with your key
const serviceRegion = '<YOUR_SPEECH_REGION>';  // Replace with your region

function initAvatarSynthesizer() {
    if (avatarSynthesizer) return; // Only init once

    // global SpeechSDK is provided by CDN
    // eslint-disable-next-line no-undef
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(subscriptionKey, serviceRegion);

    // eslint-disable-next-line no-undef
    const videoFormat = new SpeechSDK.AvatarVideoFormat();

    // eslint-disable-next-line no-undef
    const avatarConfig = new SpeechSDK.AvatarConfig('lisa', 'casual-sitting', videoFormat);

    // eslint-disable-next-line no-undef
    avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(speechConfig, avatarConfig);

    // If you have special video support, you can mount it here
    setupAvatarVideoElement();
}

function setupAvatarVideoElement() {
    remoteVideoDiv.innerHTML = '';
    const videoElement = document.createElement('video');
    videoElement.autoplay = true;
    videoElement.muted = false;
    videoElement.playsInline = true;
    videoElement.style.width = '100%';
    videoElement.style.borderRadius = '10px';
    remoteVideoDiv.appendChild(videoElement);
    // Attach to the SDK only if supported by your version
    // e.g., avatarSynthesizer.avatarVideoElement = videoElement;
    return videoElement;
}

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
            sendAudioToFunction(audioBlob);
        };

        mediaRecorder.start();
    } catch (error) {
        console.error("Error accessing microphone:", error);
        statusDiv.innerText = "Error accessing microphone!";
    }
};

stopButton.onclick = function() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    startButton.disabled = false;
    stopButton.disabled = true;
    statusDiv.innerText = "Stopped listening.";
};

function sendAudioToFunction(audioBlob) {
    const reader = new FileReader();
    reader.onloadend = function() {
        const audioBase64 = reader.result.split(',')[1];
        fetch('/api/speechRecognition', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: audioBase64 })
        })
        .then(response => response.json())
        .then(data => {
            if (!data || !data.recognizedText) {
                statusDiv.innerText = "No speech recognized.";
                return;
            }
            statusDiv.innerText = `Recognized: ${data.recognizedText}`;
            if (!avatarSynthesizer) initAvatarSynthesizer();
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
    if (!avatarSynthesizer) {
        statusDiv.innerText = "Avatar not ready!";
        return;
    }

    const ttsVoice = 'en-US-AvaMultilingualNeural';
    const spokenSsml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">
                        <voice name="${ttsVoice}">${text}</voice>
                    </speak>`;

    avatarSynthesizer.speakSsmlAsync(
        spokenSsml,
        result => {
            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                statusDiv.innerText = "Avatar spoke!";
                console.log("Avatar spoke:", result.resultId);
            } else {
                statusDiv.innerText = "Avatar failed to speak!";
                console.error("Speech synthesis failed:", result.errorDetails);
            }
        },
        error => {
            statusDiv.innerText = "Error in avatar speech!";
            console.error("Error in speaking:", error);
        }
    );
}
