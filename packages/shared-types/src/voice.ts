// Types for voice: STT (speech→text) and TTS (text→speech).
export type VoicePreprocessInfo = {
  enabled: boolean;
  vad_applied: boolean;
  denoise_applied: boolean;
  input_sample_rate: number | null;
  output_sample_rate: number | null;
  input_duration_ms: number | null;
  output_duration_ms: number | null;
  speech_segments: number;
  engines: string[];
  note: string;
};

export type STTTimingInfo = {
  request_read_ms: number | null;
  preprocessing_ms: number;
  adapter_ms: number;
  total_ms: number;
};

export type STTResponse = {
  text: string;
  confidence: number;
  preprocess: VoicePreprocessInfo;
  timing: STTTimingInfo;
};

export type TTSRequest = {
  text: string;
  voice: string;
};

export type TTSResponse = {
  audio_base64: string;
  media_type: string;
  sample_rate: number;
};
