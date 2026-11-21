/* CHẾ ĐỘ SỬA TRÊN THIẾT BỊ (bản đăng trên site, iPhone — chủ nhà 2026-11-02 «make it so the published site works with this too
   and on iphone automatically without extra steps. Newly added materials only show in the phone it adds is acceptable»).

   Không có máy chủ xem.py ⇒ mọi lời gọi `goiSua("vat_lieu", …)` của web/sua/vat_lieu.js trả lời NGAY TRÊN TRÌNH DUYỆT:
     · bang_mau / phong_tang / nhom_thu_vien — bản chụp tĩnh `sua/bang.json` (dong_goi_site.py ghi lúc đóng gói) + mẫu tự thêm
       của chính máy này;
     · doc_chon / ghi_chon — lựa chọn đã xác nhận lưu ở localStorage của máy (tải lại trang áp lại, máy khác không thấy);
     · them_anh — làm sạch ảnh + dựng vân bằng JS (nắn 4 góc, gỡ ánh sáng không đều, gỡ loá, lưới viên + mạch, bản đồ pháp
       tuyến, mặt liền liền mép) — cùng cách với them_vat_lieu.py / lam_sach_anh_gach.py / van_vat_lieu.py, gọn hơn; ảnh vân
       (màu · nhám · pháp) lưu IndexedDB của máy;
     · xoa_anh — gỡ mẫu tự thêm của máy (chưa dùng trong lựa chọn đã lưu);
     · mọi hàm khác (dời đồ, tường, kho…) — từ chối: trên thiết bị chỉ đổi vật liệu.
   Ảnh vân của mẫu máy này mang khoá `cb_<id>`; `urlVan(k, t)` trả địa chỉ blob: của nó (mẫu thư viện: vat-lieu/<k>/<t>.jpg). */

const KHO_CHON = "383:vat-lieu-chon";
const NHOM_TU_THEM = ["tu_them", "Vật liệu tự thêm (ảnh chụp)"];
const NHAM = { bong: 0.12, ban_bong: 0.35, mo: 0.6, nham: 0.8 };
let TINH = null;
const URL_ANH = new Map();                                           // cb_<id> → {mau, nham, phap} blob: URL
let NAP = null;
const TAM = new Map();                                               // mẫu chỉ sống tới khi đóng trang (máy không cho lưu IndexedDB)

export const urlVan = (k, t) => URL_ANH.get(k)?.[t] || `vat-lieu/${k}/${t}.jpg`;

const tinh = () => (TINH ||= fetch("sua/bang.json").then((r) => (r.ok ? r.json() : { mau: [], phong: {}, nhom: [] })).catch(() => ({ mau: [], phong: {}, nhom: [] })));

/* ── IndexedDB ── */
function moDb() {
  return new Promise((ok, loi) => {
    const r = indexedDB.open("383-vat-lieu", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("anh", { keyPath: "id" });
    r.onsuccess = () => ok(r.result); r.onerror = () => loi(r.error);
  });
}
async function kho(che, f) {
  const db = await moDb();
  return new Promise((ok, loi) => {
    const tx = db.transaction("anh", che), s = tx.objectStore("anh"), r = f(s);
    const het = setTimeout(() => { try { tx.abort(); } catch { /* đã xong */ } loi(new Error("IndexedDB không trả lời")); }, 15000);
    tx.oncomplete = () => { clearTimeout(het); db.close(); ok(r?.result); };
    tx.onerror = tx.onabort = () => { clearTimeout(het); db.close(); loi(tx.error || new Error("IndexedDB huỷ giao dịch")); };
  });
}
/* ảnh lưu dạng ArrayBuffer (không lưu Blob: Safari / WebKit ở chế độ riêng tư không cất được Blob vào IndexedDB — treo) */
const thanhUrl = (b) => URL.createObjectURL(b instanceof Blob ? b : new Blob([b], { type: "image/jpeg" }));
async function dsMay() {
  return (NAP ||= (async () => {
    let ds = [];
    try { ds = (await kho("readonly", (s) => s.getAll())) || []; } catch (e) { console.warn("vật liệu máy này: không mở được IndexedDB", e); }
    for (const r of ds) if (!URL_ANH.has(r.id)) URL_ANH.set(r.id, { mau: thanhUrl(r.mau), nham: thanhUrl(r.nham), phap: thanhUrl(r.phap) });
    return [...ds.map((r) => r.o), ...[...TAM.values()].filter((o) => !ds.some((r) => r.id === o.vl_co_san))];
  })());
}

/* ── lựa chọn đã xác nhận ── */
const docChon = () => { try { return JSON.parse(localStorage.getItem(KHO_CHON) || "{}") || {}; } catch { return {}; } };

/* ── màu ── */
const LIN = new Float32Array(256).map((_, i) => { const v = i / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
const srgb = (x) => { x = Math.min(1, Math.max(0, x)); return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055); };
const hex = (c) => "#" + c.map((x) => Math.round(srgb(x)).toString(16).padStart(2, "0")).join("");
const tuHex = (h, md) => (/^#?[0-9a-f]{6}$/i.test(h || "") ? [0, 2, 4].map((i) => LIN[parseInt(h.replace("#", "").slice(i, i + 2), 16)]) : md);

/* nắn: điểm (u, v) ∈ [0,1]² → điểm ảnh nguồn theo 4 góc (trên trái, trên phải, dưới phải, dưới trái) — Heckbert */
function vuongToiTuGiac(q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) return (u, v) => [x0 + (x1 - x0) * u + (x3 - x0) * v, y0 + (y1 - y0) * u + (y3 - y0) * v];
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3;
  return (u, v) => { const w = g * u + h * v + 1; return [(a * u + b * v + x0) / w, (d * u + e * v + y0) / w]; };
}

/* ảnh (Float32 tuyến tính, 3 kênh) */
const anh = (w, h) => ({ w, h, d: new Float32Array(w * h * 3) });
function layMau(A, x, y) {                                            // song tuyến, kẹp mép
  x = Math.min(A.w - 1, Math.max(0, x - 0.5)); y = Math.min(A.h - 1, Math.max(0, y - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(A.w - 1, x0 + 1), y1 = Math.min(A.h - 1, y0 + 1), fx = x - x0, fy = y - y0;
  const r = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const a = A.d[(y0 * A.w + x0) * 3 + c], b = A.d[(y0 * A.w + x1) * 3 + c], p = A.d[(y1 * A.w + x0) * 3 + c], q = A.d[(y1 * A.w + x1) * 3 + c];
    r[c] = (a * (1 - fx) + b * fx) * (1 - fy) + (p * (1 - fx) + q * fx) * fy;
  }
  return r;
}
function tuCanvas(cv) {
  const { width: w, height: h } = cv, px = cv.getContext("2d").getImageData(0, 0, w, h).data, A = anh(w, h);
  for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) A.d[i * 3 + c] = LIN[px[i * 4 + c]];
  return A;
}
function nan(A, goc, w, h) {
  const f = vuongToiTuGiac(goc.map(([x, y]) => [x * A.w, y * A.h])), B = anh(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const [x, y] = f((i + 0.5) / w, (j + 0.5) / h), m = layMau(A, x, y), k = (j * w + i) * 3;
    B.d[k] = m[0]; B.d[k + 1] = m[1]; B.d[k + 2] = m[2];
  }
  return B;
}
const sang = (A, i) => (A.d[i * 3] + A.d[i * 3 + 1] + A.d[i * 3 + 2]) / 3;
function moHop(v, w, h, r, vong = false) {                            // nhoè hộp tách chiều (3 lượt ≈ Gauss)
  let a = Float32Array.from(v), b = new Float32Array(v.length);
  const lan = (src, dst, n, buoc, dem, goc) => {
    for (let g = 0; g < dem; g++) {
      const o = goc(g); let s = 0;
      for (let t = -r; t <= r; t++) { const i = vong ? ((t % n) + n) % n : Math.min(n - 1, Math.max(0, t)); s += src[o + i * buoc]; }
      for (let i = 0; i < n; i++) {
        dst[o + i * buoc] = s / (2 * r + 1);
        const ra = vong ? (((i - r) % n) + n) % n : Math.max(0, i - r), vo = vong ? (i + r + 1) % n : Math.min(n - 1, i + r + 1);
        s += src[o + vo * buoc] - src[o + ra * buoc];
      }
    }
  };
  for (let l = 0; l < 3; l++) { lan(a, b, w, 1, h, (g) => g * w); lan(b, a, h, w, w, (g) => g); }
  return a;
}
/* gỡ ánh sáng không đều: khớp mặt bậc hai vào log độ sáng (lưới thưa) rồi chia — như go_anh_sang của lam_sach_anh_gach.py */
function goAnhSang(A) {
  const n = 48, M = new Float64Array(36), V = new Float64Array(6);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i + 0.5) / n, y = (j + 0.5) / n, L = sang(A, Math.floor(y * A.h) * A.w + Math.floor(x * A.w));
    if (L <= 1e-4) continue;
    const X = x - 0.5, Y = y - 0.5, f = [1, X, Y, X * X, Y * Y, X * Y], z = Math.log(L);
    for (let a = 0; a < 6; a++) { V[a] += f[a] * z; for (let b = 0; b < 6; b++) M[a * 6 + b] += f[a] * f[b]; }
  }
  const hs = giai(M, V); if (!hs) return A;
  for (let j = 0; j < A.h; j++) for (let i = 0; i < A.w; i++) {
    const X = (i + 0.5) / A.w - 0.5, Y = (j + 0.5) / A.h - 0.5;
    const k = Math.exp(hs[1] * X + hs[2] * Y + hs[3] * X * X + hs[4] * Y * Y + hs[5] * X * Y), o = (j * A.w + i) * 3;
    for (let c = 0; c < 3; c++) A.d[o + c] /= k;
  }
  return A;
}
function giai(M, V) {                                                 // khử Gauss 6×6
  const n = 6, a = [...Array(n)].map((_, i) => [...M.slice(i * n, i * n + n), V[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-12) return null;
    [a[c], a[p]] = [a[p], a[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = a[r][c] / a[c][c]; for (let k = c; k <= n; k++) a[r][k] -= f * a[c][k]; }
  }
  return a.map((r, i) => r[n] / r[i]);
}
/* gỡ vệt loá đèn trên men bóng: chỗ sáng hơn hẳn nền quanh + gần như mất sắc ⇒ lấp bằng nền không loá (nhoè chuẩn hoá) */
function goLoa(A) {
  const N = A.w * A.h, L = new Float32Array(N), S = new Float32Array(N);
  for (let i = 0; i < N; i++) { const r = A.d[i * 3], g = A.d[i * 3 + 1], b = A.d[i * 3 + 2]; L[i] = (r + g + b) / 3; S[i] = Math.max(r, g, b) - Math.min(r, g, b); }
  const nen = moHop(L, A.w, A.h, Math.max(4, Math.round(Math.min(A.w, A.h) / 24)));
  const sm = Float32Array.from(S).sort()[N >> 1];
  let loa = new Uint8Array(N);
  for (let i = 0; i < N; i++) loa[i] = L[i] > nen[i] * 1.15 && S[i] < Math.max(sm * 0.55, 0.02) ? 1 : 0;
  const md = moHop(Float32Array.from(loa), A.w, A.h, 3); for (let i = 0; i < N; i++) loa[i] = md[i] > 0.05 ? 1 : 0;
  if (!loa.some((x) => x)) return A;
  for (const r of [6, 16, 40]) {
    const w = Float32Array.from(loa, (x) => 1 - x), wb = moHop(w, A.w, A.h, r);
    const kb = [0, 1, 2].map((c) => moHop(Float32Array.from({ length: N }, (_, i) => A.d[i * 3 + c] * w[i]), A.w, A.h, r));
    for (let i = 0; i < N; i++) if (loa[i] && wb[i] > 0.15) { for (let c = 0; c < 3; c++) A.d[i * 3 + c] = kb[c][i] / wb[i]; loa[i] = 0; }
  }
  return A;
}
const tb = (A) => { const s = [0, 0, 0], n = A.w * A.h; for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) s[c] += A.d[i * 3 + c]; return s.map((x) => x / n); };
function cat(A, x0, y0, w, h) { const B = anh(w, h); for (let j = 0; j < h; j++) B.d.set(A.d.subarray(((y0 + j) * A.w + x0) * 3, ((y0 + j) * A.w + x0 + w) * 3), j * w * 3); return B; }

/* ── DỰNG VÂN 1024×1024 (một ô lặp `co` mét) ── */
const N = 1024;
function dungVan(A, t) {
  const W = t.rong_mm / 1000, H = t.cao_mm / 1000;
  const mau = anh(N, N), cao = new Float32Array(N * N), nh = new Float32Array(N * N).fill(t.nham);
  let co;
  if (t.kieu === "lien") {                                            // mặt liền: thu về N×N, làm LIỀN MÉP (trộn với chính nó dời nửa ô)
    co = [W, H];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const m = layMau(A, (i + 0.5) * A.w / N, (j + 0.5) * A.h / N); mau.d.set(m, (j * N + i) * 3); }
    const tr = (i) => { const d = Math.min(1, Math.min(i, N - 1 - i) / (N * 0.12)); return d * d * (3 - 2 * d); };
    for (const truc of [0, 1]) {
      const cu = Float32Array.from(mau.d);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const k = truc ? tr(j) : tr(i), i2 = truc ? i : (i + N / 2) % N, j2 = truc ? (j + N / 2) % N : j, o = (j * N + i) * 3, o2 = (j2 * N + i2) * 3;
        for (let c = 0; c < 3; c++) mau.d[o + c] = cu[o + c] * k + cu[o2 + c] * (1 - k);
      }
    }
    for (let i = 0; i < N * N; i++) cao[i] = sang(mau, i);
  } else {
    const nc = t.kieu === "luoi" ? t.cot : 1, nr = t.kieu === "luoi" ? t.hang : 1;
    const mat = [], fw = A.w / nc, fh = A.h / nr, le = Math.round(0.06 * Math.min(fw, fh) * (nc * nr > 1 ? 1 : 0));
    for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++)
      mat.push(cat(A, Math.round(i * fw) + le, Math.round(j * fh) + le, Math.max(4, Math.round(fw) - 2 * le), Math.max(4, Math.round(fh) - 2 * le)));
    const dich = tb(A);
    for (const F of mat) { const m = tb(F); for (let i = 0; i < F.w * F.h; i++) for (let c = 0; c < 3; c++) F.d[i * 3 + c] *= dich[c] / Math.max(m[c], 1e-4); }
    let nu = Math.max(1, Math.round(1.2 / W)), nv = Math.max(1, Math.round(1.2 / H));
    if (t.so_le && nv % 2) nv += 1;
    co = [nu * W, nv * H];
    const pu = N / nu, pv = N / nv, mach = Math.max(1, (t.mach_mm / 1000) / co[0] * N), mm = tuHex(t.mau_mach, [0.6, 0.6, 0.58]);
    const bevel = Math.max(1, 0.003 / co[0] * N);                      // mép men gối ~3 mm
    let s = 1234567;
    const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    const vuong = Math.abs(W - H) < 1e-6;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const F = mat[Math.floor(rnd() * mat.length)], lat = rnd() < 0.5, sg = 1 + (rnd() + rnd() + rnd() - 1.5) * 0.06;
      const quay = t.xoay && vuong ? Math.floor(rnd() * 4) : 2 * Math.floor(rnd() * 2);
      const x0 = Math.round(i * pu + (t.so_le && j % 2 ? pu / 2 : 0)), y0 = Math.round(j * pv);
      const ww = Math.round((i + 1) * pu) - Math.round(i * pu), hh = Math.round((j + 1) * pv) - y0;
      for (let y = 0; y < hh; y++) for (let x = 0; x < ww; x++) {
        let u = (x + 0.5) / ww, v = (y + 0.5) / hh;
        if (lat) u = 1 - u;
        for (let q = 0; q < quay; q++) [u, v] = [v, 1 - u];
        const gx = (x0 + x) % N, gy = (y0 + y) % N, o = gy * N + gx, dm = Math.min(x + 0.5, ww - x - 0.5, y + 0.5, hh - y - 0.5);
        if (dm < mach / 2) { mau.d.set(mm, o * 3); cao[o] = 0; nh[o] = 0.9; continue; }
        const m = layMau(F, u * F.w, v * F.h);
        for (let c = 0; c < 3; c++) mau.d[o * 3 + c] = m[c] * sg;
        const tt = Math.min(1, (dm - mach / 2) / bevel);
        cao[o] = Math.sqrt(1 - (1 - tt) ** 2) * 0.6 + 0.4 * (m[0] + m[1] + m[2]) / 3 / Math.max(1e-4, (dich[0] + dich[1] + dich[2]) / 3) * 0.2;
      }
    }
  }
  // pháp tuyến từ bản đồ cao (dải tần giữa cho vân mặt; gờ viên đã ở `cao`), lặp liền mép
  const L = moHop(cao, N, N, 1, true), Lx = moHop(cao, N, N, 8, true), P = new Uint8ClampedArray(N * N * 4), k = t.kieu === "lien" ? 6 : 3;
  const hh = (i) => L[i] - (t.kieu === "lien" ? Lx[i] : 0);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const gx = hh(j * N + (i + 1) % N) - hh(j * N + (i + N - 1) % N), gy = hh(((j + 1) % N) * N + i) - hh(((j + N - 1) % N) * N + i);
    let x = -gx * k, y = gy * k, z = 1; const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
    const o = (j * N + i) * 4; P[o] = (x * 0.5 + 0.5) * 255; P[o + 1] = (y * 0.5 + 0.5) * 255; P[o + 2] = (z * 0.5 + 0.5) * 255; P[o + 3] = 255;
  }
  const C = new Uint8ClampedArray(N * N * 4), R = new Uint8ClampedArray(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    for (let c = 0; c < 3; c++) C[i * 4 + c] = srgb(mau.d[i * 3 + c]);
    C[i * 4 + 3] = 255; const r = Math.round(nh[i] * 255); R[i * 4] = R[i * 4 + 1] = R[i * 4 + 2] = r; R[i * 4 + 3] = 255;
  }
  return { C, R, P, co: co.map((x) => Math.round(x * 1e4) / 1e4), mau: tb(mau) };
}
const thanhBlob = (px) => new Promise((ok) => {
  const c = document.createElement("canvas"); c.width = c.height = N;
  c.getContext("2d").putImageData(new ImageData(px, N, N), 0, 0);
  c.toBlob((b) => ok(b), "image/jpeg", 0.9);
});

function thuNho(cv, max) {                                           // ảnh gốc to (12 MP iPhone) ⇒ thu về ≤ max px trước khi nắn
  const k = Math.min(1, max / Math.max(cv.width, cv.height)); if (k >= 1) return cv;
  const c = document.createElement("canvas"); c.width = Math.round(cv.width * k); c.height = Math.round(cv.height * k);
  c.getContext("2d").drawImage(cv, 0, 0, c.width, c.height); return c;
}
async function themAnh(t) {
  const loi = [];
  const ten = String(t.ten || "").trim();
  if (!ten) loi.push("Thiếu tên vật liệu.");
  if (!["vien", "luoi", "lien"].includes(t.kieu)) loi.push("Kiểu ảnh phải là vien, luoi hoặc lien.");
  if (!(t.rong_mm >= 5 && t.rong_mm <= 4000 && t.cao_mm >= 5 && t.cao_mm <= 4000)) loi.push("Cỡ phải là số mm (5–4000).");
  if (!t.anh_canvas) loi.push("Thiếu ảnh.");
  if (loi.length) return { ok: false, loi };
  const nc = t.kieu === "luoi" ? Math.max(1, t.cot | 0) : 1, nr = t.kieu === "luoi" ? Math.max(1, t.hang | 0) : 1;
  const tw = t.rong_mm * nc, th = t.cao_mm * nr, s = 1024 / Math.max(tw, th);   // ≤ 1024 px: mỗi viên trên vân chỉ ~N/số viên px
  const goc = t.goc4 || [[0, 0], [1, 0], [1, 1], [0, 1]];
  await new Promise((r) => setTimeout(r, 30));                         // nhường khung cho chữ «đang dựng» hiện
  const t0 = performance.now(), moc = (x) => console.debug(`thiet_bi: ${x} ${Math.round(performance.now() - t0)} ms`);
  let A = nan(tuCanvas(thuNho(t.anh_canvas, 1600)), goc, Math.max(16, Math.round(tw * s)), Math.max(16, Math.round(th * s))); moc("nắn");
  if (t.go_loa) { A = goLoa(A); moc("gỡ loá"); }
  A = goAnhSang(A); moc("gỡ ánh sáng");
  const v = dungVan(A, { ...t, cot: nc, hang: nr, nham: NHAM[t.be_mat] ?? 0.35 }); moc("dựng vân");
  const [mau, nham, phap] = await Promise.all([thanhBlob(v.C), thanhBlob(v.R), thanhBlob(v.P)]); moc("nén jpg");
  const id = "cb_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const d = await tinh(), nhan = (d.nhom || []).find((x) => x[0] === t.nhom)?.[1];
  const nhom = !nhan || t.nhom === NHOM_TU_THEM[0] ? "Tự thêm — " + NHOM_TU_THEM[1] : "Gạch — " + (nhan.replace(/^Gạch\s+/, "").replace(/^./, (c) => c.toUpperCase()));
  const co_ten = t.kieu === "lien" ? "" : ` — ${Math.round(t.rong_mm)}×${Math.round(t.cao_mm)}`;
  const o = { ma: "tv:" + id, ten: ten + co_ten, nhom, hex: hex(v.mau), kim_loai: 0, nham: NHAM[t.be_mat] ?? 0.35, nguon: "thiet-bi",
    suy_ra: false, vl_co_san: id, van_co: v.co, tu_them: true, may_nay: true };
  let chu = "";
  try {
    const [a, b, c] = await Promise.all([mau, nham, phap].map((x) => x.arrayBuffer()));
    await kho("readwrite", (st) => st.put({ id, o, mau: a, nham: b, phap: c })); moc("đã lưu IndexedDB");
  } catch (e) {
    console.warn("vật liệu máy này: không lưu được IndexedDB — mẫu chỉ còn tới khi đóng trang", e);
    TAM.set(id, o); o.ten += " (chưa lưu được trên máy)"; chu = "máy không cho lưu lâu dài (duyệt riêng tư?) — mẫu mất khi đóng trang";
  }
  URL_ANH.set(id, { mau: URL.createObjectURL(mau), nham: URL.createObjectURL(nham), phap: URL.createObjectURL(phap) });
  NAP = null;
  return { ok: true, ma: id, o, canh_bao: chu };
}

async function xoaAnh(ma) {
  if (!/^cb_[a-z0-9]+$/.test(ma || "")) return { ok: false, loi: [`${ma}: chỉ gỡ được mẫu thêm trên máy này.`] };
  const dung = Object.values(docChon()).some((s) => s && s.vl_co_san === ma);
  if (dung) return { ok: false, loi: ["mẫu này đang dùng trong lựa chọn đã xác nhận — gỡ chỗ dùng trước."] };
  if (TAM.has(ma)) TAM.delete(ma); else await kho("readwrite", (st) => st.delete(ma));
  const u = URL_ANH.get(ma); if (u) for (const x of Object.values(u)) URL.revokeObjectURL(x);
  URL_ANH.delete(ma); NAP = null;
  return { ok: true, ma };
}

export async function goi(mod, ham, than = {}) {
  if (mod !== "vat_lieu") return { ok: false, loi: ["trên thiết bị này chỉ đổi được vật liệu"] };
  try {
    switch (ham) {
      case "bang_mau": { const [d, may] = await Promise.all([tinh(), dsMay()]); return { ok: true, mau: [...may, ...d.mau] }; }
      case "phong_tang": return { ok: true, tang: (await tinh()).phong || {} };
      case "nhom_thu_vien": { const n = (await tinh()).nhom || []; return { ok: true, nhom: n.length ? n : [NHOM_TU_THEM] }; }
      case "doc_chon": {                                             // lựa chọn trỏ tới mẫu máy này mà ảnh không còn ⇒ bỏ qua (khỏi vân hỏng)
        await dsMay(); const c = docChon();
        for (const [k, sp] of Object.entries(c)) if (sp?.vl_co_san?.startsWith("cb_") && !URL_ANH.has(sp.vl_co_san)) delete c[k];
        return { ok: true, chon: c };
      }
      case "ghi_chon": {
        const gop = docChon();
        for (const [k, s] of Object.entries(than.chon || {})) {
          if (!/^(luoi|phong):[\w:.\-]+$/.test(k)) return { ok: false, loi: ["khoá lựa chọn không hợp lệ"] };
          if (s && TAM.has(s.vl_co_san)) return { ok: false, loi: ["mẫu ảnh này chưa lưu được trên máy (duyệt riêng tư?) — tải lại là mất, nên không giữ lựa chọn"] };   // Codex soát
          if (s === null) delete gop[k]; else gop[k] = s;
        }
        if (!than.thu) localStorage.setItem(KHO_CHON, JSON.stringify(gop));
        return { ok: true, chon: gop, thu: !!than.thu, so: Object.keys(gop).length };
      }
      case "gan_nhat": {
        const c = tuHex(than.hex, null); if (!c) return { ok: false, loi: ["màu không đúng dạng #rrggbb"] };
        const [d, may] = await Promise.all([tinh(), dsMay()]); let best = null;
        for (const m of [...may, ...d.mau]) { const k = tuHex(m.hex, [0, 0, 0]), x = Math.hypot(...k.map((v, i) => srgb(v) - srgb(c[i]))); if (!best || x < best[0]) best = [x, m]; }
        return best ? { ok: true, gan: best[1], cach: Math.round(best[0] * 10) / 10 } : { ok: false, loi: ["bảng trống"] };
      }
      case "them_anh": return await themAnh(than);
      case "xoa_anh": return await xoaAnh(than.ma);
      default: return { ok: false, loi: ["trên thiết bị này chỉ đổi được vật liệu"] };
    }
  } catch (e) { return { ok: false, loi: [`${e.name || "Lỗi"}: ${e.message}`] }; }
}
