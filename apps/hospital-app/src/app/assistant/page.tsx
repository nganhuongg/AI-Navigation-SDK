"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import SDKGate from "@/components/SDKGate";
import ReadAloudButton from "@/components/ReadAloudButton";
import { useDemo } from "@/context/demo";
import SmartUXEvents from "@/integrations/smartux/smartuxEvents";
import {
  askAssistant,
  confirmOcr,
  extractOcr,
  markArrived,
  startPatientSession,
  transcribeAudio,
  type AssistantResponse,
  type OcrResult,
  type PatientSession,
  type SpecializedService,
} from "@/lib/api";

type Screen = "home" | "voice" | "scan" | "ocr" | "checklist" | "fallback" | "end";

type FlowStep = {
  id: string;
  label: string;
  room?: string;
  floor?: number;
  status: "completed" | "active" | "pending";
  instruction?: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  meta?: string;
};

const INITIAL_ASSISTANT_PROMPT =
  "Cháu đang nghe bác nói. Bác có thể hỏi: tôi vừa khám xong thì đi đâu, phòng xét nghiệm máu ở đâu, hoặc tôi có cần quay lại bác sĩ không.";

const MIC_SAFE_WINDOW_MS = 3000;

function waitForMicSafeWindow(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, MIC_SAFE_WINDOW_MS));
}

function parseScreenParam(value: string | null): Screen {
  const screens: Screen[] = ["home", "voice", "scan", "ocr", "checklist", "fallback", "end"];
  return screens.includes(value as Screen) ? (value as Screen) : "home";
}

export default function AssistantPage() {
  return (
    <SDKGate title="Trợ lý AI điều hướng" backHref="/appointment">
      <AfterSdkAssistant />
    </SDKGate>
  );
}

function AfterSdkAssistant() {
  const { session, setSession } = useDemo();
  const searchParams = useSearchParams();
  const [screen, setScreen] = useState<Screen>(() => parseScreenParam(searchParams.get("screen")));
  const [question, setQuestion] = useState("Tôi vừa khám xong thì đi đâu?");
  const [file, setFile] = useState<File | null>(null);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [arrivalConfirmed, setArrivalConfirmed] = useState(false);

  useEffect(() => {
    if (session) return;
    let ignore = false;
    async function createSession() {
      setBusy("session");
      try {
        const next = await startPatientSession();
        if (!ignore) setSession(next);
      } finally {
        if (!ignore) setBusy(null);
      }
    }
    void createSession();
    return () => {
      ignore = true;
    };
  }, [session, setSession]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    SmartUXEvents.screenView(getAssistantScreenName(screen), {
      session_id: session?.session_id || "anonymous_session",
    });
  }, [screen]);

  const steps = useMemo(() => buildSteps(session), [session]);
  const activeStep = steps.find((step) => step.status === "active") ?? steps[0];
  const targetRoom =
    session?.next_action.target_room ||
    activeStep?.room ||
    session?.journey.extracted_fields.initial_exam_room ||
    "A203";

  async function runOcr() {
    SmartUXEvents.startOCR("camera", {
      session_id: session?.session_id || "anonymous_session",
    });
    if (!file) {
      SmartUXEvents.ocrResult("failed", {
        reason: "no_file",
        session_id: session?.session_id || "anonymous_session",
      });
      setToast("Bác hãy chọn ảnh phiếu chỉ định trước.");
      return;
    }
    setBusy("ocr");
    try {
      const result = await extractOcr(file, "clear");
      setOcr(result);
      SmartUXEvents.ocrResult(result.is_low_confidence ? "low_confidence" : "success", {
        extracted_rooms_count: result.fields.detected_room_codes.length,
        confidence: result.confidence,
        session_id: session?.session_id || "anonymous_session",
      });
      if (result.is_low_confidence) {
        SmartUXEvents.fallbackTriggered("ocr_low_confidence", {
          session_id: session?.session_id || "anonymous_session",
        });
      }
      setScreen("ocr");
    } catch (error) {
      SmartUXEvents.ocrResult("failed", {
        reason: error instanceof Error ? error.message : "ocr_error",
        session_id: session?.session_id || "anonymous_session",
      });
      SmartUXEvents.exception(error, {
        feature: "ocr",
        session_id: session?.session_id || "anonymous_session",
      });
      setToast(error instanceof Error ? error.message : "Không thể đọc phiếu lúc này.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmResult() {
    if (!session || !ocr) return;
    setBusy("confirm");
    try {
      const updated = await confirmOcr(session.session_id, ocr);
      setSession(updated);
      setToast("Đã đồng bộ phiếu chỉ định thành công.");
      SmartUXEvents.stepCompleted("ocr_confirm", {
        session_id: session.session_id,
        extracted_rooms_count: ocr.fields.detected_room_codes.length,
      });
      setScreen("checklist");
    } catch (error) {
      SmartUXEvents.exception(error, {
        feature: "confirm_ocr",
        session_id: session?.session_id || "anonymous_session",
      });
      setToast(error instanceof Error ? error.message : "Không thể xác nhận phiếu ngay lúc này.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmArrived() {
    if (!session) {
      setArrivalConfirmed(true);
      return;
    }
    setBusy("arrive");
    try {
      const updated = await markArrived(session.session_id);
      setSession(updated);
      setArrivalConfirmed(true);
      setToast("Trạng thái hành trình đã được cập nhật.");
      SmartUXEvents.stepCompleted(activeStep.id, {
        room_id: targetRoom,
        session_id: session.session_id,
      });
      if (updated.next_action.type === "done") {
        SmartUXEvents.sessionEnded("completed", {
          session_id: session.session_id,
          steps_completed: updated.journey.extracted_fields.completed_steps?.length || 0,
        });
      }
    } catch (error) {
      SmartUXEvents.exception(error, {
        feature: "arrive",
        session_id: session?.session_id || "anonymous_session",
      });
      setToast(error instanceof Error ? error.message : "Không thể cập nhật đã đến nơi.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    setArrivalConfirmed(false);
  }, [session?.next_action.target_room, session?.next_action.type]);

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-white text-slate-800">
      {screen === "home" ? (
        <SdkHome
          session={session}
          setScreen={setScreen}
          setToast={setToast}
        />
      ) : null}
      {screen === "voice" ? (
        <VoiceScreen
          session={session}
          setScreen={setScreen}
          setQuestion={setQuestion}
        />
      ) : null}
      {screen === "scan" ? (
        <ScanScreen
          file={file}
          setFile={setFile}
          runOcr={runOcr}
          busy={busy}
          setScreen={setScreen}
        />
      ) : null}
      {screen === "ocr" ? (
        <OcrScreen
          ocr={ocr}
          confirmResult={confirmResult}
          busy={busy}
          setScreen={setScreen}
        />
      ) : null}
      {screen === "checklist" ? (
        <ChecklistScreen
          session={session}
          steps={steps}
          activeStep={activeStep}
          targetRoom={targetRoom}
          busy={busy}
          setScreen={setScreen}
          confirmArrived={confirmArrived}
          arrivalConfirmed={arrivalConfirmed}
          question={question}
        />
      ) : null}
      {screen === "fallback" ? <FallbackScreen setScreen={setScreen} /> : null}
      {screen === "end" ? <EndScreen session={session} steps={steps} setScreen={setScreen} /> : null}

      {toast ? (
        <div className="absolute bottom-4 left-4 right-4 z-50 rounded-2xl bg-emerald-600 px-4 py-3 text-center text-xs font-extrabold text-white shadow-xl">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function SdkHome({
  session,
  setScreen,
  setToast,
}: {
  session: PatientSession | null;
  setScreen: (screen: Screen) => void;
  setToast: (value: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <div className="rounded-b-[28px] bg-[#008751] px-4 pb-5 pt-5 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#008751] shadow-sm">
              <HospitalIcon />
            </div>
            <div>
              <p className="text-sm font-black leading-tight">BỆNH VIỆN BẠCH MAI</p>
              <p className="text-[10px] font-semibold tracking-widest text-emerald-100">
                AI NAVIGATION SDK
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <IconCircle>
              <BellIcon />
            </IconCircle>
            <IconCircle>
              <UserIcon />
            </IconCircle>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-24">
        <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-slate-500">
                Mã bệnh nhân: <span className="font-semibold">BM-194892</span>
              </p>
              <h1 className="text-lg font-black text-slate-800">Bác Nguyễn Văn Hùng</h1>
            </div>
            <ReadAloudButton
              text="Kính chào bác Nguyễn Văn Hùng. Hệ thống ghi nhận bác đã kiểm tra phòng khám ban đầu thành công."
              label="lời chào"
            />
          </div>
          <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-[#008751]">
            Đã kiểm tra phòng khám ban đầu
          </div>
          {session?.next_action?.message ? (
            <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-500">
              Bước tiếp theo: {session.next_action.message}
            </p>
          ) : null}
        </div>

        <Link
          href="/assistant?screen=voice"
          className="relative block overflow-hidden rounded-[28px] bg-[#008751] p-5 text-white shadow-lg"
        >
          <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-emerald-300/10" />
          <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-white/5" />
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-[72%]">
              <span className="inline-flex rounded-full bg-emerald-500/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-100">
                Mới: AI Bạch Mai
              </span>
              <h2 className="mt-2 text-2xl font-black leading-tight">Trợ lý AI điều hướng</h2>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-emerald-50">
                Chạm vào micro để hỏi ngay trên màn hình: bác đi đâu tiếp theo, phòng nào, tầng nào.
              </p>
            </div>
            <div className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/20">
              <div className="absolute inset-0 animate-ping rounded-full border-2 border-white/40 opacity-60" />
              <MicIcon />
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 px-3 py-3 text-[13px] font-semibold leading-snug">
            “Tôi vừa khám xong thì đi đâu?”
          </div>
          <div className="mt-4 flex h-14 items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-black text-[#008751]">
            <MicSmallIcon />
            HỎI TRỢ LÝ AI NGAY
          </div>
        </Link>

        <div className="grid grid-cols-3 gap-[1px] bg-gray-200 border-b border-gray-200 mt-4">
          <FeatureTile label="Quy trình khám bệnh" icon={<ProcessIcon />} />
          <FeatureTile label="Kết quả khám bệnh" icon={<ResultsIcon />} highlighted />
          <FeatureTile label="Sức khỏe cá nhân" icon={<HealthIcon />} />
          <FeatureTile label="Đặt lịch khám bệnh" icon={<ScheduleIcon />} />
          <FeatureTile label="Đánh giá hài lòng" icon={<StarIcon />} />
          <FeatureTile label="Thông báo & nhắc nhở" icon={<BellIcon />} />
        </div>

        <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl bg-[#008751] p-4 text-white">
          <div className="flex-1">
            <p className="text-sm font-bold leading-snug text-white">Tư vấn y tế trực tuyến</p>
            <p className="mt-1 text-xs leading-snug text-white/80">
              Đặt lịch với bác sĩ chuyên khoa, hỗ trợ tận tâm, bảo mật thông tin.
            </p>
            <button
              className="mt-3 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#008751]"
              onClick={() => setToast("Tính năng này đang được chuẩn hóa trong bản demo sau SDK.")}
            >
              ĐẶT LỊCH TƯ VẤN
            </button>
          </div>
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-white/20">
            <MedicineIcon />
          </div>
        </div>

        <div className="px-4 mt-4">
          <p className="mb-2 text-base font-bold text-gray-800">Lịch khám hôm nay</p>
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full bg-hospital-green-light px-2 py-0.5 text-[10px] font-semibold text-hospital-green">
                    Đã xác nhận
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-gray-900">Khám Tim mạch</p>
                <p className="mt-0.5 text-xs text-gray-500">BS. Nguyễn Minh An</p>
              </div>
              <svg viewBox="0 0 24 24" className="mt-1 h-5 w-5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="mt-3 flex items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <ClockIcon />
                14:00 - 01/07/2026
              </span>
              <span className="flex items-center gap-1">
                <PinIcon />
                A203 - Tầng 2
              </span>
            </div>
          </div>
        </div>

        <div className="px-4 mt-4 mb-2">
          <p className="text-base font-bold text-gray-800">Bài viết nổi bật</p>
        </div>

        <div className="mx-4 flex gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-200">
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-green-100 to-green-200">
              <CheckIcon className="h-8 w-8 fill-hospital-green opacity-50" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-gray-800">
              Phòng ngừa bệnh tim mạch: những điều cần biết
            </p>
            <p className="mt-1 text-[11px] text-gray-400">28/06/2026</p>
          </div>
        </div>
      </div>

      <BottomSdkNav setScreen={setScreen} active="home" />
    </div>
  );
}

function VoiceScreen({
  session,
  setScreen,
  setQuestion,
}: {
  session: PatientSession | null;
  setScreen: (screen: Screen) => void;
  setQuestion: (value: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    { id: "assistant-0", role: "assistant", text: INITIAL_ASSISTANT_PROMPT },
  ]);
  const [draft, setDraft] = useState("");
  const [warmingUp, setWarmingUp] = useState(false);
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [hint, setHint] = useState<AssistantResponse | null>(null);
  const recorderRef = useRef<PcmRecorder | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void startListening();
    return () => {
      void stopListening(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startListening() {
    if (warmingUp || listening || processing) return;
    setWarmingUp(true);
    setVoiceError(null);
    try {
      const recorder = await PcmRecorder.create();
      recorderRef.current = recorder;
      recorder.start();
      await recorder.waitUntilReady();
      await waitForMicSafeWindow();
      setListening(true);
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : "Không thể mở micro.");
      void stopListening(false);
    } finally {
      setWarmingUp(false);
    }
  }

  async function stopListening(process = true) {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setWarmingUp(false);
    setListening(false);
    if (!recorder) return;
    try {
      const blob = await recorder.stop();
      if (process) await handleRecording(blob);
    } catch (error) {
      if (process) {
        setVoiceError(error instanceof Error ? error.message : "Không thể dừng ghi âm.");
      }
    }
  }
  async function handleRecording(blob: Blob) {
    setProcessing(true);
    try {
      const result = await transcribeAudio(blob);
      const text = result.text.trim();
      if (!text) {
        SmartUXEvents.fallbackTriggered("stt_empty", {
          session_id: session?.session_id || "anonymous_session",
        });
        setVoiceError("Chưa nhận được giọng nói rõ ràng. Bác có thể nhập câu hỏi bằng chữ hoặc bấm Chụp phiếu để tiếp tục.");
        return;
      }
      await submitQuestion(text);
    } catch (error) {
      SmartUXEvents.exception(error, {
        feature: "stt",
        session_id: session?.session_id || "anonymous_session",
      });
      SmartUXEvents.fallbackTriggered("stt_failed", {
        session_id: session?.session_id || "anonymous_session",
      });
      setVoiceError(
        error instanceof Error
          ? `${error.message} Bác có thể nhập câu hỏi bằng chữ hoặc bấm Chụp phiếu để tiếp tục.`
          : "Không thể nhận giọng nói. Bác có thể nhập câu hỏi bằng chữ hoặc bấm Chụp phiếu để tiếp tục.",
      );
    } finally {
      setProcessing(false);
    }
  }

  async function submitQuestion(text: string) {
    const cleaned = text.trim();
    if (!cleaned) return;
    setQuestion(cleaned);
    setDraft(cleaned);
    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: cleaned,
        meta: "Vừa gửi",
      },
    ]);

    if (needsInstructionForm && isNextStepQuestion(cleaned)) {
      SmartUXEvents.chatbotQuestion("scan_required", {
        message_length: cleaned.length,
        session_id: session?.session_id || "anonymous_session",
      });
      SmartUXEvents.fallbackTriggered("scan_required", {
        session_id: session?.session_id || "anonymous_session",
      });
      setHint(null);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-scan-${Date.now()}`,
          role: "assistant",
          text:
            "Để biết chính xác bác phải đi đâu và làm gì tiếp theo, bác cần chụp phiếu chỉ định sau khi khám. Bác bấm nút Chụp phiếu chỉ định bên dưới, cháu sẽ đọc phiếu và sắp xếp từng bước cho bác.",
          meta: "Cần chụp phiếu chỉ định",
        },
      ]);
      return;
    }

    setProcessing(true);
    try {
      const response = await askAssistant(cleaned, session?.session_id || undefined);
      setHint(response);
      SmartUXEvents.chatbotQuestion(response.intent || "unknown", {
        message_length: cleaned.length,
        target_room: response.target_room || undefined,
        session_id: session?.session_id || "anonymous_session",
      });
      if (response.is_fallback) {
        SmartUXEvents.fallbackTriggered(response.intent || "assistant_fallback", {
          session_id: session?.session_id || "anonymous_session",
          message_length: cleaned.length,
        });
      }
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: response.response_text,
          meta: response.target_room ? `Điểm đến gợi ý: ${response.target_room}` : undefined,
        },
      ]);
    } catch (error) {
      SmartUXEvents.exception(error, {
        feature: "chatbot",
        session_id: session?.session_id || "anonymous_session",
      });
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text: error instanceof Error ? error.message : "Chưa thể trả lời lúc này.",
        },
      ]);
    } finally {
      setProcessing(false);
    }
  }

  const sampleQuestions = [
    "Tôi vừa khám xong thì đi đâu?",
    "Phòng xét nghiệm máu ở đâu?",
    "Tôi có cần quay lại bác sĩ không?",
  ];
  const needsInstructionForm =
    session?.next_action.type === "scan" ||
    session?.journey.current_step === "waiting_for_doctor" ||
    session?.journey.specialized_process_updated === false;

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <Header title="Trợ lý AI điều hướng" onBack={() => setScreen("home")} />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 pb-4">
        <FlowStageRail active="ask" />
        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#008751] text-white shadow-sm">
                <MicIcon />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900">Cháu sẵn sàng hỗ trợ bác</p>
                <p className="text-xs font-semibold text-slate-500">
                  {warmingUp
                    ? "Đang chuẩn bị micro, chưa nói vội"
                    : listening
                    ? "Micro đang hoạt động"
                    : processing
                      ? "Đang xử lý giọng nói"
                      : "Bác có thể nói hoặc nhập bằng chữ"}
                </p>
              </div>
            </div>
            <ReadAloudButton
              text="Cháu sẵn sàng hỗ trợ bác. Bác có thể nói hoặc nhập câu hỏi bằng chữ."
              label="trạng thái nghe"
            />
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-relaxed text-[#006b3e]">
            {voiceError ||
              "Nếu micro chưa nhận giọng, bác có thể nhập câu hỏi bằng chữ hoặc chụp phiếu chỉ định để hệ thống biết bước tiếp theo."}
          </div>

          <div className="mt-4 flex items-center gap-3">
            {true ? (
              <button
                type="button"
                onClick={() => setScreen("scan")}
                className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-[#008751] text-sm font-black text-white shadow-sm"
              >
                Chụp phiếu chỉ định
              </button>
            ) : null}
            <Link
              href="/navigate"
              className="flex h-12 flex-1 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-sm font-black text-slate-700"
            >
              Xem bản đồ thật
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[84%] rounded-2xl px-4 py-3 shadow-sm ${
                  message.role === "user"
                    ? "rounded-tr-none bg-slate-200 text-slate-800"
                    : "rounded-tl-none border border-emerald-100 bg-white text-slate-800"
                }`}
              >
                <p className="text-[15px] font-bold leading-relaxed">{message.text}</p>
                {message.meta ? (
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">{message.meta}</p>
                ) : null}
                {message.role === "assistant" ? (
                  <div className="mt-2">
                    <ReadAloudButton
                      text={message.text}
                      label="câu trả lời"
                      inlineLabel
                      className="justify-center rounded-xl px-3 py-2 text-xs font-bold"
                    />
                  </div>
                ) : null}
                {message.meta === "Cần chụp phiếu chỉ định" ? (
                  <button
                    type="button"
                    onClick={() => setScreen("scan")}
                    className="mt-3 flex h-10 w-full items-center justify-center rounded-xl bg-[#008751] px-3 text-xs font-black text-white"
                  >
                    Chụp phiếu khám
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {hint?.target_room ? (
          <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#008751]">
              Điểm đến gợi ý
            </p>
            <p className="mt-1 text-sm font-bold text-slate-800">
              Phòng {hint.target_room}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {hint.response_text}
            </p>
            {hint.target_location_id ? (
              <Link
                href={`/navigate?destination=${encodeURIComponent(hint.target_location_id)}`}
                className="mt-3 flex h-11 w-full items-center justify-center rounded-2xl bg-[#008751] text-sm font-black text-white"
              >
                Chỉ đường đến phòng {hint.target_room}
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-3">
          <p className="text-center text-xs font-black uppercase tracking-wider text-slate-500">
            Bác có thể chạm nhanh câu hỏi mẫu:
          </p>
          <div className="space-y-2">
            {sampleQuestions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => void submitQuestion(item)}
                className="flex min-h-14 w-full items-center justify-between rounded-2xl border-2 border-slate-100 bg-white px-4 text-left text-[15px] font-bold text-slate-800 shadow-sm active:scale-[0.98]"
              >
                <span>“{item}”</span>
                <span className="text-xs text-[#008751]">Chạm</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white p-3 shadow-2xl">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submitQuestion(draft);
          }}
        >
          <button
            type="button"
            onClick={() => (listening ? stopListening() : void startListening())}
            disabled={processing || warmingUp}
            aria-label={listening ? "Dừng nghe" : "Bật micro"}
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-white shadow-sm disabled:opacity-60 ${
              warmingUp ? "bg-amber-500" : listening ? "bg-red-500" : "bg-[#008751]"
            }`}
          >
            <MicSmallIcon />
          </button>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Nhập câu hỏi bằng chữ"
            className="h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
          />
          {needsInstructionForm ? (
            <button
              type="button"
              onClick={() => setScreen("scan")}
              className="flex h-12 items-center justify-center rounded-2xl border-2 border-[#008751] bg-white px-3 text-xs font-black text-[#008751]"
            >
              Chụp phiếu
            </button>
          ) : null}
          <button
            type="submit"
            className="flex h-12 items-center justify-center rounded-2xl bg-[#008751] px-4 text-sm font-black text-white"
          >
            Gửi
          </button>
        </form>
      </div>
    </div>
  );
}

function isNextStepQuestion(text: string) {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return [
    "di dau",
    "lam gi",
    "buoc tiep",
    "tiep theo",
    "phai di",
    "can di",
    "toi di",
    "di tiep",
  ].some((phrase) => normalized.includes(phrase));
}

function ScanScreen({
  file,
  setFile,
  runOcr,
  busy,
  setScreen,
}: {
  file: File | null;
  setFile: (value: File | null) => void;
  runOcr: () => void;
  busy: string | null;
  setScreen: (screen: Screen) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <Header title="Quét phiếu chỉ định" onBack={() => setScreen("home")} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-24">
        <FlowStageRail active="scan" />
        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-black text-slate-900">Chụp phiếu chỉ định</p>
          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
            Dùng ảnh rõ nét để hệ thống đọc đúng số phòng và phòng khám ban đầu.
          </p>
          <div className="mt-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-[#008751] file:px-4 file:py-2 file:text-sm file:font-black file:text-white"
            />
            <p className="mt-3 text-xs text-slate-500">
              {file ? `Đã chọn: ${file.name}` : "Chưa có tệp nào được chọn."}
            </p>
          </div>
          <button
            type="button"
            onClick={runOcr}
            disabled={busy === "ocr"}
            className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-[#008751] text-sm font-black text-white disabled:opacity-60"
          >
            {busy === "ocr" ? "Đang đọc phiếu..." : "Đọc phiếu ngay"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OcrScreen({
  ocr,
  confirmResult,
  busy,
  setScreen,
}: {
  ocr: OcrResult | null;
  confirmResult: () => void;
  busy: string | null;
  setScreen: (screen: Screen) => void;
}) {
  if (!ocr) {
    return (
      <div className="flex min-h-full flex-col bg-slate-50">
        <Header title="Xác nhận phiếu" onBack={() => setScreen("scan")} />
        <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-slate-500">
          Chưa có dữ liệu phiếu để xác nhận.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <Header title="Xác nhận phiếu" onBack={() => setScreen("scan")} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-24">
        <FlowStageRail active="journey" />
        <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#008751]">
                Kết quả OCR
              </p>
              <h3 className="mt-1 text-lg font-black text-slate-900">
                Độ tin cậy {(ocr.confidence * 100).toFixed(0)}%
              </h3>
            </div>
            <ReadAloudButton
              text={`Kết quả OCR có độ tin cậy ${(ocr.confidence * 100).toFixed(0)} phần trăm.`}
              label="độ tin cậy"
            />
          </div>

          <div className="mt-4 space-y-3">
            <OcrField
              label="Phòng khám ban đầu"
              value={ocr.fields.initial_exam_room || "Chưa xác định"}
              speak={`Phòng khám ban đầu là ${ocr.fields.initial_exam_room || "chưa xác định"}.`}
            />
            <OcrField
              label="Phòng quay lại"
              value={ocr.fields.return_room || "Chưa xác định"}
              speak={`Phòng quay lại là ${ocr.fields.return_room || "chưa xác định"}.`}
            />
            <OcrField
              label="Số phòng đã nhận diện"
              value={ocr.fields.detected_room_codes.join(", ") || "Chưa nhận diện được"}
              speak={`Các số phòng đã nhận diện gồm ${ocr.fields.detected_room_codes.join(", ") || "chưa nhận diện được"}.`}
            />
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold leading-relaxed text-slate-500">
            Sau khi xác nhận, hành trình sẽ giữ đúng luồng bắt đầu từ quầy đăng ký đến phòng khám ban đầu, rồi mới sang các bước tiếp theo.
          </p>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white p-4">
        <button
          type="button"
          onClick={confirmResult}
          disabled={busy === "confirm"}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#008751] text-sm font-black text-white disabled:opacity-60"
        >
          {busy === "confirm" ? "Đang xác nhận..." : "Xác nhận để tiếp tục"}
        </button>
      </div>
    </div>
  );
}

function ChecklistScreen({
  session,
  steps,
  activeStep,
  targetRoom,
  busy,
  setScreen,
  confirmArrived,
  arrivalConfirmed,
  question,
}: {
  session: PatientSession | null;
  steps: FlowStep[];
  activeStep: FlowStep;
  targetRoom: string;
  busy: string | null;
  setScreen: (screen: Screen) => void;
  confirmArrived: () => void;
  arrivalConfirmed: boolean;
  question: string;
}) {
  const activeIndex = Math.max(0, steps.findIndex((step) => step.id === activeStep.id));

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <Header title="Hành trình khám của bác" onBack={() => setScreen("home")} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-4">
        <FlowStageRail active="journey" />
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">
              Tiến độ hôm nay
            </span>
            <h3 className="text-xl font-black text-slate-900">
              Bước <span className="text-[#008751]">{activeIndex + 1}</span>/{steps.length}
            </h3>
          </div>
          <div className="mt-3 flex h-2.5 gap-1.5">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex-1 rounded-full ${
                  step.status === "completed"
                    ? "bg-[#008751]"
                    : step.status === "active"
                      ? "bg-amber-400"
                      : "bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="space-y-4">
            {steps.map((step, idx) => (
              <div
                key={step.id}
                className={`flex items-start gap-4 rounded-2xl p-3 ${
                  step.status === "active" ? "border border-emerald-100 bg-emerald-50/50" : ""
                }`}
              >
                <StepDot status={step.status} index={idx} />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4
                      className={`text-[15px] font-bold ${
                        step.status === "active"
                          ? "text-[#008751]"
                          : step.status === "completed"
                            ? "text-slate-400 line-through"
                            : "text-slate-700"
                      }`}
                    >
                      {step.label}
                      {step.room ? ` (Phòng ${step.room})` : ""}
                    </h4>
                    <ReadAloudButton
                      text={step.instruction || `${step.label}${step.room ? ` tại phòng ${step.room}` : ""}`}
                      label={step.label}
                    />
                  </div>
                  {step.status === "active" && step.instruction ? (
                    <div className="mt-2 rounded-xl border border-emerald-100 bg-white/90 p-3 text-xs font-semibold leading-relaxed text-slate-600">
                      <span className="block font-black text-[#006b3e]">Cháu hướng dẫn bác:</span>
                      {step.instruction}
                    </div>
                  ) : null}
                  {step.room && step.status !== "completed" ? (
                    <Link
                      href={`/navigate?destination=${encodeURIComponent(routeLocationForRoom(step.room))}`}
                      className="mt-2 inline-flex h-9 items-center justify-center rounded-xl bg-[#008751] px-3 text-xs font-black text-white"
                    >
                      Chỉ đường
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-black text-slate-900">Câu hỏi hiện tại</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{question}</p>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white p-4 shadow-2xl">
        <div className="space-y-2.5">
          <Link
            href={`/navigate?destination=${encodeURIComponent(routeLocationForRoom(targetRoom))}`}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#008751] text-sm font-black text-white"
          >
            Xem bản đồ thật
          </Link>
          <button
            type="button"
            onClick={confirmArrived}
            disabled={busy === "arrive"}
            className="flex h-12 w-full items-center justify-center rounded-2xl border-2 border-slate-300 bg-white text-sm font-black text-slate-700 disabled:opacity-60"
          >
            {arrivalConfirmed ? "Đã xác nhận đến nơi" : "Xác nhận đã đến nơi"}
          </button>
          <button
            type="button"
            onClick={() => setScreen("scan")}
            className="flex h-12 w-full items-center justify-center rounded-2xl border-2 border-slate-200 text-sm font-bold text-slate-600"
          >
            Quét lại phiếu chỉ định
          </button>
          <button
            type="button"
            onClick={() => setScreen("end")}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-700"
          >
            Kết thúc phiên hỗ trợ
          </button>
        </div>
      </div>
    </div>
  );
}

function FallbackScreen({ setScreen }: { setScreen: (screen: Screen) => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <Header title="Trợ giúp & an toàn" onBack={() => setScreen("home")} />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-24">
        <WarningCard
          title="Cháu chưa đọc rõ chỉ định của bác."
          text="Bác hãy chụp lại phiếu rõ hơn hoặc hỏi quầy hướng dẫn gần nhất để được hỗ trợ trực tiếp."
        />
        <WarningCard
          title="Giới hạn tư vấn y khoa"
          text="Cháu chỉ hỗ trợ điều hướng và thao tác bệnh viện, không thay thế bác sĩ điều trị."
        />
        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold leading-relaxed text-slate-500">
            Hệ thống luôn ưu tiên luồng an toàn: xác nhận phiếu, chỉ đường đúng phòng, và giữ dữ liệu phiên ở phạm vi hiện tại.
          </p>
        </div>
      </div>
      <div className="border-t border-slate-200 bg-white p-4">
        <button
          onClick={() => setScreen("home")}
          className="h-12 w-full rounded-xl bg-slate-100 text-sm font-black text-slate-700"
        >
          Quay lại trang chủ Bạch Mai
        </button>
      </div>
    </div>
  );
}

function EndScreen({
  session,
  steps,
  setScreen,
}: {
  session: PatientSession | null;
  steps: FlowStep[];
  setScreen: (screen: Screen) => void;
}) {
  useEffect(() => {
    SmartUXEvents.sessionEnded("completed", {
      session_id: session?.session_id || "anonymous_session",
      steps_completed: steps.length,
    });
  }, [session?.session_id, steps.length]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <Header title="Hoàn thành dịch vụ" onBack={() => setScreen("checklist")} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <FlowStageRail active="done" />
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#008751] bg-emerald-50 text-[#008751]">
            <CheckBigIcon />
          </div>
          <div className="mt-3 flex items-start justify-center gap-2">
            <h2 className="text-2xl font-black leading-tight text-slate-900">
              Bác đã hoàn thành hành trình khám hôm nay.
            </h2>
            <ReadAloudButton
              text="Chúc mừng bác. Bác đã hoàn thành hành trình khám hôm nay. Bệnh viện Bạch Mai xin cảm ơn và chúc bác dồi dào sức khỏe."
              label="hoàn thành"
            />
          </div>
          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
            Bệnh viện Bạch Mai cảm ơn bác
          </p>
        </div>
        <div className="mt-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="border-b border-slate-100 pb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
            Các thủ tục đã hoàn thành
          </p>
          <div className="mt-3 space-y-3">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#008751] text-white">
                    <CheckSmallIcon />
                  </span>
                  <span className="text-sm font-black text-slate-500 line-through">{step.label}</span>
                </div>
                <ReadAloudButton text={`Bác đã hoàn thành ${step.label}`} label={step.label} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-t-3xl border-t border-slate-200 bg-white p-4">
        <button
          onClick={() => setScreen("home")}
          className="h-14 w-full rounded-2xl bg-[#008751] text-base font-black text-white"
        >
          Kết thúc phiên hỗ trợ
        </button>
        <button
          onClick={() => setScreen("checklist")}
          className="mt-2 h-12 w-full rounded-2xl border-2 border-slate-300 text-sm font-bold text-slate-700"
        >
          Xem lại hướng dẫn
        </button>
      </div>
    </div>
  );
}

type FlowStageId = "ask" | "scan" | "journey" | "route" | "done";

function FlowStageRail({ active }: { active: FlowStageId }) {
  const stages: Array<{ id: FlowStageId; label: string }> = [
    { id: "ask", label: "Hỏi" },
    { id: "scan", label: "Chụp phiếu" },
    { id: "journey", label: "Hành trình" },
    { id: "route", label: "Chỉ đường" },
    { id: "done", label: "Xong" },
  ];
  const activeIndex = stages.findIndex((stage) => stage.id === active);

  return (
    <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className="grid grid-cols-5 gap-1.5">
        {stages.map((stage, index) => {
          const isActive = stage.id === active;
          const isDone = index < activeIndex;
          return (
            <div
              key={stage.id}
              className={`rounded-xl px-1.5 py-2 text-center text-[10px] font-black leading-tight ${
                isActive
                  ? "bg-[#008751] text-white"
                  : isDone
                    ? "bg-emerald-50 text-[#008751]"
                    : "bg-slate-100 text-slate-400"
              }`}
            >
              <div className="mx-auto mb-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-[10px] text-slate-700">
                {isDone ? <CheckSmallIcon /> : index + 1}
              </div>
              {stage.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function routeLocationForRoom(room: string) {
  return room.startsWith("loc_") ? room : `loc_${room}`;
}

function getAssistantScreenName(screen: Screen) {
  const mapping: Record<Screen, string> = {
    home: "Home",
    voice: "AssistantVoice",
    scan: "ScanForm",
    ocr: "OcrConfirm",
    checklist: "JourneyChecklist",
    fallback: "Fallback",
    end: "EndSession",
  };
  return mapping[screen];
}

function buildSteps(session: PatientSession | null): FlowStep[] {
  const registerStep: FlowStep = {
    id: "register",
    label: "Đăng ký khám",
    room: session?.journey.register.location_code || "A101",
    status: session?.journey.register.is_done ? "completed" : session?.journey.current_step === "register" ? "active" : "pending",
    instruction: "Bác đến quầy hướng dẫn để tiếp tục thủ tục đăng ký.",
  };
  const identityStep: FlowStep = {
    id: "identity",
    label: "Xác thực CCCD/VNeID",
    room: session?.journey.identity.location_code || "A103",
    status: session?.journey.identity.is_done ? "completed" : session?.journey.current_step === "identity" ? "active" : "pending",
    instruction: "Bác xác thực giấy tờ tại quầy xác thực CCCD/VNeID.",
  };
  const paymentStep: FlowStep = {
    id: "payment",
    label: "Thanh toán phí",
    room: session?.journey.payment.location_code || "A115",
    status: session?.journey.payment.is_done ? "completed" : session?.journey.current_step === "payment" ? "active" : "pending",
    instruction: "Bác đến quầy thanh toán để hoàn tất thủ tục trước khi khám.",
  };

  const initialExamRoom = session?.journey.extracted_fields.initial_exam_room || "A203";
  const waitingForDoctor = session?.journey.current_step === "waiting_for_doctor" || !session?.journey.specialized_process_updated;
  const initialExamStep: FlowStep = {
    id: "initial_exam",
    label: "Khám ban đầu",
    room: initialExamRoom,
    status: waitingForDoctor ? "active" : "completed",
    instruction: `Bác đến phòng khám ban đầu ${initialExamRoom} để bác sĩ khám và chỉ định bước tiếp theo.`,
  };

  const services = session?.journey.specialized_process?.services ?? [];
  const serviceSteps = services.map((service) => serviceToStep(service, session));
  const returnRoom =
    session?.journey.specialized_process?.return_room || session?.journey.extracted_fields.return_room;
  const returnStep: FlowStep | null = returnRoom
    ? {
        id: "return",
        label: "Quay lại bác sĩ",
        room: returnRoom,
        status: session?.next_action.type === "done" ? "completed" : "pending",
        instruction: `Sau khi làm xong các chỉ định, bác quay lại phòng ${returnRoom}.`,
      }
    : null;

  const full = [registerStep, identityStep, paymentStep, initialExamStep, ...serviceSteps, ...(returnStep ? [returnStep] : [])];
  if (!full.some((step) => step.status === "active")) {
    const nextTarget = session?.next_action.target_room;
    const match = full.find((step) => step.room === nextTarget && step.status !== "completed");
    if (match) match.status = "active";
  }
  return full;
}

function serviceToStep(service: SpecializedService, session: PatientSession | null): FlowStep {
  const active = session?.next_action.target_room === service.room && service.status !== "completed";
  const description = service.description || service.service_name;
  return {
    id: service.service_id,
    label: service.service_name,
    room: service.room,
    floor: service.floor,
    status: service.status === "completed" ? "completed" : active ? "active" : "pending",
    instruction: `Bác hãy di chuyển đến phòng ${service.room}, tầng ${service.floor} để ${description.toLowerCase()}.`,
  };
}

function StepDot({ status, index }: { status: FlowStep["status"]; index: number }) {
  if (status === "completed") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#008751] text-white">
        <CheckSmallIcon />
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="flex h-8 w-8 animate-pulse items-center justify-center rounded-full border-2 border-amber-500 bg-amber-400 text-sm font-black text-slate-900">
        ›
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-300 bg-white text-xs font-bold text-slate-400">
      {index + 1}
    </div>
  );
}

function Header({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className="flex h-14 items-center justify-between bg-[#008751] px-4 text-white shadow-sm">
      <button
        type="button"
        onClick={onBack}
        className="flex min-w-16 items-center gap-1 text-sm font-bold disabled:opacity-0"
        disabled={!onBack}
      >
        <ChevronLeftIcon />
        Quay lại
      </button>
      <div className="text-center text-base font-extrabold">{title}</div>
      <div className="w-16" />
    </div>
  );
}

function BottomSdkNav({ setScreen, active }: { setScreen: (screen: Screen) => void; active: "home" | "journey" }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 flex h-20 items-center justify-between rounded-t-2xl border-t border-slate-200 bg-white px-3 shadow-xl">
      <button
        onClick={() => setScreen("home")}
        className={`flex flex-1 flex-col items-center gap-1 ${active === "home" ? "text-[#008751]" : "text-slate-400"}`}
      >
        <HomeIcon />
        <span className="text-[11px] font-bold">Trang chủ</span>
      </button>
      <button onClick={() => setScreen("checklist")} className="flex flex-1 flex-col items-center gap-1 text-slate-400">
        <ClockIcon />
        <span className="text-[11px] font-medium">Hành trình</span>
      </button>
      <div className="-mt-8 flex flex-1 justify-center">
        <button
          onClick={() => setScreen("voice")}
          className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-[#008751] text-white shadow-lg"
        >
          <MicSmallIcon />
        </button>
      </div>
      <button onClick={() => setScreen("fallback")} className="flex flex-1 flex-col items-center gap-1 text-slate-400">
        <HelpIcon />
        <span className="text-[11px] font-medium">Trợ giúp</span>
      </button>
      <button className="flex flex-1 flex-col items-center gap-1 text-slate-400">
        <GearIcon />
        <span className="text-[11px] font-medium">Tiện ích</span>
      </button>
    </div>
  );
}

function WarningCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-4 pr-14 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-black text-rose-600">{title}</h3>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">{text}</p>
        </div>
        <ReadAloudButton text={`${title} ${text}`} label={title} />
      </div>
    </div>
  );
}

function OcrField({ label, value, speak }: { label: string; value: string; speak: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</label>
        <ReadAloudButton text={speak} label={label} />
      </div>
      <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm font-black leading-relaxed text-slate-900">
        {value}
      </div>
    </div>
  );
}

class PcmRecorder {
  private context: AudioContext;
  private stream: MediaStream;
  private source: MediaStreamAudioSourceNode;
  private processor: ScriptProcessorNode;
  private chunks: Float32Array[] = [];
  private readyPromise: Promise<void>;
  private markReady: () => void = () => undefined;

  private constructor(context: AudioContext, stream: MediaStream) {
    this.context = context;
    this.stream = stream;
    this.source = context.createMediaStreamSource(stream);
    this.processor = context.createScriptProcessor(4096, 1, 1);
    this.readyPromise = new Promise((resolve) => {
      this.markReady = resolve;
    });
    this.processor.onaudioprocess = (event) => {
      this.markReady();
      const channel = event.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(channel));
    };
  }

  static async create(): Promise<PcmRecorder> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Trình duyệt không hỗ trợ ghi âm microphone.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextClass();
    return new PcmRecorder(context, stream);
  }

  start() {
    void this.context.resume();
    this.source.connect(this.processor);
    this.processor.connect(this.context.destination);
  }

  async waitUntilReady(): Promise<void> {
    await Promise.race([
      this.readyPromise,
      new Promise<void>((resolve) => window.setTimeout(resolve, 900)),
    ]);
  }

  async stop(): Promise<Blob> {
    this.processor.disconnect();
    this.source.disconnect();
    this.stream.getTracks().forEach((track) => track.stop());
    const sampleRate = this.context.sampleRate;
    await this.context.close();
    const samples = mergeChunks(this.chunks);
    const trimmed = trimSilence(samples);
    return encodeWav(trimmed.length > 0 ? trimmed : samples, sampleRate);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

function mergeChunks(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function trimSilence(samples: Float32Array): Float32Array {
  const threshold = 0.012;
  let start = 0;
  let end = samples.length - 1;
  while (start < samples.length && Math.abs(samples[start]) < threshold) start += 1;
  while (end > start && Math.abs(samples[end]) < threshold) end -= 1;
  const padding = 1600;
  return samples.slice(Math.max(0, start - padding), Math.min(samples.length, end + padding));
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function FeatureTile({
  label,
  icon,
  highlighted = false,
}: {
  label: string;
  icon: React.ReactNode;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 bg-white py-4 ${
        highlighted ? "border-2 border-hospital-green" : "border-2 border-transparent"
      }`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-hospital-green-light">
        {icon}
      </div>
      <span className="px-1 text-center text-[11px] font-medium leading-tight text-gray-700">
        {label}
      </span>
    </div>
  );
}

function IconCircle({ children }: { children: React.ReactNode }) {
  return <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#006b3e]">{children}</div>;
}

function HomeIcon() {
  return (
    <Svg>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </Svg>
  );
}

function Svg({ children, className = "h-5 w-5" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function ChevronLeftIcon() {
  return <Svg><path d="m15 18-6-6 6-6" /></Svg>;
}
function BellIcon() {
  return <Svg><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></Svg>;
}
function UserIcon() {
  return <Svg><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></Svg>;
}
function MicIcon() {
  return (
    <Svg className="h-12 w-12">
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
    </Svg>
  );
}
function MicSmallIcon() {
  return (
    <Svg>
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v3" />
    </Svg>
  );
}
function HospitalIcon() {
  return (
    <Svg className="h-8 w-8">
      <path d="M12 3v18" />
      <path d="M3 12h18" />
      <circle cx="12" cy="12" r="9" />
    </Svg>
  );
}
function ProcessIcon() {
  return (
    <Svg>
      <path d="M9 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <path d="M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2" />
      <path d="M9 13l2 2 4-4" />
    </Svg>
  );
}
function ResultsIcon() {
  return (
    <Svg>
      <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75z" />
      <path d="M9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625z" />
      <path d="M16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125z" />
    </Svg>
  );
}
function HealthIcon() {
  return (
    <Svg>
      <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </Svg>
  );
}
function ScheduleIcon() {
  return (
    <Svg>
      <path d="M6.75 3v2.25M17.25 3v2.25" />
      <path d="M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </Svg>
  );
}
function StarIcon() {
  return (
    <Svg>
      <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.563.563 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.563.563 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5z" />
    </Svg>
  );
}
function MedicineIcon() {
  return (
    <Svg>
      <path d="M20 7h-4V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1z" />
      <path d="M12 10v6" />
      <path d="M9 13h6" />
    </Svg>
  );
}
function ClockIcon() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}
function PinIcon() {
  return (
    <Svg>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </Svg>
  );
}
function CheckIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}
function CheckBigIcon() {
  return <CheckIcon className="h-12 w-12" />;
}
function CheckSmallIcon() {
  return <Svg className="h-4 w-4"><path d="M20 6 9 17l-5-5" /></Svg>;
}
function HelpIcon() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a3 3 0 1 1 4.8 2.4c-.9.6-1.3 1.1-1.3 2.1" />
      <path d="M12 17h.01" />
    </Svg>
  );
}
function GearIcon() {
  return (
    <Svg>
      <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .3 2l.1.1-2.1 2.1-.1-.1a1.8 1.8 0 0 0-2-.3 1.8 1.8 0 0 0-1 1.7V21h-3v-.5a1.8 1.8 0 0 0-1-1.7 1.8 1.8 0 0 0-2 .3l-.1.1-2.1-2.1.1-.1a1.8 1.8 0 0 0 .3-2 1.8 1.8 0 0 0-1.7-1H3v-3h.5a1.8 1.8 0 0 0 1.7-1 1.8 1.8 0 0 0-.3-2l-.1-.1 2.1-2.1.1.1a1.8 1.8 0 0 0 2 .3 1.8 1.8 0 0 0 1-1.7V3h3v.5a1.8 1.8 0 0 0 1 1.7 1.8 1.8 0 0 0 2-.3l.1-.1 2.1 2.1-.1.1a1.8 1.8 0 0 0-.3 2 1.8 1.8 0 0 0 1.7 1h.5v3h-.5a1.8 1.8 0 0 0-1.7 1Z" />
    </Svg>
  );
}
