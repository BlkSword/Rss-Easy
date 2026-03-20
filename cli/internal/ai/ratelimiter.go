package ai

import (
	"context"
	"sync"
	"time"
)

// RateLimiter implements token-bucket rate limiting for AI API calls.
// Core principle: better slow than rate-limited by the provider.
type RateLimiter struct {
	mu         sync.Mutex
	tokens     float64
	maxTokens  float64
	refillRate float64 // tokens per second
	lastRefill time.Time
	disabled   bool
}

// NewRateLimiter creates a limiter allowing up to requestsPerMinute API calls.
func NewRateLimiter(requestsPerMinute int) *RateLimiter {
	if requestsPerMinute <= 0 {
		return &RateLimiter{disabled: true}
	}
	return &RateLimiter{
		tokens:     float64(requestsPerMinute),
		maxTokens:  float64(requestsPerMinute),
		refillRate: float64(requestsPerMinute) / 60.0,
		lastRefill: time.Now(),
	}
}

// Wait blocks until a token is available or context is cancelled.
func (r *RateLimiter) Wait(ctx context.Context) error {
	if r.disabled {
		return nil
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	for {
		r.refill()
		if r.tokens >= 1 {
			r.tokens--
			return nil
		}
		// Calculate wait time
		waitTime := time.Duration((1-r.tokens)/r.refillRate*1000) * time.Millisecond
		if waitTime <= 0 {
			waitTime = time.Second
		}
		r.mu.Unlock()
		select {
		case <-ctx.Done():
			r.mu.Lock()
			return ctx.Err()
		case <-time.After(waitTime):
		}
		r.mu.Lock()
	}
}

func (r *RateLimiter) refill() {
	now := time.Now()
	elapsed := now.Sub(r.lastRefill).Seconds()
	r.tokens += elapsed * r.refillRate
	if r.tokens > r.maxTokens {
		r.tokens = r.maxTokens
	}
	r.lastRefill = now
}
