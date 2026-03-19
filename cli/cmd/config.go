package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/rss-post/cli/internal/config"
	"github.com/spf13/cobra"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage configuration",
	Long:  `View, initialize, or modify RSS-Post configuration.`,
}

var configInitCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize configuration",
	Long:  `Create a default configuration file if one doesn't exist.`,
	Run: func(cmd *cobra.Command, args []string) {
		homeDir, _ := os.UserHomeDir()
		configDir := filepath.Join(homeDir, ".rss-post")
		configPath := filepath.Join(configDir, "config.toml")

		if _, err := os.Stat(configPath); err == nil {
			fmt.Printf("Configuration file already exists at %s\n", configPath)
			return
		}

		cfg := config.DefaultConfig()
		err := config.Save(cfg, configPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error creating config: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("Configuration file created at %s\n", configPath)
		fmt.Println("\nPlease edit the config file to set your AI API key:")
		fmt.Printf("  vi %s\n", configPath)
	},
}

var configShowCmd = &cobra.Command{
	Use:   "show",
	Short: "Show current configuration",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("Current Configuration")
		fmt.Println("====================")
		fmt.Printf("Database Path: %s\n", cfg.Database.Path)
		fmt.Printf("\nAI Settings:\n")
		fmt.Printf("  Provider:    %s\n", cfg.AI.Provider)
		fmt.Printf("  Model:       %s\n", cfg.AI.Model)
		if cfg.AI.BaseURL != "" {
			fmt.Printf("  Base URL:    %s\n", cfg.AI.BaseURL)
		}
		fmt.Printf("  Max Tokens:  %d\n", cfg.AI.MaxTokens)
		fmt.Printf("  Temperature: %.1f\n", cfg.AI.Temperature)
		fmt.Printf("  Preliminary: enabled=%v, model=%s\n", cfg.AI.Preliminary.Enabled, cfg.AI.Preliminary.Model)
		fmt.Printf("\nFetch Settings:\n")
		fmt.Printf("  Concurrency: %d\n", cfg.Fetch.Concurrency)
		fmt.Printf("  Timeout:     %v\n", cfg.Fetch.Timeout)
		fmt.Printf("\nOutput Settings:\n")
		fmt.Printf("  Format:      %s\n", cfg.Output.Format)
		fmt.Printf("  Color:       %v\n", cfg.Output.Color)

		if cfg.Proxy.Enabled {
			fmt.Printf("\nProxy Settings:\n")
			fmt.Printf("  Type:        %s\n", cfg.Proxy.Type)
			fmt.Printf("  Host:        %s\n", cfg.Proxy.Host)
			fmt.Printf("  Port:        %s\n", cfg.Proxy.Port)
		}
	},
}

var configPathCmd = &cobra.Command{
	Use:   "path",
	Short: "Show configuration file path",
	Run: func(cmd *cobra.Command, args []string) {
		homeDir, _ := os.UserHomeDir()
		configPath := filepath.Join(homeDir, ".rss-post", "config.toml")
		fmt.Println(configPath)
	},
}

var configSetCmd = &cobra.Command{
	Use:   "set <key> <value>",
	Short: "Set a configuration value",
	Long: `Set a configuration value. Keys are in the format "section.key".

Examples:
  rss-post config set ai.provider anthropic
  rss-post config set ai.model claude-3-opus-20240229
  rss-post config set fetch.concurrency 5`,
	Args: cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		key := args[0]
		value := args[1]

		switch key {
		case "ai.provider":
			cfg.AI.Provider = value
		case "ai.model":
			cfg.AI.Model = value
		case "ai.base_url":
			cfg.AI.BaseURL = value
		case "ai.api_key":
			cfg.AI.APIKey = value
		case "ai.max_tokens":
			var tokens int
			fmt.Sscanf(value, "%d", &tokens)
			cfg.AI.MaxTokens = tokens
		case "ai.temperature":
			var temp float64
			fmt.Sscanf(value, "%f", &temp)
			cfg.AI.Temperature = temp
		case "fetch.concurrency":
			var conc int
			fmt.Sscanf(value, "%d", &conc)
			cfg.Fetch.Concurrency = conc
		case "fetch.timeout":
			var timeout int
			fmt.Sscanf(value, "%d", &timeout)
			cfg.Fetch.Timeout = time.Duration(timeout) * time.Second
		case "output.format":
			cfg.Output.Format = value
		case "output.color":
			cfg.Output.Color = value == "true"
		default:
			fmt.Fprintf(os.Stderr, "Unknown configuration key: %s\n", key)
			os.Exit(1)
		}

		homeDir, _ := os.UserHomeDir()
		configPath := filepath.Join(homeDir, ".rss-post", "config.toml")
		err := config.Save(cfg, configPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error saving config: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("Set %s = %s\n", key, value)
	},
}

func init() {
	configCmd.AddCommand(configInitCmd)
	configCmd.AddCommand(configShowCmd)
	configCmd.AddCommand(configPathCmd)
	configCmd.AddCommand(configSetCmd)

	rootCmd.AddCommand(configCmd)
}
