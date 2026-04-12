package report

import (
	"encoding/json"
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

	// Collect all entries from sections
	var allEntries []*db.Entry
	for _, section := range report.Sections {
		allEntries = append(allEntries, section.Entries...)
	}

	// Score-based layered sampling: ensure diversity across score ranges
	var sampled []*db.Entry
	for _, entry := range allEntries {
		if entry.AIScore >= 8 {
			sampled = append(sampled, entry)
		}
	}
	// Medium score: cap at 40
	mediumCount := 0
	for _, entry := range allEntries {
		if entry.AIScore >= 6 && entry.AIScore < 8 && mediumCount < 40 {
			sampled = append(sampled, entry)
			mediumCount++
		}
	}
	// Low score: cap at 20
	lowCount := 0
	for _, entry := range allEntries {
		if entry.AIScore < 6 && lowCount < 20 {
			sampled = append(sampled, entry)
			lowCount++
		}
	}
	// Hard cap at 100 total
	if len(sampled) > 100 {
		sampled = sampled[:100]
	}

	var context strings.Builder
	context.WriteString(fmt.Sprintf("Report: %s\n", report.Title))
	context.WriteString(fmt.Sprintf("Period: %s\n", report.Period))
	context.WriteString(fmt.Sprintf("Total articles: %d, Analyzed: %d, Average score: %.1f\n\n", report.Stats.TotalEntries, report.Stats.AnalyzedEntries, report.Stats.AvgAIScore))

	for _, entry := range sampled {
		// Header line: title, score, source, language, category
		meta := fmt.Sprintf("- [%s] (Score: %d, Source: %s", entry.Title, entry.AIScore, entry.FeedName)
		if entry.ProgrammingLanguage != "" {
			meta += fmt.Sprintf(", Language: %s", entry.ProgrammingLanguage)
		}
		if entry.AICategory != "" {
			meta += fmt.Sprintf(", Category: %s", entry.AICategory)
		}
		meta += ")"
		context.WriteString(meta + "\n")

		// One-line summary
		if entry.AIOneLineSummary != "" {
			context.WriteString(fmt.Sprintf("  Summary: %s\n", entry.AIOneLineSummary))
		}

		// Tags
		keywords := entry.GetKeywords()
		if len(keywords) > 0 {
			context.WriteString(fmt.Sprintf("  Tags: %s\n", strings.Join(keywords, ", ")))
		}

		// Key points (top 3 by importance)
		points, _ := entry.GetMainPoints()
		if len(points) > 0 {
			// Sort by importance desc
			sorted := make([]db.MainPoint, len(points))
			copy(sorted, points)
			for i := 0; i < len(sorted)-1; i++ {
				for j := i + 1; j < len(sorted); j++ {
					if sorted[j].Importance > sorted[i].Importance {
						sorted[i], sorted[j] = sorted[j], sorted[i]
					}
				}
			}
			limit := len(sorted)
			if limit > 3 {
				limit = 3
			}
			context.WriteString("  Key points:\n")
			for k := 0; k < limit; k++ {
				context.WriteString(fmt.Sprintf("    - %s\n", sorted[k].Point))
			}
		}

		// Full AI summary (truncated to 300 chars to save context)
		if entry.AISummary != "" {
			summary := entry.AISummary
			if len(summary) > 300 {
				summary = summary[:300] + "..."
			}
			context.WriteString(fmt.Sprintf("  Detail: %s\n", summary))
		}

		context.WriteString("\n")
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

	if report.AISummary != "" {
		sb.WriteString("## Key Highlights\n\n")
		sb.WriteString(report.AISummary)
		sb.WriteString("\n\n---\n\n")
	}

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

	for _, section := range report.Sections {
		if section.Title == "Other Articles" {
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
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RSS-Post Report</title>
<style>
body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
body { margin: 0; padding: 0; background-color: #f6f8fa; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1a1a1a; line-height: 1.6; }
@media screen and (max-width: 600px) {
.container { width: 100% !important; }
.article-title { font-size: 16px !important; }
.score-badge { font-size: 18px !important; width: 40px !important; height: 40px !important; line-height: 40px !important; }
.card-inner { padding: 18px !important; }
}
</style>
</head>
<body style="margin:0; padding:20px 0; background-color:#f6f8fa;">
`)

	// Main container
	sb.WriteString(`<table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:680px; margin:0 auto;" class="container">`)

	// Header
	sb.WriteString(`<tr><td style="padding:30px 40px; background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius:12px 12px 0 0; text-align:center;">`)
	sb.WriteString(`<div style="display:inline-block; background:linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); width:50px; height:50px; border-radius:12px; line-height:50px; text-align:center; color:white; font-size:24px; font-weight:bold; margin-bottom:10px;">R</div>`)
	sb.WriteString(fmt.Sprintf(`<div style="color:#ffffff; font-size:24px; font-weight:700; letter-spacing:-0.5px;">%s</div>`, report.Title))
	sb.WriteString(fmt.Sprintf(`<div style="color:#94a3b8; font-size:13px; margin-top:5px;">%s</div>`, report.Period))
	sb.WriteString(`</td></tr>`)

	// Stats bar
	sb.WriteString(`<tr><td style="background-color:#ffffff; padding:0; border-bottom:1px solid #e8ecf1;">`)
	sb.WriteString(`<table border="0" cellpadding="0" cellspacing="0" width="100%"><tr>`)
	sb.WriteString(fmt.Sprintf(`<td style="padding:25px 20px; text-align:center; border-right:1px solid #e8ecf1; width:33.33%%;"><div style="color:#3b82f6; font-size:28px; font-weight:700;">%d</div><div style="color:#64748b; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; margin-top:4px;">收录文章</div></td>`, report.Stats.TotalEntries))
	sb.WriteString(fmt.Sprintf(`<td style="padding:25px 20px; text-align:center; border-right:1px solid #e8ecf1; width:33.33%%;"><div style="color:#8b5cf6; font-size:28px; font-weight:700;">%d</div><div style="color:#64748b; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; margin-top:4px;">AI 分析</div></td>`, report.Stats.AnalyzedEntries))
	sb.WriteString(fmt.Sprintf(`<td style="padding:25px 20px; text-align:center; width:33.33%%;"><div style="color:#10b981; font-size:28px; font-weight:700;">%.1f</div><div style="color:#64748b; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; margin-top:4px;">平均评分</div></td>`, report.Stats.AvgAIScore))
	sb.WriteString(`</tr></table></td></tr>`)

	// AI Summary (Key Highlights)
	if report.AISummary != "" {
		sb.WriteString(`<tr><td style="background-color:#ffffff; padding:30px 40px; border-bottom:1px solid #e8ecf1;">`)
		sb.WriteString(`<table border="0" cellpadding="0" cellspacing="0" width="100%"><tr>`)
		sb.WriteString(`<td style="background:linear-gradient(135deg, rgba(59,130,246,0.05) 0%%, rgba(139,92,246,0.05) 100%%); border-left:4px solid #3b82f6; padding:20px; border-radius:0 8px 8px 0;">`)
		sb.WriteString(`<div style="color:#3b82f6; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">&#129302; AI 洞察</div>`)
		summaryHTML := markdownToSimpleHTML(report.AISummary)
		sb.WriteString(fmt.Sprintf(`<div style="color:#334155; font-size:15px; line-height:1.8;">%s</div>`, summaryHTML))
		sb.WriteString(`</td></tr></table></td></tr>`)
	}

	// Sections with article cards
	for _, section := range report.Sections {
		if section.Title == "Other Articles" {
			sb.WriteString(fmt.Sprintf(`<tr><td style="background-color:#ffffff; padding:20px 40px 30px; text-align:center; color:#9ca3af; font-size:14px; border-top:1px solid #e8ecf1;">%d more articles with score below 6</td></tr>`, len(section.Entries)))
			continue
		}

		// Section header
		tagBg := "#f59e0b"
		if strings.Contains(section.Title, "Worth") {
			tagBg = "#3b82f6"
			tagBg = "#3b82f6"
		}
		tagLabel := "精选"
		if strings.Contains(section.Title, "Worth") {
			tagLabel = "推荐"
		}

		sb.WriteString(`<tr><td style="background-color:#ffffff; padding:30px 40px 20px;">`)
		sb.WriteString(`<table border="0" cellpadding="0" cellspacing="0" width="100%"><tr>`)
		sb.WriteString(`<td style="border-bottom:2px solid #f1f5f9; padding-bottom:15px;">`)
		sb.WriteString(fmt.Sprintf(`<span style="display:inline-block; background:%s; color:white; font-size:11px; font-weight:700; padding:4px 10px; border-radius:20px; margin-right:10px; vertical-align:middle;">%s</span>`, tagBg, tagLabel))
		sb.WriteString(fmt.Sprintf(`<span style="color:#0f172a; font-size:20px; font-weight:700; vertical-align:middle;">%s</span>`, section.Title))
		sb.WriteString(fmt.Sprintf(`<span style="color:#94a3b8; font-size:13px; float:right; margin-top:5px;">共 %d 篇</span>`, len(section.Entries)))
		sb.WriteString(`</td></tr></table></td></tr>`)

		// Article cards
		for _, entry := range section.Entries {
			sb.WriteString(renderArticleCard(entry))
		}
	}

	// Footer
	sb.WriteString(`<tr><td style="background-color:#ffffff; padding:25px 40px; border-radius:0 0 12px 12px; border-top:1px solid #e8ecf1; text-align:center;">`)
	sb.WriteString(`<div style="color:#94a3b8; font-size:12px;">RSS-Post CLI · AI 驱动的智能 RSS 信息聚合工具</div>`)
	sb.WriteString(`</td></tr>`)

	sb.WriteString(`</table></body></html>`)

	return sb.String()
}

// renderArticleCard renders a single article entry as a styled HTML card.
func renderArticleCard(entry *db.Entry) string {
	var sb strings.Builder

	isHighScore := entry.AIScore >= 8

	// Card border & background based on score
	var borderColor, cardBg string
	if isHighScore {
		borderColor = "#fbbf24"
		cardBg = "linear-gradient(135deg, #fffbeb 0%, #ffffff 100%)"
	} else {
		borderColor = "#e2e8f0"
		cardBg = "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)"
	}

	// Score badge color
	var scoreBg, scoreTextColor string
	if isHighScore {
		scoreBg = "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)"
		scoreTextColor = "white"
	} else {
		scoreBg = "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
		scoreTextColor = "white"
	}

	// Source badge color
	sourceBg := "#f1f5f9"
	sourceColor := "#475569"
	if entry.ProgrammingLanguage != "" {
		sourceBg = "#ede9fe"
		sourceColor = "#6d28d9"
	}

	// Parse score dimensions
	dims := parseScoreDimensions(entry.AIScoreDimensions)

	sb.WriteString(`<tr><td style="background-color:#ffffff; padding:0 40px 20px;">`)
	sb.WriteString(fmt.Sprintf(`<table border="0" cellpadding="0" cellspacing="0" width="100%%" style="border:2px solid %s; border-radius:12px; overflow:hidden;">`, borderColor))
	sb.WriteString(fmt.Sprintf(`<tr><td style="padding:25px; background:%s;" class="card-inner">`, cardBg))
	sb.WriteString(`<table border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="vertical-align:top;">`)

	// Score badge (right-aligned)
	sb.WriteString(fmt.Sprintf(`<div style="float:right; text-align:center; margin-left:15px;">`))
	sb.WriteString(fmt.Sprintf(`<div class="score-badge" style="width:50px; height:50px; background:%s; border-radius:50%%; line-height:50px; color:%s; font-size:20px; font-weight:800; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">%d</div>`, scoreBg, scoreTextColor, entry.AIScore))
	sb.WriteString(`<div style="color:#94a3b8; font-size:10px; margin-top:5px; font-weight:600;">综合评分</div>`)
	sb.WriteString(`</div>`)

	// Source & language badge
	sb.WriteString(`<div style="margin-bottom:10px;">`)
	if entry.FeedName != "" {
		sb.WriteString(fmt.Sprintf(`<span style="display:inline-block; background-color:%s; color:%s; font-size:11px; padding:3px 8px; border-radius:4px; font-weight:600;">%s</span>`, sourceBg, sourceColor, entry.FeedName))
	}
	if entry.ProgrammingLanguage != "" {
		sb.WriteString(fmt.Sprintf(` <span style="display:inline-block; background-color:#dbeafe; color:#1d4ed8; font-size:11px; padding:3px 8px; border-radius:4px; font-weight:600;">%s</span>`, entry.ProgrammingLanguage))
	}
	sb.WriteString(`</div>`)

	// Title
	sb.WriteString(fmt.Sprintf(`<h3 class="article-title" style="margin:0 0 12px 0; font-size:18px; line-height:1.4; font-weight:700; color:#0f172a;"><a href="%s" style="color:#0f172a; text-decoration:none;">%s</a></h3>`, entry.URL, entry.Title))

	// AI one-line summary
	if entry.AIOneLineSummary != "" {
		sb.WriteString(fmt.Sprintf(`<p style="margin:0 0 12px 0; color:#475569; font-size:14px; line-height:1.7;">%s</p>`, entry.AIOneLineSummary))
	}

	// AI summary (truncated)
	if entry.AISummary != "" {
		summary := entry.AISummary
		if len(summary) > 400 {
			summary = summary[:400] + "..."
		}
		sb.WriteString(fmt.Sprintf(`<p style="margin:0 0 15px 0; color:#64748b; font-size:13px; line-height:1.7;">%s</p>`, summary))
	}

	// Score dimensions bar
	if dims != nil {
		sb.WriteString(`<table border="0" cellpadding="0" cellspacing="0" style="margin-bottom:0;"><tr>`)
		sb.WriteString(fmt.Sprintf(`<td style="padding-right:12px; font-size:12px; color:#64748b;"><span style="color:#3b82f6; font-weight:600;">深度 %d</span> · <span style="color:#8b5cf6; font-weight:600;">质量 %d</span> · <span style="color:#10b981; font-weight:600;">实用 %d</span> · <span style="color:#f59e0b; font-weight:600;">新颖 %d</span></td>`, dims.Depth, dims.Quality, dims.Practicality, dims.Novelty))
		sb.WriteString(`</tr></table>`)
	}

	sb.WriteString(`</td></tr></table>`)
	sb.WriteString(`</td></tr></table>`)
	sb.WriteString(`</td></tr>`)

	return sb.String()
}

// parseScoreDimensions safely parses score dimensions JSON.
func parseScoreDimensions(jsonStr string) *db.ScoreDimensions {
	if jsonStr == "" {
		return nil
	}
	var dims db.ScoreDimensions
	if err := json.Unmarshal([]byte(jsonStr), &dims); err != nil {
		return nil
	}
	return &dims
}

// markdownToSimpleHTML converts basic markdown to HTML for email rendering.
func markdownToSimpleHTML(md string) string {
	html := md
	html = strings.ReplaceAll(html, "### ", `<h4 style="margin:12px 0 6px; font-size:14px; color:#333;">`)
	html = strings.ReplaceAll(html, "## ", `<h3 style="margin:12px 0 6px; font-size:15px; color:#333;">`)
	html = strings.ReplaceAll(html, "# ", `<h2 style="margin:12px 0 6px; font-size:16px; color:#333;">`)
	html = strings.ReplaceAll(html, "**", `<strong>`)
	html = strings.ReplaceAll(html, "\n- ", `<br>• `)
	html = strings.ReplaceAll(html, "\n1. ", `<br>1. `)
	html = strings.ReplaceAll(html, "\n\n", `</p><p style="margin:6px 0;">`)
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

	// Attach markdown version of the report
	attachName := fmt.Sprintf("%s.md", rpt.ReportType)
	if rpt.ReportType == "daily" {
		attachName = fmt.Sprintf("daily-report-%s.md", rpt.GeneratedAt.Format("2006-01-02"))
	} else if rpt.ReportType == "weekly" {
		attachName = fmt.Sprintf("weekly-report-%s.md", rpt.GeneratedAt.Format("2006-01-02"))
	}

	return sender.SendWithAttachment(to, subject, htmlContent, attachName, rpt.Content)
}

func (g *Generator) GenerateAIReport(report *Report) (string, error) {
	return g.generateAISummary(report)
}
