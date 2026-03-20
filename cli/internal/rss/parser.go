package rss

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/mmcdole/gofeed"
	"github.com/rss-post/cli/internal/config"
	"github.com/rss-post/cli/internal/db"
)

// Parser handles RSS/Atom/JSON Feed parsing with connection pooling and proxy support.
type Parser struct {
	client *http.Client
	parser *gofeed.Parser
	cfg    *config.Config
}

// sharedParser and parserOnce are used by SharedParser for connection reuse across batch operations.
var (
	sharedParser *Parser
	parserOnce   sync.Once
)

// NewParser creates a Parser with shared transport (connection pooling) and optional proxy.
func NewParser(cfg *config.Config) *Parser {
	transport := &http.Transport{
		MaxIdleConns:        20,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
		MaxConnsPerHost:     10,
	}

	if cfg.Proxy.Enabled && cfg.Proxy.Host != "" {
		proxyURL := fmt.Sprintf("%s://%s:%s", cfg.Proxy.Type, cfg.Proxy.Host, cfg.Proxy.Port)
		if pURL, err := url.Parse(proxyURL); err == nil {
			transport.Proxy = http.ProxyURL(pURL)
		}
	}

	client := &http.Client{
		Timeout:   cfg.Fetch.Timeout,
		Transport: transport,
	}

	return &Parser{
		client: client,
		parser: gofeed.NewParser(),
		cfg:    cfg,
	}
}

// SharedParser returns a shared parser instance (lazy singleton).
// Use this for batch operations to reuse connections.
func SharedParser(cfg *config.Config) *Parser {
	parserOnce.Do(func() {
		sharedParser = NewParser(cfg)
	})
	return sharedParser
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

// Parse fetches and parses a feed URL.
func (p *Parser) Parse(feedURL string) (*ParsedFeed, error) {
	return p.ParseWithContext(context.Background(), feedURL)
}

// ParseWithContext fetches and parses a feed URL with context for cancellation.
func (p *Parser) ParseWithContext(ctx context.Context, feedURL string) (*ParsedFeed, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", feedURL, nil)
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
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	// Limit read size to 5MB to prevent memory issues
	data, err := io.ReadAll(io.LimitReader(resp.Body, 5*1024*1024))
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

		parsedItem.ContentHash = generateContentHash(parsedItem.Title, parsedItem.URL, parsedItem.Content)
		parsed.Items = append(parsed.Items, parsedItem)
	}

	return parsed, nil
}

// ParseFeedOnly fetches just the feed metadata (title, description, etc.) without items.
// Useful for OPML import where we don't need to fetch content immediately.
func (p *Parser) ParseFeedOnly(feedURL string) (*ParsedFeed, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", feedURL, nil)
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
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, 512*1024)) // 512KB enough for metadata
	if err != nil {
		return nil, err
	}

	feed, err := p.parser.ParseString(string(data))
	if err != nil {
		return nil, err
	}

	return &ParsedFeed{
		Title:       feed.Title,
		Description: feed.Description,
		SiteURL:     feed.Link,
		FeedURL:     feedURL,
		Items:       nil, // Skip items for lightweight parsing
	}, nil
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
