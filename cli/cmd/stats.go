package cmd

import (
	"fmt"
	"os"

	"github.com/rss-post/cli/internal/db"
	"github.com/rss-post/cli/internal/output"
	"github.com/spf13/cobra"
)

var statsCmd = &cobra.Command{
	Use:   "stats",
	Short: "Show statistics",
	Long:  `Show various statistics about your RSS feeds and entries.`,
}

var statsOverviewCmd = &cobra.Command{
	Use:   "overview",
	Short: "Show overview statistics",
	Run: func(cmd *cobra.Command, args []string) {
		totalFeeds, _ := db.GetFeedCount()
		totalEntries, _ := db.GetEntryCount()

		var analyzedCount int
		db.DB.QueryRow("SELECT COUNT(*) FROM entries WHERE ai_summary IS NOT NULL AND ai_summary != ''").Scan(&analyzedCount)

		var avgScore float64
		db.DB.QueryRow("SELECT COALESCE(AVG(ai_score), 0) FROM entries WHERE ai_score > 0").Scan(&avgScore)

		var unreadCount int
		db.DB.QueryRow("SELECT COUNT(*) FROM entries WHERE is_read = 0").Scan(&unreadCount)

		var starredCount int
		db.DB.QueryRow("SELECT COUNT(*) FROM entries WHERE is_starred = 1").Scan(&starredCount)

		var ruleCount int
		db.DB.QueryRow("SELECT COUNT(*) FROM rules").Scan(&ruleCount)

		formatter := output.NewFormatter(cfg.Output.Color)
		fmt.Println(formatter.FormatStats(totalFeeds, totalEntries, analyzedCount, avgScore))
		fmt.Printf("\n  Unread:           %d\n", unreadCount)
		fmt.Printf("  Starred:          %d\n", starredCount)
		fmt.Printf("  Active Rules:     %d\n", ruleCount)
	},
}

var statsFeedCmd = &cobra.Command{
	Use:   "feed",
	Short: "Show feed-level statistics",
	Run: func(cmd *cobra.Command, args []string) {
		stats, err := db.GetFeedStats()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error getting feed stats: %v\n", err)
			os.Exit(1)
		}

		formatter := output.NewFormatter(cfg.Output.Color)
		fmt.Println(formatter.FormatFeedStatsList(stats))
	},
}

var statsDailyCmd = &cobra.Command{
	Use:   "daily",
	Short: "Show daily entry trends",
	Run: func(cmd *cobra.Command, args []string) {
		days, _ := cmd.Flags().GetInt("days")

		stats, err := db.GetDailyStats(days)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error getting daily stats: %v\n", err)
			os.Exit(1)
		}

		if len(stats) == 0 {
			fmt.Println("No data available for the specified period.")
			return
		}

		fmt.Printf("Daily Entry Trends (last %d days)\n\n", days)
		formatter := output.NewFormatter(cfg.Output.Color)
		fmt.Println(formatter.FormatDailyStats(stats))
	},
}

var statsTopCmd = &cobra.Command{
	Use:   "top",
	Short: "Show top-scoring entries",
	Run: func(cmd *cobra.Command, args []string) {
		limit, _ := cmd.Flags().GetInt("limit")

		entries, err := db.GetTopEntries(limit)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error getting top entries: %v\n", err)
			os.Exit(1)
		}

		if len(entries) == 0 {
			fmt.Println("No analyzed entries found.")
			return
		}

		formatter := output.NewFormatter(cfg.Output.Color)
		fmt.Println(formatter.FormatEntries(entries))
	},
}

var statsLangCmd = &cobra.Command{
	Use:   "lang",
	Short: "Show programming language statistics",
	Long:  `Show statistics grouped by programming language detected in articles.`,
	Run: func(cmd *cobra.Command, args []string) {
		days, _ := cmd.Flags().GetInt("days")
		trendLang, _ := cmd.Flags().GetString("trend")

		if trendLang != "" {
			// Show daily trend for a specific language
			stats, err := db.GetLanguageTrend(trendLang, days)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error getting language trend: %v\n", err)
				os.Exit(1)
			}
			if len(stats) == 0 {
				fmt.Printf("No articles found for language '%s' in the specified period.\n", trendLang)
				return
			}
			fmt.Printf("Daily Trend for %s (last %d days)\n\n", trendLang, days)
			formatter := output.NewFormatter(cfg.Output.Color)
			fmt.Println(formatter.FormatDailyStats(stats))
			return
		}

		stats, err := db.GetLanguageStats(days)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error getting language stats: %v\n", err)
			os.Exit(1)
		}
		if len(stats) == 0 {
			fmt.Println("No language-tagged articles found.")
			return
		}

		fmt.Printf("Programming Language Statistics")
		if days > 0 {
			fmt.Printf(" (last %d days)", days)
		}
		fmt.Println("\n")
		formatter := output.NewFormatter(cfg.Output.Color)
		fmt.Println(formatter.FormatLanguageStats(stats))
	},
}

func init() {
	statsCmd.AddCommand(statsOverviewCmd)
	statsCmd.AddCommand(statsFeedCmd)
	statsCmd.AddCommand(statsDailyCmd)
	statsCmd.AddCommand(statsTopCmd)
	statsCmd.AddCommand(statsLangCmd)

	statsDailyCmd.Flags().IntP("days", "d", 30, "Number of days to show")
	statsTopCmd.Flags().IntP("limit", "l", 10, "Number of top entries to show")
	statsLangCmd.Flags().IntP("days", "d", 30, "Number of days to show")
	statsLangCmd.Flags().String("trend", "", "Show daily trend for a specific language")

	rootCmd.AddCommand(statsCmd)
}
