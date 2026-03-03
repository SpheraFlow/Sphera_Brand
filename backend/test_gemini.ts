import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "./src/config/database";
import fs from "fs";

async function run() {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const res = await db.query("SELECT body FROM prompt_templates WHERE id = 'b436a27a-99e6-4fa2-84c8-e6c1b372dfd1'");
    const prompt = res.rows[0].body + "\n\nGERAR 2 POSTS PARA TESTE APENAS.";

    try {
        const result = await model.generateContent(prompt);
        fs.writeFileSync("gemini_output.txt", result.response.text());
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
