.PHONY: build tidy run test dist dist-host clean

GO ?= go
BIN_DIR := bin
DIST_DIR := dist
BINARY := craft-modules

build:
	$(GO) build -o $(BIN_DIR)/$(BINARY) .

tidy:
	$(GO) mod tidy

test:
	$(GO) test ./...

run: build
	./$(BIN_DIR)/$(BINARY) --port $${PORT:-4711}

# Host platform only → dist/<goos>-<goarch>/craft-modules[.exe]
dist-host:
	@mkdir -p $(DIST_DIR)
	@os=$$($(GO) env GOOS); arch=$$($(GO) env GOARCH); \
	 out="$(DIST_DIR)/$${os}-$${arch}"; \
	 mkdir -p "$$out"; \
	 name="$(BINARY)"; \
	 if [ "$$os" = "windows" ]; then name="$(BINARY).exe"; fi; \
	 echo "building $$out/$$name"; \
	 CGO_ENABLED=0 $(GO) build -trimpath -ldflags="-s -w" -o "$$out/$$name" .

# Cross-compile common Electron targets (pure Go / modernc — no cgo)
dist:
	@mkdir -p $(DIST_DIR)
	@set -e; \
	for pair in "darwin arm64" "darwin amd64" "linux amd64" "linux arm64" "windows amd64"; do \
	  set -- $$pair; os=$$1; arch=$$2; \
	  out="$(DIST_DIR)/$${os}-$${arch}"; \
	  mkdir -p "$$out"; \
	  name="$(BINARY)"; \
	  if [ "$$os" = "windows" ]; then name="$(BINARY).exe"; fi; \
	  echo "building $$out/$$name"; \
	  CGO_ENABLED=0 GOOS=$$os GOARCH=$$arch $(GO) build -trimpath -ldflags="-s -w" -o "$$out/$$name" .; \
	done

clean:
	rm -rf $(BIN_DIR) $(DIST_DIR)
