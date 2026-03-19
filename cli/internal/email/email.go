package email

import (
	"crypto/tls"
	"fmt"
	"net/smtp"
	"strings"
	"time"
)

// SMTPConfig holds SMTP connection settings.
type SMTPConfig struct {
	Host               string `toml:"host"`
	Port               int    `toml:"port"`
	Username           string `toml:"username"`
	Password           string `toml:"password"`
	InsecureSkipVerify bool   `toml:"insecure_skip_verify"`
}

type Sender struct {
	from string
	smtp SMTPConfig
}

func NewSender2(from string, smtp SMTPConfig) *Sender {
	return &Sender{from: from, smtp: smtp}
}

// Send sends an HTML email to the specified recipients.
func (s *Sender) Send(to []string, subject, htmlBody string) error {
	if len(to) == 0 {
		return fmt.Errorf("no recipients specified")
	}

	if s.from == "" {
		return fmt.Errorf("sender (from) not configured")
	}

	msg := buildMIMEMessage(s.from, to, subject, htmlBody, s.smtp.Username)

	auth := smtp.PlainAuth("", s.smtp.Username, s.smtp.Password, s.smtp.Host)
	addr := fmt.Sprintf("%s:%d", s.smtp.Host, s.smtp.Port)

	tlsConfig := &tls.Config{
		ServerName: s.smtp.Host,
	}
	if s.smtp.InsecureSkipVerify {
		tlsConfig.InsecureSkipVerify = true
	}

	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("TLS dial failed: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, s.smtp.Host)
	if err != nil {
		return fmt.Errorf("SMTP client creation failed: %w", err)
	}
	defer client.Close()

	if err = client.Auth(auth); err != nil {
		return fmt.Errorf("SMTP auth failed: %w", err)
	}

	if err = client.Mail(s.from); err != nil {
		return fmt.Errorf("set sender failed: %w", err)
	}

	for _, r := range to {
		if err = client.Rcpt(r); err != nil {
			return fmt.Errorf("set recipient %s failed: %w", r, err)
		}
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("get data writer failed: %w", err)
	}

	if _, err = w.Write([]byte(msg)); err != nil {
		return fmt.Errorf("write message failed: %w", err)
	}

	if err = w.Close(); err != nil {
		return fmt.Errorf("close writer failed: %w", err)
	}

	return client.Quit()
}

// SendTest sends a test email to verify configuration.
func (s *Sender) SendTest(to string) error {
	subject := "RSS-Post CLI - 测试邮件"
	body := `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px;">
<h2>📧 RSS-Post CLI 邮件测试</h2>
<p>如果你收到这封邮件，说明邮件配置正确。</p>
<p>发送时间：` + time.Now().Format("2006-01-02 15:04:05") + `</p>
<hr>
<p style="color: #888; font-size: 12px;">RSS-Post CLI - AI 驱动的智能 RSS 信息聚合工具</p>
</body>
</html>`
	return s.Send([]string{to}, subject, body)
}

func buildMIMEMessage(from string, to []string, subject, htmlBody, username string) string {
	var sb strings.Builder

	sb.WriteString("From: " + from + "\r\n")
	sb.WriteString("To: " + strings.Join(to, ", ") + "\r\n")
	sb.WriteString("Subject: =?UTF-8?B?")
	sb.WriteString(base64Encode(subject))
	sb.WriteString("?=\r\n")
	sb.WriteString("MIME-Version: 1.0\r\n")
	sb.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	sb.WriteString("Date: " + time.Now().Format(time.RFC1123Z) + "\r\n")
	if username != "" {
		sb.WriteString("Reply-To: " + username + "\r\n")
	}
	sb.WriteString("\r\n")
	sb.WriteString(htmlBody)

	return sb.String()
}

func base64Encode(s string) string {
	const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

	src := []byte(s)
	encoded := make([]byte, ((len(src)+2)/3)*4)

	for i := 0; i < len(src); i += 3 {
		n := len(src) - i
		if n > 3 {
			n = 3
		}

		val := uint(src[i]) << 16
		if n > 1 {
			val |= uint(src[i+1]) << 8
		}
		if n > 2 {
			val |= uint(src[i+2])
		}

		encoded[i/3*4] = base64Chars[val>>18&0x3F]
		encoded[i/3*4+1] = base64Chars[val>>12&0x3F]

		if n > 1 {
			encoded[i/3*4+2] = base64Chars[val>>6&0x3F]
		} else {
			encoded[i/3*4+2] = '='
		}

		if n > 2 {
			encoded[i/3*4+3] = base64Chars[val&0x3F]
		} else {
			encoded[i/3*4+3] = '='
		}
	}

	return string(encoded)
}
