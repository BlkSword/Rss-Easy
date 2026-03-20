package rss

import (
	"encoding/xml"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"github.com/rss-post/cli/internal/db"
)

type OPML struct {
	XMLName xml.Name `xml:"opml"`
	Version string   `xml:"version,attr"`
	Head    OPMLHead `xml:"head"`
	Body    OPMLBody `xml:"body"`
}

type OPMLHead struct {
	Title       string `xml:"title"`
	DateCreated string `xml:"dateCreated"`
	OwnerName   string `xml:"ownerName"`
}

type OPMLBody struct {
	Outlines []OPMLOutline `xml:"outline"`
}

type OPMLOutline struct {
	Text     string        `xml:"text,attr"`
	Title    string        `xml:"title,attr"`
	Type     string        `xml:"type,attr"`
	XMLURL   string        `xml:"xmlUrl,attr"`
	HTMLURL  string        `xml:"htmlUrl,attr"`
	Outlines []OPMLOutline `xml:"outline"`
}

// ImportResult holds the outcome of an OPML import.
type ImportResult struct {
	Total   int
	Added   int
	Skipped int
	Errors  []string
}

// ImportOPML imports feeds from an OPML file using concurrent fetching.
// The concurrency parameter controls how many feeds are processed in parallel.
func ImportOPML(filePath string, fetcher *Fetcher, concurrency int) (*ImportResult, error) {
	if concurrency <= 0 {
		concurrency = 5
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var opml OPML
	if err := xml.Unmarshal(data, &opml); err != nil {
		return nil, fmt.Errorf("failed to parse OPML: %w", err)
	}

	outlines := flattenOutlines(opml.Body.Outlines)
	result := &ImportResult{
		Total: len(outlines),
	}

	// Filter out empty URLs
	type feedJob struct {
		url string
		idx int
	}
	var jobs []feedJob
	for i, o := range outlines {
		if o.XMLURL != "" {
			jobs = append(jobs, feedJob{url: o.XMLURL, idx: i})
		} else {
			result.Skipped++
		}
	}

	if len(jobs) == 0 {
		return result, nil
	}

	var (
		wg        sync.WaitGroup
		sem       = make(chan struct{}, concurrency)
		mu        sync.Mutex
		added     int64
		skipped   int64
		errCount  int64
	)

	for _, job := range jobs {
		wg.Add(1)
		go func(url string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			feed, err := fetcher.AddFeedQuiet(url)
			if err != nil {
				mu.Lock()
				result.Errors = append(result.Errors, fmt.Sprintf("%s: %v", url, err))
				mu.Unlock()
				atomic.AddInt64(&errCount, 1)
				return
			}

			if feed == nil {
				atomic.AddInt64(&skipped, 1)
				return
			}

			// Check if it was newly added (not pre-existing)
			if feed.ID > 0 {
				atomic.AddInt64(&added, 1)
			} else {
				atomic.AddInt64(&skipped, 1)
			}
		}(job.url)
	}

	wg.Wait()

	result.Added = int(added)
	result.Skipped += int(skipped)

	// Limit errors to avoid huge output
	if len(result.Errors) > 20 {
		result.Errors = result.Errors[:20]
		result.Errors = append(result.Errors, fmt.Sprintf("... and %d more errors", int(errCount)-20))
	}

	return result, nil
}

// ImportOPMLWithProgress imports feeds with a progress callback.
func ImportOPMLWithProgress(filePath string, fetcher *Fetcher, concurrency int, onProgress func(done, total int)) (*ImportResult, error) {
	if concurrency <= 0 {
		concurrency = 5
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var opml OPML
	if err := xml.Unmarshal(data, &opml); err != nil {
		return nil, fmt.Errorf("failed to parse OPML: %w", err)
	}

	outlines := flattenOutlines(opml.Body.Outlines)
	result := &ImportResult{
		Total: len(outlines),
	}

	var (
		wg       sync.WaitGroup
		sem      = make(chan struct{}, concurrency)
		mu       sync.Mutex
		added    int64
		skipped  int64
		done     int64
	)

	for _, o := range outlines {
		if o.XMLURL == "" {
			result.Skipped++
			continue
		}

		wg.Add(1)
		url := o.XMLURL
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			feed, err := fetcher.AddFeedQuiet(url)
			if err != nil {
				mu.Lock()
				result.Errors = append(result.Errors, fmt.Sprintf("%s: %v", url, err))
				mu.Unlock()
			} else if feed != nil && feed.ID > 0 {
				atomic.AddInt64(&added, 1)
			} else {
				atomic.AddInt64(&skipped, 1)
			}

			current := atomic.AddInt64(&done, 1)
			if onProgress != nil {
				onProgress(int(current), len(outlines))
			}
		}()
	}

	wg.Wait()

	result.Added = int(added)
	result.Skipped += int(skipped)

	if len(result.Errors) > 20 {
		result.Errors = result.Errors[:20]
		result.Errors = append(result.Errors, fmt.Sprintf("... and %d more errors", len(result.Errors)-20))
	}

	return result, nil
}

func flattenOutlines(outlines []OPMLOutline) []OPMLOutline {
	var result []OPMLOutline
	for _, o := range outlines {
		if o.XMLURL != "" {
			result = append(result, o)
		}
		if len(o.Outlines) > 0 {
			result = append(result, flattenOutlines(o.Outlines)...)
		}
	}
	return result
}

func ExportOPML(filePath string) error {
	feeds, err := db.ListFeeds(false)
	if err != nil {
		return err
	}

	opml := OPML{
		Version: "2.0",
		Head: OPMLHead{
			Title:       "RSS-Post Feeds",
			DateCreated: time.Now().Format(time.RFC1123),
			OwnerName:   "RSS-Post CLI",
		},
		Body: OPMLBody{
			Outlines: make([]OPMLOutline, len(feeds)),
		},
	}

	for i, feed := range feeds {
		opml.Body.Outlines[i] = OPMLOutline{
			Text:    feed.Title,
			Title:   feed.Title,
			Type:    "rss",
			XMLURL:  feed.FeedURL,
			HTMLURL: feed.SiteURL,
		}
	}

	data, err := xml.MarshalIndent(opml, "", "  ")
	if err != nil {
		return err
	}

	xmlContent := xml.Header + string(data)
	return os.WriteFile(filePath, []byte(xmlContent), 0644)
}
