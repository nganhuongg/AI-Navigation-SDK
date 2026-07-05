const isDev = process.env.NODE_ENV !== "production";

function resolveNativeModules() {
  if (typeof globalThis !== "undefined" && globalThis.NativeModules) {
    return globalThis.NativeModules;
  }

  try {
    const reactNative = new Function(
      "try { return require('react-native'); } catch (error) { return null; }",
    )();
    return reactNative && reactNative.NativeModules ? reactNative.NativeModules : null;
  } catch {
    return null;
  }
}

const NativeModules = resolveNativeModules();
const SmartUXReactNative = NativeModules && NativeModules.SmartUXReactNative ? NativeModules.SmartUXReactNative : null;
const isSmartUXAvailable = Boolean(SmartUXReactNative);

const safeCall = (methodName, args = []) => {
  try {
    if (isSmartUXAvailable && typeof SmartUXReactNative[methodName] === "function") {
      return SmartUXReactNative[methodName](args);
    }

    if (isDev) {
      console.log(`[SmartUX mock] ${methodName}`, args);
    }

    return null;
  } catch (error) {
    if (isDev) {
      console.warn(`[SmartUX error] ${methodName}`, error);
    }
    return null;
  }
};

const SmartUX = {
  trackingNavigationScreen(screenName) {
    return safeCall("trackingNavigationScreen", [screenName]);
  },

  makeScreenshot(screenName) {
    return safeCall("makeScreenshot", [screenName]);
  },

  addCrashLog(crashLog) {
    return safeCall("addCrashLog", [String(crashLog || "")]);
  },

  logException(exception, nonfatal = true, segments = {}) {
    const exceptionString =
      exception instanceof Error
        ? `${exception.name}: ${exception.message}\n${exception.stack || ""}`
        : String(exception || "");

    const args = [exceptionString, Boolean(nonfatal)];

    Object.entries(segments || {}).forEach(([key, value]) => {
      args.push(String(key));
      args.push(String(value));
    });

    return safeCall("logException", args);
  },

  trackEvent(eventName, payload = {}) {
    return safeCall("trackEvent", [String(eventName), JSON.stringify(payload || {})]);
  },
};

export default SmartUX;
export { isSmartUXAvailable };
