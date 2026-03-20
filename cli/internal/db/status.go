package db

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// DaemonStatus represents the current daemon state, persisted to disk for `daemon status` queries.
type DaemonStatus struct {
	PID              int       `json:"pid"`
	StartedAt        time.Time `json:"started_at"`
	LastRunAt        time.Time `json:"last_run_at"`
	LastPipelineAt   time.Time `json:"last_pipeline_at"`
	LastFetchAt      time.Time `json:"last_fetch_at"`
	LastAnalysisAt   time.Time `json:"last_analysis_at"`
	LastReportAt     time.Time `json:"last_report_at"`
	FetchTotal       int       `json:"fetch_total"`
	FetchNewEntries  int       `json:"fetch_new_entries"`
	FetchFailures    int       `json:"fetch_failures"`
	AnalyzedTotal    int       `json:"analyzed_total"`
	AnalyzedSuccess  int       `json:"analyzed_success"`
	AnalyzedFailed   int       `json:"analyzed_failed"`
	RulesApplied     int       `json:"rules_applied"`
	ReportsSent      int       `json:"reports_sent"`
	PipelineCount    int       `json:"pipeline_count"`
	CheckInterval    int       `json:"check_interval"`
	Running          bool      `json:"running"`
	CurrentStep      string    `json:"current_step"` // "idle" | "fetching" | "analyzing" | "rules" | "report"
}

var (
	statusMu    sync.Mutex
	statusPath  string
)

// InitStatusPath sets the status file path.
func InitStatusPath() {
	homeDir, _ := os.UserHomeDir()
	statusPath = filepath.Join(homeDir, ".rss-post", "daemon-status.json")
}

func GetStatusPath() string {
	if statusPath == "" {
		InitStatusPath()
	}
	return statusPath
}

// SaveDaemonStatus persists the current daemon status to disk.
func SaveDaemonStatus(status *DaemonStatus) error {
	statusMu.Lock()
	defer statusMu.Unlock()

	if statusPath == "" {
		return nil
	}

	data, err := json.MarshalIndent(status, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(statusPath, data, 0644)
}

// LoadDaemonStatus reads the persisted daemon status.
func LoadDaemonStatus() (*DaemonStatus, error) {
	statusMu.Lock()
	defer statusMu.Unlock()

	if statusPath == "" {
		return nil, os.ErrNotExist
	}

	data, err := os.ReadFile(statusPath)
	if err != nil {
		return nil, err
	}

	var status DaemonStatus
	if err := json.Unmarshal(data, &status); err != nil {
		return nil, err
	}
	return &status, nil
}

// GetAnalysisQueueStats returns queue depth info.
func GetAnalysisQueueStats() (pending int, analyzed int, failed int, abandoned int) {
	DB.QueryRow("SELECT COUNT(*) FROM entries WHERE ai_summary IS NULL OR ai_summary = ''").Scan(&pending)
	DB.QueryRow("SELECT COUNT(*) FROM entries WHERE ai_summary IS NOT NULL AND ai_summary != '' AND ai_summary != 'Skipped: Low value content'").Scan(&analyzed)
	DB.QueryRow("SELECT COUNT(*) FROM entries WHERE ai_retry_count > 0 AND (ai_summary IS NULL OR ai_summary = '')").Scan(&failed)
	DB.QueryRow("SELECT COUNT(*) FROM entries WHERE ai_retry_count >= 3").Scan(&abandoned)
	return
}

// GetFetchQueueStats returns fetch queue info.
func GetFetchQueueStats() (totalFeeds int, dueFeeds int, failedFeeds int) {
	DB.QueryRow("SELECT COUNT(*) FROM feeds WHERE is_active = 1").Scan(&totalFeeds)
	// Count feeds that haven't been fetched recently (due)
	DB.QueryRow(`
		SELECT COUNT(*) FROM feeds 
		WHERE is_active = 1 
		AND (last_fetched_at IS NULL OR datetime(last_fetched_at, '+' || fetch_interval || ' minutes') <= datetime('now'))
	`).Scan(&dueFeeds)
	DB.QueryRow("SELECT COUNT(*) FROM feeds WHERE error_count > 0 AND is_active = 1").Scan(&failedFeeds)
	return
}

// ClearDaemonStatus removes the status file (on graceful shutdown).
func ClearDaemonStatus() {
	statusMu.Lock()
	defer statusMu.Unlock()
	if statusPath != "" {
		os.Remove(statusPath)
	}
}
