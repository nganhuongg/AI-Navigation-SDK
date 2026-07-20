/** Records microphone audio and encodes it as 16-bit PCM WAV for /stt.
 * Ported from apps/hospital-app/src/components/VoiceQuestionPanel.tsx so both
 * apps post the same WAV shape the real VNPT SmartVoice STT adapter expects. */
export type RecorderStartupMetrics = {
  click_to_get_user_media_start_ms: number;
  get_user_media_ms: number;
  create_ms: number;
  start_to_first_audio_frame_ms: number | null;
  start_to_ready_ms: number;
  mic_ready_ms: number;
  ready_by_timeout: boolean;
  sample_rate: number;
  buffer_size: number;
};

export type RecorderAudioMetrics = {
  captured_duration_ms: number;
  wav_duration_ms: number;
  samples: number;
  first_audio_frame_to_stop_ms: number | null;
  silence_trim_applied: boolean;
};

export class PcmRecorder {
  private context: AudioContext;
  private stream: MediaStream;
  private source: MediaStreamAudioSourceNode;
  private processor: ScriptProcessorNode;
  private chunks: Float32Array[] = [];
  private readyPromise: Promise<void>;
  private markReady: () => void = () => undefined;
  private hasAudioFrame = false;
  private clickedAt: number;
  private getUserMediaStartedAt: number;
  private getUserMediaDoneAt: number;
  private createdAt: number;
  private startCalledAt: number | null = null;
  private firstAudioFrameAt: number | null = null;
  private readyResolvedAt: number | null = null;
  private readyByTimeout = false;
  private stoppedAt: number | null = null;
  private audioMetrics: RecorderAudioMetrics | null = null;

  private constructor(
    context: AudioContext,
    stream: MediaStream,
    clickedAt: number,
    getUserMediaStartedAt: number,
    getUserMediaDoneAt: number,
  ) {
    this.context = context;
    this.stream = stream;
    this.source = context.createMediaStreamSource(stream);
    this.processor = context.createScriptProcessor(4096, 1, 1);
    this.clickedAt = clickedAt;
    this.getUserMediaStartedAt = getUserMediaStartedAt;
    this.getUserMediaDoneAt = getUserMediaDoneAt;
    this.createdAt = performance.now();
    this.readyPromise = new Promise((resolve) => {
      this.markReady = resolve;
    });
    this.processor.onaudioprocess = (event) => {
      if (!this.hasAudioFrame) {
        this.hasAudioFrame = true;
        this.firstAudioFrameAt = performance.now();
        this.markReady();
      }
      const channel = event.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(channel));
    };
  }

  static async create(clickedAt = performance.now()): Promise<PcmRecorder> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Trình duyệt không hỗ trợ ghi âm microphone.");
    }
    const getUserMediaStartedAt = performance.now();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const getUserMediaDoneAt = performance.now();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextClass();
    return new PcmRecorder(context, stream, clickedAt, getUserMediaStartedAt, getUserMediaDoneAt);
  }

  start() {
    this.startCalledAt = performance.now();
    void this.context.resume();
    this.source.connect(this.processor);
    this.processor.connect(this.context.destination);
  }

  async waitUntilReady(): Promise<void> {
    this.readyByTimeout = false;
    await Promise.race([
      this.readyPromise,
      new Promise<void>((resolve) =>
        window.setTimeout(() => {
          if (!this.hasAudioFrame) this.readyByTimeout = true;
          resolve();
        }, 900),
      ),
    ]);
    this.readyResolvedAt = performance.now();
  }

  getStartupMetrics(): RecorderStartupMetrics | null {
    if (this.startCalledAt === null || this.readyResolvedAt === null) return null;
    return {
      click_to_get_user_media_start_ms: Math.round(this.getUserMediaStartedAt - this.clickedAt),
      get_user_media_ms: Math.round(this.getUserMediaDoneAt - this.getUserMediaStartedAt),
      create_ms: Math.round(this.createdAt - this.clickedAt),
      start_to_first_audio_frame_ms:
        this.firstAudioFrameAt === null ? null : Math.round(this.firstAudioFrameAt - this.startCalledAt),
      start_to_ready_ms: Math.round(this.readyResolvedAt - this.startCalledAt),
      mic_ready_ms: Math.round(this.readyResolvedAt - this.clickedAt),
      ready_by_timeout: this.readyByTimeout,
      sample_rate: this.context.sampleRate,
      buffer_size: this.processor.bufferSize,
    };
  }

  getAudioMetrics(): RecorderAudioMetrics | null {
    return this.audioMetrics;
  }

  async stop(): Promise<Blob> {
    this.stoppedAt = performance.now();
    this.processor.disconnect();
    this.source.disconnect();
    this.stream.getTracks().forEach((track) => track.stop());
    const sampleRate = this.context.sampleRate;
    await this.context.close();
    const samples = mergeChunks(this.chunks);
    const durationMs = Math.round((samples.length / sampleRate) * 1000);
    this.audioMetrics = {
      captured_duration_ms: durationMs,
      wav_duration_ms: durationMs,
      samples: samples.length,
      first_audio_frame_to_stop_ms:
        this.firstAudioFrameAt === null || this.stoppedAt === null
          ? null
          : Math.round(this.stoppedAt - this.firstAudioFrameAt),
      silence_trim_applied: false,
    };
    return encodeWav(samples, sampleRate);
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
