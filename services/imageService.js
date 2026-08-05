// Handles everything camera/photo-related for the Trip Cover Photo
// feature: permission requests, launching the camera or photo library,
// and copying the result into an app-controlled *persistent* local
// directory.
//
// Why the copy step matters: expo-image-picker's result `uri` points into
// a temporary cache location (NSTemporaryDirectory-ish on iOS, a cache
// dir on Android). That location is not guaranteed to survive an app
// restart or OS cache cleanup, so it can't be saved directly on the trip
// record -- the image would silently disappear later. Copying it into
// FileSystem.documentDirectory (which IS guaranteed to persist for the
// life of the app install) gives a stable URI safe to store in Firestore
// and reload indefinitely, without needing Firebase Storage or any
// network round-trip.
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";

const COVER_PHOTO_DIR = `${FileSystem.documentDirectory}tripCoverPhotos/`;

// The photo library picker chains straight to its crop UI reliably on both
// platforms, so it keeps editing on everywhere.
const LIBRARY_OPTIONS = {
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: true,
  quality: 0.6 // keeps saved files small without visibly hurting quality
};

// The camera capture flow chains to a separate crop activity after the
// photo is taken. This was previously suspected of hanging indefinitely on
// Android and disabled there, but a controlled side-by-side comparison
// against a known-working reference project (identical crop step, same
// emulator) showed the crop UI itself completes fine on both platforms --
// the real cause of the hang was elsewhere (see cameraFlow() below). So
// `allowsEditing` and `aspect` are enabled on both platforms.
//
// `cameraType` is set explicitly to `back` (also expo-image-picker's own
// native default when the option is omitted -- see ImagePickerOptions.kt)
// so there's no ambiguity about which camera is being requested. This
// matters here specifically because this app's test AVD only has a
// working VirtualScene camera configured for Rear, not Front.
const CAMERA_OPTIONS = {
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  cameraType: ImagePicker.CameraType.back,
  allowsEditing: true,
  aspect: [16, 9],
  quality: 0.6
};

// The camera flow includes unbounded human interaction time -- framing a
// shot, then adjusting/confirming a crop -- so this bound has to be
// generous enough to never fire during normal use. (An earlier, much
// shorter bound of 30s was found to fire *while the user was still on the
// native crop screen*, wrongly reporting the whole flow as failed when it
// was actually still in progress and would have succeeded seconds later.)
// This is purely a safety net against a genuine stuck promise (e.g. no
// camera app available at all), not a bound on how long someone can take
// to actually use the camera.
//
// The library picker is intentionally NOT wrapped in this timeout: a user
// actively scrolling a large photo library can legitimately take longer
// than any fixed bound, and it isn't the flow that's been observed to hang.
const CAMERA_LAUNCH_TIMEOUT_MS = 180000;

function withTimeout(promise, ms, timeoutMessage) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const timeoutError = new Error(timeoutMessage);
      // Distinguishes "the promise genuinely never settled" from "it
      // rejected with a real native error" once caught below -- the two
      // have very different causes and the log/console output should say
      // which one actually happened instead of guessing.
      timeoutError.isTimeout = true;
      reject(timeoutError);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function resultToStatus(result) {
  if (result.canceled) return { status: "cancelled" };
  const uri = result.assets && result.assets[0] && result.assets[0].uri;
  if (!uri) return { status: "cancelled" };
  return { status: "success", uri };
}

// requestCameraPermissionsAsync() has a confirmed bug on this Android/
// expo-image-picker version: when permission is *already* granted, Android
// short-circuits the native request with nothing to prompt for (logcat:
// "Activity: No requestable permission in the request."), and the
// completion callback that promise is waiting on never fires -- so it
// hangs forever, even though nothing was actually wrong. getCameraPermissionsAsync()
// (a plain status check, no native prompt involved) does not have this bug
// and always resolves immediately, so it's used first to avoid calling the
// broken request path at all whenever possible. The request path is still
// used, and still needed, for the genuine first-time-ask case.
//
// Note: this same bug also lived *inside* expo-image-picker's own
// launchCameraAsync() native implementation -- it unconditionally re-checks
// permission internally before firing the camera intent, hitting the exact
// same broken callback regardless of what this JS-level check does. That
// half of the fix is a native patch (see patches/expo-image-picker+15.1.0.patch,
// applied via patch-package on install), not something fixable from JS alone.
async function cameraFlow() {
  const current = await ImagePicker.getCameraPermissionsAsync();
  let granted = current.granted;
  if (!granted) {
    const requested = await ImagePicker.requestCameraPermissionsAsync();
    granted = requested.granted;
  }
  if (!granted) return { status: "denied" };
  const result = await ImagePicker.launchCameraAsync(CAMERA_OPTIONS);
  return resultToStatus(result);
}

// Android's own docs/expo-image-picker docs warn that the OS can kill the
// calling activity while the camera/crop UI is in the foreground, which
// silently drops the normal result callback (observed here as repeated
// "Sending oneway calls to frozen process" warnings in logcat around a
// camera capture). getPendingResultAsync() is expo-image-picker's official,
// documented recovery path for exactly this case -- it can retrieve a
// completed picker result even after the normal callback was lost. Used
// here as a last-resort check before giving up on a timeout, so a slow but
// otherwise-successful capture doesn't get reported as a failure.
async function recoverPendingCameraResult() {
  try {
    const pending = await ImagePicker.getPendingResultAsync();
    const withAsset = pending.find((r) => r.assets && r.assets[0] && r.assets[0].uri);
    return withAsset ? resultToStatus(withAsset) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Requests camera permission only at the moment it's needed (never on
 * screen load), then launches the camera. Never throws and never hangs
 * indefinitely -- returns `{ status: "denied" }` on a permission refusal,
 * or `{ status: "error", message }` if the permission prompt or the launch
 * itself fails or times out (e.g. a broken emulator camera), so the caller
 * can always clear its loading state and show something useful instead of
 * spinning forever.
 */
export async function requestCameraPhoto() {
  try {
    return await withTimeout(
      cameraFlow(),
      CAMERA_LAUNCH_TIMEOUT_MS,
      "The camera didn't respond. On an emulator, make sure a virtual camera is enabled (Extended Controls > Camera), or try Choose from Library instead."
    );
  } catch (e) {
    // Logged (not swallowed) so the real cause is visible in Metro/logcat:
    // a timeout means launchCameraAsync's promise never settled at all (no
    // native error was ever thrown -- points at an OS/emulator-level
    // activity-result problem, not a JS bug); anything else is a genuine
    // native rejection, logged in full for diagnosis.
    if (e.isTimeout) {
      console.warn(
        "[imageService] requestCameraPhoto timed out -- launchCameraAsync (or the permission prompt) never resolved or rejected within",
        CAMERA_LAUNCH_TIMEOUT_MS,
        "ms. No native error was thrown. Checking getPendingResultAsync() in case the capture actually completed and only the result callback was lost."
      );
      const recovered = await recoverPendingCameraResult();
      if (recovered) {
        console.warn("[imageService] requestCameraPhoto: recovered a result via getPendingResultAsync() after the timeout.");
        return recovered;
      }
    } else {
      console.warn("[imageService] requestCameraPhoto: launchCameraAsync threw:", e);
    }
    return { status: "error", message: e.message || "Couldn't open the camera. Please try again." };
  }
}

/**
 * Requests photo-library permission only at the moment it's needed, then
 * opens the picker for a single image. Never throws -- a genuine launch
 * failure comes back as `{ status: "error", message }` instead.
 */
export async function requestLibraryPhoto() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") return { status: "denied" };
  try {
    const result = await ImagePicker.launchImageLibraryAsync(LIBRARY_OPTIONS);
    return resultToStatus(result);
  } catch (e) {
    return { status: "error", message: e.message || "Couldn't open your photo library. Please try again." };
  }
}

async function ensureCoverPhotoDir() {
  const dirInfo = await FileSystem.getInfoAsync(COVER_PHOTO_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(COVER_PHOTO_DIR, { intermediates: true });
  }
}

/**
 * Copies a picker result's (possibly temporary) uri into the app's
 * persistent cover-photo directory and returns the new, stable uri.
 */
export async function persistCoverPhoto(pickedUri) {
  await ensureCoverPhotoDir();
  const extensionMatch = /\.(\w+)$/.exec(pickedUri || "");
  const extension = extensionMatch ? extensionMatch[1] : "jpg";
  const destUri = `${COVER_PHOTO_DIR}cover-${Date.now()}.${extension}`;
  await FileSystem.copyAsync({ from: pickedUri, to: destUri });
  return destUri;
}

/**
 * Best-effort cleanup of a previously persisted cover photo (e.g. when a
 * trip's photo is replaced/removed, or the trip itself is deleted). Never
 * throws -- a missing file, or any other filesystem error, should never
 * block or crash a save/delete flow.
 */
export async function deleteCoverPhoto(uri) {
  if (!uri) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (e) {
    // Non-fatal: the file may already be gone, or this uri may not even
    // be one of ours (e.g. leftover data from an older build). Either
    // way, nothing to do.
  }
}
