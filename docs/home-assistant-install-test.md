# Home Assistant installation acceptance test

This test must be completed on a reachable Home Assistant system with Apps
(formerly Add-ons) support before the pull request is merged. Do not paste a
Home Assistant token into this repository, an issue, a pull request, or test
output.

## Installation

1. In **Settings → Apps → App store → ⋮ → Repositories**, add
   `https://github.com/wiredchaos/hermes-skinscape`.
2. Refresh the store and open **Hermes Skinscape Bridge**.
3. Select **Install**, wait for the image build to finish, and record whether
   installation succeeds for the machine's architecture.
4. Select **Start**. Inspect the app log and confirm that the server listens on
   port `8099` without a traceback or restart loop.
5. Enable **Show in sidebar**, select the sidebar entry, and confirm the ingress
   page loads without a 401, 404, blank frame, or mixed-content error.

## Upload, playback, persistence, and replacement

1. Prepare a small animated ASCII video encoded as WebM (not an MP4 renamed to
   `.webm`). Keep this fixture outside the repository if it is not licensed for
   redistribution.
2. In the ingress panel, choose the WebM and select **Replace active media**.
   Confirm the success message appears and the video loops in the player.
3. Seek to several positions. In browser developer tools, confirm media
   requests remain beneath the current `/api/hassio_ingress/.../` prefix and a
   seek request receives `206 Partial Content` with `Accept-Ranges: bytes` and
   a valid `Content-Range` header.
4. Stop and start (or restart) the app. Reopen the ingress panel and confirm the
   same media still plays. This verifies that `active.webm` survived in `/data`.
5. Upload a different valid WebM. Confirm the player reloads and plays the
   replacement, then restart once more and confirm the replacement persists.
6. Negative check: attempt to upload a text file or MP4. Confirm it is rejected
   and the previously active WebM remains playable.

Record the Home Assistant version, installation type, host architecture, app
log outcome, and pass/fail result for each step in the pull request. Do not
merge until this test passes and GitHub Actions is green.
