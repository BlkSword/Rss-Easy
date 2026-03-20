package rules

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/rss-post/cli/internal/db"
)

// Engine handles rule matching and execution.
type Engine struct{}

// NewEngine creates a new rule engine.
func NewEngine() *Engine {
	return &Engine{}
}

// MatchEntry checks if an entry matches a rule's conditions.
func (e *Engine) MatchEntry(rule *Rule, entry *db.Entry) bool {
	if !rule.Enabled || len(rule.Conditions) == 0 {
		return false
	}

	for _, cond := range rule.Conditions {
		if !e.evaluateCondition(cond, entry) {
			return false
		}
	}
	return true
}

func (e *Engine) evaluateCondition(cond Condition, entry *db.Entry) bool {
	switch cond.Type {
	case ConditionKeyword:
		return e.matchKeyword(cond, entry.Title, entry.Summary, entry.Content)
	case ConditionTag:
		return e.matchTag(cond, entry.AIKeywords)
	case ConditionScore:
		return e.matchScore(cond, entry.AIScore)
	case ConditionFeed:
		return e.matchFeed(cond, entry.FeedID)
	default:
		return false
	}
}

func (e *Engine) matchKeyword(cond Condition, title, summary, content string) bool {
	text := strings.ToLower(title + " " + summary + " " + content)
	value := strings.ToLower(cond.Value)

	switch cond.Operator {
	case OperatorContains:
		return strings.Contains(text, value)
	case OperatorNotContains:
		return !strings.Contains(text, value)
	case OperatorEquals:
		return strings.EqualFold(title, cond.Value) || strings.EqualFold(summary, cond.Value)
	case OperatorStartsWith:
		return strings.HasPrefix(text, value)
	case OperatorEndsWith:
		return strings.HasSuffix(text, value)
	default:
		return strings.Contains(text, value)
	}
}

func (e *Engine) matchTag(cond Condition, keywordsJSON string) bool {
	if keywordsJSON == "" {
		return false
	}

	var keywords []string
	if err := json.Unmarshal([]byte(keywordsJSON), &keywords); err != nil {
		return false
	}

	value := strings.ToLower(cond.Value)
	for _, kw := range keywords {
		switch cond.Operator {
		case OperatorEquals:
			if strings.EqualFold(kw, cond.Value) {
				return true
			}
		case OperatorContains:
			if strings.Contains(strings.ToLower(kw), value) {
				return true
			}
		default:
			if strings.EqualFold(kw, cond.Value) {
				return true
			}
		}
	}
	return false
}

func (e *Engine) matchScore(cond Condition, score int) bool {
	threshold := 0
	fmt.Sscanf(cond.Value, "%d", &threshold)

	switch cond.Operator {
	case OperatorGT:
		return score > threshold
	case OperatorGTE:
		return score >= threshold
	case OperatorLT:
		return score < threshold
	case OperatorLTE:
		return score <= threshold
	case OperatorEquals:
		return score == threshold
	default:
		return score >= threshold
	}
}

func (e *Engine) matchFeed(cond Condition, feedID int64) bool {
	var targetFeedID int64
	fmt.Sscanf(cond.Value, "%d", &targetFeedID)

	switch cond.Operator {
	case OperatorEquals:
		return feedID == targetFeedID
	default:
		return feedID == targetFeedID
	}
}

// ExecuteRule executes all actions for a matched entry.
func (e *Engine) ExecuteRule(rule *Rule, entry *db.Entry) ([]string, error) {
	var executedActions []string
	now := time.Now().Format("2006-01-02 15:04:05")

	for _, action := range rule.Actions {
		var err error
		switch action.Type {
		case ActionMarkRead:
			err = db.MarkEntryRead(entry.ID)
		case ActionStar:
			err = db.MarkEntryStarred(entry.ID, true)
		case ActionAddTag:
			err = e.addTagToEntry(entry, action.Value)
		case ActionRemoveTag:
			err = e.removeTagFromEntry(entry, action.Value)
		case ActionMoveCategory:
			// Category assignment stored in feed_categories or entry-level
			// For now we log it
		}

		if err != nil {
			return executedActions, fmt.Errorf("action %s failed: %w", action.Type, err)
		}

		executedActions = append(executedActions, string(action.Type))

		// Log the action
		_, _ = db.DB.Exec(
			`INSERT INTO rule_logs (rule_id, entry_id, action, matched_at) VALUES (?, ?, ?, ?)`,
			rule.ID, entry.ID, string(action.Type), now,
		)
	}

	// Update rule stats
	_, _ = db.DB.Exec(
		`UPDATE rules SET match_count = match_count + 1, last_matched_at = ?, updated_at = ? WHERE id = ?`,
		now, now, rule.ID,
	)

	return executedActions, nil
}

func (e *Engine) addTagToEntry(entry *db.Entry, tag string) error {
	var keywords []string
	if entry.AIKeywords != "" {
		if err := json.Unmarshal([]byte(entry.AIKeywords), &keywords); err != nil {
			keywords = nil
		}
	}

	// Check if tag already exists
	for _, kw := range keywords {
		if strings.EqualFold(kw, tag) {
			return nil // already tagged
		}
	}

	keywords = append(keywords, tag)
	data, err := json.Marshal(keywords)
	if err != nil {
		return err
	}

	_, err = db.DB.Exec("UPDATE entries SET ai_keywords = ? WHERE id = ?", string(data), entry.ID)
	return err
}

func (e *Engine) removeTagFromEntry(entry *db.Entry, tag string) error {
	if entry.AIKeywords == "" {
		return nil
	}

	var keywords []string
	if err := json.Unmarshal([]byte(entry.AIKeywords), &keywords); err != nil {
		return err
	}

	var filtered []string
	for _, kw := range keywords {
		if !strings.EqualFold(kw, tag) {
			filtered = append(filtered, kw)
		}
	}

	data, err := json.Marshal(filtered)
	if err != nil {
		return err
	}

	_, err = db.DB.Exec("UPDATE entries SET ai_keywords = ? WHERE id = ?", string(data), entry.ID)
	return err
}

// ApplyRules applies all enabled rules to a single entry.
func (e *Engine) ApplyRules(entry *db.Entry) (int, error) {
	rules, err := ListRules(true)
	if err != nil {
		return 0, err
	}

	appliedCount := 0
	for _, rule := range rules {
		if e.MatchEntry(rule, entry) {
			_, err := e.ExecuteRule(rule, entry)
			if err != nil {
				fmt.Printf("Warning: rule %d (%s) failed: %v\n", rule.ID, rule.Name, err)
				continue
			}
			appliedCount++
		}
	}

	return appliedCount, nil
}

// ListRules lists rules from the database.
func ListRules(enabledOnly bool) ([]*Rule, error) {
	query := `SELECT id, name, COALESCE(description, ''), enabled, COALESCE(conditions, '[]'), COALESCE(actions, '[]'),
	          priority, match_count, last_matched_at, created_at, updated_at FROM rules`
	if enabledOnly {
		query += " WHERE enabled = 1"
	}
	query += " ORDER BY priority DESC, id ASC"

	rows, err := db.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []*Rule
	for rows.Next() {
		rule := &Rule{}
		var conditionsJSON, actionsJSON string
		err := rows.Scan(
			&rule.ID, &rule.Name, &rule.Description, &rule.Enabled,
			&conditionsJSON, &actionsJSON,
			&rule.Priority, &rule.MatchCount, &rule.LastMatchedAt,
			&rule.CreatedAt, &rule.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		rule.Conditions, _ = ParseConditions(conditionsJSON)
		rule.Actions, _ = ParseActions(actionsJSON)
		rules = append(rules, rule)
	}

	return rules, nil
}

// GetRule gets a rule by ID.
func GetRule(id int64) (*Rule, error) {
	rule := &Rule{}
	var conditionsJSON, actionsJSON string
	err := db.DB.QueryRow(
		`SELECT id, name, COALESCE(description, ''), enabled, COALESCE(conditions, '[]'), COALESCE(actions, '[]'),
		 priority, match_count, last_matched_at, created_at, updated_at FROM rules WHERE id = ?`, id,
	).Scan(
		&rule.ID, &rule.Name, &rule.Description, &rule.Enabled,
		&conditionsJSON, &actionsJSON,
		&rule.Priority, &rule.MatchCount, &rule.LastMatchedAt,
		&rule.CreatedAt, &rule.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	rule.Conditions, _ = ParseConditions(conditionsJSON)
	rule.Actions, _ = ParseActions(actionsJSON)
	return rule, nil
}

// CreateRule creates a new rule.
func CreateRule(rule *Rule) (*Rule, error) {
	conditionsJSON, err := SerializeConditions(rule.Conditions)
	if err != nil {
		return nil, fmt.Errorf("invalid conditions: %w", err)
	}
	actionsJSON, err := SerializeActions(rule.Actions)
	if err != nil {
		return nil, fmt.Errorf("invalid actions: %w", err)
	}

	result, err := db.DB.Exec(
		`INSERT INTO rules (name, description, enabled, conditions, actions, priority, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		rule.Name, rule.Description, rule.Enabled, conditionsJSON, actionsJSON, rule.Priority,
	)
	if err != nil {
		return nil, err
	}

	id, _ := result.LastInsertId()
	rule.ID = id
	return rule, nil
}

// DeleteRule deletes a rule by ID.
func DeleteRule(id int64) error {
	_, err := db.DB.Exec("DELETE FROM rule_logs WHERE rule_id = ?", id)
	if err != nil {
		return err
	}
	_, err = db.DB.Exec("DELETE FROM rules WHERE id = ?", id)
	return err
}

// ToggleRule toggles a rule's enabled state.
func ToggleRule(id int64) (bool, error) {
	var enabled bool
	err := db.DB.QueryRow("SELECT enabled FROM rules WHERE id = ?", id).Scan(&enabled)
	if err != nil {
		return false, err
	}

	newState := !enabled
	_, err = db.DB.Exec("UPDATE rules SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", newState, id)
	if err != nil {
		return false, err
	}

	return newState, nil
}

// GetRuleLogs returns execution logs for rules.
func GetRuleLogs(ruleID int64, limit int) ([]*RuleLog, error) {
	if limit == 0 {
		limit = 50
	}

	query := `SELECT id, rule_id, entry_id, COALESCE(action, ''), matched_at FROM rule_logs`
	var args []interface{}
	if ruleID > 0 {
		query += " WHERE rule_id = ?"
		args = append(args, ruleID)
	}
	query += " ORDER BY matched_at DESC LIMIT ?"
	args = append(args, limit)

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []*RuleLog
	for rows.Next() {
		log := &RuleLog{}
		err := rows.Scan(&log.ID, &log.RuleID, &log.EntryID, &log.Action, &log.MatchedAt)
		if err != nil {
			return nil, err
		}
		logs = append(logs, log)
	}

	return logs, nil
}

// TestRule tests a rule against existing entries and returns match count.
func TestRule(rule *Rule, limit int) ([]*db.Entry, error) {
	if limit == 0 {
		limit = 100
	}

	entries, err := db.ListEntries(&db.EntryFilter{
		Limit:     limit,
		OrderBy:   "published_at",
		OrderDesc: true,
	})
	if err != nil {
		return nil, err
	}

	engine := NewEngine()
	var matched []*db.Entry
	for _, entry := range entries {
		if engine.MatchEntry(rule, entry) {
			matched = append(matched, entry)
		}
	}

	return matched, nil
}

// ApplyAllRules applies all enabled rules to all entries.
func ApplyAllRules(limit int) (int, error) {
	if limit == 0 {
		limit = 500
	}

	entries, err := db.ListEntries(&db.EntryFilter{
		Limit:     limit,
		OrderBy:   "published_at",
		OrderDesc: true,
	})
	if err != nil {
		return 0, err
	}

	engine := NewEngine()
	totalApplied := 0

	for _, entry := range entries {
		count, err := engine.ApplyRules(entry)
		if err != nil {
			continue
		}
		totalApplied += count
	}

	return totalApplied, nil
}

// EnsureTables creates rules-related tables if they don't exist.
func EnsureTables() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS rules (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			description TEXT,
			enabled BOOLEAN DEFAULT 1,
			conditions TEXT,
			actions TEXT,
			priority INTEGER DEFAULT 0,
			match_count INTEGER DEFAULT 0,
			last_matched_at DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS rule_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			rule_id INTEGER NOT NULL,
			entry_id INTEGER NOT NULL,
			action TEXT,
			matched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (rule_id) REFERENCES rules(id),
			FOREIGN KEY (entry_id) REFERENCES entries(id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_rule_logs_rule_id ON rule_logs(rule_id)`,
		`CREATE INDEX IF NOT EXISTS idx_rule_logs_entry_id ON rule_logs(entry_id)`,
	}

	for _, q := range queries {
		if _, err := db.DB.Exec(q); err != nil {
			return err
		}
	}
	return nil
}

// var _ = sql.NullString{} // ensure import
var _ = sql.ErrNoRows
