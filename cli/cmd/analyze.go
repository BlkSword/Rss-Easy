package cmd

import (
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

		entries, err := db.GetPendingAnalysisEntries(limit)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error getting pending entries: %v\n", err)
			os.Exit(1)
		}

		if len(entries) == 0 {
			fmt.Println("No pending entries to analyze.")
			return
		}

		fmt.Printf("Analyzing %d entries with concurrency %d...\n\n", len(entries), concurrency)

		analyzer := ai.NewAnalyzer(cfg)

		var wg sync.WaitGroup
		sem := make(chan struct{}, concurrency)
		var mu sync.Mutex
		successCount := 0
		failCount := 0

		for _, entry := range entries {
			wg.Add(1)
			go func(e *db.Entry) {
				defer wg.Done()
				sem <- struct{}{}
				defer func() { <-sem }()

				err := analyzer.AnalyzeEntry(e)
				mu.Lock()
				if err != nil {
					failCount++
					fmt.Printf("✗ Entry %d: %v\n", e.ID, err)
				} else {
					successCount++
					fmt.Printf("✓ Entry %d: %s (Score: %d)\n", e.ID, truncate(e.Title, 40), e.AIScore)
				}
				mu.Unlock()
			}(entry)
		}

		wg.Wait()

		fmt.Printf("\nComplete: %d analyzed, %d failed\n", successCount, failCount)
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

		fmt.Println("Analysis Statistics")
		fmt.Println("==================")
		fmt.Printf("Total Entries:    %d\n", totalEntries)
		fmt.Printf("Analyzed:         %d\n", analyzedCount)
		fmt.Printf("Pending:          %d\n", len(pending))
		if totalEntries > 0 {
			pct := float64(analyzedCount) / float64(totalEntries) * 100
			fmt.Printf("Coverage:         %.1f%%\n", pct)
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
	analyzeCmd.AddCommand(analyzeStatsCmd)

	analyzeEntryCmd.Flags().BoolP("force", "f", false, "Force re-analysis")
	analyzeBatchCmd.Flags().IntP("limit", "l", 50, "Maximum entries to analyze")
	analyzeBatchCmd.Flags().IntP("concurrency", "c", 3, "Number of concurrent analyses")

	rootCmd.AddCommand(analyzeCmd)
}
