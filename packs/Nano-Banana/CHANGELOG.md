# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Optional `image` input for image-conditioned generation requests.
- In-memory response cache.

### Changed
- Node now skips API calls and returns cached output when the same image size, prompt, size, and resolution are provided.
