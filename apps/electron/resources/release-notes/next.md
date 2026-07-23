# Pending Release Notes

This file accumulates release notes for the next unreleased version. PRs that add user-visible behavior should append a bullet to the relevant section here. Versioned files (`X.Y.Z.md`) are owned by the release skill — never create them in feature commits.

## Features

- **Fetch models for custom AI endpoints** — Custom (and Manifest) connection setup can call the endpoint's `/models` (with `/v1/models` fallback) and pick models into the Default Model field instead of typing IDs only. OpenAI-compatible relays are the primary path; Anthropic-compatible endpoints that omit listing still accept manual model IDs.
- **RSS Reader Module Actions** — Analysis chips (总结要点 / 结构拆解 / 事实清单 / 待验证点 / 反方观点 / 翻译, plus more) and selection translate/rewrite run silently via `moduleActionsRun` into an inline Reader result panel (copy / 发给 AI · 继续讨论). Chat opens only on escalate, with a short seed — not the internal MCP playbook. Underline/annotate stays local.
- **RSS Reader underline & annotate** — Select text in the RSS reader to underline/annotate via a floating popup with translate and rewrite actions.

## Improvements

## Bug Fixes

## Breaking Changes
