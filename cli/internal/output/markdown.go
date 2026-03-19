package output

import (
	"fmt"
	"strings"
	"time"

	"github.com/rss-post/cli/internal/db"
)

type MarkdownFormatter struct{}

func NewMarkdownFormatter() *MarkdownFormatter {
	return &MarkdownFormatter{}
}

func (m *MarkdownFormatter) FormatFeeds(feeds []*db.Feed) string {
	var sb strings.Builder

	sb.WriteString("# RSS Feeds\n\n")

	if len(feeds) == 0 {
		sb.WriteString("No feeds found.\n")
		return sb.String()
	}

	sb.WriteString("| ID | Title | URL | Entries | Unread | Status |\n")
	sb.WriteString("|----|-------|-----|---------|--------|--------|\n")

	for _, feed := range feeds {
		status := "Active"
		if !feed.IsActive {
			status = "Inactive"
		}

		sb.WriteString(fmt.Sprintf("| %d | %s | %s | %d | %d | %s |\n",
			feed.ID,
			escapeMarkdown(feed.Title),
			feed.FeedURL,
			feed.TotalEntries,
			feed.UnreadCount,
			status,
		))
	}

	return sb.String()
}

func (m *MarkdownFormatter) FormatEntries(entries []*db.Entry) string {
	var sb strings.Builder

	sb.WriteString("# Entries\n\n")

	if len(entries) == 0 {
		sb.WriteString("No entries found.\n")
		return sb.String()
	}

	for _, entry := range entries {
		sb.WriteString(fmt.Sprintf("## [%s](%s)\n\n", escapeMarkdown(entry.Title), entry.URL))

		if entry.AIOneLineSummary != "" {
			sb.WriteString(fmt.Sprintf("> %s\n\n", entry.AIOneLineSummary))
		}

		if entry.PublishedAt != nil {
			sb.WriteString(fmt.Sprintf("**Published:** %s  \n", entry.PublishedAt.Format("2006-01-02")))
		}

		if entry.AIScore > 0 {
			sb.WriteString(fmt.Sprintf("**Score:** %d/10  \n", entry.AIScore))
		}

		read := "No"
		if entry.IsRead {
			read = "Yes"
		}
		sb.WriteString(fmt.Sprintf("**Read:** %s\n\n", read))

		sb.WriteString("---\n\n")
	}

	return sb.String()
}

func (m *MarkdownFormatter) FormatEntryDetail(entry *db.Entry) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("# %s\n\n", escapeMarkdown(entry.Title)))
	sb.WriteString(fmt.Sprintf("**URL:** %s\n\n", entry.URL))

	if entry.Author != "" {
		sb.WriteString(fmt.Sprintf("**Author:** %s  \n", entry.Author))
	}

	if entry.PublishedAt != nil {
		sb.WriteString(fmt.Sprintf("**Published:** %s  \n", entry.PublishedAt.Format("2006-01-02 15:04")))
	}

	sb.WriteString(fmt.Sprintf("**Word Count:** %d  \n", entry.WordCount))
	sb.WriteString(fmt.Sprintf("**Reading Time:** %d min\n\n", entry.ReadingTime))

	if entry.AIScore > 0 {
		sb.WriteString("## AI Analysis\n\n")
		sb.WriteString(fmt.Sprintf("**Overall Score:** %d/10\n\n", entry.AIScore))

		if entry.AIOneLineSummary != "" {
			sb.WriteString("### Summary\n\n")
			sb.WriteString(fmt.Sprintf("%s\n\n", entry.AIOneLineSummary))
		}

		if entry.AISummary != "" {
			sb.WriteString("### Detailed Analysis\n\n")
			sb.WriteString(fmt.Sprintf("%s\n\n", entry.AISummary))
		}

		mainPoints, _ := entry.GetMainPoints()
		if len(mainPoints) > 0 {
			sb.WriteString("### Main Points\n\n")
			for i, point := range mainPoints {
				sb.WriteString(fmt.Sprintf("%d. **%s**\n", i+1, escapeMarkdown(point.Point)))
				if point.Explanation != "" {
					sb.WriteString(fmt.Sprintf("   %s\n", escapeMarkdown(point.Explanation)))
				}
			}
			sb.WriteString("\n")
		}

		keywords, _ := entry.GetKeywords()
		if len(keywords) > 0 {
			sb.WriteString("### Tags\n\n")
			for _, kw := range keywords {
				sb.WriteString(fmt.Sprintf("`%s` ", kw))
			}
			sb.WriteString("\n\n")
		}

		dims, _ := entry.GetScoreDimensions()
		if dims != nil {
			sb.WriteString("### Score Dimensions\n\n")
			sb.WriteString("| Depth | Quality | Practicality | Novelty |\n")
			sb.WriteString("|-------|---------|--------------|--------|\n")
			sb.WriteString(fmt.Sprintf("| %d | %d | %d | %d |\n\n",
				dims.Depth, dims.Quality, dims.Practicality, dims.Novelty))
		}

		osInfo, _ := entry.GetOpenSourceInfo()
		if osInfo != nil {
			sb.WriteString("### Open Source Info\n\n")
			sb.WriteString(fmt.Sprintf("- **Repo:** %s\n", osInfo.Repo))
			sb.WriteString(fmt.Sprintf("- **License:** %s\n", osInfo.License))
			sb.WriteString(fmt.Sprintf("- **Stars:** %d\n", osInfo.Stars))
			sb.WriteString(fmt.Sprintf("- **Language:** %s\n\n", osInfo.Language))
		}
	}

	return sb.String()
}

func (m *MarkdownFormatter) FormatSearchResults(results []*SearchResult) string {
	var sb strings.Builder

	sb.WriteString("# Search Results\n\n")

	if len(results) == 0 {
		sb.WriteString("No results found.\n")
		return sb.String()
	}

	for _, result := range results {
		sb.WriteString(fmt.Sprintf("## [%s](%s)\n\n", escapeMarkdown(result.Entry.Title), result.Entry.URL))
		sb.WriteString(fmt.Sprintf("**Score:** %.1f  \n", result.Score))

		if len(result.Matched) > 0 {
			sb.WriteString(fmt.Sprintf("**Matched:** %s  \n", strings.Join(result.Matched, ", ")))
		}

		if result.Entry.PublishedAt != nil {
			sb.WriteString(fmt.Sprintf("**Date:** %s\n", result.Entry.PublishedAt.Format("2006-01-02")))
		}

		sb.WriteString("\n---\n\n")
	}

	return sb.String()
}

func escapeMarkdown(s string) string {
	// Basic escaping for markdown special characters
	replacer := strings.NewReplacer(
		"#", "\\#",
		"*", "\\*",
		"_", "\\_",
		"`", "\\`",
	)
	return replacer.Replace(s)
}

func FormatTimestamp(t time.Time) string {
	return t.Format(time.RFC3339)
}
