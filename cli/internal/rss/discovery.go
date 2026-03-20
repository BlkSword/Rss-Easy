package rss

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

// DiscoveredFeed represents a discovered RSS feed.
type DiscoveredFeed struct {
	Title string
	URL   string
	Type  string
}

// DiscoverFeeds discovers RSS feeds from a web page URL.
func DiscoverFeeds(pageURL string) ([]*DiscoveredFeed, error) {
	client := &http.Client{
		Timeout: 15 * time.Second,
		// Follow redirects
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return fmt.Errorf("too many redirects")
			}
			return nil
		},
	}

	req, err := http.NewRequest("GET", pageURL, nil)
	if err != nil {
		return nil, fmt.Errorf("invalid URL: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; RSS-Post/1.0)")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch page: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, resp.Status)
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to parse HTML: %w", err)
	}

	var feeds []*DiscoveredFeed

	// Look for <link> tags with RSS/Atom types
	types := []string{
		"application/rss+xml",
		"application/atom+xml",
		"application/json+feed",
		"application/feed+json",
		"text/xml",
		"application/xml",
	}

	doc.Find("link[rel='alternate']").Each(func(i int, s *goquery.Selection) {
		linkType := strings.ToLower(s.AttrOr("type", ""))
		href := s.AttrOr("href", "")
		title := s.AttrOr("title", "")

		for _, t := range types {
			if strings.Contains(linkType, t) || strings.Contains(t, linkType) {
				if href != "" {
					// Resolve relative URLs
					absURL := resolveURL(pageURL, href)
					feedType := "RSS"
					if strings.Contains(linkType, "atom") {
						feedType = "Atom"
					} else if strings.Contains(linkType, "json") {
						feedType = "JSON Feed"
					}

					if title == "" {
						title = feedType + " Feed"
					}

					feeds = append(feeds, &DiscoveredFeed{
						Title: title,
						URL:   absURL,
						Type:  feedType,
					})
				}
				break
			}
		}
	})

	// Also check common feed paths
	if len(feeds) == 0 {
		commonPaths := []string{
			"/feed", "/rss", "/atom.xml", "/feed.xml",
			"/rss.xml", "/index.xml", "/feed/atom",
			"/wp-json/wp/v2/posts", // WordPress REST API
		}

		baseURL := pageURL
		if idx := strings.Index(pageURL, "//"); idx >= 0 {
			rest := pageURL[idx+2:]
			if slashIdx := strings.Index(rest, "/"); slashIdx >= 0 {
				baseURL = pageURL[:idx+2+slashIdx]
			}
		}

		for _, path := range commonPaths {
			testURL := baseURL + path
			if testURL == pageURL {
				continue
			}

			// Quick check if the URL returns valid content
			if isValidFeedURL(testURL) {
				feeds = append(feeds, &DiscoveredFeed{
					Title: "Feed",
					URL:   testURL,
					Type:  "RSS",
				})
				if len(feeds) >= 3 {
					break
				}
			}
		}
	}

	// Deduplicate
	seen := make(map[string]bool)
	var unique []*DiscoveredFeed
	for _, f := range feeds {
		if !seen[f.URL] {
			seen[f.URL] = true
			unique = append(unique, f)
		}
	}

	return unique, nil
}

func resolveURL(base, href string) string {
	if strings.HasPrefix(href, "http://") || strings.HasPrefix(href, "https://") {
		return href
	}
	if strings.HasPrefix(href, "//") {
		if strings.HasPrefix(base, "https://") {
			return "https:" + href
		}
		return "http:" + href
	}
	if strings.HasPrefix(href, "/") {
		if idx := strings.Index(base, "//"); idx >= 0 {
			rest := base[idx+2:]
			if slashIdx := strings.Index(rest, "/"); slashIdx >= 0 {
				return base[:idx+2+slashIdx] + href
			}
			return base + href
		}
	}
	// Relative path
	if idx := strings.LastIndex(base, "/"); idx >= 0 {
		return base[:idx+1] + href
	}
	return base + "/" + href
}

func isValidFeedURL(url string) bool {
	client := &http.Client{Timeout: 10 * time.Second}
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; RSS-Post/1.0)")

	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false
	}

	contentType := resp.Header.Get("Content-Type")
	return strings.Contains(contentType, "xml") ||
		strings.Contains(contentType, "rss") ||
		strings.Contains(contentType, "atom") ||
		strings.Contains(contentType, "json")
}

// PopularFeeds returns a curated list of popular RSS feeds by category.
var PopularFeeds = map[string][]struct {
	Name string
	URL  string
}{
	"Tech": {
		{"Hacker News", "https://hnrss.org/frontpage"},
		{"TechCrunch", "https://techcrunch.com/feed/"},
		{"The Verge", "https://www.theverge.com/rss/index.xml"},
		{"Ars Technica", "https://feeds.arstechnica.com/arstechnica/index"},
		{"Wired", "https://www.wired.com/feed/rss"},
		{"Slashdot", "https://rss.slashdot.org/Slashdot/slashdotMain"},
	},
	"AI/ML": {
		{"AI News", "https://artificialintelligence-news.com/feed/"},
		{"OpenAI Blog", "https://openai.com/blog/rss/"},
		{"Google AI Blog", "https://blog.google/technology/ai/rss/"},
		{"DeepMind Blog", "https://deepmind.google/blog/rss/"},
	},
	"Security": {
		{"Krebs on Security", "https://krebsonsecurity.com/feed/"},
		{"The Hacker News", "https://feeds.feedburner.com/TheHackersNews"},
		{"BleepingComputer", "https://www.bleepingcomputer.com/feed/"},
		{"Dark Reading", "https://www.darkreading.com/rss_simple.asp"},
		{"Schneier on Security", "https://www.schneier.com/blog/atom.xml"},
	},
	"Development": {
		{"Dev.to", "https://dev.to/feed/"},
		{"CSS-Tricks", "https://css-tricks.com/feed/"},
		{"Smashing Magazine", "https://www.smashingmagazine.com/feed/"},
		{"InfoQ", "https://feed.infoq.com/"},
	},
	"Science": {
		{"Nature", "https://www.nature.com/nature.rss"},
		{"Science Daily", "https://www.sciencedaily.com/rss/all.xml"},
		{"MIT Tech Review", "https://www.technologyreview.com/feed/"},
	},
}

// SuggestFeeds returns popular feeds matching a keyword.
func SuggestFeeds(keyword string) []struct {
	Category string
	Name     string
	URL      string
} {
	keyword = strings.ToLower(keyword)
	var results []struct {
		Category string
		Name     string
		URL      string
	}

	for category, feeds := range PopularFeeds {
		if strings.Contains(strings.ToLower(category), keyword) {
			for _, f := range feeds {
				results = append(results, struct {
					Category string
					Name     string
					URL      string
				}{category, f.Name, f.URL})
			}
			continue
		}
		for _, f := range feeds {
			if strings.Contains(strings.ToLower(f.Name), keyword) {
				results = append(results, struct {
					Category string
					Name     string
					URL      string
				}{category, f.Name, f.URL})
			}
		}
	}
	return results
}

// FetchURLContent fetches content from a URL.
func FetchURLContent(url string) (string, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; RSS-Post/1.0)")

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	return string(body), err
}
