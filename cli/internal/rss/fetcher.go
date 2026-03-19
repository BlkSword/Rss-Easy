package rss

import (
	"fmt"
	"sync"
	"time"

	"github.com/rss-post/cli/internal/config"
	"github.com/rss-post/cli/internal/db"
)

type Fetcher struct {
	parser *Parser
	cfg    *config.Config
}

type FetchResult struct {
	FeedID   int64
	FeedURL  string
	Success  bool
	Error    error
	NewCount int
}

func NewFetcher(cfg *config.Config) *Fetcher {
	return &Fetcher{
		parser: NewParser(cfg),
		cfg:    cfg,
	}
}

func (f *Fetcher) FetchFeed(feedID int64) (*FetchResult, error) {
	feed, err := db.GetFeed(feedID)
	if err != nil {
		return nil, err
	}

	return f.FetchFeedByURL(feed.ID, feed.FeedURL)
}

func (f *Fetcher) FetchFeedByURL(feedID int64, feedURL string) (*FetchResult, error) {
	result := &FetchResult{
		FeedID:  feedID,
		FeedURL: feedURL,
	}

	parsed, err := f.parser.Parse(feedURL)
	if err != nil {
		result.Error = err
		result.Success = false
		db.UpdateFeedStats(feedID, false, err.Error())
		return result, nil
	}

	// Update feed info
	feed, _ := db.GetFeed(feedID)
	if feed != nil {
		feed.Title = parsed.Title
		feed.Description = parsed.Description
		if parsed.SiteURL != "" {
			feed.SiteURL = parsed.SiteURL
		}
		now := time.Now()
		feed.LastFetchedAt = &now
		feed.LastSuccessAt = &now
		db.UpdateFeed(feed)
	}

	// Process items
	for _, item := range parsed.Items {
		// Check if entry already exists
		existing, err := db.GetEntryByHash(item.ContentHash)
		if err == nil && existing != nil {
			continue // Skip duplicates
		}

		entry := f.parser.ToDBEntry(item, feedID)

		// Calculate word count and reading time
		entry.WordCount = countWords(entry.Content)
		entry.ReadingTime = (entry.WordCount / 200) + 1 // ~200 words per minute

		_, err = db.CreateEntry(entry)
		if err != nil {
			// Log error but continue
			continue
		}
		result.NewCount++
	}

	db.UpdateFeedStats(feedID, true, "")
	result.Success = true
	return result, nil
}

func (f *Fetcher) FetchAll() []*FetchResult {
	feeds, err := db.ListFeeds(true)
	if err != nil {
		return nil
	}

	results := make([]*FetchResult, len(feeds))
	var wg sync.WaitGroup

	// Semaphore for concurrency control
	sem := make(chan struct{}, f.cfg.Fetch.Concurrency)

	for i, feed := range feeds {
		wg.Add(1)
		go func(idx int, feedID int64, feedURL string) {
			defer wg.Done()
			sem <- struct{}{}        // Acquire
			defer func() { <-sem }() // Release

			result, _ := f.FetchFeedByURL(feedID, feedURL)
			results[idx] = result
		}(i, feed.ID, feed.FeedURL)
	}

	wg.Wait()
	return results
}

func (f *Fetcher) AddFeed(feedURL string) (*db.Feed, error) {
	// Check if feed already exists
	existing, err := db.GetFeedByURL(feedURL)
	if err == nil && existing != nil {
		return nil, fmt.Errorf("feed already exists with ID %d", existing.ID)
	}

	// Parse the feed to get metadata
	parsed, err := f.parser.Parse(feedURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse feed: %w", err)
	}

	// Create feed in database
	feed := f.parser.ToDBFeed(parsed)
	feed, err = db.CreateFeed(feed)
	if err != nil {
		return nil, err
	}

	// Fetch initial items
	go f.FetchFeed(feed.ID)

	return feed, nil
}

func countWords(content string) int {
	// Simple word count - count spaces
	if len(content) == 0 {
		return 0
	}

	count := 1
	for _, c := range content {
		if c == ' ' || c == '\n' || c == '\t' {
			count++
		}
	}
	return count
}
