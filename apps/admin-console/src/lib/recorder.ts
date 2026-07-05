/** Records microphone audio and encodes it as 16-bit PCM WAV for /stt.
 * Ported from apps/hospital-app/src/components/VoiceQuestionPanel.tsx so both
 * apps post the same WAV shape the real VNPT SmartVoice STT adapter expects. */
export class PcmRecorder {
  private context: AudioContext;
  private stream: MediaStream;
  private source: MediaStreamAudioSourceNode;
  private processor: ScriptProcessorNode;
  private chunks: Float32Array[] = [];
  private readyPromise: Promise<void>;
  private markReady: () => void = () => undefined;
  private hasAudioFrame = false;

  private constructor(context: AudioContext, stream: MediaStream) {
    this.context = context;
    this.stream = stream;
    this.source = context.createMediaStreamSource(stream);
    this.processor = context.createScriptProcessor(4096, 1, 1);
    this.readyPromise = new Promise((resolve) => {
      this.markReady = resolve;
    });
    this.processor.onaudioprocess = (event) => {
      if (!this.hasAudioFrame) {
        this.hasAudioFrame = true;
        this.markReady();
      }
      const channel = event.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(channel));
    };
  }

  static async create(): Promise<PcmRecorder> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Trình duyệt không hỗ trợ ghi âm microphone.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
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
    await Promise.race([this.readyPromise, new Promise<void>((resolve) => window.setTimeout(resolve, 900))]);
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
