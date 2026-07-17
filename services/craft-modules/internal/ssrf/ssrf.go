package ssrf

import (
	"context"
	"errors"
	"net"
	"net/url"
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

func AssertSafeURL(ctx context.Context, raw string) error {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme == "" {
		return errors.New("Invalid URL")
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return errors.New("Only http/https URLs are allowed")
	}
	host := u.Hostname()
	if host == "" {
		return errors.New("Invalid URL")
	}
	if ip := net.ParseIP(host); ip != nil {
		if isPrivateIP(ip) {
			return errors.New("Blocked address")
		}
		return nil
	}
	addrs, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil || len(addrs) == 0 {
		return errors.New("Host did not resolve")
	}
	for _, a := range addrs {
		if isPrivateIP(a.IP) {
			return errors.New("Blocked address")
		}
	}
	return nil
}
