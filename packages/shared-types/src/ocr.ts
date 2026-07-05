// Types for OCR extraction results from scanned instruction forms.
export type OCRResult = {
  ocr_result_id: string;
  source_image: string;
  confidence: number;
  fields: {
    initial_exam_room: string | null;
    ordered_services: string[];
    return_room: string | null;
    detected_room_codes: string[];
    room_descriptions: Record<string, string>;
    room_notes: Record<string, string>;
    room_queue_numbers: Record<string, string>;
  };
  requires_user_confirmation: boolean;
  // True when confidence is below threshold → UI shows the "chụp lại" fallback.
  is_low_confidence: boolean;
};
