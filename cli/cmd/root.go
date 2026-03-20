package cmd

import (
	"os"

	"github.com/rss-post/cli/internal/config"
	"github.com/rss-post/cli/internal/db"
	"github.com/rss-post/cli/internal/rules"
	"github.com/spf13/cobra"
)

var (
	cfgFile string
	cfg     *config.Config
)

var rootCmd = &cobra.Command{
	Use:   "rss-post",
	Short: "RSS feed aggregator with AI-powered analysis",
	Long: `RSS-Post CLI is a terminal-based RSS feed aggregator that provides
intelligent article analysis using AI, search capabilities, and report generation.

It supports multiple feed formats (RSS, Atom, JSON Feed) and can analyze
articles using various AI providers (OpenAI, Anthropic, DeepSeek, etc.).`,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		var err error
		cfg, err = config.Load(cfgFile)
		if err != nil {
			return err
		}
		if err := db.Init(cfg.Database.Path); err != nil {
			return err
		}

		// Ensure all feature tables exist (idempotent)
		_ = rules.EnsureTables()
		_ = db.EnsureCategoryTables()
		_ = db.EnsureSearchTables()
		_ = db.EnsureReportTables()

		return nil
	},
}

func Execute() {
	// Register all subcommands
	addBulkCommands()
	addSearchEnhancements()
	addReportDBSave()

	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is ~/.rss-post/config.toml)")
}
