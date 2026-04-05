package output

import (
	"fmt"
	"strings"

	"github.com/olekukonko/tablewriter"
	"github.com/olekukonko/tablewriter/tw"
	"github.com/rss-post/cli/internal/db"
)

// FormatSearchHistory formats search history as a table.
func (f *Formatter) FormatSearchHistory(history []*db.SearchHistory) string {
	if len(history) == 0 {
		return "No search history found."
	}

	var buf strings.Builder
	table := tablewriter.NewTable(&buf,
		tablewriter.WithHeaderAlignment(tw.AlignCenter),
		tablewriter.WithRowAlignment(tw.AlignLeft),
	)
	table.Header("ID", "Query", "Results", "Time")

	for _, h := range history {
		table.Append(
			fmt.Sprintf("%d", h.ID),
			truncate(h.Query, 40),
			fmt.Sprintf("%d", h.ResultCount),
			h.SearchedAt,
		)
	}

	table.Render()
	return buf.String()
}

// FormatStats formats general statistics.
func (f *Formatter) FormatStats(totalFeeds, totalEntries, analyzedEntries int, avgScore float64) string {
	var buf strings.Builder
	buf.WriteString("═══ RSS-Post Statistics ═══\n\n")
	buf.WriteString(fmt.Sprintf("  Total Feeds:      %d\n", totalFeeds))
	buf.WriteString(fmt.Sprintf("  Total Entries:    %d\n", totalEntries))
	buf.WriteString(fmt.Sprintf("  Analyzed:         %d\n", analyzedEntries))
	if totalEntries > 0 {
		coverage := float64(analyzedEntries) / float64(totalEntries) * 100
		buf.WriteString(fmt.Sprintf("  Coverage:         %.1f%%\n", coverage))
	}
	buf.WriteString(fmt.Sprintf("  Average Score:    %.1f/10\n", avgScore))
	return buf.String()
}

// FormatFeedStats formats per-feed statistics.
func (f *Formatter) FormatFeedStatsList(stats []*db.FeedStat) string {
	if len(stats) == 0 {
		return "No feed statistics available."
	}

	var buf strings.Builder
	table := tablewriter.NewTable(&buf,
		tablewriter.WithHeaderAlignment(tw.AlignCenter),
		tablewriter.WithRowAlignment(tw.AlignLeft),
	)
	table.Header("Feed ID", "Title", "Entries", "Avg Score", "Unread")

	for _, s := range stats {
		table.Append(
			fmt.Sprintf("%d", s.FeedID),
			truncate(s.FeedTitle, 35),
			fmt.Sprintf("%d", s.TotalEntries),
			fmt.Sprintf("%.1f", s.AvgScore),
			fmt.Sprintf("%d", s.UnreadCount),
		)
	}

	table.Render()
	return buf.String()
}

// FormatDailyStats formats daily entry count trends.
func (f *Formatter) FormatDailyStats(stats []*db.DailyStat) string {
	if len(stats) == 0 {
		return "No daily statistics available."
	}

	var buf strings.Builder
	table := tablewriter.NewTable(&buf,
		tablewriter.WithHeaderAlignment(tw.AlignCenter),
		tablewriter.WithRowAlignment(tw.AlignLeft),
	)
	table.Header("Date", "New Entries")

	for _, s := range stats {
		bar := ""
		for i := 0; i < intMin(s.Count, 40); i++ {
			bar += "█"
		}
		if s.Count > 40 {
			bar += "…"
		}
		table.Append(
			s.Date,
			fmt.Sprintf("%d %s", s.Count, bar),
		)
	}

	table.Render()
	return buf.String()
}

// FormatReportList formats a list of saved reports.
func (f *Formatter) FormatReportList(reports []*db.SavedReport) string {
	if len(reports) == 0 {
		return "No saved reports found."
	}

	var buf strings.Builder
	table := tablewriter.NewTable(&buf,
		tablewriter.WithHeaderAlignment(tw.AlignCenter),
		tablewriter.WithRowAlignment(tw.AlignLeft),
	)
	table.Header("ID", "Type", "Date", "Entries", "Avg Score", "Created")

	for _, r := range reports {
		table.Append(
			fmt.Sprintf("%d", r.ID),
			r.Type,
			r.Date,
			fmt.Sprintf("%d", r.EntryCount),
			fmt.Sprintf("%.1f", r.AvgScore),
			r.CreatedAt,
		)
	}

	table.Render()
	return buf.String()
}


// FormatLanguageStats formats programming language statistics.
func (f *Formatter) FormatLanguageStats(stats []*db.LanguageStat) string {
	if len(stats) == 0 {
		return "No language statistics available."
	}

	var buf strings.Builder
	table := tablewriter.NewTable(&buf,
		tablewriter.WithHeaderAlignment(tw.AlignCenter),
		tablewriter.WithRowAlignment(tw.AlignLeft),
	)
	table.Header("Language", "Articles", "Avg Score", "Max Score", "Top Article")

	for _, s := range stats {
		table.Append(
			s.Language,
			fmt.Sprintf("%d", s.EntryCount),
			fmt.Sprintf("%.1f", s.AvgScore),
			fmt.Sprintf("%d", s.MaxScore),
			truncate(s.TopScoreEntry, 40),
		)
	}

	table.Render()
	return buf.String()
}

func intMin(a, b int) int {
	if a < b {
		return a
	}
	return b
}
