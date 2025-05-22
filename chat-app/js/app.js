const subscriptionKey = "Cn6UKwJAzBFFb6r51vwpQrAeJK1UsfzfMQpQUpOFw8D3n7zeHyBmJQQJ99BBACHYHv6XJ3w3AAAYACOG2jVR";
const serviceRegion = "eastus2";

let recognizer;
let avatarSynthesizer;
let avatarSessionStarted = false;
let avatarSpeechQueue = [];
let isSpeaking = false; // Tracks if avatar is speaking
let peerConnection;

const startButton = document.getElementById('startButton');
const stopButton  = document.getElementById('stopButton');
const statusDiv   = document.getElementById('status');
const remoteVideoDiv = document.getElementById('remoteVideo');

// --- Update button label depending on state ---
function updateStartButtonLabel() {
    if (avatarSessionStarted) {
        startButton.innerText = isSpeaking ? "Interrupt Avatar" : "Start Speaking";
    } else {
        startButton.innerText = "Start Speaking";
    }
}

// Clean up function
function cleanupAvatarSession() {
    if (avatarSynthesizer) {
        avatarSynthesizer.close();
        avatarSynthesizer = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    remoteVideoDiv.innerHTML = '';
    avatarSessionStarted = false;
    avatarSpeechQueue = [];
    isSpeaking = false;
    updateStartButtonLabel();
}

// Create Peer Connection
function createPeerConnection() {
    peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }]
    });

    // Video and audio handling
    peerConnection.ontrack = function(event) {
        if (event.track.kind === 'video') {
            let videoElem = document.querySelector("#remoteVideo video");
            if (!videoElem) {
                videoElem = document.createElement('video');
                videoElem.autoplay = true;
                videoElem.muted = false;
                videoElem.playsInline = true;
                videoElem.style.width = '100%';
                document.getElementById('remoteVideo').appendChild(videoElem);
            }
            videoElem.srcObject = event.streams[0];
        }
        if (event.track.kind === 'audio') {
            let audioElem = document.querySelector("#remoteVideo audio");
            if (!audioElem) {
                audioElem = document.createElement('audio');
                audioElem.autoplay = true;
                document.getElementById('remoteVideo').appendChild(audioElem);
            }
            audioElem.srcObject = event.streams[0];
        }
    };

    peerConnection.addTransceiver('video', { direction: 'recvonly' });
    peerConnection.addTransceiver('audio', { direction: 'recvonly' });

    return peerConnection;
}

// Avatar Init
function initAvatarSynthesizer() {
    if (avatarSynthesizer && avatarSessionStarted) return;

    statusDiv.innerText = "Initializing avatar...";

    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(subscriptionKey, serviceRegion);
    const videoFormat = new SpeechSDK.AvatarVideoFormat();
    const avatarConfig = new SpeechSDK.AvatarConfig('lisa', 'casual-sitting', videoFormat);

    avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(speechConfig, avatarConfig);
    avatarSynthesizer.avatarEventReceived = function (s, e) {
        console.log("Avatar event:", e.description);
    };

    createPeerConnection();
    avatarSynthesizer.startAvatarAsync(peerConnection).then(
        (result) => {
            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                avatarSessionStarted = true;
                statusDiv.innerText = "Avatar ready!";
                updateStartButtonLabel();
                console.log("Avatar session started!");
                // Speak any queued text
                while (avatarSpeechQueue.length > 0) {
                    speakWithAvatar(avatarSpeechQueue.shift());
                }
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
        statusDiv.innerText = "Avatar not ready (queuing)...";
        avatarSpeechQueue.push(text);
        if (!avatarSynthesizer) initAvatarSynthesizer();
        return;
    }

    const ttsVoice = 'en-US-AvaMultilingualNeural';
    const spokenSsml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" 
        xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">
        <voice name="${ttsVoice}">${text}</voice>
    </speak>`;

    isSpeaking = true; // Mark avatar as speaking
    updateStartButtonLabel();

    avatarSynthesizer.speakSsmlAsync(
        spokenSsml,
        result => {
            isSpeaking = false; // Done speaking
            updateStartButtonLabel();
            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                statusDiv.innerText = "Avatar spoke!";
                // Optionally: start listening again here
                startStreamingRecognition();
            } else {
                statusDiv.innerText = "Avatar failed to speak!";
            }
        },
        error => {
            isSpeaking = false; // Done on error
            updateStartButtonLabel();
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

    // Interrupt TTS when user starts speaking
    recognizer.recognizing = (s, e) => {
        // If avatar is speaking, stop it!
        if (isSpeaking && avatarSynthesizer) {
            avatarSynthesizer.stopSpeakingAsync(() => {
                isSpeaking = false;
                updateStartButtonLabel();
                statusDiv.innerText = "TTS interrupted by user speech. Listening...";
            });
        }
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

// --- User wants to speak (button or mic) ---
function userWantsToSpeak() {
    if (avatarSynthesizer && isSpeaking) {
        avatarSynthesizer.stopSpeakingAsync(() => {
            isSpeaking = false;
            updateStartButtonLabel();
            statusDiv.innerText = "Avatar stopped. Listening...";
            startStreamingRecognition();
        });
    } else {
        startStreamingRecognition();
    }
    statusDiv.innerText = "Listening...";
}

// --- Button handlers ---
startButton.onclick = function() {
    startButton.disabled = true;
    stopButton.disabled = false;
    cleanupAvatarSession();
    initAvatarSynthesizer();
    userWantsToSpeak();
    updateStartButtonLabel();
};

stopButton.onclick = function() {
    stopButton.disabled = true;
    startButton.disabled = false;
    stopStreamingRecognition();
    updateStartButtonLabel();
};

// Auto-init avatar on load
window.onload = function() {
    initAvatarSynthesizer();
    updateStartButtonLabel();
};
