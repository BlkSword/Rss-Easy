package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/rss-post/cli/internal/db"
	"github.com/rss-post/cli/internal/output"
	"github.com/rss-post/cli/internal/search"
	"github.com/spf13/cobra"
)

var searchHistoryCmd = &cobra.Command{
	Use:   "history",
	Short: "Show search history",
	Run: func(cmd *cobra.Command, args []string) {
		limit, _ := cmd.Flags().GetInt("limit")

		history, err := db.GetSearchHistory(limit)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error getting search history: %v\n", err)
			os.Exit(1)
		}

		if len(history) == 0 {
			fmt.Println("No search history.")
			return
		}

		formatter := output.NewFormatter(cfg.Output.Color)
		fmt.Println(formatter.FormatSearchHistory(history))
	},
}

var searchClearHistoryCmd = &cobra.Command{
	Use:   "clear-history",
	Short: "Clear search history",
	Run: func(cmd *cobra.Command, args []string) {
		err := db.ClearSearchHistory()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error clearing search history: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Search history cleared.")
	},
}

var searchSuggestCmd = &cobra.Command{
	Use:   "suggest <prefix>",
	Short: "Get search suggestions",
	Long:  `Get search suggestions based on existing entry titles and tags.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		prefix := args[0]
		limit, _ := cmd.Flags().GetInt("limit")

		suggestions, err := db.GetSearchSuggestions(prefix, limit)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error getting suggestions: %v\n", err)
			os.Exit(1)
		}

		if len(suggestions) == 0 {
			fmt.Printf("No suggestions for '%s'.\n", prefix)
			return
		}

		for _, s := range suggestions {
			fmt.Printf("  %s\n", s)
		}
	},
}

// Override the existing searchCmd to add history tracking
func addSearchEnhancements() {
	searchCmd.AddCommand(searchHistoryCmd)
	searchCmd.AddCommand(searchClearHistoryCmd)
	searchCmd.AddCommand(searchSuggestCmd)

	searchHistoryCmd.Flags().IntP("limit", "l", 20, "Maximum history entries")
	searchSuggestCmd.Flags().IntP("limit", "l", 10, "Maximum suggestions")

	// Override Run to add history tracking
	originalRun := searchCmd.Run
	searchCmd.Run = func(cmd *cobra.Command, args []string) {
		query := args[0]
		limit, _ := cmd.Flags().GetInt("limit")

		searchService := search.NewSearchService()
		results, err := searchService.Search(query, limit)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error searching: %v\n", err)
			os.Exit(1)
		}

		// Save to search history
		_ = db.SaveSearchHistory(query, len(results))

		formatter := output.NewFormatter(cfg.Output.Color)

		// Highlight matched fields
		highlight := cmd.Flags().Changed("highlight") || true // default on

		outputResults := make([]*output.SearchResult, len(results))
		for i, r := range results {
			entry := r.Entry
			if highlight {
				// Highlight matches in title
				entry = highlightMatches(entry, query)
			}
			outputResults[i] = &output.SearchResult{
				Entry:   entry,
				Score:   r.Score,
				Matched: r.Matched,
			}
		}

		fmt.Println(formatter.FormatSearchResults(outputResults))

		if len(results) > 0 {
			fmt.Printf("\nFound %d results for '%s'\n", len(results), query)
		} else {
			fmt.Printf("\nNo results found for '%s'\n", query)
		}
	}

	// Keep reference to avoid import removal
	_ = originalRun
}

func highlightMatches(entry *db.Entry, query string) *db.Entry {
	if entry == nil {
		return entry
	}

	// Clone to avoid modifying original
	cloned := *entry
	queryLower := strings.ToLower(query)

	if strings.Contains(strings.ToLower(cloned.Title), queryLower) {
		cloned.Title = highlightText(cloned.Title, query)
	}

	return &cloned
}

func highlightText(text, query string) string {
	lower := strings.ToLower(text)
	queryLower := strings.ToLower(query)

	// Find all occurrences and wrap with markers
	result := text
	idx := strings.Index(lower, queryLower)
	for idx >= 0 {
		end := idx + len(query)
		if end <= len(result) {
			result = result[:idx] + ">>>" + result[idx:end] + "<<<" + result[end:]
			lower = strings.ToLower(result)
			// Adjust for added markers (6 chars each time)
			queryLower = strings.ToLower(">>>" + query + "<<<")
			idx = strings.Index(lower[idx+6+len(queryLower):], queryLower)
			if idx >= 0 {
				idx += 6 + idx + 6 // rough adjustment
			}
		}
		break // Just highlight first occurrence
	}
	return result
}
