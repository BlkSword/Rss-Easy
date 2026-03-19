package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/rss-post/cli/internal/config"
)

type Client struct {
	cfg    *config.Config
	client *http.Client
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Temperature float64   `json:"temperature,omitempty"`
}

type ChatResponse struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Choices []struct {
		Index   int `json:"index"`
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    string `json:"code"`
	} `json:"error,omitempty"`
}

func NewClient(cfg *config.Config) *Client {
	return &Client{
		cfg: cfg,
		client: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

func (c *Client) getBaseURL() string {
	if c.cfg.AI.BaseURL != "" {
		return c.cfg.AI.BaseURL
	}

	switch c.cfg.AI.Provider {
	case "anthropic":
		return "https://api.anthropic.com/v1"
	case "deepseek":
		return "https://api.deepseek.com/v1"
	case "openai":
		return "https://api.openai.com/v1"
	default:
		return c.cfg.AI.BaseURL
	}
}

func (c *Client) getHeaders() map[string]string {
	headers := map[string]string{
		"Content-Type": "application/json",
	}

	switch c.cfg.AI.Provider {
	case "anthropic":
		headers["x-api-key"] = c.cfg.AI.APIKey
		headers["anthropic-version"] = "2023-06-01"
	default:
		headers["Authorization"] = "Bearer " + c.cfg.AI.APIKey
	}

	return headers
}

func (c *Client) Chat(messages []Message, model string) (string, error) {
	if model == "" {
		model = c.cfg.AI.Model
	}

	req := ChatRequest{
		Model:       model,
		Messages:    messages,
		MaxTokens:   c.cfg.AI.MaxTokens,
		Temperature: c.cfg.AI.Temperature,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return "", err
	}

	url := c.getBaseURL() + "/chat/completions"
	httpReq, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}

	for k, v := range c.getHeaders() {
		httpReq.Header.Set(k, v)
	}

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var chatResp ChatResponse
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return "", err
	}

	if chatResp.Error != nil {
		return "", fmt.Errorf("API error: %s", chatResp.Error.Message)
	}

	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("no response from API")
	}

	return chatResp.Choices[0].Message.Content, nil
}

func (c *Client) ChatWithSystem(systemPrompt, userMessage string, model string) (string, error) {
	messages := []Message{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userMessage},
	}
	return c.Chat(messages, model)
}
