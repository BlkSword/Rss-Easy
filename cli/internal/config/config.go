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
	Concurrency int           `toml:"concurrency"`
	Timeout     time.Duration `toml:"timeout"`
	UserAgent   string        `toml:"user_agent"`
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
			Concurrency: 10,
			Timeout:     60 * time.Second,
			UserAgent:   "Mozilla/5.0 (compatible; RSS-Post/1.0; +https://github.com/rss-post/cli)",
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
