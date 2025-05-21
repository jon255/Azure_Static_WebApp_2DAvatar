const { SpeechConfig, AudioConfig, SpeechRecognizer, ResultReason } = require('microsoft-cognitiveservices-speech-sdk');

// Retrieve the Azure Speech Service key and region from the environment variables
const subscriptionKey = process.env.AZURE_SPEECH_KEY;
const serviceRegion = process.env.AZURE_REGION;
const customModelEndpoint = process.env.AI_FOUNDY_MODEL_ENDPOINT; // Custom model endpoint (if using one)

module.exports = async function (context, req) {
    const audioData = req.body.audio; // The audio data sent from the front-end (Base64 encoded)

    // Initialize the Speech SDK's SpeechConfig
    const speechConfig = SpeechConfig.fromSubscription(subscriptionKey, serviceRegion);

    // Use your custom model's endpoint
    speechConfig.speechRecognitionEndpoint = customModelEndpoint;

    // Create AudioConfig using the received audio data (you may need to decode Base64)
    const audioConfig = AudioConfig.fromAudioData(audioData);

    // Create the SpeechRecognizer
    const recognizer = new SpeechRecognizer(speechConfig, audioConfig);

    try {
        // Perform speech recognition
        const result = await recognizer.recognizeOnceAsync();

        if (result.reason === ResultReason.RecognizedSpeech) {
            context.res = {
                status: 200,
                body: { recognizedText: result.text }
            };
        } else if (result.reason === ResultReason.Canceled) {
            context.res = {
                status: 500,
                body: { error: `Recognition Canceled: ${result.canceledDetails}` }
            };
        }
    } catch (error) {
        console.error('Error:', error);
        context.res = {
            status: 500,
            body: { error: error.message }
        };
    }
};
