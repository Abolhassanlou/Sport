
import { GoogleGenAI } from "@google/genai";
import { Exercise, RepState } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const model = 'gemini-2.5-flash';

const getPromptForExercise = (exercise: Exercise): string => {
  const basePrompt = `You are a fitness AI assistant. Analyze the user's position in this image. The user is doing ${exercise}.
  Determine if their body is in the 'UP' position or the 'DOWN' position for one repetition.
  Respond with ONLY one of the following words: 'UP', 'DOWN', or 'NEUTRAL'.`;

  switch (exercise) {
    case Exercise.Pushups:
      return `${basePrompt} For push-ups, 'DOWN' is when the chest is close to the floor. 'UP' is when the arms are fully extended.`;
    case Exercise.Squats:
      return `${basePrompt} For squats, 'DOWN' is when the hips are at or below the knees. 'UP' is when the person is standing straight.`;
    case Exercise.JumpingJacks:
      return `${basePrompt} For jumping jacks, 'DOWN' is when the feet are together and arms are at the sides. 'UP' is when the feet are apart and arms are overhead.`;
    default:
      return basePrompt;
  }
};

const analyzeFrame = async (base64Image: string, exercise: Exercise): Promise<RepState> => {
  try {
    const prompt = getPromptForExercise(exercise);
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Image,
      },
    };

    const response = await ai.models.generateContent({
      model,
      contents: { parts: [imagePart, { text: prompt }] },
    });
    
    const text = response.text.trim().toUpperCase();

    if (text === 'UP' || text === 'DOWN' || text === 'NEUTRAL') {
      return text as RepState;
    }
    
    console.warn(`Unexpected response from Gemini: "${text}"`);
    return 'NEUTRAL';
  } catch (error) {
    console.error("Error analyzing frame with Gemini:", error);
    // In case of an error, return 'NEUTRAL' to avoid breaking the app flow
    return 'NEUTRAL';
  }
};

export const geminiService = {
  analyzeFrame,
};
