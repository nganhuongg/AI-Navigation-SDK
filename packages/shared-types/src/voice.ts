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

export type STTResponse = {
  text: string;
  confidence: number;
  preprocess: VoicePreprocessInfo;
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
