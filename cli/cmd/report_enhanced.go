package cmd

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/rss-post/cli/internal/db"
	"github.com/rss-post/cli/internal/output"
	"github.com/rss-post/cli/internal/report"
	"github.com/spf13/cobra"
)

var reportListCmd = &cobra.Command{
	Use:   "list",
	Short: "List saved reports",
	Run: func(cmd *cobra.Command, args []string) {
		limit, _ := cmd.Flags().GetInt("limit")

		reports, err := db.ListSavedReports(limit)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error listing reports: %v\n", err)
			os.Exit(1)
		}

		formatter := output.NewFormatter(cfg.Output.Color)
		fmt.Println(formatter.FormatReportList(reports))
	},
}

var reportShowCmd = &cobra.Command{
	Use:   "show <id>",
	Short: "Show a saved report",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		id, err := strconv.ParseInt(args[0], 10, 64)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Invalid report ID: %v\n", err)
			os.Exit(1)
		}

		rpt, err := db.GetSavedReport(id)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Report %d not found: %v\n", id, err)
			os.Exit(1)
		}

		fmt.Printf("Report #%d (%s, %s)\n", rpt.ID, rpt.Type, rpt.Date)
		fmt.Printf("Generated: %s\n\n", rpt.CreatedAt)
		fmt.Println(rpt.Content)
	},
}

var reportDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a saved report",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		id, err := strconv.ParseInt(args[0], 10, 64)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Invalid report ID: %v\n", err)
			os.Exit(1)
		}

		err = db.DeleteSavedReport(id)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error deleting report: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Report %d deleted.\n", id)
	},
}

func init() {
	reportCmd.AddCommand(reportListCmd)
	reportCmd.AddCommand(reportShowCmd)
	reportCmd.AddCommand(reportDeleteCmd)

	reportListCmd.Flags().IntP("limit", "l", 20, "Maximum reports to show")

	// Add --save flag to daily and weekly commands
	reportDailyCmd.Flags().Bool("save", false, "Save report to database (default: auto-save)")
	reportWeeklyCmd.Flags().Bool("save", false, "Save report to database (default: auto-save)")
}

// addReportDBSave enhances the report generation to save to DB.
func addReportDBSave() {
	enhanceReportSaveCmd(reportDailyCmd, "daily")
	enhanceReportSaveCmd(reportWeeklyCmd, "weekly")
}

func enhanceReportSaveCmd(cmd *cobra.Command, reportType string) {
	cmd.Run = func(cmd *cobra.Command, args []string) {
		// Always save to DB, --save flag is implicit
		generator := report.NewGenerator(cfg)
		var rpt *report.Report
		var err error

		date := time.Now()
		if len(args) > 0 {
			parsed, err2 := time.Parse("2006-01-02", args[0])
			if err2 == nil {
				date = parsed
			}
		}

		if reportType == "daily" {
			rpt, err = generator.GenerateDaily(date)
		} else {
			rpt, err = generator.GenerateWeekly(date)
		}

		if err != nil {
			fmt.Fprintf(os.Stderr, "Error generating report: %v\n", err)
			os.Exit(1)
		}

		// Output the report
		outputPath, _ := cmd.Flags().GetString("output")
		if outputPath != "" {
			_ = generator.SaveReport(rpt, outputPath)
			fmt.Printf("Report saved to %s\n", outputPath)
		} else {
			fmt.Println(rpt.Content)
		}

		// Save to DB
		htmlContent := ""
		if generator != nil {
			htmlContent = generator.RenderHTML(rpt)
		}
		_, err = db.SaveReportToDB(
			reportType,
			rpt.Period,
			rpt.Content,
			htmlContent,
			rpt.Stats.TotalEntries,
			rpt.Stats.AvgAIScore,
		)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to save report to DB: %v\n", err)
		}
	}
}
