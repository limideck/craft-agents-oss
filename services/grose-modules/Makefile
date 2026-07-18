.PHONY: build tidy run test dist dist-host clean

GO ?= go
BIN_DIR := bin
DIST_DIR := dist
BINARY := grose-modules

# Darwin: CGO on so Go uses the macOS system DNS resolver. Pure-Go DNS
# (CGO_ENABLED=0) fails to resolve public hosts on some macOS configs, which
# surfaced as SSRF "Host did not resolve" for legitimate feeds (e.g. sspai.com).
build:
	@os=$$($(GO) env GOOS); \
	if [ "$$os" = "darwin" ]; then \
	  CGO_ENABLED=1 $(GO) build -o $(BIN_DIR)/$(BINARY) .; \
	else \
	  $(GO) build -o $(BIN_DIR)/$(BINARY) .; \
	fi

tidy:
	$(GO) mod tidy

test:
	$(GO) test ./...

run: build
	./$(BIN_DIR)/$(BINARY) --port $${PORT:-4711}

# Host platform only → dist/<goos>-<goarch>/grose-modules[.exe]
dist-host:
	@mkdir -p $(DIST_DIR)
	@os=$$($(GO) env GOOS); arch=$$($(GO) env GOARCH); \
	 out="$(DIST_DIR)/$${os}-$${arch}"; \
	 mkdir -p "$$out"; \
	 name="$(BINARY)"; \
	 if [ "$$os" = "windows" ]; then name="$(BINARY).exe"; fi; \
	 cgo=0; if [ "$$os" = "darwin" ]; then cgo=1; fi; \
	 echo "building $$out/$$name (CGO_ENABLED=$$cgo)"; \
	 CGO_ENABLED=$$cgo $(GO) build -trimpath -ldflags="-s -w" -o "$$out/$$name" .

# Cross-compile common Electron targets.
# Linux/Windows: CGO off (modernc sqlite, no cross-cgo).
# Darwin: CGO on when the host is darwin (system DNS); otherwise CGO off
# (cross-cgo for macOS needs an SDK — prefer building darwin artifacts on a Mac).
dist:
	@mkdir -p $(DIST_DIR)
	@set -e; \
	host_os=$$($(GO) env GOOS); \
	for pair in "darwin arm64" "darwin amd64" "linux amd64" "linux arm64" "windows amd64"; do \
	  set -- $$pair; os=$$1; arch=$$2; \
	  out="$(DIST_DIR)/$${os}-$${arch}"; \
	  mkdir -p "$$out"; \
	  name="$(BINARY)"; \
	  if [ "$$os" = "windows" ]; then name="$(BINARY).exe"; fi; \
	  cgo=0; \
	  if [ "$$os" = "darwin" ] && [ "$$host_os" = "darwin" ]; then cgo=1; fi; \
	  echo "building $$out/$$name (CGO_ENABLED=$$cgo)"; \
	  CGO_ENABLED=$$cgo GOOS=$$os GOARCH=$$arch $(GO) build -trimpath -ldflags="-s -w" -o "$$out/$$name" .; \
	done

clean:
	rm -rf $(BIN_DIR) $(DIST_DIR)
