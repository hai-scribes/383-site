/* THƯỚC — chọn MẶT và CẠNH, đo vuông góc và ngắn nhất giữa hai đặc điểm (chủ nhà 2026-11-05).
   Mô-đun phụ của xem.js («THƯỚC: bấm hai điểm»), nạp động, chỉ ở máy (bản đăng là chế độ chỉ xem, không có thước).

   Mỗi đầu thước mang một ĐẶC ĐIỂM dưới con trỏ:
     { loai: "diem", p }                     đỉnh lưới (hít đỉnh)
     { loai: "canh", p, a, b, giao }         cạnh (hít cạnh; giao = giao tuyến hai mặt, coi như đường dài)
     { loai: "mat",  p, n, d, tris, obj }    MẶT: mặt phẳng n·x = d + các tam giác đồng phẳng liền nhau của mặt ấy (sáng lên khi rê)
   Điểm bấm p luôn có (toạ độ THẾ GIỚI). Đầu thứ hai, tuỳ phím / công tắc:
     (không)  điểm ↔ điểm (như cũ)
     Shift    VUÔNG GÓC: từ điểm bấm thứ nhất xuống mặt phẳng / đường cạnh của đặc điểm thứ hai
     Alt      NGẮN NHẤT GIỮA HAI ĐẶC ĐIỂM, bỏ qua chỗ bấm: mặt↔mặt (song song: khoảng cách hai mặt phẳng; không song song:
              «không song song» + khoảng ngắn nhất giữa hai mặt có biên) · cạnh↔cạnh · cạnh↔mặt · điểm↔mặt · điểm↔cạnh
   Trả cho xem.js { p, p1, truc: -3, nhan, ch } — `ch` đi vào bản ghi thước (rec.ch) và dòng ghi chú «THƯỚC <mm> mm (<ch>): …». */

const KEP = 1.5e-3;                    // dung sai đồng phẳng (m, thế giới)
const SONG_SONG = 1e-5;                // 1 − |n1·n2| nhỏ hơn ⇒ song song (~0,25°)
const TRAN_TAM_GIAC = 3000;            // một mặt tối đa bấy nhiêu tam giác
const MAU_MAT = 0x1e90ff, MAU_DA = 0xf08a00;

export function lap(C) {
  const { THREE, camera, canvas, batDiem } = C;
  const V3 = THREE.Vector3;
  const bat = { vuong: false, giua: false, mat: false };     // công tắc cảm ứng (phím Shift / Alt vẫn dùng được)
  let F1 = null;                                              // đặc điểm của đầu thứ nhất
  const nhom = new THREE.Group();
  C.scene.add(nhom);
  const sang = { hov: null, da: null };                       // lưới sáng mặt: rê · đã chọn
  const luuVung = new Map();

  /* ── mặt: gom các tam giác đồng phẳng liền nhau ── */
  const CACHE = new WeakMap();
  function luoi(geo) {
    let c = CACHE.get(geo);
    if (c !== undefined) return c;
    const pos = geo.attributes.position, idx = geo.index, n = idx ? idx.count : pos.count;
    if (n > 600000) { CACHE.set(geo, null); return null; }
    const vid = (t, k) => (idx ? idx.getX(3 * t + k) : 3 * t + k);
    const key = (i) => Math.round(pos.getX(i) * 1e5) + "," + Math.round(pos.getY(i) * 1e5) + "," + Math.round(pos.getZ(i) * 1e5);
    const kho = new Map();
    const nt = Math.floor(n / 3);
    for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
      const kk = key(vid(t, k));
      let l = kho.get(kk); if (!l) kho.set(kk, l = []);
      l.push(t);
    }
    c = { nt, vid, kho, key, pos };
    CACHE.set(geo, c);
    return c;
  }
  function vungMat(h) {
    if (!h || !h.object || !h.object.geometry || h.faceIndex == null) return null;
    const ma = h.faceIndex + ":" + h.object.uuid, cu = luuVung.get(ma);
    if (cu) return cu;
    const o = h.object, geo = o.geometry, pos = geo.attributes.position;
    if (!pos) return null;
    const c = luoi(geo);
    const vid = c ? c.vid : (t, k) => 3 * t + k;
    const tw = (t) => [0, 1, 2].map((k) => new V3().fromBufferAttribute(pos, vid(t, k)).applyMatrix4(o.matrixWorld));
    const t0 = tw(h.faceIndex);
    const n = t0[1].clone().sub(t0[0]).cross(t0[2].clone().sub(t0[0]));
    if (n.lengthSq() < 1e-18) return null;
    n.normalize();
    const d = n.dot(t0[0]);
    const tris = [t0];
    if (c) {
      const thay = new Set([h.faceIndex]), ngan = [h.faceIndex];
      while (ngan.length && tris.length < TRAN_TAM_GIAC) {
        const t = ngan.pop();
        for (let k = 0; k < 3; k++) for (const u of c.kho.get(c.key(vid(t, k))) || []) {
          if (thay.has(u)) continue;
          thay.add(u);
          const v = tw(u);
          if (v.every((q) => Math.abs(n.dot(q) - d) < KEP) && v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).lengthSq() > 1e-18) { tris.push(v); ngan.push(u); }
        }
      }
    }
    const kq = { loai: "mat", n, d, tris, obj: o, khoa: o.uuid + ":" + n.toArray().map((x) => x.toFixed(3)) + ":" + d.toFixed(3) };
    if (luuVung.size > 400) luuVung.clear();
    luuVung.set(ma, kq);
    return kq;
  }

  /* ── đặc điểm dưới con trỏ (k = kết quả batDiem) ── */
  function dacDiem(k, h) {
    if (!k || !h) return null;
    if (k.canh) return { loai: "canh", p: k.p.clone(), a: k.canh.a.clone(), b: k.canh.b.clone(), giao: !!k.canh.giao };
    if (k.p.distanceToSquared(h.point) > 1e-10) return { loai: "diem", p: k.p.clone() };      // hít đỉnh
    const m = vungMat(h);
    return m ? { ...m, p: k.p.clone() } : { loai: "diem", p: k.p.clone() };
  }

  /* ── hình học ── */
  const kep = (x) => Math.max(0, Math.min(1, x));
  const chanMat = (p, f) => p.clone().addScaledVector(f.n, f.d - f.n.dot(p));
  function dai(f) {                                           // cạnh → hai đầu; giao tuyến coi như đường dài
    if (!f.giao) return [f.a, f.b];
    const u = f.b.clone().sub(f.a).normalize();
    return [f.a.clone().addScaledVector(u, -50), f.b.clone().addScaledVector(u, 50)];
  }
  function chanDuong(p, f) {                                  // chân đường vuông góc xuống ĐƯỜNG THẲNG của cạnh
    const u = f.b.clone().sub(f.a).normalize();
    return f.a.clone().addScaledVector(u, p.clone().sub(f.a).dot(u));
  }
  function chanDoan(p, f) {
    const [a, b] = dai(f), u = b.clone().sub(a), L2 = u.lengthSq();
    return a.clone().addScaledVector(u, L2 < 1e-18 ? 0 : kep(p.clone().sub(a).dot(u) / L2));
  }
  function doanDoan(p1, q1, p2, q2) {                         // Ericson 5.1.9
    const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2);
    const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r), E = 1e-14;
    let s, t;
    if (a <= E && e <= E) { s = t = 0; }
    else if (a <= E) { s = 0; t = kep(f / e); }
    else {
      const c = d1.dot(r);
      if (e <= E) { t = 0; s = kep(-c / a); }
      else {
        const b = d1.dot(d2), mau = a * e - b * b;
        s = mau > 1e-12 * a * e ? kep((b * f - c * e) / mau) : 0;
        t = (b * s + f) / e;
        if (t < 0) { t = 0; s = kep(-c / a); } else if (t > 1) { t = 1; s = kep((b - c) / a); }
      }
    }
    return { A: p1.clone().addScaledVector(d1, s), B: p2.clone().addScaledVector(d2, t) };
  }
  function diemTamGiac(p, a, b, c) {                          // điểm gần p nhất trên tam giác (Ericson 5.1.5)
    const ab = b.clone().sub(a), ac = c.clone().sub(a), ap = p.clone().sub(a);
    const d1 = ab.dot(ap), d2 = ac.dot(ap);
    if (d1 <= 0 && d2 <= 0) return a.clone();
    const bp = p.clone().sub(b), d3 = ab.dot(bp), d4 = ac.dot(bp);
    if (d3 >= 0 && d4 <= d3) return b.clone();
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) return a.clone().addScaledVector(ab, d1 / (d1 - d3));
    const cp = p.clone().sub(c), d5 = ab.dot(cp), d6 = ac.dot(cp);
    if (d6 >= 0 && d5 <= d6) return c.clone();
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) return a.clone().addScaledVector(ac, d2 / (d2 - d6));
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return b.clone().addScaledVector(c.clone().sub(b), (d4 - d3) / (d4 - d3 + d5 - d6));
    const m = 1 / (va + vb + vc);
    return a.clone().addScaledVector(ab, vb * m).addScaledVector(ac, vc * m);
  }
  function doanTam(p, q, T) {                                 // đoạn p–q với tam giác T: cặp điểm gần nhất
    const n = T[1].clone().sub(T[0]).cross(T[2].clone().sub(T[0])).normalize();
    const s0 = n.dot(p.clone().sub(T[0])), s1 = n.dot(q.clone().sub(T[0]));
    if (s0 * s1 <= 0 && s0 !== s1) {
      const x = p.clone().addScaledVector(q.clone().sub(p), s0 / (s0 - s1));
      if (diemTamGiac(x, T[0], T[1], T[2]).distanceToSquared(x) < 1e-12) return { A: x, B: x.clone(), dist: 0 };
    }
    let tot = null;
    const xet = (A, B) => { const dd = A.distanceTo(B); if (!tot || dd < tot.dist) tot = { A, B, dist: dd }; };
    for (let i = 0; i < 3; i++) { const r = doanDoan(p, q, T[i], T[(i + 1) % 3]); xet(r.A, r.B); }
    for (const e of [p, q]) xet(e.clone(), diemTamGiac(e, T[0], T[1], T[2]));
    return tot;
  }
  function tamTam(T1, T2) {
    let tot = null;
    for (const [X, Y, ph] of [[T1, T2, false], [T2, T1, true]]) for (let i = 0; i < 3; i++) {
      const r = doanTam(X[i], X[(i + 1) % 3], Y);
      const [A, B] = ph ? [r.B, r.A] : [r.A, r.B];
      if (!tot || r.dist < tot.dist) tot = { A, B, dist: r.dist };
      if (r.dist < 1e-9) return tot;
    }
    return tot;
  }
  const cau = (T) => { const c = T[0].clone().add(T[1]).add(T[2]).divideScalar(3); return { c, r: Math.max(c.distanceTo(T[0]), c.distanceTo(T[1]), c.distanceTo(T[2])) }; };
  function matMat(f1, f2) {                                   // hai tập tam giác: khoảng ngắn nhất (cắt tỉa theo hình cầu bao)
    const b1 = f1.tris.map(cau), b2 = f2.tris.map(cau);
    let tot = null;
    for (let i = 0; i < f1.tris.length; i++) for (let j = 0; j < f2.tris.length; j++) {
      if (tot && b1[i].c.distanceTo(b2[j].c) - b1[i].r - b2[j].r >= tot.dist) continue;
      const r = tamTam(f1.tris[i], f2.tris[j]);
      if (!tot || r.dist < tot.dist) tot = r;
      if (tot.dist < 1e-9) return tot;
    }
    return tot;
  }
  function doanMat(f, m) {
    const [p, q] = dai(f);
    let tot = null;
    for (const T of m.tris) { const r = doanTam(p, q, T); if (!tot || r.dist < tot.dist) tot = r; if (tot.dist < 1e-9) break; }
    return tot;
  }

  /* VUÔNG GÓC: từ điểm bấm thứ nhất p1 xuống đặc điểm thứ hai. Trả { A, B, ch } hoặc null (đỉnh: điểm — đo thường). */
  function vuong(p1, f2) {
    if (!f2) return null;
    if (f2.loai === "mat") return { A: p1.clone(), B: chanMat(p1, f2), ch: "vuông góc" };
    if (f2.loai === "canh") return { A: p1.clone(), B: chanDuong(p1, f2), ch: "vuông góc" };
    return null;
  }
  /* NGẮN NHẤT GIỮA HAI ĐẶC ĐIỂM (bỏ qua chỗ bấm, trừ điểm tựa cho cặp song song). */
  const HANG = { diem: 0, canh: 1, mat: 2 };
  function giua(f1, f2) {
    if (!f1 || !f2) return null;
    if (HANG[f1.loai] > HANG[f2.loai]) { const r = giua(f2, f1); return r && { ...r, A: r.B, B: r.A }; }
    const o = (A, B, ch) => ({ A, B, ch });
    if (f1.loai === "diem" && f2.loai === "diem") return o(f1.p.clone(), f2.p.clone(), "điểm↔điểm");
    if (f1.loai === "diem" && f2.loai === "canh") return o(f1.p.clone(), chanDoan(f1.p, f2), "điểm↔cạnh");
    if (f1.loai === "diem") return o(f1.p.clone(), chanMat(f1.p, f2), "điểm↔mặt");
    if (f1.loai === "canh" && f2.loai === "canh") { const [p1, q1] = dai(f1), [p2, q2] = dai(f2), r = doanDoan(p1, q1, p2, q2); return o(r.A, r.B, "cạnh↔cạnh"); }
    if (f1.loai === "canh") {                                  // cạnh ↔ mặt
      const u = f1.b.clone().sub(f1.a).normalize();
      if (Math.abs(u.dot(f2.n)) < 1e-4) { const A = chanDoan(f1.p, f1); return o(A, chanMat(A, f2), "cạnh↔mặt"); }
      const r = doanMat(f1, f2);
      return o(r.A, r.B, "cạnh↔mặt");
    }
    // mặt ↔ mặt
    if (1 - Math.abs(f1.n.dot(f2.n)) < SONG_SONG) return o(f1.p.clone(), chanMat(f1.p, f2), "mặt↔mặt");
    const r = matMat(f1, f2);
    return o(r.A, r.B, "mặt↔mặt không song song");
  }

  /* ── hiển thị: mặt sáng ── */
  function veSang(o, f, mau) {
    const cu = sang[o];
    if (!f || f.loai !== "mat") { if (cu) { nhom.remove(cu.m); cu.m.geometry.dispose(); sang[o] = null; } return; }
    if (cu && cu.khoa === f.khoa) return;
    if (cu) { nhom.remove(cu.m); cu.m.geometry.dispose(); }
    const ar = new Float32Array(f.tris.length * 9);
    f.tris.forEach((T, i) => T.forEach((v, k) => v.toArray(ar, i * 9 + k * 3)));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(ar, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: mau, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.renderOrder = 9; m.frustumCulled = false; m.raycast = () => {};
    nhom.add(m);
    sang[o] = { m, khoa: f.khoa };
  }

  /* ── giao diện công tắc (chạm: không có phím) ── */
  const st = document.createElement("style");
  st.textContent = `#bang-do { flex-wrap: wrap; justify-content: center; max-width: calc(100% - 16px); }
#bang-do .thuoc-mat button { min-height: var(--cham, 44px); min-width: var(--cham, 44px); white-space: normal; line-height: 1.2; }`;
  document.head.append(st);
  const hang = document.createElement("div");
  hang.className = "nhom-nut nho thuoc-mat"; hang.setAttribute("role", "group"); hang.setAttribute("aria-label", "Kiểu đo của thước");
  const NUT = [
    ["vuong", "Vuông góc", "Đầu thứ hai: khoảng vuông góc từ điểm thứ nhất xuống mặt / cạnh bấm sau (phím Shift)"],
    ["giua", "Ngắn nhất giữa hai mặt/cạnh", "Khoảng ngắn nhất giữa hai mặt / cạnh đã chọn, bỏ qua chỗ bấm (phím Alt / Option)"],
    ["mat", "Chọn mặt", "Chỉ chọn mặt, không hít đỉnh hay cạnh"],
  ];
  for (const [ma, ten, tit] of NUT) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = ten; b.title = tit; b.dataset.kieu = ma; b.setAttribute("aria-pressed", "false");
    b.onclick = () => {
      bat[ma] = !bat[ma];
      if (ma === "vuong" && bat.vuong) bat.giua = false;
      if (ma === "giua" && bat.giua) bat.vuong = false;
      veNut(); b.blur();
    };
    hang.append(b);
  }
  function veNut() { for (const b of hang.children) b.setAttribute("aria-pressed", String(!!bat[b.dataset.kieu])); }
  const bang = C.$("bang-do");
  if (bang) bang.prepend(hang);

  /* ── nối với xem.js ── */
  const chiMat = () => bat.mat;
  const dung = () => { F1 = null; veSang("hov", null); veSang("da", null); };
  const sk = (e, alt) => ({ clientX: e.clientX, clientY: e.clientY, pointerType: e.pointerType, altKey: alt });
  const api = {
    bat, chiMat, vungMat, vuong, giua, dacDiem,
    dat() { dung(); veNut(); },
    xong() { dung(); },
    dau: () => F1,
    sang: () => ({ hov: !!sang.hov, da: !!sang.da }),             // phép thử: mặt đang sáng
    /* con trỏ trước điểm thứ nhất: mặt dưới con trỏ sáng lên (nếu không hít đỉnh / cạnh) */
    re1(e, h, k) { veSang("hov", k && h ? dacDiem(k, h) : null, MAU_MAT); },
    /* cú bấm thứ nhất: nhớ đặc điểm, mặt đã chọn sáng màu cam tới khi xong thước */
    datDau(h, k) { F1 = dacDiem(k, h); veSang("hov", null); veSang("da", F1, MAU_DA); return F1; },
    /* đầu thứ hai theo con trỏ. Trả null nếu không có gì dưới con trỏ (xem.js rơi về đo thẳng theo trục khi Shift). */
    cuoi(e, h, diemDo) {
      if (!h) { veSang("hov", null); return null; }
      const alt = e.altKey || bat.giua, sh = !alt && (e.shiftKey || bat.vuong);
      const k = batDiem(sk(e, false), h), f2 = dacDiem(k, h);
      veSang("hov", f2, MAU_MAT);
      if (alt) {
        const r = giua(F1 || { loai: "diem", p: diemDo }, f2);
        if (r) return { p: r.B, p1: r.A, truc: -3, canh: f2.loai === "canh" ? { a: f2.a, b: f2.b, giao: f2.giao } : null, nhan: r.ch, ch: r.ch };
      } else if (sh) {
        const r = vuong(diemDo, f2);
        if (r) return { p: r.B, p1: r.A, truc: -3, canh: f2.loai === "canh" ? { a: f2.a, b: f2.b, giao: f2.giao } : null, nhan: r.ch, ch: r.ch };
        if (f2.loai === "diem") return { p: f2.p, truc: -1, canh: null };
      }
      return { p: k.p, truc: -1, canh: k.canh };
    },
  };
  window.__THUOC_MAT = api;                                   // phép thử thu_thuoc.mjs
  return api;
}
