package ai

import (
	"context"
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

	contentLength := len(content)

	var result *AnalysisResult
	var err error

	if contentLength <= 6000 {
		result, err = a.analyzeDirect(entry.Title, content)
	} else if contentLength <= 12000 {
		result, err = a.analyzeSegmented(entry.Title, content)
	} else {
		result, err = a.analyzeLong(entry.Title, content)
	}

	if err != nil {
		return nil, err
	}

	return result, nil
}

func (a *Analyzer) analyzeDirect(title, content string) (*AnalysisResult, error) {
	userMessage := fmt.Sprintf("Title: %s\n\nContent:\n%s", title, content)
	response, err := a.client.ChatWithSystem(GetAnalysisPrompt(a.cfg.AI.Language), userMessage, a.cfg.AI.Model)
	if err != nil {
		return nil, err
	}
	return parseAnalysisResult(response)
}

func (a *Analyzer) analyzeSegmented(title, content string) (*AnalysisResult, error) {
	chunks := splitContent(content, 4000)

	var summaries []string
	for i, chunk := range chunks {
		userMessage := fmt.Sprintf("Title: %s\n\nContent Part %d:\n%s", title, i+1, chunk)
		response, err := a.client.ChatWithSystem(GetAnalysisPrompt(a.cfg.AI.Language), userMessage, a.cfg.AI.Model)
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

	combinedSummary := strings.Join(summaries, "\n\n")
	return a.analyzeDirect(title, combinedSummary)
}

func (a *Analyzer) analyzeLong(title, content string) (*AnalysisResult, error) {
	firstPart := content
	if len(content) > 6000 {
		firstPart = content[:6000]
	}
	return a.analyzeDirect(title, firstPart)
}

func (a *Analyzer) PreliminaryEvaluate(entry *db.Entry) (*PreliminaryResult, error) {
	if !a.cfg.AI.Preliminary.Enabled {
		return &PreliminaryResult{Value: 5, Confidence: "high"}, nil
	}

	content := entry.Content
	if content == "" {
		content = entry.Summary
	}
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

// AnalyzeEntry runs preliminary + full analysis and persists results.
func (a *Analyzer) AnalyzeEntry(entry *db.Entry) error {
	return a.AnalyzeEntryWithContext(context.Background(), entry)
}

// AnalyzeEntryWithContext is like AnalyzeEntry but respects context cancellation/timeout.
// On failure, it records the retry count; on success, it resets the counter.
func (a *Analyzer) AnalyzeEntryWithContext(ctx context.Context, entry *db.Entry) error {
	startTime := time.Now()

	if ctx.Err() != nil {
		return ctx.Err()
	}

	// Check if entry has exceeded max retries
	var retryCount int
	_ = db.DB.QueryRow("SELECT COALESCE(ai_retry_count, 0) FROM entries WHERE id = ?", entry.ID).Scan(&retryCount)
	maxRetries := 3
	if a.cfg.AI.MaxRetries > 0 {
		maxRetries = a.cfg.AI.MaxRetries
	}
	if retryCount >= maxRetries {
		return fmt.Errorf("skipped: exceeded max retries (%d/%d)", retryCount, maxRetries)
	}

	// Preliminary evaluation
	prelim, err := a.PreliminaryEvaluate(entry)
	if err != nil {
		prelim = &PreliminaryResult{Value: 3} // default to medium on error
	}

	if prelim.Value < 2 {
		entry.AISummary = "Skipped: Low value content"
		return db.UpdateEntryAIAnalysis(entry)
	}

	// Deep analysis
	result, err := a.Analyze(entry)
	if err != nil {
		if ctx.Err() != nil {
			_ = db.UpdateEntryAIAnalysisRetry(entry.ID, fmt.Sprintf("timeout: %v", ctx.Err()))
			return fmt.Errorf("timeout: %w", ctx.Err())
		}
		// Record failure
		_ = db.UpdateEntryAIAnalysisRetry(entry.ID, err.Error())
		return err
	}

	// Success — reset retry counter
	_ = db.ResetEntryAIRetry(entry.ID)

	a.saveAnalysis(entry, result, time.Since(startTime).Milliseconds())
	return nil
}

// saveAnalysis writes analysis results to entry and persists to DB.
func (a *Analyzer) saveAnalysis(entry *db.Entry, result *AnalysisResult, processingTime int64) {
	entry.AIOneLineSummary = result.OneLineSummary
	entry.AISummary = result.Summary
	entry.AIScore = result.AIScore

	if len(result.MainPoints) > 0 {
		b, _ := json.Marshal(result.MainPoints)
		entry.AIMainPoints = string(b)
	}
	if len(result.Tags) > 0 {
		b, _ := json.Marshal(result.Tags)
		entry.AIKeywords = string(b)
	}

	dimsJSON, _ := json.Marshal(result.ScoreDimensions)
	entry.AIScoreDimensions = string(dimsJSON)

	if result.OpenSource != nil {
		osJSON, _ := json.Marshal(result.OpenSource)
		entry.OpenSourceInfo = string(osJSON)
	}

	entry.AIAnalysisModel = a.cfg.AI.Model
	entry.AIProcessingTime = processingTime
	_ = db.UpdateEntryAIAnalysis(entry)
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
