package cmd

import (
	"fmt"
	"os"

	"github.com/rss-post/cli/internal/output"
	"github.com/rss-post/cli/internal/search"
	"github.com/spf13/cobra"
)

var searchCmd = &cobra.Command{
	Use:   "search <query>",
	Short: "Search entries",
	Long:  `Search for entries by keyword in title, content, and summary.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		query := args[0]
		limit, _ := cmd.Flags().GetInt("limit")

		searchService := search.NewSearchService()
		results, err := searchService.Search(query, limit)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error searching: %v\n", err)
			os.Exit(1)
		}

		formatter := output.NewFormatter(cfg.Output.Color)

		// Convert search.SearchResult to output.SearchResult
		outputResults := make([]*output.SearchResult, len(results))
		for i, r := range results {
			outputResults[i] = &output.SearchResult{
				Entry:   r.Entry,
				Score:   r.Score,
				Matched: r.Matched,
			}
		}

		fmt.Println(formatter.FormatSearchResults(outputResults))

		if len(results) > 0 {
			fmt.Printf("\nFound %d results for '%s'\n", len(results), query)
		}
	},
}

func init() {
	searchCmd.Flags().IntP("limit", "l", 20, "Maximum number of results")
	rootCmd.AddCommand(searchCmd)
}
