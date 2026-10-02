/* KỊCH BẢN 3D trên trang hồ sơ — dựng từ canh-3d.json (kho: data/canh-3d.yaml).
   · Trang việc: khối «Mô hình 3D» = dãy cảnh bấm được, đặt theo `vi_tri` (đầu thẻ 1 / thẻ 2 / dưới đầu trang).
   · Kế hoạch tổng thể: dòng việc nào có kịch bản (khớp theo `viec`) mọc nút «3D».
   Bấm một cảnh:
     · trang đang nằm trong khung 3D (khung-3d.html)  ⇒ gửi trạng thái cho trình xem đã tải sẵn — không tải lại;
     · trang mở một mình                              ⇒ chuyển sang khung 3D, mở đúng trang + đúng cảnh.
   Ở bàn soạn (dev server đặt CANH3D_CFG.soan): nút «✎ 3D» mở BÀN SOẠN 3D toàn màn hình ở tab riêng
   (tools/editor/soan-3d.html) — mọi việc liệt kê sẵn, soạn cảnh ở đó; lưu xong trang này tự dựng lại khối.
   Mọi phần tử mang class `ed-ui`: bàn soạn không chọn nó và gỡ nó ra trước khi lưu HTML. */
(() => {
  const CFG = Object.assign({ json: "3d/canh-3d.json", khung: "khung-3d.html", soan: null }, window.CANH3D_CFG || {});
  const TRANG = decodeURIComponent(location.pathname.split("/").pop() || "index.html");
  const LA_GOC = /^(index|Master-Plan-CTKH-383HaiPhong)\.html$/.test(TRANG);
  let KHUNG = null;
  try { if (window.parent !== window && window.parent.KHUNG3D) KHUNG = window.parent.KHUNG3D; } catch { /* khác nguồn */ }
  let TAT_CA = [];             // mọi kịch bản mọi trang (Kế hoạch tổng thể cần cả bộ để gắn nút vào dòng việc)
  let DS = [];                 // kịch bản của trang này
  let dang = null;             // {kb, i} cảnh đang hiện

  const h = (tag, attrs = {}, ...con) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "class") e.className = v;
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const c of con.flat()) if (c != null) e.append(c);
    return e;
  };
  // cùng cách chuẩn hoá với _chu() trong tools/3d/canh3d.py
  const tenViec = (s) => String(s || "").replace(/\s+/g, " ").trim().replace(/\s+([,.;:!?)])/g, "$1");

  /* ── chỗ đặt khối ── */
  function choDat(vt) {
    if (vt && vt.startsWith("sau:")) {
      let el = null;
      try { el = document.querySelector(vt.slice(4)); } catch { /* bộ chọn hỏng */ }
      if (el) return el;
    }
    const pane = vt === "the-2" ? document.getElementById("pane-nt") : vt === "dau-trang" ? null : document.getElementById("pane-gi");
    if (pane) {
      let sau = pane.querySelector(":scope > h2.pane-title") || null;
      if (sau) while (sau.nextElementSibling && sau.nextElementSibling.matches(".callout")) sau = sau.nextElementSibling;
      return sau || { dau: pane };
    }
    const head = document.querySelector("header.doc-head");
    if (head) return head;
    return { dau: document.querySelector("main") || document.body };
  }

  /* ── dựng ── */
  function dung() {
    document.querySelectorAll(".kb3d, .kb3d-chip, .kb3d-thanh, .kb3d-nt").forEach((n) => n.remove());
    const cuoi = new Map();                         // nhiều kịch bản cùng chỗ: nối đuôi nhau
    for (const kb of DS) {
      if (kb.vi_tri === "hang" || !kb.canh.length) continue;
      const k = kb.vi_tri || "the-1", el = khoiXem(kb), truoc = cuoi.get(k);
      if (truoc) truoc.after(el);
      else { const c = choDat(k); if (c.dau) c.dau.prepend(el); else c.after(el); }
      cuoi.set(k, el);
    }
    if (LA_GOC) { ganNutDong(); ganNghiemThu(); }
    if (CFG.soan) document.body.append(h("div", { class: "kb3d-thanh ed-ui" },
      h("button", { type: "button", class: "kb3d-nut", title: "Mở bàn soạn 3D toàn màn hình ở tab riêng — mọi việc liệt kê sẵn",
        onclick: () => moSoan() }, "✎ 3D")));
    danhDau();
  }
  function khoiXem(kb) {
    const ol = h("ol", { class: "kb3d-ds" });
    kb.canh.forEach((c, i) => ol.append(h("li", {},
      h("button", { type: "button", class: "kb3d-canh", "data-i": i, "aria-pressed": "false", onclick: () => bam(kb.id, i) },
        h("span", { class: "kb3d-so" }, String(i + 1)), h("span", { class: "kb3d-ten" }, c.ten)),
      c.ghi ? h("span", { class: "kb3d-ghi" }, c.ghi) : null)));
    return h("section", { class: "kb3d ed-ui", "data-kb": kb.id, "aria-label": "Mô hình 3D · " + kb.ten },
      h("div", { class: "kb3d-dau" }, h("span", { class: "kb3d-nhan" }, "Mô hình 3D"), h("strong", {}, kb.ten),
        CFG.soan ? h("button", { type: "button", class: "kb3d-nut nho", onclick: () => moSoan(kb.viec) }, "✎ soạn") : null), ol);
  }
  // Kế hoạch tổng thể: nút «3D» ở cuối ô tên việc của mọi dòng có kịch bản
  function ganNutDong() {
    for (const td of document.querySelectorAll('#viec tr td[data-th="Việc"]')) {
      const ten = tenViec(td.textContent);
      const kb = TAT_CA.find((k) => k.viec && tenViec(k.viec) === ten && k.canh.length);
      if (!kb) continue;
      td.append(h("button", { type: "button", class: "kb3d-chip ed-ui", "data-kb": kb.id,
        title: `Mô hình 3D · ${kb.ten} (${kb.canh.length} cảnh)`, onclick: (e) => { e.preventDefault(); e.stopPropagation(); bam(kb.id, 0); } },
        "3D"));
    }
  }

  // Kế hoạch tổng thể: một link tới bảng nghiệm thu gom mọi việc (viec.html#nghiem-thu), đầu khung «Trang tra cứu»
  function ganNghiemThu() {
    const k = document.querySelector(".toc-extra");
    if (!k || k.querySelector(".kb3d-nt")) return;
    const a = h("a", { class: "kb3d-nt ed-ui", href: "viec.html#nghiem-thu" }, "Nghiệm thu — mọi việc");
    const tieuDe = k.querySelector(".toc-extra-h");
    if (tieuDe) tieuDe.after(a); else k.prepend(a);
  }

  /* ── bấm cảnh ── */
  function bam(id, i = 0, cuon = false) {
    const kb = TAT_CA.find((k) => k.id === id) || DS[0];
    if (!kb || !kb.canh.length) return;
    i = Math.max(0, Math.min(kb.canh.length - 1, i));
    if (!KHUNG) {
      location.href = `${CFG.khung}?p=${encodeURIComponent(TRANG)}&kb=${encodeURIComponent(kb.id)}&c=${i}${location.hash}`;
      return;
    }
    dang = { kb: kb.id, i };
    KHUNG.ap(kb.canh[i], `${kb.ten} · ${kb.canh[i].ten}`, kb, i);
    danhDau();
    // vừa từ trang một mình sang khung: đưa khối kịch bản vào tầm mắt (thẻ chứa nó có thể đang đóng)
    const s = cuon && document.querySelector(`.kb3d[data-kb="${CSS.escape(kb.id)}"], .kb3d-chip[data-kb="${CSS.escape(kb.id)}"]`);
    if (s) {
      const pane = s.closest("[role=tabpanel], .tabpane");
      const nut = pane && pane.hidden && document.querySelector(`[aria-controls="${CSS.escape(pane.id)}"]`);
      if (nut) nut.click();
      s.scrollIntoView({ block: "start" });
    }
  }
  function danhDau() {
    document.querySelectorAll(".kb3d").forEach((s) => s.querySelectorAll("button[data-i]").forEach((b) =>
      b.setAttribute("aria-pressed", String(!!dang && s.dataset.kb === dang.kb && Number(b.dataset.i) === dang.i))));
    document.querySelectorAll(".kb3d-chip").forEach((b) => b.setAttribute("aria-pressed", String(!!dang && b.dataset.kb === dang.kb)));
  }

  /* ── bàn soạn 3D (tab riêng, một tab dùng lại) ── */
  function moSoan(viec) {
    const kb = DS.find((k) => k.viec);
    const q = new URLSearchParams({ trang: TRANG });
    if (viec || kb) q.set("viec", viec || kb.viec);
    const w = window.open(`${CFG.soan}?${q}`, "soan-3d");
    if (w) w.focus();
  }

  /* ── nạp ── */
  function taiLai() {
    return fetch(CFG.json, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
      .then((d) => {
        TAT_CA = [];
        for (const ds of Object.values(d)) for (const k of ds) { k.canh = k.canh || []; TAT_CA.push(k); }
        DS = (d[TRANG] || []).map((k) => TAT_CA.find((x) => x.id === k.id));
      });
  }
  const dangKy = () => { if (KHUNG) KHUNG.dangKy({ win: window, co: DS.some((k) => k.vi_tri !== "hang" && k.canh.length), bam }); };
  taiLai().then(() => { dung(); dangKy(); });
  // bàn soạn 3D lưu xong ⇒ dựng lại khối (không tải lại trang, không mất chỗ đang đọc)
  try {
    new BroadcastChannel("canh-3d").onmessage = () => taiLai().then(() => { dung(); if (dang) danhDau(); });
  } catch { /* trình duyệt cũ */ }
})();
