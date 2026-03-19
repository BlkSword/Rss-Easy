package search

import (
	"strings"

	"github.com/rss-post/cli/internal/db"
)

type SearchResult struct {
	Entry    *db.Entry
	Score    float64
	Matched  []string
}

type SearchService struct{}

func NewSearchService() *SearchService {
	return &SearchService{}
}

func (s *SearchService) Search(query string, limit int) ([]*SearchResult, error) {
	entries, err := db.SearchEntries(query, limit*2) // Get more to allow for scoring
	if err != nil {
		return nil, err
	}

	return s.rankResults(entries, query, limit), nil
}

func (s *SearchService) rankResults(entries []*db.Entry, query string, limit int) []*SearchResult {
	queryLower := strings.ToLower(query)
	results := make([]*SearchResult, 0, len(entries))

	for _, entry := range entries {
		score := 0.0
		matched := []string{}

		titleLower := strings.ToLower(entry.Title)
		contentLower := strings.ToLower(entry.Content)
		summaryLower := strings.ToLower(entry.Summary)

		// Title matches (highest weight)
		if strings.Contains(titleLower, queryLower) {
			score += 10.0
			matched = append(matched, "title")
		}

		// Summary matches
		if strings.Contains(summaryLower, queryLower) {
			score += 5.0
			matched = append(matched, "summary")
		}

		// Content matches
		if strings.Contains(contentLower, queryLower) {
			score += 3.0
			matched = append(matched, "content")
		}

		// AI keywords match
		if entry.AIKeywords != "" {
			if strings.Contains(strings.ToLower(entry.AIKeywords), queryLower) {
				score += 8.0
				matched = append(matched, "keywords")
			}
		}

		// Boost by AI score
		if entry.AIScore > 0 {
			score += float64(entry.AIScore) * 0.5
		}

		// Boost unread entries
		if !entry.IsRead {
			score *= 1.2
		}

		// Boost starred entries
		if entry.IsStarred {
			score *= 1.1
		}

		if score > 0 {
			results = append(results, &SearchResult{
				Entry:   entry,
				Score:   score,
				Matched: matched,
			})
		}
	}

	// Sort by score (simple bubble sort for small datasets)
	for i := 0; i < len(results)-1; i++ {
		for j := i + 1; j < len(results); j++ {
			if results[j].Score > results[i].Score {
				results[i], results[j] = results[j], results[i]
			}
		}
	}

	// Limit results
	if len(results) > limit {
		results = results[:limit]
	}

	return results
}

func (s *SearchService) AdvancedSearch(query string, filters map[string]interface{}, limit int) ([]*SearchResult, error) {
	filter := &db.EntryFilter{
		Limit:    limit,
		OrderBy:  "published_at",
		OrderDesc: true,
	}

	if feedID, ok := filters["feed_id"].(int64); ok {
		filter.FeedID = &feedID
	}

	if starred, ok := filters["starred"].(bool); ok {
		filter.Starred = &starred
	}

	if unread, ok := filters["unread"].(bool); ok {
		filter.Unread = &unread
	}

	if aiScoreMin, ok := filters["ai_score_min"].(int); ok {
		filter.AIScoreMin = &aiScoreMin
	}

	entries, err := db.ListEntries(filter)
	if err != nil {
		return nil, err
	}

	// If there's a query, filter further
	if query != "" {
		return s.rankResults(entries, query, limit), nil
	}

	// No query, just return entries
	results := make([]*SearchResult, len(entries))
	for i, entry := range entries {
		results[i] = &SearchResult{
			Entry:   entry,
			Score:   float64(entry.AIScore),
			Matched: []string{},
		}
	}

	return results, nil
}
