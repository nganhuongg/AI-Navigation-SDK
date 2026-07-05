import SmartUX from "./SmartUX";

const now = () => new Date().toISOString();

const cleanString = (value) => (value === undefined || value === null ? "" : String(value));

export const SmartUXEvents = {
  screenView(screenName, extra = {}) {
    const payload = {
      screen_name: cleanString(screenName),
      timestamp: now(),
      ...extra,
    };
    SmartUX.trackingNavigationScreen(cleanString(screenName));
    SmartUX.makeScreenshot(cleanString(screenName));
    SmartUX.trackEvent("screen_view", payload);
  },

  startOCR(source = "camera", extra = {}) {
    SmartUX.trackEvent("ocr_started", {
      source: cleanString(source),
      timestamp: now(),
      ...extra,
    });
  },

  ocrResult(status, extra = {}) {
    SmartUX.trackEvent("ocr_result", {
      status: cleanString(status),
      timestamp: now(),
      ...extra,
    });
  },

  chatbotQuestion(intent = "unknown", extra = {}) {
    SmartUX.trackEvent("chatbot_question", {
      intent: cleanString(intent),
      timestamp: now(),
      ...extra,
    });
  },

  routeRequested(from, to, extra = {}) {
    SmartUX.trackEvent("route_requested", {
      from: cleanString(from),
      to: cleanString(to),
      timestamp: now(),
      ...extra,
    });
  },

  voiceGuidePlayed(screenName, extra = {}) {
    SmartUX.trackEvent("voice_guide_played", {
      screen_name: cleanString(screenName),
      timestamp: now(),
      ...extra,
    });
  },

  stepCompleted(stepId, extra = {}) {
    SmartUX.trackEvent("journey_step_completed", {
      step_id: cleanString(stepId),
      timestamp: now(),
      ...extra,
    });
  },

  fallbackTriggered(reason, extra = {}) {
    SmartUX.trackEvent("fallback_triggered", {
      reason: cleanString(reason),
      timestamp: now(),
      ...extra,
    });
  },

  sessionEnded(reason = "completed", extra = {}) {
    SmartUX.trackEvent("session_ended", {
      reason: cleanString(reason),
      timestamp: now(),
      ...extra,
    });
  },

  exception(error, extra = {}) {
    SmartUX.logException(error, true, extra);
  },
};

export default SmartUXEvents;
