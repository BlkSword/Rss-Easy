package rss

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/mmcdole/gofeed"
	"github.com/rss-post/cli/internal/config"
	"github.com/rss-post/cli/internal/db"
)

type Parser struct {
	client  *http.Client
	parser  *gofeed.Parser
	cfg     *config.Config
}

func NewParser(cfg *config.Config) *Parser {
	client := &http.Client{
		Timeout: cfg.Fetch.Timeout,
	}

	// Configure proxy if enabled
	if cfg.Proxy.Enabled {
		// Proxy transport would be configured here
		// For simplicity, using default transport
	}

	return &Parser{
		client: client,
		parser: gofeed.NewParser(),
		cfg:    cfg,
	}
}

type ParsedFeed struct {
	Title       string
	Description string
	SiteURL     string
	FeedURL     string
	Items       []*ParsedItem
}

type ParsedItem struct {
	Title       string
	URL         string
	Content     string
	Summary     string
	Author      string
	PublishedAt *time.Time
	ContentHash string
}

func (p *Parser) Parse(feedURL string) (*ParsedFeed, error) {
	req, err := http.NewRequestWithContext(context.Background(), "GET", feedURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", p.cfg.Fetch.UserAgent)
	req.Header.Set("Accept", "application/rss+xml, application/atom+xml, application/xml, text/xml, */*")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch feed: status %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	feed, err := p.parser.ParseString(string(data))
	if err != nil {
		return nil, err
	}

	parsed := &ParsedFeed{
		Title:       feed.Title,
		Description: feed.Description,
		SiteURL:     feed.Link,
		FeedURL:     feedURL,
		Items:       make([]*ParsedItem, 0, len(feed.Items)),
	}

	for _, item := range feed.Items {
		parsedItem := &ParsedItem{
			Title:   item.Title,
			URL:     item.Link,
			Content: item.Content,
			Summary: item.Description,
			Author:  getAuthor(item),
		}

		if item.PublishedParsed != nil {
			parsedItem.PublishedAt = item.PublishedParsed
		} else if item.UpdatedParsed != nil {
			parsedItem.PublishedAt = item.UpdatedParsed
		}

		// Generate content hash for deduplication
		parsedItem.ContentHash = generateContentHash(parsedItem.Title, parsedItem.URL, parsedItem.Content)

		parsed.Items = append(parsed.Items, parsedItem)
	}

	return parsed, nil
}

func getAuthor(item *gofeed.Item) string {
	if item.Author != nil {
		return item.Author.Name
	}
	if len(item.Authors) > 0 {
		names := make([]string, 0, len(item.Authors))
		for _, a := range item.Authors {
			if a.Name != "" {
				names = append(names, a.Name)
			}
		}
		return strings.Join(names, ", ")
	}
	return ""
}

func generateContentHash(title, url, content string) string {
	// Use first 500 chars of content for hash to avoid huge strings
	contentPart := content
	if len(content) > 500 {
		contentPart = content[:500]
	}

	data := title + "|" + url + "|" + contentPart
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

func (p *Parser) ToDBFeed(parsed *ParsedFeed) *db.Feed {
	return &db.Feed{
		Title:       parsed.Title,
		Description: parsed.Description,
		FeedURL:     parsed.FeedURL,
		SiteURL:     parsed.SiteURL,
		IsActive:    true,
	}
}

func (p *Parser) ToDBEntry(item *ParsedItem, feedID int64) *db.Entry {
	return &db.Entry{
		FeedID:      feedID,
		Title:       item.Title,
		URL:         item.URL,
		Content:     item.Content,
		Summary:     item.Summary,
		Author:      item.Author,
		PublishedAt: item.PublishedAt,
		ContentHash: item.ContentHash,
		IsRead:      false,
		IsStarred:   false,
	}
}
