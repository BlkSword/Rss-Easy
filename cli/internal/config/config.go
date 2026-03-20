package config

import (
	"os"
	"path/filepath"
	"time"

	"github.com/BurntSushi/toml"
)

type Config struct {
	Database DatabaseConfig `toml:"database"`
	AI       AIConfig       `toml:"ai"`
	Fetch    FetchConfig    `toml:"fetch"`
	Proxy    ProxyConfig    `toml:"proxy"`
	Output   OutputConfig   `toml:"output"`
	Email    EmailConfig    `toml:"email"`
	Schedule ScheduleConfig `toml:"schedule"`
}

type DatabaseConfig struct {
	Path string `toml:"path"`
}

type AIConfig struct {
	Provider    string             `toml:"provider"`
	Model       string             `toml:"model"`
	APIKey      string             `toml:"api_key"`
	BaseURL     string             `toml:"base_url"`
	MaxTokens   int                `toml:"max_tokens"`
	Temperature float64            `toml:"temperature"`
	Preliminary PreliminaryConfig  `toml:"preliminary"`
}

type PreliminaryConfig struct {
	Enabled bool   `toml:"enabled"`
	Model   string `toml:"model"`
}

type FetchConfig struct {
	Concurrency      int           `toml:"concurrency"`
	Timeout          time.Duration `toml:"timeout"`
	UserAgent        string        `toml:"user_agent"`
	FullContent      bool          `toml:"full_content"`
	FullConcurrency  int           `toml:"full_concurrency"`
	FullTimeout      time.Duration `toml:"full_timeout"`
}

type ProxyConfig struct {
	Enabled bool   `toml:"enabled"`
	Type    string `toml:"type"`
	Host    string `toml:"host"`
	Port    string `toml:"port"`
}

type OutputConfig struct {
	Format string `toml:"format"`
	Color  bool   `toml:"color"`
}

type SMTPConfig struct {
	Host               string `toml:"host"`
	Port               int    `toml:"port"`
	Username           string `toml:"username"`
	Password           string `toml:"password"`
	InsecureSkipVerify bool   `toml:"insecure_skip_verify"`
}

type EmailConfig struct {
	Enabled   bool       `toml:"enabled"`
	From      string     `toml:"from"`
	To        []string   `toml:"to"`
	Subject   string     `toml:"subject"`
	SMTP      SMTPConfig `toml:"smtp"`
}

type ScheduleConfig struct {
	Enabled  bool   `toml:"enabled"`
	Type     string `toml:"type"`     // "daily" or "weekly"
	Hour     int    `toml:"hour"`     // 0-23, e.g. 8 = 8:00 AM
	Minute   int    `toml:"minute"`   // 0-59
	SendMail bool   `toml:"send_mail"` // also send via email
}

func DefaultConfig() *Config {
	homeDir, _ := os.UserHomeDir()
	dbPath := filepath.Join(homeDir, ".rss-post", "data.db")

	return &Config{
		Database: DatabaseConfig{
			Path: dbPath,
		},
		AI: AIConfig{
			Provider:    "openai",
			Model:       "gpt-4o",
			APIKey:      "",
			BaseURL:     "",
			MaxTokens:   4096,
			Temperature: 0.7,
			Preliminary: PreliminaryConfig{
				Enabled: true,
				Model:   "gpt-4o-mini",
			},
		},
		Fetch: FetchConfig{
			Concurrency:     10,
			Timeout:         60 * time.Second,
			UserAgent:       "Mozilla/5.0 (compatible; RSS-Post/1.0; +https://github.com/rss-post/cli)",
			FullContent:     false,
			FullConcurrency: 5,
			FullTimeout:     15 * time.Second,
		},
		Proxy: ProxyConfig{
			Enabled: false,
			Type:    "http",
			Host:    "",
			Port:    "",
		},
		Output: OutputConfig{
			Format: "table",
			Color:  true,
		},
		Email: EmailConfig{
			Enabled: false,
			From:    "",
			To:      []string{},
			Subject: "RSS-Post 日报",
			SMTP: SMTPConfig{
				Host:               "smtp.qq.com",
				Port:               465,
				InsecureSkipVerify: false,
			},
		},
		Schedule: ScheduleConfig{
			Enabled:  false,
			Type:     "daily",
			Hour:     8,
			Minute:   0,
			SendMail: true,
		},
	}
}

func getConfigPath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".rss-post", "config.toml")
}

func Load(path string) (*Config, error) {
	if path == "" {
		path = getConfigPath()
	}

	cfg := DefaultConfig()

	if _, err := os.Stat(path); os.IsNotExist(err) {
		if err := Save(cfg, path); err != nil {
			return nil, err
		}
		return cfg, nil
	}

	if _, err := toml.DecodeFile(path, cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}

func Save(cfg *Config, path string) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	return toml.NewEncoder(file).Encode(cfg)
}
