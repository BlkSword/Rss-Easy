package report

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/rss-post/cli/internal/ai"
	"github.com/rss-post/cli/internal/config"
	"github.com/rss-post/cli/internal/db"
	"github.com/rss-post/cli/internal/email"
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

	return g.generateReport(fmt.Sprintf("Daily Report - %s", startOfDay.Format("2006-01-02")), startOfDay.Format("2006-01-02"), endOfDay.Format("2006-01-02"))
}

func (g *Generator) GenerateWeekly(startDate time.Time) (*Report, error) {
	// Adjust to start of week (Monday)
	for startDate.Weekday() != time.Monday {
		startDate = startDate.AddDate(0, 0, -1)
	}

	endDate := startDate.AddDate(0, 0, 7)

	return g.generateReport(fmt.Sprintf("Weekly Report - Week of %s", startDate.Format("2006-01-02")), startDate.Format("2006-01-02"), endDate.Format("2006-01-02"))
}

func (g *Generator) generateReport(title string, startDateStr, endDateStr string) (*Report, error) {
	entries, err := db.GetEntriesForReport(startDateStr, endDateStr)
	if err != nil {
		return nil, err
	}

	report := &Report{
		Title:       title,
		Period:      fmt.Sprintf("%s to %s", startDateStr, endDateStr),
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

// RenderHTML renders the report as HTML email content.
func (g *Generator) RenderHTML(report *Report) string {
	var sb strings.Builder

	sb.WriteString(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6;">
`)

	// Header
	sb.WriteString(`<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 25px;">`)
	sb.WriteString(fmt.Sprintf(`<h1 style="margin: 0; font-size: 22px;">%s</h1>`, report.Title))
	sb.WriteString(fmt.Sprintf(`<p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">%s · Generated %s</p>`, report.Period, report.GeneratedAt.Format("2006-01-02 15:04")))
	sb.WriteString(`</div>`)

	// Stats
	sb.WriteString(`<div style="background: #f8f9fa; padding: 15px 20px; border-radius: 8px; margin-bottom: 25px;">`)
	sb.WriteString(`<p style="margin: 0; font-size: 14px; color: #555;">`)
	sb.WriteString(fmt.Sprintf(`<strong>%d</strong> 篇文章 · <strong>%d</strong> 篇已分析 · 平均评分 <strong>%.1f</strong>/10`, report.Stats.TotalEntries, report.Stats.AnalyzedEntries, report.Stats.AvgAIScore))
	sb.WriteString(`</p></div>`)

	// Sections
	for _, section := range report.Sections {
		sb.WriteString(fmt.Sprintf(`<h2 style="color: #444; border-bottom: 2px solid #667eea; padding-bottom: 8px; margin-top: 30px;">%s</h2>`, section.Title))

		for _, entry := range section.Entries {
			sb.WriteString(`<div style="margin: 15px 0; padding: 15px; background: white; border-left: 4px solid #667eea; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-radius: 0 8px 8px 0;">`)
			sb.WriteString(fmt.Sprintf(`<a href="%s" style="color: #667eea; text-decoration: none; font-weight: 600; font-size: 16px;">%s</a>`, entry.URL, entry.Title))

			if entry.AIOneLineSummary != "" {
				sb.WriteString(fmt.Sprintf(`<p style="margin: 8px 0 0; color: #666; font-style: italic;">%s</p>`, entry.AIOneLineSummary))
			}

			if entry.AISummary != "" {
				// Truncate summary for email
				summary := entry.AISummary
				if len(summary) > 300 {
					summary = summary[:300] + "..."
				}
				sb.WriteString(fmt.Sprintf(`<p style="margin: 8px 0 0; color: #555; font-size: 14px;">%s</p>`, summary))
			}

			if entry.AIScore > 0 {
				scoreColor := "#28a745" // green
				if entry.AIScore >= 8 {
					scoreColor = "#dc3545" // red for high
				} else if entry.AIScore >= 6 {
					scoreColor = "#ffc107" // yellow
				}
				sb.WriteString(fmt.Sprintf(`<span style="display: inline-block; margin-top: 8px; padding: 2px 10px; background: %s; color: white; border-radius: 12px; font-size: 13px; font-weight: 600;">★ %d/10</span>`, scoreColor, entry.AIScore))
			}

			sb.WriteString(`</div>`)
		}
	}

	// Footer
	sb.WriteString(`<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px;">`)
	sb.WriteString(`<p>RSS-Post CLI · AI 驱动的智能 RSS 信息聚合工具</p>`)
	sb.WriteString(`</div></body></html>`)

	return sb.String()
}

// SendEmail sends the report via email.
func (g *Generator) SendEmail(rpt *Report, to []string) error {
	if !g.cfg.Email.Enabled {
		return fmt.Errorf("email not enabled in config")
	}

	smtpCfg := email.SMTPConfig{
		Host:               g.cfg.Email.SMTP.Host,
		Port:               g.cfg.Email.SMTP.Port,
		Username:           g.cfg.Email.SMTP.Username,
		Password:           g.cfg.Email.SMTP.Password,
		InsecureSkipVerify: g.cfg.Email.SMTP.InsecureSkipVerify,
	}

	sender := email.NewSender2(g.cfg.Email.From, smtpCfg)

	htmlContent := g.RenderHTML(rpt)

	subject := g.cfg.Email.Subject
	if subject == "" {
		subject = rpt.Title
	} else {
		subject = fmt.Sprintf("%s - %s", subject, rpt.GeneratedAt.Format("2006-01-02"))
	}

	if len(to) == 0 {
		to = g.cfg.Email.To
	}

	return sender.Send(to, subject, htmlContent)
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
	return client.ChatWithSystem(ai.GetReportPrompt(g.cfg.AI.Language), context.String(), g.cfg.AI.Model)
}
