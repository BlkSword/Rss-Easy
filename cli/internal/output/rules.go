package output

import (
	"fmt"
	"strings"

	"github.com/olekukonko/tablewriter"
	"github.com/olekukonko/tablewriter/tw"
	"github.com/rss-post/cli/internal/rules"
)

// FormatRules formats a list of rules as a table.
func (f *Formatter) FormatRules(ruleList []*rules.Rule) string {
	if len(ruleList) == 0 {
		return "No rules found."
	}

	var buf strings.Builder
	table := tablewriter.NewTable(&buf,
		tablewriter.WithHeaderAlignment(tw.AlignCenter),
		tablewriter.WithRowAlignment(tw.AlignLeft),
	)
	table.Header("ID", "Name", "Conditions", "Actions", "Matches", "Enabled")

	for _, rule := range ruleList {
		enabled := "Yes"
		if !rule.Enabled {
			enabled = "No"
		}

		condStr := formatConditions(rule.Conditions)
		actionStr := formatActions(rule.Actions)

		table.Append(
			fmt.Sprintf("%d", rule.ID),
			truncate(rule.Name, 25),
			truncate(condStr, 30),
			truncate(actionStr, 25),
			fmt.Sprintf("%d", rule.MatchCount),
			enabled,
		)
	}

	table.Render()
	return buf.String()
}

// FormatRuleLogs formats rule execution logs as a table.
func (f *Formatter) FormatRuleLogs(logs []*rules.RuleLog) string {
	if len(logs) == 0 {
		return "No rule execution history found."
	}

	var buf strings.Builder
	table := tablewriter.NewTable(&buf,
		tablewriter.WithHeaderAlignment(tw.AlignCenter),
		tablewriter.WithRowAlignment(tw.AlignLeft),
	)
	table.Header("ID", "Rule ID", "Entry ID", "Action", "Time")

	for _, log := range logs {
		table.Append(
			fmt.Sprintf("%d", log.ID),
			fmt.Sprintf("%d", log.RuleID),
			fmt.Sprintf("%d", log.EntryID),
			log.Action,
			log.MatchedAt,
		)
	}

	table.Render()
	return buf.String()
}

func formatConditions(conditions []rules.Condition) string {
	if len(conditions) == 0 {
		return "(none)"
	}

	parts := make([]string, len(conditions))
	for i, c := range conditions {
		parts[i] = fmt.Sprintf("%s:%s:%s", c.Type, c.Operator, c.Value)
	}
	return strings.Join(parts, ", ")
}

func formatActions(actions []rules.Action) string {
	if len(actions) == 0 {
		return "(none)"
	}

	parts := make([]string, len(actions))
	for i, a := range actions {
		if a.Value != "" {
			parts[i] = fmt.Sprintf("%s:%s", a.Type, a.Value)
		} else {
			parts[i] = string(a.Type)
		}
	}
	return strings.Join(parts, ", ")
}
