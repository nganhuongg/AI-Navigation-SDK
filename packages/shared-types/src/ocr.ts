// Types for OCR extraction results from scanned instruction forms.
export type OCRResult = {
  ocr_result_id: string;
  source_image: string;
  confidence: number;
  fields: {
    initial_exam_room: string | null;
    ordered_services: string[];
    return_room: string | null;
  };
  requires_user_confirmation: boolean;
};
