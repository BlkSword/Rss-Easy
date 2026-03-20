package db

import (
	"database/sql"
	"fmt"
)

// CategoryWithFeeds extends Category with feed information.
type CategoryWithFeeds struct {
	Category
	Feeds    []*Feed `json:"feeds"`
	Children []*CategoryWithFeeds `json:"children"`
}

// CreateCategory creates a new category.
func CreateCategory(name, description string, parentID *int64) (*Category, error) {
	result, err := DB.Exec(
		`INSERT INTO categories (name, description, parent_id, sort_order) VALUES (?, ?, ?, 0)`,
		name, description, parentID,
	)
	if err != nil {
		return nil, err
	}

	id, _ := result.LastInsertId()
	return &Category{
		ID:          id,
		Name:        name,
		Description: description,
		ParentID:    parentID,
	}, nil
}

// GetCategory gets a category by ID.
func GetCategory(id int64) (*Category, error) {
	cat := &Category{}
	err := DB.QueryRow(
		`SELECT id, name, COALESCE(description, ''), COALESCE(color, ''), parent_id, sort_order FROM categories WHERE id = ?`,
		id,
	).Scan(&cat.ID, &cat.Name, &cat.Description, &cat.Color, &cat.ParentID, &cat.SortOrder)
	if err != nil {
		return nil, err
	}
	return cat, nil
}

// ListAllCategories lists all categories.
func ListAllCategories() ([]*Category, error) {
	rows, err := DB.Query(
		`SELECT id, name, COALESCE(description, ''), COALESCE(color, ''), parent_id, sort_order
		 FROM categories ORDER BY sort_order, name`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []*Category
	for rows.Next() {
		cat := &Category{}
		err := rows.Scan(&cat.ID, &cat.Name, &cat.Description, &cat.Color, &cat.ParentID, &cat.SortOrder)
		if err != nil {
			return nil, err
		}
		categories = append(categories, cat)
	}

	return categories, nil
}

// BuildCategoryTree builds a tree from flat categories.
func BuildCategoryTree(categories []*Category) []*CategoryWithFeeds {
	catMap := make(map[int64]*CategoryWithFeeds)
	var roots []*CategoryWithFeeds

	for _, cat := range categories {
		cwf := &CategoryWithFeeds{Category: *cat}
		catMap[cat.ID] = cwf
	}

	for _, cat := range categories {
		cwf := catMap[cat.ID]
		if cat.ParentID != nil {
			if parent, ok := catMap[*cat.ParentID]; ok {
				parent.Children = append(parent.Children, cwf)
				continue
			}
		}
		roots = append(roots, cwf)
	}

	return roots
}

// RenameCategory renames a category.
func RenameCategory(id int64, name string) error {
	_, err := DB.Exec(`UPDATE categories SET name = ? WHERE id = ?`, name, id)
	return err
}

// DeleteCategory deletes a category and its feed associations.
func DeleteCategory(id int64) error {
	// Delete feed associations
	_, err := DB.Exec(`DELETE FROM feed_categories WHERE category_id = ?`, id)
	if err != nil {
		return err
	}
	// Move children to root (parent_id = NULL)
	_, err = DB.Exec(`UPDATE categories SET parent_id = NULL WHERE parent_id = ?`, id)
	if err != nil {
		return err
	}
	// Delete category
	_, err = DB.Exec(`DELETE FROM categories WHERE id = ?`, id)
	return err
}

// MoveCategory moves a category to a new parent.
func MoveCategory(id int64, parentID *int64) error {
	if parentID != nil && *parentID == id {
		return fmt.Errorf("cannot move category under itself")
	}
	_, err := DB.Exec(`UPDATE categories SET parent_id = ? WHERE id = ?`, parentID, id)
	return err
}

// AddFeedToCategory adds a feed to a category.
func AddFeedToCategory(feedID, categoryID int64) error {
	_, err := DB.Exec(
		`INSERT OR IGNORE INTO feed_categories (feed_id, category_id) VALUES (?, ?)`,
		feedID, categoryID,
	)
	return err
}

// RemoveFeedFromCategory removes a feed from a category.
func RemoveFeedFromCategory(feedID, categoryID int64) error {
	_, err := DB.Exec(
		`DELETE FROM feed_categories WHERE feed_id = ? AND category_id = ?`,
		feedID, categoryID,
	)
	return err
}

// GetFeedCategories returns category IDs for a feed.
func GetFeedCategories(feedID int64) ([]int64, error) {
	rows, err := DB.Query(`SELECT category_id FROM feed_categories WHERE feed_id = ?`, feedID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// GetCategoryFeeds returns feeds in a category.
func GetCategoryFeeds(categoryID int64) ([]*Feed, error) {
	rows, err := DB.Query(`
		SELECT f.id, f.title, f.description, f.feed_url, f.site_url, f.icon_url,
			   f.last_fetched_at, f.last_success_at, f.fetch_interval, f.error_count,
			   COALESCE(f.last_error, ''), f.is_active, f.total_entries, f.unread_count,
			   COALESCE(f.tags, ''), f.created_at, f.updated_at
		FROM feeds f
		JOIN feed_categories fc ON f.id = fc.feed_id
		WHERE fc.category_id = ?
		ORDER BY f.title
	`, categoryID)
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

// EnsureCategoryTables ensures category-related tables exist.
func EnsureCategoryTables() error {
	// feed_categories table
	_, err := DB.Exec(`
		CREATE TABLE IF NOT EXISTS feed_categories (
			feed_id INTEGER NOT NULL,
			category_id INTEGER NOT NULL,
			PRIMARY KEY (feed_id, category_id),
			FOREIGN KEY (feed_id) REFERENCES feeds(id),
			FOREIGN KEY (category_id) REFERENCES categories(id)
		)
	`)
	if err != nil {
		return err
	}
	_, err = DB.Exec(`CREATE INDEX IF NOT EXISTS idx_feed_categories_feed_id ON feed_categories(feed_id)`)
	if err != nil {
		return err
	}
	_, err = DB.Exec(`CREATE INDEX IF NOT EXISTS idx_feed_categories_category_id ON feed_categories(category_id)`)
	return err
}
