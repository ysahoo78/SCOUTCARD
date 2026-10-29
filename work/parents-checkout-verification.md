# Parent page and checkout spacing — 2026-10-29

- Moved the parent marketing section from index.html to parents.html. The existing adult-managed dashboard remains family.html.
- Landing-page parent shortcut and shared footer now link to the separate information page. Legacy home #parents links redirect there.
- Scoped checkout styles keep consent checkboxes at 20px, text aligned beside them, labels at least 44px tall, email field at least 48px tall, and submit action at least 48px tall. Added consistent form padding and paragraph spacing.
- No checkout requirements, required consents, prices, payment integrations, sign-in, account data or database logic changed.

Local verification passed:
- Static syntax, linked files, duplicate IDs, URL safety and timeout checks.
- 50 responsive page/image/layout checks across 320, 332, 375, 768 and 1280px.
- Four checkout layouts (320/390/768/1280px): both required consents initially unchecked; checkbox/text alignment; label toggling; tap targets; no overflow. No order submission.
- 40 shared-footer layouts, including separate parent-page links, policies and cookie controls.
- 20 four-action navigation layouts, including the new parent page.
- Legacy parent-link redirect verified in the browser. Parent page and checkout screenshot visually inspected.

No emails, charges, live profile publication or database writes performed. Deployment is verified separately after source publication.
