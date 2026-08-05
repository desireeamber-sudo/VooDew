import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { requestCameraPhoto, requestLibraryPhoto, persistCoverPhoto, deleteCoverPhoto } from "../imageService";

describe("imageService", () => {
  beforeEach(() => {
    ImagePicker.getCameraPermissionsAsync.mockReset().mockResolvedValue({ status: "granted", granted: true });
    ImagePicker.requestCameraPermissionsAsync.mockReset().mockResolvedValue({ status: "granted", granted: true });
    ImagePicker.requestMediaLibraryPermissionsAsync.mockReset().mockResolvedValue({ status: "granted" });
    ImagePicker.launchCameraAsync
      .mockReset()
      .mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/cam.jpg" }] });
    ImagePicker.launchImageLibraryAsync
      .mockReset()
      .mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/lib.jpg" }] });
    ImagePicker.getPendingResultAsync.mockReset().mockResolvedValue([]);
    FileSystem.getInfoAsync.mockReset().mockResolvedValue({ exists: true });
    FileSystem.makeDirectoryAsync.mockReset().mockResolvedValue();
    FileSystem.copyAsync.mockReset().mockResolvedValue();
    FileSystem.deleteAsync.mockReset().mockResolvedValue();
  });

  describe("requestCameraPhoto", () => {
    test("returns the picked uri when permission is granted and a photo is taken", async () => {
      const result = await requestCameraPhoto();
      expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith(
        expect.objectContaining({ allowsEditing: true, aspect: [16, 9] })
      );
      expect(result).toEqual({ status: "success", uri: "file:///cache/cam.jpg" });
    });

    test("always requests the rear camera explicitly, never the front camera", async () => {
      await requestCameraPhoto();
      expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith(
        expect.objectContaining({ cameraType: ImagePicker.CameraType.back })
      );
    });

    // requestCameraPermissionsAsync() has a confirmed Android bug: when
    // permission is already granted, the native "nothing to request"
    // short-circuit never fires the completion callback the JS promise is
    // waiting on, so it hangs forever. getCameraPermissionsAsync() (a plain
    // status check) doesn't have this bug, so it's checked first and the
    // broken request call is skipped entirely whenever possible.
    test("skips requestCameraPermissionsAsync entirely when permission is already granted", async () => {
      ImagePicker.getCameraPermissionsAsync.mockResolvedValue({ status: "granted", granted: true });
      const result = await requestCameraPhoto();
      expect(ImagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
      expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
      expect(result).toEqual({ status: "success", uri: "file:///cache/cam.jpg" });
    });

    test("calls requestCameraPermissionsAsync only for a genuine first-time ask", async () => {
      ImagePicker.getCameraPermissionsAsync.mockResolvedValue({ status: "undetermined", granted: false });
      ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ status: "granted", granted: true });
      const result = await requestCameraPhoto();
      expect(ImagePicker.requestCameraPermissionsAsync).toHaveBeenCalled();
      expect(result).toEqual({ status: "success", uri: "file:///cache/cam.jpg" });
    });

    test("reports denied without launching the camera when permission is refused", async () => {
      ImagePicker.getCameraPermissionsAsync.mockResolvedValue({ status: "undetermined", granted: false });
      ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ status: "denied", granted: false });
      const result = await requestCameraPhoto();
      expect(result).toEqual({ status: "denied" });
      expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    });

    test("reports cancelled when the user backs out of the camera", async () => {
      ImagePicker.launchCameraAsync.mockResolvedValue({ canceled: true });
      const result = await requestCameraPhoto();
      expect(result).toEqual({ status: "cancelled" });
    });

    test("surfaces a genuine launchCameraAsync rejection as a clear error instead of throwing", async () => {
      ImagePicker.launchCameraAsync.mockRejectedValue(new Error("Camera hardware not available"));
      const result = await requestCameraPhoto();
      expect(result).toEqual({ status: "error", message: "Camera hardware not available" });
    });

    test("times out with a clear error instead of hanging forever when the camera launch never responds and no pending result can be recovered", async () => {
      jest.useFakeTimers();
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      // Simulates a genuine stuck promise (e.g. no camera app available at
      // all) -- launchCameraAsync's promise never settles, and there's
      // nothing to recover via getPendingResultAsync either.
      ImagePicker.launchCameraAsync.mockReturnValue(new Promise(() => {}));
      ImagePicker.getPendingResultAsync.mockResolvedValue([]);

      const resultPromise = requestCameraPhoto();
      await jest.advanceTimersByTimeAsync(180000);
      const result = await resultPromise;

      expect(result.status).toBe("error");
      expect(result.message).toMatch(/camera/i);
      // The console output distinguishes "never settled" (this case) from
      // a genuine native rejection -- assert the timeout branch specifically
      // logged, so a real launchCameraAsync throw can never be silently
      // misreported as a timeout or vice versa.
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("timed out"), expect.anything(), expect.anything());
      warnSpy.mockRestore();
      jest.useRealTimers();
    });

    // Matches an observed real-device/emulator case: the OS can kill/freeze
    // the calling app while the camera+crop UI is in the foreground and
    // drop the normal result callback entirely, so launchCameraAsync's
    // promise never settles even though the capture genuinely succeeded.
    // getPendingResultAsync() is expo-image-picker's documented recovery
    // path for exactly this -- it should be checked before giving up.
    test("recovers a successful result via getPendingResultAsync when the callback itself was lost, instead of reporting an error", async () => {
      jest.useFakeTimers();
      jest.spyOn(console, "warn").mockImplementation(() => {});
      ImagePicker.launchCameraAsync.mockReturnValue(new Promise(() => {}));
      ImagePicker.getPendingResultAsync.mockResolvedValue([
        { canceled: false, assets: [{ uri: "file:///cache/recovered.jpg" }] }
      ]);

      const resultPromise = requestCameraPhoto();
      await jest.advanceTimersByTimeAsync(180000);
      const result = await resultPromise;

      expect(result).toEqual({ status: "success", uri: "file:///cache/recovered.jpg" });
      jest.useRealTimers();
    });

    test("logs the full native error when launchCameraAsync genuinely rejects (not a timeout)", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const nativeError = new Error("Camera hardware not available");
      ImagePicker.launchCameraAsync.mockRejectedValue(nativeError);

      await requestCameraPhoto();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("threw"), nativeError);
      warnSpy.mockRestore();
    });

    test("times out with a clear error instead of hanging forever when a genuine first-time permission prompt never responds", async () => {
      jest.useFakeTimers();
      jest.spyOn(console, "warn").mockImplementation(() => {});
      // getCameraPermissionsAsync() reports not-yet-granted, so
      // requestCameraPermissionsAsync() is actually reached (the confirmed
      // Android hang bug on that call is specific to the already-granted
      // short-circuit case, but a genuine first-time prompt can still fail
      // to respond for other reasons) -- the timeout has to cover this step
      // too, not just launchCameraAsync.
      ImagePicker.getCameraPermissionsAsync.mockResolvedValue({ status: "undetermined", granted: false });
      ImagePicker.requestCameraPermissionsAsync.mockReturnValue(new Promise(() => {}));
      ImagePicker.getPendingResultAsync.mockResolvedValue([]);

      const resultPromise = requestCameraPhoto();
      await jest.advanceTimersByTimeAsync(180000);
      const result = await resultPromise;

      expect(result.status).toBe("error");
      expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    test("does not time out a camera launch that resolves well within the bound", async () => {
      jest.useFakeTimers();
      ImagePicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/cam.jpg" }] });

      const resultPromise = requestCameraPhoto();
      const result = await resultPromise;

      expect(result).toEqual({ status: "success", uri: "file:///cache/cam.jpg" });
      jest.useRealTimers();
    });
  });

  describe("requestLibraryPhoto", () => {
    test("returns the picked uri when permission is granted", async () => {
      const result = await requestLibraryPhoto();
      expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled();
      expect(result).toEqual({ status: "success", uri: "file:///cache/lib.jpg" });
    });

    test("reports denied without opening the library when permission is refused", async () => {
      ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: "denied" });
      const result = await requestLibraryPhoto();
      expect(result).toEqual({ status: "denied" });
      expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
    });

    test("reports cancelled when the user backs out of the library picker", async () => {
      ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true });
      const result = await requestLibraryPhoto();
      expect(result).toEqual({ status: "cancelled" });
    });

    test("surfaces a genuine launchImageLibraryAsync rejection as a clear error instead of throwing", async () => {
      ImagePicker.launchImageLibraryAsync.mockRejectedValue(new Error("No photo library available"));
      const result = await requestLibraryPhoto();
      expect(result).toEqual({ status: "error", message: "No photo library available" });
    });
  });

  describe("persistCoverPhoto", () => {
    test("creates the cover-photo directory if missing and copies the file into it", async () => {
      FileSystem.getInfoAsync.mockResolvedValue({ exists: false });
      const dest = await persistCoverPhoto("file:///cache/cam.jpg");
      expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        expect.stringContaining("tripCoverPhotos"),
        { intermediates: true }
      );
      expect(FileSystem.copyAsync).toHaveBeenCalledWith({ from: "file:///cache/cam.jpg", to: dest });
      expect(dest.startsWith(FileSystem.documentDirectory)).toBe(true);
      expect(dest.endsWith(".jpg")).toBe(true);
    });

    test("skips creating the directory when it already exists", async () => {
      FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
      await persistCoverPhoto("file:///cache/cam.jpg");
      expect(FileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
    });

    test("falls back to a .jpg extension when the source uri has none", async () => {
      const dest = await persistCoverPhoto("file:///cache/no-extension");
      expect(dest.endsWith(".jpg")).toBe(true);
    });
  });

  describe("deleteCoverPhoto", () => {
    test("removes the file at the given uri", async () => {
      await deleteCoverPhoto("file:///mock-documents/tripCoverPhotos/old.jpg");
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith("file:///mock-documents/tripCoverPhotos/old.jpg", {
        idempotent: true
      });
    });

    test("does nothing for a null/empty uri", async () => {
      await deleteCoverPhoto(null);
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });

    test("never throws even if the underlying delete fails", async () => {
      FileSystem.deleteAsync.mockRejectedValue(new Error("not found"));
      await expect(deleteCoverPhoto("file:///mock-documents/tripCoverPhotos/gone.jpg")).resolves.toBeUndefined();
    });
  });
});
