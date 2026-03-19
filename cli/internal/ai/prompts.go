package ai

const AnalysisPrompt = `You are an expert content analyzer. Analyze the following article and provide a structured analysis.

Your response must be a valid JSON object with the following structure:
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

const ReportPrompt = `You are a content curator creating a digest of interesting articles.

Based on the articles provided, create an engaging summary report.

Format your response as Markdown with:
1. A catchy title
2. An executive summary (2-3 sentences)
3. Key highlights organized by theme
4. Notable quotes if any
5. Recommended reads

Be concise but informative. Focus on the most interesting and valuable content.`
