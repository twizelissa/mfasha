/**
 * Utility to generate a stable browser fingerprint to act as a Device ID.
 * This is used to prevent abuse of the free 20 response quota.
 */
export function getDeviceFingerprint(): string {
  if (typeof window === "undefined") return "";

  try {
    const screenParams = `${window.screen.width || 0}x${window.screen.height || 0}x${window.screen.colorDepth || 0}`;
    const language = window.navigator.language || "";
    const timezone = new Date().getTimezoneOffset().toString();
    const cores = window.navigator.hardwareConcurrency?.toString() || "0";
    const userAgent = window.navigator.userAgent || "";

    // Canvas fingerprinting: renders a hidden shape and text, generating an image hash
    let canvasHash = "";
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText("mfasha-security-v1", 2, 15);
        canvasHash = canvas.toDataURL();
      }
    } catch (e) {
      // Ignore canvas errors (fallback to standard params)
    }

    const rawString = `${userAgent}|${screenParams}|${language}|${timezone}|${cores}|${canvasHash}`;
    
    // Hash function (FNV-1a variant)
    let hash = 2166136261;
    for (let i = 0; i < rawString.length; i++) {
      hash ^= rawString.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }
    
    // LocalStorage backup fallback for correlation
    let storedId = localStorage.getItem("mfasha_device_correlation_id");
    if (!storedId) {
      storedId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("mfasha_device_correlation_id", storedId);
    }

    // Combine local storage correlation ID and hardware fingerprint
    const combinedString = `${hash.toString(16)}_${storedId}`;
    
    return combinedString;
  } catch (err) {
    console.error("Failed to generate fingerprint", err);
    return "dev_fallback_" + Math.random().toString(36).substring(2, 10);
  }
}
