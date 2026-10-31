/* CHUYỂN ĐỘNG CỦA CÔNG TẮC TRẠNG THÁI (chủ nhà 2026-10-21, học từ Jig: «vật chuyển thế phải ĐI tới thế mới, không nhảy;
   trước khi bấm, nút nổi kèm đường báo cho biết bấm thì cái gì đi đâu»).

   KHÔNG cần dữ liệu thêm ở mo_hinh/*.py: mỗi thế của một `chon_mot` đã là hình học ĐỦ trong .glb. Ở đây ghép từng bộ phận
   của thế cũ với bộ phận cùng tên ở thế mới (bỏ chữ IN HOA của thế — «ĐÓNG», «MỞ»…, cùng số đỉnh), rồi giải phép dời CỨNG
   giữa hai bản (Horn: tứ phân vị từ ma trận hiệp phương sai, đỉnh i ↔ đỉnh i). Phép dời tách thành vít: quay `goc` quanh trục
   `truc` qua điểm `tam` + trượt `doc` dọc trục ⇒ cánh bản lề quay đúng quanh bản lề, cánh lùa trượt thẳng, lá lật quay quanh
   trục riêng của từng lá. Mỗi cặp giải riêng rồi ĐỒNG THUẬN CỤM (dongThuan): phép dời đưa trúng được nhiều bộ phận nhất là phép
   của cả cánh — hộp đối xứng không còn tự chọn mỗi thanh một kiểu lật. Cặp nào không cứng (rèm xếp nếp, ống co giãn) hay bộ phận chỉ có ở một thế ⇒ mờ dần ra / vào.

   Mô-đun THUẦN (không import three) — trình xem và máy thử Node (kiem_chuyen_dong.mjs) dùng chung một bản.
   Toạ độ vào là toạ độ THẾ GIỚI (ma trận thế giới đã nhân), mảng phẳng xyz. */

const SAI_CUNG = 0.003;       // m — sai lệch trung bình sau khi khớp cứng; quá ⇒ không cứng, mờ dần
const GOC_NHO = 0.3 * Math.PI / 180;   // dưới góc này là trượt thuần
const DOI_NHO = 0.0005;       // m — dưới mức này và góc nhỏ ⇒ đứng yên (phương án màu / vật liệu, không chuyển động)

/* ── tên ghép cặp ── */
// bỏ cụm chữ IN HOA (tên thế: ĐÓNG, MỞ, LẬT NẮP, MỞ KHOÁ…) và ngoặc rỗng còn lại; mã có số (O03, D13) giữ nguyên
// cùng bỏ nhãn các thế của CHÍNH công tắc này, không phân hoa thường («(đóng)», «(Mở 45°)», «(mở hai cánh)») — dài trước
const thoat = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function tenGhep(ten, nhan = []) {
  let s = String(ten || "");
  for (const n of [...nhan].sort((a, b) => b.length - a.length)) {
    if (!n) continue;
    s = s.replace(new RegExp("\\(\\s*" + thoat(n) + "\\s*\\)", "giu"), "()")
      .replace(new RegExp("(?<![\\p{L}\\p{N}])" + thoat(n) + "(?![\\p{L}\\p{N}])", "giu"), "");
  }
  return s.replace(/(?<![\p{L}\p{N}])\p{Lu}{2,}(?:\s+\p{Lu}{2,})*(?![\p{L}\p{N}])/gu, "")
    .replace(/\(\s*\)/g, "").replace(/\s+/g, " ").trim();
}

/* ── đại số nhỏ ── */
const tru = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cong = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const nhan = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const vo = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cheo = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dai = (a) => Math.hypot(a[0], a[1], a[2]);
function quayQ(q, v) {                       // v quay bởi tứ phân vị đơn vị q = [x,y,z,w]
  const u = [q[0], q[1], q[2]], w = q[3];
  const t = nhan(cheo(u, v), 2);
  return cong(cong(v, nhan(t, w)), cheo(u, t));
}
function tam(P) {
  const n = P.length / 3, c = [0, 0, 0];
  for (let i = 0; i < P.length; i += 3) { c[0] += P[i]; c[1] += P[i + 1]; c[2] += P[i + 2]; }
  return nhan(c, 1 / n);
}
// trị riêng lớn nhất của ma trận đối xứng 4×4 (Jacobi) ⇒ véc-tơ riêng
function rieng4(N) {
  const A = N.map((r) => r.slice()), V = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
  for (let lap = 0; lap < 60; lap++) {
    let p = 0, q = 1, m = 0;
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (Math.abs(A[i][j]) > m) { m = Math.abs(A[i][j]); p = i; q = j; }
    if (m < 1e-15) break;
    const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
    const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
    const c = 1 / Math.sqrt(t * t + 1), s = t * c;
    for (let k = 0; k < 4; k++) {
      const akp = A[k][p], akq = A[k][q];
      A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
    }
    for (let k = 0; k < 4; k++) {
      const apk = A[p][k], aqk = A[q][k];
      A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
    }
    for (let k = 0; k < 4; k++) {
      const vkp = V[k][p], vkq = V[k][q];
      V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
    }
  }
  let b = 0;
  for (let i = 1; i < 4; i++) if (A[i][i] > A[b][b]) b = i;
  return [V[0][b], V[1][b], V[2][b], V[3][b]];
}

/* Phép dời cứng tốt nhất đưa P → Q (cùng số đỉnh, đỉnh i ↔ i). Trả { q:[x,y,z,w], t, sai } với x' = q·x + t. */
export function khopCung(P, Q) {
  const cp = tam(P), cq = tam(Q);
  let Sxx = 0, Sxy = 0, Sxz = 0, Syx = 0, Syy = 0, Syz = 0, Szx = 0, Szy = 0, Szz = 0;
  for (let i = 0; i < P.length; i += 3) {
    const a0 = P[i] - cp[0], a1 = P[i + 1] - cp[1], a2 = P[i + 2] - cp[2];
    const b0 = Q[i] - cq[0], b1 = Q[i + 1] - cq[1], b2 = Q[i + 2] - cq[2];
    Sxx += a0 * b0; Sxy += a0 * b1; Sxz += a0 * b2;
    Syx += a1 * b0; Syy += a1 * b1; Syz += a1 * b2;
    Szx += a2 * b0; Szy += a2 * b1; Szz += a2 * b2;
  }
  const N = [
    [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
    [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
    [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
    [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz],
  ];
  const e = rieng4(N);                                   // [w, x, y, z]
  let q = [e[1], e[2], e[3], e[0]];
  const l = Math.hypot(...q); q = q.map((v) => v / l);
  if (q[3] < 0) q = q.map((v) => -v);
  const t = tru(cq, quayQ(q, cp));
  let s = 0;
  for (let i = 0; i < P.length; i += 3) {
    const x = cong(quayQ(q, [P[i], P[i + 1], P[i + 2]]), t);
    s += Math.hypot(x[0] - Q[i], x[1] - Q[i + 1], x[2] - Q[i + 2]);
  }
  return { q, t, sai: s / (P.length / 3) };
}

/* Tách phép dời (q, t) thành vít: quay `goc` quanh trục `truc` (đơn vị) qua `tam`, cộng trượt `doc` dọc trục.
   Góc ~180° (cửa mở bật áp tường) thì hai chiều quay đều về cùng thế cuối. Chọn theo MẶT CÁNH: mặt phẳng chứa trục và
   chiều dài của cánh (trục chính của bộ phận, vuông góc trục quay); thế cuối nằm lệch về một phía mặt ấy (bề dày cánh áp
   lên mặt tường) — chiều quay đúng là chiều mà ở giữa đường cánh cũng ở phía đó (cánh đi vòng ra phòng, không xuyên tường).
   (Soát Codex 2026-10-21: bản cũ lấy mặt phẳng qua TÂM cánh — quay 180° đưa tâm về đúng mặt ấy, phép thử vô nghĩa.)
   Lệch < 1 mm (cánh mỏng không bề dày) ⇒ không phân được, giữ chiều đã có. */
function vit(q, t, cDau, cCuoi, P) {
  const s = Math.hypot(q[0], q[1], q[2]);
  let goc = 2 * Math.atan2(s, q[3]);
  if (goc < GOC_NHO) return { kieu: dai(t) < DOI_NHO ? "yen" : "truot", doi: t };
  let truc = [q[0] / s, q[1] / s, q[2] / s];
  const doc = vo(t, truc);
  const tv = tru(t, nhan(truc, doc));
  const cot = 1 / Math.tan(goc / 2);
  const c = nhan(cong(tv, nhan(cheo(truc, tv), cot)), 0.5);
  if (goc > 170 * Math.PI / 180 && P) {
    const D = diemRieng(P), S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const p of D) {
      const r = tru(p, c), rr = tru(r, nhan(truc, vo(r, truc)));
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) S[i][j] += rr[i] * rr[j];
    }
    const e = rieng3(S)[0];                              // chiều dài cánh (vuông góc trục quay)
    const n = cheo(truc, e);                             // pháp tuyến mặt cánh
    const phiaCuoi = vo(tru(cCuoi, c), n);
    const phiaGiua = vo(quayTruc(truc, goc / 2, tru(cDau, c)), n);
    if (Math.abs(phiaCuoi) > 0.001 && phiaGiua * phiaCuoi < 0) {
      return { kieu: "quay", truc: nhan(truc, -1), tam: c, goc: 2 * Math.PI - goc, doc: -doc };
    }
  }
  return { kieu: "quay", truc, tam: c, goc, doc };
}
function quayTruc(u, a, v) {                             // Rodrigues
  const c = Math.cos(a), s = Math.sin(a);
  return cong(cong(nhan(v, c), nhan(cheo(u, v), s)), nhan(u, vo(u, v) * (1 - c)));
}

/* Ma trận 4×4 (cột trước, kiểu three.js Matrix4.elements) đưa bộ phận từ thế đầu tới phần k ∈ [0,1] của đường đi. */
export function maTran(cd, k) {
  if (cd.kieu === "ghep") {                                          // sau(k) · truoc(k), ma trận cột trước
    const A = maTran(cd.sau, k), B = maTran(cd.truoc, k), C = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let v = 0;
      for (let j = 0; j < 4; j++) v += A[j * 4 + r] * B[c * 4 + j];
      C[c * 4 + r] = v;
    }
    return C;
  }
  if (cd.kieu === "gian") {
    // x' = lo(k) + (x − lo0) · co(k)/co0 ; trục mỏng (co0 ≈ 0) giữ nguyên tỉ lệ 1
    const s = [0, 1, 2].map((i) => cd.co0[i] > 1e-4 ? (cd.co0[i] + (cd.co1[i] - cd.co0[i]) * k) / cd.co0[i] : 1);
    const l = [0, 1, 2].map((i) => cd.lo0[i] + (cd.lo1[i] - cd.lo0[i]) * k);
    return [s[0], 0, 0, 0, 0, s[1], 0, 0, 0, 0, s[2], 0, l[0] - cd.lo0[0] * s[0], l[1] - cd.lo0[1] * s[1], l[2] - cd.lo0[2] * s[2], 1];
  }
  if (cd.kieu === "truot") return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, cd.doi[0] * k, cd.doi[1] * k, cd.doi[2] * k, 1];
  if (cd.kieu !== "quay") return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const u = cd.truc, a = cd.goc * k, c = Math.cos(a), s = Math.sin(a), C = 1 - c;
  const R = [
    c + u[0] * u[0] * C, u[1] * u[0] * C + u[2] * s, u[2] * u[0] * C - u[1] * s,
    u[0] * u[1] * C - u[2] * s, c + u[1] * u[1] * C, u[2] * u[1] * C + u[0] * s,
    u[0] * u[2] * C + u[1] * s, u[1] * u[2] * C - u[0] * s, c + u[2] * u[2] * C,
  ];
  // x' = R(x − tam) + tam + k·doc·truc
  const p = cd.tam, d = cd.doc * k;
  const Rp = [R[0] * p[0] + R[3] * p[1] + R[6] * p[2], R[1] * p[0] + R[4] * p[1] + R[7] * p[2], R[2] * p[0] + R[5] * p[1] + R[8] * p[2]];
  return [R[0], R[1], R[2], 0, R[3], R[4], R[5], 0, R[6], R[7], R[8], 0,
    p[0] - Rp[0] + u[0] * d, p[1] - Rp[1] + u[1] * d, p[2] - Rp[2] + u[2] * d, 1];
}
export function apDiem(M, v) {
  return [M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12], M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13],
    M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14]];
}

/* KHỚP KHÔNG THEO THỨ TỰ ĐỈNH. Khối hộp xuất ra luôn ghi góc theo thứ tự của hộp thẳng trục ⇒ cánh đã quay 90° thì đỉnh i
   của thế cũ KHÔNG còn là đỉnh i của thế mới. Ở đây: lấy các điểm khác nhau, đặt khung trục chính (PCA) của hai bản, thử đủ
   24 phép quay đúng chiều ánh xạ khung này sang khung kia, chấm bằng khoảng cách điểm gần nhất (hai chiều). Trả mọi ứng
   viên đạt ngưỡng — hộp đối xứng cho nhiều ứng viên cùng khớp, người gọi chọn (bản lề thật, cùng chuyển động với cả cánh). */
const MAX_DIEM = 600;
function diemRieng(P) {
  const m = new Map(), ra = [];
  for (let i = 0; i < P.length; i += 3) {
    const k = Math.round(P[i] * 2000) + "," + Math.round(P[i + 1] * 2000) + "," + Math.round(P[i + 2] * 2000);
    if (!m.has(k)) { m.set(k, 1); ra.push([P[i], P[i + 1], P[i + 2]]); }
  }
  return ra;
}
function rieng3(S) {                                     // Jacobi 3×3 đối xứng ⇒ cột véc-tơ riêng, trị riêng giảm dần
  const A = S.map((r) => r.slice()), V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let lap = 0; lap < 50; lap++) {
    let p = 0, q = 1, m = 0;
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (Math.abs(A[i][j]) > m) { m = Math.abs(A[i][j]); p = i; q = j; }
    if (m < 1e-18) break;
    const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
    const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
    for (let k = 0; k < 3; k++) { const x = A[k][p], y = A[k][q]; A[k][p] = c * x - s * y; A[k][q] = s * x + c * y; }
    for (let k = 0; k < 3; k++) { const x = A[p][k], y = A[q][k]; A[p][k] = c * x - s * y; A[q][k] = s * x + c * y; }
    for (let k = 0; k < 3; k++) { const x = V[k][p], y = V[k][q]; V[k][p] = c * x - s * y; V[k][q] = s * x + c * y; }
  }
  const thu = [0, 1, 2].sort((i, j) => A[j][j] - A[i][i]);
  return thu.map((i) => [V[0][i], V[1][i], V[2][i]]);
}
function khung(D, c) {
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of D) { const r = tru(p, c); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) S[i][j] += r[i] * r[j]; }
  const F = rieng3(S);
  F[2] = cheo(F[0], F[1]);                               // giữ khung thuận tay phải
  return F;
}
function qTuMaTran(R) {                                  // R[hàng][cột] ⇒ [x,y,z,w]
  const tr = R[0][0] + R[1][1] + R[2][2];
  let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(R[2][1] - R[1][2]) / s, (R[0][2] - R[2][0]) / s, (R[1][0] - R[0][1]) / s, s / 4]; }
  else if (R[0][0] > R[1][1] && R[0][0] > R[2][2]) { const s = Math.sqrt(1 + R[0][0] - R[1][1] - R[2][2]) * 2; q = [s / 4, (R[0][1] + R[1][0]) / s, (R[0][2] + R[2][0]) / s, (R[2][1] - R[1][2]) / s]; }
  else if (R[1][1] > R[2][2]) { const s = Math.sqrt(1 + R[1][1] - R[0][0] - R[2][2]) * 2; q = [(R[0][1] + R[1][0]) / s, s / 4, (R[1][2] + R[2][1]) / s, (R[0][2] - R[2][0]) / s]; }
  else { const s = Math.sqrt(1 + R[2][2] - R[0][0] - R[1][1]) * 2; q = [(R[0][2] + R[2][0]) / s, (R[1][2] + R[2][1]) / s, s / 4, (R[1][0] - R[0][1]) / s]; }
  const l = Math.hypot(...q); q = q.map((v) => v / l);
  return q[3] < 0 ? q.map((v) => -v) : q;
}
const HOAN = [];                                         // 24 ma trận hoán vị có dấu, định thức +1
for (const pm of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]])
  for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
    const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], sg = [sx, sy, sz];
    for (let i = 0; i < 3; i++) M[i][pm[i]] = sg[i];
    const det = M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    if (det > 0) HOAN.push(M);
  }
function gan(D, p) { let m = Infinity; for (const x of D) { const d = Math.hypot(x[0] - p[0], x[1] - p[1], x[2] - p[2]); if (d < m) m = d; } return m; }
export function khopTuDo(P, Q) {
  const A = diemRieng(P), B = diemRieng(Q);
  if (A.length !== B.length || A.length > MAX_DIEM || A.length < 3) return [];
  const ca = A.reduce((s, p) => cong(s, p), [0, 0, 0]).map((v) => v / A.length);
  const cb = B.reduce((s, p) => cong(s, p), [0, 0, 0]).map((v) => v / B.length);
  const Fa = khung(A, ca), Fb = khung(B, cb);
  // ngưỡng theo cỡ bộ phận: mũi khoá 6 mm gần như khối lập phương — 3 mm cố định sẽ nhận cả 24 phép quay
  let r = 0;
  for (const p of A) r = Math.max(r, dai(tru(p, ca)));
  const nguong = Math.min(SAI_CUNG, 0.02 * r);
  const ra = [];
  for (const H of HOAN) {
    // R = Fbᵀ·H·Fa : toạ độ trong khung A → hoán vị → khung B (Fa, Fb lưu theo HÀNG = trục)
    const R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      let v = 0;
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) v += Fb[a][i] * H[a][b] * Fa[b][j];
      R[i][j] = v;
    }
    const q = qTuMaTran(R), t = tru(cb, quayQ(q, ca));
    let s = 0, tot = true;
    for (const p of A) { const d = gan(B, cong(quayQ(q, p), t)); s += d; if (d > 4 * nguong) { tot = false; break; } }
    if (!tot || s / A.length > nguong) continue;
    if (!ra.some((x) => Math.abs(vo(x.q, q)) > 0.99999)) ra.push({ q, t, sai: s / A.length });
  }
  const tot = Math.min(...ra.map((x) => x.sai));
  return ra.filter((x) => x.sai <= tot * 1.5 + 1e-5);       // chỉ giữ ứng viên ngang ngửa ứng viên khớp nhất
}
// điểm của ứng viên quay: trục càng gần cả hai bản (bản lề nằm ở mép chung của thế cũ và thế mới) càng thật
function diemBanLe(cd, A, B) {
  if (cd.kieu !== "quay") return 0;
  const kc = (D) => { let m = Infinity; for (const p of D) { const r = tru(p, cd.tam); const d = dai(tru(r, nhan(cd.truc, vo(r, cd.truc)))); if (d < m) m = d; } return m; };
  return kc(A) + kc(B);
}

/* Ứng viên: khớp đỉnh i ↔ i (nếu đạt) + mọi phép khớp không thứ tự. Hộp vuông / tấm phẳng quay 90° · 180° vẫn là hộp thẳng
   trục ⇒ một phép TRƯỢT cũng khớp y hệt — nên không tin ngay khớp i ↔ i.
   Chọn: (1) cùng chuyển động với bộ phận lớn hơn đã giải (kính, cảm biến, tay nắm đi theo khung cánh); (2) khớp i ↔ i;
   (3) trượt thuần (cánh lùa đối xứng); (4) trục sát mép chung của hai thế nhất, hoà thì góc nhỏ. null = không cứng. */
// tên bộ phận TRƯỢT thật (cánh lùa, ngăn kéo, mành cuốn…) — không bao giờ đổi trượt thành bản lề lật
// tên vật MỀM — đổi hình thật giữa hai thế (giãn hộp bao), không bao giờ coi là vật cứng đi theo cánh
const LA_MEM = /rèm|lò xo|mành|lưới|vải|dây|xếp nếp|ống co|bạt|màn/i;
const LA_TRUOT = /lùa|trượt|ngăn kéo|kéo ra|đẩy vào|cuốn|thả|nâng|hạ|ray|thang kéo/i;
function chonKhop(P, Q, cp, cq, cap, ten = "") {
  if (P.length !== Q.length) return null;
  const k = khopCung(P, Q);
  const uv = k.sai <= SAI_CUNG ? [{ sai: k.sai, ...vit(k.q, k.t, cp, cq, P) }] : [];
  for (const u of khopTuDo(P, Q)) uv.push({ sai: u.sai, tuDo: true, ...vit(u.q, u.t, cp, cq, P) });
  if (!uv.length) return null;
  const A = diemRieng(P), B = diemRieng(Q);
  // LẬT 180° GIẢ LÀM TRƯỢT (soát Codex): tấm cánh thẳng trục đóng ↔ mở 180° áp tường có thể khớp y hệt bằng một phép tịnh tiến,
  // cả khi ghép đỉnh i ↔ i. Có ứng viên quay > 150° mà trục nằm ĐÚNG mép chung của hai thế (≤ 5 mm, bản lề thật) và tên không
  // phải đồ trượt ⇒ quay.
  const lat = LA_TRUOT.test(ten) ? null : uv.filter((u) => u.kieu === "quay" && u.goc > 150 * Math.PI / 180)
    .map((u) => ({ u, d: diemBanLe(u, A, B) })).filter((x) => x.d < 0.005).sort((x, y) => x.d - y.d)[0];
  return uv.find((u) => cap.some((c) => c.kieu !== "yen" && giong(c, u)))
    || (lat && uv.some((u) => u.kieu === "truot") ? lat.u : null)
    || uv.find((u) => !u.tuDo)
    || uv.find((u) => u.kieu !== "quay")
    || uv.slice().sort((u, v) => (diemBanLe(u, A, B) - diemBanLe(v, A, B)) || (u.goc - v.goc))[0];
}
/* TÁCH KHỐI: một mesh có thể chứa nhiều khối rời (tủ hai cánh UA2 = MỘT mesh hai tấm, bản lề hai đầu ngược nhau) — không
   phép dời cứng nào tả được cả mesh. Tách theo tam giác nối nhau (đỉnh trùng vị trí coi là một), trả mảng chỉ số đỉnh. */
function tachKhoi(P, I) {
  const n = P.length / 3, cha = new Int32Array(n).map((_, i) => i);
  const goc = (x) => { while (cha[x] !== x) { cha[x] = cha[cha[x]]; x = cha[x]; } return x; };
  const noi = (a, b) => { a = goc(a); b = goc(b); if (a !== b) cha[a] = b; };
  const han = new Map();
  for (let i = 0; i < n; i++) {
    const k = Math.round(P[3 * i] * 1e4) + "," + Math.round(P[3 * i + 1] * 1e4) + "," + Math.round(P[3 * i + 2] * 1e4);
    if (han.has(k)) noi(i, han.get(k)); else han.set(k, i);
  }
  if (I) for (let t = 0; t < I.length; t += 3) { noi(I[t], I[t + 1]); noi(I[t], I[t + 2]); }
  else for (let t = 0; t < n; t += 3) { noi(t, t + 1); noi(t, t + 2); }
  const nhom = new Map();
  for (let i = 0; i < n; i++) { const r = goc(i); if (!nhom.has(r)) nhom.set(r, []); nhom.get(r).push(i); }
  return [...nhom.values()].map((ds) => {
    const S = new Float32Array(ds.length * 3);
    ds.forEach((v, j) => { S[3 * j] = P[3 * v]; S[3 * j + 1] = P[3 * v + 1]; S[3 * j + 2] = P[3 * v + 2]; });
    return { khoi: Uint32Array.from(ds), P: S, c: tam(S) };
  });
}
// cặp không cứng cả mesh: tách khối hai bên, cùng số khối và cùng bộ số đỉnh ⇒ giải từng khối; một khối hỏng ⇒ null
function theoKhoi(a, b, cap) {
  const A = tachKhoi(a.P, a.I), B = tachKhoi(b.P, b.I);
  if (A.length < 2 || A.length !== B.length) return null;
  const ky = (K) => K.map((x) => x.P.length).sort((u, v) => u - v).join(",");
  if (ky(A) !== ky(B)) return null;
  A.sort((x, y) => dai(hop(y.P).co) - dai(hop(x.P).co));
  const ra = [], dung = new Set();
  for (const x of A) {
    let tot = null, kt = Infinity;
    for (const y of B) if (!dung.has(y) && y.P.length === x.P.length) { const d = dai(tru(y.c, x.c)); if (d < kt) { kt = d; tot = y; } }
    const cd = tot && chonKhop(x.P, tot.P, x.c, tot.c, cap.concat(ra), a.ten);
    if (!cd) return null;
    dung.add(tot);
    ra.push({ tu: a.id, den: b.id, khoiTu: x.khoi, khoiDen: tot.khoi, ...cd });
  }
  return ra;
}

/* GIẢI MỘT LẦN CHUYỂN THẾ.
   nhan: nhãn mọi thế của công tắc (để bỏ khỏi tên khi ghép).
   tu, den: [{ id, ten, P, I? }] — bộ phận ĐANG HIỆN ở thế cũ và SẼ HIỆN ở thế mới (P = Float32Array xyz thế giới).
   Ghép ba lượt, lượt sau chỉ nhận phần lượt trước bỏ sót:
     1. tên bỏ nhãn thế + cùng số đỉnh, phải CỨNG       → quay · trượt · yên
     2. tên bỏ MỌI ngoặc («(mở)», «(cùng màu tường)», «(cánh đầu tuyến, bo góc R18)») + cùng số đỉnh, phải cứng
     3. tên bỏ mọi ngoặc, KHÁC số đỉnh hoặc không cứng (rèm gom ↔ kéo kín, vải cuốn) → «gian»: hộp bao của bản cũ
        giãn dần tới hộp bao bản mới, tới cuối thay bằng bản mới (người gọi đổi lớp như thường) — TRỪ khi tách khối
        (I = chỉ số tam giác) giải được từng khối: cặp mang `khoiTu` / `khoiDen` (chỉ số đỉnh của khối), người gọi dựng
        bản tạm cho từng khối khi chạy
   Trả { cap: [{ tu, den, kieu, …, sai }], ra: [id thế cũ không cặp], vao: [id thế mới không cặp], dongYen } —
   dongYen = true khi không bộ phận nào đi (phương án màu): người gọi chuyển thẳng, không chạy. */
const boNgoac = (t) => String(t || "").replace(/\([^()]*\)/g, "").replace(/\s+/g, " ").trim();
export function giaiChuyenDong(tu, den, { nhan = [] } = {}) {
  const ben = den.map((b) => ({ b, c: tam(b.P), dung: false }));
  const cap = [];
  const coHop = (P) => { const h = hop(P); return dai(h.co); };
  let con = tu.map((a) => ({ a, c: tam(a.P), lon: coHop(a.P) })).sort((x, y) => y.lon - x.lon);   // bộ phận lớn quyết trước
  const luot = (khoa, cungDinh, nhanMem) => {
    const theo = new Map();
    for (const x of ben) if (!x.dung) {
      const k = khoa(x.b.ten) + (cungDinh ? "#" + x.b.P.length : "");
      if (!theo.has(k)) theo.set(k, []);
      theo.get(k).push(x);
    }
    const sot = [];
    for (const y of con) {
      const ds = theo.get(khoa(y.a.ten) + (cungDinh ? "#" + y.a.P.length : "")) || [];
      let tot = null, kt = Infinity;
      for (const x of ds) if (!x.dung) { const d = dai(tru(x.c, y.c)); if (d < kt) { kt = d; tot = x; } }
      if (!tot) { sot.push(y); continue; }
      if (cungDinh) {
        const cd = chonKhop(y.a.P, tot.b.P, y.c, tot.c, cap, y.a.ten);
        if (!cd) { sot.push(y); continue; }
        tot.dung = true;
        cap.push({ tu: y.a.id, den: tot.b.id, ...cd });
      } else if (nhanMem) {
        tot.dung = true;
        const kk = theoKhoi(y.a, tot.b, cap);
        if (kk) cap.push(...kk);
        else cap.push({ tu: y.a.id, den: tot.b.id, sai: 0, ...gian(y.a.P, tot.b.P) });
      }
    }
    con = sot;
  };
  luot((t) => tenGhep(t, nhan), true, false);
  luot((t) => tenGhep(boNgoac(t), nhan), true, false);
  luot((t) => tenGhep(boNgoac(t), nhan), false, true);
  dongThuan(cap, tu, den, nhan);
  diTheo(cap, tu, den);
  chieuNuaVong(cap, tu);
  const ra = con.map((y) => y.a.id);
  const vao = ben.filter((x) => !x.dung).map((x) => x.b.id);
  const dongYen = cap.every((c) => c.kieu === "yen") && !ra.length && !vao.length;
  return { cap, ra, vao, dongYen };
}
/* CHIỀU QUAY NỬA VÒNG (chủ nhà 2026-10-24, cửa xếp O03): quay đúng 180° thì chiều nào cũng tới cùng chỗ — bộ giải có thể
   chọn chiều quét cánh vào TRONG phòng. Cánh thật lật quanh bản lề nằm ở mặt PHÍA MỞ của cánh (bản lề xếp bắt mặt ngoài),
   nên trục quay lệch khỏi mặt phẳng cánh về phía mở: chọn chiều mà giữa đường tâm cụm lệch về đúng phía của trục. */
function chieuNuaVong(cap, tu) {
  const T = new Map(tu.map((a) => [a.id, a]));
  const nhomQ = [];
  for (const c of cap) {
    if (c.kieu !== "quay" || Math.abs(Math.abs(c.goc) - Math.PI) > 0.02) continue;
    const g = nhomQ.find((x) => dai(tru(x.tam, c.tam)) < 0.003 && Math.abs(vo(x.truc, c.truc)) > 0.9995);
    if (g) g.ds.push(c); else nhomQ.push({ tam: c.tam, truc: c.truc, ds: [c] });
  }
  for (const g of nhomQ) {
    const P = g.ds.flatMap((c) => Array.from(T.get(c.tu)?.P || []));
    if (P.length < 9) continue;
    const C = tam(P), t = nhan(g.truc, 1 / dai(g.truc));
    const e1 = (() => { const a = Math.abs(t[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; const v = tru(a, nhan(t, vo(a, t))); return nhan(v, 1 / dai(v)); })();
    const e2 = cheo(t, e1);
    let sxx = 0, sxy = 0, syy = 0;
    for (let i = 0; i < P.length; i += 3) { const d = tru([P[i], P[i + 1], P[i + 2]], C), x = vo(d, e1), y = vo(d, e2); sxx += x * x; sxy += x * y; syy += y * y; }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const truDai = cong(nhan(e1, Math.cos(th)), nhan(e2, Math.sin(th)));      // trục dài của cụm trong mặt ⊥ trục quay
    const n = cheo(t, truDai);                                                 // pháp tuyến mặt phẳng cánh
    // mặt tham chiếu = thế mà cụm nằm PHẲNG cùng mặt với bộ phận đứng yên (cửa xếp: thế đóng, cánh giữa cùng mặt cánh đầu) —
    // ở thế ấy bản lề nằm ở mặt phía mở. Không có bộ phận đứng yên gần ⇒ lấy thế đầu.
    const Ce = apDiem(maTran(g.ds[0], 1), C);
    const yen = cap.filter((c) => c.kieu === "yen" && T.get(c.tu)).map((c) => tam(T.get(c.tu).P))
      .filter((Y) => Math.abs(vo(tru(Y, C), truDai)) < 2.5);
    const cach = (Q) => Math.min(Infinity, ...yen.map((Y) => Math.abs(vo(tru(Y, Q), n))));
    const R = yen.length && cach(Ce) + 0.01 < cach(C) ? Ce : C;
    const lech = vo(tru(g.tam, R), n);
    if (Math.abs(lech) < 0.005) continue;                                      // trục nằm trên mặt cánh: không phân biệt được
    const giua = apDiem(maTran(g.ds[0], 0.5), C);
    if (vo(tru(giua, R), n) * lech >= 0) continue;
    for (const c of g.ds) { c.truc = nhan(c.truc, -1); c.doc = -(c.doc || 0); }
  }
}
/* ĐỒNG THUẬN CỤM (chủ nhà 2026-10-23: «cửa giếng một chỗ báo mà hiện nhiều cái, bộ phận rời ra bay tới chỗ mới»). Mỗi bộ phận
   giải riêng thì hộp đối xứng (đố cánh, kính, chốt) có nhiều phép dời cùng khớp — mỗi thanh chọn một kiểu: thanh quay quanh
   chính nó, kính quay quanh tâm cánh, chốt lật 180°. Một cánh thật là MỘT vật cứng: phép dời đúng là phép đưa được CẢ CỤM về
   thế mới. Ở đây gom mọi ứng viên của mọi cặp cứng, chấm mỗi ứng viên bằng tổng cỡ các bộ phận nó đưa trúng chỗ (điểm gần nhất,
   ≤ SAI_CUNG trung bình), lấy ứng viên giải được nhiều nhất cho mọi cặp nó giải được, lặp với phần còn lại. Ứng viên chỉ giải
   được một cặp thì giữ lựa chọn riêng của cặp ấy. */
// chỉ phần PHÉP DỜI của một cặp (bỏ tu, den, sai, cờ) — để chép sang cặp khác
const chiPhep = ({ kieu, truc, tam: tm, goc, doc, doi, truoc, sau }) => (kieu === "quay" ? { kieu, truc, tam: tm, goc, doc }
  : kieu === "truot" ? { kieu, doi } : kieu === "ghep" ? { kieu, truoc, sau } : { kieu });
function dongThuan(cap, tu, den, nhanCT) {
  const T = new Map(tu.map((a) => [a.id, a])), D = new Map(den.map((b) => [b.id, b]));
  const cs = cap.filter((c) => !c.khoiTu && ["quay", "truot", "yen"].includes(c.kieu));
  if (cs.length < 2) return;
  // khoá nhóm cùng tên (như lượt ghép 2): cặp ghép theo tâm gần nhất có thể ghép CHÉO hai vật cùng tên (chốt «vị trí CẤT» ↔
  // «vị trí HẠ» cùng bỏ chữ hoa thành một tên) — đồng thuận được ghép lại trong nhóm cùng tên
  const khoa = (v) => tenGhep(boNgoac(v.ten), nhanCT) + "#" + v.P.length;
  const tb = (D_) => nhan(D_.reduce((s, p) => cong(s, p), [0, 0, 0]), 1 / D_.length);
  const tt = cs.map((c) => { const a = T.get(c.tu), A = diemRieng(a.P);
    return { c, P: a.P, A, caA: tb(A), ca: tam(a.P), lon: dai(hop(a.P).co), k: khoa(a), ten: a.ten }; });
  const ben = cs.map((c) => { const b = D.get(c.den), B = diemRieng(b.P); return { id: b.id, Q: b.P, B, cqA: tb(B), cq: tam(b.P), k: khoa(b) }; });
  const banDau = new Map(tt.map((x, i) => [x, ben[i]]));
  const uv = [{ kieu: "yen" }];                                      // đứng yên cũng là ứng viên (phương án màu)
  const themUv = (m) => { if (m.kieu !== "yen" && !uv.some((x) => x.kieu === m.kieu && giong(x, m))) uv.push(chiPhep(m)); };
  // hoà điểm ⇒ chuyển động NHỎ nhất thắng: cụm đối xứng (khung, tấm) tự khớp với chính nó khi lật 180° — đứng yên mới đúng
  const nho = (m) => (m.kieu === "yen" ? 0 : m.kieu === "truot" ? dai(m.doi) : 10 + m.goc);
  for (const x of tt) {
    const y = banDau.get(x);
    themUv(x.c);
    if (x.P.length !== y.Q.length) continue;
    const k = khopCung(x.P, y.Q);
    if (k.sai <= SAI_CUNG) themUv(vit(k.q, k.t, x.ca, y.cq, x.P));
    for (const u of khopTuDo(x.P, y.Q)) themUv(vit(u.q, u.t, x.ca, y.cq, x.P));
  }
  // m đưa bộ phận x về đúng bản y? tâm điểm rời trước (rẻ), rồi từng điểm tới điểm gần nhất
  const trung = (M, x, y) => {
    if (x.A.length !== y.B.length || dai(tru(apDiem(M, x.caA), y.cqA)) > 2 * SAI_CUNG) return false;
    let s = 0;
    for (const p of x.A) { const d = gan(y.B, apDiem(M, p)); if (d > 4 * SAI_CUNG) return false; s += d; }
    return s / x.A.length <= SAI_CUNG;
  };
  let con = tt.slice().sort((a, b) => b.lon - a.lon), tu_do = ben.slice();
  const ganMoi = new Map();                                          // x → bản thế mới đã chốt
  const cum = [];                                                    // các cụm đã chốt, cụm lớn trước
  while (con.length) {
    let tot = null;
    for (const m of uv) {
      const M = maTran(m, 1), lay = new Set(), ghep = [];
      for (const x of con) {
        const y0 = banDau.get(x);
        // bản cũ của chính nó trước, rồi bản cùng tên, rồi bất kỳ bản cùng hình: mô hình có thể dựng thế mới theo chiều ngược
        // (cửa O02 cánh 4: đố «đầu» mở ra nằm đúng chỗ đố «cuối» quay tới) — phép chung đưa trúng khít một bản cùng hình
        // thì hai bản ấy là một vật nhìn y hệt nhau
        const thu = (y_) => !lay.has(y_) && trung(M, x, y_);
        const y = (tu_do.includes(y0) && thu(y0)) ? y0
          : tu_do.find((y_) => y_ !== y0 && y_.k === x.k && thu(y_)) || tu_do.find((y_) => y_ !== y0 && y_.k !== x.k && thu(y_));
        if (y) { lay.add(y); ghep.push([x, y]); }
      }
      if (!ghep.length) continue;
      // cụm MỘT bộ phận (cánh một mesh — chốt trên nó đi theo cụm): chỉ nhận đúng lời giải riêng của nó với đúng bản cũ của nó.
      // Không thì một phép lật / trượt mượn của cặp khác đưa được một hộp vào chỗ bản sinh đôi ở xa (đo: trượt 1,1 m ở O03)
      // Bộ phận NHỎ một mình (núm, chốt đổi thế cùng lúc cánh quay) không làm cụm: nó đi theo cụm chứa nó (diTheo).
      if (ghep.length === 1) { const [x, y] = ghep[0]; if (x.lon < 0.3 || y !== banDau.get(x) || x.c.kieu !== m.kieu || !giong(x.c, m)) continue; }
      const diem = ghep.reduce((s, [x]) => s + x.lon, 0);
      // hoà điểm giữa QUAY và TRƯỢT: phép giữ mỗi bộ phận đúng bản cùng tên của nó thắng — cánh xếp đối xứng quay 180° quanh
      // bản lề khớp khít y như trượt một bề rộng cánh với đố «đầu» ↔ «cuối» đổi chỗ (chủ nhà 2026-10-24: cánh giữa bộ Đông Bắc
      // D09 trượt 810 thay vì lật ra sân). Hoà giữa hai phép cùng loại: chuyển động nhỏ nhất thắng như cũ.
      const dung = ghep.reduce((s, [x, y]) => s + (y === banDau.get(x) ? x.lon : 0), 0);
      const hoa = tot && diem >= tot.diem * (1 - 1e-6) && diem <= tot.diem * (1 + 1e-6);
      const quayTruot = hoa && new Set([m.kieu, tot.m.kieu]).size === 2 && [m.kieu, tot.m.kieu].every((k) => k === "quay" || k === "truot");
      if (!tot || diem > tot.diem * (1 + 1e-6) || (quayTruot && dung > tot.dung * (1 + 1e-6))
          || (hoa && !(quayTruot && dung < tot.dung * (1 - 1e-6)) && nho(m) < nho(tot.m))) tot = { m, ghep, diem, dung };
    }
    if (!tot) break;
    const mo = chiPhep(tot.m);
    const M = maTran(mo, 1);
    for (const [x, y] of tot.ghep) {
      const c = x.c;
      for (const k of Object.keys(c)) if (k !== "tu") delete c[k];
      // đỉnh i ↔ i có còn khớp dưới phép chung không — không thì máy thử so theo điểm gần nhất (tuDo)
      let s = 0;
      for (let i = 0; i < x.P.length; i += 3) {
        const q = apDiem(M, [x.P[i], x.P[i + 1], x.P[i + 2]]);
        s += Math.hypot(q[0] - y.Q[i], q[1] - y.Q[i + 1], q[2] - y.Q[i + 2]);
      }
      Object.assign(c, { den: y.id }, mo, { sai: 0, cum: true }, s / (x.P.length / 3) <= SAI_CUNG ? {} : { tuDo: true });
      ganMoi.set(x, y);
    }
    const hc = (ds) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const P of ds) { const h = hop(P); for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], h.lo[i]); hi[i] = Math.max(hi[i], h.lo[i] + h.co[i]); } }
      return { lo, hi }; };
    cum.push({ mo, ds: tot.ghep.map(([x]) => x.c), dau: hc(tot.ghep.map(([x]) => x.P)), cuoi: hc(tot.ghep.map(([, y]) => y.Q)) });
    con = con.filter((x) => !ganMoi.has(x));
    tu_do = tu_do.filter((y) => !tot.ghep.some((g) => g[1] === y));
  }
  /* BỘ CÁNH XẾP (chủ nhà 3D #79): cánh GẤP bản lề vào mép xa cánh ĐẦU (cánh đầu bản lề má khuôn), không vào khuôn ⇒ đường
     đi thật = cánh đầu quay quanh má khuôn, cùng lúc cánh gấp quay quanh bản lề xếp đang đi theo mép cánh đầu. Cánh là hộp đối
     xứng nên mỗi cánh có nhiều phép dời cùng đưa nó tới chỗ mới; đồng thuận có thể chọn phép không phải bản lề. Ở đây, trong
     các ứng viên đưa trúng CẢ cụm: cụm ĐẦU h nhận phép quay quanh trục nằm trên mép nó ở cả hai thế (bản lề thật); cụm GẤP g
     nhận phép F mà h⁻¹ ∘ F là phép quay quanh trục nằm trên mép chung của hai cụm ở thế đầu (bản lề xếp) — và g KHÔNG tự có bản
     lề trên mép mình. Tả g thành «ghep»: truoc = gấp quanh bản lề xếp, sau = phép của h, cùng theo k. Hai chiều gấp cùng tới
     đích; chọn chiều mà giữa đường tâm cánh gấp lệch ít khỏi dây cung (mép tự do chạy trên ray, không vung ra xa). */
  const kcHop = (p, H, tr) => { let s = 0;
    for (let k = 0; k < 3; k++) { if (Math.abs(tr[k]) > 0.99) continue; const d = Math.max(H.lo[k] - p[k], 0, p[k] - H.hi[k]); s += d * d; }
    return Math.sqrt(s); };
  const banLe = (m, x) => m.kieu === "quay" && kcHop(m.tam, x.dau, m.truc) <= 0.08 && kcHop(m.tam, x.cuoi, m.truc) <= 0.08;
  const xCua = new Map(tt.map((x) => [x.c, x]));
  const benK = ben;
  // phép m đưa mọi bộ phận của cụm tới một bản cùng hình (mỗi bản một lần) ⇒ bảng x → y, không thì null
  const giao = (m, cu) => { const M = maTran(m, 1), lay = new Set(), ra = new Map();
    for (const c of cu.ds) { const x = xCua.get(c); if (!x) return null;
      const y0 = ganMoi.get(x);
      const y = (y0 && trung(M, x, y0)) ? y0 : benK.find((y_) => !lay.has(y_) && y_ !== y0 && y_.Q.length === x.P.length && trung(M, x, y_));
      if (!y || lay.has(y)) return null; lay.add(y); ra.set(x, y); }
    return ra; };
  const datPhep = (cu, m, bang) => { const M = maTran(m, 1);
    for (const [x, y] of bang) { const c = x.c;
      for (const k of Object.keys(c)) if (k !== "tu") delete c[k];
      let s_ = 0;
      for (let i = 0; i < x.P.length; i += 3) { const q = apDiem(M, [x.P[i], x.P[i + 1], x.P[i + 2]]);
        s_ += Math.hypot(q[0] - y.Q[i], q[1] - y.Q[i + 1], q[2] - y.Q[i + 2]); }
      Object.assign(c, { den: y.id }, m, { sai: 0, cum: true }, s_ / (x.P.length / 3) <= SAI_CUNG ? {} : { tuDo: true }); }
    cu.mo = m; cu.xep = true; };
  if (cum.length >= 2) {
    const quayUv = uv.filter((m) => m.kieu === "quay");
    const dau = new Map();                                           // cụm → phép bản lề thật của nó (nếu có)
    for (const h of cum) { const m = banLe(h.mo, h) ? h.mo : quayUv.find((m_) => banLe(m_, h) && giao(m_, h)); if (m) dau.set(h, m); }
    for (const g of cum) {
      if (g.xep) continue;
      for (const [h, mh] of dau) {
        if (h === g || dau.has(g) && banLe(dau.get(g), g)) continue;
        let tot = null;
        // thêm ứng viên dựng thẳng từ hình: góc gấp ψ = góc lệch trục dài của cánh gấp (thế đầu ↔ thế cuối kéo ngược về theo
        // h), cộng π; tâm gấp B đưa tâm cụm thế đầu tới tâm cụm thế cuối đã kéo ngược. F = h ∘ R_B(ψ).
        const them = [];
        if (Math.abs(mh.truc[2]) > 0.99) {
          const hN = { kieu: "quay", truc: mh.truc, tam: mh.tam, goc: -mh.goc, doc: -mh.doc }, MN = maTran(hN, 1);
          const xs = g.ds.map((c) => xCua.get(c)).filter(Boolean);
          const ys = xs.map((x) => ganMoi.get(x)).filter(Boolean);
          const truc2 = (D) => { let mx = 0, my = 0, n_ = 0; for (const p of D) { mx += p[0]; my += p[1]; n_++; } mx /= n_; my /= n_;
            let a = 0, b = 0, c = 0; for (const p of D) { const u = p[0] - mx, v = p[1] - my; a += u * u; b += u * v; c += v * v; }
            return { m: [mx, my], g: 0.5 * Math.atan2(2 * b, a - c) }; };
          const T0 = truc2(xs.flatMap((x) => x.A)), T1 = truc2(ys.flatMap((y) => y.B.map((q) => apDiem(MN, q))));
          for (const psi of [T1.g - T0.g, T1.g - T0.g + Math.PI, T1.g - T0.g - Math.PI]) {
            const cs_ = Math.cos(psi), sn_ = Math.sin(psi), c0 = T0.m, c1 = T1.m;
            // (I − R) B = c1 − R c0
            const rx = c1[0] - (cs_ * c0[0] - sn_ * c0[1]), ry = c1[1] - (sn_ * c0[0] + cs_ * c0[1]);
            const a11 = 1 - cs_, a12 = sn_, a21 = -sn_, a22 = 1 - cs_, det = a11 * a22 - a12 * a21;
            if (Math.abs(det) < 1e-6) continue;
            const B = [(rx * a22 - a12 * ry) / det, (a11 * ry - a21 * rx) / det, 0];
            const RB = { kieu: "quay", truc: [0, 0, 1], tam: B, goc: psi, doc: 0 };
            const Mf = maTran({ kieu: "ghep", truoc: RB, sau: mh }, 1);
            const R = [[Mf[0], Mf[4], Mf[8]], [Mf[1], Mf[5], Mf[9]], [Mf[2], Mf[6], Mf[10]]];
            const F_ = vit(qTuMaTran(R), [Mf[12], Mf[13], Mf[14]]);
            if (F_.kieu === "quay") them.push(F_);
          }
        }
        for (const F of [...them, ...quayUv]) {
          if (Math.abs(vo(F.truc, mh.truc)) < 0.9995) continue;
          const hNguoc = { kieu: "quay", truc: mh.truc, tam: mh.tam, goc: -mh.goc, doc: -mh.doc };
          const M = maTran({ kieu: "ghep", truoc: F, sau: hNguoc }, 1);
          const R = [[M[0], M[4], M[8]], [M[1], M[5], M[9]], [M[2], M[6], M[10]]];
          const rel = vit(qTuMaTran(R), [M[12], M[13], M[14]]);
          if (rel.kieu !== "quay" || kcHop(rel.tam, h.dau, rel.truc) > 0.10 || kcHop(rel.tam, g.dau, rel.truc) > 0.10) continue;
          const giua = (H) => [0, 1, 2].map((k) => (H.lo[k] + H.hi[k]) / 2);
          const cD = giua(g.dau), cC = giua(g.cuoi), dc = tru(cC, cD), ldc = dai(dc) || 1;
          const lech = (tr) => { const p = tru(apDiem(maTran({ kieu: "ghep", truoc: tr, sau: mh }, 0.5), cD), cD);
            const t_ = Math.max(0, Math.min(1, vo(p, dc) / (ldc * ldc))); return dai(tru(p, nhan(dc, t_))); };
          const nguoc = { kieu: "quay", truc: nhan(rel.truc, -1), tam: rel.tam, goc: 2 * Math.PI - rel.goc, doc: -rel.doc };
          const truoc = lech(nguoc) < lech(rel) ? nguoc : rel;
          const m = { kieu: "ghep", truoc, sau: mh }, bang = giao(m, g);
          if (!bang) continue;
          const d_ = lech(truoc);
          if (!tot || d_ < tot.d_) tot = { m, bang, d_ };
        }
        if (!tot) continue;
        const bh = giao(mh, h);
        if (!bh) continue;
        datPhep(h, mh, bh);
        datPhep(g, tot.m, tot.bang);
        break;
      }
    }
  }
  /* CỤM CƯỠI TRÊN CỤM: cùng phép quay (trục, góc) với một cụm lớn hơn mà khác tâm ⇒ nó trượt trên cụm lớn rồi quay theo (cửa
     O02: cánh 3 lùa dọc ray của cánh 4 về chồng lên cánh 4, rồi cả hai quay 172° quanh bản lề cánh 4). Tả thành «ghep»: trượt
     `truoc` (ở thế đầu) rồi phép của cụm lớn `sau` — cùng lúc theo k; đúng chỗ cuối, quay quanh bản lề thật, chung một đường báo. */
  for (let i = 1; i < cum.length; i++) {
    const g = cum[i];
    if (g.mo.kieu !== "quay" || g.xep) continue;
    for (const h of cum.slice(0, i)) {
      if (h.mo.kieu !== "quay" || h.xep || Math.abs(h.mo.goc - g.mo.goc) >= 0.01 || vo(h.mo.truc, g.mo.truc) <= 0.9995) continue;
      const t = apDiem(maTran(h.mo, -1), apDiem(maTran(g.mo, 1), [0, 0, 0]));   // h⁻¹ ∘ g = trượt thuần (cùng phép quay)
      if (dai(t) < 0.1) continue;                                      // lệch vài cm: hai núm / hai chốt quay cùng góc, không cưỡi
      // cưỡi thật thì ở một đầu hai cụm nằm CHỒNG mặt lên nhau (cánh 3 xếp lên cánh 4: chồng ≥ 10 cm theo hai trục, khe ≤ 5 cm
      // trục còn lại). Tủ ba cánh: đóng thì đứng CẠNH nhau (chỉ chồng theo chiều cao), mở thì song song cách nửa mét — ba cánh rời
      const chong = (A, B) => { const o = [0, 1, 2].map((k) => Math.min(A.hi[k], B.hi[k]) - Math.max(A.lo[k], B.lo[k]));
        return o.every((v) => v > -0.05) && o.filter((v) => v > 0.1).length >= 2; };
      if (!chong(g.dau, h.dau) && !chong(g.cuoi, h.cuoi)) continue;
      const truoc = { kieu: "truot", doi: t };
      for (const c of g.ds) {
        for (const k of Object.keys(c)) if (!["tu", "den", "sai", "cum", "tuDo"].includes(k)) delete c[k];
        Object.assign(c, { kieu: "ghep", truoc, sau: h.mo });
      }
      break;
    }
  }
  // còn lại mà bản cũ của nó đã bị cặp khác lấy: ghép lại với bản còn trống cùng tên gần nhất, giải riêng như lượt ghép
  const mat = con.filter((x) => !tu_do.includes(banDau.get(x)));
  tu_do = tu_do.filter((y) => !con.some((x) => banDau.get(x) === y));
  for (const x of mat) {
    let y = null, kt = Infinity;
    for (const y_ of tu_do) if (y_.k === x.k) { const d = dai(tru(y_.cq, x.ca)); if (d < kt) { kt = d; y = y_; } }
    if (!y) continue;                                                // không thể xảy ra: mỗi cặp góp một bản mỗi bên, cùng khoá
    tu_do = tu_do.filter((v) => v !== y);
    const cd = chonKhop(x.P, y.Q, x.ca, y.cq, [], x.ten) || gian(x.P, y.Q);
    for (const k of Object.keys(x.c)) if (k !== "tu") delete x.c[k];
    Object.assign(x.c, { den: y.id, sai: 0 }, cd);
  }
}
/* ĐI THEO: bộ phận nhỏ gắn trên bộ phận lớn đang QUAY (cảm biến, kính, tay nắm của cánh) mà khớp riêng ra trượt / giãn
   — vì bản thế mới dựng lại thẳng trục, không xoay theo cánh — thì đi cùng phép quay của bộ phận lớn, nếu phép ấy đưa tâm
   của nó tới gần tâm bản mới (≤ cỡ của nó + 3 cm). Tới cuối người gọi thay bằng bản mới như thường. `theo` = gần đúng. */
function diTheo(cap, tu, den) {
  const T = new Map(tu.map((a) => [a.id, a])), D = new Map(den.map((b) => [b.id, b]));
  const trongHop = (q, h, du) => [0, 1, 2].every((i) => q[i] >= h.lo[i] - du && q[i] <= h.lo[i] + h.co[i] + du);
  /* ĐI THEO CỤM: bộ phận ngoài cụm đồng thuận mà nằm trong hộp một cụm đang chuyển động — khoá, chốt ĐỔI THẾ cùng lúc cánh quay
     (cửa O02: cánh đóng thì chốt cài, cánh mở thì chốt nhả) nên không phép cứng nào khớp; giải riêng ra lật 174° quanh trục
     xiên là bay. Đi cùng cụm (cụm nào đưa tâm nó gần tâm bản mới nhất), tới cuối thay bằng bản mới. */
  const cum = [];
  for (const c of cap) {
    if (!c.cum || c.kieu === "yen") continue;
    const h = hop(T.get(c.tu).P), lo = h.lo, hi = cong(h.lo, h.co);
    const g = cum.find((x) => x.m.kieu === c.kieu && giong(x.m, c));
    if (!g) { cum.push({ m: chiPhep(c), lo, hi }); continue; }
    for (let i = 0; i < 3; i++) { g.lo[i] = Math.min(g.lo[i], lo[i]); g.hi[i] = Math.max(g.hi[i], hi[i]); }
  }
  for (const g of cum) g.h = { lo: g.lo, co: tru(g.hi, g.lo) };
  if (cum.length) for (const c of cap) {
    // giãn của vật MỀM (lò xo, rèm, mành) là đổi hình thật, giữ nguyên; vật cứng ra «giãn» chỉ vì khác số đỉnh giữa hai thế
    // (đố cánh có / không khoét lỗ khoá) thì đi theo cụm. Đứng yên thì không theo ai.
    if (c.khoiTu || c.cum || c.kieu === "yen" || (c.kieu === "gian" && LA_MEM.test(T.get(c.tu).ten))) continue;
    const h = hop(T.get(c.tu).P), co = dai(h.co), ct = cong(h.lo, nhan(h.co, 0.5));
    const hd = hop(D.get(c.den).P), cd = cong(hd.lo, nhan(hd.co, 0.5));
    let tot = null, kt = Infinity;
    for (const g of cum) {
      if (!trongHop(ct, g.h, 0.03)) continue;
      const d = dai(tru(apDiem(maTran(g.m, 1), ct), cd));
      if (d <= co + 0.03 && d < kt) { kt = d; tot = g; }
    }
    if (!tot) continue;
    for (const k of Object.keys(c)) if (k !== "tu" && k !== "den") delete c[k];
    Object.assign(c, tot.m, { sai: 0, theo: true });
  }
  // nguồn chuyển động đáng tin: quay khớp cứng KHÔNG mơ hồ (không phải ứng viên «tự do» của hộp đối xứng)
  const quay = cap.filter((c) => c.kieu === "quay" && !c.khoiTu && !c.theo).map((c) => ({ c, h: hop(T.get(c.tu).P), chac: !c.tuDo || !!c.cum }))
    .sort((x, y) => (y.chac - x.chac) || (dai(y.h.co) - dai(x.h.co)));
  if (!quay.length) return;
  for (const c of cap) {
    if (c.khoiTu || c.theo || c.cum) continue;                 // đã khớp đồng thuận cả cụm — chắc hơn phép «đi theo»
    // cần theo: trượt / giãn (bản thế mới dựng lại, không xoay theo cánh) — hoặc quay «tự do» mơ hồ khác hẳn chuyển động cánh
    // (tay gạt, cảm biến nhỏ ra lật 180° quanh trục xiên — soát 2026-10-21: đường báo chỉ sai trên D13)
    const canTheo = c.kieu === "truot" || c.kieu === "gian" || (c.kieu === "quay" && c.tuDo);
    if (!canTheo) continue;
    const h = hop(T.get(c.tu).P), co = dai(h.co);
    const ct = cong(h.lo, nhan(h.co, 0.5));
    const hd = hop(D.get(c.den).P), cd = cong(hd.lo, nhan(hd.co, 0.5));
    for (const { c: m, h: hm, chac } of quay) {
      if (m === c || (c.kieu === "quay" && giong(m, c))) continue;
      // nguồn: bộ phận LỚN hơn mà nó nằm trên, hoặc (khi chính nó là khung giãn) bộ phận khớp chắc NẰM TRONG nó (kính trong khung)
      const lonHon = dai(hm.co) > co && trongHop(ct, hm, 0.03);
      const nam = c.kieu === "gian" && trongHop(cong(hm.lo, nhan(hm.co, 0.5)), h, 0.03);
      if (!lonHon && !nam) continue;
      if (dai(tru(apDiem(maTran(m, 1), ct), cd)) > co + 0.03) continue;
      for (const k of Object.keys(c)) if (!["tu", "den"].includes(k)) delete c[k];
      Object.assign(c, { kieu: "quay", truc: m.truc, tam: m.tam, goc: m.goc, doc: m.doc, sai: 0, theo: true });
      break;
    }
  }
}
function hop(P) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i + k]); hi[k] = Math.max(hi[k], P[i + k]); }
  return { lo, co: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] };
}
// hộp bao cũ → mới theo từng trục (trục thế giới; rèm, mành, lưới cuốn đều thẳng trục nhà sau phép xoay gốc)
function gian(P, Q) {
  const a = hop(P), b = hop(Q);
  if (dai(tru(a.lo, b.lo)) < DOI_NHO && dai(tru(a.co, b.co)) < DOI_NHO) return { kieu: "yen" };
  return { kieu: "gian", lo0: a.lo, co0: a.co, lo1: b.lo, co1: b.co };
}

/* ĐƯỜNG BÁO trước khi bấm (Jig: mũi tên nét đứt, nét chạy về phía đích). Gộp các cặp cùng một chuyển động (cùng trục,
   tâm, góc — một cánh nhiều bộ phận) thành một đường: cung quét bởi điểm XA trục nhất của nhóm (mép tự do của cánh,
   ngang giữa cao) cho bản lề, mũi tên từ tâm nhóm cho trượt. diem(id) → mảng xyz thế giới của bộ phận (để tìm điểm xa).
   Trả [{ kieu, diem: [[x,y,z]…] (đường gấp khúc theo k), dau: [x,y,z] (đầu mũi tên), huong: [x,y,z] (tiếp tuyến ở đầu) }]. */
const khoiCua = (P, khoi) => {
  if (!khoi) return P;
  const S = new Float32Array(khoi.length * 3);
  khoi.forEach((v, j) => { S[3 * j] = P[3 * v]; S[3 * j + 1] = P[3 * v + 1]; S[3 * j + 2] = P[3 * v + 2]; });
  return S;
};
export { khoiCua };
export function duongBao(kq, diem, { soDoan = 32, toiThieu = 0.05 } = {}) {
  const goi = [];
  for (const c of kq.cap) {
    if (c.kieu === "yen") continue;
    const g = goi.find((x) => giong(x.cd, c));
    if (g) g.ds.push(c); else goi.push({ cd: c, ds: [c] });
  }
  const ra = [];
  for (const { cd, ds } of goi) {
    // cụm cưỡi trên cụm khác: cung của cụm mang nó đã nói đủ — không vẽ thêm đường thứ hai cho cùng một cánh
    if (cd.kieu === "ghep" && goi.some((g) => giong(g.cd, cd.sau))) continue;
    let P = null, xa = -1, lo = Infinity, hi = -Infinity, cs = [0, 0, 0], n = 0;
    // điểm xa trục chỉ lấy trên bộ phận khớp CỨNG — bộ phận «đi theo» (theo) chỉ gần đúng, cung vẽ từ nó tới đích sẽ lệch
    const coCung = ds.some((c) => !c.theo);
    for (const c of ds) {
      const A = khoiCua(diem(c.tu), c.khoiTu);
      for (let i = 0; i < A.length; i += 3) {
        const v = [A[i], A[i + 1], A[i + 2]];
        cs = cong(cs, v); n++;
        if (cd.kieu === "quay" && (!coCung || !c.theo)) {
          const r = tru(v, cd.tam), dd = vo(r, cd.truc);
          lo = Math.min(lo, dd); hi = Math.max(hi, dd);
          const kc = dai(tru(r, nhan(cd.truc, dd)));
          if (kc > xa) { xa = kc; P = v; }
        }
      }
    }
    cs = nhan(cs, 1 / n);
    if (cd.kieu === "truot") {                         // điểm đầu trên bộ phận LỚN nhất (tâm hộp), không giữa khoảng trống của nhóm
      let tot = -1;
      for (const c of ds) { const h = hop(khoiCua(diem(c.tu), c.khoiTu)); const d = dai(h.co); if (d > tot) { tot = d; cs = cong(h.lo, nhan(h.co, 0.5)); } }
    }
    let goc0;
    if (cd.kieu === "quay") {
      // điểm xa trục nhất, kéo về ngang GIỮA chiều dọc trục của nhóm (giữa cao cánh, không phải góc trên)
      const r = tru(P, cd.tam), dd = vo(r, cd.truc);
      goc0 = cong(P, nhan(cd.truc, (lo + hi) / 2 - dd));
      // kéo dọc trục ra khỏi bộ phận (trục xiên, bộ phận nhỏ — chốt, tay gạt) ⇒ giữ chính đỉnh xa nhất
      const trongHop = ds.some((c) => { const h = hop(khoiCua(diem(c.tu), c.khoiTu));
        return [0, 1, 2].every((k) => goc0[k] >= h.lo[k] - 0.005 && goc0[k] <= h.lo[k] + h.co[k] + 0.005); });
      if (!trongHop) goc0 = P;
      if (xa * cd.goc < toiThieu) continue;               // cung ngắn quá (lá lật nhỏ) — vẫn chạy, không báo
    } else if (cd.kieu === "gian") {
      // mũi tên từ MÉP ĐANG ĐI của hộp cũ tới mép ấy ở hộp mới, đủ ba chiều (rèm kéo kín: mép tự do chạy ngang; mành thả:
      // mép dưới chạy xuống; cánh lật kiểu giãn: vừa lên vừa ra) — bản cũ chỉ đi một trục nên cánh lật chỉ «lên» (soát 2026-10-21)
      const d0 = tru(cd.lo1, cd.lo0), d1 = tru(cong(cd.lo1, cd.co1), cong(cd.lo0, cd.co0));
      const thap = dai(d0) > dai(d1);
      const tr = [0, 1, 2].reduce((m, i) => Math.abs((thap ? d0 : d1)[i]) > Math.abs((thap ? d0 : d1)[m]) ? i : m, 0);
      const mep = (lo, co) => { const q = cong(lo, nhan(co, 0.5)); q[tr] = thap ? lo[tr] : lo[tr] + co[tr]; return q; };
      const p0 = mep(cd.lo0, cd.co0), p1 = mep(cd.lo1, cd.co1);
      if (dai(tru(p1, p0)) < toiThieu) continue;
      const pts = [];
      for (let i = 0; i <= soDoan; i++) pts.push(cong(p0, nhan(tru(p1, p0), i / soDoan)));
      ra.push({ kieu: "gian", diem: pts, dau: p1, huong: tru(p1, p0), so: ds.length });
      continue;
    } else {
      goc0 = cs;
      if (dai(cd.doi) < toiThieu) continue;
    }
    const pts = [];
    for (let i = 0; i <= soDoan; i++) pts.push(apDiem(maTran(cd, i / soDoan), goc0));
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    ra.push({ kieu: cd.kieu, diem: pts, dau: b, huong: tru(b, a), so: ds.length });
  }
  return ra;
}
function giong(a, b) {
  if (a.kieu !== b.kieu) return false;
  if (a.kieu === "truot") return dai(tru(a.doi, b.doi)) < 0.002;
  if (a.kieu === "gian") return false;
  if (a.kieu === "ghep") return giong(a.truoc, b.truoc) && giong(a.sau, b.sau);
  if (a.kieu !== "quay") return true;
  if (Math.abs(a.goc - b.goc) > 0.01 || vo(a.truc, b.truc) < 0.9995) return false;
  const d = tru(a.tam, b.tam);
  return dai(tru(d, nhan(a.truc, vo(d, a.truc)))) < 0.003;
}
