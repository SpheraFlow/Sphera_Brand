const cleanAndParseJSON = (text: string) => {
    const sanitize = (rawText: string) => {
        const withoutFences = String(rawText || "")
            .replace(/```json\s */gi, "")
            .replace(/```/g, "")
            .trim();
        // Remove caracteres de controle que quebram JSON
        return withoutFences.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
    };

    const cleanedText = sanitize(text);
    console.log("CLEANED TEXT:", JSON.stringify(cleanedText));

    const candidates: string[] = [];

    const firstArray = cleanedText.indexOf("[");
    const lastArray = cleanedText.lastIndexOf("]");
    if (firstArray !== -1 && lastArray !== -1 && lastArray > firstArray) {
        candidates.push(cleanedText.substring(firstArray, lastArray + 1));
    }

    const firstObj = cleanedText.indexOf("{");
    const lastObj = cleanedText.lastIndexOf("}");
    if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
        candidates.push(cleanedText.substring(firstObj, lastObj + 1));
    }

    candidates.push(cleanedText);

    for (const cand of candidates) {
        try {
            return JSON.parse(cand);
        } catch (e: any) {
            console.log("PARSE FAILED FOR CANDIDATE:", JSON.stringify(cand));
            console.error(e.message);
        }
    }

    throw new Error("Não foi possível interpretar JSON retornado pela IA.");
};

const mockOutput = `\`\`\`json
[
  {
    "dia": 1,
    "tema": "A"
  }
]
\`\`\``;

try {
    cleanAndParseJSON(mockOutput);
    console.log("SUCCESS");
} catch (e) {
    console.error("FAIL", e);
}
