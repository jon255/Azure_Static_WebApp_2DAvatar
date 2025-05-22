let recognizer;
let avatarSynthesizer;  // For Azure avatar TTS
let avatarSessionStarted = false;
let avatarSpeechQueue = []; // New: store text to speak until avatar is ready

// ...rest of your code above...

function initAvatarSynthesizer() {
    if (avatarSynthesizer && avatarSessionStarted) {
        // Already started
        // If there are queued texts, speak them
        if (avatarSpeechQueue.length > 0) {
            while (avatarSpeechQueue.length > 0) {
                speakWithAvatar(avatarSpeechQueue.shift());
            }
        }
        return;
    }

    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(subscriptionKey, serviceRegion);
    const videoFormat = new SpeechSDK.AvatarVideoFormat();
    const avatarConfig = new SpeechSDK.AvatarConfig('lisa', 'casual-sitting', videoFormat);

    avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(speechConfig, avatarConfig);

    // Setup and assign the video element!
    remoteVideoDiv.innerHTML = '';
    const videoElement = document.createElement('video');
    videoElement.autoplay = true;
    videoElement.muted = false;
    videoElement.playsInline = true;
    videoElement.style.width = '100%';
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
                console.log("Avatar session started!");

                // Speak any queued text
                while (avatarSpeechQueue.length > 0) {
                    speakWithAvatar(avatarSpeechQueue.shift());
                }
            } else {
                console.error("Avatar session NOT started. Reason:", result.reason);
            }
        },
        (err) => {
            console.error("Avatar session failed to start:", err);
        }
    );
}

function speakWithAvatar(text) {
    if (!avatarSynthesizer || !avatarSessionStarted) {
        // Queue up text and try to (re)init the avatar
        avatarSpeechQueue.push(text);
        initAvatarSynthesizer();
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
