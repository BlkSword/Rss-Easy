package output

import (
	"fmt"
	"strings"
	"time"

	"github.com/olekukonko/tablewriter"
	"github.com/olekukonko/tablewriter/tw"
	"github.com/rss-post/cli/internal/db"
)

type Formatter struct {
	color bool
}

func NewFormatter(color bool) *Formatter {
	return &Formatter{color: color}
}

func (f *Formatter) FormatFeeds(feeds []*db.Feed) string {
	if len(feeds) == 0 {
		return "No feeds found."
	}

	var buf strings.Builder
	table := tablewriter.NewTable(&buf,
		tablewriter.WithHeaderAlignment(tw.AlignCenter),
		tablewriter.WithRowAlignment(tw.AlignLeft),
	)
	table.Header("ID", "Title", "URL", "Entries", "Unread", "Status")

	for _, feed := range feeds {
		status := "Active"
		if !feed.IsActive {
			status = "Inactive"
		}

		table.Append(
			fmt.Sprintf("%d", feed.ID),
			truncate(feed.Title, 40),
			truncate(feed.FeedURL, 50),
			fmt.Sprintf("%d", feed.TotalEntries),
			fmt.Sprintf("%d", feed.UnreadCount),
			status,
		)
	}

	table.Render()
	return buf.String()
}

func (f *Formatter) FormatEntries(entries []*db.Entry) string {
	if len(entries) == 0 {
		return "No entries found."
	}

	var buf strings.Builder
	table := tablewriter.NewTable(&buf,
		tablewriter.WithHeaderAlignment(tw.AlignCenter),
		tablewriter.WithRowAlignment(tw.AlignLeft),
	)
	table.Header("ID", "Title", "Feed", "Score", "Date", "Read")

	for _, entry := range entries {
		read := "No"
		if entry.IsRead {
			read = "Yes"
		}

		date := ""
		if entry.PublishedAt != nil {
			date = entry.PublishedAt.Format("2006-01-02")
		}

		score := "-"
		if entry.AIScore > 0 {
			score = fmt.Sprintf("%d", entry.AIScore)
		}

		table.Append(
			fmt.Sprintf("%d", entry.ID),
			truncate(entry.Title, 50),
			fmt.Sprintf("%d", entry.FeedID),
			score,
			date,
			read,
		)
	}

	table.Render()
	return buf.String()
}

func (f *Formatter) FormatEntryDetail(entry *db.Entry) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("Title: %s\n", entry.Title))
	sb.WriteString(fmt.Sprintf("URL: %s\n", entry.URL))
	sb.WriteString(fmt.Sprintf("Author: %s\n", entry.Author))

	if entry.PublishedAt != nil {
		sb.WriteString(fmt.Sprintf("Published: %s\n", entry.PublishedAt.Format("2006-01-02 15:04")))
	}

	sb.WriteString(fmt.Sprintf("Word Count: %d\n", entry.WordCount))
	sb.WriteString(fmt.Sprintf("Reading Time: %d min\n", entry.ReadingTime))

	if entry.AIScore > 0 {
		sb.WriteString("\n--- AI Analysis ---\n")
		sb.WriteString(fmt.Sprintf("Score: %d/10\n", entry.AIScore))

		if entry.AIOneLineSummary != "" {
			sb.WriteString(fmt.Sprintf("\nSummary: %s\n", entry.AIOneLineSummary))
		}

		if entry.AISummary != "" {
			sb.WriteString(fmt.Sprintf("\n%s\n", entry.AISummary))
		}

		mainPoints, _ := entry.GetMainPoints()
		if len(mainPoints) > 0 {
			sb.WriteString("\nMain Points:\n")
			for i, point := range mainPoints {
				sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, point.Point))
				if point.Explanation != "" {
					sb.WriteString(fmt.Sprintf("   %s\n", point.Explanation))
				}
			}
		}

		keywords, _ := entry.GetKeywords()
		if len(keywords) > 0 {
			sb.WriteString(fmt.Sprintf("\nTags: %s\n", strings.Join(keywords, ", ")))
		}

		dims, _ := entry.GetScoreDimensions()
		if dims != nil {
			sb.WriteString("\nScore Dimensions:\n")
			sb.WriteString(fmt.Sprintf("  Depth: %d | Quality: %d | Practicality: %d | Novelty: %d\n",
				dims.Depth, dims.Quality, dims.Practicality, dims.Novelty))
		}

		osInfo, _ := entry.GetOpenSourceInfo()
		if osInfo != nil {
			sb.WriteString("\nOpen Source Info:\n")
			sb.WriteString(fmt.Sprintf("  Repo: %s\n", osInfo.Repo))
			sb.WriteString(fmt.Sprintf("  License: %s\n", osInfo.License))
			sb.WriteString(fmt.Sprintf("  Stars: %d\n", osInfo.Stars))
			sb.WriteString(fmt.Sprintf("  Language: %s\n", osInfo.Language))
		}
	}

	return sb.String()
}

func (f *Formatter) FormatSearchResults(results []*SearchResult) string {
	if len(results) == 0 {
		return "No results found."
	}

	var buf strings.Builder
	table := tablewriter.NewTable(&buf,
		tablewriter.WithHeaderAlignment(tw.AlignCenter),
		tablewriter.WithRowAlignment(tw.AlignLeft),
	)
	table.Header("Score", "Title", "Matched", "Date")

	for _, result := range results {
		date := ""
		if result.Entry.PublishedAt != nil {
			date = result.Entry.PublishedAt.Format("2006-01-02")
		}

		table.Append(
			fmt.Sprintf("%.1f", result.Score),
			truncate(result.Entry.Title, 50),
			strings.Join(result.Matched, ", "),
			date,
		)
	}

	table.Render()
	return buf.String()
}

type SearchResult struct {
	Entry   *db.Entry
	Score   float64
	Matched []string
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

func FormatTime(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format("2006-01-02 15:04:05")
}
