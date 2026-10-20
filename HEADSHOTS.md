# Optional athlete headshots

Profile setup accepts an optional JPG, PNG or WebP image up to 5 MiB. The browser
re-encodes it as JPEG (maximum 640px longest edge and 512 KiB), discarding original
EXIF metadata. The original file is not uploaded. No face recognition is performed.

Apply `headshots-setup.sql` before deploying the frontend. It adds a nullable
`athlete_profiles.headshot_path` and the private `athlete-headshots` bucket. Existing
profiles continue to show initials. Ownership and UUID-format checks prevent
linking another user's object. Owner-only inserts/deletes, no update/upsert access.
Anonymous viewers can obtain a five-minute signed URL only for a photo linked to
a currently published profile; they cannot list the bucket.

Users select a photo, review the preview, and save their profile. Replacing/removing
a photo deletes the previous object after the profile update succeeds. A failed
save retains the draft and reuses the same immutable object on retry, avoiding
duplicate uploads. Failed/interrupted uploads can leave unlinked objects: review
the owner's folder during deletion requests. Delete via Storage API/dashboard,
never by deleting `storage.objects` metadata. Already-issued image URLs may remain
valid for up to five minutes after unpublishing. Other people can save public images.

Tests: `node --test work/headshots.test.mjs`, `node work/verify.mjs`.
The localhost-only isolated browser harness at `qa.html` covers previews,
compression, save/reload, retry, public rendering, removal and initials fallback
without real emails, file uploads, profiles or payments.
