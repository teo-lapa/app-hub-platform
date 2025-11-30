const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

async function test() {
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });
    
    console.log("✅ Client Gemini inizializzato correttamente");
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: "A simple red circle on white background",
      config: {
        responseModalities: ['Image'],
        imageConfig: { aspectRatio: "1:1" }
      }
    });
    
    console.log("✅ Test generazione immagine riuscito!");
    console.log("Response:", response);
  } catch (error) {
    console.error("❌ Errore:", error.message);
    console.error("Stack:", error.stack);
  }
}

test();
