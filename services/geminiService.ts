
import { GoogleGenAI, Modality } from "@google/genai";

interface GenerateSpeechParams {
  text: string;
  voiceId: string;
  speed: number;
  pitch: number;
  isSSML: boolean;
}

// Ensure the API key is available from environment variables
if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateSpeech({ text, voiceId, speed, pitch, isSSML }: GenerateSpeechParams): Promise<string> {
  let promptText = text;

  // If SSML is not enabled, wrap plain text with SSML to control speed and pitch.
  // The API uses SSML for these controls.
  if (!isSSML) {
    // Basic sanitization to prevent SSML injection from plain text
    const sanitizedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    promptText = `<speak><prosody rate="${speed.toFixed(2)}" pitch="${pitch}st">${sanitizedText}</prosody></speak>`;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: promptText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceId },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new Error("No audio data received from the API.");
    }

    return base64Audio;
  } catch (error) {
    console.error("Error generating speech with Gemini API:", error);
    throw new Error("Failed to generate speech. Please check the console for details.");
  }
}
