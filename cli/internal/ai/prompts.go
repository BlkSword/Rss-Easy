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
  "confidence": "high"
}

Value scoring (1-5):
1: Spam, irrelevant, or very low quality
2: Marginally relevant or low quality
3: Moderately interesting
4: Good quality, relevant
5: Excellent, highly valuable

Only output the JSON, no other text.`

// GetReportPrompt returns the report prompt with the specified output language.

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

	return `You are a content curator creating a digest of interesting articles.

` + langInstruction + `

Based on the articles provided, create a structured summary report in Markdown format.

Structure your report as follows:

## Key Highlights
Extract the 5-8 most important takeaways from today's articles. Focus on:
- Major news or breakthroughs
- Actionable insights or recommendations
- Notable trends or patterns across multiple articles
- Security incidents or vulnerabilities (if applicable)

Format each highlight as a concise bullet point with brief context. Do NOT simply list article titles — synthesize and summarize the key information.

## Notable Mentions
List 3-5 individual articles that stand out the most, with a one-line reason why each is worth reading.

Be concise but informative. Prioritize substance over completeness. Focus on what the reader actually needs to know.`
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

	return `You are a senior content analyst creating a weekly intelligence digest.

` + langInstruction + `

Based on the articles from this week, create a comprehensive weekly report in Markdown format.

Structure your report as follows:

## Weekly Highlights
Extract the 8-12 most significant takeaways from this week's articles. Synthesize information across multiple sources when possible. Focus on:
- Major developments and breaking news
- Recurring themes and emerging trends
- Security incidents, vulnerabilities, or threats
- Notable product launches or updates
- Industry shifts and analysis

## Trend Analysis
Identify 3-5 key trends observed this week. For each trend:
- Describe the trend and what's driving it
- Cite specific articles as evidence
- Assess potential impact (high/medium/low)

## Standout Articles
List 5-8 articles that are most worth reading, with a one-line explanation of why.

## Topics to Watch
Identify 2-3 topics or areas that readers should pay attention to in the coming week, based on this week's coverage.

Be analytical and insightful. This is a strategic summary, not a news feed.`
}
