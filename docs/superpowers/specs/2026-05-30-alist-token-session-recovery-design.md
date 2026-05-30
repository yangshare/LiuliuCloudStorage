# Alist Token Session Recovery Design

## Context

The application can show a misleading sequence of notifications after resuming downloads:

- "队列已恢复"
- "Alist 认证失效"
- "下载失败"

Logs show the underlying failure:

- `AlistService.getDownloadUrl` returns `code=401, message=token is expired`.
- `DownloadQueueManager` pauses the queue after detecting auth failure.
- `AutoSyncService` can continue into a normal-looking remote scan result with `0` files when the real cause is expired authentication.

Code inspection found two renderer-side token propagation defects:

- `LoginView` stores `token: ''` in `authStore` after login.
- `HomeView` calls `initDownloadQueue(authStore.user.id, authStore.token)`, but the store has no top-level `token`; the token lives on `authStore.user.token`.

These renderer issues are real, but the deeper design issue is that download queue and auto-sync flows can depend on stale or missing renderer-provided tokens instead of a main-process session authority.

## Goals

- Make the main process the authority for Alist token validity.
- Prevent expired Alist tokens from being treated as ordinary download failures.
- Avoid marking batches as failed when the only problem is authentication.
- Prevent auto-sync from reporting normal empty scans when authentication failed.
- Keep the user-facing state clear: either the queue resumes successfully, or the app asks the user to re-login before resuming.

## Non-Goals

- Do not add new persistent transfer statuses such as `auth_waiting`.
- Do not redesign the full queue database schema.
- Do not implement long-term history pruning for the `completed=60480` case in this change. That is a separate performance-hardening task.
- Do not change the app's visual design beyond notification wording and routing behavior needed for this flow.

## Recommended Approach

Use centralized auth recovery in the main process.

The renderer should still keep `authStore.user.token` correct for UI flows that need it, but download queue restoration, queued downloads, and auto-sync should acquire tokens from `AuthService` before touching Alist.

When Alist returns an authentication error, the service that received the error should attempt exactly one session recovery. If recovery succeeds, retry the interrupted operation once. If recovery fails, pause or fail the current high-level workflow with an authentication-specific result instead of continuing as a normal transfer or scan failure.

## Authentication Design

### Renderer Token State

`LoginView` must store the token returned by `auth.login`:

- On successful login, use `result.data.token`.
- Continue to fetch current user details if needed for quota/admin metadata, but do not overwrite the token with an empty string.

`HomeView` should pass `authStore.user.token` if the existing IPC signature still requires a token argument. This keeps current renderer code coherent, but main-process code must not depend on this value as the source of truth.

### Main-Process Session Authority

`AuthService` should expose a method with this behavior:

- Return the current valid session when one exists.
- If no in-memory session exists, restore from the local session database.
- Validate restored tokens against Alist before returning them.
- If validation fails and auto-login credentials exist, perform automatic Alist login, save the new session, and return it.
- If validation fails and recovery cannot be completed, return an authentication-expired result.

This can be implemented as a new method such as `ensureValidSession()` or by extending `checkSession()` while preserving existing IPC response shapes. Internal services should call the explicit internal method so they do not need to parse renderer-oriented IPC payloads.

`getCurrentUser()` remains a user-profile method. It should not become a token retrieval path.

## Download Queue Design

### Queue Initialization

`transfer:download:init-queue` may keep accepting `{ userId, userToken }` to avoid broad preload/type churn, but the handler should prefer the main-process session:

1. Call the session authority to ensure the Alist token is valid.
2. If valid, initialize queue credentials from that session.
3. Restore pending and in-progress downloads.
4. Fetch queue state.
5. If invalid, do not restore or start downloads. Return an auth-specific failure that the renderer can present as "请重新登录后恢复下载".

### Starting Downloads

Before `DownloadQueueManager.startDownload()` calls `alistService.getDownloadUrl()`:

1. Ensure a valid session in the main process.
2. Set `alistService` token, base path, and user id from that valid session.
3. Get the download URL.

If `getDownloadUrl()` fails with an auth error:

1. Pause the queue immediately so no more tasks start with the same invalid token.
2. Attempt one session recovery.
3. If recovery succeeds, restore queue concurrency and retry the same task once.
4. If recovery fails, keep the task pending or requeue it, send a single auth-failed event, and do not send ordinary download-failed events for that task.

Only non-auth failures should mark a task `failed` and send `transfer:download:failed`.

### Resume Button Behavior

When the user clicks "恢复队列":

- If the session can be validated or refreshed, resume the queue and show "队列已恢复".
- If the session is invalid and cannot be refreshed, keep the queue paused and show "Alist 登录已过期，请重新登录后恢复下载".

This prevents the misleading notification combination where the UI says the queue resumed immediately before reporting auth failure and file failures.

## Auto-Sync Design

Auto-sync should treat authentication failure as a workflow-level failure, not as an empty scan.

Before these stages, auto-sync should ensure a valid session:

- Share transfer execution that requires Alist follow-up.
- Remote root scan.
- Recursive remote directory scan.
- Diff-to-download queue creation.

If an Alist operation fails with `token is expired`, `401`, or a guest-user auth response:

1. Attempt one session recovery.
2. Retry the interrupted stage once if recovery succeeds.
3. If recovery fails, mark the sync run as `failed`.
4. Emit progress with a clear message: `Alist 登录已过期，请重新登录后重试同步`.
5. Do not log or emit a normal "scanned 0 directories, found 0 files" completion for the auth-failed scan.

The global auto-sync progress card should show the failed state. Clicking an authentication-failed sync card should route to the login page or a session recovery entry point, not only to the share-transfer page.

## Error Classification

Introduce a small shared classifier in the main process for Alist auth errors. It should identify:

- HTTP status `401`.
- Alist response code `401`.
- Messages containing `token is expired`.
- Messages indicating guest or unauthenticated user.

Download queue and auto-sync should both use this classifier so auth handling does not drift across features.

## Notification Behavior

Download auth failure should produce one durable notification:

- Title: `Alist 认证失效`
- Message: `Alist 登录已过期，请重新登录后恢复下载`

On successful re-login or successful queue resume, the app should replace or close the stale auth-failed notification where practical. If the notification API cannot close prior notifications cleanly, the app should at least avoid adding ordinary `下载失败 N 个文件` notifications for auth-only failures.

Batch notifications should count auth-blocked tasks separately from true failures. For this change, auth-blocked tasks should be silent at the file level because the global auth notification already explains the blocker.

## Testing

### Unit Tests

Add or update tests for `AuthService`:

- Restored local session with valid Alist token returns a valid session.
- Restored local session with expired Alist token and available auto-login credentials refreshes the token and returns the new session.
- Restored local session with expired Alist token and no usable credentials returns an auth-expired result.

Add or update tests for `DownloadQueueManager`:

- Auth failure from `getDownloadUrl()` pauses the queue and emits one auth-failed event.
- Auth failure does not mark the task as ordinary `failed` when session recovery fails.
- Successful recovery retries the current task once and continues the queue.
- Non-auth `getDownloadUrl()` failures still mark the task failed.

Add or update tests for `AutoSyncService`:

- Remote scan auth failure does not produce a normal zero-file scan success.
- Successful session recovery retries the failed scan stage once.
- Failed session recovery marks the run failed with the auth-expired message.

### Renderer Tests

Update renderer tests for:

- `LoginView` stores the login result token in `authStore`.
- `HomeView` initializes the download queue with `authStore.user.token` if the IPC signature still receives a token.
- Auth-only download failures do not show an additional `下载失败 N 个文件` notification.

## Acceptance Criteria

- After login, `authStore.user.token` is non-empty when the login response contains a token.
- Download queue initialization does not rely on `authStore.token`.
- A locally unexpired but Alist-expired token is detected before queue restoration starts downloads.
- If auto-login can refresh the token, downloads and auto-sync continue without user action.
- If auto-login cannot refresh the token, the queue stays paused and tasks are not marked as ordinary failed solely because of auth expiration.
- Auto-sync auth expiration results in a failed run with an authentication message, not a successful empty scan.
- The user no longer sees the misleading sequence "队列已恢复" followed by "下载失败" for auth-only failures.

## Implementation Boundaries

The implementation should touch only the authentication, download queue, auto-sync, and directly related renderer notification paths. It should not perform unrelated UI redesign, queue schema expansion, or historical task pruning.
