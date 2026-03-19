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
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		filePath := args[0]
		fetcher := rss.NewFetcher(cfg)

		result, err := rss.ImportOPML(filePath, fetcher)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error importing OPML: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("OPML Import Results:\n")
		fmt.Printf("  Total: %d\n", result.Total)
		fmt.Printf("  Added: %d\n", result.Added)
		fmt.Printf("  Skipped: %d\n", result.Skipped)

		if len(result.Errors) > 0 {
			fmt.Printf("\nErrors:\n")
			for _, e := range result.Errors {
				fmt.Printf("  - %s\n", e)
			}
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

func init() {
	feedCmd.AddCommand(feedAddCmd)
	feedCmd.AddCommand(feedRemoveCmd)
	feedCmd.AddCommand(feedListCmd)
	feedCmd.AddCommand(feedImportCmd)
	feedCmd.AddCommand(feedExportCmd)

	feedListCmd.Flags().BoolP("active-only", "a", false, "Show only active feeds")

	rootCmd.AddCommand(feedCmd)
}
