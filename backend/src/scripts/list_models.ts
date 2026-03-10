import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(__dirname, "../../.env") });

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
    console.error("No API key found");
    process.exit(1);
}

async function listModels() {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json() as any;
    data.models.forEach((model: any) => {
        if (model.supportedGenerationMethods.includes("generateContent")) {
            console.log(model.name);
        }
    });
}

listModels().catch(console.error);
