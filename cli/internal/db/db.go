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
			archived BOOLEAN DEFAULT 0,
			deleted BOOLEAN DEFAULT 0,
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
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (parent_id) REFERENCES categories(id)
		)`,
		`CREATE TABLE IF NOT EXISTS feed_tags (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			feed_id INTEGER NOT NULL,
			tag TEXT NOT NULL,
			FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE,
			UNIQUE(feed_id, tag)
		)`,
		`CREATE TABLE IF NOT EXISTS feed_categories (
			feed_id INTEGER NOT NULL,
			category_id INTEGER NOT NULL,
			PRIMARY KEY (feed_id, category_id),
			FOREIGN KEY (feed_id) REFERENCES feeds(id),
			FOREIGN KEY (category_id) REFERENCES categories(id)
		)`,
		`CREATE TABLE IF NOT EXISTS rules (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			description TEXT,
			enabled BOOLEAN DEFAULT 1,
			conditions TEXT,
			actions TEXT,
			priority INTEGER DEFAULT 0,
			match_count INTEGER DEFAULT 0,
			last_matched_at DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS rule_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			rule_id INTEGER NOT NULL,
			entry_id INTEGER NOT NULL,
			action TEXT,
			matched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (rule_id) REFERENCES rules(id),
			FOREIGN KEY (entry_id) REFERENCES entries(id)
		)`,
		`CREATE TABLE IF NOT EXISTS search_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			query TEXT NOT NULL,
			result_count INTEGER DEFAULT 0,
			searched_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS reports (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			type TEXT,
			date TEXT,
			content TEXT,
			html_content TEXT,
			entry_count INTEGER DEFAULT 0,
			avg_score REAL DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_entries_feed_id ON entries(feed_id)`,
		`CREATE INDEX IF NOT EXISTS idx_entries_published_at ON entries(published_at)`,
		`CREATE INDEX IF NOT EXISTS idx_entries_is_read ON entries(is_read)`,
		`CREATE INDEX IF NOT EXISTS idx_entries_content_hash ON entries(content_hash)`,
		`CREATE INDEX IF NOT EXISTS idx_feeds_is_active ON feeds(is_active)`,
		`CREATE INDEX IF NOT EXISTS idx_entries_archived ON entries(archived)`,
		`CREATE INDEX IF NOT EXISTS idx_entries_deleted ON entries(deleted)`,
		`CREATE INDEX IF NOT EXISTS idx_rule_logs_rule_id ON rule_logs(rule_id)`,
		`CREATE INDEX IF NOT EXISTS idx_rule_logs_entry_id ON rule_logs(entry_id)`,
		`CREATE INDEX IF NOT EXISTS idx_feed_categories_feed_id ON feed_categories(feed_id)`,
		`CREATE INDEX IF NOT EXISTS idx_feed_categories_category_id ON feed_categories(category_id)`,
		`CREATE INDEX IF NOT EXISTS idx_search_history_searched_at ON search_history(searched_at)`,
	}

	for _, query := range queries {
		if _, err := DB.Exec(query); err != nil {
			return err
		}
	}

	// Add columns that might not exist in older databases (safe ALTER TABLE)
	migrations := []string{
		`ALTER TABLE entries ADD COLUMN archived BOOLEAN DEFAULT 0`,
		`ALTER TABLE entries ADD COLUMN deleted BOOLEAN DEFAULT 0`,
		`ALTER TABLE entries ADD COLUMN ai_retry_count INTEGER DEFAULT 0`,
		`ALTER TABLE entries ADD COLUMN ai_last_error TEXT DEFAULT ''`,
	}
	for _, m := range migrations {
		DB.Exec(m) // Ignore errors (column may already exist)
	}

	return nil
}

func Close() error {
	if DB != nil {
		return DB.Close()
	}
	return nil
}
