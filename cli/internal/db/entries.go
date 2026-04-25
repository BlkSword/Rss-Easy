package db

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
)

func CreateEntry(entry *Entry) (*Entry, error) {
	now := time.Now()
	result, err := DB.Exec(`
		INSERT INTO entries (feed_id, title, url, content, summary, author,
			published_at, created_at, content_hash, is_read, is_starred,
			word_count, reading_time)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, entry.FeedID, entry.Title, entry.URL, entry.Content, entry.Summary,
		entry.Author, entry.PublishedAt, now, entry.ContentHash, entry.IsRead,
		entry.IsStarred, entry.WordCount, entry.ReadingTime)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	entry.ID = id
	entry.CreatedAt = now

	// Update feed stats
	_, err = DB.Exec(`
		UPDATE feeds SET total_entries = total_entries + 1,
		unread_count = unread_count + 1, updated_at = ?
		WHERE id = ?
	`, now, entry.FeedID)
	if err != nil {
		return nil, err
	}

	return entry, nil
}

func GetEntry(id int64) (*Entry, error) {
	entry := &Entry{}
	var publishedAt sql.NullTime
	err := DB.QueryRow(`
		SELECT id, feed_id, title, url, content, summary, author,
			   published_at, created_at, content_hash, is_read, is_starred,
			   COALESCE(ai_summary, ''), COALESCE(ai_keywords, ''), COALESCE(ai_sentiment, ''), COALESCE(ai_category, ''),
			   COALESCE(ai_importance_score, 0), COALESCE(ai_one_line_summary, ''), COALESCE(ai_main_points, ''),
			   COALESCE(ai_key_quotes, ''), COALESCE(ai_score_dimensions, ''), COALESCE(ai_analysis_model, ''),
			   COALESCE(ai_processing_time, 0), word_count, reading_time, COALESCE(ai_score, 0),
			   COALESCE(open_source_info, ''),
			   COALESCE(programming_language, '')
		FROM entries WHERE id = ?
	`, id).Scan(
		&entry.ID, &entry.FeedID, &entry.Title, &entry.URL, &entry.Content,
		&entry.Summary, &entry.Author, &publishedAt, &entry.CreatedAt,
		&entry.ContentHash, &entry.IsRead, &entry.IsStarred, &entry.AISummary,
		&entry.AIKeywords, &entry.AISentiment, &entry.AICategory,
		&entry.AIImportanceScore, &entry.AIOneLineSummary, &entry.AIMainPoints,
		&entry.AIKeyQuotes, &entry.AIScoreDimensions, &entry.AIAnalysisModel,
		&entry.AIProcessingTime, &entry.WordCount, &entry.ReadingTime,
		&entry.AIScore, &entry.OpenSourceInfo, &entry.ProgrammingLanguage,
	)
	if err != nil {
		return nil, err
	}

	if publishedAt.Valid {
		entry.PublishedAt = &publishedAt.Time
	}

	return entry, nil
}

func GetEntryByHash(contentHash string) (*Entry, error) {
	entry := &Entry{}
	var publishedAt sql.NullTime
	err := DB.QueryRow(`
		SELECT id, feed_id, title, url, content, summary, author,
			   published_at, created_at, content_hash, is_read, is_starred,
			   COALESCE(ai_summary, ''), COALESCE(ai_keywords, ''), COALESCE(ai_sentiment, ''), COALESCE(ai_category, ''),
			   COALESCE(ai_importance_score, 0), COALESCE(ai_one_line_summary, ''), COALESCE(ai_main_points, ''),
			   COALESCE(ai_key_quotes, ''), COALESCE(ai_score_dimensions, ''), COALESCE(ai_analysis_model, ''),
			   COALESCE(ai_processing_time, 0), word_count, reading_time, COALESCE(ai_score, 0),
			   COALESCE(open_source_info, ''),
			   COALESCE(programming_language, '')
		FROM entries WHERE content_hash = ?
	`, contentHash).Scan(
		&entry.ID, &entry.FeedID, &entry.Title, &entry.URL, &entry.Content,
		&entry.Summary, &entry.Author, &publishedAt, &entry.CreatedAt,
		&entry.ContentHash, &entry.IsRead, &entry.IsStarred, &entry.AISummary,
		&entry.AIKeywords, &entry.AISentiment, &entry.AICategory,
		&entry.AIImportanceScore, &entry.AIOneLineSummary, &entry.AIMainPoints,
		&entry.AIKeyQuotes, &entry.AIScoreDimensions, &entry.AIAnalysisModel,
		&entry.AIProcessingTime, &entry.WordCount, &entry.ReadingTime,
		&entry.AIScore, &entry.OpenSourceInfo, &entry.ProgrammingLanguage,
	)
	if err != nil {
		return nil, err
	}

	if publishedAt.Valid {
		entry.PublishedAt = &publishedAt.Time
	}

	return entry, nil
}

type EntryFilter struct {
	FeedID      *int64
	Starred     *bool
	Unread      *bool
	AIScoreMin  *int
	Lang        *string
	Limit       int
	Offset      int
	OrderBy     string
	OrderDesc   bool
}

func ListEntries(filter *EntryFilter) ([]*Entry, error) {
	if filter == nil {
		filter = &EntryFilter{}
	}
	if filter.Limit == 0 {
		filter.Limit = 50
	}
	if filter.OrderBy == "" {
		filter.OrderBy = "published_at"
	}

	var conditions []string
	var args []interface{}

	if filter.FeedID != nil {
		conditions = append(conditions, "feed_id = ?")
		args = append(args, *filter.FeedID)
	}
	if filter.Starred != nil {
		conditions = append(conditions, "is_starred = ?")
		args = append(args, *filter.Starred)
	}
	if filter.Unread != nil {
		conditions = append(conditions, "is_read = ?")
		args = append(args, !*filter.Unread)
	}
	if filter.AIScoreMin != nil {
		conditions = append(conditions, "ai_score >= ?")
		args = append(args, *filter.AIScoreMin)
	}
	if filter.Lang != nil && *filter.Lang != "" {
		conditions = append(conditions, "programming_language = ?")
		args = append(args, strings.ToUpper(*filter.Lang))
	}

	query := `
		SELECT id, feed_id, title, url, content, summary, author,
			   published_at, created_at, content_hash, is_read, is_starred,
			   COALESCE(ai_summary, ''), COALESCE(ai_keywords, ''), COALESCE(ai_sentiment, ''), COALESCE(ai_category, ''),
			   COALESCE(ai_importance_score, 0), COALESCE(ai_one_line_summary, ''), COALESCE(ai_main_points, ''),
			   COALESCE(ai_key_quotes, ''), COALESCE(ai_score_dimensions, ''), COALESCE(ai_analysis_model, ''),
			   COALESCE(ai_processing_time, 0), word_count, reading_time, COALESCE(ai_score, 0),
			   COALESCE(open_source_info, ''),
			   COALESCE(programming_language, '')
		FROM entries
	`
	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	orderDir := "ASC"
	if filter.OrderDesc {
		orderDir = "DESC"
	}
	query += fmt.Sprintf(" ORDER BY %s %s", filter.OrderBy, orderDir)
	query += " LIMIT ? OFFSET ?"
	args = append(args, filter.Limit, filter.Offset)

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []*Entry
	for rows.Next() {
		entry := &Entry{}
		var publishedAt sql.NullTime
		err := rows.Scan(
			&entry.ID, &entry.FeedID, &entry.Title, &entry.URL, &entry.Content,
			&entry.Summary, &entry.Author, &publishedAt, &entry.CreatedAt,
			&entry.ContentHash, &entry.IsRead, &entry.IsStarred, &entry.AISummary,
			&entry.AIKeywords, &entry.AISentiment, &entry.AICategory,
			&entry.AIImportanceScore, &entry.AIOneLineSummary, &entry.AIMainPoints,
			&entry.AIKeyQuotes, &entry.AIScoreDimensions, &entry.AIAnalysisModel,
			&entry.AIProcessingTime, &entry.WordCount, &entry.ReadingTime,
			&entry.AIScore, &entry.OpenSourceInfo, &entry.ProgrammingLanguage,
		)
		if err != nil {
			return nil, err
		}

		if publishedAt.Valid {
			entry.PublishedAt = &publishedAt.Time
		}

		entries = append(entries, entry)
	}

	return entries, nil
}

func MarkEntryRead(id int64) error {
	_, err := DB.Exec("UPDATE entries SET is_read = 1 WHERE id = ?", id)
	if err != nil {
		return err
	}

	// Update feed unread count
	_, err = DB.Exec(`
		UPDATE feeds SET unread_count = (
			SELECT COUNT(*) FROM entries WHERE feed_id = feeds.id AND is_read = 0
		) WHERE id = (SELECT feed_id FROM entries WHERE id = ?)
	`, id)
	return err
}

func MarkEntryStarred(id int64, starred bool) error {
	_, err := DB.Exec("UPDATE entries SET is_starred = ? WHERE id = ?", starred, id)
	return err
}

func UpdateEntryAIAnalysis(entry *Entry) error {
	_, err := DB.Exec(`
		UPDATE entries SET
			ai_summary = ?, ai_keywords = ?, ai_sentiment = ?, ai_category = ?,
			ai_importance_score = ?, ai_one_line_summary = ?, ai_main_points = ?,
			ai_key_quotes = ?, ai_score_dimensions = ?, ai_analysis_model = ?,
			ai_processing_time = ?, ai_score = ?, open_source_info = ?,
			programming_language = ?
		WHERE id = ?
	`, entry.AISummary, entry.AIKeywords, entry.AISentiment, entry.AICategory,
		entry.AIImportanceScore, entry.AIOneLineSummary, entry.AIMainPoints,
		entry.AIKeyQuotes, entry.AIScoreDimensions, entry.AIAnalysisModel,
		entry.AIProcessingTime, entry.AIScore, entry.OpenSourceInfo,
		entry.ProgrammingLanguage, entry.ID)
	return err
}

// UpdateEntryAIAnalysisRetry increments the retry counter and records the error message.
func UpdateEntryAIAnalysisRetry(entryID int64, errMsg string) error {
	_, err := DB.Exec(`
		UPDATE entries SET
			ai_retry_count = ai_retry_count + 1,
			ai_last_error = ?
		WHERE id = ?
	`, errMsg, entryID)
	return err
}

// ResetEntryAIRetry clears the retry counter and error for a successfully analyzed entry.
func ResetEntryAIRetry(entryID int64) error {
	_, err := DB.Exec(`
		UPDATE entries SET
			ai_retry_count = 0,
			ai_last_error = ''
		WHERE id = ?
	`, entryID)
	return err
}

// GetRetryAnalysisEntries returns entries that failed analysis and haven't exceeded maxRetries.
func GetRetryAnalysisEntries(limit, maxRetries int) ([]*Entry, error) {
	if limit <= 0 {
		limit = 50
	}
	if maxRetries <= 0 {
		maxRetries = 3
	}

	rows, err := DB.Query(`
		SELECT id, feed_id, title, url, content, summary, author,
			   published_at, created_at, content_hash, is_read, is_starred,
			   COALESCE(ai_summary, ''), COALESCE(ai_keywords, ''), COALESCE(ai_sentiment, ''), COALESCE(ai_category, ''),
			   COALESCE(ai_importance_score, 0), COALESCE(ai_one_line_summary, ''), COALESCE(ai_main_points, ''),
			   COALESCE(ai_key_quotes, ''), COALESCE(ai_score_dimensions, ''), COALESCE(ai_analysis_model, ''),
			   COALESCE(ai_processing_time, 0), word_count, reading_time, COALESCE(ai_score, 0),
			   COALESCE(open_source_info, ''),
			   COALESCE(programming_language, '')
		FROM entries
		WHERE ai_retry_count > 0 AND ai_retry_count < ? AND (ai_summary IS NULL OR ai_summary = '')
		ORDER BY ai_retry_count ASC, published_at DESC
		LIMIT ?
	`, maxRetries, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []*Entry
	for rows.Next() {
		entry := &Entry{}
		var publishedAt sql.NullTime
		err := rows.Scan(
			&entry.ID, &entry.FeedID, &entry.Title, &entry.URL, &entry.Content,
			&entry.Summary, &entry.Author, &publishedAt, &entry.CreatedAt,
			&entry.ContentHash, &entry.IsRead, &entry.IsStarred, &entry.AISummary,
			&entry.AIKeywords, &entry.AISentiment, &entry.AICategory,
			&entry.AIImportanceScore, &entry.AIOneLineSummary, &entry.AIMainPoints,
			&entry.AIKeyQuotes, &entry.AIScoreDimensions, &entry.AIAnalysisModel,
			&entry.AIProcessingTime, &entry.WordCount, &entry.ReadingTime,
			&entry.AIScore, &entry.OpenSourceInfo, &entry.ProgrammingLanguage,
		)
		if err != nil {
			return nil, err
		}

		if publishedAt.Valid {
			entry.PublishedAt = &publishedAt.Time
		}

		entries = append(entries, entry)
	}

	return entries, nil
}

func GetPendingAnalysisEntries(limit int, perFeed int) ([]*Entry, error) {
	if limit == 0 {
		limit = 50
	}
	if perFeed <= 0 {
		perFeed = 2
	}

	rows, err := DB.Query(`
		SELECT id, feed_id, title, url, content, summary, author,
			   published_at, created_at, content_hash, is_read, is_starred,
			   COALESCE(ai_summary, ''), COALESCE(ai_keywords, ''), COALESCE(ai_sentiment, ''), COALESCE(ai_category, ''),
			   COALESCE(ai_importance_score, 0), COALESCE(ai_one_line_summary, ''), COALESCE(ai_main_points, ''),
			   COALESCE(ai_key_quotes, ''), COALESCE(ai_score_dimensions, ''), COALESCE(ai_analysis_model, ''),
			   COALESCE(ai_processing_time, 0), word_count, reading_time, COALESCE(ai_score, 0),
			   COALESCE(open_source_info, ''),
			   COALESCE(programming_language, '')
		FROM entries
		WHERE (ai_summary IS NULL OR ai_summary = '')
		  AND deleted = 0
		  AND COALESCE(ai_retry_count, 0) < 3
		  AND id IN (
		    SELECT id FROM (
		      SELECT id, feed_id,
		        ROW_NUMBER() OVER (PARTITION BY feed_id ORDER BY created_at ASC) as rn
		      FROM entries
		      WHERE (ai_summary IS NULL OR ai_summary = '') AND deleted = 0
		        AND COALESCE(ai_retry_count, 0) < 3
		    ) WHERE rn <= ?
		  )
		ORDER BY created_at ASC
		LIMIT ?
	`, perFeed, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []*Entry
	for rows.Next() {
		entry := &Entry{}
		var publishedAt sql.NullTime
		err := rows.Scan(
			&entry.ID, &entry.FeedID, &entry.Title, &entry.URL, &entry.Content,
			&entry.Summary, &entry.Author, &publishedAt, &entry.CreatedAt,
			&entry.ContentHash, &entry.IsRead, &entry.IsStarred, &entry.AISummary,
			&entry.AIKeywords, &entry.AISentiment, &entry.AICategory,
			&entry.AIImportanceScore, &entry.AIOneLineSummary, &entry.AIMainPoints,
			&entry.AIKeyQuotes, &entry.AIScoreDimensions, &entry.AIAnalysisModel,
			&entry.AIProcessingTime, &entry.WordCount, &entry.ReadingTime,
			&entry.AIScore, &entry.OpenSourceInfo, &entry.ProgrammingLanguage,
		)
		if err != nil {
			return nil, err
		}

		if publishedAt.Valid {
			entry.PublishedAt = &publishedAt.Time
		}

		entries = append(entries, entry)
	}

	return entries, nil
}

func GetEntryCount() (int, error) {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM entries").Scan(&count)
	return count, err
}

func SearchEntries(query string, limit int) ([]*Entry, error) {
	if limit == 0 {
		limit = 50
	}

	searchQuery := "%" + query + "%"
	rows, err := DB.Query(`
		SELECT id, feed_id, title, url, content, summary, author,
			   published_at, created_at, content_hash, is_read, is_starred,
			   COALESCE(ai_summary, ''), COALESCE(ai_keywords, ''), COALESCE(ai_sentiment, ''), COALESCE(ai_category, ''),
			   COALESCE(ai_importance_score, 0), COALESCE(ai_one_line_summary, ''), COALESCE(ai_main_points, ''),
			   COALESCE(ai_key_quotes, ''), COALESCE(ai_score_dimensions, ''), COALESCE(ai_analysis_model, ''),
			   COALESCE(ai_processing_time, 0), word_count, reading_time, COALESCE(ai_score, 0),
			   COALESCE(open_source_info, ''),
			   COALESCE(programming_language, '')
		FROM entries
		WHERE title LIKE ? OR content LIKE ? OR summary LIKE ?
		ORDER BY published_at DESC
		LIMIT ?
	`, searchQuery, searchQuery, searchQuery, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []*Entry
	for rows.Next() {
		entry := &Entry{}
		var publishedAt sql.NullTime
		err := rows.Scan(
			&entry.ID, &entry.FeedID, &entry.Title, &entry.URL, &entry.Content,
			&entry.Summary, &entry.Author, &publishedAt, &entry.CreatedAt,
			&entry.ContentHash, &entry.IsRead, &entry.IsStarred, &entry.AISummary,
			&entry.AIKeywords, &entry.AISentiment, &entry.AICategory,
			&entry.AIImportanceScore, &entry.AIOneLineSummary, &entry.AIMainPoints,
			&entry.AIKeyQuotes, &entry.AIScoreDimensions, &entry.AIAnalysisModel,
			&entry.AIProcessingTime, &entry.WordCount, &entry.ReadingTime,
			&entry.AIScore, &entry.OpenSourceInfo, &entry.ProgrammingLanguage,
		)
		if err != nil {
			return nil, err
		}

		if publishedAt.Valid {
			entry.PublishedAt = &publishedAt.Time
		}

		entries = append(entries, entry)
	}

	return entries, nil
}

func GetEntriesForReport(startDateStr, endDateStr string) ([]*Entry, error) {
	rows, err := DB.Query(`
		SELECT id, feed_id, title, url, content, summary, author,
			   published_at, created_at, content_hash, is_read, is_starred,
			   COALESCE(ai_summary, ''), COALESCE(ai_keywords, ''), COALESCE(ai_sentiment, ''), COALESCE(ai_category, ''),
			   COALESCE(ai_importance_score, 0), COALESCE(ai_one_line_summary, ''), COALESCE(ai_main_points, ''),
			   COALESCE(ai_key_quotes, ''), COALESCE(ai_score_dimensions, ''), COALESCE(ai_analysis_model, ''),
			   COALESCE(ai_processing_time, 0), word_count, reading_time, COALESCE(ai_score, 0),
			   COALESCE(open_source_info, ''),
			   COALESCE(programming_language, '')
		FROM entries
		WHERE substr(published_at, 1, 10) >= ? AND substr(published_at, 1, 10) < ? AND ai_summary IS NOT NULL AND ai_summary != ''
		ORDER BY ai_score DESC, published_at DESC
	`, startDateStr, endDateStr)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []*Entry
	for rows.Next() {
		entry := &Entry{}
		var publishedAt sql.NullTime
		err := rows.Scan(
			&entry.ID, &entry.FeedID, &entry.Title, &entry.URL, &entry.Content,
			&entry.Summary, &entry.Author, &publishedAt, &entry.CreatedAt,
			&entry.ContentHash, &entry.IsRead, &entry.IsStarred, &entry.AISummary,
			&entry.AIKeywords, &entry.AISentiment, &entry.AICategory,
			&entry.AIImportanceScore, &entry.AIOneLineSummary, &entry.AIMainPoints,
			&entry.AIKeyQuotes, &entry.AIScoreDimensions, &entry.AIAnalysisModel,
			&entry.AIProcessingTime, &entry.WordCount, &entry.ReadingTime,
			&entry.AIScore, &entry.OpenSourceInfo, &entry.ProgrammingLanguage,
		)
		if err != nil {
			return nil, err
		}

		if publishedAt.Valid {
			entry.PublishedAt = &publishedAt.Time
		}

		entries = append(entries, entry)
	}

	return entries, nil
}
