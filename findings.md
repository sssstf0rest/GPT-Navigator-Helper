# Current project findings

- Repository: https://github.com/sssstf0rest/GPT-Navigator-Helper. Local directory name intentionally remains ChatGPT-Conversation-Navigator.
- Main and the merged seamless-preparation branch matched at d2999c0 before cleanup.
- Current version: 0.6.4, automatic native-navigator preparation with bounded recovery and a read-only themed popup.
- The observed native minimum is five prompts; partial capture does not establish short history. Compatibility evidence and limitations live in docs/compatibility.md.
- Privacy policy: docs/privacy-policy.html. Store artwork: store-assets/. Latest ZIP/checksum: releases/.
- The supplied PNG icons are declared for extension and toolbar use in 0.6.2. Build verification enforces their presence, dimensions, and source equality.
- Generated build/test/capture outputs and artwork sources are ignored; source scripts recreate them. Legacy prototypes and releases are recoverable from Git history.
- Version 0.6.3 fixes excess transparent padding: the 32px mark now spans 28px instead of 22px. The SVG master remains unchanged; scripts/generate-icons.mjs reproducibly renders each PNG with size-specific padding.
- Publication reference: docs/chrome-web-store-submission.txt. User accepts Chrome 152 minimum and already hosts the policy; exact public URL has not been supplied. Chrome guidance requires disclosure of local data handling (https://developer.chrome.com/docs/webstore/program-policies/user-data-faq).
- Version 0.6.4 positions the helper as a fix for missing native navigation caused by incomplete history loading. Native eligibility limitations remain explicit; functionality and data practices are unchanged.
- All five store images now use white backgrounds and light popup captures. The generator automatically refreshes asset-manifest.json; extension light/dark functionality and release 0.6.4 are unchanged.
