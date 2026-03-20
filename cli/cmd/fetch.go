package cmd

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/rss-post/cli/internal/db"
	"github.com/rss-post/cli/internal/rss"
	"github.com/spf13/cobra"
)

var fetchCmd = &cobra.Command{
	Use:   "fetch [feed-id]",
	Short: "Fetch RSS feeds",
	Long:  `Fetch RSS feeds to get new articles. If feed-id is specified, only that feed is fetched.`,
	Args:  cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		fetcher := rss.NewFetcher(cfg)

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
			} else {
				fmt.Fprintf(os.Stderr, "Failed to fetch feed %d: %v\n", result.FeedID, result.Error)
				os.Exit(1)
			}
		} else {
			quiet, _ := cmd.Flags().GetBool("quiet")
			fetchAll(fetcher, quiet)
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

		fmt.Printf("Starting fetch daemon (interval: %d minutes)...\n", interval)
		fmt.Println("Press Ctrl+C to stop.")

		fetcher := rss.NewFetcher(cfg)
		ticker := time.NewTicker(time.Duration(interval) * time.Minute)

		runFetch(fetcher)

		for range ticker.C {
			runFetch(fetcher)
		}
	},
}

func fetchAll(fetcher *rss.Fetcher, quiet bool) {
	fmt.Println("Fetching all active feeds...")
	start := time.Now()

	var results []*rss.FetchResult
	if quiet {
		results = fetcher.FetchAll()
	} else {
		results = fetcher.FetchAllWithProgress(func(completed, total int, result *rss.FetchResult) {
			fmt.Printf("\r  Fetching: %d/%d (%d%%)", completed, total, completed*100/total)
		})
		fmt.Println() // Newline after progress
	}

	totalNew := 0
	successCount := 0
	failCount := 0

	for _, result := range results {
		if result == nil {
			continue
		}
		if result.Success {
			successCount++
			totalNew += result.NewCount
			if result.NewCount > 0 {
				fmt.Printf("✓ Feed %d: %d new entries\n", result.FeedID, result.NewCount)
			}
		} else {
			failCount++
			fmt.Printf("✗ Feed %d: %v\n", result.FeedID, result.Error)
		}
	}

	elapsed := time.Since(start)
	fmt.Printf("\nSummary: %d feeds fetched, %d new entries, %d failures (took %v)\n",
		successCount, totalNew, failCount, elapsed.Round(time.Millisecond))
}

func runFetch(fetcher *rss.Fetcher) {
	fmt.Printf("\n[%s] Starting fetch...\n", time.Now().Format("2006-01-02 15:04:05"))

	results := fetcher.FetchAll()

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

	rootCmd.AddCommand(fetchCmd)
}

// Make db.ListFeeds available
var _ = db.ListFeeds
