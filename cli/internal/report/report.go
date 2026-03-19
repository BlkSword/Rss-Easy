package report

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/rss-post/cli/internal/ai"
	"github.com/rss-post/cli/internal/config"
	"github.com/rss-post/cli/internal/db"
)

type Generator struct {
	cfg     *config.Config
	analyzer *ai.Analyzer
}

func NewGenerator(cfg *config.Config) *Generator {
	return &Generator{
		cfg:      cfg,
		analyzer: ai.NewAnalyzer(cfg),
	}
}

type Report struct {
	Title       string
	Period      string
	GeneratedAt time.Time
	Stats       ReportStats
	Sections    []ReportSection
	Content     string
}

type ReportStats struct {
	TotalEntries   int
	AnalyzedEntries int
	AvgAIScore     float64
	TopFeeds       []FeedStat
}

type FeedStat struct {
	Name  string
	Count int
}

type ReportSection struct {
	Title   string
	Entries []*db.Entry
}

func (g *Generator) GenerateDaily(date time.Time) (*Report, error) {
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	return g.generateReport(fmt.Sprintf("Daily Report - %s", startOfDay.Format("2006-01-02")), startOfDay, endOfDay)
}

func (g *Generator) GenerateWeekly(startDate time.Time) (*Report, error) {
	// Adjust to start of week (Monday)
	for startDate.Weekday() != time.Monday {
		startDate = startDate.AddDate(0, 0, -1)
	}

	endDate := startDate.AddDate(0, 0, 7)

	return g.generateReport(fmt.Sprintf("Weekly Report - Week of %s", startDate.Format("2006-01-02")), startDate, endDate)
}

func (g *Generator) generateReport(title string, startDate, endDate time.Time) (*Report, error) {
	entries, err := db.GetEntriesForReport(startDate, endDate)
	if err != nil {
		return nil, err
	}

	report := &Report{
		Title:       title,
		Period:      fmt.Sprintf("%s to %s", startDate.Format("2006-01-02"), endDate.Format("2006-01-02")),
		GeneratedAt: time.Now(),
		Stats:       g.calculateStats(entries),
		Sections:    g.organizeSections(entries),
	}

	report.Content = g.renderMarkdown(report)

	return report, nil
}

func (g *Generator) calculateStats(entries []*db.Entry) ReportStats {
	stats := ReportStats{
		TotalEntries:    len(entries),
		AnalyzedEntries: 0,
		AvgAIScore:      0,
	}

	feedCounts := make(map[string]int)
	totalScore := 0

	for _, entry := range entries {
		if entry.AISummary != "" {
			stats.AnalyzedEntries++
			totalScore += entry.AIScore
		}

		// Get feed name (simplified - would need feed lookup)
		feedCounts[fmt.Sprintf("Feed %d", entry.FeedID)]++
	}

	if stats.AnalyzedEntries > 0 {
		stats.AvgAIScore = float64(totalScore) / float64(stats.AnalyzedEntries)
	}

	// Top feeds
	for name, count := range feedCounts {
		stats.TopFeeds = append(stats.TopFeeds, FeedStat{Name: name, Count: count})
	}

	// Sort by count
	for i := 0; i < len(stats.TopFeeds)-1; i++ {
		for j := i + 1; j < len(stats.TopFeeds); j++ {
			if stats.TopFeeds[j].Count > stats.TopFeeds[i].Count {
				stats.TopFeeds[i], stats.TopFeeds[j] = stats.TopFeeds[j], stats.TopFeeds[i]
			}
		}
	}

	if len(stats.TopFeeds) > 5 {
		stats.TopFeeds = stats.TopFeeds[:5]
	}

	return stats
}

func (g *Generator) organizeSections(entries []*db.Entry) []ReportSection {
	// Group by AI score
	highScore := &ReportSection{Title: "Top Picks (Score 8+)"}
	mediumScore := &ReportSection{Title: "Worth Reading (Score 6-7)"}
	other := &ReportSection{Title: "Other Articles"}

	for _, entry := range entries {
		if entry.AIScore >= 8 {
			highScore.Entries = append(highScore.Entries, entry)
		} else if entry.AIScore >= 6 {
			mediumScore.Entries = append(mediumScore.Entries, entry)
		} else {
			other.Entries = append(other.Entries, entry)
		}
	}

	sections := []ReportSection{}
	if len(highScore.Entries) > 0 {
		sections = append(sections, *highScore)
	}
	if len(mediumScore.Entries) > 0 {
		sections = append(sections, *mediumScore)
	}
	if len(other.Entries) > 0 {
		sections = append(sections, *other)
	}

	return sections
}

func (g *Generator) renderMarkdown(report *Report) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("# %s\n\n", report.Title))
	sb.WriteString(fmt.Sprintf("**Period:** %s\n\n", report.Period))
	sb.WriteString(fmt.Sprintf("**Generated:** %s\n\n", report.GeneratedAt.Format("2006-01-02 15:04:05")))

	// Stats
	sb.WriteString("## Statistics\n\n")
	sb.WriteString(fmt.Sprintf("- Total Articles: %d\n", report.Stats.TotalEntries))
	sb.WriteString(fmt.Sprintf("- Analyzed: %d\n", report.Stats.AnalyzedEntries))
	sb.WriteString(fmt.Sprintf("- Average AI Score: %.1f\n\n", report.Stats.AvgAIScore))

	// Sections
	for _, section := range report.Sections {
		sb.WriteString(fmt.Sprintf("## %s\n\n", section.Title))

		for _, entry := range section.Entries {
			sb.WriteString(fmt.Sprintf("### [%s](%s)\n", entry.Title, entry.URL))

			if entry.AIOneLineSummary != "" {
				sb.WriteString(fmt.Sprintf("> %s\n\n", entry.AIOneLineSummary))
			}

			if entry.AISummary != "" {
				sb.WriteString(fmt.Sprintf("%s\n\n", entry.AISummary))
			}

			sb.WriteString(fmt.Sprintf("**Score:** %d/10\n\n", entry.AIScore))
			sb.WriteString("---\n\n")
		}
	}

	return sb.String()
}

func (g *Generator) SaveReport(report *Report, filePath string) error {
	return os.WriteFile(filePath, []byte(report.Content), 0644)
}

func (g *Generator) GenerateAIReport(report *Report) (string, error) {
	// Build context for AI
	var context strings.Builder
	context.WriteString(fmt.Sprintf("Report: %s\n", report.Title))
	context.WriteString(fmt.Sprintf("Period: %s\n\n", report.Period))

	for _, section := range report.Sections {
		context.WriteString(fmt.Sprintf("Section: %s\n", section.Title))
		for _, entry := range section.Entries {
			context.WriteString(fmt.Sprintf("- %s (Score: %d)\n", entry.Title, entry.AIScore))
			if entry.AIOneLineSummary != "" {
				context.WriteString(fmt.Sprintf("  Summary: %s\n", entry.AIOneLineSummary))
			}
		}
		context.WriteString("\n")
	}

	client := ai.NewClient(g.cfg)
	return client.ChatWithSystem(ai.ReportPrompt, context.String(), g.cfg.AI.Model)
}
