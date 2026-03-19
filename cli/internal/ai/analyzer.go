package ai

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/rss-post/cli/internal/config"
	"github.com/rss-post/cli/internal/db"
)

type Analyzer struct {
	client *Client
	cfg    *config.Config
}

type AnalysisResult struct {
	OneLineSummary  string          `json:"oneLineSummary"`
	Summary         string          `json:"summary"`
	MainPoints      []MainPoint     `json:"mainPoints"`
	Tags            []string        `json:"tags"`
	AIScore         int             `json:"aiScore"`
	ScoreDimensions ScoreDimensions `json:"scoreDimensions"`
	OpenSource      *OpenSourceInfo `json:"openSource"`
}

type MainPoint struct {
	Point       string  `json:"point"`
	Explanation string  `json:"explanation"`
	Importance  float64 `json:"importance"`
}

type ScoreDimensions struct {
	Depth        int `json:"depth"`
	Quality      int `json:"quality"`
	Practicality int `json:"practicality"`
	Novelty      int `json:"novelty"`
}

type OpenSourceInfo struct {
	Repo     string `json:"repo"`
	License  string `json:"license"`
	Stars    int    `json:"stars"`
	Language string `json:"language"`
}

type PreliminaryResult struct {
	Value      int    `json:"value"`
	Language   string `json:"language"`
	Category   string `json:"category"`
	Confidence string `json:"confidence"`
}

func NewAnalyzer(cfg *config.Config) *Analyzer {
	return &Analyzer{
		client: NewClient(cfg),
		cfg:    cfg,
	}
}

func (a *Analyzer) Analyze(entry *db.Entry) (*AnalysisResult, error) {
	content := entry.Content
	if content == "" {
		content = entry.Summary
	}

	// Determine analysis path based on content length
	contentLength := len(content)

	var result *AnalysisResult
	var err error

	if contentLength <= 6000 {
		// Short content: direct analysis
		result, err = a.analyzeDirect(entry.Title, content)
	} else if contentLength <= 12000 {
		// Medium content: segmented analysis
		result, err = a.analyzeSegmented(entry.Title, content)
	} else {
		// Long content: segmented + merge
		result, err = a.analyzeLong(entry.Title, content)
	}

	if err != nil {
		return nil, err
	}

	return result, nil
}

func (a *Analyzer) analyzeDirect(title, content string) (*AnalysisResult, error) {
	userMessage := fmt.Sprintf("Title: %s\n\nContent:\n%s", title, content)

	response, err := a.client.ChatWithSystem(AnalysisPrompt, userMessage, a.cfg.AI.Model)
	if err != nil {
		return nil, err
	}

	return parseAnalysisResult(response)
}

func (a *Analyzer) analyzeSegmented(title, content string) (*AnalysisResult, error) {
	// Split content into chunks
	chunks := splitContent(content, 4000)

	var summaries []string
	for i, chunk := range chunks {
		userMessage := fmt.Sprintf("Title: %s\n\nContent Part %d:\n%s", title, i+1, chunk)
		response, err := a.client.ChatWithSystem(AnalysisPrompt, userMessage, a.cfg.AI.Model)
		if err != nil {
			continue
		}

		result, err := parseAnalysisResult(response)
		if err == nil {
			summaries = append(summaries, result.Summary)
		}
	}

	if len(summaries) == 0 {
		return nil, fmt.Errorf("failed to analyze any segments")
	}

	// Combine summaries and do final analysis
	combinedSummary := strings.Join(summaries, "\n\n")
	return a.analyzeDirect(title, combinedSummary)
}

func (a *Analyzer) analyzeLong(title, content string) (*AnalysisResult, error) {
	// For very long content, take first and last portions
	firstPart := content
	if len(content) > 6000 {
		firstPart = content[:6000]
	}

	// Analyze first part
	result, err := a.analyzeDirect(title, firstPart)
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (a *Analyzer) PreliminaryEvaluate(entry *db.Entry) (*PreliminaryResult, error) {
	if !a.cfg.AI.Preliminary.Enabled {
		return &PreliminaryResult{Value: 5, Confidence: "high"}, nil
	}

	content := entry.Content
	if content == "" {
		content = entry.Summary
	}

	// Limit content for preliminary evaluation
	if len(content) > 1000 {
		content = content[:1000]
	}

	userMessage := fmt.Sprintf("Title: %s\n\nContent:\n%s", entry.Title, content)

	response, err := a.client.ChatWithSystem(PreliminaryPrompt, userMessage, a.cfg.AI.Preliminary.Model)
	if err != nil {
		return nil, err
	}

	var result PreliminaryResult
	if err := json.Unmarshal([]byte(extractJSON(response)), &result); err != nil {
		return nil, err
	}

	return &result, nil
}

func (a *Analyzer) AnalyzeEntry(entry *db.Entry) error {
	startTime := time.Now()

	// Preliminary evaluation
	prelim, err := a.PreliminaryEvaluate(entry)
	if err != nil {
		// Continue with full analysis if preliminary fails
		prelim = &PreliminaryResult{Value: 3}
	}

	// Skip low-value content
	if prelim.Value < 2 {
		entry.AISummary = "Skipped: Low value content"
		return db.UpdateEntryAIAnalysis(entry)
	}

	// Full analysis
	result, err := a.Analyze(entry)
	if err != nil {
		return err
	}

	processingTime := time.Since(startTime).Milliseconds()

	// Update entry with analysis results
	entry.AIOneLineSummary = result.OneLineSummary
	entry.AISummary = result.Summary
	entry.AIScore = result.AIScore

	if len(result.MainPoints) > 0 {
		mainPointsJSON, _ := json.Marshal(result.MainPoints)
		entry.AIMainPoints = string(mainPointsJSON)
	}

	if len(result.Tags) > 0 {
		tagsJSON, _ := json.Marshal(result.Tags)
		entry.AIKeywords = string(tagsJSON)
	}

	dimsJSON, _ := json.Marshal(result.ScoreDimensions)
	entry.AIScoreDimensions = string(dimsJSON)

	if result.OpenSource != nil {
		osJSON, _ := json.Marshal(result.OpenSource)
		entry.OpenSourceInfo = string(osJSON)
	}

	entry.AIAnalysisModel = a.cfg.AI.Model
	entry.AIProcessingTime = processingTime

	return db.UpdateEntryAIAnalysis(entry)
}

func parseAnalysisResult(response string) (*AnalysisResult, error) {
	jsonStr := extractJSON(response)

	var result AnalysisResult
	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		return nil, err
	}

	return &result, nil
}

func extractJSON(response string) string {
	response = strings.TrimSpace(response)

	// Remove markdown code blocks if present
	if strings.HasPrefix(response, "```json") {
		response = strings.TrimPrefix(response, "```json")
	} else if strings.HasPrefix(response, "```") {
		response = strings.TrimPrefix(response, "```")
	}

	if strings.HasSuffix(response, "```") {
		response = strings.TrimSuffix(response, "```")
	}

	return strings.TrimSpace(response)
}

func splitContent(content string, chunkSize int) []string {
	var chunks []string
	words := strings.Fields(content)

	currentChunk := ""
	for _, word := range words {
		if len(currentChunk)+len(word)+1 > chunkSize {
			if currentChunk != "" {
				chunks = append(chunks, currentChunk)
			}
			currentChunk = word
		} else {
			if currentChunk != "" {
				currentChunk += " "
			}
			currentChunk += word
		}
	}

	if currentChunk != "" {
		chunks = append(chunks, currentChunk)
	}

	return chunks
}
