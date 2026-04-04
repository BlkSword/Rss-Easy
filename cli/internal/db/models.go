package db

import (
	"database/sql"
	"encoding/json"
	"time"
)

type Feed struct {
	ID             int64     `json:"id"`
	Title          string    `json:"title"`
	Description    string    `json:"description"`
	FeedURL        string    `json:"feed_url"`
	SiteURL        string    `json:"site_url"`
	IconURL        string    `json:"icon_url"`
	LastFetchedAt  *time.Time `json:"last_fetched_at"`
	LastSuccessAt  *time.Time `json:"last_success_at"`
	FetchInterval  int       `json:"fetch_interval"` // minutes
	ErrorCount     int       `json:"error_count"`
	LastError      string    `json:"last_error"`
	IsActive       bool      `json:"is_active"`
	TotalEntries   int       `json:"total_entries"`
	UnreadCount    int       `json:"unread_count"`
	Tags           string    `json:"tags"` // JSON array
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
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

type Entry struct {
	ID                 int64          `json:"id"`
	FeedID             int64          `json:"feed_id"`
	Title              string         `json:"title"`
	URL                string         `json:"url"`
	Content            string         `json:"content"`
	Summary            string         `json:"summary"`
	Author             string         `json:"author"`
	PublishedAt        *time.Time     `json:"published_at"`
	CreatedAt          time.Time      `json:"created_at"`
	ContentHash        string         `json:"content_hash"`
	IsRead             bool           `json:"is_read"`
	IsStarred          bool           `json:"is_starred"`
	AISummary          string         `json:"ai_summary"`
	AIKeywords         string         `json:"ai_keywords"` // JSON array
	AISentiment        string         `json:"ai_sentiment"`
	AICategory         string         `json:"ai_category"`
	AIImportanceScore  float64        `json:"ai_importance_score"`
	AIOneLineSummary   string         `json:"ai_one_line_summary"`
	AIMainPoints       string         `json:"ai_main_points"`       // JSON array
	AIKeyQuotes        string         `json:"ai_key_quotes"`        // JSON array
	AIScoreDimensions  string         `json:"ai_score_dimensions"`  // JSON object
	AIAnalysisModel    string         `json:"ai_analysis_model"`
	AIProcessingTime   int64          `json:"ai_processing_time"` // milliseconds
	WordCount          int            `json:"word_count"`
	ReadingTime        int            `json:"reading_time"` // minutes
	AIScore            int            `json:"ai_score"`
	OpenSourceInfo     string         `json:"open_source_info"` // JSON object
	FeedName           string         `json:"-"` // runtime only, populated from feeds table
}

func (e *Entry) GetMainPoints() ([]MainPoint, error) {
	if e.AIMainPoints == "" {
		return nil, nil
	}
	var points []MainPoint
	err := json.Unmarshal([]byte(e.AIMainPoints), &points)
	return points, err
}

func (e *Entry) GetScoreDimensions() (*ScoreDimensions, error) {
	if e.AIScoreDimensions == "" {
		return nil, nil
	}
	var dims ScoreDimensions
	err := json.Unmarshal([]byte(e.AIScoreDimensions), &dims)
	return &dims, err
}

func (e *Entry) GetOpenSourceInfo() (*OpenSourceInfo, error) {
	if e.OpenSourceInfo == "" {
		return nil, nil
	}
	var info OpenSourceInfo
	err := json.Unmarshal([]byte(e.OpenSourceInfo), &info)
	return &info, err
}

func (e *Entry) GetKeywords() ([]string, error) {
	if e.AIKeywords == "" {
		return nil, nil
	}
	var keywords []string
	err := json.Unmarshal([]byte(e.AIKeywords), &keywords)
	return keywords, err
}

type Category struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Color       string    `json:"color"`
	ParentID    *int64    `json:"parent_id"`
	SortOrder   int       `json:"sort_order"`
}

var DB *sql.DB
