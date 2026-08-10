const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generates an automated student evaluation using OpenAI.
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

CRITICAL INSTRUCTIONS & FORMATTING:
- Tone must be constructive, empathetic, and encouraging.
- DO NOT use harsh terms like "writer", "critical fail", "severe deficits", or "failing student". Instead, use phrases like "needs further support", "continued focus area", "area for growth", or "assessment not passed".
- Keep explanations brief and to the point (1-2 short sentences per bullet).
- Output MUST be valid HTML using strictly <p>, <ul>, <li>, and <strong> tags.
- Each section heading MUST be wrapped in its own <p style="margin-top: 12px; margin-bottom: 4px;"><strong>...</strong></p> tag so sections have clear spacing between them.
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

Provide a concise evaluation following this exact 4-part HTML structure:
<p style="margin-bottom: 12px;"><strong>Overall Diagnosis:</strong> [1 short sentence summarizing current literacy progress]</p>

<p style="margin-top: 12px; margin-bottom: 4px;"><strong>Component & Assessment Analysis:</strong></p>
<ul style="margin-top: 0; margin-bottom: 12px; padding-left: 20px;">
  <li><strong>Continued focus area:</strong> [1-2 short sentences]</li>
  <li><strong>Notable progress:</strong> [1-2 short sentences]</li>
</ul>

<p style="margin-bottom: 12px;"><strong>Progress & Band Trajectory:</strong> [1 short sentence evaluating overall effort and skill improvements]</p>

<p style="margin-top: 12px; margin-bottom: 4px;"><strong>Actionable Recommendations:</strong></p>
<ul style="margin-top: 0; margin-bottom: 8px; padding-left: 20px;">
  <li>[Strategy 1]</li>
  <li>[Strategy 2]</li>
</ul>
`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.2,
        });

        let resultText = completion.choices[0].message.content;

        resultText = resultText.replace(/^```html\s*/i, '').replace(/```\s*$/i, '');

        return resultText;

    } catch (error) {
        console.error('OpenAI Generation Error:', error);
        return `<p><em>AI analysis is currently unavailable. Please review assessment details below.</em></p>`;
    }
}

module.exports = { generateStudentInsight };