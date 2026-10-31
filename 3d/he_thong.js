/* HỆ THỐNG ĐIỆN · MẠNG · NHÀ THÔNG MINH của vật đang chọn (chủ nhà 2026-10-23: «bấm từng thứ để xem thêm thông tin»).
   Nối vật 3D với bảng `bang_dien` (mo_hinh/dien.py _bang_dien): ở máy là thuộc tính gốc của nhóm `dien`; ở bản đăng thuộc tính
   gốc bị bỏ nên bảng đến từ mo-hinh/bang-dien.json (dong_goi_site.py bang_dien_cong_khai — chữ đã qua máy soát, chỉ trường hiện).
   Vật khớp mục theo MÃ ĐIỂM đầu tên («E-T2-25 — Modem…») — bản đăng đổi tên vật nên mang thêm `ma_diem`; bộ đèn theo `bo_den`;
   cảm biến cửa theo «cửa <ô> … cảm biến cửa».
   Ra `chiTiet()` — mục đầy đủ trong bảng Chi tiết (thẻ vật nhỏ chỉ còn số đo + câu tóm tắt, chủ nhà 3D #44):
   mẫu, nguồn cấp, vai trò, kịch bản tự động dùng nó (bấm mở «Khi» / «Làm»), công tắc → thứ nó điều khiển, điểm điện → mạch + chuỗi cấp. */

const LOAI_VI = { o_cam: "Ổ cắm", o_cam_doi: "Ổ đôi", o_kin_nuoc: "Ổ kín nước", o_dieu_hoa: "Ổ cạnh điều hoà", o_ngoai_troi: "Ổ ngoài trời",
  nguon_thiet_bi: "Đầu chờ nguồn", nguon_5v: "Nguồn 5V trần", tu_dien_tong: "Tủ điện tổng", tu_dien_nhanh: "Tủ điện nhánh",
  tu_mang: "Tủ mạng", luu_dien: "Lưu điện", dan_lanh: "Dàn lạnh", binh_nong_lanh: "Bình nóng lạnh", quat_hut: "Quạt hút",
  quat_cap_gio: "Quạt cấp gió tươi", hop_quat_tran: "Quạt trần", ap: "Điểm phát wifi", camera: "Camera", cam_bien: "Cảm biến",
  bao_khoi: "Đầu báo khói", bao_nhiet: "Đầu báo nhiệt", cong_tac: "Công tắc", nut_bam: "Nút bấm", cong_tac_2chieu: "Công tắc hai chiều",
  cong_tac_rem: "Công tắc rèm", nut_khong_day: "Nút không dây", cap_mang: "Cáp mạng", chuong_cua: "Chuông cửa", ong_cho: "Ống chờ",
  den_tran: "Đèn trần", den_tuong: "Đèn tường", den_am_tran: "Đèn âm trần" };
const MA_DAU = /^([A-Z][A-Z0-9]*(?:-[A-Za-z0-9]+)*)\s+—\s/;
const cat = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s || "");
const dau = (s) => (s || "").split(" — ")[0].split(". ")[0].trim();
const el = (tag, cls, chu) => { const e = document.createElement(tag); if (cls) e.className = cls; if (chu != null) e.textContent = chu; return e; };

export function heThong(api) {
  let site = null, dangTai = false, ix = null;

  /* bảng đang dùng: thuộc tính gốc (máy) hoặc JSON công khai (bản đăng) — tải một lần, gắn vào GOC.userData.bang_dien */
  function bang() {
    const g = api.GOC();
    if (g.userData.bang_dien) return g.userData.bang_dien;
    if (site) { g.userData.bang_dien = site; return site; }
    if (!dangTai) {
      dangTai = true;
      fetch("mo-hinh/bang-dien.json").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) { site = d; api.khiSan(); } }).catch(() => {});
    }
    return null;
  }
  function chiMuc(b) {
    if (ix && ix.b === b) return ix;
    ix = { b, tbDiem: new Map(), tbMa: new Map(), tbCua: new Map(), ct: new Map(), mach: new Map((b.mach || []).map((m) => [m.ma, m])), D: b.diem || {} };
    for (const t of b.thiet_bi || []) {
      ix.tbMa.set(t.ma, t);
      // thiết bị có vật 3D riêng («HUB-M3 — …», «IR-NGUPHU — …») chỉ khớp theo mã của nó — không gán cho vật khác cùng điểm (modem, ổ cắm)
      if (t.diem && !t.rieng) { if (!ix.tbDiem.has(t.diem)) ix.tbDiem.set(t.diem, []); ix.tbDiem.get(t.diem).push(t); }
      if (t.cua && t.o_3d) ix.tbCua.set(t.o_3d, t);
    }
    for (const c of b.cong_tac || []) ix.ct.set(c.ma, c);
    return ix;
  }

  /* các mục hệ thống của một nhóm vật: [{khoa, ma, tb[], ct, d}] — thiết bị trước, rồi công tắc, rồi điểm */
  function phanGiai(ds, I) {
    const ra = new Map();
    let dau = null;                      // mục của vật đầu danh sách (vật vừa bấm) đứng đầu
    for (const o of ds) {
      const u = o.userData, ten = u.ten || "";
      if ((u.nhom || "").startsWith("Ống chờ") || /ống chờ/.test(ten)) continue;
      let ma = u.ma_diem || u.bo_den || (MA_DAU.exec(ten) || [])[1];
      let tb = [], khoa = null;
      const cua = /cửa (?:sổ )?(\S+) .*cảm biến cửa/i.exec(ten);
      if (cua && I.tbCua.has(cua[1])) { tb = [I.tbCua.get(cua[1])]; khoa = "cua:" + cua[1]; ma = null; }
      else if (ma && I.tbMa.has(ma)) { tb = [I.tbMa.get(ma)]; khoa = ma; ma = null; }
      else if (ma) { tb = I.tbDiem.get(ma) || []; khoa = ma; }
      if (!khoa) continue;
      if (dau === null) dau = khoa;
      if (ra.has(khoa)) continue;
      const ct = ma ? I.ct.get(ma) : null, d = ma ? I.D[ma] : null;
      if (tb.length || ct || d) ra.set(khoa, { khoa, ma, tb, ct, d });
    }
    const hang = (e) => (e.tb.length ? 0 : e.ct ? 1 : 2);
    const xep = [...ra.values()].sort((a, b) => (b.khoa === dau) - (a.khoa === dau) || hang(a) - hang(b));
    return xep.slice(0, 8);
  }

  const noi = (d) => [d?.tang, d?.phong].filter(Boolean).join(" · ");
  const tenMach = (I, m) => { const t = I.mach.get(m); return t ? cat(dau(t.ten) || m, 70) : ""; };
  const nhanDiem = (I, ma) => { const d = I.D[ma] || {}; return d.co_den ? "Đèn" : /^Modem/.test(d.ten || "") ? "Modem" : LOAI_VI[d.loai] || "Điểm điện"; };
  const kichBan = (I, ma) => (I.b.kich_ban || []).filter((k) => (k.thiet_bi || []).some((x) => ma.includes(x)));

  function tieuDe(I, e) {
    const t = e.tb[0];
    if (t) return { nhan: "Thiết bị nhà thông minh", ten: t.nhom };
    if (e.ct) return { nhan: "Công tắc tường", ten: e.ct.loai };
    return { nhan: "Điểm điện", ten: nhanDiem(I, e.ma) };
  }
  function dong(dl, nhan, val) {
    if (!val) return;
    dl.append(el("dt", null, nhan), el("dd", null, val));
  }

  /* chuỗi cấp: điểm → điểm cấp → … → mạch → tủ */
  function chuoi(I, ma) {
    const ra = [], da = new Set();
    let cur = ma;
    while (cur && I.D[cur] && !da.has(cur)) {
      da.add(cur);
      const d = I.D[cur];
      if (cur !== ma) ra.push([nhanDiem(I, cur), d.ten]);
      if (d.cap_tu) { cur = d.cap_tu; continue; }
      const tu = [];
      for (const m of d.mach ? [d.mach] : d.mach_nhieu || []) {
        const mt = I.mach.get(m) || {};
        const rcd = /chống dòng rò/.test(mt.ten || "") ? "" : mt.rcd ? ` · chống dòng rò ${mt.rcd}` : "";
        ra.push(["Mạch", cat(mt.ten || "", 120) + rcd]);
        if (mt.tu && !tu.includes(mt.tu)) tu.push(mt.tu);
      }
      cur = tu.length === 1 ? tu[0] : null;
    }
    return ra;
  }
  const danhSach = (k, tieu, hang) => {
    if (!hang.length) return;
    k.append(el("h4", "ht-h4", tieu));
    const ul = el("ul", "ht-ds");
    for (const [nh, ten] of hang) {
      const li = el("li");
      li.append(el("span", "ht-ds-nhan", nh), el("span", "ht-ds-ten", ten));
      ul.append(li);
    }
    k.append(ul);
  };

  function kichBanMuc(k, ds) {
    if (!ds.length) return;
    k.append(el("h4", "ht-h4", `Kịch bản tự động dùng nó · ${ds.length}`));
    for (const kb of ds) {
      const d = el("details", "ht-kb"), s = el("summary", null, kb.ten || kb.ma);
      const dl = el("dl", "ht-kb-nd");
      dong(dl, "Khi", kb.khi); dong(dl, "Làm", kb.lam);
      d.append(s, dl); k.append(d);
    }
  }

  /* mục đầy đủ trong bảng Chi tiết */
  function chiTiet(k, ds) {
    const b = bang();
    if (!b) return;
    const I = chiMuc(b), es = phanGiai(ds, I);
    for (const e of es) {
      const th = tieuDe(I, e), sec = el("section", "ht-chi-tiet");
      sec.append(el("h3", null, "Hệ thống · " + th.nhan));
      sec.append(el("p", "ht-ten", th.ten));
      const dl = el("dl", "so ht-so");
      for (const t of e.tb) {
        if (e.tb.length > 1) dong(dl, "Thiết bị", t.nhom);
        dong(dl, "Vai trò", t.vi);
        dong(dl, "Mẫu", t.model);
        dong(dl, "Nguồn cấp", t.nguon);
        dong(dl, "Ở", noi(t));
      }
      if (e.ct) {
        dong(dl, "Vai trò", e.ct.vi);
        dong(dl, "Ở", noi(e.ct));
        dong(dl, "Mạch", tenMach(I, e.ct.mach));
      }
      if (e.d && !e.tb.length && !e.ct) { dong(dl, "Là", e.d.ten); dong(dl, "Ở", noi(e.d)); }
      // mã điểm điện chỉ để nối dữ liệu — không hiện cho chủ nhà
      if (e.d && !e.ct) {
        const ms = e.d.mach ? [e.d.mach] : e.d.mach_nhieu || [];
        dong(dl, ms.length > 1 ? "Các mạch" : "Mạch", ms.map((m) => tenMach(I, m)).filter(Boolean).join(" · "));
      }
      sec.append(dl);
      if (e.ct) {
        const dk = e.ct.dieu_khien || [];
        danhSach(sec, e.ct.loai === "Nút bấm" ? "Nút này điều khiển" : "Công tắc này điều khiển", dk.map((x) => [LOAI_VI[x.loai] || (x.loai === "cong_tac_trang_thai" ? "Cửa · rèm" : "Thiết bị"), x.ten || x.ma]));
        if (!dk.length) danhSach(sec, "Công tắc này điều khiển (mọi bộ đèn cùng mạch)", (e.ct.theo_mach || []).map((x) => [LOAI_VI[x.loai] || "Đèn", x.ten || x.ma]));
      }
      if (e.ma && e.d) {
        const ngan = chuoi(I, e.ma);
        danhSach(sec, "Nguồn cấp từ", ngan);
        const cho = [];
        for (const t of I.b.thiet_bi_dien || []) if (t.diem === e.ma) cho.push(["Máy", t.ten]);
        for (const [m, d] of Object.entries(I.D)) if (d.cap_tu === e.ma) cho.push([nhanDiem(I, m), d.ten]);
        danhSach(sec, "Cấp cho", cho);
        const cts = (I.b.bi_dieu_khien || {})[e.ma] || [];
        danhSach(sec, "Công tắc bật tắt nó", cts.map((m) => ["Công tắc", I.D[m]?.ten || m]));
        if (e.tb.length === 0 && (I.tbDiem.get(e.ma) || []).length) danhSach(sec, "Thiết bị nhà thông minh", I.tbDiem.get(e.ma).map((t) => [t.nhom, cat(dau(t.vi), 80)]));
      }
      kichBanMuc(sec, kichBan(I, [e.ma, ...e.tb.map((x) => x.ma)].filter(Boolean)));
      k.append(sec);
    }
  }
  /* một câu CÔNG DỤNG cho đầu bảng Chi tiết (chủ nhà 3D #31: «tên rồi công dụng»): vai trò thiết bị / công tắc, không thì
     điểm điện là gì */
  function congDung(ds) {
    const b = bang();
    if (!b) return "";
    const e = phanGiai(ds, chiMuc(b))[0];
    return e ? e.ct?.vi || e.tb[0]?.vi || e.d?.ten || "" : "";       // công tắc nói về chính nó; thiết bị cùng điểm nói về cả hệ
  }
  return { chiTiet, bang, congDung };
}
