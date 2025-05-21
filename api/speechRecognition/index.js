const { SpeechConfig, AudioConfig, SpeechRecognizer, ResultReason } = require('microsoft-cognitiveservices-speech-sdk');
const fs = require('fs');
const path = require('path');

const subscriptionKey = process.env.AZURE_SPEECH_KEY;
const serviceRegion = process.env.AZURE_REGION;
const customModelEndpoint = process.env.AI_FOUNDY_MODEL_ENDPOINT;

module.exports = async function (context, req) {
    try {
        const audioBase64 = req.body.audio;
        if (!audioBase64) {
            context.res = { status: 400, body: { error: "No audio data provided." } };
            return;
        }

        // Decode base64 audio and write to temp WAV file
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        const tempFilePath = path.join('/tmp', `audio-${Date.now()}.wav`);
        fs.writeFileSync(tempFilePath, audioBuffer);

        // Setup SpeechConfig
        const speechConfig = SpeechConfig.fromSubscription(subscriptionKey, serviceRegion);
        if (customModelEndpoint) {
            speechConfig.speechRecognitionEndpoint = customModelEndpoint;
        }

        // Use the temp WAV file for AudioConfig
        const audioConfig = AudioConfig.fromWavFileInput(fs.createReadStream(tempFilePath));

        const recognizer = new SpeechRecognizer(speechConfig, audioConfig);

        recognizer.recognizeOnceAsync(result => {
            fs.unlinkSync(tempFilePath); // Clean up temp file

            if (result.reason === ResultReason.RecognizedSpeech) {
                context.res = {
                    status: 200,
                    body: { recognizedText: result.text }
                };
            } else if (result.reason === ResultReason.Canceled) {
                context.res = {
                    status: 500,
                    body: { error: "Recognition canceled." }
                };
            } else {
                context.res = {
                    status: 500,
                    body: { error: "Recognition failed." }
                };
            }
        }, error => {
            fs.unlinkSync(tempFilePath);
            context.res = {
                status: 500,
                body: { error: error.message }
            };
        });

    } catch (error) {
        context.res = {
            status: 500,
            body: { error: error.message }
        };
    }
};
