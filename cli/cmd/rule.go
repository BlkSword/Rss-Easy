package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/rss-post/cli/internal/output"
	"github.com/rss-post/cli/internal/rules"
	"github.com/spf13/cobra"
)

var ruleCmd = &cobra.Command{
	Use:   "rule",
	Short: "Manage automation rules",
	Long:  `Create, list, test, and manage automation rules for RSS entries.`,
}

var ruleListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all rules",
	Run: func(cmd *cobra.Command, args []string) {
		enabledOnly, _ := cmd.Flags().GetBool("enabled-only")

		ruleList, err := rules.ListRules(enabledOnly)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error listing rules: %v\n", err)
			os.Exit(1)
		}

		if len(ruleList) == 0 {
			fmt.Println("No rules found.")
			return
		}

		formatter := output.NewFormatter(cfg.Output.Color)
		fmt.Println(formatter.FormatRules(ruleList))
	},
}

var ruleAddCmd = &cobra.Command{
	Use:   "add <name>",
	Short: "Create a new rule",
	Long: `Create a new automation rule with conditions and actions.

Conditions (--condition / -c, can be specified multiple times):
  keyword:contains:AI       - Title/summary/content contains "AI"
  keyword:not_contains:spam - Does not contain "spam"
  tag:equals:security       - Has tag "security"
  score:gte:7               - AI score >= 7
  feed:equals:5             - From feed ID 5

Actions (--action / -a, can be specified multiple times):
  mark_read                 - Mark as read
  star                      - Star the entry
  add_tag:AI                - Add tag "AI"
  remove_tag:old            - Remove tag "old"

Examples:
  rss-post rule add "AI Articles" -c "keyword:contains:AI" -a "star" -a "add_tag:AI"
  rss-post rule add "Low Quality" -c "score:lt:4" -a "mark_read"
  rss-post rule add "Security Feed" -c "feed:equals:3" -c "tag:equals:security" -a "star"`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		name := args[0]
		description, _ := cmd.Flags().GetString("description")
		conditionStrs, _ := cmd.Flags().GetStringArray("condition")
		actionStrs, _ := cmd.Flags().GetStringArray("action")
		priority, _ := cmd.Flags().GetInt("priority")

		if len(conditionStrs) == 0 {
			fmt.Fprintf(os.Stderr, "Error: at least one condition is required (--condition)\n")
			os.Exit(1)
		}
		if len(actionStrs) == 0 {
			fmt.Fprintf(os.Stderr, "Error: at least one action is required (--action)\n")
			os.Exit(1)
		}

		var conditions []rules.Condition
		for _, cs := range conditionStrs {
			cond, err := parseCondition(cs)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error parsing condition '%s': %v\n", cs, err)
				os.Exit(1)
			}
			conditions = append(conditions, cond)
		}

		var actions []rules.Action
		for _, as := range actionStrs {
			action, err := parseAction(as)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error parsing action '%s': %v\n", as, err)
				os.Exit(1)
			}
			actions = append(actions, action)
		}

		rule := &rules.Rule{
			Name:        name,
			Description: description,
			Enabled:     true,
			Conditions:  conditions,
			Actions:     actions,
			Priority:    priority,
		}

		created, err := rules.CreateRule(rule)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error creating rule: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("Rule created successfully! (ID: %d)\n", created.ID)
		fmt.Printf("  Name:        %s\n", created.Name)
		fmt.Printf("  Conditions:  %d\n", len(conditions))
		fmt.Printf("  Actions:     %d\n", len(actions))
		fmt.Printf("  Priority:    %d\n", priority)
	},
}

var ruleDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a rule",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		id, err := strconv.ParseInt(args[0], 10, 64)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Invalid rule ID: %v\n", err)
			os.Exit(1)
		}

		rule, err := rules.GetRule(id)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Rule %d not found: %v\n", id, err)
			os.Exit(1)
		}

		fmt.Printf("Deleting rule: %s (ID: %d)\n", rule.Name, rule.ID)
		err = rules.DeleteRule(id)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error deleting rule: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Rule deleted successfully.")
	},
}

var ruleToggleCmd = &cobra.Command{
	Use:   "toggle <id>",
	Short: "Enable/disable a rule",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		id, err := strconv.ParseInt(args[0], 10, 64)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Invalid rule ID: %v\n", err)
			os.Exit(1)
		}

		newState, err := rules.ToggleRule(id)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error toggling rule: %v\n", err)
			os.Exit(1)
		}

		stateStr := "disabled"
		if newState {
			stateStr = "enabled"
		}
		fmt.Printf("Rule %d %s.\n", id, stateStr)
	},
}

var ruleTestCmd = &cobra.Command{
	Use:   "test <id>",
	Short: "Test a rule against existing entries",
	Long:  `Test a rule against existing entries to see which ones would match.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		id, err := strconv.ParseInt(args[0], 10, 64)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Invalid rule ID: %v\n", err)
			os.Exit(1)
		}

		limit, _ := cmd.Flags().GetInt("limit")

		rule, err := rules.GetRule(id)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Rule %d not found: %v\n", id, err)
			os.Exit(1)
		}

		matched, err := rules.TestRule(rule, limit)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error testing rule: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("Rule: %s\n", rule.Name)
		fmt.Printf("Matched %d entries (out of %d checked)\n\n", len(matched), limit)

		if len(matched) > 0 {
			for _, entry := range matched {
				fmt.Printf("  [%d] %s (Score: %d)\n", entry.ID, truncateStr(entry.Title, 60), entry.AIScore)
			}
		}
	},
}

var ruleApplyCmd = &cobra.Command{
	Use:   "apply [id]",
	Short: "Apply rules to entries",
	Long:  `Apply rules to existing entries. If an ID is given, apply that specific rule. Otherwise, apply all enabled rules.`,
	Args:  cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		limit, _ := cmd.Flags().GetInt("limit")
		dryRun, _ := cmd.Flags().GetBool("dry-run")

		if dryRun {
			fmt.Println("Dry run mode — no changes will be made.")
		}

		if len(args) > 0 {
			id, err := strconv.ParseInt(args[0], 10, 64)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Invalid rule ID: %v\n", err)
				os.Exit(1)
			}

			rule, err := rules.GetRule(id)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Rule %d not found: %v\n", id, err)
				os.Exit(1)
			}

			matched, err := rules.TestRule(rule, limit)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error testing rule: %v\n", err)
				os.Exit(1)
			}

			fmt.Printf("Rule '%s': %d entries matched\n", rule.Name, len(matched))

			if !dryRun {
				engine := rules.NewEngine()
				for _, entry := range matched {
					_, err := engine.ExecuteRule(rule, entry)
					if err != nil {
						fmt.Printf("  ✗ Entry %d: %v\n", entry.ID, err)
					} else {
						fmt.Printf("  ✓ Entry %d: %s\n", entry.ID, truncateStr(entry.Title, 50))
					}
				}
			}
		} else {
			totalApplied, err := rules.ApplyAllRules(limit)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error applying rules: %v\n", err)
				os.Exit(1)
			}
			fmt.Printf("Applied rules to %d entries (%d total actions executed).\n", limit, totalApplied)
		}
	},
}

var ruleHistoryCmd = &cobra.Command{
	Use:   "history [rule-id]",
	Short: "Show rule execution history",
	Long:  `Show rule execution history. Optionally filter by rule ID.`,
	Args:  cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		var ruleID int64
		if len(args) > 0 {
			var err error
			ruleID, err = strconv.ParseInt(args[0], 10, 64)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Invalid rule ID: %v\n", err)
				os.Exit(1)
			}
		}

		limit, _ := cmd.Flags().GetInt("limit")

		logs, err := rules.GetRuleLogs(ruleID, limit)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error getting rule history: %v\n", err)
			os.Exit(1)
		}

		if len(logs) == 0 {
			fmt.Println("No rule execution history found.")
			return
		}

		formatter := output.NewFormatter(cfg.Output.Color)
		fmt.Println(formatter.FormatRuleLogs(logs))
	},
}

func parseCondition(s string) (rules.Condition, error) {
	parts := strings.SplitN(s, ":", 3)
	if len(parts) < 3 {
		return rules.Condition{}, fmt.Errorf("invalid condition format (expected type:operator:value)")
	}

	condType := rules.ConditionType(parts[0])
	operator := rules.ConditionOperator(parts[1])
	value := parts[2]

	// Validate
	switch condType {
	case rules.ConditionKeyword, rules.ConditionTag:
		switch operator {
		case rules.OperatorContains, rules.OperatorNotContains, rules.OperatorEquals,
			rules.OperatorStartsWith, rules.OperatorEndsWith:
		default:
			return rules.Condition{}, fmt.Errorf("unsupported operator '%s' for condition type '%s'", operator, condType)
		}
	case rules.ConditionScore:
		switch operator {
		case rules.OperatorGT, rules.OperatorGTE, rules.OperatorLT, rules.OperatorLTE, rules.OperatorEquals:
		default:
			return rules.Condition{}, fmt.Errorf("unsupported operator '%s' for score condition", operator)
		}
		// Validate value is numeric
		if _, err := strconv.Atoi(value); err != nil {
			return rules.Condition{}, fmt.Errorf("score condition value must be a number, got '%s'", value)
		}
	case rules.ConditionFeed:
		if _, err := strconv.ParseInt(value, 10, 64); err != nil {
			return rules.Condition{}, fmt.Errorf("feed condition value must be a feed ID number, got '%s'", value)
		}
	default:
		return rules.Condition{}, fmt.Errorf("unknown condition type: '%s' (valid: keyword, tag, score, feed)", condType)
	}

	return rules.Condition{
		Type:     condType,
		Value:    value,
		Operator: operator,
	}, nil
}

func parseAction(s string) (rules.Action, error) {
	parts := strings.SplitN(s, ":", 2)
	actionType := rules.ActionType(parts[0])

	switch actionType {
	case rules.ActionMarkRead, rules.ActionStar:
		if len(parts) > 1 && parts[1] != "" {
			return rules.Action{}, fmt.Errorf("action '%s' does not take a value", actionType)
		}
		return rules.Action{Type: actionType}, nil
	case rules.ActionAddTag, rules.ActionRemoveTag:
		if len(parts) < 2 || parts[1] == "" {
			return rules.Action{}, fmt.Errorf("action '%s' requires a value (e.g., %s:tagname)", actionType, actionType)
		}
		return rules.Action{Type: actionType, Value: parts[1]}, nil
	case rules.ActionMoveCategory:
		if len(parts) < 2 || parts[1] == "" {
			return rules.Action{}, fmt.Errorf("action '%s' requires a category ID", actionType)
		}
		return rules.Action{Type: actionType, Value: parts[1]}, nil
	default:
		return rules.Action{}, fmt.Errorf("unknown action type: '%s' (valid: mark_read, star, add_tag, remove_tag, move_category)", actionType)
	}
}

func truncateStr(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

func init() {
	ruleCmd.AddCommand(ruleListCmd)
	ruleCmd.AddCommand(ruleAddCmd)
	ruleCmd.AddCommand(ruleDeleteCmd)
	ruleCmd.AddCommand(ruleToggleCmd)
	ruleCmd.AddCommand(ruleTestCmd)
	ruleCmd.AddCommand(ruleApplyCmd)
	ruleCmd.AddCommand(ruleHistoryCmd)

	ruleListCmd.Flags().Bool("enabled-only", false, "Show only enabled rules")
	ruleAddCmd.Flags().StringP("description", "d", "", "Rule description")
	ruleAddCmd.Flags().StringArrayP("condition", "c", nil, "Condition (type:operator:value)")
	ruleAddCmd.Flags().StringArrayP("action", "a", nil, "Action (type[:value])")
	ruleAddCmd.Flags().IntP("priority", "p", 0, "Rule priority (higher = executed first)")
	ruleTestCmd.Flags().IntP("limit", "l", 100, "Maximum entries to test against")
	ruleApplyCmd.Flags().IntP("limit", "l", 500, "Maximum entries to apply rules to")
	ruleApplyCmd.Flags().Bool("dry-run", false, "Show what would happen without making changes")
	ruleHistoryCmd.Flags().IntP("limit", "l", 50, "Maximum log entries to show")

	rootCmd.AddCommand(ruleCmd)
}

var _ = json.Marshal // ensure import
