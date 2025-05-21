var avatarSynthesizer;

// Logger
const log = msg => {
    console.log(msg);
}

window.startSession = () => {
    const cogSvcRegion = document.getElementById('region').value;
    const cogSvcSubKey = document.getElementById('subscriptionKey').value;
    if (cogSvcSubKey === '') {
        alert('Please provide the subscription key!');
        return;
    }

    const avatarConfig = new SpeechSDK.AvatarConfig(
        document.getElementById('talkingAvatarCharacter').value,
        document.getElementById('talkingAvatarStyle').value
    );

    const speechSynthesisConfig = SpeechSDK.SpeechConfig.fromSubscription(cogSvcSubKey, cogSvcRegion);
    avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(speechSynthesisConfig, avatarConfig);

    avatarSynthesizer.avatarEventReceived = function (s, e) {
        log("Event received: " + e.description);
    };

    // Establish WebRTC connection
    fetch(`https://${cogSvcRegion}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1`, {
        method: 'GET',
        headers: {
            'Ocp-Apim-Subscription-Key': cogSvcSubKey
        }
    })
    .then(response => response.json())
    .then(data => {
        const iceServerUrl = data.Urls[0];
        const iceServerUsername = data.Username;
        const iceServerCredential = data.Password;
        setupWebRTC(iceServerUrl, iceServerUsername, iceServerCredential);
    });
}

function setupWebRTC(iceServerUrl, iceServerUsername, iceServerCredential) {
    const peerConnection = new RTCPeerConnection({
        iceServers: [{
            urls: [iceServerUrl],
            username: iceServerUsername,
            credential: iceServerCredential
        }]
    });

    peerConnection.ontrack = function (event) {
        const remoteVideoDiv = document.getElementById('remoteVideo');
        const mediaPlayer = document.createElement(event.track.kind);
        mediaPlayer.srcObject = event.streams[0];
        mediaPlayer.autoplay = true;
        remoteVideoDiv.appendChild(mediaPlayer);
    }

    peerConnection.addTransceiver('video', { direction: 'sendrecv' });
    peerConnection.addTransceiver('audio', { direction: 'sendrecv' });

    avatarSynthesizer.startAvatarAsync(peerConnection).then(r => {
        log("Avatar started");
    }).catch(log);
}

window.speak = () => {
    const text = document.getElementById('spokenText').value;
    const ttsVoice = document.getElementById('ttsVoice').value;

    let spokenSsml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'>
                        <voice name='${ttsVoice}'>
                            <mstts:ttsembedding>${text}</mstts:ttsembedding>
                        </voice>
                      </speak>`;

    avatarSynthesizer.speakSsmlAsync(spokenSsml).then(result => {
        if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
            console.log("Speech synthesized: " + result.resultId);
        }
    }).catch(log);
}

window.stopSpeaking = () => {
    avatarSynthesizer.stopSpeakingAsync().then(() => {
        log("Stop speaking request sent.");
    }).catch(log);
}

window.stopSession = () => {
    avatarSynthesizer.close();
    log("Session stopped.");
}

function sendMessage() {
    const inputElement = document.getElementById('userInput');
    const messageText = inputElement.value.trim();

    if (messageText === "") {
        return;
    }

    appendMessage(messageText, "user");
    inputElement.value = "";

    // Simulate Avatar response
    setTimeout(() => {
        appendMessage("Avatar is ready to assist you!", "avatar");
    }, 1000);
}

function appendMessage(text, sender) {
    const chatBox = document.getElementById("chatBox");

    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message");
    if (sender === "user") {
        messageDiv.classList.add("user-message");
    }

    const avatarDiv = document.createElement("div");
    avatarDiv.classList.add("avatar");

    const textDiv = document.createElement("div");
    textDiv.classList.add("text");
    textDiv.textContent = text;

    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(textDiv);

    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}
