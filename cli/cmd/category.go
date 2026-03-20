package cmd

import (
	"fmt"
	"os"
	"strconv"

	"github.com/rss-post/cli/internal/db"
	"github.com/rss-post/cli/internal/output"
	"github.com/spf13/cobra"
)

var categoryCmd = &cobra.Command{
	Use:   "category",
	Short: "Manage feed categories",
	Long:  `Create, list, and manage feed categories for organizing RSS feeds.`,
}

var categoryListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all categories",
	Run: func(cmd *cobra.Command, args []string) {
		tree, _ := cmd.Flags().GetBool("tree")

		categories, err := db.ListAllCategories()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error listing categories: %v\n", err)
			os.Exit(1)
		}

		if len(categories) == 0 {
			fmt.Println("No categories found.")
			return
		}

		formatter := output.NewFormatter(cfg.Output.Color)
		if tree {
			fmt.Println(formatter.FormatCategoryTree(categories))
		} else {
			fmt.Println(formatter.FormatCategories(categories))
		}
	},
}

var categoryAddCmd = &cobra.Command{
	Use:   "add <name>",
	Short: "Create a new category",
	Long:  `Create a new category. Optionally specify a parent category.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		name := args[0]
		description, _ := cmd.Flags().GetString("description")
		parentStr, _ := cmd.Flags().GetString("parent")

		var parentID *int64
		if parentStr != "" {
			pid, err := strconv.ParseInt(parentStr, 10, 64)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Invalid parent ID: %v\n", err)
				os.Exit(1)
			}
			parentID = &pid
		}

		cat, err := db.CreateCategory(name, description, parentID)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error creating category: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("Category created! (ID: %d)\n", cat.ID)
		fmt.Printf("  Name: %s\n", cat.Name)
		if parentID != nil {
			fmt.Printf("  Parent: %d\n", *parentID)
		}
	},
}

var categoryRenameCmd = &cobra.Command{
	Use:   "rename <id> <name>",
	Short: "Rename a category",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		id, err := strconv.ParseInt(args[0], 10, 64)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Invalid category ID: %v\n", err)
			os.Exit(1)
		}
		name := args[1]

		err = db.RenameCategory(id, name)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error renaming category: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Category %d renamed to '%s'.\n", id, name)
	},
}

var categoryDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a category",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		id, err := strconv.ParseInt(args[0], 10, 64)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Invalid category ID: %v\n", err)
			os.Exit(1)
		}

		cat, err := db.GetCategory(id)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Category %d not found: %v\n", id, err)
			os.Exit(1)
		}

		fmt.Printf("Deleting category: %s (ID: %d)\n", cat.Name, cat.ID)
		err = db.DeleteCategory(id)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error deleting category: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Category deleted successfully.")
	},
}

var categoryMoveCmd = &cobra.Command{
	Use:   "move <id>",
	Short: "Move a category to a new parent",
	Long:  `Move a category under a new parent. Use --parent 0 to move to root.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		id, err := strconv.ParseInt(args[0], 10, 64)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Invalid category ID: %v\n", err)
			os.Exit(1)
		}

		parentStr, _ := cmd.Flags().GetString("parent")
		if parentStr == "" {
			fmt.Fprintf(os.Stderr, "Error: --parent is required\n")
			os.Exit(1)
		}

		var parentID *int64
		if parentStr != "0" {
			pid, err := strconv.ParseInt(parentStr, 10, 64)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Invalid parent ID: %v\n", err)
				os.Exit(1)
			}
			parentID = &pid
		}

		err = db.MoveCategory(id, parentID)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error moving category: %v\n", err)
			os.Exit(1)
		}

		if parentID == nil {
			fmt.Printf("Category %d moved to root.\n", id)
		} else {
			fmt.Printf("Category %d moved under parent %d.\n", id, *parentID)
		}
	},
}

var categoryFeedCmd = &cobra.Command{
	Use:   "feed <category-id>",
	Short: "Manage feed-category relationships",
	Long: `Add or remove feeds from a category.

Examples:
  rss-post category feed 1 --add 5 --add 10
  rss-post category feed 1 --remove 5`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		categoryID, err := strconv.ParseInt(args[0], 10, 64)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Invalid category ID: %v\n", err)
			os.Exit(1)
		}

		addStrs, _ := cmd.Flags().GetStringArray("add")
		removeStrs, _ := cmd.Flags().GetStringArray("remove")

		if len(addStrs) == 0 && len(removeStrs) == 0 {
			// Just list feeds in category
			feeds, err := db.GetCategoryFeeds(categoryID)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error getting feeds: %v\n", err)
				os.Exit(1)
			}

			if len(feeds) == 0 {
				fmt.Println("No feeds in this category.")
				return
			}

			formatter := output.NewFormatter(cfg.Output.Color)
			fmt.Println(formatter.FormatFeeds(feeds))
			return
		}

		for _, feedStr := range addStrs {
			feedID, err := strconv.ParseInt(feedStr, 10, 64)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Invalid feed ID '%s': %v\n", feedStr, err)
				continue
			}
			err = db.AddFeedToCategory(feedID, categoryID)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error adding feed %d: %v\n", feedID, err)
			} else {
				fmt.Printf("✓ Added feed %d to category %d\n", feedID, categoryID)
			}
		}

		for _, feedStr := range removeStrs {
			feedID, err := strconv.ParseInt(feedStr, 10, 64)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Invalid feed ID '%s': %v\n", feedStr, err)
				continue
			}
			err = db.RemoveFeedFromCategory(feedID, categoryID)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error removing feed %d: %v\n", feedID, err)
			} else {
				fmt.Printf("✓ Removed feed %d from category %d\n", feedID, categoryID)
			}
		}
	},
}

func init() {
	categoryCmd.AddCommand(categoryListCmd)
	categoryCmd.AddCommand(categoryAddCmd)
	categoryCmd.AddCommand(categoryRenameCmd)
	categoryCmd.AddCommand(categoryDeleteCmd)
	categoryCmd.AddCommand(categoryMoveCmd)
	categoryCmd.AddCommand(categoryFeedCmd)

	categoryListCmd.Flags().Bool("tree", false, "Show categories as a tree")
	categoryAddCmd.Flags().StringP("description", "d", "", "Category description")
	categoryAddCmd.Flags().String("parent", "", "Parent category ID (omit for root)")
	categoryMoveCmd.Flags().String("parent", "", "New parent category ID (0 for root)")
	categoryFeedCmd.Flags().StringArray("add", nil, "Feed IDs to add (comma-separated)")
	categoryFeedCmd.Flags().StringArray("remove", nil, "Feed IDs to remove (comma-separated)")

	rootCmd.AddCommand(categoryCmd)
}
