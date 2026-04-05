package db

// SearchHistory represents a search history entry.
type SearchHistory struct {
	ID          int64  `json:"id"`
	Query       string `json:"query"`
	ResultCount int    `json:"result_count"`
	SearchedAt  string `json:"searched_at"`
}

// SavedReport represents a saved report in the database.
type SavedReport struct {
	ID          int64   `json:"id"`
	Type        string  `json:"type"`
	Date        string  `json:"date"`
	Content     string  `json:"content"`
	HTMLContent string  `json:"html_content"`
	EntryCount  int     `json:"entry_count"`
	AvgScore    float64 `json:"avg_score"`
	CreatedAt   string  `json:"created_at"`
}

// DailyStat represents a daily entry count.
type DailyStat struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

// FeedStat represents per-feed statistics.
type FeedStat struct {
	FeedID       int64   `json:"feed_id"`
	FeedTitle    string  `json:"feed_title"`
	TotalEntries int     `json:"total_entries"`
	AvgScore     float64 `json:"avg_score"`
	UnreadCount  int     `json:"unread_count"`
}

// SaveSearchHistory saves a search to history.
func SaveSearchHistory(query string, resultCount int) error {
	_, err := DB.Exec(
		`INSERT INTO search_history (query, result_count) VALUES (?, ?)`,
		query, resultCount,
	)
	return err
}

// GetSearchHistory returns recent search history.
func GetSearchHistory(limit int) ([]*SearchHistory, error) {
	if limit == 0 {
		limit = 20
	}

	rows, err := DB.Query(
		`SELECT id, query, result_count, searched_at FROM search_history ORDER BY searched_at DESC LIMIT ?`,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []*SearchHistory
	for rows.Next() {
		h := &SearchHistory{}
		err := rows.Scan(&h.ID, &h.Query, &h.ResultCount, &h.SearchedAt)
		if err != nil {
			return nil, err
		}
		history = append(history, h)
	}
	return history, nil
}

// ClearSearchHistory clears all search history.
func ClearSearchHistory() error {
	_, err := DB.Exec(`DELETE FROM search_history`)
	return err
}

// GetSearchSuggestions returns suggestions based on existing titles and tags.
func GetSearchSuggestions(prefix string, limit int) ([]string, error) {
	if limit == 0 {
		limit = 10
	}
	if prefix == "" {
		return nil, nil
	}

	queryPattern := prefix + "%"

	rows, err := DB.Query(
		`SELECT DISTINCT title FROM entries WHERE title LIKE ? ORDER BY published_at DESC LIMIT ?`,
		queryPattern, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	suggestionMap := make(map[string]bool)
	var suggestions []string

	for rows.Next() {
		var title string
		if err := rows.Scan(&title); err != nil {
			continue
		}
		if !suggestionMap[title] {
			suggestionMap[title] = true
			suggestions = append(suggestions, title)
		}
	}

	if len(suggestions) > limit {
		suggestions = suggestions[:limit]
	}

	return suggestions, nil
}

// EnsureSearchTables creates search-related tables.
func EnsureSearchTables() error {
	_, err := DB.Exec(`
		CREATE TABLE IF NOT EXISTS search_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			query TEXT NOT NULL,
			result_count INTEGER DEFAULT 0,
			searched_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return err
	}
	_, err = DB.Exec(`CREATE INDEX IF NOT EXISTS idx_search_history_searched_at ON search_history(searched_at)`)
	return err
}

// EnsureReportTables creates report-related tables.
func EnsureReportTables() error {
	_, err := DB.Exec(`
		CREATE TABLE IF NOT EXISTS reports (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			type TEXT,
			date TEXT,
			content TEXT,
			html_content TEXT,
			entry_count INTEGER DEFAULT 0,
			avg_score REAL DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`)
	return err
}

// SaveReportToDB saves a generated report to the database.
func SaveReportToDB(reportType, date, content, htmlContent string, entryCount int, avgScore float64) (int64, error) {
	result, err := DB.Exec(
		`INSERT INTO reports (type, date, content, html_content, entry_count, avg_score)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		reportType, date, content, htmlContent, entryCount, avgScore,
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

// GetSavedReport gets a saved report by ID.
func GetSavedReport(id int64) (*SavedReport, error) {
	report := &SavedReport{}
	err := DB.QueryRow(
		`SELECT id, type, date, content, html_content, entry_count, avg_score, created_at FROM reports WHERE id = ?`,
		id,
	).Scan(&report.ID, &report.Type, &report.Date, &report.Content, &report.HTMLContent, &report.EntryCount, &report.AvgScore, &report.CreatedAt)
	if err != nil {
		return nil, err
	}
	return report, nil
}

// ListSavedReports lists saved reports.
func ListSavedReports(limit int) ([]*SavedReport, error) {
	if limit == 0 {
		limit = 20
	}

	rows, err := DB.Query(
		`SELECT id, type, date, entry_count, avg_score, created_at FROM reports ORDER BY created_at DESC LIMIT ?`,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reports []*SavedReport
	for rows.Next() {
		r := &SavedReport{}
		err := rows.Scan(&r.ID, &r.Type, &r.Date, &r.EntryCount, &r.AvgScore, &r.CreatedAt)
		if err != nil {
			return nil, err
		}
		reports = append(reports, r)
	}
	return reports, nil
}

// DeleteSavedReport deletes a saved report.
func DeleteSavedReport(id int64) error {
	_, err := DB.Exec(`DELETE FROM reports WHERE id = ?`, id)
	return err
}

// GetDailyStats returns daily entry counts for the last N days.
func GetDailyStats(days int) ([]*DailyStat, error) {
	rows, err := DB.Query(`
		SELECT substr(COALESCE(published_at, created_at), 1, 10) as date, COUNT(*) as count
		FROM entries
		WHERE substr(COALESCE(published_at, created_at), 1, 10) >= substr(DATE('now', '-' || ? || ' days'), 1, 10)
		GROUP BY substr(COALESCE(published_at, created_at), 1, 10)
		ORDER BY date DESC
	`, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []*DailyStat
	for rows.Next() {
		s := &DailyStat{}
		if err := rows.Scan(&s.Date, &s.Count); err != nil {
			continue
		}
		stats = append(stats, s)
	}
	return stats, nil
}

// GetFeedStats returns per-feed statistics.
func GetFeedStats() ([]*FeedStat, error) {
	rows, err := DB.Query(`
		SELECT f.id, f.title, f.total_entries,
		       COALESCE(AVG(e.ai_score), 0) as avg_score,
		       f.unread_count
		FROM feeds f
		LEFT JOIN entries e ON e.feed_id = f.id
		WHERE f.is_active = 1
		GROUP BY f.id
		ORDER BY f.total_entries DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []*FeedStat
	for rows.Next() {
		s := &FeedStat{}
		if err := rows.Scan(&s.FeedID, &s.FeedTitle, &s.TotalEntries, &s.AvgScore, &s.UnreadCount); err != nil {
			continue
		}
		stats = append(stats, s)
	}
	return stats, nil
}

// GetTopEntries returns top-scoring entries (score > 0).
func GetTopEntries(limit int) ([]*Entry, error) {
	if limit == 0 {
		limit = 10
	}

	minScore := 1
	filter := &EntryFilter{
		Limit:      limit,
		OrderBy:    "ai_score",
		OrderDesc:  true,
		AIScoreMin: &minScore,
	}
	return ListEntries(filter)
}

// LanguageStat represents statistics for a programming language.
type LanguageStat struct {
	Language      string  `json:"language"`
	EntryCount    int     `json:"entry_count"`
	AvgScore      float64 `json:"avg_score"`
	MaxScore      int     `json:"max_score"`
	TopScoreEntry string  `json:"top_score_entry"`
}

// GetLanguageStats returns statistics grouped by programming language.
func GetLanguageStats(days int) ([]*LanguageStat, error) {
	query := `
		SELECT programming_language, COUNT(*) as cnt,
		       COALESCE(AVG(ai_score), 0) as avg_score,
		       COALESCE(MAX(ai_score), 0) as max_score,
		       (SELECT title FROM entries e2 WHERE e2.programming_language = entries.programming_language AND e2.ai_score > 0 ORDER BY e2.ai_score DESC LIMIT 1) as top_title
		FROM entries
		WHERE programming_language IS NOT NULL AND programming_language != ''
	`
	var args []interface{}
	if days > 0 {
		query += ` AND substr(COALESCE(published_at, created_at), 1, 10) >= substr(DATE('now', '-' || ? || ' days'), 1, 10)`
		args = append(args, days)
	}
	query += ` GROUP BY programming_language ORDER BY cnt DESC`

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []*LanguageStat
	for rows.Next() {
		s := &LanguageStat{}
		if err := rows.Scan(&s.Language, &s.EntryCount, &s.AvgScore, &s.MaxScore, &s.TopScoreEntry); err != nil {
			continue
		}
		stats = append(stats, s)
	}
	return stats, nil
}

// GetLanguageTrend returns daily counts for a specific programming language.
func GetLanguageTrend(language string, days int) ([]*DailyStat, error) {
	rows, err := DB.Query(`
		SELECT substr(COALESCE(published_at, created_at), 1, 10) as date, COUNT(*) as count
		FROM entries
		WHERE programming_language = ?
		  AND substr(COALESCE(published_at, created_at), 1, 10) >= substr(DATE('now', '-' || ? || ' days'), 1, 10)
		GROUP BY substr(COALESCE(published_at, created_at), 1, 10)
		ORDER BY date DESC
	`, language, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []*DailyStat
	for rows.Next() {
		s := &DailyStat{}
		if err := rows.Scan(&s.Date, &s.Count); err != nil {
			continue
		}
		stats = append(stats, s)
	}
	return stats, nil
}

// GetEntriesForReportByLanguage returns entries grouped by programming language for a report.
func GetEntriesForReportByLanguage(startDateStr, endDateStr string) (map[string][]*Entry, error) {
	entries, err := GetEntriesForReport(startDateStr, endDateStr)
	if err != nil {
		return nil, err
	}

	result := make(map[string][]*Entry)
	for _, entry := range entries {
		lang := entry.ProgrammingLanguage
		if lang == "" {
			lang = "Other"
		}
		result[lang] = append(result[lang], entry)
	}
	return result, nil
}
