package cmd

import (
	"fmt"
	"os"
	"time"

	"github.com/rss-post/cli/internal/report"
	"github.com/spf13/cobra"
)

var reportCmd = &cobra.Command{
	Use:   "report",
	Short: "Generate reports",
	Long:  `Generate daily or weekly reports from analyzed RSS entries.`,
}

var reportDailyCmd = &cobra.Command{
	Use:   "daily [date]",
	Short: "Generate daily report",
	Long:  `Generate a daily report. Date format: YYYY-MM-DD (defaults to today).`,
	Args:  cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		date := time.Now()
		if len(args) > 0 {
			parsed, err := time.Parse("2006-01-02", args[0])
			if err != nil {
				fmt.Fprintf(os.Stderr, "Invalid date format: %v (use YYYY-MM-DD)\n", err)
				os.Exit(1)
			}
			date = parsed
		}

		generator := report.NewGenerator(cfg)
		rpt, err := generator.GenerateDaily(date)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error generating report: %v\n", err)
			os.Exit(1)
		}

		outputPath, _ := cmd.Flags().GetString("output")
		aiSummary, _ := cmd.Flags().GetBool("ai")

		if outputPath != "" {
			err = generator.SaveReport(rpt, outputPath)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error saving report: %v\n", err)
				os.Exit(1)
			}
			fmt.Printf("Report saved to %s\n", outputPath)
		} else {
			fmt.Println(rpt.Content)
		}

		if aiSummary {
			fmt.Println("\n--- AI Summary ---")
			summary, err := generator.GenerateAIReport(rpt)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error generating AI summary: %v\n", err)
				os.Exit(1)
			}
			fmt.Println(summary)
		}
	},
}

var reportWeeklyCmd = &cobra.Command{
	Use:   "weekly [date]",
	Short: "Generate weekly report",
	Long:  `Generate a weekly report. Date format: YYYY-MM-DD (defaults to current week).`,
	Args:  cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		date := time.Now()
		if len(args) > 0 {
			parsed, err := time.Parse("2006-01-02", args[0])
			if err != nil {
				fmt.Fprintf(os.Stderr, "Invalid date format: %v (use YYYY-MM-DD)\n", err)
				os.Exit(1)
			}
			date = parsed
		}

		generator := report.NewGenerator(cfg)
		rpt, err := generator.GenerateWeekly(date)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error generating report: %v\n", err)
			os.Exit(1)
		}

		outputPath, _ := cmd.Flags().GetString("output")
		aiSummary, _ := cmd.Flags().GetBool("ai")

		if outputPath != "" {
			err = generator.SaveReport(rpt, outputPath)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error saving report: %v\n", err)
				os.Exit(1)
			}
			fmt.Printf("Report saved to %s\n", outputPath)
		} else {
			fmt.Println(rpt.Content)
		}

		if aiSummary {
			fmt.Println("\n--- AI Summary ---")
			summary, err := generator.GenerateAIReport(rpt)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error generating AI summary: %v\n", err)
				os.Exit(1)
			}
			fmt.Println(summary)
		}
	},
}

func init() {
	reportCmd.AddCommand(reportDailyCmd)
	reportCmd.AddCommand(reportWeeklyCmd)

	reportDailyCmd.Flags().StringP("output", "o", "", "Output file path")
	reportDailyCmd.Flags().BoolP("ai", "a", false, "Generate AI summary")
	reportWeeklyCmd.Flags().StringP("output", "o", "", "Output file path")
	reportWeeklyCmd.Flags().BoolP("ai", "a", false, "Generate AI summary")

	rootCmd.AddCommand(reportCmd)
}
