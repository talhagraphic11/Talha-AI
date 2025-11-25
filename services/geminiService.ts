
import { 
  GoogleGenAI,
  Modality
} from "@google/genai";

// Helper to get fresh client instance
const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Image Editing ---
export const editImage = async (
  base64Image: string,
  mimeType: string,
  instruction: string
): Promise<string> => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          {
            text: instruction,
          },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    // Log for debugging if text is returned instead
    console.log("Edit Image Response:", response.candidates?.[0]?.content?.parts);
    throw new Error("No edited image returned");
  } catch (error) {
    console.error("Image editing failed", error);
    throw error;
  }
};

// --- Text to Speech ---
export const generateSpeech = async (
  text: string,
  voiceName: string
): Promise<AudioBuffer> => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { 
        parts: [{ text: text }] 
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    let base64Audio = null;
    // Iterate to find the audio part
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
        if (part.inlineData?.data) {
            base64Audio = part.inlineData.data;
            break;
        }
    }

    if (!base64Audio) {
      console.error("TTS Response missing audio data", response);
      throw new Error("No audio data returned from API. Please try a shorter text or check quota.");
    }

    return await decodeAudio(base64Audio);
  } catch (error) {
    console.error("TTS failed", error);
    throw error;
  }
};

// --- Chat & Tools ---
export interface ChatOptions {
  message: string;
  history?: any[];
  images?: string[]; // base64
  videos?: string[]; // base64
  model?: string;
  useSearch?: boolean;
  useMaps?: boolean;
  thinking?: boolean;
}

export const sendMessage = async ({
  message,
  history = [],
  images = [],
  model = 'gemini-2.5-flash-lite',
  useSearch = false,
  useMaps = false,
  thinking = false
}: ChatOptions) => {
  const ai = getAiClient();
  
  // Model selection override based on tools
  let activeModel = model;
  if (useSearch || useMaps) {
    activeModel = 'gemini-2.5-flash';
  } else if (thinking) {
    activeModel = 'gemini-3-pro-preview';
  }

  const tools: any[] = [];
  if (useSearch) tools.push({ googleSearch: {} });
  if (useMaps) tools.push({ googleMaps: {} });

  const config: any = {};
  if (tools.length > 0) config.tools = tools;
  
  if (thinking && activeModel === 'gemini-3-pro-preview') {
    config.thinkingConfig = { thinkingBudget: 32768 };
  }

  // Construct parts
  const parts: any[] = [];
  if (message && message.trim()) {
      parts.push({ text: message });
  }
  
  images.forEach(img => {
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: img
      }
    });
  });

  if (parts.length === 0) {
    throw new Error("Message or attachment required");
  }

  try {
    const chat = ai.chats.create({
      model: activeModel,
      history: history,
      config: config
    });
    
    // Pass parts directly for maximum compatibility
    const result = await chat.sendMessage({
      message: parts
    });

    return {
      text: result.text,
      grounding: result.candidates?.[0]?.groundingMetadata?.groundingChunks
    };
  } catch (error) {
    console.error("Chat failed", error);
    throw error;
  }
};

// --- Audio Transcription ---
export const transcribeAudio = async (base64Audio: string): Promise<string> => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'audio/wav',
              data: base64Audio
            }
          },
          { text: "Transcribe this audio exactly." }
        ]
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Transcription failed", error);
    throw error;
  }
};

// --- Helpers ---

async function decodeAudio(base64: string, ctx?: AudioContext): Promise<AudioBuffer> {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const dataInt16 = new Int16Array(bytes.buffer);
    const numChannels = 1;
    const sampleRate = 24000;
    const frameCount = dataInt16.length / numChannels;

    // Use OfflineAudioContext for decoding to avoid hardware context limits (max 6)
    // if no context is provided.
    let audioBuffer: AudioBuffer;
    
    if (ctx) {
        audioBuffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    } else {
        const offlineCtx = new OfflineAudioContext(numChannels, frameCount, sampleRate);
        audioBuffer = offlineCtx.createBuffer(numChannels, frameCount, sampleRate);
    }
    
    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return audioBuffer;
}
