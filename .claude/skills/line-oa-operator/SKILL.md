---
name: line-oa-operator
description: Use when implementing Cloudnex Sales or Customer LINE OA journeys, Flex button labels vs canonical command prefixes, Admin Commands overlay/glossary, quantity keyboard tray, catalog images, or i18n EN/TH copy. Read documents/LINE_OA_AGENT.md; do not duplicate its tables.
---

# LINE OA operator

Read [documents/LINE_OA_AGENT.md](../../../documents/LINE_OA_AGENT.md) first.

- Gate, OTP, and Flex `action.text` use **canonical** English prefixes. Users see Admin `labelEn`/`labelTh` and `src/services/i18n.ts`.
- One `resolveCommandReply`. Do not add a second LINE router.
- Code wins if it disagrees with the document; update both in the same change.

For webhook/router reuse only, also follow [line-feature](../line-feature/SKILL.md). For `APP_ENV` / deploy flags, follow [environments](../environments/SKILL.md).
