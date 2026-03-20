package cmd

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/rss-post/cli/internal/db"
	"github.com/rss-post/cli/internal/rss"
	"github.com/rss-post/cli/internal/rules"
	"github.com/spf13/cobra"
)

var fetchCmd = &cobra.Command{
	Use:   "fetch [feed-id]",
	Short: "Fetch RSS feeds",
	Long:  `Fetch RSS feeds to get new articles. If feed-id is specified, only that feed is fetched.
After fetching, rules are automatically applied to new entries.`,
	Args:  cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		fetcher := rss.NewFetcher(cfg)
		fullContent, _ := cmd.Flags().GetBool("full")
		skipRules, _ := cmd.Flags().GetBool("skip-rules")

		if len(args) > 0 {
			feedID, err := strconv.ParseInt(args[0], 10, 64)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Invalid feed ID: %v\n", err)
				os.Exit(1)
			}

			result, err := fetcher.FetchFeed(feedID)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error fetching feed: %v\n", err)
				os.Exit(1)
			}

			if result.Success {
				fmt.Printf("Fetched feed %d: %d new entries\n", result.FeedID, result.NewCount)

				// Auto-apply rules to new entries
				if result.NewCount > 0 && !skipRules {
					applyRulesToNewEntries(result.FeedID)
				}
			} else {
				fmt.Fprintf(os.Stderr, "Failed to fetch feed %d: %v\n", result.FeedID, result.Error)
				os.Exit(1)
			}
		} else {
			quiet, _ := cmd.Flags().GetBool("quiet")
			fetchAll(fetcher, quiet, fullContent, skipRules)
		}
	},
}

var fetchDaemonCmd = &cobra.Command{
	Use:   "daemon",
	Short: "Start daemon mode for continuous fetching",
	Long:  `Start a daemon that continuously fetches feeds at configured intervals.`,
	Run: func(cmd *cobra.Command, args []string) {
		interval, _ := cmd.Flags().GetInt("interval")
		if interval == 0 {
			interval = 60
		}
		fullContent, _ := cmd.Flags().GetBool("full")

		fmt.Printf("Starting fetch daemon (interval: %d minutes, full content: %v)...\n", interval, fullContent)
		fmt.Println("Press Ctrl+C to stop.")

		fetcher := rss.NewFetcher(cfg)
		ticker := time.NewTicker(time.Duration(interval) * time.Minute)

		runFetch(fetcher, fullContent)

		for range ticker.C {
			runFetch(fetcher, fullContent)
		}
	},
}

// applyRulesToNewEntries applies all enabled rules to the latest entries from a feed.
func applyRulesToNewEntries(feedID int64) int {
	entries, err := db.ListEntries(&db.EntryFilter{
		FeedID:    &feedID,
		Limit:     20,
		OrderBy:   "created_at",
		OrderDesc: true,
	})
	if err != nil {
		return 0
	}

	engine := rules.NewEngine()
	totalActions := 0
	for _, entry := range entries {
		count, _ := engine.ApplyRules(entry)
		totalActions += count
	}
	return totalActions
}

func fetchAll(fetcher *rss.Fetcher, quiet bool, fullContent bool, skipRules bool) {
	if fullContent {
		fmt.Println("Fetching all active feeds (with full content extraction)...")
	} else {
		fmt.Println("Fetching all active feeds...")
	}
	start := time.Now()

	var results []*rss.FetchResult
	if quiet {
		results = fetcher.FetchAllWithOptions(fullContent)
	} else {
		results = fetcher.FetchAllWithProgressAndOptions(func(completed, total int, result *rss.FetchResult) {
			fmt.Printf("\r  Fetching: %d/%d (%d%%)", completed, total, completed*100/total)
		}, fullContent)
		fmt.Println() // Newline after progress
	}

	totalNew := 0
	successCount := 0
	failCount := 0
	feedsWithNew := []int64{}

	for _, result := range results {
		if result == nil {
			continue
		}
		if result.Success {
			successCount++
			totalNew += result.NewCount
			if result.NewCount > 0 {
				fmt.Printf("✓ Feed %d: %d new entries\n", result.FeedID, result.NewCount)
				feedsWithNew = append(feedsWithNew, result.FeedID)
			}
		} else {
			failCount++
			fmt.Printf("✗ Feed %d: %v\n", result.FeedID, result.Error)
		}
	}

	// Auto-apply rules to new entries
	if totalNew > 0 && !skipRules {
		fmt.Println("\nApplying rules to new entries...")
		totalActions := 0
		for _, feedID := range feedsWithNew {
			count := applyRulesToNewEntries(feedID)
			totalActions += count
		}
		if totalActions > 0 {
			fmt.Printf("Rules applied: %d actions executed.\n", totalActions)
		}
	}

	elapsed := time.Since(start)
	fmt.Printf("\nSummary: %d feeds fetched, %d new entries, %d failures (took %v)\n",
		successCount, totalNew, failCount, elapsed.Round(time.Millisecond))
}

func runFetch(fetcher *rss.Fetcher, fullContent bool) {
	fmt.Printf("\n[%s] Starting fetch...\n", time.Now().Format("2006-01-02 15:04:05"))

	results := fetcher.FetchAllWithOptions(fullContent)

	for _, result := range results {
		if result != nil && result.Success && result.NewCount > 0 {
			fmt.Printf("  Feed %d: %d new entries\n", result.FeedID, result.NewCount)
		} else if result != nil && !result.Success {
			fmt.Printf("  Feed %d: ERROR - %v\n", result.FeedID, result.Error)
		}
	}
}

func init() {
	fetchCmd.AddCommand(fetchDaemonCmd)
	fetchDaemonCmd.Flags().IntP("interval", "i", 60, "Fetch interval in minutes")
	fetchCmd.Flags().BoolP("quiet", "q", false, "Suppress progress output")
	fetchCmd.Flags().BoolP("full", "f", false, "Enable full content extraction for short entries")
	fetchCmd.Flags().Bool("skip-rules", false, "Skip automatic rule application after fetch")
	fetchDaemonCmd.Flags().BoolP("full", "f", false, "Enable full content extraction for short entries")

	rootCmd.AddCommand(fetchCmd)
}

// Make db.ListFeeds available
var _ = db.ListFeeds
