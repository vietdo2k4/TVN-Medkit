import { useEffect, useMemo, useState, useCallback } from "react";
import {
    listHospitals,
    createHospital,
    updateHospital,
    deleteHospital,
} from "../../api/admin";

function toPathSafe(nameOrFile) {
    const n = String(nameOrFile || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Za-z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    return `/assets/hospitals/${n}`;
}

export default function AdminHospitalsPage() {
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);
    const [limit] = useState(10);

    const [rows, setRows] = useState([]);
    // eslint-disable-next-line no-unused-vars
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        id: 0,
        name: "",
        address: "",
        phone: "",
        image_url: "",
        details: "",
    });
    const [preview, setPreview] = useState("");

    // Ảnh phụ “chờ” khi tạo mới
    const [pendingPhotos, setPendingPhotos] = useState([]);
    const [pendingUrl, setPendingUrl] = useState("");

    // ====== STATE cho “Chuyên khoa của cơ sở” ======
    const [specAll, setSpecAll] = useState([]);
    const [specSelected, setSpecSelected] = useState(new Set());
    const [specLoading, setSpecLoading] = useState(false);
    const [specOpen, setSpecOpen] = useState(false); // collapse
    const ADMIN = import.meta.env.VITE_API_BASE_URL + "/admin";

    const qp = useMemo(() => ({ q: q.trim(), page, limit }), [q, page, limit]);

    useEffect(() => {
        let stop = false;
        (async () => {
            try {
                setLoading(true);
                setErr("");
                const res = await listHospitals(qp);
                const items = res?.items ?? res?.data ?? res?.rows ?? res ?? [];
                if (!stop) {
                    setRows(Array.isArray(items) ? items : []);
                    setTotal(res?.total ?? items.length ?? 0);
                }
            } catch (e) {
                if (!stop) {
                    setErr(e?.message || "Request error");
                    setRows([]);
                    setTotal(0);
                }
            } finally {
                if (!stop) setLoading(false);
            }
        })();
        return () => {
            stop = true;
        };
    }, [qp]);

    function openNew() {
        setForm({
            id: 0,
            name: "",
            address: "",
            phone: "",
            image_url: "",
            details: "",
        });
        setPreview("");
        setPendingPhotos([]);
        setPendingUrl("");
        setSpecAll([]);
        setSpecSelected(new Set());
        setSpecOpen(false);
        setOpen(true);
    }
    async function openEdit(h) {
        setForm({
            id: h.id,
            name: h.name || "",
            address: h.address || "",
            phone: h.phone || "",
            image_url: h.image_url || "",
            details: h.details || "",
        });
        setPreview(h.image_url || "");
        setPendingPhotos([]);
        setPendingUrl("");
        setOpen(true);
        setSpecOpen(false);
        await loadSpecsFor(h.id);
    }

    function onPickFile(e) {
        const f = e.target.files?.[0];
        if (!f) return;
        const guess = toPathSafe(f.name);
        setForm((x) => ({ ...x, image_url: guess }));
        setPreview(URL.createObjectURL(f)); // chỉ preview
    }

    async function reload() {
        const res = await listHospitals(qp);
        const items = res?.items ?? res ?? [];
        setRows(Array.isArray(items) ? items : []);
        setTotal(res?.total ?? items.length ?? 0);
    }

    // ===== helpers fetch/json =====
    async function jget(url, token) {
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error(await r.text());
        return r.json();
    }
    async function jsend(url, method, body, token) {
        const r = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!r.ok) throw new Error(await r.text());
        return r.json().catch(() => ({}));
    }

    // ====== LOAD + SAVE danh sách chuyên khoa của bệnh viện ======
    async function loadSpecsFor(hospId) {
        try {
            setSpecLoading(true);
            const token = localStorage.getItem("token") || "";
            const all = await jget(`${ADMIN}/specialties?limit=200`, token);
            const list = Array.isArray(all?.items) ? all.items : Array.isArray(all) ? all : [];
            setSpecAll(list);
            const cur = await jget(`${ADMIN}/hospitals/${hospId}/specialties`, token);
            const ids = new Set(cur?.selectedIds ?? cur?.ids ?? cur ?? []);
            setSpecSelected(ids);
        } finally {
            setSpecLoading(false);
        }
    }
    function toggleSpec(id) {
        setSpecSelected((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    }
    async function saveSpecList() {
        if (!form.id) return;
        const token = localStorage.getItem("token") || "";
        await jsend(
            `${ADMIN}/hospitals/${form.id}/specialties`,
            "POST",
            { specialtyIds: Array.from(specSelected) },
            token
        );
        alert("Đã lưu danh sách chuyên khoa");
    }

    async function onSave() {
        try {
            const payload = {
                name: form.name?.trim(),
                address: form.address?.trim() || null,
                phone: form.phone?.trim() || null,
                image_url: form.image_url?.trim() || null,
                details: form.details?.trim() || null,
            };
            if (!payload.name) return alert("Tên cơ sở y tế bắt buộc");

            if (form.id) {
                await updateHospital(form.id, payload);
            } else {
                const created = await createHospital(payload);
                const newId = created?.id ?? created?.insertId;
                if (newId && pendingPhotos.length) {
                    const token = localStorage.getItem("token") || "";
                    for (const u of pendingPhotos) {
                        const image_url = String(u || "").trim();
                        if (image_url) {
                            await jsend(
                                `${ADMIN}/hospitals/${newId}/photos`,
                                "POST",
                                { image_url },
                                token
                            );
                        }
                    }
                }
            }

            setOpen(false);
            await reload();
            alert("Đã lưu");
        } catch (e) {
            alert(e?.data?.message || e?.message || "Lỗi lưu cơ sở y tế");
        }
    }

    async function onDelete(id) {
        if (!window.confirm("Xoá cơ sở y tế này?")) return;
        try {
            await deleteHospital(id);
            setRows((arr) => arr.filter((x) => x.id !== id));
        } catch (e) {
            alert(e?.data?.message || e?.message || "Không xoá được");
        }
    }

    // ===== PHOTOS MANAGER (đang có ID) — gộp “Thêm” cho đơn/lô =====
    function PhotosManager({ hospId, token }) {
        const [items, setItems] = useState([]);
        const [url, setUrl] = useState("");
        const [batch, setBatch] = useState([]); // nhiều file đã chọn
        const [loading, setLoading] = useState(false);

        const load = useCallback(async () => {
            setLoading(true);
            try {
                const rows = await jget(`${ADMIN}/hospitals/${hospId}/photos`, token);
                setItems(Array.isArray(rows) ? rows : []);
            } finally {
                setLoading(false);
            }
        }, [hospId, token]);

        useEffect(() => {
            load();
        }, [load]);

        function onPickSubFile(e) {
            const files = Array.from(e.target.files || []);
            if (!files.length) return;
            const urls = files.map((f) => toPathSafe(f.name));
            setBatch(urls);
            setUrl(urls[0] || "");
        }

        async function addAllPhotos() {
            const urls = [];
            const v = url.trim();
            if (batch.length) urls.push(...batch);
            if (v) urls.push(v);
            if (!urls.length) return alert("Nhập hoặc chọn URL ảnh phụ");

            for (const u of urls) {
                await jsend(`${ADMIN}/hospitals/${hospId}/photos`, "POST", { image_url: u }, token);
            }
            setUrl("");
            setBatch([]);
            load();
        }
        async function removePhoto(id) {
            if (!confirm("Xóa ảnh này?")) return;
            await jsend(`${ADMIN}/hospitals/${hospId}/photos/${id}`, "DELETE", null, token);
            load();
        }

        return (
            <div style={{ ...S.box, marginTop: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Ảnh phụ</div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    <input
                        placeholder="/assets/hospitals/ten-file.jpg hoặc https://..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        style={{ ...S.input, flex: 1 }}
                    />
                    <input type="file" accept="image/*" multiple onChange={onPickSubFile} />
                    <button style={S.btn("pri")} onClick={addAllPhotos}>Thêm</button>
                </div>

                {loading ? (
                    <div>Đang tải ảnh…</div>
                ) : items.length === 0 ? (
                    <div style={S.note}>Chưa có ảnh phụ</div>
                ) : (
                    <table style={S.table}>
                        <thead>
                            <tr>
                                <th style={S.th}>Ảnh</th>
                                <th style={S.th}>URL</th>
                                <th style={S.th}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((it) => (
                                <tr key={it.id}>
                                    <td style={S.td}>
                                        <img
                                            src={it.image_url}
                                            alt=""
                                            style={{ width: 96, height: 64, objectFit: "cover", borderRadius: 6, border: "1px solid #e2e8f0" }}
                                        />
                                    </td>
                                    <td style={S.td}>
                                        <a href={it.image_url} target="_blank" rel="noreferrer">{it.image_url}</a>
                                    </td>
                                    <td style={{ ...S.td, whiteSpace: "nowrap" }}>
                                        <button
                                            className="danger"
                                            style={{ ...S.btn("sec"), background: "#ffefef", borderColor: "#ffd5d5" }}
                                            onClick={() => removePhoto(it.id)}
                                        >
                                            Xóa
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        );
    }

    // UI ảnh phụ khi TẠO MỚI (chưa có ID): pending list, hỗ trợ chọn nhiều file
    function PendingPhotosBox() {
        function onPickPendingFiles(e) {
            const files = Array.from(e.target.files || []);
            if (!files.length) return;
            const urls = files.map((f) => toPathSafe(f.name));
            setPendingPhotos((old) => [...old, ...urls]);
            e.target.value = "";
        }
        function addPending() {
            const v = pendingUrl.trim();
            if (!v) return alert("Nhập hoặc chọn URL ảnh phụ");
            setPendingPhotos((a) => [...a, v]);
            setPendingUrl("");
        }
        function removePending(i) {
            setPendingPhotos((a) => a.filter((_, idx) => idx !== i));
        }
        return (
            <div style={{ ...S.box, marginTop: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Ảnh phụ</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    <input
                        placeholder="/assets/hospitals/ten-file.jpg hoặc https://..."
                        value={pendingUrl}
                        onChange={(e) => setPendingUrl(e.target.value)}
                        style={{ ...S.input, flex: 1 }}
                    />
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    <input type="file" accept="image/*" multiple onChange={onPickPendingFiles} />
                    <button style={S.btn("pri")} onClick={addPending}>Thêm</button>
                </div>

                {pendingPhotos.length === 0 ? (
                    <div style={S.note}>Chưa có ảnh phụ</div>
                ) : (
                    <table style={S.table}>
                        <thead>
                            <tr>
                                <th style={S.th}>URL</th>
                                <th style={S.th}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {pendingPhotos.map((u, i) => (
                                <tr key={i}>
                                    <td style={S.td}>{u}</td>
                                    <td style={{ ...S.td, whiteSpace: "nowrap" }}>
                                        <button
                                            className="danger"
                                            style={{ ...S.btn("sec"), background: "#ffefef", borderColor: "#ffd5d5" }}
                                            onClick={() => removePending(i)}
                                        >
                                            Xóa
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                <div style={{ ...S.note, marginTop: 6 }}>
                    Ảnh phụ sẽ được lưu ngay sau khi bạn bấm “Tạo”.
                </div>
            </div>
        );
    }

    return (
        <div style={S.wrap}>
            <div style={{ ...S.card, ...S.cardPad }}>
                <div style={S.toolbar}>
                    <input
                        style={{ ...S.input, minWidth: 280 }}
                        placeholder="Tìm tên cơ sở y tế…"
                        value={q}
                        onChange={(e) => {
                            setQ(e.target.value);
                            setPage(1);
                        }}
                    />
                    <div style={{ flex: 1 }} />
                    <div style={S.pager}>
                        <span>Trang {page}</span>
                        <button style={S.btn("sec")} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                            Prev
                        </button>
                        <button style={S.btn("sec")} onClick={() => setPage((p) => p + 1)}>
                            Next
                        </button>
                        <button style={S.btn("pri")} onClick={openNew}>
                            + Thêm cơ sở
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ ...S.card }}>
                <div style={S.cardPad}>
                    {loading ? "Đang tải…" : err ? <span style={{ color: "#dc2626" }}>{err}</span> : null}
                    <table style={S.table}>
                        <thead>
                            <tr>
                                <th style={S.th}>ID</th>
                                <th style={S.th}>Tên</th>
                                <th style={S.th}>Ảnh</th>
                                <th style={S.th}>Địa chỉ</th>
                                <th style={S.th}>Điện thoại</th>
                                <th style={S.th}>Cập nhật</th>
                                <th style={S.th}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && (
                                <tr>
                                    <td style={S.td} colSpan={7}>Không có dữ liệu</td>
                                </tr>
                            )}
                            {rows.map((h) => (
                                <tr key={h.id}>
                                    <td style={S.td}>{h.id}</td>
                                    <td style={S.td}>{h.name}</td>
                                    <td style={S.td}>
                                        {h.image_url ? <img src={h.image_url} alt="" style={S.img} /> : <span style={S.tag}>No image</span>}
                                    </td>
                                    <td style={S.td}>{h.address || "-"}</td>
                                    <td style={S.td}>{h.phone || "-"}</td>
                                    <td style={S.td}>{new Date(h.updated_at || h.created_at || Date.now()).toLocaleString()}</td>
                                    <td style={S.td}>
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <button style={S.btn("sec")} onClick={() => openEdit(h)}>Xem</button>
                                            <button
                                                style={{ ...S.btn("sec"), background: "#fee2e2", borderColor: "#fecaca" }}
                                                onClick={() => onDelete(h.id)}
                                            >
                                                Xoá
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {open && (
                <div style={S.overlay} onMouseDown={() => setOpen(false)}>
                    <div style={S.modal} onMouseDown={(e) => e.stopPropagation()}>
                        <div style={S.modalHead}>{form.id ? "Thông tin cơ sở y tế" : "Thêm cơ sở y tế"}</div>
                        <div style={S.modalBody}>
                            <div style={S.row}>
                                <label>Tên *</label>
                                <input style={S.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div style={S.row}>
                                <label>Địa chỉ</label>
                                <input style={S.input} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                            </div>
                            <div style={S.row}>
                                <label>Điện thoại</label>
                                <input style={S.input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                            </div>
                            <div style={S.row}>
                                <label>Ảnh (URL)</label>
                                <input
                                    style={S.input}
                                    placeholder="/assets/hospitals/abc.jpg hoặc https://"
                                    value={form.image_url}
                                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                                />
                            </div>
                            <div style={S.row}>
                                <label>Chọn file ảnh</label>
                                <input type="file" accept="image/*" onChange={onPickFile} />
                            </div>
                            {(preview || form.image_url) && (
                                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                    <img src={preview || form.image_url} alt="" style={{ ...S.img, width: 140, height: 94 }} />
                                </div>
                            )}
                            <div style={S.row}>
                                <label>Thông tin chi tiết</label>
                                <textarea
                                    rows={4}
                                    style={{ ...S.input, padding: 12, resize: "vertical" }}
                                    value={form.details}
                                    onChange={(e) => setForm({ ...form, details: e.target.value })}
                                />
                            </div>

                            {/* ====== Khối Chuyên khoa của cơ sở ====== */}
                            <div style={S.box}>
                                <button type="button" style={S.collapseHead} onClick={() => setSpecOpen(v => !v)}>
                                    <span>Chuyên khoa của cơ sở</span>
                                    <span style={{ ...S.caret, transform: specOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
                                </button>

                                {specOpen && (
                                    form.id ? (
                                        specLoading ? (
                                            <div>Đang tải chuyên khoa…</div>
                                        ) : (
                                            <>
                                                <div style={S.specGrid}>
                                                    {specAll.map(sp => {
                                                        const checked = specSelected.has(sp.id);
                                                        return (
                                                            <label
                                                                key={sp.id}
                                                                style={{ ...S.chip, ...(checked ? S.chipActive : {}) }}
                                                                title={sp.description || sp.name}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={() => toggleSpec(sp.id)}
                                                                />
                                                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                    {sp.name}
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                                                    <button style={S.btn("sec")} onClick={saveSpecList}>Lưu danh sách</button>
                                                </div>
                                            </>
                                        )
                                    ) : (
                                        <div style={S.note}>Lưu cơ sở y tế trước khi thêm chuyên khoa.</div>
                                    )
                                )}
                            </div>

                            {/* Ảnh phụ */}
                            {form.id ? (
                                <PhotosManager hospId={form.id} token={localStorage.getItem("token") || ""} />
                            ) : (
                                <PendingPhotosBox />
                            )}

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                                <button style={S.btn("sec")} onClick={() => setOpen(false)}>Huỷ</button>
                                <button style={S.btn("pri")} onClick={onSave}>{form.id ? "Cập nhật" : "Tạo"}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* === Inline CSS object === */
const S = {
    wrap: { display: "grid", gap: 16 },
    toolbar: { display: "flex", gap: 8, alignItems: "center" },
    input: { height: 36, padding: "0 12px", border: "1px solid #e2e8f0", borderRadius: 8 },
    btn: (kind = "pri") => ({
        height: 36,
        padding: "0 14px",
        borderRadius: 8,
        border: "1px solid transparent",
        background: kind === "pri" ? "#0ea5e9" : "#e2e8f0",
        color: kind === "pri" ? "#fff" : "#0f172a",
        fontWeight: 600,
        cursor: "pointer",
    }),
    card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 8px 24px rgba(15,23,42,.04)" },
    cardPad: { padding: 16 },
    table: { width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 14 },
    th: { textAlign: "left", color: "#64748b", padding: "10px 12px", borderBottom: "1px solid #e2e8f0" },
    td: { padding: "10px 12px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" },
    tag: { padding: "2px 8px", borderRadius: 999, background: "#f1f5f9", fontSize: 12 },
    pager: { display: "flex", gap: 8, alignItems: "center", marginLeft: "auto" },

    overlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,.35)", display: "grid", placeItems: "center", zIndex: 50 },
    modal: {
        width: 760,
        maxWidth: "95vw",
        maxHeight: "90vh",
        background: "#fff",
        borderRadius: 14,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
    },
    modalHead: { padding: 14, borderBottom: "1px solid #e2e8f0", fontWeight: 700 },
    modalBody: { padding: 16, display: "grid", gap: 12, overflowY: "auto" },
    row: { display: "grid", gridTemplateColumns: "140px 1fr", alignItems: "center", gap: 10 },
    img: { width: 96, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" },
    box: { padding: 12, border: "1px solid #e6eef7", borderRadius: 10, background: "#fff" },

    // Chuyên khoa: layout + chip đẹp
    specGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 },
    chip: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: "#f7fbff",
        border: "1px solid #ddebfb",
        borderRadius: 12,
        cursor: "pointer",
        transition: "background .15s ease, border-color .15s ease",
    },
    chipActive: {
        background: "#e8f3ff",
        borderColor: "#84c5ff",
        boxShadow: "0 0 0 2px rgba(33,150,243,.08) inset",
    },
    note: { color: "#6b7a8c", fontSize: 12 },

    collapseHead: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        background: "transparent",
        border: "none",
        padding: 0,
        margin: 0,
        fontWeight: 700,
        cursor: "pointer",
    },
    caret: { transition: "transform .2s ease" },
};
