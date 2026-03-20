package rss

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/rss-post/cli/internal/config"
	"github.com/rss-post/cli/internal/db"
)

// Fetcher handles concurrent feed fetching with semaphore control.
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
		db.UpdateFeedStats(feedID, false, err.Error())
		return result, nil
	}

	// Update feed metadata
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

	// Process and create entries (with dedup)
	newCount := f.processEntries(parsed.Items, feedID)
	result.NewCount = newCount

	db.UpdateFeedStats(feedID, true, "")
	result.Success = true
	return result, nil
}

// processEntries creates new entries, skipping duplicates. Returns count of new entries.
func (f *Fetcher) processEntries(items []*ParsedItem, feedID int64) int {
	newCount := 0
	for _, item := range items {
		if item.ContentHash == "" {
			continue
		}

		existing, err := db.GetEntryByHash(item.ContentHash)
		if err == nil && existing != nil {
			continue // Duplicate
		}

		entry := f.parser.ToDBEntry(item, feedID)
		entry.WordCount = countWords(entry.Content)
		entry.ReadingTime = (entry.WordCount / 200) + 1

		if _, err = db.CreateEntry(entry); err == nil {
			newCount++
		}
	}
	return newCount
}

// FetchAll fetches all active feeds concurrently.
func (f *Fetcher) FetchAll() []*FetchResult {
	feeds, err := db.ListFeeds(true)
	if err != nil {
		return nil
	}

	results := make([]*FetchResult, len(feeds))
	var wg sync.WaitGroup
	sem := make(chan struct{}, f.cfg.Fetch.Concurrency)

	for i, feed := range feeds {
		wg.Add(1)
		go func(idx int, feedID int64, feedURL string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			result, _ := f.FetchFeedByURL(feedID, feedURL)
			results[idx] = result
		}(i, feed.ID, feed.FeedURL)
	}

	wg.Wait()
	return results
}

// FetchAllWithProgress fetches all active feeds with progress callback.
func (f *Fetcher) FetchAllWithProgress(onProgress func(completed, total int, result *FetchResult)) []*FetchResult {
	feeds, err := db.ListFeeds(true)
	if err != nil {
		return nil
	}

	total := len(feeds)
	results := make([]*FetchResult, total)
	var wg sync.WaitGroup
	sem := make(chan struct{}, f.cfg.Fetch.Concurrency)
	var mu sync.Mutex
	completed := 0

	for i, feed := range feeds {
		wg.Add(1)
		go func(idx int, feedID int64, feedURL string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			result, _ := f.FetchFeedByURL(feedID, feedURL)
			results[idx] = result

			mu.Lock()
			completed++
			mu.Unlock()

			if onProgress != nil {
				onProgress(completed, total, result)
			}
		}(i, feed.ID, feed.FeedURL)
	}

	wg.Wait()
	return results
}

// FetchWithTimeout fetches a single feed with a timeout.
func (f *Fetcher) FetchWithTimeout(feedID int64, timeout time.Duration) (*FetchResult, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	feed, err := db.GetFeed(feedID)
	if err != nil {
		return nil, err
	}

	type fetchResult struct {
		result *FetchResult
		err    error
	}

	ch := make(chan fetchResult, 1)
	go func() {
		r, e := f.FetchFeedByURL(feed.ID, feed.FeedURL)
		ch <- fetchResult{result: r, err: e}
	}()

	select {
	case fr := <-ch:
		return fr.result, fr.err
	case <-ctx.Done():
		return &FetchResult{
			FeedID:  feedID,
			FeedURL: feed.FeedURL,
			Success: false,
			Error:   fmt.Errorf("timeout after %v", timeout),
		}, nil
	}
}

// AddFeed adds a new feed by fetching its metadata and creating a DB record.
// The initial content fetch happens in a background goroutine.
func (f *Fetcher) AddFeed(feedURL string) (*db.Feed, error) {
	existing, err := db.GetFeedByURL(feedURL)
	if err == nil && existing != nil {
		return nil, fmt.Errorf("feed already exists with ID %d", existing.ID)
	}

	parsed, err := f.parser.Parse(feedURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse feed: %w", err)
	}

	feed := f.parser.ToDBFeed(parsed)
	feed, err = db.CreateFeed(feed)
	if err != nil {
		return nil, err
	}

	go f.FetchFeed(feed.ID)
	return feed, nil
}

// AddFeedQuiet adds a feed by fetching only metadata (lightweight, for OPML import).
// Returns the feed without triggering a full content fetch.
func (f *Fetcher) AddFeedQuiet(feedURL string) (*db.Feed, error) {
	existing, err := db.GetFeedByURL(feedURL)
	if err == nil && existing != nil {
		return existing, nil // Already exists, return it
	}

	parsed, err := f.parser.ParseFeedOnly(feedURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse feed: %w", err)
	}

	feed := f.parser.ToDBFeed(parsed)
	feed, err = db.CreateFeed(feed)
	if err != nil {
		return nil, err
	}

	return feed, nil
}

func countWords(content string) int {
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
