package cmd

import (
	"fmt"
	"os"

	"github.com/rss-post/cli/internal/db"
	"github.com/rss-post/cli/internal/output"
	"github.com/rss-post/cli/internal/rss"
	"github.com/spf13/cobra"
)

var feedCmd = &cobra.Command{
	Use:   "feed",
	Short: "Manage RSS feeds",
	Long:  `Add, remove, list, import, and export RSS feeds.`,
}

var feedAddCmd = &cobra.Command{
	Use:   "add <url>",
	Short: "Add a new RSS feed",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		url := args[0]
		fetcher := rss.NewFetcher(cfg)

		feed, err := fetcher.AddFeed(url)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error adding feed: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("Feed added successfully!\n")
		fmt.Printf("  ID: %d\n", feed.ID)
		fmt.Printf("  Title: %s\n", feed.Title)
		fmt.Printf("  URL: %s\n", feed.FeedURL)
	},
}

var feedRemoveCmd = &cobra.Command{
	Use:   "remove <id>",
	Short: "Remove an RSS feed",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		var id int64
		fmt.Sscanf(args[0], "%d", &id)

		err := db.DeleteFeed(id)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error removing feed: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("Feed %d removed successfully.\n", id)
	},
}

var feedListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all feeds",
	Run: func(cmd *cobra.Command, args []string) {
		activeOnly, _ := cmd.Flags().GetBool("active-only")

		feeds, err := db.ListFeeds(activeOnly)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error listing feeds: %v\n", err)
			os.Exit(1)
		}

		formatter := output.NewFormatter(cfg.Output.Color)
		fmt.Println(formatter.FormatFeeds(feeds))
	},
}

var feedImportCmd = &cobra.Command{
	Use:   "import <opml-file>",
	Short: "Import feeds from OPML file",
	Long:  `Import feeds from an OPML file. Uses concurrent fetching with configurable parallelism.
Feed metadata is fetched concurrently; content fetching happens later via 'rss-post fetch'.`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		filePath := args[0]
		concurrency, _ := cmd.Flags().GetInt("concurrency")
		quiet, _ := cmd.Flags().GetBool("quiet")

		if concurrency <= 0 {
			concurrency = 10
		}

		fetcher := rss.NewFetcher(cfg)

		if quiet {
			// Silent mode: no progress output
			result, err := rss.ImportOPML(filePath, fetcher, concurrency)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error importing OPML: %v\n", err)
				os.Exit(1)
			}
			printImportResult(result)
		} else {
			// Progress mode: show live progress
			result, err := rss.ImportOPMLWithProgress(filePath, fetcher, concurrency,
				func(done, total int) {
					fmt.Printf("\r  Progress: %d/%d (%d%%)", done, total, done*100/total)
				},
			)
			if err != nil {
				fmt.Fprintf(os.Stderr, "\nError importing OPML: %v\n", err)
				os.Exit(1)
			}
			fmt.Println() // New line after progress bar
			printImportResult(result)
		}
	},
}

var feedExportCmd = &cobra.Command{
	Use:   "export [output-file]",
	Short: "Export feeds to OPML file",
	Args:  cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		outputPath := "feeds.opml"
		if len(args) > 0 {
			outputPath = args[0]
		}

		err := rss.ExportOPML(outputPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error exporting OPML: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("Feeds exported to %s\n", outputPath)
	},
}

func printImportResult(result *rss.ImportResult) {
	fmt.Printf("OPML Import Results:\n")
	fmt.Printf("  Total:   %d\n", result.Total)
	fmt.Printf("  Added:   %d\n", result.Added)
	fmt.Printf("  Skipped: %d\n", result.Skipped)
	if len(result.Errors) > 0 {
		fmt.Printf("  Errors:  %d\n", len(result.Errors))
		fmt.Printf("\nErrors (showing first %d):\n", min(len(result.Errors), 10))
		for _, e := range result.Errors {
			fmt.Printf("  - %s\n", e)
		}
	}
}

var feedDiscoverCmd = &cobra.Command{
	Use:   "discover <url>",
	Short: "Discover RSS feeds from a web page",
	Long:  `Discover RSS/Atom feeds from a web page by checking <link> tags and common feed paths.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		url := args[0]
		addAll, _ := cmd.Flags().GetBool("add-all")

		fmt.Printf("Discovering feeds from %s...\n", url)
		feeds, err := rss.DiscoverFeeds(url)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error discovering feeds: %v\n", err)
			os.Exit(1)
		}

		if len(feeds) == 0 {
			fmt.Println("No RSS feeds found.")
			return
		}

		fmt.Printf("Found %d feed(s):\n\n", len(feeds))
		for i, f := range feeds {
			fmt.Printf("  %d. %s (%s)\n", i+1, f.Title, f.Type)
			fmt.Printf("     %s\n\n", f.URL)
		}

		if addAll {
			fetcher := rss.NewFetcher(cfg)
			for _, f := range feeds {
				feed, err := fetcher.AddFeed(f.URL)
				if err != nil {
					fmt.Printf("  ✗ Failed to add %s: %v\n", f.Title, err)
				} else {
					fmt.Printf("  ✓ Added: %s (ID: %d)\n", feed.Title, feed.ID)
				}
			}
		}
	},
}

var feedSuggestCmd = &cobra.Command{
	Use:   "suggest [keyword]",
	Short: "Suggest popular RSS feeds",
	Long:  `Suggest popular RSS feeds. Optionally filter by keyword or category.`,
	Args:  cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		var keyword string
		if len(args) > 0 {
			keyword = args[0]
		}

		var results []struct {
			Category string
			Name     string
			URL      string
		}

		if keyword != "" {
			results = rss.SuggestFeeds(keyword)
		} else {
			// Show all categories
			for category, feeds := range rss.PopularFeeds {
				for _, f := range feeds {
					results = append(results, struct {
						Category string
						Name     string
						URL      string
					}{category, f.Name, f.URL})
				}
			}
		}

		if len(results) == 0 {
			fmt.Printf("No feeds found matching '%s'.\n", keyword)
			fmt.Println("Try categories: Tech, AI/ML, Security, Development, Science")
			return
		}

		lastCategory := ""
		for _, r := range results {
			if r.Category != lastCategory {
				if lastCategory != "" {
					fmt.Println()
				}
				fmt.Printf("📋 %s\n", r.Category)
				lastCategory = r.Category
			}
			fmt.Printf("  • %s\n", r.Name)
			fmt.Printf("    %s\n", r.URL)
		}
	},
}

func init() {
	feedCmd.AddCommand(feedAddCmd)
	feedCmd.AddCommand(feedRemoveCmd)
	feedCmd.AddCommand(feedListCmd)
	feedCmd.AddCommand(feedImportCmd)
	feedCmd.AddCommand(feedExportCmd)
	feedCmd.AddCommand(feedDiscoverCmd)
	feedCmd.AddCommand(feedSuggestCmd)
	feedCmd.AddCommand(feedFailedCmd)
	feedCmd.AddCommand(feedRetryCmd)

	feedListCmd.Flags().BoolP("active-only", "a", false, "Show only active feeds")
	feedImportCmd.Flags().IntP("concurrency", "c", 10, "Concurrent feed fetch count")
	feedImportCmd.Flags().BoolP("quiet", "q", false, "Suppress progress output")
	feedDiscoverCmd.Flags().Bool("add-all", false, "Automatically add all discovered feeds")

	rootCmd.AddCommand(feedCmd)
}

var feedFailedCmd = &cobra.Command{
	Use:   "failed",
	Short: "List feeds with recent failures",
	Run: func(cmd *cobra.Command, args []string) {
		feeds, err := db.ListFailedFeeds()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error listing failed feeds: %v\n", err)
			os.Exit(1)
		}

		if len(feeds) == 0 {
			fmt.Println("No failed feeds. All feeds are healthy! ✓")
			return
		}

		fmt.Printf("Failed Feeds (%d):\n\n", len(feeds))
		for _, feed := range feeds {
			status := "active"
			if !feed.IsActive {
				status = "DISABLED"
			}
			fmt.Printf("  [%s] #%d %s\n", status, feed.ID, feed.Title)
			fmt.Printf("    URL: %s\n", feed.FeedURL)
			fmt.Printf("    Errors: %d | Last error: %s\n", feed.ErrorCount, feed.LastError)
			if feed.LastFetchedAt != nil {
				fmt.Printf("    Last fetched: %s\n", feed.LastFetchedAt.Format("2006-01-02 15:04:05"))
			}
			fmt.Println()
		}
	},
}

var feedRetryCmd = &cobra.Command{
	Use:   "retry-failed",
	Short: "Reset failed feeds and retry fetching them",
	Run: func(cmd *cobra.Command, args []string) {
		affected, err := db.ResetFailedFeeds()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error resetting failed feeds: %v\n", err)
			os.Exit(1)
		}

		if affected == 0 {
			fmt.Println("No failed feeds to reset.")
			return
		}

		fmt.Printf("Reset %d feed(s). Fetching all feeds now...\n", affected)

		fetcher := rss.NewFetcher(cfg)
		results := fetcher.FetchAll()

		newTotal := 0
		for _, r := range results {
			if r != nil {
				if r.Success {
					newTotal += r.NewCount
				} else {
					fmt.Fprintf(os.Stderr, "  ✗ Feed %d: %v\n", r.FeedID, r.Error)
				}
			}
		}
		fmt.Printf("Retry complete: %d new entries fetched.\n", newTotal)
	},
}
