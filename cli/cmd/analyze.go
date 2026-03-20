package cmd

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/rss-post/cli/internal/ai"
	"github.com/rss-post/cli/internal/db"
	"github.com/spf13/cobra"
)

var analyzeCmd = &cobra.Command{
	Use:   "analyze",
	Short: "AI-powered content analysis",
	Long:  `Analyze RSS entries using AI to generate summaries, scores, and insights.`,
}

var analyzeEntryCmd = &cobra.Command{
	Use:   "entry <id>",
	Short: "Analyze a single entry",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		id, err := strconv.ParseInt(args[0], 10, 64)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Invalid entry ID: %v\n", err)
			os.Exit(1)
		}

		entry, err := db.GetEntry(id)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error getting entry: %v\n", err)
			os.Exit(1)
		}

		if entry.AISummary != "" {
			force, _ := cmd.Flags().GetBool("force")
			if !force {
				fmt.Printf("Entry already analyzed (score: %d). Use --force to re-analyze.\n", entry.AIScore)
				return
			}
		}

		analyzer := ai.NewAnalyzer(cfg)

		fmt.Printf("Analyzing entry %d: %s\n", entry.ID, entry.Title)

		start := time.Now()
		err = analyzer.AnalyzeEntry(entry)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error analyzing entry: %v\n", err)
			os.Exit(1)
		}

		// Reload entry to get updated data
		entry, _ = db.GetEntry(id)

		fmt.Printf("\nAnalysis complete (took %v)\n", time.Since(start).Round(time.Millisecond))
		fmt.Printf("AI Score: %d/10\n", entry.AIScore)
		if entry.AIOneLineSummary != "" {
			fmt.Printf("Summary: %s\n", entry.AIOneLineSummary)
		}
	},
}

var analyzeBatchCmd = &cobra.Command{
	Use:   "batch",
	Short: "Analyze pending entries",
	Run: func(cmd *cobra.Command, args []string) {
		limit, _ := cmd.Flags().GetInt("limit")
		concurrency, _ := cmd.Flags().GetInt("concurrency")
		timeoutSec, _ := cmd.Flags().GetInt("timeout")

		entries, err := db.GetPendingAnalysisEntries(limit)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error getting pending entries: %v\n", err)
			os.Exit(1)
		}

		if len(entries) == 0 {
			fmt.Println("No pending entries to analyze.")
			return
		}

		fmt.Printf("Analyzing %d entries (concurrency=%d, timeout=%ds)...\n\n",
			len(entries), concurrency, timeoutSec)

		analyzer := ai.NewAnalyzer(cfg)

		total := len(entries)

		if concurrency <= 1 {
			// Serial mode
			successCount := 0
			failCount := 0
			for i, entry := range entries {
				done := i + 1
				pct := done * 100 / total

				var err error
				if timeoutSec > 0 {
					ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutSec)*time.Second)
					err = analyzer.AnalyzeEntryWithContext(ctx, entry)
					cancel()
				} else {
					err = analyzer.AnalyzeEntry(entry)
				}

				if err != nil {
					failCount++
					fmt.Printf("\r  [%3d%%] ✗ %d/%d  %s — %v   ", pct, done, total, truncate(entry.Title, 50), err)
				} else {
					successCount++
					fmt.Printf("\r  [%3d%%] ✓ %d/%d  %s (Score: %d)   ", pct, done, total, truncate(entry.Title, 50), entry.AIScore)
				}
			}
			fmt.Printf("\n\nComplete: %d analyzed, %d failed\n", successCount, failCount)
		} else {
			var wg sync.WaitGroup
			sem := make(chan struct{}, concurrency)
			var mu sync.Mutex
			successCount := 0
			failCount := 0
			var doneCount int

			for _, entry := range entries {
				wg.Add(1)
				go func(e *db.Entry) {
					defer wg.Done()
					sem <- struct{}{}
					defer func() { <-sem }()

					var err error
					if timeoutSec > 0 {
						ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutSec)*time.Second)
						err = analyzer.AnalyzeEntryWithContext(ctx, e)
						cancel()
					} else {
						err = analyzer.AnalyzeEntry(e)
					}

					mu.Lock()
					doneCount++
					done := doneCount
					pct := done * 100 / total
					if err != nil {
						failCount++
						fmt.Printf("\r  [%3d%%] ✗ %d/%d  %s   ", pct, done, total, truncate(e.Title, 50))
					} else {
						successCount++
						fmt.Printf("\r  [%3d%%] ✓ %d/%d  %s (Score: %d)   ", pct, done, total, truncate(e.Title, 50), e.AIScore)
					}
					mu.Unlock()
				}(entry)
			}

			wg.Wait()
			fmt.Printf("\n\nComplete: %d analyzed, %d failed\n", successCount, failCount)
		}
	},
}

var analyzeRetryCmd = &cobra.Command{
	Use:   "retry",
	Short: "Retry failed AI analyses",
	Long:  `Re-analyze entries that previously failed, up to the configured max retry count.`,
	Run: func(cmd *cobra.Command, args []string) {
		limit, _ := cmd.Flags().GetInt("limit")
		maxRetries, _ := cmd.Flags().GetInt("max-retries")
		timeoutSec, _ := cmd.Flags().GetInt("timeout")

		if maxRetries <= 0 {
			maxRetries = cfg.AI.MaxRetries
			if maxRetries <= 0 {
				maxRetries = 3
			}
		}

		entries, err := db.GetRetryAnalysisEntries(limit, maxRetries)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error getting retry entries: %v\n", err)
			os.Exit(1)
		}

		if len(entries) == 0 {
			fmt.Println("No failed entries to retry.")
			return
		}

		fmt.Printf("Retrying %d failed entries (max_retries=%d)...\n\n",
			len(entries), maxRetries)

		analyzer := ai.NewAnalyzer(cfg)
		successCount := 0
		failCount := 0

		for _, entry := range entries {
			var retryN int
			_ = db.DB.QueryRow("SELECT COALESCE(ai_retry_count, 0) FROM entries WHERE id = ?", entry.ID).Scan(&retryN)

			var err error
			if timeoutSec > 0 {
				ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutSec)*time.Second)
				err = analyzer.AnalyzeEntryWithContext(ctx, entry)
				cancel()
			} else {
				err = analyzer.AnalyzeEntry(entry)
			}

			if err != nil {
				failCount++
				fmt.Printf("✗ Entry %d [retry %d]: %s — %v\n", entry.ID, retryN+1, truncate(entry.Title, 40), err)
			} else {
				successCount++
				fmt.Printf("✓ Entry %d [retry %d]: %s (Score: %d)\n", entry.ID, retryN+1, truncate(entry.Title, 40), entry.AIScore)
			}
		}

		fmt.Printf("\nRetry complete: %d recovered, %d still failing\n", successCount, failCount)
	},
}

var analyzeStatsCmd = &cobra.Command{
	Use:   "stats",
	Short: "Show analysis statistics",
	Run: func(cmd *cobra.Command, args []string) {
		totalEntries, err := db.GetEntryCount()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error getting entry count: %v\n", err)
			os.Exit(1)
		}

		// Count analyzed entries
		var analyzedCount int
		err = db.DB.QueryRow("SELECT COUNT(*) FROM entries WHERE ai_summary IS NOT NULL AND ai_summary != ''").Scan(&analyzedCount)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error getting analyzed count: %v\n", err)
			os.Exit(1)
		}

		// Get pending count
		pending, _ := db.GetPendingAnalysisEntries(0)

		// Count failed (retried but still no summary)
		var failedCount int
		db.DB.QueryRow("SELECT COUNT(*) FROM entries WHERE ai_retry_count > 0 AND (ai_summary IS NULL OR ai_summary = '')").Scan(&failedCount)

		// Count permanently failed (exceeded max retries)
		maxRetries := cfg.AI.MaxRetries
		if maxRetries <= 0 {
			maxRetries = 3
		}
		var abandonedCount int
		db.DB.QueryRow("SELECT COUNT(*) FROM entries WHERE ai_retry_count >= ? AND (ai_summary IS NULL OR ai_summary = '')", maxRetries).Scan(&abandonedCount)

		// Average AI score
		var avgScore float64
		db.DB.QueryRow("SELECT COALESCE(AVG(ai_score), 0) FROM entries WHERE ai_score > 0").Scan(&avgScore)

		fmt.Println("Analysis Statistics")
		fmt.Println("==================")
		fmt.Printf("Total Entries:    %d\n", totalEntries)
		fmt.Printf("Analyzed:         %d\n", analyzedCount)
		fmt.Printf("Pending:          %d\n", len(pending))
		fmt.Printf("Failed:           %d\n", failedCount)
		fmt.Printf("Abandoned:        %d (exceeded %d retries)\n", abandonedCount, maxRetries)
		if totalEntries > 0 {
			pct := float64(analyzedCount) / float64(totalEntries) * 100
			fmt.Printf("Coverage:         %.1f%%\n", pct)
		}
		if analyzedCount > 0 {
			fmt.Printf("Avg AI Score:     %.1f\n", avgScore)
		}
	},
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

func init() {
	analyzeCmd.AddCommand(analyzeEntryCmd)
	analyzeCmd.AddCommand(analyzeBatchCmd)
	analyzeCmd.AddCommand(analyzeRetryCmd)
	analyzeCmd.AddCommand(analyzeStatsCmd)

	analyzeEntryCmd.Flags().BoolP("force", "f", false, "Force re-analysis")
	analyzeBatchCmd.Flags().IntP("limit", "l", 50, "Maximum entries to analyze")
	analyzeBatchCmd.Flags().IntP("concurrency", "c", 3, "Number of concurrent analyses")
	analyzeBatchCmd.Flags().IntP("timeout", "t", 120, "Per-entry timeout in seconds (0 = no limit)")
	analyzeRetryCmd.Flags().IntP("limit", "l", 20, "Maximum entries to retry")
	analyzeRetryCmd.Flags().Int("max-retries", 0, "Max retry count (default: from config)")
	analyzeRetryCmd.Flags().IntP("timeout", "t", 120, "Per-entry timeout in seconds (0 = no limit)")

	rootCmd.AddCommand(analyzeCmd)
}
