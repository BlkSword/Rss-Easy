package cmd

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/rss-post/cli/internal/ai"
	"github.com/rss-post/cli/internal/config"
	"github.com/rss-post/cli/internal/db"
	"github.com/rss-post/cli/internal/report"
	"github.com/rss-post/cli/internal/rss"
	"github.com/rss-post/cli/internal/rules"
	"github.com/spf13/cobra"
)

var daemonCmd = &cobra.Command{
	Use:   "daemon",
	Short: "Start as a persistent background service",
	Long: `Run RSS-Post as a background daemon that continuously:
- Fetches feeds based on individual intervals
- Analyzes new entries with AI
- Applies automation rules
- Generates and emails scheduled reports

The daemon checks every --check-interval minutes and only fetches
feeds whose fetch_interval has elapsed since the last successful fetch.`,
	Run: func(cmd *cobra.Command, args []string) {
		interval, _ := cmd.Flags().GetInt("check-interval")
		if interval == 0 {
			interval = 2
		}
		logPath, _ := cmd.Flags().GetString("log")
		noStdout, _ := cmd.Flags().GetBool("no-stdout")

		// Setup logging
		var logFile *os.File
		if logPath != "" {
			dir := filepath.Dir(logPath)
			if err := os.MkdirAll(dir, 0755); err != nil {
				fmt.Fprintf(os.Stderr, "Error creating log directory: %v\n", err)
				os.Exit(1)
			}
			var err error
			logFile, err = os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error opening log file: %v\n", err)
				os.Exit(1)
			}
			defer logFile.Close()
		}

		// Setup dual writer (stdout + file)
		var writers []io.Writer
		if !noStdout {
			writers = append(writers, os.Stdout)
		}
		if logFile != nil {
			writers = append(writers, logFile)
		}
		writer := io.MultiWriter(writers...)

		logf := func(format string, args ...interface{}) {
			fmt.Fprintf(writer, format+"\n", args...)
		}

		logf("Starting RSS-Post daemon (check interval: %dm)", interval)
		if logPath != "" {
			logf("Log file: %s", logPath)
		}
		logf("Press Ctrl+C to stop.")

		// Initialize status
		db.InitStatusPath()
		status := &db.DaemonStatus{
			PID:           os.Getpid(),
			StartedAt:     time.Now(),
			CheckInterval: interval,
			Running:       true,
			CurrentStep:   "idle",
		}
		db.SaveDaemonStatus(status)
		defer func() {
			status.Running = false
			status.CurrentStep = "stopped"
			db.SaveDaemonStatus(status)
			db.ClearDaemonStatus()
		}()

		fetcher := rss.NewFetcher(cfg)
		analyzer := ai.NewAnalyzer(cfg)

		// Handle graceful shutdown
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

		ticker := time.NewTicker(time.Duration(interval) * time.Minute)
		defer ticker.Stop()

		// Run immediately on start
		runFullPipeline(fetcher, analyzer, cfg, logf)

		for {
			select {
			case <-ticker.C:
				runFullPipeline(fetcher, analyzer, cfg, logf)
			case sig := <-sigCh:
				logf("Received %v, shutting down.", sig)
				return
			}
		}
	},
}

func runFullPipeline(fetcher *rss.Fetcher, analyzer *ai.Analyzer, cfg *config.Config, logf func(string, ...interface{})) {
	logf("\n[%s] Pipeline start", time.Now().Format("15:04:05"))
	now := time.Now()

	// Load current status
	status, _ := db.LoadDaemonStatus()
	if status == nil {
		status = &db.DaemonStatus{}
	}
	status.LastRunAt = now
	status.PipelineCount++

	// 1. Fetch due feeds
	status.CurrentStep = "fetching"
	db.SaveDaemonStatus(status)

	results := fetcher.FetchDue()
	newCount := 0
	failedCount := 0
	failedFeeds := []int64{}

	for _, r := range results {
		if r == nil {
			continue
		}
		if r.Success {
			newCount += r.NewCount
		} else {
			failedCount++
			failedFeeds = append(failedFeeds, r.FeedID)
		}
	}
	status.FetchNewEntries += newCount
	status.FetchFailures += failedCount
	status.LastFetchAt = time.Now()

	if newCount > 0 {
		logf("  Fetched: %d new entries", newCount)

		// 2. Apply rules
		status.CurrentStep = "rules"
		db.SaveDaemonStatus(status)

		engine := rules.NewEngine()
		ruleActions := 0
		entries, _ := db.ListEntries(&db.EntryFilter{
			Limit:     50,
			OrderBy:   "created_at",
			OrderDesc: true,
		})
		for _, entry := range entries {
			count, _ := engine.ApplyRules(entry)
			ruleActions += count
		}
		status.RulesApplied += ruleActions
		if ruleActions > 0 {
			logf("  Rules applied: %d actions", ruleActions)
		}

		// 3. AI analysis (if enabled)
		if cfg.AI.AutoAnalyze {
			status.CurrentStep = "analyzing"
			db.SaveDaemonStatus(status)

			analyzePendingEntries(analyzer, cfg, logf, status)
		} else {
			logf("  AI: auto-analyze disabled (set ai.auto_analyze = true to enable)")
		}
	} else {
		logf("  No new entries to process")
	}

	if failedCount > 0 {
		logf("  Failed feeds: %d (auto-retry with backoff)", failedCount)
	}

	// 4. Check scheduled reports
	status.CurrentStep = "report"
	db.SaveDaemonStatus(status)

	checkAndSendScheduledReports(cfg, logf)

	status.CurrentStep = "idle"
	status.LastPipelineAt = time.Now()
	db.SaveDaemonStatus(status)

	logf("[%s] Pipeline done", time.Now().Format("15:04:05"))
}

// analyzePendingEntries processes pending AI analyses with rate limiting and timeouts.
// Serial execution — no goroutines — to stay safe from provider rate limits.
func analyzePendingEntries(analyzer *ai.Analyzer, cfg *config.Config, logf func(string, ...interface{}), status *db.DaemonStatus) {
	maxPerRound := 10

	pending, err := db.GetPendingAnalysisEntries(maxPerRound)
	if err != nil || len(pending) == 0 {
		return
	}

	logf("  AI: analyzing %d pending entries...", len(pending))

	timeout := 120 * time.Second
	successCount := 0
	failCount := 0

	for _, entry := range pending {
		ctx, cancel := context.WithTimeout(context.Background(), timeout)

		err := analyzer.AnalyzeEntryWithContext(ctx, entry)

		cancel()

		if err != nil {
			failCount++
			logf("  AI: ✗ Entry %d failed: %v", entry.ID, err)
			continue
		}
		successCount++
		logf("  AI: ✓ Entry %d scored %d", entry.ID, entry.AIScore)
		if status != nil {
			status.AnalyzedSuccess++
			db.SaveDaemonStatus(status)
		}
	}
	if status != nil {
		status.AnalyzedFailed += failCount
		status.LastAnalysisAt = time.Now()
		db.SaveDaemonStatus(status)
	}

	logf("  AI: %d analyzed, %d failed", successCount, failCount)
}

func checkAndSendScheduledReports(cfg *config.Config, logf func(string, ...interface{})) {
	scfg := &cfg.Schedule
	if !scfg.Enabled {
		return
	}

	now := time.Now()
	target := time.Date(now.Year(), now.Month(), now.Day(), scfg.Hour, scfg.Minute, 0, 0, now.Location())

	// Check if we're within the same minute as the scheduled time
	diff := now.Sub(target)
	if diff < 0 || diff >= time.Minute {
		return
	}

	logf("  Generating scheduled %s report...", scfg.Type)

	generator := report.NewGenerator(cfg)
	var rpt *report.Report
	var err error

	if scfg.Type == "weekly" {
		rpt, err = generator.GenerateWeekly(now)
	} else {
		rpt, err = generator.GenerateDaily(now)
	}

	if err != nil {
		logf("  Error generating report: %v", err)
		return
	}

	logf("  Report: %d articles, %d analyzed", rpt.Stats.TotalEntries, rpt.Stats.AnalyzedEntries)

	if scfg.SendMail && cfg.Email.Enabled && len(cfg.Email.To) > 0 {
		logf("  Sending email to %v...", cfg.Email.To)
		if err := generator.SendEmail(rpt, nil); err != nil {
			logf("  Email error: %v", err)
		} else {
			logf("  Email sent!")
		}
	}
}

var daemonStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show daemon status and queue info",
	Run: func(cmd *cobra.Command, args []string) {
		status, err := db.LoadDaemonStatus()
		if err != nil {
			if os.IsNotExist(err) {
				fmt.Println("Daemon is not running (no status file found)")
				fmt.Println("\nTo start: rss-post daemon")
				return
			}
			fmt.Fprintf(os.Stderr, "Error loading status: %v\n", err)
			os.Exit(1)
		}

		uptime := time.Since(status.StartedAt).Truncate(time.Second)
		running := "❌ Stopped"
		if status.Running {
			running = "✅ Running"
		}

		fmt.Println("═══ Daemon Status ═══")
		fmt.Printf("  Status:          %s\n", running)
		fmt.Printf("  PID:             %d\n", status.PID)
		fmt.Printf("  Uptime:          %s\n", uptime)
		fmt.Printf("  Check Interval:  %d min\n", status.CheckInterval)
		fmt.Printf("  Pipeline Runs:   %d\n", status.PipelineCount)
		fmt.Printf("  Last Run:        %s\n", status.LastRunAt.Format("2006-01-02 15:04:05"))
		if !status.LastRunAt.IsZero() {
			since := time.Since(status.LastRunAt).Truncate(time.Second)
			fmt.Printf(" (%s ago)\n", since)
		} else {
			fmt.Println()
		}
		fmt.Printf("  Current Step:    %s\n", status.CurrentStep)
		fmt.Println()

		// Fetch stats
		pending, analyzed, failed, abandoned := db.GetAnalysisQueueStats()
		totalFeeds, dueFeeds, failedFeeds := db.GetFetchQueueStats()

		fmt.Println("═══ Fetch Queue ═══")
		fmt.Printf("  Total Feeds:     %d\n", totalFeeds)
		fmt.Printf("  Due Now:         %d\n", dueFeeds)
		fmt.Printf("  With Errors:     %d\n", failedFeeds)
		fmt.Println()

		fmt.Println("═══ Analysis Queue ═══")
		fmt.Printf("  Pending:         %d\n", pending)
		fmt.Printf("  Analyzed:        %d\n", analyzed)
		fmt.Printf("  Failed:          %d\n", failed)
		fmt.Printf("  Abandoned:       %d (retry limit reached)\n", abandoned)
		fmt.Println()

		fmt.Println("═══ Cumulative Stats ═══")
		fmt.Printf("  Entries Fetched:  %d\n", status.FetchNewEntries)
		fmt.Printf("  Fetch Failures:  %d\n", status.FetchFailures)
		fmt.Printf("  AI Analyzed:     %d success / %d failed\n", status.AnalyzedSuccess, status.AnalyzedFailed)
		fmt.Printf("  Rules Applied:   %d\n", status.RulesApplied)
		fmt.Printf("  Reports Sent:    %d\n", status.ReportsSent)
	},
}

func init() {
	daemonCmd.AddCommand(daemonStatusCmd)
	daemonCmd.Flags().Int("check-interval", 2, "How often to check for due feeds (minutes)")
	daemonCmd.Flags().String("log", "", "Log file path (default: ~/.rss-post/daemon.log)")
	daemonCmd.Flags().Bool("no-stdout", false, "Disable console output, write to log file only")

	rootCmd.AddCommand(daemonCmd)
}

// Ensure config and db are available
var _ = config.DefaultConfig
var _ = db.Init
