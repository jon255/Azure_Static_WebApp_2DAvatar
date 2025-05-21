// Make sure the Azure Speech SDK script is loaded in your index.html:
// <script src="https://aka.ms/csspeech/jsbrowserpackageraw"></script>

let recognizer;
let avatarSynthesizer;  // For Azure avatar TTS

const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusDiv = document.getElementById('status');
const remoteVideoDiv = document.getElementById('remoteVideo');

// WARNING: Never hardcode keys in production!
const subscriptionKey = "Cn6UKwJAzBFFb6r51vwpQrAeJK1UsfzfMQpQUpOFw8D3n7zeHyBmJQQJ99BBACHYHv6XJ3w3AAAYACOG2jVR";    // Replace with your Speech key
const serviceRegion = "eastus2";   // Replace with your Azure region

// ---- Streaming Speech Recognition ----

function startStreamingRecognition() {
    // Initialize speech config
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(subscriptionKey, serviceRegion);
    speechConfig.speechRecognitionLanguage = 'en-US';

    // Use default mic as input
    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

    recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

    // Partial (interim) results
    recognizer.recognizing = (s, e) => {
        statusDiv.innerText = `Heard so far: ${e.result.text}`;
    };

    // Final results
    recognizer.recognized = (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
            statusDiv.innerText = `Recognized: ${e.result.text}`;
            // Instead of speaking immediately, send to backend LLM/agent!
            sendTextToLLMAgent(e.result.text);
        } else if (e.result.reason === SpeechSDK.ResultReason.NoMatch) {
            statusDiv.innerText = "Speech not recognized.";
        }
    };

    recognizer.canceled = (s, e) => {
        statusDiv.innerText = `Recognition canceled: ${e.errorDetails}`;
        recognizer.close();
        recognizer = undefined;
    };

    recognizer.sessionStopped = (s, e) => {
        statusDiv.innerText += "\nSession stopped.";
        recognizer.close();
        recognizer = undefined;
    };

    recognizer.startContinuousRecognitionAsync(
        () => {
            statusDiv.innerText = "Listening (streaming)...";
        },
        (err) => {
            statusDiv.innerText = "Could not start recognition: " + err;
            console.error(err);
        }
    );
}

function stopStreamingRecognition() {
    if (recognizer) {
        recognizer.stopContinuousRecognitionAsync(() => {
            recognizer.close();
            recognizer = undefined;
            statusDiv.innerText = "Stopped listening.";
        });
    }
}

// ---- Azure Avatar TTS ----

function initAvatarSynthesizer() {
    if (avatarSynthesizer) return;

    // WARNING: Do NOT use hardcoded keys in production!
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(subscriptionKey, serviceRegion);

    // You can change the avatar and style as needed:
    const videoFormat = new SpeechSDK.AvatarVideoFormat();
    const avatarConfig = new SpeechSDK.AvatarConfig('lisa', 'casual-sitting', videoFormat);

    avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(speechConfig, avatarConfig);

    // Set up video element for avatar output (if supported)
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
    // Some SDK versions may allow: avatarSynthesizer.avatarVideoElement = videoElement;
    return videoElement;
}

function speakWithAvatar(text) {
    if (!avatarSynthesizer) {
        statusDiv.innerText = "Avatar not ready!";
        return;
    }

    const ttsVoice = 'en-US-AvaMultilingualNeural'; // Customize as needed
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

// ---- Send text to LLM/Foundry agent ----

function sendTextToLLMAgent(text) {
    fetch('/api/llmAgent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text })
    })
    .then(response => response.json())
    .then(data => {
        if (data && data.reply) {
            // Avatar speaks the LLM/Foundry reply!
            if (!avatarSynthesizer) initAvatarSynthesizer();
            speakWithAvatar(data.reply);
        } else {
            statusDiv.innerText = "No reply from agent.";
        }
    })
    .catch(error => {
        statusDiv.innerText = "Error contacting agent: " + error.message;
        console.error('LLM/Agent error:', error);
    });
}

// ---- Button Handlers ----

startButton.onclick = function() {
    startButton.disabled = true;
    stopButton.disabled = false;
    startStreamingRecognition();
};

stopButton.onclick = function() {
    stopButton.disabled = true;
    startButton.disabled = false;
    stopStreamingRecognition();
};
