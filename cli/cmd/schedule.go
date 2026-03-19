package cmd

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rss-post/cli/internal/config"
	"github.com/rss-post/cli/internal/report"
	"github.com/spf13/cobra"
)

var scheduleCmd = &cobra.Command{
	Use:   "schedule",
	Short: "Manage scheduled report generation",
	Long:  `Run the report scheduler as a daemon. It will generate and optionally email reports at configured times.`,
}

var scheduleRunCmd = &cobra.Command{
	Use:   "run",
	Short: "Start the scheduler daemon",
	Long: `Start the scheduler daemon that generates reports at configured times.

The scheduler reads the [schedule] section from config.toml:
  type = "daily" or "weekly"
  hour = 0-23 (hour to generate report)
  minute = 0-59
  send_mail = true/false

Example config:
  [schedule]
  enabled = true
  type = "daily"
  hour = 8
  minute = 0
  send_mail = true`,
	Run: func(cmd *cobra.Command, args []string) {
		scfg := &cfg.Schedule
		if !scfg.Enabled {
			fmt.Println("Scheduler not enabled. Set schedule.enabled = true in config.")
			os.Exit(1)
		}

		if scfg.Hour < 0 || scfg.Hour > 23 {
			fmt.Fprintf(os.Stderr, "Invalid schedule.hour: must be 0-23, got %d\n", scfg.Hour)
			os.Exit(1)
		}

		fmt.Printf("Scheduler started (%s at %02d:%02d, send_mail=%v)\n",
			scfg.Type, scfg.Hour, scfg.Minute, scfg.SendMail)
		fmt.Println("Press Ctrl+C to stop.")

		// Calculate next run time
		nextRun := calcNextRun(scfg)
		waitDuration := time.Until(nextRun)
		if waitDuration < 0 {
			// Already past today's time, schedule for tomorrow
			nextRun = calcNextRun(scfg)
			waitDuration = time.Until(nextRun)
		}

		fmt.Printf("Next run: %s (in %s)\n\n", nextRun.Format("2006-01-02 15:04:05"), waitDuration.Round(time.Second))

		// Wait for signal or timer
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

		for {
			select {
			case <-time.After(waitDuration):
				// Generate report
				fmt.Printf("\n[%s] Generating %s report...\n", time.Now().Format("15:04:05"), scfg.Type)

				generator := report.NewGenerator(cfg)
				var rpt *report.Report
				var err error

				if scfg.Type == "weekly" {
					rpt, err = generator.GenerateWeekly(time.Now())
				} else {
					rpt, err = generator.GenerateDaily(time.Now())
				}

				if err != nil {
					fmt.Fprintf(os.Stderr, "Error generating report: %v\n", err)
				} else {
					fmt.Printf("Report generated: %d articles, %d analyzed\n",
						rpt.Stats.TotalEntries, rpt.Stats.AnalyzedEntries)

					// Send email if configured
					if scfg.SendMail && cfg.Email.Enabled && len(cfg.Email.To) > 0 {
						fmt.Printf("Sending to %v...\n", cfg.Email.To)
						if err := generator.SendEmail(rpt, nil); err != nil {
							fmt.Fprintf(os.Stderr, "Error sending email: %v\n", err)
						} else {
							fmt.Println("✓ Email sent!")
						}
					}
				}

				// Calculate next run
				nextRun = calcNextRun(scfg)
				waitDuration = time.Until(nextRun)
				for waitDuration < time.Minute {
					nextRun = calcNextRun(scfg)
					waitDuration = time.Until(nextRun)
				}
				fmt.Printf("\nNext run: %s (in %s)\n", nextRun.Format("2006-01-02 15:04:05"), waitDuration.Round(time.Second))

			case sig := <-sigCh:
				fmt.Printf("\nReceived %v, shutting down.\n", sig)
				return
			}
		}
	},
}

var scheduleShowCmd = &cobra.Command{
	Use:   "show",
	Short: "Show scheduler configuration",
	Run: func(cmd *cobra.Command, args []string) {
		scfg := &cfg.Schedule
		fmt.Println("Scheduler Configuration")
		fmt.Println("======================")
		fmt.Printf("Enabled:     %v\n", scfg.Enabled)
		fmt.Printf("Type:        %s\n", scfg.Type)
		fmt.Printf("Time:        %02d:%02d\n", scfg.Hour, scfg.Minute)
		fmt.Printf("Send Email:  %v\n", scfg.SendMail)

		if cfg.Email.Enabled {
			fmt.Println("\nEmail Configuration")
			fmt.Println("--------------------")
			fmt.Printf("From:        %s\n", cfg.Email.From)
			fmt.Printf("To:          %v\n", cfg.Email.To)
			fmt.Printf("SMTP Host:   %s:%d\n", cfg.Email.SMTP.Host, cfg.Email.SMTP.Port)
		} else {
			fmt.Println("\nEmail: not enabled")
		}

		// Show next run time
		if scfg.Enabled {
			nextRun := calcNextRun(scfg)
			waitDuration := time.Until(nextRun)
			if waitDuration < 0 {
				nextRun = calcNextRun(scfg)
				waitDuration = time.Until(nextRun)
			}
			fmt.Printf("\nNext Run:    %s (in %s)\n",
				nextRun.Format("2006-01-02 15:04:05"), waitDuration.Round(time.Second))
		}
	},
}

func calcNextRun(scfg *config.ScheduleConfig) time.Time {
	now := time.Now()
	target := time.Date(now.Year(), now.Month(), now.Day(), scfg.Hour, scfg.Minute, 0, 0, now.Location())

	if scfg.Type == "weekly" {
		// Adjust to Monday
		for target.Weekday() != time.Monday {
			target = target.AddDate(0, 0, 1)
		}
		// If today is Monday but already past the time, go to next Monday
		if target.Before(now) {
			target = target.AddDate(0, 0, 7)
		}
	} else {
		// Daily: if already past today's time, go to tomorrow
		if target.Before(now) {
			target = target.AddDate(0, 0, 1)
		}
	}

	return target
}

func init() {
	scheduleCmd.AddCommand(scheduleRunCmd)
	scheduleCmd.AddCommand(scheduleShowCmd)

	rootCmd.AddCommand(scheduleCmd)
}
