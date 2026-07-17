package ssrf

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestAssertSafeURL(t *testing.T) {
	ctx := context.Background()
	cases := []struct {
		raw     string
		wantErr string
	}{
		{"https://sspai.com/feed", ""},
		{"http://example.com/rss", ""},
		{"https://1.1.1.1/feed", ""},
		{"ftp://example.com/x", "only http/https"},
		{"https://127.0.0.1/feed", "blocked address"},
		{"http://10.0.0.1/", "blocked address"},
		{"http://192.168.1.1/", "blocked address"},
		{"http://169.254.169.254/", "blocked address"},
		{"http://[::1]/", "blocked address"},
		{"not-a-url", "invalid URL"},
		{"", "invalid URL"},
	}
	for _, tc := range cases {
		err := AssertSafeURL(ctx, tc.raw)
		if tc.wantErr == "" {
			if err != nil {
				t.Errorf("AssertSafeURL(%q): unexpected err %v", tc.raw, err)
			}
			continue
		}
		if err == nil {
			t.Errorf("AssertSafeURL(%q): want error containing %q", tc.raw, tc.wantErr)
			continue
		}
		if !strings.Contains(err.Error(), tc.wantErr) {
			t.Errorf("AssertSafeURL(%q): got %q, want substring %q", tc.raw, err.Error(), tc.wantErr)
		}
	}
}

func TestHTTPClientBlocksPrivateLiteral(t *testing.T) {
	client := HTTPClient(5 * time.Second)
	_, err := client.Get("http://127.0.0.1:9/")
	if err == nil {
		t.Fatal("expected error dialing loopback")
	}
	if !strings.Contains(err.Error(), "blocked address") {
		t.Fatalf("got %v, want blocked address", err)
	}
}

func TestCheckRedirectBlocksPrivate(t *testing.T) {
	client := HTTPClient(5 * time.Second)
	req, err := http.NewRequest(http.MethodGet, "http://127.0.0.1/secret", nil)
	if err != nil {
		t.Fatal(err)
	}
	via, err := http.NewRequest(http.MethodGet, "https://example.com/feed", nil)
	if err != nil {
		t.Fatal(err)
	}
	err = client.CheckRedirect(req, []*http.Request{via})
	if err == nil {
		t.Fatal("expected redirect to loopback to fail")
	}
	if !strings.Contains(err.Error(), "blocked address") {
		t.Fatalf("got %v, want blocked address", err)
	}
}
