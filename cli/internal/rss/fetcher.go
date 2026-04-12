package rss

import (
	"context"
	"fmt"
	"net/url"
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
	return f.FetchFeedByURLWithOptions(feedID, feedURL, false)
}

// FetchFeedByURLWithOptions fetches a feed with optional full content extraction.
func (f *Fetcher) FetchFeedByURLWithOptions(feedID int64, feedURL string, fullContent bool) (*FetchResult, error) {
	result := &FetchResult{
		FeedID:  feedID,
		FeedURL: feedURL,
	}

	// Exponential backoff: skip feeds with recent errors
	feed, _ := db.GetFeed(feedID)
	if feed != nil && feed.ErrorCount > 0 {
		backoffMinutes := feed.ErrorCount * 5
		if backoffMinutes > 50 {
			backoffMinutes = 50
		}
		backoff := time.Duration(backoffMinutes) * time.Minute
		if feed.LastFetchedAt != nil && time.Since(*feed.LastFetchedAt) < backoff {
			result.Success = true
			result.NewCount = 0
			return result, nil // skip, not ready for retry yet
		}
	}

	parsed, err := f.parser.Parse(feedURL)
	if err != nil {
		result.Error = err
		db.UpdateFeedStats(feedID, false, err.Error())
		return result, nil
	}

	// Update feed metadata (reload in case it changed)
	feed, _ = db.GetFeed(feedID)
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
	newCount := f.processEntries(parsed.Items, feedID, fullContent)
	result.NewCount = newCount

	db.UpdateFeedStats(feedID, true, "")
	result.Success = true
	return result, nil
}

// processEntries creates new entries, skipping duplicates. Returns count of new entries.
func (f *Fetcher) processEntries(items []*ParsedItem, feedID int64, fullContent bool) int {
	enableFull := fullContent || f.cfg.Fetch.FullContent

	if !enableFull {
		return f.processEntriesSimple(items, feedID)
	}

	// Full content mode: fetch full content for short entries concurrently
	concurrency := f.cfg.Fetch.FullConcurrency
	if concurrency <= 0 {
		concurrency = 5
	}
	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup

	for _, item := range items {
		if item.ContentHash == "" {
			continue
		}

		existing, err := db.GetEntryByHash(item.ContentHash)
		if err == nil && existing != nil {
			continue // Duplicate
		}

		// Fetch full content if content is too short
		if len(item.Content) < 500 && item.URL != "" {
			wg.Add(1)
			go func(it *ParsedItem) {
				defer wg.Done()
				sem <- struct{}{}
				defer func() { <-sem }()

				proxyURL := ""
				if f.cfg.Proxy.Enabled && f.cfg.Proxy.Host != "" {
					proxyURL = fmt.Sprintf("%s://%s:%s", f.cfg.Proxy.Type, f.cfg.Proxy.Host, f.cfg.Proxy.Port)
				}
				fullContent := FetchFullContent(it.URL, f.cfg.Fetch.FullTimeout, f.cfg.Fetch.UserAgent, proxyURL)
				if fullContent != "" {
					it.Content = fullContent
				}
			}(item)
		}
	}

	wg.Wait()

	// Now create entries
	newCount := 0
	for _, item := range items {
		if item.ContentHash == "" {
			continue
		}

		existing, err := db.GetEntryByHash(item.ContentHash)
		if err == nil && existing != nil {
			continue
		}

		entry := f.parser.ToDBEntry(item, feedID)
		rawContent := entry.Content
		if rawContent == "" {
			rawContent = entry.Summary
		}
		entry.WordCount = countWords(rawContent)
		entry.ReadingTime = (entry.WordCount / 200) + 1

		if _, err = db.CreateEntry(entry); err == nil {
			newCount++
		}
	}
	return newCount
}

// processEntriesSimple creates entries without full content fetching.
func (f *Fetcher) processEntriesSimple(items []*ParsedItem, feedID int64) int {
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
		rawContent := entry.Content
		if rawContent == "" {
			rawContent = entry.Summary
		}
		entry.WordCount = countWords(rawContent)
		entry.ReadingTime = (entry.WordCount / 200) + 1

		if _, err = db.CreateEntry(entry); err == nil {
			newCount++
		}
	}
	return newCount
}

// FetchAll fetches all active feeds concurrently.
func (f *Fetcher) FetchAll() []*FetchResult {
	return f.FetchAllWithOptions(f.cfg.Fetch.FullContent)
}

// FetchAllWithOptions fetches all active feeds with optional full content extraction.
func (f *Fetcher) FetchAllWithOptions(fullContent bool) []*FetchResult {
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

			result, _ := f.FetchFeedByURLWithOptions(feedID, feedURL, fullContent)
			results[idx] = result
		}(i, feed.ID, feed.FeedURL)
	}

	wg.Wait()
	return results
}

// FetchDue fetches only feeds whose fetch_interval has elapsed since last fetch.
func (f *Fetcher) FetchDue() []*FetchResult {
	return f.FetchDueWithOptions(f.cfg.Fetch.FullContent)
}

// FetchDueWithOptions fetches only due feeds with optional full content extraction.
func (f *Fetcher) FetchDueWithOptions(fullContent bool) []*FetchResult {
	feeds, err := db.ListFeeds(true)
	if err != nil {
		return nil
	}

	results := make([]*FetchResult, len(feeds))
	var wg sync.WaitGroup
	sem := make(chan struct{}, f.cfg.Fetch.Concurrency)

	for i, feed := range feeds {
		// Skip feeds that haven't reached their fetch interval yet
		if feed.LastFetchedAt != nil && feed.FetchInterval > 0 {
			nextFetch := feed.LastFetchedAt.Add(time.Duration(feed.FetchInterval) * time.Minute)
			if time.Now().Before(nextFetch) {
				results[i] = &FetchResult{
					FeedID:   feed.ID,
					FeedURL:  feed.FeedURL,
					Success:  true,
					NewCount: 0,
				}
				continue
			}
		}

		wg.Add(1)
		go func(idx int, feedID int64, feedURL string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			result, _ := f.FetchFeedByURLWithOptions(feedID, feedURL, fullContent)
			results[idx] = result
		}(i, feed.ID, feed.FeedURL)
	}

	wg.Wait()
	return results
}

// FetchAllWithProgress fetches all active feeds with progress callback.
func (f *Fetcher) FetchAllWithProgress(onProgress func(completed, total int, result *FetchResult)) []*FetchResult {
	return f.FetchAllWithProgressAndOptions(onProgress, f.cfg.Fetch.FullContent)
}

// FetchAllWithProgressAndOptions fetches all active feeds with progress callback and full content option.
func (f *Fetcher) FetchAllWithProgressAndOptions(onProgress func(completed, total int, result *FetchResult), fullContent bool) []*FetchResult {
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

			result, _ := f.FetchFeedByURLWithOptions(feedID, feedURL, fullContent)
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
func (f *Fetcher) AddFeedQuiet(feedURL string) (*db.Feed, error) {
	existing, err := db.GetFeedByURL(feedURL)
	if err == nil && existing != nil {
		return existing, nil
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

// makeProxyURL builds a proxy URL string from config.
func makeProxyURL(cfg *config.ProxyConfig) string {
	if !cfg.Enabled || cfg.Host == "" {
		return ""
	}
	return fmt.Sprintf("%s://%s:%s", cfg.Type, cfg.Host, cfg.Port)
}

// unused import guard
var _ = url.Parse
