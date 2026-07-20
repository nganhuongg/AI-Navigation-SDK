"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getJourneyTemplate,
  listJourneyTemplates,
  updateJourneyTemplate,
} from "@/lib/api";
import type {
  CareJourneyService,
  CareJourneyTableColumn,
  CareJourneyTemplate,
  CareJourneyTemplateSummary,
} from "@/lib/types";
import { Chip, EmptyState, Kv, Panel } from "@/components/ui";

const SERVICE_STATUS: CareJourneyService["status"][] = ["pending", "in_progress", "completed", "skipped"];

const REQUIRED_SERVICE_KEYS = new Set([
  "service_id",
  "service_name",
  "description",
  "department",
  "room",
  "room_name",
  "building",
  "floor",
  "estimated_duration_minutes",
  "status",
  "completed_at",
  "next_step",
]);

const DEFAULT_SERVICE_COLUMNS: CareJourneyTableColumn[] = [
  {
    key: "service_name",
    label: "Tên dịch vụ",
    description: "Tên bước hoặc dịch vụ sau khi đọc phiếu chỉ định",
  },
  { key: "room", label: "Phòng", description: "Mã phòng bệnh nhân cần đi tới" },
  { key: "room_name", label: "Tên phòng", description: "Tên hiển thị của phòng trong bệnh viện" },
  { key: "floor", label: "Tầng", description: "Tầng của phòng cần đi tới" },
  {
    key: "estimated_duration_minutes",
    label: "Thời lượng",
    description: "Thời lượng dự kiến cho bước này, tính bằng phút",
  },
  { key: "next_step", label: "Bước sau", description: "Bước tiếp theo trong hành trình" },
  { key: "status", label: "Trạng thái mẫu", description: "Trạng thái mặc định khi tạo phiên bệnh nhân" },
];

function cloneTemplate(template: CareJourneyTemplate): CareJourneyTemplate {
  return JSON.parse(JSON.stringify(template)) as CareJourneyTemplate;
}

function normalizeTemplateFields(fields: string[]): string[] {
  return Array.from(new Set(fields.map((field) => field.trim()).filter(Boolean)));
}

function normalizeColumnKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function normalizeServiceColumns(columns: CareJourneyTableColumn[]): CareJourneyTableColumn[] {
  const seen = new Set<string>();
  const normalized: CareJourneyTableColumn[] = [];
  for (const column of columns) {
    const key = normalizeColumnKey(column.key);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      key,
      label: column.label.trim() || key,
      description: column.description.trim() || "Cột dữ liệu do bệnh viện định nghĩa",
    });
  }
  return normalized.length ? normalized : DEFAULT_SERVICE_COLUMNS;
}

function getServiceColumns(template: CareJourneyTemplate): CareJourneyTableColumn[] {
  const columns = template.privacy.ocr_service_columns;
  return columns && columns.length > 0 ? columns : DEFAULT_SERVICE_COLUMNS;
}

function newService(index: number): CareJourneyService {
  return {
    service_id: `service_${index}`,
    service_name: "Dịch vụ mới",
    description: "Mô tả dịch vụ",
    department: "Chưa phân loại",
    room: "A000",
    room_name: "Phòng chưa đặt tên",
    building: "Khu A",
    floor: 1,
    estimated_duration_minutes: 10,
    status: "pending",
    completed_at: null,
    next_step: null,
  };
}

export default function CareJourneyPage() {
  const [templates, setTemplates] = useState<CareJourneyTemplateSummary[]>([]);
  const [selectedId, setSelectedId] = useState("standard_outpatient_v1");
  const [template, setTemplate] = useState<CareJourneyTemplate | null>(null);
  const [savedTemplate, setSavedTemplate] = useState<CareJourneyTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => {
    if (!template || !savedTemplate) return false;
    return JSON.stringify(template) !== JSON.stringify(savedTemplate);
  }, [template, savedTemplate]);

  const serviceColumns = useMemo(() => (template ? getServiceColumns(template) : []), [template]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setBusy(true);
      setError(null);
      try {
        const summaries = await listJourneyTemplates();
        if (cancelled) return;
        setTemplates(summaries);
        const firstId = summaries[0]?.template_id ?? selectedId;
        setSelectedId(firstId);
        const detail = await getJourneyTemplate(firstId);
        if (cancelled) return;
        setTemplate(detail);
        setSavedTemplate(cloneTemplate(detail));
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Không tải được template.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTemplate(templateId: string) {
    setSelectedId(templateId);
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const detail = await getJourneyTemplate(templateId);
      setTemplate(detail);
      setSavedTemplate(cloneTemplate(detail));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được template.");
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplate() {
    if (!template) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload = cloneTemplate(template);
      const columns = normalizeServiceColumns(payload.privacy.ocr_service_columns ?? DEFAULT_SERVICE_COLUMNS);
      payload.privacy.ocr_service_columns = columns;
      payload.privacy.allowed_extracted_fields = normalizeTemplateFields(columns.map((column) => column.key));
      if (columns.length === 0) {
        setError("Template cần ít nhất một cột dữ liệu để OCR điền.");
        return;
      }
      const saved = await updateJourneyTemplate(payload.template_id, payload);
      setTemplate(saved);
      setSavedTemplate(cloneTemplate(saved));
      setMessage("Đã lưu Care Journey Template. Session mới sẽ dùng cấu hình này.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không lưu được template.");
    } finally {
      setSaving(false);
    }
  }

  function updateTemplate(mutator: (draft: CareJourneyTemplate) => void) {
    setTemplate((current) => {
      if (!current) return current;
      const next = cloneTemplate(current);
      mutator(next);
      return next;
    });
  }

  function updateService(index: number, patch: Partial<CareJourneyService>) {
    updateTemplate((draft) => {
      draft.specialized_process_blueprint.services[index] = {
        ...draft.specialized_process_blueprint.services[index],
        ...patch,
      };
      draft.specialized_process_blueprint.return_room =
        draft.specialized_process_blueprint.services.find((service) => service.service_id === "return_doctor")?.room ??
        draft.specialized_process_blueprint.return_room;
    });
  }

  function addService() {
    updateTemplate((draft) => {
      const service = newService(draft.specialized_process_blueprint.services.length + 1);
      for (const column of getServiceColumns(draft)) {
        if (!(column.key in service)) service[column.key] = "";
      }
      const last = draft.specialized_process_blueprint.services.at(-1);
      if (last) last.next_step = service.service_id;
      draft.specialized_process_blueprint.services.push(service);
    });
  }

  function removeService(index: number) {
    updateTemplate((draft) => {
      const removed = draft.specialized_process_blueprint.services[index];
      draft.specialized_process_blueprint.services.splice(index, 1);
      for (const service of draft.specialized_process_blueprint.services) {
        if (service.next_step === removed.service_id) {
          service.next_step = draft.specialized_process_blueprint.services[index]?.service_id ?? null;
        }
      }
    });
  }

  function updateTemplateColumn(index: number, patch: Partial<CareJourneyTableColumn>) {
    updateTemplate((draft) => {
      const columns = getServiceColumns(draft);
      columns[index] = { ...columns[index], ...patch };
      draft.privacy.ocr_service_columns = columns;
      draft.privacy.allowed_extracted_fields = columns.map((column) => column.key);
    });
  }

  function addTemplateColumn() {
    updateTemplate((draft) => {
      const columns = getServiceColumns(draft);
      const keys = new Set(columns.map((column) => normalizeColumnKey(column.key)));
      let nextIndex = columns.length + 1;
      let nextKey = `custom_field_${nextIndex}`;
      while (keys.has(nextKey)) {
        nextIndex += 1;
        nextKey = `custom_field_${nextIndex}`;
      }
      draft.privacy.ocr_service_columns = [
        ...columns,
        {
          key: nextKey,
          label: "Cột mới",
          description: "Thông tin bổ sung bệnh viện muốn OCR điền vào hành trình",
        },
      ];
      draft.privacy.allowed_extracted_fields = draft.privacy.ocr_service_columns.map((column) => column.key);
      for (const service of draft.specialized_process_blueprint.services) {
        service[nextKey] = "";
      }
    });
  }

  function removeTemplateColumn(index: number) {
    updateTemplate((draft) => {
      const columns = getServiceColumns(draft);
      const [removed] = columns.splice(index, 1);
      draft.privacy.ocr_service_columns = columns;
      draft.privacy.allowed_extracted_fields = columns.map((column) => column.key);
      if (removed) {
        for (const service of draft.specialized_process_blueprint.services) {
          if (!REQUIRED_SERVICE_KEYS.has(removed.key)) {
            delete service[removed.key];
          }
        }
      }
    });
  }

  function updateServiceColumn(index: number, key: string, value: string) {
    updateTemplate((draft) => {
      const service = draft.specialized_process_blueprint.services[index];
      if (key === "floor" || key === "estimated_duration_minutes") {
        service[key] = Number(value) || 1;
        return;
      }
      service[key] = value;
      if (key === "room" && service.service_id === "return_doctor") {
        draft.specialized_process_blueprint.return_room = value;
      }
    });
  }

  function serviceValue(service: CareJourneyService, key: string): string {
    const value = service[key];
    return value == null ? "" : String(value);
  }

  function renderServiceColumn(service: CareJourneyService, serviceIndex: number, column: CareJourneyTableColumn) {
    if (column.key === "next_step") {
      return (
        <select
          value={service.next_step ?? ""}
          onChange={(event) => updateService(serviceIndex, { next_step: event.target.value || null })}
        >
          <option value="">Kết thúc</option>
          {template?.specialized_process_blueprint.services.map((candidate) => (
            <option key={candidate.service_id} value={candidate.service_id}>
              {candidate.service_name}
            </option>
          ))}
        </select>
      );
    }

    if (column.key === "status") {
      return (
        <select
          value={service.status}
          onChange={(event) => updateService(serviceIndex, { status: event.target.value as CareJourneyService["status"] })}
        >
          {SERVICE_STATUS.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      );
    }

    if (column.key === "floor" || column.key === "estimated_duration_minutes") {
      return (
        <input
          type="number"
          min={1}
          value={serviceValue(service, column.key)}
          onChange={(event) => updateServiceColumn(serviceIndex, column.key, event.target.value)}
          style={{ width: 92 }}
        />
      );
    }

    return (
      <input
        type="text"
        value={serviceValue(service, column.key)}
        onChange={(event) => updateServiceColumn(serviceIndex, column.key, event.target.value)}
        style={{ width: column.key === "description" ? 260 : 170 }}
      />
    );
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h2>Care Journey Template</h2>
          <div className="sub">Nguồn quy trình bệnh viện cho session bệnh nhân, OCR và SmartBot</div>
        </div>
        <div className="topbar-right">
          {dirty ? <Chip variant="busy">Chưa lưu</Chip> : <Chip variant="real">Đã đồng bộ</Chip>}
          <button className="btn btn-primary" onClick={saveTemplate} disabled={!template || !dirty || saving}>
            {saving ? "Đang lưu..." : "Lưu template"}
          </button>
        </div>
      </div>

      <div className="content">
        {error ? <div className="empty-state" style={{ color: "var(--red)" }}>{error}</div> : null}
        {message ? <div className="empty-state" style={{ color: "var(--green)" }}>{message}</div> : null}

        <Panel eyebrow="Mẫu quy trình" title="Thông tin dùng bởi bệnh viện">
          {busy && !template ? (
            <EmptyState text="Đang tải template..." />
          ) : template ? (
            <div className="grid-2">
              <div className="stack">
                <div className="field">
                  <label>Template đang chỉnh</label>
                  <select value={selectedId} onChange={(event) => void loadTemplate(event.target.value)}>
                    {templates.map((item) => (
                      <option key={item.template_id} value={item.template_id}>
                        {item.template_id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Tên hiển thị cho nhân viên</label>
                  <input
                    type="text"
                    value={template.name.vi}
                    onChange={(event) => updateTemplate((draft) => { draft.name.vi = event.target.value; })}
                  />
                </div>
                <div className="field">
                  <label>Mô tả nghiệp vụ</label>
                  <textarea
                    rows={4}
                    value={template.description.vi}
                    onChange={(event) => updateTemplate((draft) => { draft.description.vi = event.target.value; })}
                  />
                </div>
              </div>
              <div>
                <Kv label="template_id" value={template.template_id} mono />
                <Kv label="version" value={String(template.version)} mono />
                <Kv label="loại template" value={template.template_type} mono />
                <Kv label="session TTL" value={`${template.privacy.session_ttl_minutes} phút`} mono />
                <div className="foot-note" style={{ marginTop: 12 }}>
                  Template này là bản gốc. Khi bệnh nhân bắt đầu phiên mới, backend copy phần quy trình ở đây để tạo
                  session riêng.
                </div>
              </div>
            </div>
          ) : null}
        </Panel>

        {template ? (
          <>
            <Panel
              eyebrow="Thông tin OCR điền vào template"
              title="Định nghĩa cột cho bảng sau phiếu chỉ định"
              action={<button className="btn btn-secondary" onClick={addTemplateColumn}>Thêm cột</button>}
            >
              <div className="scroll-x">
                <table style={{ borderCollapse: "collapse", minWidth: 980, width: "100%", fontSize: 12 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                      <th style={{ padding: 8 }}>Tên cột snake_case</th>
                      <th style={{ padding: 8 }}>Tên hiển thị</th>
                      <th style={{ padding: 8 }}>Mô tả</th>
                      <th style={{ padding: 8 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {serviceColumns.map((column, index) => (
                      <tr key={`${column.key}-${index}`} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: 8 }}>
                          <input
                            type="text"
                            value={column.key}
                            onChange={(event) => updateTemplateColumn(index, { key: event.target.value })}
                            onBlur={(event) => updateTemplateColumn(index, { key: normalizeColumnKey(event.target.value) })}
                            style={{ width: 180 }}
                            placeholder="queue_number"
                          />
                        </td>
                        <td style={{ padding: 8 }}>
                          <input
                            type="text"
                            value={column.label}
                            onChange={(event) => updateTemplateColumn(index, { label: event.target.value })}
                            style={{ width: 170 }}
                            placeholder="Số thứ tự"
                          />
                        </td>
                        <td style={{ padding: 8 }}>
                          <input
                            type="text"
                            value={column.description}
                            onChange={(event) => updateTemplateColumn(index, { description: event.target.value })}
                            style={{ width: 360 }}
                            placeholder="Số thứ tự trên phiếu khám"
                          />
                        </td>
                        <td style={{ padding: 8, textAlign: "right" }}>
                          <button
                            className="btn btn-ghost"
                            onClick={() => removeTemplateColumn(index)}
                            disabled={serviceColumns.length <= 1}
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="foot-note" style={{ marginTop: 12 }}>
                Danh sách này quyết định các cột xuất hiện trong bảng bên dưới. Tên snake_case là khóa dữ liệu OCR/HIS
                dùng để điền vào hành trình, ví dụ queue_number.
              </div>
            </Panel>

            <Panel eyebrow="Các bước mặc định" title="Quy trình trước khi có phiếu chỉ định">
              <div className="grid-3">
                {(["register", "identity", "payment"] as const).map((key) => {
                  const step = template.patient_journey_template[key];
                  return (
                    <div className="step-card" key={key}>
                      <div className="field">
                        <label>{key === "register" ? "Đăng ký" : key === "identity" ? "Xác thực danh tính" : "Thanh toán"}</label>
                        <input
                          type="text"
                          value={step.room}
                          onChange={(event) => updateTemplate((draft) => { draft.patient_journey_template[key].room = event.target.value; })}
                        />
                      </div>
                      <div className="grid-2" style={{ marginTop: 10 }}>
                        <div className="field">
                          <label>Mã phòng</label>
                          <input
                            type="text"
                            value={step.location_code}
                            onChange={(event) =>
                              updateTemplate((draft) => { draft.patient_journey_template[key].location_code = event.target.value; })
                            }
                          />
                        </div>
                        <div className="field">
                          <label>Tầng</label>
                          <input
                            type="text"
                            value={String(step.floor)}
                            onChange={(event) =>
                              updateTemplate((draft) => {
                                draft.patient_journey_template[key].floor = Number(event.target.value) || 1;
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel
              eyebrow="Sau khi có phiếu chỉ định"
              title="Dịch vụ cận lâm sàng và bước tiếp theo"
              action={<button className="btn btn-secondary" onClick={addService}>Thêm dịch vụ</button>}
            >
              <div className="scroll-x">
                <table
                  style={{
                    borderCollapse: "collapse",
                    minWidth: Math.max(760, serviceColumns.length * 190 + 90),
                    width: "100%",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                      {serviceColumns.map((column) => (
                        <th key={column.key} style={{ padding: 8 }} title={column.description}>
                          {column.label}
                        </th>
                      ))}
                      <th style={{ padding: 8 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {template.specialized_process_blueprint.services.map((service, index) => (
                      <tr key={`${service.service_id}-${index}`} style={{ borderTop: "1px solid var(--border)" }}>
                        {serviceColumns.map((column) => (
                          <td key={column.key} style={{ padding: 8 }}>
                            {renderServiceColumn(service, index, column)}
                          </td>
                        ))}
                        <td style={{ padding: 8 }}>
                          <button className="btn btn-ghost" onClick={() => removeService(index)}>Xóa</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel eyebrow="Tình huống ngoại lệ" title="Câu trả lời dự phòng">
              <div className="stack">
                {template.fallbacks.map((fallback, index) => (
                  <div className="grid-3" key={fallback.fallback_id}>
                    <div className="field">
                      <label>Mã fallback</label>
                      <input
                        type="text"
                        value={fallback.fallback_id}
                        onChange={(event) =>
                          updateTemplate((draft) => { draft.fallbacks[index].fallback_id = event.target.value; })
                        }
                      />
                    </div>
                    <div className="field">
                      <label>Khi nào dùng</label>
                      <input
                        type="text"
                        value={fallback.trigger}
                        onChange={(event) =>
                          updateTemplate((draft) => { draft.fallbacks[index].trigger = event.target.value; })
                        }
                      />
                    </div>
                    <div className="field">
                      <label>Câu trả lời cho bệnh nhân</label>
                      <input
                        type="text"
                        value={fallback.message_vi}
                        onChange={(event) =>
                          updateTemplate((draft) => { draft.fallbacks[index].message_vi = event.target.value; })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </>
        ) : null}
      </div>
    </>
  );
}
