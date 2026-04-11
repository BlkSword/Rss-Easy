package email

import (
	"bytes"
	"crypto/tls"
	"encoding/base64"
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
	return s.SendWithAttachment(to, subject, htmlBody, "", "")
}

// SendWithAttachment sends an HTML email with an optional attachment.
// If attachName and attachContent are non-empty, the file is attached.
func (s *Sender) SendWithAttachment(to []string, subject, htmlBody, attachName, attachContent string) error {
	if len(to) == 0 {
		return fmt.Errorf("no recipients specified")
	}

	if s.from == "" {
		return fmt.Errorf("sender (from) not configured")
	}

	msg, err := s.buildMIME(to, subject, htmlBody, attachName, attachContent)
	if err != nil {
		return fmt.Errorf("build MIME message failed: %w", err)
	}

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

// buildMIME builds the full MIME message. When an attachment is provided,
// it uses multipart/mixed with the HTML body as the first part and the
// attachment as the second part.
func (s *Sender) buildMIME(to []string, subject, htmlBody, attachName, attachContent string) (string, error) {
	var buf bytes.Buffer
	now := time.Now().Format(time.RFC1123Z)

	// Headers
	buf.WriteString("From: " + s.from + "\r\n")
	buf.WriteString("To: " + strings.Join(to, ", ") + "\r\n")
	buf.WriteString("Subject: =?UTF-8?B?" + base64Encode(subject) + "?=\r\n")
	buf.WriteString("Date: " + now + "\r\n")
	if s.smtp.Username != "" {
		buf.WriteString("Reply-To: " + s.smtp.Username + "\r\n")
	}

	if attachName == "" {
		// Simple HTML-only message (backward compatible)
		buf.WriteString("MIME-Version: 1.0\r\n")
		buf.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
		buf.WriteString("\r\n")
		buf.WriteString(htmlBody)
	} else {
		// multipart/mixed: HTML body + attachment
		boundary := "----=_Part_" + fmt.Sprintf("%d", time.Now().UnixNano())
		buf.WriteString("MIME-Version: 1.0\r\n")
		buf.WriteString(fmt.Sprintf("Content-Type: multipart/mixed; boundary=\"%s\"\r\n", boundary))
		buf.WriteString("\r\n")

		// HTML body part
		buf.WriteString(fmt.Sprintf("--%s\r\n", boundary))
		buf.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
		buf.WriteString("Content-Transfer-Encoding: base64\r\n")
		buf.WriteString("\r\n")
		buf.WriteString(encodeBase64Lines(htmlBody))
		buf.WriteString("\r\n")

		// Attachment part
		buf.WriteString(fmt.Sprintf("--%s\r\n", boundary))
		buf.WriteString(fmt.Sprintf("Content-Type: text/markdown; charset=UTF-8; name=\"%s\"\r\n", attachName))
		buf.WriteString(fmt.Sprintf("Content-Disposition: attachment; filename=\"%s\"\r\n", attachName))
		buf.WriteString("Content-Transfer-Encoding: base64\r\n")
		buf.WriteString("\r\n")
		buf.WriteString(encodeBase64Lines(attachContent))
		buf.WriteString("\r\n")

		// End boundary
		buf.WriteString(fmt.Sprintf("--%s--\r\n", boundary))
	}

	return buf.String(), nil
}

// encodeBase64Lines encodes data to base64 with 76-char line wrapping (RFC 2045).
func encodeBase64Lines(s string) string {
	encoded := base64.StdEncoding.EncodeToString([]byte(s))
	var buf bytes.Buffer
	for i := 0; i < len(encoded); i += 76 {
		end := i + 76
		if end > len(encoded) {
			end = len(encoded)
		}
		buf.WriteString(encoded[i:end])
		buf.WriteString("\r\n")
	}
	return buf.String()
}

func base64Encode(s string) string {
	return base64.StdEncoding.EncodeToString([]byte(s))
}
