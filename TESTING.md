# Testing Trip VooDew

Automated tests for Trip VooDew: Jest + React Native Testing Library (RNTL)
for unit, service, and screen-level tests, plus optional Maestro flows for
end-to-end smoke testing on a real device/simulator.

## UI consistency revision: Image logo + branded date/time picker

- **Image component**: `app/index.js` now renders `assets/images/icon.png`
  (the app's existing approved icon/logo asset -- there was no separate
  "logo" file, and app.json already uses this same file as the app icon)
  via React Native's `Image` component in the Home header, with
  `accessibilityLabel="Trip VooDew logo"`. Covered by `app/__tests__/index.test.js`.
- **Branded date/time picker**: no new dependency was installed or needed.
  `DateField.js`/`TimeField.js` no longer import
  `@react-native-community/datetimepicker` at all -- they render a custom
  pink-branded modal built entirely from React Native core (`Modal`,
  `View`, `Text`, `Pressable`, `ScrollView`) plus this app's own
  `AppButton`/`Chip`:
  - `components/DateTimeModal.js` -- shared rounded-card chrome with a
    title, Cancel/Confirm actions, and a live "Aug 14, 2026" / "8:27 PM"
    -style preview of the pending selection.
  - `components/CalendarGrid.js` -- a real month-grid calendar (prev/next
    navigation, today highlighted, selected day filled pink, days before
    `minimumDate` grayed out and unpressable) built on two new pure
    helpers in `utils/dateUtils.js` (`buildCalendarMonth`, `getMonthLabel`,
    `addMonths`) so the month-matrix math is unit-tested the same way the
    rest of the date logic is.
  - `components/TimePickerBody.js` -- hour / 5-minute-increment / AM-PM
    selection as horizontally-scrollable rows of the existing pink `Chip`
    component.
  - Selection is staged locally and only committed via `onChange` on
    Confirm; Cancel discards it. `minimumDate` disables invalid calendar
    days directly in the UI (End Date can't visually select a day before
    Start Date), and every existing safety net -- `isEndDateValid` in
    Create/Edit Trip's `handleSave`, and the "date/time already passed"
    check in Reminders' `handleSave` -- is untouched and still runs.
  - `AppButton`/`Chip` gained an optional `testID` pass-through (needed so
    the picker's Cancel/Confirm/hour/minute/day controls don't collide
    with same-labeled buttons elsewhere on a screen); this is additive and
    doesn't change either component's behavior when omitted.
  - The `@react-native-community/datetimepicker` npm dependency and its
    manual mock are left in place but are no longer imported anywhere --
    removing an installed native module isn't necessary and risks
    requiring a native rebuild for no reason.

**Nothing in this suite ever contacts real Firebase, Google Maps/Places, or
push notification services.** Every external boundary is replaced with a
manual mock (see [Mocks](#mocks) below) before a single test runs.

## Final QA revision additions

On top of the 106 tests that were passing, this pass added coverage for:

- **Checklist reminders**: `checklist.test.js` now asserts that no
  `"Set reminder..."` text renders by default, that the bell action
  (`checklist-item-reminder-{id}`) is always present, that it links to a
  new reminder pre-linked to that item when none exists yet, and opens
  Reminders directly when one already does.
- **Expense editing**: new `app/trips/[tripId]/__tests__/expenses.test.js`
  covers pre-filling the form from an existing expense, saving via
  `updateExpense` (not `addExpense`), and canceling an edit.
- **Settlements**: `expenseCalculator.test.js` gained a full describe block
  for full/partial/multiple settlements, including the exact "$300 split
  three ways, one person pays their share" scenario from the spec.
  `tripService.test.js` covers the new `subscribeToSettlements` /
  `addSettlement` / `deleteSettlement` calls and the updated `deleteTrip`
  subcollection count (now 5, including `settlements`).
  `expenses.test.js` covers the Record Payment form end-to-end, including
  rejecting a payment to yourself and a settlement reducing the balance
  summary.
- **Cruise fields**: `create.test.js` covers the Destination →
  "Departure City / Port" relabel, the new optional Cruise Line/Ship Name
  fields appearing only for Cruise, and both being saved on the trip.

## Running the tests

```bash
npm install       # first time only, or after pulling dependency changes
npm test           # run once
npm run test:watch # re-run on file changes
npm run test:coverage # run with a coverage report
```

> **A note on this repo's history with `npm install` in sandboxed dev
> environments:** this project has twice hit an environment where `npm
> install` fails partway through with `ENOTEMPTY` while renaming a nested
> package directory (most recently `babel-plugin-istanbul`). This is a
> filesystem permission quirk of that specific sandbox, not a real problem
> with `package.json`. If you see it: run `npm install` again from a normal
> terminal on your own machine (not inside a restricted sandbox/container),
> or delete `node_modules` and reinstall. It has not reproduced outside that
> one environment.

## What's covered

### Unit tests (`utils/__tests__/`)

- **`expenseCalculator.test.js`** -- equal-split math, net balance
  calculation across multiple expenses, "who owes whom" settlement
  summaries, rounding behavior on uneven splits, and skip-on-invalid-input
  cases (zero amount, NaN amount, missing payer, empty split list).
- **`checklistTemplates.test.js`** -- In-Town Concert has no
  flight/hotel/cruise tasks; Out-of-Town Concert's Driving/Flying modes
  produce the right mode-specific tasks; the Cruise checklist matches the
  approved 14-item order exactly regardless of travel mode; generated
  checklists never mutate the master template.
- **`dateUtils.test.js`** -- local-date round-tripping (the historical
  UTC-shift bug this file exists to prevent), trip status labels for
  upcoming/today/in-progress/past trips, end-date-before-start-date
  rejection, and Firestore-shaped date-only strings parsing to the correct
  calendar day.
- **`validators.test.js`** -- required-field, amount, URL, and email
  validation, plus the generic `validateFields` field/rule runner.

### Service tests (`services/__tests__/tripService.test.js`)

Verifies every `tripService.js` function calls the (mocked) Firestore SDK
with the right collection/document paths and payload shapes -- not real
reads/writes. Covers trip create (including checklist-seeding from the
template), update, delete (and that delete cleans up every subcollection
first), and the checklist/reminder CRUD + subscribe helpers.

### Component tests (`components/__tests__/`)

- **`ChecklistRow.test.js`** -- toggle/edit/delete callbacks fire correctly,
  and the optional reminder `footer` renders only when provided.
- **`PlaceSearchField.test.js`** -- debounced search (via a mocked
  `placesService`), no-auto-select-while-typing (selection requires tapping
  a result card), no-matches and error states, the collapsed
  summary-card + "Change" flow once a place is selected, and the optional
  manual-entry fallback link.

### Screen tests (`app/**/__tests__/`)

- **`create.test.js`** -- default event type shows no transportation
  question; Out-of-Town Concert requires a transportation choice before
  saving; empty title blocks save; end date before start date blocks save;
  a valid form calls `createTrip` and navigates to the new trip; edit mode
  loads an existing trip and calls `updateTrip` instead of `createTrip`.
- **`checklist.test.js`** -- incomplete-item count, adding an item, toggling
  an item never auto-touches its linked reminder, completing an item WITH a
  linked reminder offers (but doesn't force) removing that reminder, and the
  "Set reminder..." / "Reminder set for ..." footer text is correct either
  way.
- **`reminders.test.js`** -- creating a reminder schedules a (mocked) local
  notification and saves the right Firestore fields; **saving a reminder
  whose date/time has already passed is rejected** (see
  [Fixes found by writing these tests](#fixes-found-by-writing-these-tests));
  toggling a reminder off cancels its scheduled notification; deleting a
  reminder requires confirming an alert before it's actually removed.

## Mocks

All mocks live in the root `__mocks__/` directory (Jest applies these
automatically for any `node_modules` package of the same name) or are set
up per-test-file with `jest.mock(...)` for local modules (`services/*.js`),
since Jest only auto-applies root mocks to `node_modules` packages.

| Mock | Replaces | Behavior |
|---|---|---|
| `__mocks__/firebase/app.js` | `firebase/app` | `initializeApp`/`getApps`/`getApp` as no-op stubs |
| `__mocks__/firebase/firestore.js` | `firebase/firestore` | every Firestore function as a trackable `jest.fn()`; `onSnapshot` fires once, synchronously, with an empty result |
| `__mocks__/expo-router.js` | `expo-router` | `useRouter`/`useLocalSearchParams`/`Link`/`Stack` |
| `__mocks__/expo-notifications.js` | `expo-notifications` | permission + schedule/cancel calls resolve deterministically, no OS notification is ever scheduled |
| `__mocks__/expo-location.js` | `expo-location` | fixed coordinates, no real device location or geocoding request |
| `__mocks__/react-native-maps.js` | `react-native-maps` | `MapView`/`Marker` render as plain `View`s |
| `__mocks__/@react-native-community/datetimepicker.js` | the native date/time picker | a pressable stand-in that fires a fixed date (`Aug 14, 2026, 9:00 AM`); screen tests that need two different dates use its `__setMockDate()` test-only export |
| `jest.mock("../../services/placesService")` (per test file) | Google Places REST calls | `searchPlaces` becomes a controllable `jest.fn()` |
| `jest.mock("../../services/tripService")` (per test file) | Firestore-backed trip service | every function becomes a controllable `jest.fn()` for screen tests |

`services/notificationService.js` is **not** mocked directly -- it's a thin
wrapper around `expo-notifications`, so letting it run for real against the
mocked `expo-notifications` module exercises the real integration (permission
check, `scheduleNotificationAsync` call shape) without ever touching a real
notification service.

## Fixes found by writing these tests

Writing these tests surfaced two real defects, fixed as part of this work
(not by weakening the tests to match the old behavior):

1. **Cruise checklist order didn't match the approved list.** The
   implemented template in `utils/checklistTemplates.js` had 10 items in a
   different order than the approved 14-item list (missing "Book cruise",
   "Book drink/dining packages", "Confirm embarkation details", and "Confirm
   disembarkation details" entirely). Fixed by replacing the template with
   the approved order and removing the now-unused travel-mode-specific
   cruise add-ons (the approved list's "Book travel to/from departure city"
   and "Arrange transportation to/from cruise port" already cover getting
   there generically, so the checklist no longer varies by travel mode for
   cruises -- the Create Trip screen still asks the transportation question
   for data purposes, it just no longer changes checklist wording).
2. **Reminders could be saved in the past.** `reminders.js`'s save handler
   validated that title/date/time were non-empty, but never checked that the
   combined date+time was actually in the future -- a reminder could be
   "created" for a moment already gone, silently never firing. Added a
   check that rejects the save with "Choose a date and time in the future."
   when the combined date/time is at or before now.

## Config fix: `transformIgnorePatterns`

The first real local run failed all 10 suites before any test executed,
with `SyntaxError: Unexpected token 'export'` from
`expo-modules-core/build/web/index.web.js`. `jest.config.js` had a
hand-written `transformIgnorePatterns` that overrode `jest-expo`'s own
(correct) default -- Jest doesn't merge preset config key-by-key, so setting
this key at all replaces the preset's value entirely. The hand-written
version grouped every allowed package under one shared trailing-`/`
requirement, which broke the bare `expo(nent)?` alternative for any
hyphenated package (`expo-modules-core`, `expo-router`,
`expo-notifications`, ...): it matches `expo`, then requires the very next
character to be `/`, but it's `-`. Fix: removed the override so
`jest-expo`'s own default (verified correct by reading the installed
`node_modules/jest-expo/jest-preset.js`) applies. **Don't reintroduce a
custom `transformIgnorePatterns` in this project** -- if another package
needs coverage, it almost certainly needs a manual mock (see
[Mocks](#mocks)) instead.

## Test-targeting fixes (round 2)

Once the suite actually ran, 4 of 106 tests failed -- all four turned out to
be the tests targeting the wrong control, not app defects:

- **`checklist.test.js`** (2 tests) and **`reminders.test.js`** (1 test)
  located the checkbox/delete button by walking up from a `Text` node with
  `.parent.parent...` and taking `findAllByType(Pressable)[0]` /
  `[length - 1]`. React Native's `Pressable` renders through more internal
  composite layers than that fixed-depth walk accounted for, so it
  sometimes grabbed the wrong element -- the real screens were already
  wiring `onToggle`/`onDelete` correctly. Fixed by adding stable,
  per-item `testID`s (`checklist-item-toggle-{id}`, `checklist-item-delete-{id}`,
  `reminder-delete-{id}`) to `ChecklistRow.js` and `reminders.js`, plus a
  matching `accessibilityLabel`/`accessibilityRole` on each (a genuine
  accessibility improvement, not just test plumbing), and updated the
  three tests to query by `testID`.
- **`create.test.js`** (1 test): `getByTestId("mock-date-picker")` was
  ambiguous once both the Start Date and End Date pickers were open at
  once. This exposed a real (minor) UI characteristic: `DateField`'s iOS
  inline picker doesn't auto-close on selection -- only Android's does --
  so opening Start Date, picking a value, then opening End Date without
  tapping "Done" leaves both pickers mounted simultaneously. That's not
  broken (both still work), so it wasn't changed; instead, `DateField` now
  accepts an optional `testID`, forwarded to both the tappable field and
  its picker (suffixed `-picker` so the two never collide), and Create
  Trip passes `"start-date"` / `"end-date"`. The test now targets each
  picker by its own ID instead of the shared default.

## Camera/image revision: Trip Cover Photo

Adds an optional cover photo to Create/Edit Trip, using the camera module's
`expo-image-picker` pattern (permission request -> launch -> crop -> display
via `Image`) rather than any new native picker UI.

- **New dependencies**: `expo-image-picker` (`~15.1.0`, the `sdk-51`
  dist-tag) and `expo-file-system` (`~17.0.1`, also the `sdk-51` dist-tag,
  and the latest stable release on that line -- `17.0.2` only exists as
  unreleased canary builds). Both are genuinely new native modules, so **a
  new native Android build is required** (`npx expo prebuild --clean` then
  `npx expo run:android`, or an EAS build) -- Metro alone cannot pick up a
  newly linked native module, same as the earlier
  `@react-native-community/datetimepicker` install did.
- **Why local storage, not Firebase Storage**: the persistence requirement
  is explicitly "save, leave, reopen, restart the app -- same device," with
  no cross-device or reinstall requirement. `expo-file-system`'s
  `documentDirectory` already satisfies that: it survives app restarts and
  is per-install-persistent, with zero setup, zero security-rule surface,
  and zero cost. Firebase Storage would add a bucket to configure, storage
  security rules to write and audit, a paid-plan dependency (Firestore's
  Spark/free tier is fine for this app's document reads/writes, but Storage
  bandwidth/storage past its free tier bills separately), and a new
  failure mode (upload over a bad connection) for a requirement that never
  asked for cross-device access. If a future requirement needs the photo to
  follow the trip across devices or survive a reinstall, that's the trigger
  to revisit this decision -- not before.
- **`services/imageService.js`** (new): `requestCameraPhoto()` /
  `requestLibraryPhoto()` request the relevant permission only at the
  moment the user presses the corresponding button (never on screen load),
  launch the picker with `allowsEditing: true` (cropping, where the OS
  supports it) and `quality: 0.6`, and return a normalized
  `{ status: "success" | "denied" | "cancelled", uri? }` -- never throwing
  on a denial. `persistCoverPhoto(uri)` copies the picker's (temporary
  cache) result into `FileSystem.documentDirectory + "tripCoverPhotos/"`
  and returns the new, stable uri; the picker's own uri is never saved
  directly, since it isn't guaranteed to survive an app restart.
  `deleteCoverPhoto(uri)` is a best-effort, never-throwing delete used for
  cleanup.
- **`components/CoverPhotoField.js`** (new): "Take Photo" / "Choose from
  Library" (relabeled "Retake Photo" / "Choose Different Photo" once a
  photo is set, doubling as the Replace action) plus a "Remove Photo"
  action once a photo exists. Renders the selection with `Image` and
  `accessibilityLabel="Trip cover photo"`. A permission denial shows an
  inline explanation (`/camera access/i` or `/photo library access/i`)
  instead of crashing or silently failing.
- **`app/trips/create.js`**: adds the field right under Trip Title;
  `coverPhotoUri` is saved on the trip (`null` when absent, matching every
  pre-existing trip). Edit mode loads the trip's saved `coverPhotoUri` and
  previews it. On a successful edit save, if the photo was replaced or
  removed, the *old* persisted file is deleted only after the save that
  drops its reference succeeds -- never before, so a cancelled edit or a
  failed save never orphans the trip's still-current photo. (Known, accepted
  minor limitation: replacing a cover photo more than once in the same
  *unsaved* Create session leaves the earlier picked-but-discarded local
  copies on disk -- a few small JPEGs, not a functional bug, and "if
  practical" scoped this out rather than adding cross-replace bookkeeping.)
- **`app/trips/[tripId]/index.js`** (Trip Dashboard): shows the cover photo
  at the top of the hero card via `Image` + `accessibilityLabel="Trip cover
  photo"` when present; renders nothing extra (no placeholder box) when
  absent, so the existing layout for photo-less trips is unchanged.
  Deleting a trip also best-effort deletes its local cover photo file
  (never blocks or fails the delete flow if there wasn't one, or if the
  file is already gone).
- **New mocks**: `__mocks__/expo-image-picker.js`, `__mocks__/expo-file-system.js`
  (root-level, auto-applied, matching the existing `expo-location.js` /
  `expo-notifications.js` pattern).
- **New/updated tests**: `services/__tests__/imageService.test.js` (real
  imageService logic against the mocked packages -- permission-denied,
  cancelled, directory-creation, extension fallback, delete-never-throws),
  `components/__tests__/CoverPhotoField.test.js` (preview renders after
  selection, Remove clears it, permission denial shows an explanation, a
  cancelled picker leaves the field untouched), `app/trips/__tests__/create.test.js`
  (new `describe("Trip Cover Photo")` block: saved on create, `null` when
  omitted, loaded/previewed in edit mode, existing trips without a photo
  load/save without crashing, removing-then-saving deletes the old file),
  and new `app/trips/[tripId]/__tests__/index.test.js` (Dashboard preview,
  no-photo-no-crash, delete-trip-deletes-photo, delete-trip-with-no-photo
  never crashes).

Native camera/library launch itself, permission dialogs, and cropping UI
are OS-level and can't be exercised in Jest -- see the manual test
checklist in the final report for that coverage.

## Post-camera-revision test fixes

Your local `npm test -- --runInBand` run (171 tests) surfaced 3 failures,
all in `expenses.test.js`, unrelated to the camera feature -- this was the
first real execution of that test file, written during the earlier
settlements/edit-expense revision. All 3 were test-targeting bugs, not app
defects: `expenses.js` legitimately shows `"$120.00"` in two places at once
(the Total Spent summary *and* the expense's own row) and legitimately
shows `"Add Expense"` in two places at once (the section heading *and* the
submit button), so `getByText` couldn't disambiguate. Fixed by adding
stable testIDs -- `expense-total-amount`, `expense-form-heading`,
`expense-form-submit`, `expense-form-cancel`, `settlement-form-submit`,
`settlement-form-cancel` -- to `app/trips/[tripId]/expenses.js`, and
updating the 3 affected tests in `expenses.test.js` to target those IDs
instead of ambiguous text. No UI text or behavior changed.

## Camera launch hang fix (emulator "Take Photo" spinner)

Manual testing found "Take Photo" spinning forever on the emulator without
ever opening a camera, while "Choose from Library" worked fine. Root cause:
some Android emulators (a bare AVD with no virtual camera configured under
Extended Controls > Camera) silently swallow the CAMERA intent -- no error,
no dialog -- so `launchCameraAsync()`'s promise never settles. That's an
emulator/OS limitation, not something fixable from app code, but the app
still can't leave its own button spinning indefinitely because of it.

- `services/imageService.js`: `requestCameraPhoto()` now races its *entire*
  flow -- the `requestCameraPermissionsAsync()` permission prompt **and**
  `launchCameraAsync` -- against a single 30-second timeout (`withTimeout`
  wrapping a new internal `cameraFlow()`). The first fix only wrapped the
  launch call; testing showed the hang can happen at the permission-prompt
  step too (the OS-level "Allow Trip VooDew to take pictures" dialog silently
  never resolving on some emulators), so the whole flow is covered now,
  not just one step of it. A timeout -- or any genuine rejection from
  either step -- resolves to `{ status: "error", message }` instead of
  throwing or hanging, with a message that tells an emulator tester
  exactly what to check ("make sure a virtual camera is enabled... or try
  Choose from Library instead"). `requestLibraryPhoto()` gets the same
  error-surfacing (a rejection now returns `{ status: "error", ... }`
  instead of throwing) but *not* the timeout -- a user actively scrolling a
  large library can legitimately take longer than any fixed bound, and it
  isn't the flow that's been observed to hang.
- `components/CoverPhotoField.js`: `handlePick`'s `finally` block already
  cleared the loading state on every path; it now also explicitly handles
  `status === "error"` and shows `result.message` as the inline notice, so
  a camera failure reads as an actionable explanation, not a silent
  timeout or a crash. The two action buttons were also switched from a
  side-by-side row to a stacked, full-width layout -- "Choose Different
  Photo" is long enough that, in a fixed-height two-up row, it could clip
  on narrow screens; stacking guarantees the longest label always fits.
- **On a real emulator**: enable Extended Controls > Camera > (Front/Back)
  and set it to "VirtualScene" or a webcam, or test on a physical device.
  The 30s timeout is a safety net so the app degrades gracefully either
  way, not a substitute for a working camera.
- New/updated tests in `services/__tests__/imageService.test.js` (timeout
  path via fake timers -- covering both the permission-prompt step and the
  launch step -- genuine-rejection-surfaced-as-error for both camera and
  library, a normal fast resolve is never affected by the timeout) and
  `components/__tests__/CoverPhotoField.test.js` (an error status shows
  the message and clears the button's loading/disabled state).

## Follow-up: camera crop step skipped on Android

Even with the emulator's virtual camera enabled, the timeout above still
fired -- meaning something in the camera-capture flow itself was hanging,
not just an unconfigured/missing emulator camera. The remaining suspect is
`allowsEditing: true`'s chained crop activity after a fresh camera
capture: this is a long-standing, widely reported reliability problem with
`expo-image-picker`/Android (not specific to this app or this emulator),
distinct from the photo-library picker's own crop step, which is
confirmed working here.

- `services/imageService.js` now uses two separate option objects:
  `LIBRARY_OPTIONS` (`allowsEditing: true` on both platforms -- unaffected,
  confirmed working) and `CAMERA_OPTIONS` (`allowsEditing: Platform.OS ===
  "ios"` -- crop stays on for iOS, where the camera crop UI doesn't have
  this issue, and is skipped on Android so a freshly captured photo is
  used as-is rather than risking the hang). This still satisfies "allow
  cropping when supported" -- it isn't reliably supported for
  camera-capture on Android, so the app degrades gracefully there instead
  of hanging.
- New test: `requestCameraPhoto` with `Platform.OS` set to `"android"`
  asserts `allowsEditing: false` is passed to `launchCameraAsync`; the
  existing default test (this jest environment resolves `Platform` to
  `Platform.ios.js`) continues to assert `allowsEditing: true` for iOS.
- **If Take Photo still hangs or fails after this change**, that would
  point away from the crop step and toward this specific AVD/system image
  not having a Camera app registered to handle the capture intent at all
  (some minimal or non-Google-Play system images lack one even with a
  virtual camera enabled) -- the next thing to try would be a different
  system image (one with Google Play services) or a physical Android
  device.

## Follow-up: still times out with Rear=VirtualScene, Front=Emulated

Manual testing confirmed: permission grants correctly, the spinner no
longer hangs (graceful timeout works as designed), but `launchCameraAsync`
still never settles even with a working rear virtual camera configured.

- **No camera-type bug found**: `getCameraOptions()` never set
  `cameraType` at all before this pass, and SDK 51's own default when it's
  omitted is `CameraType.back` -- so the front camera (the one *without*
  VirtualScene on this AVD) was never actually being requested. Made this
  explicit anyway (`cameraType: ImagePicker.CameraType.back`) purely to
  remove any doubt, with a new test (`"always requests the rear camera
  explicitly, never the front camera"`) asserting it.
- **The exact exception**: there isn't one to show -- and that itself is
  the diagnostic finding. Seeing the *exact* timeout message (not some
  other native error string) proves `launchCameraAsync` (and the
  permission prompt before it) never resolved *or* rejected within the
  30s window; nothing was ever thrown to catch and display. Added logging
  in `requestCameraPhoto`'s catch block so this is visible in Metro/adb
  logcat going forward, distinguishing the two cases instead of guessing:
  a timeout logs `"...timed out -- launchCameraAsync (or the permission
  prompt) never resolved or rejected..."`; a genuine native rejection logs
  `"...launchCameraAsync threw:"` followed by the full `Error` object.
- **Compared against SDK 51's `expo-image-picker` docs**: `mediaTypes`,
  `cameraType`, `allowsEditing`, `quality`, the
  `requestCameraPermissionsAsync`/`launchCameraAsync` call shape, and the
  `{ canceled, assets: [{ uri }] }` result shape are all used exactly as
  documented for that version -- nothing deprecated or misnamed.
- **Assessment**: this reads as a known Android-emulator limitation, not
  an app bug -- specifically, the emulator's camera Activity not properly
  delivering its result back to the calling app (`onActivityResult` never
  firing), a long-documented category of issue across many Expo/RN camera
  GitHub threads, independent of whether VirtualScene is configured.
  Everything on this app's side of the boundary (permission request,
  option shape, promise handling, timeout, graceful degradation, logging)
  is implemented per spec and verified by tests -- there's no further
  code-level lever to pull without native Android/emulator debugging this
  agent can't perform. **Not independently verified against a physical
  device or a different AVD system image** -- that's the recommended next
  step if the emulator continues to be unreliable for this specific flow.
- New tests: `cameraType` assertion above, plus two logging assertions
  (`"logs the full native error when launchCameraAsync genuinely rejects"`
  and an extended assertion on the existing timeout test) confirming the
  two failure modes are distinguishable in the console output.

## Correction: not an emulator limitation -- root cause found and fixed

The "Assessment" in the section above was wrong, and is superseded by this
one. It was reached by process of elimination without being able to compare
against a project where the exact same camera flow was known to work; once
that comparison became possible (a second course project, "Assignment 8",
using the same AVD and a working `expo-image-picker` camera flow), the real
cause turned out to be fully diagnosable and fixable in code -- not an
emulator/OS limitation at all.

**Investigation.** Side-by-side comparison against Assignment 8 (Expo SDK
54, `expo-image-picker@17.0.10`, vs. this app's SDK 51 /
`expo-image-picker@15.1.0`) ruled out, in order: native manifest/build
config (the real compiled `AndroidManifest.xml` was verified, via
`android/app/build/intermediates/merged_manifests/debug/AndroidManifest.xml`,
to correctly contain the `CAMERA` permission, the `ImagePickerFileProvider`,
`CropImageActivity`, and the `<queries>` block -- everything
`expo-image-picker` needs was genuinely compiled into the app); `cameraType`
(expo-image-picker's own Kotlin source confirms `CameraType.BACK` is the
native default when omitted, identical either way); and `allowsEditing`/
`aspect` (a temporary diagnostic screen mirroring Assignment 8's exact
capture code, `allowsEditing: true` and all, completed a real capture+crop
successfully on this same emulator).

That left two real, distinct bugs, both isolated with targeted `console.log`
tracing and `adb logcat`, not guessed:

1. **`requestCameraPermissionsAsync()` hangs forever when permission is
   already granted.** Android's own short-circuit for "nothing left to
   request" (logcat: `Activity: No requestable permission in the request.`)
   never invokes the native completion callback that promise is waiting on
   on this Android/expo-image-picker version. `getCameraPermissionsAsync()`
   (a plain status check, no native prompt) doesn't have this bug and always
   resolves immediately. Fixed in `services/imageService.js`'s
   `cameraFlow()`: check with `getCameraPermissionsAsync()` first, and only
   call the broken `requestCameraPermissionsAsync()` for a genuine
   first-time ask.
2. **The same bug also lives *inside* `launchCameraAsync()`'s own native
   implementation**, independent of anything JS calls beforehand.
   `expo-image-picker`'s `ImagePickerModule.kt` unconditionally calls a
   private `ensureCameraPermissionsAreGranted()` before firing the camera
   intent, which hits the identical broken callback. This is why fix #1
   alone wasn't enough -- confirmed by reproducing the exact same
   `"No requestable permission in the request."` logcat line during a real,
   otherwise-fixed `launchCameraAsync()` call. Fixed with a **native patch**
   (`patches/expo-image-picker+15.1.0.patch`, applied automatically via
   `patch-package` on `npm install`): `ensureCameraPermissionsAreGranted()`
   now checks `ContextCompat.checkSelfPermission()` first and skips the
   broken `askForPermissions()` call entirely when already granted, mirroring
   fix #1 at the native layer where it actually matters.

**Also added**, as defense-in-depth rather than the primary fix: Android can
still legitimately kill/freeze the calling app while the camera+crop UI is
in the foreground and drop the normal result callback (a real, separate,
Expo-documented Android behavior -- see `ImagePicker.getPendingResultAsync`'s
own doc comment). `requestCameraPhoto()` now calls
`getPendingResultAsync()` as a last-resort check if its timeout ever fires,
so a slow-but-genuinely-successful capture doesn't get reported as an error.
`CAMERA_LAUNCH_TIMEOUT_MS` was also raised from 30s to 3 minutes for the
same reason: the crop step includes unbounded human interaction time
(framing a shot, adjusting a crop), and the old 30s bound was found firing
*while the user was still on the native crop screen*, wrongly reporting an
in-progress, would-have-succeeded flow as failed.

**Verified working** end-to-end on the real Create Trip screen after the
patch and a rebuild (`npx expo run:android`): camera opens, capture + crop
complete, and the cover photo appears in the form.

- Files changed: `services/imageService.js` (permission-check-first order,
  180s timeout, `getPendingResultAsync` recovery, `allowsEditing`/`aspect`
  restored on Android now that the crop UI is confirmed to work),
  `services/__tests__/imageService.test.js`, `__mocks__/expo-image-picker.js`
  (added `getCameraPermissionsAsync`/`getPendingResultAsync` mocks),
  `node_modules/expo-image-picker/.../ImagePickerModule.kt` (patched;
  persisted via `patches/expo-image-picker+15.1.0.patch` +
  `patch-package` as a `postinstall` script in `package.json`, so it
  survives a fresh `npm install`/clone -- **the `patches/` folder must be
  committed** for this fix to carry over to a fresh checkout).
- Root cause category: a version-specific native bug in
  `expo-image-picker@15.1.0`'s Android permission-check bridge, not Expo Go
  vs. dev build, not native/manifest config, and not option-shape mistakes.
  `launchCameraAsync()` never threw an exception at any point in this
  investigation; both bugs were silent, promise-never-settles hangs.

## Navigation fix: duplicate Trip Dashboard entry after Save Changes

Editing a trip and pressing Save Changes returned to the Trip Dashboard as
expected, but pressing Back from there showed *another* Trip Dashboard
first, and only a second Back reached Home. Root cause: Edit is always
reached by *pushing* from that trip's own Dashboard (the pencil icon in
`app/trips/[tripId]/index.js`), so the existing Dashboard is already
directly underneath Edit on the stack (`[Home, Dashboard, Edit]`). Saving
called `router.replace(\`/trips/${editId}\`)`, which swaps *Edit* for a
*second* Dashboard screen (`[Home, Dashboard, Dashboard]`) instead of
revealing the one already beneath it.

- `app/trips/create.js`'s `handleSave()`: edit-mode save now calls
  `router.back()` (popping Edit off and revealing the existing Dashboard
  directly, giving `[Home, Dashboard]`) instead of `router.replace()`.
  Falls back to `router.replace(\`/trips/${editId}\`)` only if
  `router.canGoBack()` is false (e.g. Edit reached via a deep link with no
  Dashboard beneath it). Create mode is unaffected -- it still uses
  `router.replace()`, which is correct there since there's no existing
  Dashboard to go back to. The Dashboard doesn't need a manual refetch on
  return either: it holds a live `subscribeToTrip()` listener the whole
  time Edit is open on top of it, so it already reflects the save the
  instant `updateTrip()` resolves.
- `__mocks__/expo-router.js`: added `canGoBack: jest.fn(() => true)` to the
  router mock.
- New tests in `create.test.js`: edit-save calls `router.back()` exactly
  once and never pushes/replaces to a `trips/<id>` route (the exact
  duplicate-entry scenario this bug caused), plus the `canGoBack() === false`
  fallback path.

## Create/Edit Trip screen polish

Restructured the screen's layout and added a few small UX guardrails
without changing any business logic (Firebase persistence, event-type/
travel/venue-search/traveler/cover-photo logic, and date validation are
all byte-for-byte the same as before this pass).

- **Dynamic header title**: `<Stack.Screen options={{ title: ... }} />` is
  now rendered directly from `create.js` (every other screen's title is
  set once, statically, in `app/_layout.js` -- this is the first screen
  that needs to vary its own title at runtime), showing "Create Trip" or
  "Edit Trip" depending on whether an `editId` param is present. Set
  independently of the trip data load, so it's correct even while the
  edit-mode loading spinner is still showing.
- **Sticky bottom action bar**: the Create Trip / Save Changes button moved
  out of the `ScrollView` into a fixed footer below it (a plain sibling in
  a flex column, not absolutely positioned over the scroll content -- so
  there's no overlap for it to ever cover a field, "sticky" by construction
  rather than by z-index). Button text still switches between "Create Trip"
  and "Save Changes" by mode, exactly as before.
- **Disabled until valid / until changed**: the button is disabled whenever
  a required field is invalid (title, start date, end-date-after-start, and
  transportation mode when the event type requires one -- mirrors
  `handleSave`'s own `validateFields` checks, which are unchanged and still
  run as a defensive backstop). In edit mode, it's *also* disabled until the
  form differs from the trip as it was loaded, via a live comparison
  (`buildTripPayload()`, the exact same shape `handleSave` sends to
  Firestore, against a snapshot captured at load time) -- so "Save Changes"
  never implies there's something new to save when there isn't. Shows
  `AppButton`'s existing `loading` state while a save is in flight.
- **Start/End Date in one row**: both `DateField`s now sit side by side in
  a `flexBasis: "48%"` row (`flexWrap: "wrap"` lets it fall back to a
  second row on a very narrow screen rather than clipping). No change to
  `DateField` itself, `handleStartDateChange`, or the local-date-safe
  string handling in `utils/dateUtils.js`.
- **Section headers + reordered layout**: compact headers -- Trip Details,
  Travel (only rendered at all when the event type has any travel
  question to ask; this *is* "Travel section may collapse when not
  required" -- there's nothing to collapse into when it wouldn't render
  anyway), Location, Travelers, Notes -- following the suggested order
  (title, event type, date row, cover photo, travel, location, travelers,
  notes).
- **Travelers/Notes as expandable sections**: new `components/CollapsibleSection.js`,
  a small expand/collapse wrapper defaulting to *expanded*. Every field
  inside stays immediately visible and interactable exactly as before --
  collapsing is purely an opt-in "tidy this up" affordance, never a way
  required content gets hidden by default (neither section contains a
  required field anyway).
- New/updated tests in `create.test.js`: dynamic title (both modes),
  sticky button label (both modes), Start/End Date in one row, create-mode
  disabled-until-valid (title, then the Out-of-Town-Concert transportation
  case), and edit-mode disabled-until-changed (including re-disabling if a
  field is edited back to its original value). Several existing edit-mode
  save tests were updated to make a change before pressing Save Changes --
  under the old always-enabled button they didn't need to, but that's
  exactly the new behavior being added.

## Create/Edit Trip screen: refinement pass

A follow-up pass on the polish above, tightening four specific things.
Business logic (event-type/travel/venue-search/traveler/cover-photo logic,
date validation, create/update behavior) is unchanged.

- **Start/End Date, robustly equal-width**: `dateRow`/`dateColumn` switched
  from `flexBasis: "48%"` + `flexWrap: "wrap"` + negative-margin spacing to
  `flexDirection: "row", gap: 12` with `flex: 1` columns -- a plain flexbox
  row that can't fall back to a wrapped/uneven layout on a narrow screen the
  way the old `flexWrap` version could.
- **Event Type is now a `CollapsibleSection`**, matching Travelers/Notes:
  `subtitle` shows the currently selected type's label (e.g. "Cruise") so
  it's still visible at a glance while collapsed; expands on tap to reveal
  the chips, same as before.
- **Mode-based default expand state**: Event Type, Travelers, and Notes now
  all default to *collapsed* in edit mode (`defaultExpanded={!isEditing}`)
  and stay *expanded* in create mode. Reasoning: editing an existing trip is
  usually about one specific change, not a top-to-bottom review, so
  collapsing sections that already have a value (with the subtitle still
  showing what that value is) gets Save Changes in view sooner. A brand new
  trip has nothing to summarize yet, so create mode is unchanged -- fully
  expanded, exactly like before this pass.
- **Compact cover photo actions**: `CoverPhotoField`'s Take Photo/Choose
  from Library (or Retake/Choose Different once a photo exists) are now a
  side-by-side row (`flexDirection: "row", gap: 10`, `flex: 1` buttons)
  instead of three stacked full-width rows; Remove Photo stays the separate
  small text action below, unchanged. This was previously stacked because
  `AppButton`'s fixed `height: 50` would clip a wrapped two-line label like
  "Choose Different Photo" in a narrower half-width button -- fixed at the
  root by changing `AppButton`'s `base` style to `minHeight: 50`, so any
  button (here or elsewhere) grows for wrapped text instead of clipping.
  No existing button's visual height changes, since none of their labels
  wrap. `"Take Photo"`/`"Choose from Library"` (the two exact strings
  `CoverPhotoField.test.js` already asserted on) are untouched.
- New/updated tests: `create.test.js` gained a "collapsible sections default
  by mode" block (create mode all-expanded; edit mode all-collapsed with
  Event Type's subtitle showing the loaded type, expanding on tap).
  `CoverPhotoField.test.js` gained a row-layout check (`cover-photo-actions`,
  a new testID on the action row) and a check that Remove Photo stays
  separate from the Retake/Choose Different row once a photo exists.

## Branding consistency: "VooDew" -> "Trip VooDew"

The Home screen's app title read "VooDew" while the rest of the app (cover
photo permission strings, this doc's own intro line, etc.) already said
"Trip VooDew" -- inconsistent. Every remaining user-facing "VooDew" was
updated to "Trip VooDew"; identifiers were left alone.

- **Changed** (user-visible text): `app/index.js`'s Home header title;
  `app/_layout.js`'s `index` screen's native header title; `app.json`'s
  `expo.name` (the OS-level app display name shown under the icon/in the
  app switcher); the CoverPhotoField permission-denied notice; the Android
  notification channel's display name in `services/notificationService.js`;
  the two reminder-permission `Alert`s in `app/trips/[tripId]/reminders.js`;
  both Maestro flows' `assertVisible` checks (kept in sync with the actual
  rendered text so they still pass); this file's own title and the OS
  permission-dialog description; and `README.md`'s title/intro line.
- **Left alone** (identifiers, not branding): `app.json`'s `slug`
  (`"voodew"`), `scheme` (`"voodew"`), iOS `bundleIdentifier` and Android
  `package` (`com.voodew.app`, referenced as-is in both Maestro flows'
  `appId`), Firebase collection names, and code comments that just mention
  the app by name informally (`constants/colors.js`, `components/DateField.js`,
  `components/DateTimeModal.js`) -- none of those are text a user ever sees,
  and comments weren't part of what "branding" means here.
- **Small layout note**: "Trip VooDew" is longer than "VooDew" at the same
  28pt bold `screenTitle` size. Added `flexShrink: 1` to the Home header's
  brand `View`/row (only) so the longer title can wrap/shrink instead of
  pushing the fixed-size Create Trip button off-screen on a narrow device --
  no other spacing, color, or sizing changed.
- Updated `app/__tests__/index.test.js` to assert the Home screen renders
  "Trip VooDew" as its title text.

## Known limitations of this pass

- **`npx expo-doctor` could not complete in this environment**
  (this sandbox's mounted filesystem is too slow to get through it within
  a single command). Please run it locally too.
- **Maestro flows (`.maestro/*.yaml`) are written but unrun** -- there's no
  device/simulator available here. `create-reminder.yaml` in particular has
  a `TODO` where the native time picker's confirm step is platform-specific
  (iOS "Done" vs. Android "OK") and needs to be filled in against whichever
  platform you test on. Run with `maestro test .maestro/<file>.yaml` against
  a running dev build, ideally pointed at a test Firebase project rather
  than production data, since Maestro drives the real app end-to-end
  (unlike the Jest suite, this layer does hit real Firebase).
