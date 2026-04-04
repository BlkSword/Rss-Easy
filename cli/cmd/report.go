package cmd

import (
	"fmt"
	"os"
	"time"

	"github.com/rss-post/cli/internal/email"
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

		generateAndOutput(cmd, func(g *report.Generator) (*report.Report, error) {
			return g.GenerateDaily(date)
		})
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

		generateAndOutput(cmd, func(g *report.Generator) (*report.Report, error) {
			return g.GenerateWeekly(date)
		})
	},
}

var reportSendCmd = &cobra.Command{
	Use:   "send",
	Short: "Send daily report via email",
	Long:  `Generate and send the daily report via email using configured SMTP settings.`,
	Run: func(cmd *cobra.Command, args []string) {
		if !cfg.Email.Enabled {
			fmt.Fprintf(os.Stderr, "Email not enabled. Set email.enabled = true in config.\n")
			os.Exit(1)
		}

		if len(cfg.Email.To) == 0 {
			fmt.Fprintf(os.Stderr, "No email recipients configured. Set email.to in config.\n")
			os.Exit(1)
		}

		generator := report.NewGenerator(cfg)
		rpt, err := generator.GenerateDaily(time.Now().AddDate(0, 0, -1))
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error generating report: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("Sending report to %v...\n", cfg.Email.To)
		err = generator.SendEmail(rpt, cfg.Email.To)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error sending email: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("✓ Report sent successfully!")
	},
}

var reportTestCmd = &cobra.Command{
	Use:   "test-email",
	Short: "Send a test email to verify SMTP settings",
	Long:  `Send a test email to verify your SMTP configuration is correct.`,
	Run: func(cmd *cobra.Command, args []string) {
		if !cfg.Email.Enabled {
			fmt.Fprintf(os.Stderr, "Email not enabled. Set email.enabled = true in config.\n")
			os.Exit(1)
		}

		to, _ := cmd.Flags().GetString("to")
		if to == "" {
			if len(cfg.Email.To) > 0 {
				to = cfg.Email.To[0]
			} else {
				fmt.Fprintf(os.Stderr, "No recipient. Use --to or set email.to in config.\n")
				os.Exit(1)
			}
		}

		sender := email.NewSender2(cfg.Email.From, email.SMTPConfig{
			Host:               cfg.Email.SMTP.Host,
			Port:               cfg.Email.SMTP.Port,
			Username:           cfg.Email.SMTP.Username,
			Password:           cfg.Email.SMTP.Password,
			InsecureSkipVerify: cfg.Email.SMTP.InsecureSkipVerify,
		})
		fmt.Printf("Sending test email to %s...\n", to)
		err := sender.SendTest(to)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error sending test email: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("✓ Test email sent successfully!")
	},
}

func generateAndOutput(cmd *cobra.Command, genFunc func(*report.Generator) (*report.Report, error)) {
	generator := report.NewGenerator(cfg)
	rpt, err := genFunc(generator)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error generating report: %v\n", err)
		os.Exit(1)
	}

	outputPath, _ := cmd.Flags().GetString("output")
	aiSummary, _ := cmd.Flags().GetBool("ai")
	sendEmail, _ := cmd.Flags().GetBool("email")
	emailTo, _ := cmd.Flags().GetStringArray("to")

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
		} else {
			fmt.Println(summary)
		}
	}

	if sendEmail {
		if !cfg.Email.Enabled {
			fmt.Fprintf(os.Stderr, "\n⚠ Email not enabled in config. Skipping email send.\n")
			return
		}
		fmt.Printf("\nSending report via email to %v...\n", cfg.Email.To)
		err = generator.SendEmail(rpt, emailTo)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error sending email: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("✓ Report sent via email!")
	}
}

func init() {
	reportCmd.AddCommand(reportDailyCmd)
	reportCmd.AddCommand(reportWeeklyCmd)
	reportCmd.AddCommand(reportSendCmd)
	reportCmd.AddCommand(reportTestCmd)

	// Common flags for daily/weekly
	for _, c := range []*cobra.Command{reportDailyCmd, reportWeeklyCmd} {
		c.Flags().StringP("output", "o", "", "Output file path")
		c.Flags().BoolP("ai", "a", false, "Generate AI summary")
		c.Flags().Bool("email", false, "Send report via email")
		c.Flags().StringArray("to", nil, "Override email recipients")
	}

	// report test-email
	reportTestCmd.Flags().String("to", "", "Recipient email address")

	rootCmd.AddCommand(reportCmd)
}
