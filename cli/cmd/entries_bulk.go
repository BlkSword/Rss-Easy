package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/rss-post/cli/internal/db"
	"github.com/spf13/cobra"
)

// Bulk operations for entries
var entriesBulkReadCmd = &cobra.Command{
	Use:   "bulk-read <ids>",
	Short: "Bulk mark entries as read",
	Long:  `Mark multiple entries as read. Use comma-separated IDs or --all for all unread entries.`,
	Args:  cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		all, _ := cmd.Flags().GetBool("all")

		if all {
			result, err := db.DB.Exec(`UPDATE entries SET is_read = 1 WHERE is_read = 0`)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error: %v\n", err)
				os.Exit(1)
			}
			affected, _ := result.RowsAffected()
			// Update feed unread counts
			db.DB.Exec(`UPDATE feeds SET unread_count = (SELECT COUNT(*) FROM entries WHERE feed_id = feeds.id AND is_read = 0)`)
			fmt.Printf("Marked %d entries as read.\n", affected)
			return
		}

		if len(args) == 0 {
			fmt.Fprintf(os.Stderr, "Error: provide entry IDs or use --all\n")
			os.Exit(1)
		}

		ids := parseIDs(args[0])
		successCount := 0
		for _, id := range ids {
			err := db.MarkEntryRead(id)
			if err != nil {
				fmt.Fprintf(os.Stderr, "  ✗ Entry %d: %v\n", id, err)
			} else {
				successCount++
			}
		}
		fmt.Printf("Marked %d/%d entries as read.\n", successCount, len(ids))
	},
}

var entriesBulkStarCmd = &cobra.Command{
	Use:   "bulk-star <ids>",
	Short: "Bulk star entries",
	Long:  `Star multiple entries. Use comma-separated IDs.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		unstar, _ := cmd.Flags().GetBool("unstar")

		ids := parseIDs(args[0])
		successCount := 0
		for _, id := range ids {
			err := db.MarkEntryStarred(id, !unstar)
			if err != nil {
				fmt.Fprintf(os.Stderr, "  ✗ Entry %d: %v\n", id, err)
			} else {
				successCount++
			}
		}

		action := "starred"
		if unstar {
			action = "unstarred"
		}
		fmt.Printf("%s %d/%d entries.\n", action, successCount, len(ids))
	},
}

var entriesBulkDeleteCmd = &cobra.Command{
	Use:   "bulk-delete <ids>",
	Short: "Bulk soft-delete entries",
	Long:  `Soft-delete multiple entries. Use comma-separated IDs. Deleted entries are hidden from listings.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		ids := parseIDs(args[0])
		successCount := 0

		for _, id := range ids {
			_, err := db.DB.Exec(`UPDATE entries SET deleted = 1 WHERE id = ?`, id)
			if err != nil {
				fmt.Fprintf(os.Stderr, "  ✗ Entry %d: %v\n", id, err)
			} else {
				successCount++
			}
		}
		fmt.Printf("Soft-deleted %d/%d entries.\n", successCount, len(ids))
	},
}

var entriesBulkTagCmd = &cobra.Command{
	Use:   "bulk-tag <ids>",
	Short: "Bulk add tags to entries",
	Long:  `Add a tag to multiple entries. Use comma-separated IDs and specify --tag.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		tag, _ := cmd.Flags().GetString("tag")
		if tag == "" {
			fmt.Fprintf(os.Stderr, "Error: --tag is required\n")
			os.Exit(1)
		}

		remove, _ := cmd.Flags().GetBool("remove")
		ids := parseIDs(args[0])
		successCount := 0

		for _, id := range ids {
			entry, err := db.GetEntry(id)
			if err != nil {
				fmt.Fprintf(os.Stderr, "  ✗ Entry %d: %v\n", id, err)
				continue
			}

			var keywords []string
			if entry.AIKeywords != "" {
				_ = json.Unmarshal([]byte(entry.AIKeywords), &keywords)
			}

			if remove {
				var filtered []string
				for _, kw := range keywords {
					if !strings.EqualFold(kw, tag) {
						filtered = append(filtered, kw)
					}
				}
				keywords = filtered
			} else {
				// Check if already tagged
				exists := false
				for _, kw := range keywords {
					if strings.EqualFold(kw, tag) {
						exists = true
						break
					}
				}
				if !exists {
					keywords = append(keywords, tag)
				}
			}

			data, _ := json.Marshal(keywords)
			_, err = db.DB.Exec(`UPDATE entries SET ai_keywords = ? WHERE id = ?`, string(data), id)
			if err != nil {
				fmt.Fprintf(os.Stderr, "  ✗ Entry %d: %v\n", id, err)
			} else {
				successCount++
			}
		}

		action := "Added tag"
		if remove {
			action = "Removed tag"
		}
		fmt.Printf("%s '%s' to %d/%d entries.\n", action, tag, successCount, len(ids))
	},
}

var entriesArchiveCmd = &cobra.Command{
	Use:   "archive <id>",
	Short: "Archive an entry",
	Long:  `Archive an entry (soft archive, hidden from normal listings). Use --unarchive to restore.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		id, err := strconv.ParseInt(args[0], 10, 64)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Invalid entry ID: %v\n", err)
			os.Exit(1)
		}

		unarchive, _ := cmd.Flags().GetBool("unarchive")
		archived := !unarchive

		_, err = db.DB.Exec(`UPDATE entries SET archived = ? WHERE id = ?`, archived, id)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}

		if archived {
			fmt.Printf("Entry %d archived.\n", id)
		} else {
			fmt.Printf("Entry %d unarchived.\n", id)
		}
	},
}

func parseIDs(s string) []int64 {
	parts := strings.Split(s, ",")
	var ids []int64
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		id, err := strconv.ParseInt(p, 10, 64)
		if err == nil {
			ids = append(ids, id)
		}
	}
	return ids
}

// Add bulk commands to entries command in init
func addBulkCommands() {
	entriesCmd.AddCommand(entriesBulkReadCmd)
	entriesCmd.AddCommand(entriesBulkStarCmd)
	entriesCmd.AddCommand(entriesBulkDeleteCmd)
	entriesCmd.AddCommand(entriesBulkTagCmd)
	entriesCmd.AddCommand(entriesArchiveCmd)

	entriesBulkReadCmd.Flags().Bool("all", false, "Mark all unread entries as read")
	entriesBulkStarCmd.Flags().Bool("unstar", false, "Unstar instead of star")
	entriesBulkTagCmd.Flags().String("tag", "", "Tag to add")
	entriesBulkTagCmd.Flags().Bool("remove", false, "Remove tag instead of adding")
	entriesArchiveCmd.Flags().Bool("unarchive", false, "Unarchive the entry")
}
