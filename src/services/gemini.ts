import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function summarizePDF(text: string, length: 'short' | 'medium' | 'detailed' = 'medium', includeBullets: boolean = true) {
  try {
    const lengthPrompt = {
      short: "Provide a very brief 2-sentence summary.",
      medium: "Provide a concise executive summary (approx 3-4 paragraphs).",
      detailed: "Provide an in-depth, structured summary covering all sections."
    };

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an expert document analyst. ${lengthPrompt[length]} ${includeBullets ? "Include a 'Key Takeaways' section with bullet points." : "Do not include a bulleted list."} Use Markdown for formatting.\n\nText:\n${text.substring(0, 30000)}`,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Failed to generate summary. Please try again.");
  }
}

export async function performOCR(imageBase64: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { text: "Extract all text from this image accurately. Maintain structure if possible." },
        { inlineData: { mimeType: "image/jpeg", data: imageBase64.split(',')[1] } }
      ]
    });
    return response.text;
  } catch (error) {
    return "OCR failed.";
  }
}

export async function analyzeTone(text: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the tone and primary subject of this document. Return a JSON object with "tone" (string), "subject" (string), and "complexity" (1-10). \n\nText: ${text.slice(0, 5000)}`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text);
  } catch (error) {
    return { tone: "Neutral", subject: "Unknown", complexity: 5 };
  }
}

export async function compareDocuments(textA: string, textB: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a legal and technical document auditor. Compare these two versions of a document and identify the key differences. Focus on additions, deletions, and significant semantic changes. Return your analysis in Markdown format with clearly labeled sections.\n\nDocument A:\n${textA.substring(0, 15000)}\n\nDocument B:\n${textB.substring(0, 15000)}`,
    });
    return response.text;
  } catch (error) {
    return "Comparison engine failed to process deltas.";
  }
}
