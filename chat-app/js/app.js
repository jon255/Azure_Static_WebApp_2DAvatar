const subscriptionKey = "Cn6UKwJAzBFFb6r51vwpQrAeJK1UsfzfMQpQUpOFw8D3n7zeHyBmJQQJ99BBACHYHv6XJ3w3AAAYACOG2jVR";
const serviceRegion = "eastus2";

let recognizer;
let avatarSynthesizer;
let avatarSessionStarted = false;

const startButton = document.getElementById('startButton');
const stopButton  = document.getElementById('stopButton');
const statusDiv   = document.getElementById('status');
const remoteVideoDiv = document.getElementById('remoteVideo');

// --- Avatar Init ---

function initAvatarSynthesizer() {
    if (avatarSynthesizer && avatarSessionStarted) return;
    statusDiv.innerText = "Initializing avatar...";
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(subscriptionKey, serviceRegion);
    const videoFormat = new SpeechSDK.AvatarVideoFormat();
    const avatarConfig = new SpeechSDK.AvatarConfig('lisa', 'casual-sitting', videoFormat);

    avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(speechConfig, avatarConfig);
    remoteVideoDiv.innerHTML = '';
    const videoElement = document.createElement('video');
    videoElement.autoplay = true;
    videoElement.muted = false;
    videoElement.playsInline = true;
    videoElement.style.width = '100%';
    videoElement.style.height = '320px';
    videoElement.style.borderRadius = '10px';
    remoteVideoDiv.appendChild(videoElement);
    avatarSynthesizer.avatarVideoElement = videoElement;

    avatarSynthesizer.avatarEventReceived = function (s, e) {
        console.log("Avatar event:", e.description);
    };

    avatarSynthesizer.startAvatarAsync().then(
        (result) => {
            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                avatarSessionStarted = true;
                statusDiv.innerText = "Avatar ready!";
                console.log("Avatar session started!");
            } else {
                statusDiv.innerText = "Avatar session NOT started!";
                console.error("Avatar session NOT started. Reason:", result.reason);
            }
        },
        (err) => {
            statusDiv.innerText = "Avatar session failed to start!";
            console.error("Avatar session failed to start:", err);
        }
    );
}

// --- TTS with Avatar ---

function speakWithAvatar(text) {
    if (!avatarSynthesizer || !avatarSessionStarted) {
        statusDiv.innerText = "Avatar not ready!";
        return;
    }
    const ttsVoice = 'en-US-AvaMultilingualNeural';
    const spokenSsml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"
        xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">
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

// --- LLM Agent ---

function sendTextToLLMAgent(text) {
    fetch('/api/llmAgent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text })
    })
    .then(async response => {
        const textResponse = await response.text();
        if (!textResponse) throw new Error('Empty response from backend');
        let data;
        try {
            data = JSON.parse(textResponse);
        } catch {
            throw new Error('Invalid JSON from backend: ' + textResponse);
        }
        return data;
    })
    .then(data => {
        if (data && data.reply) {
            // Avatar speaks the LLM/Foundry reply!
            speakWithAvatar(data.reply);
        } else if (data && data.error) {
            statusDiv.innerText = "Agent error: " + data.error;
        } else {
            statusDiv.innerText = "No reply from agent.";
        }
    })
    .catch(error => {
        statusDiv.innerText = "Error contacting agent: " + error.message;
        console.error('LLM/Agent error:', error);
    });
}

// --- Speech to Text ---

function startStreamingRecognition() {
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(subscriptionKey, serviceRegion);
    speechConfig.speechRecognitionLanguage = 'en-US';
    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

    recognizer.recognizing = (s, e) => {
        statusDiv.innerText = `Heard so far: ${e.result.text}`;
    };

    recognizer.recognized = (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
            statusDiv.innerText = `Recognized: ${e.result.text}`;
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
        () => { statusDiv.innerText = "Listening (streaming)..."; },
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

// --- Button handlers ---

startButton.onclick = function() {
    startButton.disabled = true;
    stopButton.disabled = false;
    initAvatarSynthesizer();
    startStreamingRecognition();
};

stopButton.onclick = function() {
    stopButton.disabled = true;
    startButton.disabled = false;
    stopStreamingRecognition();
};

window.onload = function() {
    initAvatarSynthesizer();
};
