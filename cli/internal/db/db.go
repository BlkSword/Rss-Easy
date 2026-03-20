package db

import (
	"database/sql"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

func Init(dbPath string) error {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	var err error
	DB, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return err
	}

	// Enable WAL mode for better concurrent read/write performance
	DB.Exec("PRAGMA journal_mode=WAL")
	// Increase busy timeout to handle concurrent writes
	DB.Exec("PRAGMA busy_timeout=5000")

	if err := createTables(); err != nil {
		return err
	}

	return nil
}

func createTables() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS feeds (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			description TEXT,
			feed_url TEXT NOT NULL UNIQUE,
			site_url TEXT,
			icon_url TEXT,
			last_fetched_at DATETIME,
			last_success_at DATETIME,
			fetch_interval INTEGER DEFAULT 60,
			error_count INTEGER DEFAULT 0,
			last_error TEXT,
			is_active BOOLEAN DEFAULT 1,
			total_entries INTEGER DEFAULT 0,
			unread_count INTEGER DEFAULT 0,
			tags TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS entries (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			feed_id INTEGER NOT NULL,
			title TEXT NOT NULL,
			url TEXT NOT NULL,
			content TEXT,
			summary TEXT,
			author TEXT,
			published_at DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			content_hash TEXT NOT NULL UNIQUE,
			is_read BOOLEAN DEFAULT 0,
			is_starred BOOLEAN DEFAULT 0,
			ai_summary TEXT,
			ai_keywords TEXT,
			ai_sentiment TEXT,
			ai_category TEXT,
			ai_importance_score REAL,
			ai_one_line_summary TEXT,
			ai_main_points TEXT,
			ai_key_quotes TEXT,
			ai_score_dimensions TEXT,
			ai_analysis_model TEXT,
			ai_processing_time INTEGER,
			word_count INTEGER,
			reading_time INTEGER,
			ai_score INTEGER,
			open_source_info TEXT,
			FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS categories (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			description TEXT,
			color TEXT,
			parent_id INTEGER,
			sort_order INTEGER DEFAULT 0,
			FOREIGN KEY (parent_id) REFERENCES categories(id)
		)`,
		`CREATE TABLE IF NOT EXISTS feed_tags (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			feed_id INTEGER NOT NULL,
			tag TEXT NOT NULL,
			FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE,
			UNIQUE(feed_id, tag)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_entries_feed_id ON entries(feed_id)`,
		`CREATE INDEX IF NOT EXISTS idx_entries_published_at ON entries(published_at)`,
		`CREATE INDEX IF NOT EXISTS idx_entries_is_read ON entries(is_read)`,
		`CREATE INDEX IF NOT EXISTS idx_entries_content_hash ON entries(content_hash)`,
		`CREATE INDEX IF NOT EXISTS idx_feeds_is_active ON feeds(is_active)`,
	}

	for _, query := range queries {
		if _, err := DB.Exec(query); err != nil {
			return err
		}
	}

	return nil
}

func Close() error {
	if DB != nil {
		return DB.Close()
	}
	return nil
}
