"""Data Protection Layer.

Strips common personal identifiers from user/OCR text before text is sent onward
to SmartBot or parsed into session fields. This is still MVP-grade redaction:
regex and label heuristics now, Vietnamese NER later.
"""

from __future__ import annotations

import re

# 12-digit Vietnamese CCCD.
CCCD_PATTERN = re.compile(r"\b\d{12}\b")
# Vietnamese phone numbers: leading 0 or +84/84, then 8-10 digits.
PHONE_PATTERN = re.compile(r"\b(?:\+?84|0)\d{8,10}\b")
# Common medical/insurance identifiers on paper forms.
MEDICAL_ID_PATTERN = re.compile(
    r"\b(?:BN|HSBA|MHS|MA\s*BN|MA\s*HS|PATIENT)[-:\s]*[A-Z0-9]{5,20}\b",
    re.IGNORECASE,
)
INSURANCE_ID_PATTERN = re.compile(r"\b[A-Z]{2}\d{13,15}\b", re.IGNORECASE)
# Dates after labels that usually indicate DOB or identity metadata.
DOB_LABEL_PATTERN = re.compile(
    r"\b(?:ngay\s*sinh|nam\s*sinh|dob|date\s*of\s*birth)\s*[::-]\s*"
    r"(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4})",
    re.IGNORECASE,
)
# Names after common labels. Stop before tab/comma/semicolon/newline so room codes
# and service rows remain available to OCR parsing.
NAME_LABEL_PATTERN = re.compile(
    r"\b(?:ho\s*ten|ten\s*benh\s*nhan|benh\s*nhan|patient\s*name|name)\s*"
    r"[::-]\s*[^\n\r;,\t]+",
    re.IGNORECASE,
)

CCCD_PLACEHOLDER = "[CCCD]"
PHONE_PLACEHOLDER = "[SDT]"
MEDICAL_ID_PLACEHOLDER = "[MA_HO_SO]"
INSURANCE_ID_PLACEHOLDER = "[BHYT]"
DOB_PLACEHOLDER = "[NGAY_SINH]"
NAME_PLACEHOLDER = "[TEN_BENH_NHAN]"


def redact_text(text: str) -> str:
    """Remove common personal identifiers from free text."""
    text = NAME_LABEL_PATTERN.sub(NAME_PLACEHOLDER, text)
    text = DOB_LABEL_PATTERN.sub(DOB_PLACEHOLDER, text)
    text = MEDICAL_ID_PATTERN.sub(MEDICAL_ID_PLACEHOLDER, text)
    text = INSURANCE_ID_PATTERN.sub(INSURANCE_ID_PLACEHOLDER, text)
    text = CCCD_PATTERN.sub(CCCD_PLACEHOLDER, text)
    text = PHONE_PATTERN.sub(PHONE_PLACEHOLDER, text)
    return text
