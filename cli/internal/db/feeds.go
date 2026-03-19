package db

import (
	"database/sql"
	"time"
)

func CreateFeed(feed *Feed) (*Feed, error) {
	now := time.Now()
	result, err := DB.Exec(`
		INSERT INTO feeds (title, description, feed_url, site_url, icon_url, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, feed.Title, feed.Description, feed.FeedURL, feed.SiteURL, feed.IconURL, feed.IsActive, now, now)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	feed.ID = id
	feed.CreatedAt = now
	feed.UpdatedAt = now
	return feed, nil
}

func GetFeed(id int64) (*Feed, error) {
	feed := &Feed{}
	var lastFetchedAt, lastSuccessAt sql.NullTime
	err := DB.QueryRow(`
		SELECT id, title, description, feed_url, site_url, icon_url,
			   last_fetched_at, last_success_at, fetch_interval, error_count,
			   COALESCE(last_error, ''), is_active, total_entries, unread_count, COALESCE(tags, ''),
			   created_at, updated_at
		FROM feeds WHERE id = ?
	`, id).Scan(
		&feed.ID, &feed.Title, &feed.Description, &feed.FeedURL, &feed.SiteURL,
		&feed.IconURL, &lastFetchedAt, &lastSuccessAt, &feed.FetchInterval,
		&feed.ErrorCount, &feed.LastError, &feed.IsActive, &feed.TotalEntries,
		&feed.UnreadCount, &feed.Tags, &feed.CreatedAt, &feed.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if lastFetchedAt.Valid {
		feed.LastFetchedAt = &lastFetchedAt.Time
	}
	if lastSuccessAt.Valid {
		feed.LastSuccessAt = &lastSuccessAt.Time
	}

	return feed, nil
}

func GetFeedByURL(feedURL string) (*Feed, error) {
	feed := &Feed{}
	var lastFetchedAt, lastSuccessAt sql.NullTime
	err := DB.QueryRow(`
		SELECT id, title, description, feed_url, site_url, icon_url,
			   last_fetched_at, last_success_at, fetch_interval, error_count,
			   COALESCE(last_error, ''), is_active, total_entries, unread_count, COALESCE(tags, ''),
			   created_at, updated_at
		FROM feeds WHERE feed_url = ?
	`, feedURL).Scan(
		&feed.ID, &feed.Title, &feed.Description, &feed.FeedURL, &feed.SiteURL,
		&feed.IconURL, &lastFetchedAt, &lastSuccessAt, &feed.FetchInterval,
		&feed.ErrorCount, &feed.LastError, &feed.IsActive, &feed.TotalEntries,
		&feed.UnreadCount, &feed.Tags, &feed.CreatedAt, &feed.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if lastFetchedAt.Valid {
		feed.LastFetchedAt = &lastFetchedAt.Time
	}
	if lastSuccessAt.Valid {
		feed.LastSuccessAt = &lastSuccessAt.Time
	}

	return feed, nil
}

func ListFeeds(activeOnly bool) ([]*Feed, error) {
	query := `
		SELECT id, title, description, feed_url, site_url, icon_url,
			   last_fetched_at, last_success_at, fetch_interval, error_count,
			   COALESCE(last_error, ''), is_active, total_entries, unread_count, COALESCE(tags, ''),
			   created_at, updated_at
		FROM feeds
	`
	if activeOnly {
		query += " WHERE is_active = 1"
	}
	query += " ORDER BY title"

	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var feeds []*Feed
	for rows.Next() {
		feed := &Feed{}
		var lastFetchedAt, lastSuccessAt sql.NullTime
		err := rows.Scan(
			&feed.ID, &feed.Title, &feed.Description, &feed.FeedURL, &feed.SiteURL,
			&feed.IconURL, &lastFetchedAt, &lastSuccessAt, &feed.FetchInterval,
			&feed.ErrorCount, &feed.LastError, &feed.IsActive, &feed.TotalEntries,
			&feed.UnreadCount, &feed.Tags, &feed.CreatedAt, &feed.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		if lastFetchedAt.Valid {
			feed.LastFetchedAt = &lastFetchedAt.Time
		}
		if lastSuccessAt.Valid {
			feed.LastSuccessAt = &lastSuccessAt.Time
		}

		feeds = append(feeds, feed)
	}

	return feeds, nil
}

func UpdateFeed(feed *Feed) error {
	now := time.Now()
	_, err := DB.Exec(`
		UPDATE feeds SET
			title = ?, description = ?, site_url = ?, icon_url = ?,
			last_fetched_at = ?, last_success_at = ?, fetch_interval = ?,
			error_count = ?, last_error = ?, is_active = ?,
			total_entries = ?, unread_count = ?, tags = ?, updated_at = ?
		WHERE id = ?
	`, feed.Title, feed.Description, feed.SiteURL, feed.IconURL,
		feed.LastFetchedAt, feed.LastSuccessAt, feed.FetchInterval,
		feed.ErrorCount, feed.LastError, feed.IsActive,
		feed.TotalEntries, feed.UnreadCount, feed.Tags, now, feed.ID)
	if err != nil {
		return err
	}

	feed.UpdatedAt = now
	return nil
}

func DeleteFeed(id int64) error {
	_, err := DB.Exec("DELETE FROM feeds WHERE id = ?", id)
	return err
}

func UpdateFeedStats(feedID int64, success bool, errMsg string) error {
	now := time.Now()
	if success {
		_, err := DB.Exec(`
			UPDATE feeds SET
				last_fetched_at = ?,
				last_success_at = ?,
				error_count = 0,
				last_error = '',
				updated_at = ?
			WHERE id = ?
		`, now, now, now, feedID)
		return err
	}

	_, err := DB.Exec(`
		UPDATE feeds SET
			last_fetched_at = ?,
			error_count = error_count + 1,
			last_error = ?,
			updated_at = ?
		WHERE id = ?
	`, now, errMsg, now, feedID)
	return err
}

func GetFeedCount() (int, error) {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM feeds").Scan(&count)
	return count, err
}
