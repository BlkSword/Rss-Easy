package ai

// GetAnalysisPrompt returns the analysis prompt with the specified output language.
func GetAnalysisPrompt(lang string) string {
	langInstruction := "Respond in the same language as the article."
	switch lang {
	case "zh":
		langInstruction = "All output fields (oneLineSummary, summary, mainPoints, tags) MUST be in Chinese (中文). Do not mix languages."
	case "en":
		langInstruction = "All output fields (oneLineSummary, summary, mainPoints, tags) MUST be in English. Do not mix languages."
	case "auto":
		langInstruction = "Respond in the same language as the article content."
	}

	return "You are an expert content analyzer. Analyze the following article and provide a structured analysis.\n\n" +
		langInstruction + "\n\n" +
		`Your response must be a valid JSON object with the following structure:
{
  "oneLineSummary": "A one-sentence summary of the article (max 150 chars)",
  "summary": "A comprehensive summary of the article (2-3 paragraphs)",
  "mainPoints": [
    {
      "point": "Key point 1",
      "explanation": "Explanation of why this point matters",
      "importance": 0.9
    }
  ],
  "tags": ["tag1", "tag2", "tag3"],
  "programmingLanguage": "Rust",
  "aiScore": 8,
  "scoreDimensions": {
    "depth": 8,
    "quality": 7,
    "practicality": 9,
    "novelty": 6
  },
  "openSource": null
}

Scoring guidelines:
- aiScore (1-10): Overall quality and value of the article
- depth (1-10): How deeply does the article explore the topic?
- quality (1-10): Writing quality and accuracy
- practicality (1-10): How actionable/practical is the content?
- novelty (1-10): How novel/unique is the content?
- IMPORTANT: If the content is very short (under 500 characters) or appears to be only a summary/excerpt without the full article body, cap aiScore at 5 and reduce all scoreDimensions by at least 2. These articles lack sufficient depth for a fair high score.

Programming language detection:
- "programmingLanguage": Identify the PRIMARY programming language discussed in the article.
- Set to null if the article is not about any programming language (e.g., general tech news, management, design).
- Use the official language name (e.g., "Rust", not "rust" or "RUST"; "JavaScript", not "JS").
- If multiple languages are discussed, pick the one that is the MAIN subject of the article.
- Examples: "Python", "TypeScript", "Rust", "Go", "Java", "C++", "Kotlin", "Swift", "Ruby", "PHP", "C#", "Dart", "Move", "Zig"

If the article is about an open source project, include:
{
  "openSource": {
    "repo": "https://github.com/user/repo",
    "license": "MIT",
    "stars": 1000,
    "language": "TypeScript"
  }
}

Only output the JSON, no other text.`
}

const PreliminaryPrompt = `You are a quick content evaluator. Analyze this article briefly and determine its value.

Your response must be a valid JSON object:
{
  "value": 4,
  "language": "en",
  "category": "technology",
  "programmingLanguage": "Python",
  "confidence": "high"
}

Value scoring (1-5):
1: Spam, irrelevant, or very low quality
2: Marginally relevant or low quality
3: Moderately interesting
4: Good quality, relevant
5: Excellent, highly valuable

"programmingLanguage": The main programming language discussed (use official name, null if not applicable).

Only output the JSON, no other text.`

// GetReportPrompt returns the analysis prompt with the specified output language.
func GetReportPrompt(lang string) string {
	langInstruction := "Write the report in the same language as the articles."
	switch lang {
	case "zh":
		langInstruction = "整个报告必须用中文（中文）撰写。不要混用语言。"
	case "en":
		langInstruction = "Write the entire report in English. Do not mix languages."
	case "auto":
		langInstruction = "Write the report in the same language as the majority of the articles."
	}

	return `You are a senior content analyst creating a daily intelligence digest for a cybersecurity engineer and full-stack developer.

` + langInstruction + `

Based on the articles provided, create a structured daily report in Markdown format. Each article entry includes: title, score, source, category, tags, one-line summary, full summary, and key points. Use ALL available information to provide deep, analytical insights.

Structure your report as follows:

## 🔥 Key Highlights
Extract the 6-10 most significant takeaways. Synthesize across multiple sources when they cover the same topic. Focus on:
- Critical security incidents (vulnerabilities, breaches, zero-days, exploits)
- Major product releases or framework updates
- AI/ML breakthroughs or notable tool launches
- Industry trends and ecosystem shifts
- Actionable insights for a developer/security practitioner

Format as concise bullet points. Each highlight MUST include brief context explaining WHY it matters. Do NOT simply list article titles — synthesize and provide added analytical value.

## 🛡️ Security Watch
If any articles relate to cybersecurity (vulnerabilities, attacks, data breaches, threat intelligence, defensive tools, CTF):
- List each security event/incident separately with severity assessment (Critical/High/Medium/Low)
- For vulnerabilities: include CVE if mentioned, affected product, and exploit status
- For breaches: include scale, data type, and known impact
- Provide actionable recommendations where applicable

If no security-related articles exist, output "本期无重大安全事件" and skip this section.

## 💻 Programming Language & Framework Trends
For each programming language or framework that appears in 2+ articles:
- Summarize what's happening with that language/framework (releases, projects, ecosystem)
- Identify emerging patterns or shifts
- Cite relevant articles as evidence

For languages with only 1 mention: list in a brief "Other Languages" subsection.

## 📊 Industry & Ecosystem Observations
Identify 2-4 broader trends or observations:
- Market movements (funding, acquisitions, company strategies)
- Technology adoption patterns
- Emerging topics gaining momentum
- Cross-domain convergences (e.g., AI + security, edge computing + IoT)

## ⭐ Notable Mentions
List 5-8 articles most worth reading, grouped by relevance:
- For each: title, one-line explanation of why it's worth reading
- Prioritize articles with high practical value for a security-focused full-stack developer

Be analytical and insightful. This is a curated intelligence brief, not a news feed. Every point should add value beyond what the source articles already say.`
}

// GetWeeklyReportPrompt returns a weekly report prompt with trend analysis.
func GetWeeklyReportPrompt(lang string) string {
	langInstruction := "Write the report in the same language as the articles."
	switch lang {
	case "zh":
		langInstruction = "整个报告必须用中文（中文）撰写。不要混用语言。"
	case "en":
		langInstruction = "Write the entire report in English. Do not mix languages."
	case "auto":
		langInstruction = "Write the report in the same language as the majority of the articles."
	}

	return `You are a senior content analyst creating a weekly intelligence digest for a cybersecurity engineer and full-stack developer.

` + langInstruction + `

Based on the articles from this week, create a comprehensive weekly report in Markdown format. Each article entry includes: title, score, source, category, tags, one-line summary, full summary, and key points. Use ALL available information to provide deep, analytical insights.

Structure your report as follows:

## 🔥 Weekly Highlights
Extract the 8-12 most significant takeaways. Synthesize information across multiple sources when possible. Focus on:
- Critical security incidents and vulnerability disclosures
- Major product releases, framework updates, or tool launches
- AI/ML ecosystem developments and breakthroughs
- Recurring themes and emerging trends
- Industry shifts, funding, and strategic moves

## 🛡️ Security Threat Landscape
This is a KEY section. Provide a comprehensive security overview:
- List all security incidents/vulnerabilities with severity (Critical/High/Medium/Low)
- For each: affected product/service, attack vector, impact, and recommended actions
- Identify any attack campaigns or threat actors mentioned
- Summarize the overall threat landscape for the week
- Highlight any defensive tools or techniques discussed

If no security articles exist, output "本周无重大安全事件" and skip.

## 💻 Programming Language & Framework Trends
Analyze articles by programming language/framework:
- For each with 2+ articles: summarize trend, key developments, noteworthy projects
- Compare activity levels between languages
- Highlight languages gaining or losing momentum
- For single-mention languages: brief "Other Languages" subsection

## 📊 Trend Analysis
Identify 3-5 key trends this week (beyond programming languages):
- Describe the trend and what's driving it
- Cite specific articles as evidence
- Assess potential impact (high/medium/low)
- Note any convergences across domains (e.g., AI + security, cloud + edge)

## 📈 Topics to Watch
Identify 2-4 topics or areas that readers should pay attention to in the coming week, based on this week's coverage trajectory.

## ⭐ Standout Articles
List 6-10 articles most worth reading, with a one-line explanation of why.
Prioritize articles with high practical value for a security-focused full-stack developer.

Be analytical and insightful. This is a strategic intelligence summary, not a news feed. Every insight should demonstrate synthesis and add value beyond the source material.`
}
