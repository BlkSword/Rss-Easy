package rss

import (
	"encoding/xml"
	"fmt"
	"os"
	"strings"
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
	Text    string        `xml:"text,attr"`
	Title   string        `xml:"title,attr"`
	Type    string        `xml:"type,attr"`
	XMLURL  string        `xml:"xmlUrl,attr"`
	HTMLURL string        `xml:"htmlUrl,attr"`
	Outlines []OPMLOutline `xml:"outline"`
}

type ImportResult struct {
	Total     int
	Added     int
	Skipped   int
	Errors    []string
}

func ImportOPML(filePath string, fetcher *Fetcher) (*ImportResult, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var opml OPML
	if err := xml.Unmarshal(data, &opml); err != nil {
		return nil, fmt.Errorf("failed to parse OPML: %w", err)
	}

	result := &ImportResult{}

	outlines := flattenOutlines(opml.Body.Outlines)
	result.Total = len(outlines)

	for _, outline := range outlines {
		if outline.XMLURL == "" {
			result.Skipped++
			continue
		}

		_, err := fetcher.AddFeed(outline.XMLURL)
		if err != nil {
			if strings.Contains(err.Error(), "already exists") {
				result.Skipped++
			} else {
				result.Errors = append(result.Errors, fmt.Sprintf("%s: %v", outline.XMLURL, err))
			}
			continue
		}
		result.Added++
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
