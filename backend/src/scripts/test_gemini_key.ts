import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import path from "path";

// Carregar variáveis de ambiente
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function testGeminiKey() {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    console.error("❌ ERRO: GOOGLE_API_KEY não encontrada no arquivo .env");
    return;
  }

  console.log(`🔑 Chave encontrada: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log("📡 Testando conexão com a API do Gemini...");

  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Lista de modelos para testar
  const modelsToTest = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];

  for (const modelName of modelsToTest) {
    console.log(`\n🤖 Testando modelo: ${modelName}...`);
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent("Responda apenas com a palavra 'OK'.");
      const response = result.response.text();
      
      console.log(`✅ SUCESSO! Modelo ${modelName} respondeu: "${response.trim()}"`);
    } catch (error: any) {
      console.error(`❌ FALHA no modelo ${modelName}:`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Status Text: ${error.response.statusText}`);
      }
      console.error(`   Mensagem: ${error.message}`);
    }
  }
}

testGeminiKey();
