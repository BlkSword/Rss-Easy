package cmd

import (
	"fmt"
	"os"
	"strconv"

	"github.com/rss-post/cli/internal/db"
	"github.com/rss-post/cli/internal/output"
	"github.com/spf13/cobra"
)

var entriesCmd = &cobra.Command{
	Use:     "entries",
	Short:   "Manage RSS entries",
	Aliases: []string{"entry", "article", "articles"},
	Long:    `List, view, and manage RSS feed entries (articles).`,
}

var entriesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List entries",
	Run: func(cmd *cobra.Command, args []string) {
		feedID, _ := cmd.Flags().GetInt64("feed")
		starred, _ := cmd.Flags().GetBool("starred")
		unread, _ := cmd.Flags().GetBool("unread")
		aiScoreMin, _ := cmd.Flags().GetInt("min-score")
		limit, _ := cmd.Flags().GetInt("limit")

		filter := &db.EntryFilter{
			Limit:     limit,
			Offset:    0,
			OrderBy:   "published_at",
			OrderDesc: true,
		}

		if feedID > 0 {
			filter.FeedID = &feedID
		}
		if starred {
			filter.Starred = &starred
		}
		if unread {
			filter.Unread = &unread
		}
		if aiScoreMin > 0 {
			filter.AIScoreMin = &aiScoreMin
		}

		entries, err := db.ListEntries(filter)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error listing entries: %v\n", err)
			os.Exit(1)
		}

		formatter := output.NewFormatter(cfg.Output.Color)
		fmt.Println(formatter.FormatEntries(entries))
	},
}

var entriesShowCmd = &cobra.Command{
	Use:   "show <id>",
	Short: "Show entry details",
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

		formatter := output.NewFormatter(cfg.Output.Color)
		fmt.Println(formatter.FormatEntryDetail(entry))
	},
}

var entriesReadCmd = &cobra.Command{
	Use:   "read <id>",
	Short: "Mark entry as read",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		id, err := strconv.ParseInt(args[0], 10, 64)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Invalid entry ID: %v\n", err)
			os.Exit(1)
		}

		err = db.MarkEntryRead(id)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error marking entry as read: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("Entry %d marked as read.\n", id)
	},
}

var entriesUnreadCmd = &cobra.Command{
	Use:   "unread <id>",
	Short: "Mark entry as unread",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		id, err := strconv.ParseInt(args[0], 10, 64)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Invalid entry ID: %v\n", err)
			os.Exit(1)
		}

		// Set is_read to false directly
		_, err = db.DB.Exec("UPDATE entries SET is_read = 0 WHERE id = ?", id)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error marking entry as unread: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("Entry %d marked as unread.\n", id)
	},
}

var entriesStarCmd = &cobra.Command{
	Use:   "star <id>",
	Short: "Star an entry",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		id, err := strconv.ParseInt(args[0], 10, 64)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Invalid entry ID: %v\n", err)
			os.Exit(1)
		}

		err = db.MarkEntryStarred(id, true)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error starring entry: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("Entry %d starred.\n", id)
	},
}

var entriesUnstarCmd = &cobra.Command{
	Use:   "unstar <id>",
	Short: "Unstar an entry",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		id, err := strconv.ParseInt(args[0], 10, 64)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Invalid entry ID: %v\n", err)
			os.Exit(1)
		}

		err = db.MarkEntryStarred(id, false)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error unstarring entry: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("Entry %d unstarred.\n", id)
	},
}

var entriesOpenCmd = &cobra.Command{
	Use:   "open <id>",
	Short: "Open entry URL in browser",
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

		fmt.Println(entry.URL)
	},
}

func init() {
	entriesCmd.AddCommand(entriesListCmd)
	entriesCmd.AddCommand(entriesShowCmd)
	entriesCmd.AddCommand(entriesReadCmd)
	entriesCmd.AddCommand(entriesUnreadCmd)
	entriesCmd.AddCommand(entriesStarCmd)
	entriesCmd.AddCommand(entriesUnstarCmd)
	entriesCmd.AddCommand(entriesOpenCmd)

	entriesListCmd.Flags().Int64P("feed", "f", 0, "Filter by feed ID")
	entriesListCmd.Flags().BoolP("starred", "s", false, "Show only starred entries")
	entriesListCmd.Flags().BoolP("unread", "u", false, "Show only unread entries")
	entriesListCmd.Flags().IntP("min-score", "m", 0, "Minimum AI score")
	entriesListCmd.Flags().IntP("limit", "l", 50, "Maximum number of entries to show")

	rootCmd.AddCommand(entriesCmd)
}
