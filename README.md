# AI Navigation SDK

AI Navigation SDK là MVP cho Vietnamese Student HackAIthon 2026 - Vòng 2, Bảng B (Challenger). Dự án mô phỏng một SDK AI có thể nhúng vào ứng dụng bệnh viện hiện có để hỗ trợ người bệnh trong hành trình khám: hỏi đáp bằng giọng nói, đọc phiếu chỉ định bằng OCR, xác nhận thông tin, cập nhật hành trình cá nhân hóa và chỉ đường trong bệnh viện.

Trọng tâm hiện tại của demo:

```text
SmartReader OCR -> trích xuất trường hành trình -> người dùng xác nhận -> cập nhật care journey
```

Backend không để AI tự suy luận quy trình y khoa. AI/VNPT chỉ hỗ trợ trích xuất, nhận dạng ý định, đọc/ghi âm và hội thoại vận hành. Quy trình khám vẫn được điền vào mẫu hành trình đã được bệnh viện phê duyệt.

## Kiến Trúc Tổng Quan

```text
apps/hospital-app
  Giao diện bệnh nhân. Mô phỏng app bệnh viện trước và sau khi nhúng SDK.

apps/admin-console
  Giao diện bệnh viện/admin. Kiểm thử OCR, SmartVoice, SmartBot, Map Builder.

services/navigation-engine
  FastAPI Navigation Engine. Nguồn sự thật duy nhất cho session, OCR, voice,
  chatbot, hành trình, route, map, analytics.

packages/shared-types
  Kiểu dữ liệu TypeScript dùng chung giữa các frontend.

data
  Dữ liệu tham chiếu, mẫu hành trình, bản đồ, fixture OCR, runtime sessions/events.
```

Luồng dữ liệu chính:

```text
Bệnh nhân chụp phiếu
  -> POST /ocr/extract
  -> SmartReader thật hoặc mock OCR
  -> parser trích xuất room/service/queue
  -> người bệnh xác nhận
  -> POST /session/{id}/confirm-ocr
  -> session.journey.extracted_fields + specialized_process
  -> checklist + route + assistant dùng cùng session này
```

## Vai Trò Từng Phần

| Thành phần | Dành cho | Vai trò |
|---|---|---|
| `apps/hospital-app` | Bệnh nhân | Giao diện app bệnh viện, bật/tắt SDK, hỏi trợ lý, chụp phiếu, xem checklist, mở bản đồ chỉ đường. |
| `apps/admin-console` | Bệnh viện/admin/kỹ thuật | Dashboard kiểm thử OCR Journey Lab, SmartVoice STT/TTS, SmartBot proxy, Map Builder và route preview. |
| `services/navigation-engine` | Hệ thống | Điều phối toàn bộ nghiệp vụ: session, journey, OCR, chatbot, voice, routing, maps, analytics. |
| `packages/shared-types` | Frontend dev | Đồng bộ contract TypeScript với response/backend model. |
| `data/reference` | Backend | Catalog phòng, template hành trình, schema. Không import trực tiếp từ frontend. |
| `data/generated` | Backend/admin | Bản đồ draft/verified, OCR fixture. |
| `data/runtime` | Backend runtime | Session và event tạm thời, được reset trước demo. |

## Giao Diện Nào Cho Ai?

### Bệnh nhân

Mở app bệnh nhân tại:

```text
http://localhost:3000
```

Đây là app bệnh viện mô phỏng. Trước SDK, bệnh nhân thấy app bệnh viện cơ bản. Sau khi bật SDK, bệnh nhân dùng trợ lý AI để:

- hỏi bằng giọng nói hoặc nhập text;
- chụp/upload phiếu chỉ định;
- xác nhận các trường OCR;
- xem hành trình khám cá nhân hóa;
- mở bản đồ chỉ đường đến phòng tiếp theo;
- xác nhận đã đến nơi để chuyển bước.

### Bệnh viện / Admin

Mở dashboard bệnh viện tại:

```text
http://localhost:3001
```

Các màn hình chính:

- `/` - tổng quan trạng thái dịch vụ;
- `/ocr` - OCR Journey Lab, kiểm thử đọc phiếu và xác nhận vào journey;
- `/smartvoice` - kiểm thử STT/TTS;
- `/smartbot` - kiểm thử SmartBot proxy và debug card/intent;
- `/map-builder` - số hóa map PNG, confirm map, preview route.

## Cài Đặt Một Lệnh

Yêu cầu:

- Windows PowerShell;
- Python 3.11+;
- Node.js 20+;
- pnpm 9+ hoặc Corepack.

Chạy từ thư mục gốc repo:

```powershell
.\scripts\install_all.ps1
```

Lệnh này sẽ:

- tạo `.venv` nếu chưa có;
- cài toàn bộ Python dependencies từ `requirements.txt`;
- cài backend dependencies từ `services/navigation-engine/requirements.txt`;
- tạo `.env` từ `.env.example` nếu chưa tồn tại;
- chạy `corepack enable`;
- chạy `pnpm install`.

Nếu chỉ muốn cài Python, bỏ qua Node:

```powershell
.\scripts\install_all.ps1 -NoNode
```

## Chạy Ứng Dụng

Mở 3 terminal PowerShell riêng.

Terminal 1 - Navigation Engine:

```powershell
pnpm dev:engine
```

Backend chạy ở:

```text
http://localhost:8001
http://localhost:8001/docs
```

Terminal 2 - giao diện bệnh nhân:

```powershell
pnpm dev:patient
```

Mở:

```text
http://localhost:3000
```

Terminal 3 - giao diện bệnh viện/admin:

```powershell
pnpm dev:admin
```

Mở:

```text
http://localhost:3001
```

## Cấu Hình VNPT Và Mock Mode

Mặc định repo chạy bằng mock adapter để demo không phụ thuộc API key.

Các toggle chính trong `.env`:

```env
USE_VNPT_SMARTREADER=false
USE_VNPT_SMARTVOICE_STT=false
USE_VNPT_SMARTVOICE_TTS=false
USE_VNPT_SMARTBOT=false
NEXT_PUBLIC_ENGINE_BASE_URL=http://localhost:8001
```

Khi dùng thật:

- SmartReader OCR dùng `/rpa-service/aidigdoc/v1/ocr/scan-table`;
- không đổi lại `/scan` nếu không có yêu cầu rõ ràng;
- điền credential vào `.env`, không commit `.env`;
- bật từng service riêng lẻ để dễ debug.

## Chạy Test Tự Động

Chạy toàn bộ kiểm tra chính:

```powershell
.\scripts\test_all.ps1
```

Lệnh này chạy:

- unit tests backend bằng `pytest`;
- integration smoke test: health -> session -> OCR -> confirm OCR -> route;
- typecheck cho shared types, hospital app và admin console.

Chạy thêm production build frontend:

```powershell
.\scripts\test_all.ps1 -Build
```

Các lệnh riêng:

```powershell
pnpm test:unit
pnpm test:integration
pnpm typecheck
pnpm build
```

Backend unit tests trực tiếp:

```powershell
cd services\navigation-engine
..\..\.venv\Scripts\python -m pytest -q
```

Integration smoke trực tiếp:

```powershell
.\.venv\Scripts\python scripts\integration_smoke.py
```

## Scripts Hữu Ích

```powershell
python scripts\seed_demo_data.py
python scripts\reset_runtime_state.py
python scripts\cleanup_expired_sessions.py --dry-run
python scripts\cleanup_expired_sessions.py
```

Ý nghĩa:

- `seed_demo_data.py`: chuẩn bị dữ liệu demo ổn định;
- `reset_runtime_state.py`: xóa/reset session và event runtime;
- `cleanup_expired_sessions.py --dry-run`: xem session hết hạn;
- `cleanup_expired_sessions.py`: xóa session hết hạn.

## An Toàn Thông Tin Và Bảo Mật Dữ Liệu

Nguyên tắc bảo mật của MVP:

- Không commit `.env` hoặc credential VNPT.
- Không lưu tên, số điện thoại, CCCD, mã hồ sơ bệnh án thật.
- Session ID là token demo ẩn danh.
- OCR chỉ được áp dụng vào hành trình sau khi người dùng/admin xác nhận.
- Hiện tại chỉ lưu trường OCR có cấu trúc trong `data/runtime/sessions`.
- Không lưu raw image, full raw OCR text hoặc full response SmartReader như memory cho chatbot.
- SmartBot chỉ nhận metadata đã giới hạn: session, bước hiện tại, phòng đích, next action.
- Redactor backend loại bỏ số điện thoại, CCCD, mã hồ sơ, BHYT-like ID, DOB label và tên bệnh nhân theo nhãn form trước các luồng assistant/SmartBot.
- SmartBot không được tư vấn chẩn đoán hoặc điều trị. Câu hỏi y khoa ngoài phạm vi phải trả lời fallback và hướng người bệnh hỏi nhân viên y tế/bác sĩ.


## Cấu Trúc Repo

```text
AI-Navigation-SDK/
├── apps/
│   ├── hospital-app/        # Giao diện bệnh nhân
│   └── admin-console/       # Giao diện bệnh viện/admin
├── services/
│   └── navigation-engine/   # FastAPI backend
├── packages/
│   └── shared-types/        # TypeScript contracts dùng chung
├── data/
│   ├── raw/                 # Map PNG/PDF, dữ liệu nguồn
│   ├── reference/           # locations, templates, schemas, form mẫu
│   ├── generated/           # OCR fixtures, draft/verified maps
│   └── runtime/             # sessions/events tạm thời
├── scripts/                 # install, tests, seed/reset/cleanup
├── docs/                    # tài liệu public/competition/report assets
├── ARCHITECTURE.md          # kiến trúc cấp cao
├── requirements.txt         # Python deps ở root + backend
└── package.json             # workspace scripts
```

## Demo Flow

1. Chạy backend `pnpm dev:engine`.
2. Chạy admin `pnpm dev:admin`, mở `http://localhost:3001`.
3. Vào `/map-builder`, digitize/confirm map nếu cần.
4. Vào `/ocr`, start session, upload ảnh trong `data/reference/phieukham`, run OCR, confirm vào journey.
5. Chạy patient app `pnpm dev:patient`, mở `http://localhost:3000`.
6. Bật SDK, vào trợ lý AI.
7. Chụp/upload phiếu, xác nhận OCR.
8. Xem checklist và mở route đến phòng tiếp theo.
9. Xác nhận đã đến nơi để session chuyển bước.


