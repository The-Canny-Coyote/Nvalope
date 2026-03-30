# Changelog

## [Unreleased] — Security & Licensing

### Security

- Fixed: Local AI (WebLLM) was accessible to all users without a premium entitlement.
  The Settings toggle and the assistant `send()` execution path both lacked an
  entitlement check. Any user on a WebGPU-capable device could enable the local LLM
  model and receive full LLM-quality responses without a `premium_ai` entitlement.
  This has been corrected at both the UI layer (Settings toggle is now locked for
  non-entitled users when the premium API is configured) and the execution layer
  (`AIChatSheet.send()` and receipt categorization now verify entitlement before
  entering the WebLLM path).

- Fixed: Receipt categorization via WebLLM was similarly unguarded and is now
  gated behind the same `premium_ai` entitlement check.

### Changed

- License updated from MIT to MIT + Commons Clause. Core app remains free for
  personal and self-hosted non-commercial use. Premium feature files
  (`src/app/premium/`, `src/app/hooks/usePremiumEntitlements.ts`,
  `src/app/services/advancedAssistant.ts`) are now additionally subject to the
  Commons Clause restriction. See LICENSE for full terms.
