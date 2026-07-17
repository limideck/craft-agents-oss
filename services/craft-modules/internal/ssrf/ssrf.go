// Package ssrf blocks requests to private/link-local/loopback addresses.
//
// Validation happens at dial time (and on redirects) so DNS rebinding cannot
// bypass checks. Hostnames are resolved with the process DNS resolver; on
// macOS, craft-modules should be built with CGO enabled so the system
// resolver is used (pure-Go DNS fails on some macOS configurations).
package ssrf

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"time"
)

var privateV4CIDRs = mustCIDRs(
	"0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8",
	"169.254.0.0/16", "172.16.0.0/12", "192.168.0.0/16",
)

func mustCIDRs(cidrs ...string) []*net.IPNet {
	out := make([]*net.IPNet, 0, len(cidrs))
	for _, c := range cidrs {
		_, n, err := net.ParseCIDR(c)
		if err != nil {
			panic(err)
		}
		out = append(out, n)
	}
	return out
}

func isPrivateIPv4(ip net.IP) bool {
	for _, n := range privateV4CIDRs {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

func isPrivateIP(ip net.IP) bool {
	if v4 := ip.To4(); v4 != nil {
		return isPrivateIPv4(v4)
	}
	return ip.IsLoopback() || ip.IsUnspecified() || ip.IsPrivate() || ip.IsLinkLocalUnicast()
}

// AssertSafeURL validates scheme and blocks literal private IPs.
// Hostname DNS is intentionally deferred to DialContext so resolution uses the
// same path as the actual connection and errors stay accurate.
func AssertSafeURL(_ context.Context, raw string) error {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return errors.New("invalid URL")
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return errors.New("only http/https URLs are allowed")
	}
	host := u.Hostname()
	if host == "" {
		return errors.New("invalid URL")
	}
	if ip := net.ParseIP(host); ip != nil {
		if isPrivateIP(ip) {
			return errors.New("blocked address")
		}
	}
	return nil
}

func dialSafe(ctx context.Context, network, addr string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}
	dialer := &net.Dialer{Timeout: 30 * time.Second}
	if ip := net.ParseIP(host); ip != nil {
		if isPrivateIP(ip) {
			return nil, errors.New("blocked address")
		}
		return dialer.DialContext(ctx, network, addr)
	}
	addrs, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, fmt.Errorf("host %q did not resolve: %w", host, err)
	}
	if len(addrs) == 0 {
		return nil, fmt.Errorf("host %q did not resolve", host)
	}
	var last error
	for _, a := range addrs {
		if isPrivateIP(a.IP) {
			last = errors.New("blocked address")
			continue
		}
		conn, dialErr := dialer.DialContext(ctx, network, net.JoinHostPort(a.IP.String(), port))
		if dialErr == nil {
			return conn, nil
		}
		last = dialErr
	}
	if last == nil {
		last = errors.New("blocked address")
	}
	return nil, last
}

// HTTPClient returns an HTTP client that refuses private destinations,
// including after redirects.
func HTTPClient(timeout time.Duration) *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.DialContext = dialSafe
	return &http.Client{
		Timeout:   timeout,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return errors.New("too many redirects")
			}
			return AssertSafeURL(req.Context(), req.URL.String())
		},
	}
}
