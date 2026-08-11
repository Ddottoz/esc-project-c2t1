const fs = require("fs");
const OpenAI = require("openai");

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function analyzePdf(filePath) {

    console.log("creating client file");
    const file = await client.files.create({
        file: fs.createReadStream(filePath),
        purpose: "user_data"
    });

    const prompt = `
You are an expert literacy assessment assistant.

Your task is to analyze the writing contained in the provided image.

Instructions:

1. Carefully read all visible handwritten text. 
2. Produce an exact transcription of the writing.
   - Preserve spelling mistakes.
   - Preserve punctuation.
   - Preserve line breaks where possible.
   - Do NOT automatically correct any words.
   - If a word is unclear, write [unclear].
3. After transcription, analyze the writing for literacy errors.
4. Identify every literacy error you can find, including:
   - Spelling
   - Grammar
   - Capitalization
   - Punctuation
   - Word choice
   - Subject-verb agreement
   - Verb tense
   - Sentence fragments
   - Run-on sentences
   - Missing words
   - Incorrect word order
5. For each error:
   - Quote the original text exactly.
   - Provide the corrected version.
   - Explain why it is incorrect.
6. If no errors are found, return an empty errors array.
7. Do not invent words that are not visible.
8. If text is unreadable, indicate that it is unreadable instead of guessing.

After identifying the errors, determine the student's overall literacy strengths and weaknesses.

Do not diagnose a medical, developmental, or learning disorder. Instead, describe observable literacy behaviours demonstrated in the writing.

Consider:

Which types of errors occur most frequently?
Which errors appear to be recurring patterns?
Are errors isolated or systematic?
What literacy skills appear to be developing appropriately?
Which areas appear to require additional support?
How does the student's writing affect readability and communication?

Do not penalize the student for a feature unless there is sufficient evidence in the writing.

Return ONLY valid JSON using the following format:

{
  "transcription": "string",
  "errors": [
    {
      "type": "Spelling | Grammar | Punctuation | Capitalization | Word Choice | Tense | Subject-Verb Agreement | Sentence Structure | Other",
      "original": "string",
      "correction": "string",
      "explanation": "string",
      "confidence": 0.0
    }
  ],
  "diagnosticSummary": "string"
}
`;
    console.log("getting response");
    const response = await client.responses.create({
        model: "gpt-5.5",
        input: [
            {
                role: "user",
                content: [
                    {
                        type: "input_file",
                        file_id: file.id
                    },
                    {
                        type: "input_text",
                        text: prompt
                    }
                ]
            }
        ]
    });
    console.log("response received");
    return JSON.parse(response.output_text);
}

module.exports = {
    analyzePdf
};