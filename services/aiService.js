const OpenAI = require('openai');

// Initialize OpenAI client pointed at DeepSeek's endpoint
const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY || 'key-for-testing',
});

/**
 * Generates an automated student evaluation using DeepSeek.
 * @param {Object} student - Basic student info
 * @param {Object} groupedBySemester - Filtered semester assessments data
 * @returns {Promise<string>} HTML formatted AI insight or fallback message
 */
async function generateStudentInsight(student, groupedBySemester) {
    try {
        const summaryData = Object.entries(groupedBySemester || {}).map(([semKey, components]) => {
            const items = [];
            Object.entries(components).forEach(([compName, tests]) => {
                tests.forEach(t => {
                    const score = Number(t.score);
                    const passingMark = Number(t.passingMark);
                    items.push({
                        component: compName,
                        assessment: t.assessmentType,
                        score: score,
                        passingMark: passingMark,
                        passed: score >= passingMark,
                        band: t.assessmentBand || t.band
                    });
                });
            });
            return { semester: semKey, assessments: items };
        });

        const systemPrompt = `You are a supportive specialist educator writing brief progress notes for students with dyslexia and literacy learning differences.

CRITICAL INSTRUCTIONS & TONE:
- Tone must be constructive, empathetic, and encouraging.
- DO NOT use harsh terms like "writer", "critical fail", "severe deficits", or "failing student". Instead, use phrases like "needs further support", "continued focus area", "area for growth", or "assessment not passed".
- Keep explanations brief and to the point (1-2 short sentences per bullet).
- Output MUST be valid HTML using strictly <div>, <ul>, <li>, and <strong> tags.
- Do NOT wrap output in markdown code blocks (\`\`\`html).
- Keep total response length compact for a 1-page PDF.`;

        const userPrompt = `
DATA GUIDE:
- Semesters are formatted as YYYYSS (e.g., '202402' = 2024 Semester 2, '202501' = 2025 Semester 1). Always write them as "2024 Sem 2" in text.
- Scores show 'score' vs 'passingMark'. If 'passed' is true, the student met or exceeded the passing threshold.

Student Information:
Student ID: ${student.studentId}
Current Band: ${student.currentBand || 'N/A'}

Semester Performance Data:
${JSON.stringify(summaryData, null, 2)}

Provide a concise evaluation following this exact 4-part structure:
1. <strong>Overall Diagnosis:</strong> 1 short sentence summarizing current literacy progress and main trajectory across semesters.
2. <strong>Component & Assessment Analysis:</strong> 2 bullet points detailing (a) key areas requiring continued support/focus, and (b) areas where the student showed notable progress or passed.
3. <strong>Progress & Band Trajectory:</strong> 1 short sentence evaluating overall effort and subtle skill improvements across semesters, even if the band remains unchanged.
4. <strong>Actionable Recommendations:</strong> 2 brief, supportive strategy bullet points for educators to target next.
`;

        const completion = await openai.chat.completions.create({
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.2,
        });

        let resultText = completion.choices[0].message.content;

        // Clean any residual codeblock markers
        resultText = resultText.replace(/^```html\s*/i, '').replace(/```\s*$/i, '');

        return resultText;

    } catch (error) {
        console.error('DeepSeek AI Generation Error:', error);
        return `<p><em>Automated AI analysis is currently unavailable. Please review assessment details below.</em></p>`;
    }
}

module.exports = { generateStudentInsight };