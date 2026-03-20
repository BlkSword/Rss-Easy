package rules

import "encoding/json"

// ConditionType defines the type of a rule condition.
type ConditionType string

const (
	ConditionKeyword ConditionType = "keyword"
	ConditionTag     ConditionType = "tag"
	ConditionScore   ConditionType = "score"
	ConditionFeed    ConditionType = "feed"
)

// ConditionOperator defines how a condition matches.
type ConditionOperator string

const (
	OperatorContains  ConditionOperator = "contains"
	OperatorNotContains ConditionOperator = "not_contains"
	OperatorEquals    ConditionOperator = "equals"
	OperatorStartsWith ConditionOperator = "starts_with"
	OperatorEndsWith   ConditionOperator = "ends_with"
	OperatorGT        ConditionOperator = "gt"
	OperatorGTE       ConditionOperator = "gte"
	OperatorLT        ConditionOperator = "lt"
	OperatorLTE       ConditionOperator = "lte"
)

// ActionType defines the type of a rule action.
type ActionType string

const (
	ActionMarkRead    ActionType = "mark_read"
	ActionStar        ActionType = "star"
	ActionAddTag      ActionType = "add_tag"
	ActionRemoveTag   ActionType = "remove_tag"
	ActionMoveCategory ActionType = "move_category"
)

// Condition represents a single matching condition.
type Condition struct {
	Type     ConditionType     `json:"type"`
	Value    string            `json:"value"`
	Operator ConditionOperator `json:"operator"`
}

// Action represents a single action to perform when a rule matches.
type Action struct {
	Type  ActionType `json:"type"`
	Value string     `json:"value"`
}

// Rule represents an automation rule.
type Rule struct {
	ID            int64      `json:"id"`
	Name          string     `json:"name"`
	Description   string     `json:"description"`
	Enabled       bool       `json:"enabled"`
	Conditions    []Condition `json:"conditions"`
	Actions       []Action   `json:"actions"`
	Priority      int        `json:"priority"`
	MatchCount    int        `json:"match_count"`
	LastMatchedAt *string    `json:"last_matched_at"`
	CreatedAt     string     `json:"created_at"`
	UpdatedAt     string     `json:"updated_at"`
}

// RuleLog represents a log entry for a rule execution.
type RuleLog struct {
	ID        int64  `json:"id"`
	RuleID    int64  `json:"rule_id"`
	EntryID   int64  `json:"entry_id"`
	Action    string `json:"action"`
	MatchedAt string `json:"matched_at"`
}

// ParseConditions parses JSON string into a slice of conditions.
func ParseConditions(jsonStr string) ([]Condition, error) {
	if jsonStr == "" {
		return nil, nil
	}
	var conditions []Condition
	err := json.Unmarshal([]byte(jsonStr), &conditions)
	return conditions, err
}

// ParseActions parses JSON string into a slice of actions.
func ParseActions(jsonStr string) ([]Action, error) {
	if jsonStr == "" {
		return nil, nil
	}
	var actions []Action
	err := json.Unmarshal([]byte(jsonStr), &actions)
	return actions, err
}

// SerializeConditions serializes conditions to JSON string.
func SerializeConditions(conditions []Condition) (string, error) {
	if len(conditions) == 0 {
		return "[]", nil
	}
	data, err := json.Marshal(conditions)
	return string(data), err
}

// SerializeActions serializes actions to JSON string.
func SerializeActions(actions []Action) (string, error) {
	if len(actions) == 0 {
		return "[]", nil
	}
	data, err := json.Marshal(actions)
	return string(data), err
}
