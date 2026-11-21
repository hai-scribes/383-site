/* CHẠY + BÁO CHUYỂN ĐỘNG CÔNG TẮC trên trình xem — nửa three.js của web/chuyen_dong.js (nửa toán thuần, có máy thử
   kiem_chuyen_dong.mjs). Không đụng vật thật ngoài việc ẩn tạm: mọi thứ chạy trên BẢN TẠM thêm vào cảnh rồi gỡ.

   chayChuyen({ scene, tu, den, nhan, veLai, giay?, tay? }) → Promise   (tay = {} ⇒ không tự chạy, tay.dat(k) · tay.ket())
     tu  = mesh đang hiện ở thế cũ, den = mesh sẽ hiện ở thế mới (đã có matrixWorld). Ẩn `tu`, dựng bản tạm từng cặp
     (khối rời của một mesh — tủ hai cánh — mỗi khối một bản tạm), chạy theo đường vít / trượt / giãn của chuyen_dong.js,
     bộ phận chỉ có ở một thế thì mờ dần ra / vào. Xong: trả `tu` về như cũ rồi resolve — NGƯỜI GỌI đổi lớp sang thế mới
     ngay trong cùng nhịp (trước lần vẽ kế), không nháy. Không bộ phận nào đi (phương án màu) ⇒ resolve ngay.

   taoDuongBao({ tu, den, nhan, mau? }) → { nhom: THREE.Group, nhip(giay), bo() } | null
     ĐƯỜNG BÁO TRƯỚC KHI BẤM (chủ nhà 2026-10-21: «nút bấm hiện trong 3D thì đi kèm đường báo — biết bấm thì cái gì xảy ra»):
     cung nét đứt (bản lề) hoặc mũi tên nét đứt (trượt, giãn), nét chạy về phía đích như Jig, đầu mũi tên đặc; một lớp mờ
     vẽ xuyên tường để thấy cả khi bị che. Người gọi thêm `nhom` vào cảnh khi nút hiện, gọi nhip(t) mỗi khung đang hiện,
     bo() khi nút ẩn hoặc lúc bắt đầu chạy (đường báo chỉ có TRƯỚC khi chạy). */
import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { giaiChuyenDong, maTran, duongBao } from "./chuyen_dong.js";

const MAU = 0x2563eb;                                  // cùng màu viền cụm đang chọn (VIEN_CUM)

/* ── hình học thế giới của mesh, nhớ theo (mesh, ma trận) — bấm qua bấm lại không tính lại ── */
const NHO = new WeakMap();
function theGioi(o) {
  o.updateWorldMatrix(true, false);
  const khoa = o.matrixWorld.elements.join(",");
  const cu = NHO.get(o);
  if (cu && cu.khoa === khoa) return cu;
  const p = o.geometry.attributes.position, M = o.matrixWorld.elements, P = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    P[3 * i] = M[0] * x + M[4] * y + M[8] * z + M[12];
    P[3 * i + 1] = M[1] * x + M[5] * y + M[9] * z + M[13];
    P[3 * i + 2] = M[2] * x + M[6] * y + M[10] * z + M[14];
  }
  const I = o.geometry.index ? Uint32Array.from(o.geometry.index.array) : null;
  const ra = { khoa, P, I };
  NHO.set(o, ra);
  return ra;
}
const vao = (ds) => ds.map((o) => { const g = theGioi(o); return { id: o.uuid, ten: o.userData.ten || o.name, P: g.P, I: g.I, o }; });
const KQ = new Map();                                  // nhớ lời giải theo bộ mesh hai bên
function giai(tu, den, nhan) {
  const khoa = tu.map((o) => o.uuid).join() + ">" + den.map((o) => o.uuid).join();
  const A = vao(tu), B = vao(den);
  const kq = KQ.get(khoa);
  if (kq && kq.A.every((a, i) => a.P === A[i].P) && kq.B.every((b, i) => b.P === B[i].P)) return kq;
  const r = { A, B, kq: giaiChuyenDong(A, B, { nhan }) };
  KQ.set(khoa, r);
  return r;
}

/* bản tạm: hình học đã nhân ma trận thế giới (ma trận bản tạm = ma trận chuyển động, thuần thế giới), một khối hoặc cả mesh */
function banTam(o, khoi) {
  const g = o.geometry.clone();
  g.applyMatrix4(o.matrixWorld);
  let hinh = g;
  if (khoi) {
    const giu = new Uint8Array(g.attributes.position.count);
    for (const v of khoi) giu[v] = 1;
    const ix = g.index ? g.index.array : Uint32Array.from({ length: g.attributes.position.count }, (_, i) => i);
    const moi = [];
    for (let t = 0; t < ix.length; t += 3) if (giu[ix[t]]) moi.push(ix[t], ix[t + 1], ix[t + 2]);
    hinh.setIndex(moi);
  }
  const m = new THREE.Mesh(hinh, o.material);
  m.matrixAutoUpdate = false;
  m.castShadow = o.castShadow; m.receiveShadow = o.receiveShadow;
  m.renderOrder = o.renderOrder;
  m.layers.mask = o.layers.mask;                       // cùng lớp camera ⇒ viền cụm chọn / rê đi theo bản tạm khi chạy
  m.raycast = () => {};                                // bản tạm không bấm chọn được
  m.userData.banTam = true;
  // để lượt đếm nắp cắt của mặt nạ chọn biết bản tạm có phải khối kín không (rèm, kính… ⇒ không đếm)
  for (const k of ["kin", "ma", "vat_lieu"]) if (k in o.userData) m.userData[k] = o.userData[k];
  return m;
}
function mo(m, a) {                                    // bản tạm mờ dần: chép vật liệu một lần, chỉ đổi độ đục
  if (!m.userData.vlMo) {
    const v = m.material.clone();
    v.transparent = true; v.depthWrite = false;
    m.userData.vlMo = v; m.userData.anpha = m.material.opacity ?? 1;
    m.material = v;
  }
  m.material.opacity = m.userData.anpha * a;
}

/* nhịp chạy theo quãng: quay theo góc × bán kính quét, trượt theo quãng — cửa 90° ≈ 0,9 s, cánh lùa 0,8 m ≈ 0,8 s */
function thoiGian(kq, A) {
  let xa = 0;
  const T = new Map(A.map((a) => [a.id, a]));
  for (const c0 of kq.cap) {
    // cụm cưỡi trên cụm / cánh gấp theo cánh đầu: nhịp theo phép của cụm mang nó, đo trên CHÍNH bộ phận này (phép `sau` không
    // mang `tu` — đọc T.get(undefined) làm hỏng lượt chạy, bản tạm nằm lại trong cảnh thành bộ cánh thứ hai, chủ nhà 3D #111)
    const c = c0.kieu === "ghep" ? { ...c0.sau, tu: c0.tu } : c0;
    if (c.kieu === "quay") {
      const P = T.get(c.tu).P;
      let r = 0;
      for (let i = 0; i < P.length; i += 3) {
        const v = [P[i] - c.tam[0], P[i + 1] - c.tam[1], P[i + 2] - c.tam[2]];
        const d = v[0] * c.truc[0] + v[1] * c.truc[1] + v[2] * c.truc[2];
        r = Math.max(r, Math.hypot(v[0] - c.truc[0] * d, v[1] - c.truc[1] * d, v[2] - c.truc[2] * d));
      }
      xa = Math.max(xa, r * c.goc);
    } else if (c.kieu === "truot") xa = Math.max(xa, Math.hypot(...c.doi));
    else if (c.kieu === "gian") xa = Math.max(xa, Math.hypot(c.co1[0] - c.co0[0], c.co1[1] - c.co0[1], c.co1[2] - c.co0[2]),
      Math.hypot(c.lo1[0] - c.lo0[0], c.lo1[1] - c.lo0[1], c.lo1[2] - c.lo0[2]));
  }
  return Math.max(0.45, Math.min(1.6, 0.35 + xa * 0.75)) / TOC_DO;
}
const TOC_DO = 2;                                      // chủ nhà 2026-10-24: chuyển thế nhanh gấp đôi
// êm hai đầu (smootherstep): khởi động nhẹ, vào chỗ chắc — gần cách Jig cho bộ phận vào vị trí
const em = (k) => k * k * k * (k * (k * 6 - 15) + 10);

let DANG = null;                                       // lượt mới nhất (phép thử)
export function chayChuyen({ scene, tu, den, nhan = [], veLai = () => {}, giay = null, tay = false }) {
  // nhiều công tắc chạy cùng lúc được («Mở hết» hai cánh); bấm lại CÙNG công tắc thì trình xem tự cho lượt cũ tới đích trước
  const { A, B, kq } = giai(tu, den, nhan);
  if (kq.dongYen || (!kq.cap.some((c) => c.kieu !== "yen") && !kq.ra.length && !kq.vao.length)) return Promise.resolve();
  const TA = new Map(A.map((a) => [a.id, a.o])), TB = new Map(B.map((b) => [b.id, b.o]));
  const nhom = new THREE.Group();
  nhom.name = "chuyển thế (bản tạm)";
  const chay = [];
  for (const c of kq.cap) {
    const m = c.kieu === "gian" || c.theo ? banTam(TA.get(c.tu)) : banTam(TA.get(c.tu), c.khoiTu);
    nhom.add(m);
    chay.push({ m, c });
  }
  const ra = kq.ra.map((id) => { const m = banTam(TA.get(id)); nhom.add(m); return m; });
  const vo = kq.vao.map((id) => { const m = banTam(TB.get(id)); nhom.add(m); mo(m, 0); return m; });
  const an = tu.filter((o) => o.visible);
  for (const o of an) o.visible = false;
  scene.add(nhom);
  const ms = (giay ?? thoiGian(kq, A)) * 1000, bd = performance.now();
  let ketNgay = null;
  const p = new Promise((xong) => {
    let raf = 0, roi = false;
    const ket = () => {
      if (roi) return; roi = true;
      cancelAnimationFrame(raf);
      scene.remove(nhom);
      nhom.traverse((x) => { if (x.isMesh) { x.geometry.dispose(); x.userData.vlMo?.dispose(); } });
      // trả vật nguồn về; người gọi đổi lớp + TÍNH LẠI hiện/ẩn ngay sau đây, cùng nhịp (thế đã đổi giữa chừng cũng đúng)
      for (const o of an) o.visible = true;
      if (DANG && DANG.xongNgay === ket) DANG = null;
      xong();
      veLai(200);
    };
    const dat = (k) => {
      const e = em(k);
      for (const { m, c } of chay) { m.matrix.fromArray(maTran(c, e)); m.matrixWorldNeedsUpdate = true; }   // matrixAutoUpdate tắt ⇒ phải báo
      for (const m of ra) mo(m, 1 - Math.min(1, k * 1.6));       // ra nhanh hơn vào: không lúc nào hai bản chồng đậm
      for (const m of vo) mo(m, Math.max(0, k * 1.6 - 0.6));
      veLai(60);
    };
    DANG = { xongNgay: ket };
    ketNgay = ket;
    // tay: không tự chạy — trả tay cầm { dat(k), ket() } (kéo thanh trượt, phép thử chụp đúng k); Promise vẫn resolve ở ket()
    if (tay) { dat(0); tay.dat = dat; tay.ket = ket; return; }   // (ketNgay đã gán ở trên)
    const buoc = (now) => {
      const k = Math.min(1, (now - bd) / ms);
      dat(k);
      if (k < 1) raf = requestAnimationFrame(buoc); else ket();
    };
    raf = requestAnimationFrame(buoc);
  });
  p.huy = () => ketNgay?.();                           // tới đích ngay (gỡ bản tạm, trả vật nguồn) — Promise vẫn resolve
  return p;
}

/* ── đường báo ── */
const MAT_LAI = [];                                    // vật liệu nét cần biết cỡ khung vẽ
export function capNhatCo(w, h) { for (const m of MAT_LAI) m.resolution.set(w, h); }

export function taoDuongBao({ tu, den, nhan = [], mau = MAU, coKhung = null }) {
  const { kq } = giai(tu, den, nhan);
  const T = new Map(vao(tu).map((a) => [a.id, a.P]));
  const ds = duongBao(kq, (id) => T.get(id));
  if (!ds.length) return null;
  const nhom = new THREE.Group();
  nhom.name = "đường báo chuyển thế";
  nhom.renderOrder = 10;
  const vl = [];
  const co = coKhung || new THREE.Vector2(innerWidth * devicePixelRatio, innerHeight * devicePixelRatio);
  for (const d of ds) {
    // dài đường ⇒ cỡ đầu mũi tên (3–7 cm — chủ nhà 2026-10-30 «arrow 50%», nét 80%) và chu kỳ nét
    let dai = 0;
    for (let i = 1; i < d.diem.length; i++) dai += Math.hypot(...[0, 1, 2].map((j) => d.diem[i][j] - d.diem[i - 1][j]));
    const dau = Math.max(0.03, Math.min(0.07, dai * 0.06));
    // nét dừng trước đầu mũi tên
    const pts = [];
    let di = 0;
    for (let i = 0; i < d.diem.length; i++) {
      if (i) di += Math.hypot(...[0, 1, 2].map((j) => d.diem[i][j] - d.diem[i - 1][j]));
      if (di > dai - dau * 0.9) break;
      pts.push(...d.diem[i]);
    }
    if (pts.length < 6) continue;
    const g = new LineGeometry();
    g.setPositions(pts);
    for (const [xuyen, anpha, rong] of [[true, 0.35, 2], [false, 1, 2.8]]) {
      const m = new LineMaterial({ color: mau, linewidth: rong, dashed: true, dashSize: dai / 14, gapSize: dai / 28,
        transparent: true, opacity: anpha, depthTest: !xuyen, depthWrite: false, worldUnits: false });
      m.resolution.copy(co);
      m.userData.xuyen = xuyen; m.userData.anpha = anpha;
      MAT_LAI.push(m); vl.push(m);
      const l = new Line2(g, m);
      l.computeLineDistances();
      l.renderOrder = xuyen ? 10 : 11;
      l.raycast = () => {};
      nhom.add(l);
    }
    // đầu mũi tên: nón đặc, mũi tại `dau`, trục theo tiếp tuyến cuối đường
    const h = new THREE.Vector3(...d.huong).normalize();
    const non = new THREE.Mesh(new THREE.ConeGeometry(dau * 0.42, dau, 16),
      new THREE.MeshBasicMaterial({ color: mau, depthTest: true, transparent: true, opacity: 1 }));
    non.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), h);
    non.position.set(...d.dau).addScaledVector(h, -dau / 2);
    non.renderOrder = 11; non.raycast = () => {};
    const nonMo = non.clone();
    nonMo.material = non.material.clone(); nonMo.material.depthTest = false; nonMo.material.opacity = 0.35;
    nonMo.material.userData.xuyen = true; nonMo.material.userData.anpha = 0.35;
    nonMo.renderOrder = 10;
    nhom.add(non, nonMo);
    vl.push(non.material, nonMo.material);
  }
  if (!nhom.children.length) return null;
  return {
    nhom,
    // nét chạy về phía đích: chu kỳ một nét + một khoảng mỗi 0,6 s
    nhip(giay) { for (const m of vl) if (m.isLineMaterial) m.dashOffset = -((giay / 0.6) % 1) * (m.dashSize + m.gapSize); },
    // lớp vẽ xuyên đậm dần theo độ tập trung (0…1): đang tập trung thì vật che đã mờ, cụm chọn soi xuyên ⇒ đường báo đậm như nó
    xuyen(k) { for (const m of vl) if (m.userData.xuyen) m.opacity = m.userData.anpha + (1 - m.userData.anpha) * Math.max(0, Math.min(1, k)); },
    bo() {
      nhom.parent?.remove(nhom);
      nhom.traverse((x) => { if (x.geometry) x.geometry.dispose(); });
      for (const m of vl) { m.dispose(); const i = MAT_LAI.indexOf(m); if (i >= 0) MAT_LAI.splice(i, 1); }
    },
  };
}
