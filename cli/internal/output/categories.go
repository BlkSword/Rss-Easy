package output

import (
	"fmt"
	"strings"

	"github.com/olekukonko/tablewriter"
	"github.com/olekukonko/tablewriter/tw"
	"github.com/rss-post/cli/internal/db"
)

// FormatCategories formats a flat list of categories.
func (f *Formatter) FormatCategories(categories []*db.Category) string {
	if len(categories) == 0 {
		return "No categories found."
	}

	var buf strings.Builder
	table := tablewriter.NewTable(&buf,
		tablewriter.WithHeaderAlignment(tw.AlignCenter),
		tablewriter.WithRowAlignment(tw.AlignLeft),
	)
	table.Header("ID", "Name", "Description", "Parent", "Sort")

	for _, cat := range categories {
		parent := "—"
		if cat.ParentID != nil {
			parent = fmt.Sprintf("%d", *cat.ParentID)
		}

		table.Append(
			fmt.Sprintf("%d", cat.ID),
			cat.Name,
			truncate(cat.Description, 30),
			parent,
			fmt.Sprintf("%d", cat.SortOrder),
		)
	}

	table.Render()
	return buf.String()
}

// FormatCategoryTree formats categories as a tree.
func (f *Formatter) FormatCategoryTree(categories []*db.Category) string {
	if len(categories) == 0 {
		return "No categories found."
	}

	tree := db.BuildCategoryTree(categories)
	var buf strings.Builder

	for _, root := range tree {
		printTreeNode(&buf, root, "")
	}

	return buf.String()
}

func printTreeNode(buf *strings.Builder, node *db.CategoryWithFeeds, indent string) {
	prefix := "├── "
	if indent == "" {
		prefix = ""
	}

	feedCount := len(node.Feeds)
	childCount := len(node.Children)

	buf.WriteString(fmt.Sprintf("%s%s%s (ID: %d", indent, prefix, node.Name, node.ID))
	if feedCount > 0 {
		buf.WriteString(fmt.Sprintf(", %d feeds", feedCount))
	}
	if childCount > 0 {
		buf.WriteString(fmt.Sprintf(", %d children", childCount))
	}
	buf.WriteString(")\n")

	for i, child := range node.Children {
		childIndent := indent + "│   "
		if i == len(node.Children)-1 {
			childIndent = indent + "    "
		}
		printTreeNode(buf, child, childIndent)
	}
}
