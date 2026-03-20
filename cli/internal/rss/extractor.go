package rss

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

// siteSelectors maps hostnames to CSS selectors for site-specific content extraction.
var siteSelectors = map[string][]string{
	// 量子位
	"qbitai.com": {
		".single-content",
		".article-content",
		".post-content",
		"article .content",
		".entry-content",
	},
	// 36氪
	"36kr.com": {
		".article-content",
		".detail-content",
		".post-content",
		"article",
	},
	// 虎嗅
	"huxiu.com": {
		".article-content",
		".article-content__body",
		".post-content",
	},
	// 少数派
	"sspai.com": {
		".article-content",
		".post-content",
		"#article-content",
	},
	// 知乎专栏
	"zhuanlan.zhihu.com": {
		".Post-RichText",
		".RichText",
		"article",
	},
	// 掘金
	"juejin.cn": {
		".article-content",
		".markdown-body",
		"article",
	},
	// InfoQ
	"infoq.cn": {
		".article-content",
		".post-content",
		"article",
	},
	// 机器之心
	"jiqizhixin.com": {
		".article-content",
		".post-content",
		"article",
	},
	// 新智元
	"aismart.org": {
		".article-content",
		".post-content",
	},
	// 博客园
	"cnblogs.com": {
		"#cnblogs_post_body",
		".postBody",
		".blogpost-body",
	},
	// CSDN
	"csdn.net": {
		"#article_content",
		".article-content",
		"#content_views",
	},
	// 微信公众号
	"mp.weixin.qq.com": {
		"#js_content",
		".rich_media_content",
	},
	// 微信转RSS代理
	"wechat2rss.bestblogs.dev": {
		".content",
	},
	// V2EX
	"v2ex.com": {
		".topic_content",
		".cell",
		"#topic_content",
	},
	// SegmentFault
	"segmentfault.com": {
		".article__content",
		".article-content",
		"article",
	},
	// 简书
	"jianshu.com": {
		".article",
		".show-content",
		"#article-content",
	},
	// OSChina
	"oschina.net": {
		".article-detail",
		".content",
		"#article-content",
	},
	// 知乎
	"www.zhihu.com": {
		".RichText",
		".Post-RichText",
		"article",
	},
	// 哔哩哔哩专栏
	"bilibili.com": {
		".article-holder",
		".article-content",
	},
	// 澎湃新闻
	"thepaper.cn": {
		".news_content",
		".news_txt",
		"#news_content",
	},
	// 界面新闻
	"jiemian.com": {
		".article-content",
		".news-content",
	},
	// 腾讯新闻
	"qq.com": {
		"#Cnt-Main-Article-QQ",
		".content-article",
		".article-content",
	},
	// 网易新闻
	"163.com": {
		"#endText",
		".post_content",
		".article-content",
	},
	// 搜狐
	"sohu.com": {
		".article-text",
		"#mp-editor",
		".article-content",
	},
	// 新浪
	"sina.com.cn": {
		".article",
		"#artibody",
		".article-content",
	},
	// 凤凰网
	"ifeng.com": {
		"#artibody",
		".article-content",
		"#main_content",
	},
	// TechCrunch
	"techcrunch.com": {
		".article-content",
		".entry-content",
		"article",
	},
	// The Verge
	"theverge.com": {
		".c-entry-content",
		".article-content",
	},
	// Hacker News
	"news.ycombinator.com": {
		".toptext",
	},
	// Medium
	"medium.com": {
		"article",
		".meteredContent",
	},
	// Dev.to
	"dev.to": {
		".article-body",
		"#article-body",
		"article",
	},
}

// generalSelectors lists CSS selectors for generic content extraction.
var generalSelectors = []string{
	"article",
	"[role=\"main\"]",
	"[role=\"article\"]",
	"main",
	".post-content",
	".entry-content",
	".article-content",
	".single-content",
	".post-body",
	".content-body",
	".content",
	"#content",
	".article-body",
	".news-content",
	".detail-content",
	".post",
	".article",
	"[class*=\"article-content\"]",
	"[class*=\"post-content\"]",
	"[class*=\"entry-content\"]",
	"[class*=\"article-body\"]",
	"[id*=\"article-content\"]",
	"[id*=\"post-content\"]",
}

// unwantedSelectors lists selectors for elements to remove before extraction.
var unwantedSelectors = []string{
	"script", "style", "noscript", "iframe", "svg",
	"nav", "header", "footer", "aside",
	".sidebar", ".widget", ".ad", ".ads", ".advertisement",
	".share", ".social", ".comment", ".comments", ".related",
	".recommend", ".hot-posts", ".popular",
	"[role=\"navigation\"]", "[role=\"banner\"]", "[role=\"contentinfo\"]",
	"[style*=\"display: none\"]", "[style*=\"display:none\"]", "[hidden]",
}

var positivePattern = regexp.MustCompile(`(?i)article|content|post|entry|body|text|main`)
var negativePattern = regexp.MustCompile(`(?i)sidebar|widget|footer|header|nav|menu|comment|share|related|ad|banner`)
var chinesePunctuation = regexp.MustCompile(`[，。！？、；：]`)

// removeUnwantedElements removes script/style/nav/aside/ad/share etc. from the document.
func removeUnwantedElements(doc *goquery.Document) {
	doc.Find(strings.Join(unwantedSelectors, ", ")).Remove()
}

// extractBySiteSpecific tries site-specific CSS selectors for known sites.
func extractBySiteSpecific(doc *goquery.Document, hostname string) string {
	selectors, ok := siteSelectors[hostname]
	if !ok {
		return ""
	}

	for _, sel := range selectors {
		el := doc.Find(sel).First()
		if el.Length() == 0 {
			continue
		}

		text := strings.TrimSpace(el.Text())
		if len(text) < 200 {
			continue
		}

		// Clean internal unwanted elements
		el.Find("script, style, .ad, .ads, .share, .related").Remove()
		html, err := el.Html()
		if err == nil && html != "" {
			return html
		}
	}

	return ""
}

// extractByGeneralSelectors tries common content selectors.
func extractByGeneralSelectors(doc *goquery.Document) string {
	for _, sel := range generalSelectors {
		var bestEl *goquery.Selection
		maxLen := 0

		doc.Find(sel).Each(func(_ int, s *goquery.Selection) {
			text := strings.TrimSpace(s.Text())
			if len(text) > maxLen {
				maxLen = len(text)
				bestEl = s
			}
		})

		if bestEl == nil || maxLen < 200 {
			continue
		}

		bestEl.Find("script, style, .ad, .ads, .share, .related, .sidebar, nav, aside").Remove()
		html, err := bestEl.Html()
		if err == nil && html != "" {
			return html
		}
	}

	return ""
}

// extractByDensityAnalysis uses simplified Readability-style text density analysis.
func extractByDensityAnalysis(doc *goquery.Document) string {
	candidateTags := []string{"div", "section", "article", "main"}
	var bestEl *goquery.Selection
	bestScore := 0.0

	for _, tag := range candidateTags {
		doc.Find(tag).Each(func(_ int, s *goquery.Selection) {
			text := strings.TrimSpace(s.Text())
			if len(text) < 200 {
				return
			}

			score := calculateContentScore(s)
			if score > bestScore {
				bestScore = score
				bestEl = s
			}
		})
	}

	if bestEl == nil || bestScore < 10 {
		return ""
	}

	bestEl.Find("script, style, .ad, .ads, .share, .related, .sidebar, nav, aside, footer").Remove()
	html, err := bestEl.Html()
	if err == nil && html != "" {
		return html
	}

	return ""
}

// calculateContentScore computes a content score for an element based on text density.
func calculateContentScore(el *goquery.Selection) float64 {
	text := strings.TrimSpace(el.Text())

	// Base score: text length
	score := float64(len(text)) / 100.0
	if score > 50 {
		score = 50
	}

	// Paragraph count bonus
	pCount := el.Find("p").Length()
	score += float64(pCount) * 2

	// Link density penalty
	linkText := strings.TrimSpace(el.Find("a").Text())
	if len(text) > 0 {
		linkDensity := float64(len(linkText)) / float64(len(text))
		if linkDensity > 0.3 {
			score *= 0.5
		}
	}

	// Image count (moderate bonus)
	imgCount := el.Find("img").Length()
	score += float64(imgCount)

	// Positive keyword bonus
	className, _ := el.Attr("class")
	id, _ := el.Attr("id")
	if positivePattern.MatchString(className) || positivePattern.MatchString(id) {
		score *= 1.5
	}

	// Negative keyword penalty
	if negativePattern.MatchString(className) || negativePattern.MatchString(id) {
		score *= 0.2
	}

	// Chinese punctuation density
	punctCount := len(chinesePunctuation.FindAllString(text, -1))
	score += float64(punctCount) * 0.5

	return score
}

// extractFallback is the last resort: remove noise from body and return what's left.
func extractFallback(doc *goquery.Document) string {
	body := doc.Find("body").Clone()
	removeUnwantedElementsFromSel(body)

	text := strings.TrimSpace(body.Text())
	if len(text) < 200 {
		return ""
	}

	html, err := body.Html()
	if err == nil && html != "" {
		return html
	}

	return ""
}

// removeUnwantedElementsFromSel removes unwanted elements from a Selection (used for clones).
func removeUnwantedElementsFromSel(s *goquery.Selection) {
	s.Find(strings.Join(unwantedSelectors, ", ")).Remove()
}

// FetchFullContent fetches a URL and extracts the main article content using a 4-layer strategy.
func FetchFullContent(rawURL string, timeout time.Duration, userAgent string, proxyURL string) string {
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	if userAgent == "" {
		userAgent = "Mozilla/5.0 (compatible; RSS-Post/1.0)"
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", rawURL, nil)
	if err != nil {
		return ""
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,*/*")

	transport := &http.Transport{}
	if proxyURL != "" {
		if pu, err := url.Parse(proxyURL); err == nil {
			transport.Proxy = http.ProxyURL(pu)
		}
	}

	client := &http.Client{
		Timeout:   timeout,
		Transport: transport,
	}
	resp, err := client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return ""
	}

	// Limit to 2MB
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if err != nil {
		return ""
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(string(body)))
	if err != nil {
		return ""
	}

	return extractFromDocument(doc, rawURL)
}

// extractFromDocument runs the 4-layer extraction strategy on a parsed document.
func extractFromDocument(doc *goquery.Document, rawURL string) string {
	removeUnwantedElements(doc)

	// Extract hostname for site-specific matching
	u, err := url.Parse(rawURL)
	hostname := ""
	if err == nil {
		hostname = u.Hostname()
	}

	// Layer 1: Site-specific selectors
	if hostname != "" {
		if content := extractBySiteSpecific(doc, hostname); content != "" {
			return cleanHTML(content)
		}
	}

	// Layer 2: General selectors
	if content := extractByGeneralSelectors(doc); content != "" {
		return cleanHTML(content)
	}

	// Layer 3: Density analysis
	if content := extractByDensityAnalysis(doc); content != "" {
		return cleanHTML(content)
	}

	// Layer 4: Fallback
	if content := extractFallback(doc); content != "" {
		return cleanHTML(content)
	}

	return ""
}

// cleanHTML performs basic HTML cleanup: strip empty paragraphs.
func cleanHTML(html string) string {
	if html == "" {
		return html
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return html
	}

	// Remove empty/short paragraphs without images
	doc.Find("p").Each(func(_ int, s *goquery.Selection) {
		text := strings.TrimSpace(s.Text())
		if text == "" || (s.Find("img").Length() == 0 && len(text) < 5) {
			s.Remove()
		}
	})

	result, err := doc.Html()
	if err != nil {
		return html
	}
	return result
}
