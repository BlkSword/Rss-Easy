package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"text/template"

	"github.com/spf13/cobra"
)

const serviceTemplate = `[Unit]
Description=RSS-Post CLI Daemon
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User={{.User}}
ExecStart={{.ExecPath}} daemon --check-interval {{.Interval}} --log {{.LogPath}}
Restart=on-failure
RestartSec=30
Environment=HOME={{.HomeDir}}

[Install]
WantedBy=multi-user.target
`

var installCmd = &cobra.Command{
	Use:   "install",
	Short: "Install as a systemd service",
	Long:  `Install RSS-Post as a systemd service for automatic startup on boot.`,
	Run: func(cmd *cobra.Command, args []string) {
		interval, _ := cmd.Flags().GetInt("check-interval")
		if interval == 0 {
			interval = 5
		}
		force, _ := cmd.Flags().GetBool("force")

		// Detect current executable path
		execPath, err := os.Executable()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error detecting executable path: %v\n", err)
			os.Exit(1)
		}
		// Resolve symlinks
		execPath, err = filepath.EvalSymlinks(execPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error resolving executable path: %v\n", err)
			os.Exit(1)
		}

		// Get current user
		currentUser, err := user.Current()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error getting current user: %v\n", err)
			os.Exit(1)
		}

		homeDir := currentUser.HomeDir
		logPath := filepath.Join(homeDir, ".rss-post", "daemon.log")

		// Ensure log directory exists
		if err := os.MkdirAll(filepath.Dir(logPath), 0755); err != nil {
			fmt.Fprintf(os.Stderr, "Error creating log directory: %v\n", err)
			os.Exit(1)
		}

		// Check if already installed
		const servicePath = "/etc/systemd/system/rss-post.service"
		if _, err := os.Stat(servicePath); err == nil && !force {
			fmt.Println("Service already installed. Use --force to reinstall.")
			fmt.Println("  rss-post install --force")
			return
		}

		// Generate service file
		data := struct {
			User      string
			ExecPath  string
			Interval  int
			LogPath   string
			HomeDir   string
		}{
			User:     currentUser.Username,
			ExecPath: execPath,
			Interval: interval,
			LogPath:  logPath,
			HomeDir:  homeDir,
		}

		tmpl := template.Must(template.New("service").Parse(serviceTemplate))

		// Write to temp file first, then copy with sudo
		tmpFile, err := os.CreateTemp("", "rss-post.service.*")
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error creating temp file: %v\n", err)
			os.Exit(1)
		}
		defer os.Remove(tmpFile.Name())

		if err := tmpl.Execute(tmpFile, data); err != nil {
			fmt.Fprintf(os.Stderr, "Error generating service file: %v\n", err)
			os.Exit(1)
		}
		tmpFile.Close()

		// Copy service file
		fmt.Println("Installing systemd service...")
		run := func(name string, arg ...string) error {
			c := exec.Command(name, arg...)
			c.Stdout = os.Stdout
			c.Stderr = os.Stderr
			return c.Run()
		}

		if err := run("cp", tmpFile.Name(), servicePath); err != nil {
			// Try with sudo
			if err := run("sudo", "cp", tmpFile.Name(), servicePath); err != nil {
				fmt.Fprintf(os.Stderr, "Error copying service file: %v\n", err)
				os.Exit(1)
			}
		}

		// Reload systemd and enable
		reloadCmd := []string{"systemctl", "daemon-reload"}
		enableCmd := []string{"systemctl", "enable", "rss-post.service"}
		startCmd := []string{"systemctl", "start", "rss-post.service"}

		for _, args := range [][]string{reloadCmd, enableCmd, startCmd} {
			if err := run(args[0], args[1:]...); err != nil {
				if err := run("sudo", args...); err != nil {
					fmt.Fprintf(os.Stderr, "Error running %v: %v\n", args, err)
					os.Exit(1)
				}
			}
		}

		fmt.Println("✓ RSS-Post service installed and started!")
		fmt.Printf("  Service:  %s\n", servicePath)
		fmt.Printf("  Binary:   %s\n", execPath)
		fmt.Printf("  Interval: %d min\n", interval)
		fmt.Printf("  Log:      %s\n", logPath)
		fmt.Println()
		fmt.Println("Commands:")
		fmt.Println("  sudo systemctl status rss-post   # Check status")
		fmt.Println("  sudo journalctl -u rss-post -f   # View logs")
		fmt.Println("  sudo systemctl stop rss-post     # Stop")
		fmt.Println("  rss-post uninstall               # Uninstall")
	},
}

var uninstallCmd = &cobra.Command{
	Use:   "uninstall",
	Short: "Uninstall systemd service",
	Run: func(cmd *cobra.Command, args []string) {
		const servicePath = "/etc/systemd/system/rss-post.service"

		run := func(name string, arg ...string) error {
			c := exec.Command(name, arg...)
			c.Stdout = os.Stdout
			c.Stderr = os.Stderr
			return c.Run()
		}

		// Stop, disable, remove
		for _, args := range [][]string{
			{"systemctl", "stop", "rss-post.service"},
			{"systemctl", "disable", "rss-post.service"},
		} {
			run(args[0], args[1:]...)
			run("sudo", args...)
		}

		if err := os.Remove(servicePath); err != nil {
			run("sudo", "rm", "-f", servicePath)
		}

		run("systemctl", "daemon-reload")
		run("sudo", "systemctl", "daemon-reload")

		fmt.Println("✓ RSS-Post service uninstalled.")
	},
}

func init() {
	installCmd.Flags().Int("check-interval", 5, "Feed check interval in minutes")
	installCmd.Flags().Bool("force", false, "Force reinstall even if already installed")

	rootCmd.AddCommand(installCmd)
	rootCmd.AddCommand(uninstallCmd)
}
