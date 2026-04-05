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
	cfg      *config.Config
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
	AISummary   string // AI-generated key points summary
	Content     string
	ReportType  string // "daily" or "weekly"
}

type ReportStats struct {
	TotalEntries    int
	AnalyzedEntries int
	AvgAIScore      float64
	TopFeeds        []FeedStat
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

	return g.generateReport(
		fmt.Sprintf("Daily Report - %s", startOfDay.Format("2006-01-02")),
		startOfDay.Format("2006-01-02"),
		endOfDay.Format("2006-01-02"),
		"daily",
	)
}

func (g *Generator) GenerateWeekly(startDate time.Time) (*Report, error) {
	for startDate.Weekday() != time.Monday {
		startDate = startDate.AddDate(0, 0, -1)
	}
	endDate := startDate.AddDate(0, 0, 7)

	return g.generateReport(
		fmt.Sprintf("Weekly Report - Week of %s", startDate.Format("2006-01-02")),
		startDate.Format("2006-01-02"),
		endDate.Format("2006-01-02"),
		"weekly",
	)
}

func (g *Generator) generateReport(title, startDateStr, endDateStr, reportType string) (*Report, error) {
	entries, err := db.GetEntriesForReport(startDateStr, endDateStr)
	if err != nil {
		return nil, err
	}

	// Enrich entries with feed names
	feedNameCache := make(map[int64]string)
	for _, entry := range entries {
		if _, ok := feedNameCache[entry.FeedID]; !ok {
			if feed, err := db.GetFeed(entry.FeedID); err == nil {
				feedNameCache[entry.FeedID] = feed.Title
			} else {
				feedNameCache[entry.FeedID] = fmt.Sprintf("Feed %d", entry.FeedID)
			}
		}
	}

	report := &Report{
		Title:       title,
		Period:      fmt.Sprintf("%s to %s", startDateStr, endDateStr),
		GeneratedAt: time.Now(),
		Stats:       g.calculateStats(entries, feedNameCache),
		Sections:    g.organizeSections(entries, feedNameCache),
		ReportType:  reportType,
	}

	// Generate AI summary
	summary, err := g.generateAISummary(report)
	if err == nil && summary != "" {
		report.AISummary = summary
	}

	report.Content = g.renderMarkdown(report)

	return report, nil
}

func (g *Generator) generateAISummary(report *Report) (string, error) {
	if len(report.Sections) == 0 || report.Stats.TotalEntries == 0 {
		return "", nil
	}

	// Build context from top-scoring entries (limit to avoid token overflow)
	var context strings.Builder
	context.WriteString(fmt.Sprintf("Report: %s\n", report.Title))
	context.WriteString(fmt.Sprintf("Period: %s\n", report.Period))
	context.WriteString(fmt.Sprintf("Total articles: %d, Analyzed: %d, Average score: %.1f\n\n", report.Stats.TotalEntries, report.Stats.AnalyzedEntries, report.Stats.AvgAIScore))

	maxEntries := 60 // limit context size
	count := 0
	for _, section := range report.Sections {
		for _, entry := range section.Entries {
			if count >= maxEntries {
				break
			}
			lang := entry.ProgrammingLanguage
		if lang != "" {
			context.WriteString(fmt.Sprintf("- [%s] (Score: %d, Source: %s, Language: %s)\n", entry.Title, entry.AIScore, entry.FeedName, lang))
		} else {
			context.WriteString(fmt.Sprintf("- [%s] (Score: %d, Source: %s)\n", entry.Title, entry.AIScore, entry.FeedName))
		}
			if entry.AIOneLineSummary != "" {
				context.WriteString(fmt.Sprintf("  %s\n", entry.AIOneLineSummary))
			}
			count++
		}
		if count >= maxEntries {
			break
		}
	}

	client := ai.NewClient(g.cfg)
	prompt := ai.GetReportPrompt(g.cfg.AI.Language)
	if report.ReportType == "weekly" {
		prompt = ai.GetWeeklyReportPrompt(g.cfg.AI.Language)
	}
	return client.ChatWithSystem(prompt, context.String(), g.cfg.AI.Model)
}

func (g *Generator) calculateStats(entries []*db.Entry, feedNameCache map[int64]string) ReportStats {
	stats := ReportStats{
		TotalEntries: len(entries),
	}

	feedCounts := make(map[string]int)
	totalScore := 0

	for _, entry := range entries {
		if entry.AISummary != "" {
			stats.AnalyzedEntries++
			totalScore += entry.AIScore
		}
		name := feedNameCache[entry.FeedID]
		feedCounts[name]++
	}

	if stats.AnalyzedEntries > 0 {
		stats.AvgAIScore = float64(totalScore) / float64(stats.AnalyzedEntries)
	}

	for name, count := range feedCounts {
		stats.TopFeeds = append(stats.TopFeeds, FeedStat{Name: name, Count: count})
	}

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

func (g *Generator) organizeSections(entries []*db.Entry, feedNameCache map[int64]string) []ReportSection {
	highScore := &ReportSection{Title: "Top Picks (Score 8+)"}
	mediumScore := &ReportSection{Title: "Worth Reading (Score 6-7)"}
	other := &ReportSection{Title: "Other Articles"}

	for _, entry := range entries {
		entry.FeedName = feedNameCache[entry.FeedID]
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

	// AI Summary (key points)
	if report.AISummary != "" {
		sb.WriteString("## Key Highlights\n\n")
		sb.WriteString(report.AISummary)
		sb.WriteString("\n\n---\n\n")
	}

	// Stats
	sb.WriteString("## Statistics\n\n")
	sb.WriteString(fmt.Sprintf("- Total Articles: %d\n", report.Stats.TotalEntries))
	sb.WriteString(fmt.Sprintf("- Analyzed: %d\n", report.Stats.AnalyzedEntries))
	sb.WriteString(fmt.Sprintf("- Average AI Score: %.1f\n", report.Stats.AvgAIScore))

	if len(report.Stats.TopFeeds) > 0 {
		sb.WriteString("\n**Top Sources:**\n")
		for _, feed := range report.Stats.TopFeeds {
			sb.WriteString(fmt.Sprintf("- %s (%d articles)\n", feed.Name, feed.Count))
		}
	}
	sb.WriteString("\n")

	// Sections (only top picks + worth reading, skip "Other" to reduce noise)
	for _, section := range report.Sections {
		if section.Title == "Other Articles" {
			// Show count only
			sb.WriteString(fmt.Sprintf("## %s\n\n", section.Title))
			sb.WriteString(fmt.Sprintf("_%d articles with score below 6, omitted for brevity._\n\n", len(section.Entries)))
			continue
		}

		sb.WriteString(fmt.Sprintf("## %s\n\n", section.Title))

		for _, entry := range section.Entries {
			source := ""
			if entry.FeedName != "" {
				source = fmt.Sprintf(" · *%s*", entry.FeedName)
			}
			sb.WriteString(fmt.Sprintf("### [%s](%s)%s\n", entry.Title, entry.URL, source))

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

	// AI Summary (key highlights)
	if report.AISummary != "" {
		sb.WriteString(`<div style="background: #eef2ff; border-left: 4px solid #667eea; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 25px;">`)
		sb.WriteString(`<h2 style="margin: 0 0 10px; color: #4338ca; font-size: 16px;">Key Highlights</h2>`)
		// Convert markdown to simple HTML (preserve paragraphs and bold)
		summaryHTML := markdownToSimpleHTML(report.AISummary)
		sb.WriteString(fmt.Sprintf(`<div style="font-size: 14px; color: #374151; line-height: 1.7;">%s</div>`, summaryHTML))
		sb.WriteString(`</div>`)
	}

	// Stats
	sb.WriteString(`<div style="background: #f8f9fa; padding: 15px 20px; border-radius: 8px; margin-bottom: 25px;">`)
	sb.WriteString(`<p style="margin: 0; font-size: 14px; color: #555;">`)
	sb.WriteString(fmt.Sprintf(`<strong>%d</strong> articles · <strong>%d</strong> analyzed · avg score <strong>%.1f</strong>/10`, report.Stats.TotalEntries, report.Stats.AnalyzedEntries, report.Stats.AvgAIScore))
	sb.WriteString(`</p>`)
	if len(report.Stats.TopFeeds) > 0 {
		sb.WriteString(`<p style="margin: 8px 0 0; font-size: 13px; color: #888;">Top sources: `)
		for i, feed := range report.Stats.TopFeeds {
			if i > 0 {
				sb.WriteString(` · `)
			}
			sb.WriteString(fmt.Sprintf(`%s (%d)`, feed.Name, feed.Count))
		}
		sb.WriteString(`</p>`)
	}
	sb.WriteString(`</div>`)

	// Sections
	for _, section := range report.Sections {
		if section.Title == "Other Articles" {
			sb.WriteString(fmt.Sprintf(`<div style="margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 8px; text-align: center; color: #9ca3af; font-size: 14px;">%d more articles with score below 6</div>`, len(section.Entries)))
			continue
		}

		sb.WriteString(fmt.Sprintf(`<h2 style="color: #444; border-bottom: 2px solid #667eea; padding-bottom: 8px; margin-top: 30px;">%s</h2>`, section.Title))

		for _, entry := range section.Entries {
			sb.WriteString(`<div style="margin: 15px 0; padding: 15px; background: white; border-left: 4px solid #667eea; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-radius: 0 8px 8px 0;">`)
			sb.WriteString(fmt.Sprintf(`<a href="%s" style="color: #667eea; text-decoration: none; font-weight: 600; font-size: 16px;">%s</a>`, entry.URL, entry.Title))

			if entry.FeedName != "" {
				sb.WriteString(fmt.Sprintf(`<span style="color: #9ca3af; font-size: 13px; margin-left: 8px;">%s</span>`, entry.FeedName))
			}

			if entry.AIOneLineSummary != "" {
				sb.WriteString(fmt.Sprintf(`<p style="margin: 8px 0 0; color: #666; font-style: italic;">%s</p>`, entry.AIOneLineSummary))
			}

			if entry.AISummary != "" {
				summary := entry.AISummary
				if len(summary) > 300 {
					summary = summary[:300] + "..."
				}
				sb.WriteString(fmt.Sprintf(`<p style="margin: 8px 0 0; color: #555; font-size: 14px;">%s</p>`, summary))
			}

			if entry.AIScore > 0 {
				scoreColor := "#28a745"
				if entry.AIScore >= 8 {
					scoreColor = "#dc3545"
				} else if entry.AIScore >= 6 {
					scoreColor = "#ffc107"
				}
				sb.WriteString(fmt.Sprintf(`<span style="display: inline-block; margin-top: 8px; padding: 2px 10px; background: %s; color: white; border-radius: 12px; font-size: 13px; font-weight: 600;">★ %d/10</span>`, scoreColor, entry.AIScore))
			}

			sb.WriteString(`</div>`)
		}
	}

	// Footer
	sb.WriteString(`<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px;">`)
	sb.WriteString(`<p>RSS-Post CLI · AI-driven RSS intelligence aggregator</p>`)
	sb.WriteString(`</div></body></html>`)

	return sb.String()
}

// markdownToSimpleHTML converts basic markdown to HTML for email rendering.
func markdownToSimpleHTML(md string) string {
	html := md
	// Headers
	html = strings.ReplaceAll(html, "### ", `<h4 style="margin: 12px 0 6px; font-size: 14px; color: #333;">`)
	html = strings.ReplaceAll(html, "## ", `<h3 style="margin: 12px 0 6px; font-size: 15px; color: #333;">`)
	html = strings.ReplaceAll(html, "# ", `<h2 style="margin: 12px 0 6px; font-size: 16px; color: #333;">`)
	// Bold
	html = strings.ReplaceAll(html, "**", `<strong>`)
	// Italic
	html = strings.ReplaceAll(html, "*", `<em>`)
	html = strings.ReplaceAll(html, `<em>`, ``) // remove leftover from bold
	// Lists
	html = strings.ReplaceAll(html, "\n- ", `<br>• `)
	html = strings.ReplaceAll(html, "\n1. ", `<br>1. `)
	// Line breaks
	html = strings.ReplaceAll(html, "\n\n", `</p><p style="margin: 6px 0;">`)
	html = strings.ReplaceAll(html, "\n", `<br>`)
	return html
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
	return g.generateAISummary(report)
}
