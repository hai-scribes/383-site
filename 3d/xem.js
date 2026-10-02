/* ==========================================================================
   TRÌNH XEM MÔ HÌNH 3D — 383 Hải Phòng
   ==========================================================================
   Chỉ XEM và GHI CHÚ — không sửa mô hình. Mô hình dựng bằng script
   (tools/3d/mo_hinh/*.py → dung.py → mo-hinh/<ten>.glb); ghi chú chủ nhà để lại ở
   đây được đọc bằng tools/3d/gop_y.py rồi sửa vào script, dựng lại.

   HỆ TOẠ ĐỘ: mọi con số hiện ra và mọi con số lưu vào ghi chú là toạ độ MÔ HÌNH
   (+x = Tây Nam, −y = mặt tiền Tây Bắc, z = cao độ tuyệt đối, mét). glTF là y-up,
   nên file .glb có một nút gốc xoay −90° quanh X; đổi qua lại bằng ma trận nút đó.

   GHI CHÚ neo vào MÃ VẬT THỂ (extras.id), không vào toạ độ. Mỗi ghi chú mang thêm
   góc nhìn "c=cam;t=tâm;p=điểm bấm" để người sửa thấy đúng thứ chủ nhà đã thấy.
   Kho: bảng binh_luan của sổ bình luận site (trang = "3d:<mã mô hình>").

   Điều khiển từ ngoài (chụp ảnh tự động): window.XEM — xem cuối file.
   ========================================================================== */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

performance.mark("xem:module");                  // mốc tải trang — do_hieu_nang.mjs đọc các mốc «xem:*»

/* MA TRẬN CHỈ TÍNH LẠI KHI ĐỔI (2026-09-25). Object3D.updateMatrixWorld của three dựng lại ma trận của MỌI vật MỖI lần vẽ
   (compose), và vì gốc cũng dựng lại nên cờ «ép» lan xuống ⇒ nhân ma trận thế giới cho mọi vật. ~5.600 vật (lưới + viền)
   × 2 lượt vẽ (nét viền) ⇒ ~40 % thời gian JS mỗi khung khi xoay (đo: updateMatrixWorld + multiplyMatrices 1,6 s / 4 s).
   Bản thay dưới đây CHO CÙNG KẾT QUẢ: vật matrixAutoUpdate chỉ compose khi vị trí / quay / tỉ lệ khác lần trước; không
   compose thì không bật cờ, con không bị ép. Vật đứng yên còn lại vài phép so. Ngoại lệ duy nhất so với bản gốc: mã sửa
   thẳng `o.matrix` mà vẫn để matrixAutoUpdate = true — bản gốc ghi đè sửa ấy mỗi khung, bản này giữ; không chỗ nào làm
   vậy (sửa ma trận tay thì tắt matrixAutoUpdate như three dặn). */
{
  const P = THREE.Object3D.prototype;
  // compose lại ma trận riêng CHỈ KHI vị trí / quay / tỉ lệ khác lần compose trước (bộ nhớ đệm __mt trên từng vật)
  const composeNeuDoi = (o) => {
    const p = o.position, q = o.quaternion, s = o.scale;
    let c = o.__mt;
    if (c === undefined) c = o.__mt = new Float64Array(10).fill(NaN);
    if (c[0] === p.x && c[1] === p.y && c[2] === p.z && c[3] === q.x && c[4] === q.y && c[5] === q.z && c[6] === q.w
      && c[7] === s.x && c[8] === s.y && c[9] === s.z) return;
    o.updateMatrix();
    c[0] = p.x; c[1] = p.y; c[2] = p.z; c[3] = q.x; c[4] = q.y; c[5] = q.z; c[6] = q.w; c[7] = s.x; c[8] = s.y; c[9] = s.z;
  };
  P.updateMatrixWorld = function (force) {
    if (this.matrixAutoUpdate) composeNeuDoi(this);
    if (this.matrixWorldNeedsUpdate || force) {
      if (this.matrixWorldAutoUpdate === true) {
        if (this.parent === null) this.matrixWorld.copy(this.matrix);
        else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
      }
      this.matrixWorldNeedsUpdate = false;
      force = true;
    }
    const ch = this.children;
    for (let i = 0, l = ch.length; i < l; i++) { const c = ch[i]; if (c.__dungMaTranCha !== true) c.updateMatrixWorld(force); }
  };
  // localToWorld / worldToLocal (ghim, la bàn — mỗi khung) đi qua đây: bản gốc compose MỌI tổ tiên tới Scene, bật cờ của
  // Scene ⇒ lượt updateMatrixWorld kế tiếp ép tính lại cả cây. Cùng cách: chỉ compose khi đổi.
  P.updateWorldMatrix = function (updateParents, updateChildren) {
    const parent = this.parent;
    if (updateParents === true && parent !== null) parent.updateWorldMatrix(true, false);
    if (this.matrixAutoUpdate) composeNeuDoi(this);
    if (this.matrixWorldAutoUpdate === true) {
      if (parent === null) this.matrixWorld.copy(this.matrix);
      else this.matrixWorld.multiplyMatrices(parent.matrixWorld, this.matrix);
    }
    if (updateChildren === true) {
      const ch = this.children;
      for (let i = 0, l = ch.length; i < l; i++) ch[i].updateWorldMatrix(false, true);
    }
  };
}
const Q = new URLSearchParams(location.search);
const MA = Q.get("m") || document.body.dataset.moHinh || "nha";          // không ?m= ⇒ cả nhà (chủ nhà 2026-09-23)
const TRANG = "3d:" + MA;
const $ = (id) => document.getElementById(id);
const V3 = THREE.Vector3;
if (Q.get("chup")) document.body.classList.add("chup");     // chụp ảnh: chỉ còn khung vẽ

/* ── dựng cảnh ─────────────────────────────────────────────────────────── */
const canvas = $("c");
/* preserveDrawingBuffer TẮT: không ai đọc điểm ảnh của khung vẽ (chup.mjs chụp cả trang) — giữ bộ đệm chỉ tốn GPU */
const VIEN_NET = Q.get("thuc") !== "0" && Q.get("vien") !== "0";   // nét viền theo độ sâu — xem NET bên dưới
/* ĐỘ SÂU LOGARIT — TẮT mặc định (soát hiệu năng 2026-09-27 trên M3 Pro thật): gl_FragDepth ở mọi shader phá loại mặt
   khuất sớm của GPU Apple ⇒ thời gian GPU mỗi khung ×3 (10 → 31 ms cả nhà). Nhoè «chăn L2 qua tôn» đã hết nhờ mặt phẳng
   gần theo mô hình (datMatGan) — đo trên GPU thật: 0 điểm lộ, y như có logarit. ?logz=1 bật lại để so sánh. */
const LOG_Z = Q.get("logz") === "1";
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: true, powerPreference: "high-performance", logarithmicDepthBuffer: LOG_Z });   // stencil: tô mặt cắt
/* ĐỘ PHÂN GIẢI tối đa 1,5 × (2026-09-25; trước là 2): màn Retina ở 2× nghĩa là bộ đệm nét viền (HalfFloat, MSAA 4) + khung vẽ
   (MSAA 4) ~260 MB GPU và GPU làm gấp ~1,8 lần điểm ảnh. Đo khi xoay (1400×900, Retina): 1,5× ⇒ bộ nhớ GPU 388 → 258 MB, thời
   gian GPU/khung giảm ~3 lần. Cạnh vẫn mịn nhờ MSAA 4. ?dpr=2: nét tối đa (chụp ảnh, xem gần) · ?dpr=1: máy yếu. */
renderer.setPixelRatio(Math.min(window.devicePixelRatio, +Q.get("dpr") || 1.5));
/* LƯỢT TRUYỀN SÁNG (gạch kính — vật liệu DUY NHẤT dùng transmission, VL_GACH_KINH): có nó trong khung là three vẽ LẠI mọi
   vật đục vào một bộ đệm cỡ khung vẽ (HalfFloat, MSAA, mipmap) để kính «nhìn xuyên nhoè». Kính vốn để NHOÈ ⇒ nửa độ phân
   giải không mất gì thấy được, còn 1/4 điểm ảnh + 1/4 bộ nhớ. ?truyen=1: đủ độ phân giải (so sánh). */
renderer.transmissionResolutionScale = Q.get("truyen") === "1" ? 1 : 0.5;

/* ── VẼ KHI CẦN (2026-09-24): trước đây vẽ lại 60 lần/giây kể cả khi đứng yên — ~2.500 vật + ~2.500 nét
   viền mỗi khung, nóng máy, tốn pin. Nay chỉ vẽ khi có gì đổi: camera còn trôi, người dùng thao tác,
   dữ liệu vừa về, hẹn giờ vừa chạy, lớp hạt (nhiệt · gió) đang chạy. Chỗ nào đổi cảnh NGOÀI các đường ấy
   thì gọi globalThis.VE_LAI(ms) — vẽ lại (và giữ vẽ thêm ms mili giây). Lưới an toàn: đứng yên vẫn vẽ một
   khung mỗi giây, nên có sót đường nào thì hình chậm tối đa 1 giây chứ không đứng hẳn. */
let canVe = true, veToi = 0;
const VE_LIEN_TUC = Q.get("ve") === "lien_tuc";          // ?ve=lien_tuc: vẽ mọi khung như cũ (so sánh / dò lỗi)
const VE_AN_TOAN = Q.get("ve") === "thu" ? Infinity : 1000;  // ?ve=thu: bỏ lưới an toàn 1s — phép thử out/t_ve_khi_can.mjs bắt hình cũ
/* THANH TRƯỢT: phần đã kéo tô màu nhấn (xem.css «THANH TRƯỢT KIỂU iOS») đọc biến --p. Giữ --p khớp giá trị ở mọi đường:
   người kéo (input), mã đặt .value, thanh trượt mới sinh (phân tích, xem rời). */
{
  const pct = (el) => { const lo = +el.min || 0, hi = el.max === "" ? 100 : +el.max, v = +el.value;
    el.style.setProperty("--p", (hi > lo ? ((v - lo) / (hi - lo)) * 100 : 0) + "%"); };
  const moTa = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  Object.defineProperty(HTMLInputElement.prototype, "value", { ...moTa,
    set(v) { moTa.set.call(this, v); if (this.type === "range") pct(this); } });
  addEventListener("input", (e) => { if (e.target.type === "range") pct(e.target); }, true);
  const tatCa = (goc) => goc.querySelectorAll?.('input[type="range"]').forEach(pct);
  tatCa(document);
  new MutationObserver((ds) => { for (const d of ds) for (const n of d.addedNodes) if (n.nodeType === 1) { if (n.type === "range") pct(n); else tatCa(n); }
    for (const d of ds) if (d.type === "attributes" && d.target.type === "range") pct(d.target); })
    .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["min", "max", "value"] });
}
/* CHẾ ĐỘ CHỈ XEM (bản đăng trên site — dong_goi_site.py gắn <body class="chi-xem">): xoay · dời · phóng · góc nhìn sẵn ·
   mặt cắt kéo được. Không chọn vật, không thước, không ghi chú, không phím công cụ. Nhúng trong trang việc (body.nhung)
   thì theo luật nhúng như cũ. */
const CHI_XEM = () => document.body.classList.contains("chi-xem") && !document.body.classList.contains("nhung");
function veLai(ms = 0) { canVe = true; if (ms) veToi = Math.max(veToi, performance.now() + ms); }
globalThis.VE_LAI = veLai;
for (const ev of ["pointerdown", "pointerup", "click", "dblclick", "wheel", "keydown", "keyup", "input", "change", "contextmenu"])
  addEventListener(ev, () => veLai(300), { capture: true, passive: true });
// rê chuột: chỉ khi trên khung vẽ hoặc đang kéo — rê trên bảng bên không cần vẽ lại cảnh
addEventListener("pointermove", (e) => { if (e.buttons || e.target === canvas || canvas.parentElement.contains(e.target)) veLai(150); }, { capture: true, passive: true });
addEventListener("resize", () => veLai(200));
{ // dữ liệu về (fetch) và hẹn giờ chạy xong đều có thể đổi cảnh ⇒ vẽ lại một khung
  const f0 = window.fetch.bind(window);
  window.fetch = (...a) => { const p = f0(...a); p.then(() => setTimeout(veLai, 0), () => {}); return p; };
  const boc = (g) => (fn, ...r) => g((...a) => { try { return typeof fn === "function" ? fn(...a) : undefined; } finally { canVe = true; } }, ...r);
  window.setTimeout = boc(window.setTimeout.bind(window));
  if (VE_AN_TOAN !== Infinity) window.setInterval = boc(window.setInterval.bind(window));   // ?ve=thu: lượt hỏi 4s không được che hình cũ
  THREE.DefaultLoadingManager.onLoad = () => veLai(200);        // ảnh vân vật liệu giải mã xong
}
renderer.localClippingEnabled = false;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf7f6f2);   // trắng sữa (chủ nhà 2026-09-27: nền be cũ #efeae0 lẫn với tường nhà)
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 500);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.screenSpacePanning = true;
// Cuộn sát tâm làm bán kính xoay → 0, và pan của OrbitControls cũng → 0: kéo như bị kẹt.
controls.minDistance = 0.5;
controls.addEventListener("start", () => {
  controls.panSpeed = Math.max(1, 2 / Math.max(camera.position.distanceTo(controls.target), controls.minDistance));
});
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
/* môi trường phản chiếu: không có nó, vật kim loại (inox, thép, lớp bạc, nhôm) chỉ phản chiếu «khoảng đen» và
   hiện ra đen — chủ nhà hỏi lớp bạc «màu có đúng như thật không» (ghi chú mái #33)
   — CHỈ gắn cho vật liệu kim loại (metalness ≥ 0,5), vật liệu khác giữ nguyên ánh sáng cũ */
const MOI_TRUONG = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
/* NHÌN NHƯ THẬT (2026-09-23, phiên điện — home-23 đồng ý): vật liệu có vân (ảnh web/vat-lieu, xem khung/vat_lieu.py `van`)
   + môi trường phản chiếu cho MỌI vật liệu (gạch, gỗ, sơn bắt ánh sáng như thật) + nén tông AgX + lọc dị hướng cho vân.
   Mặt có vân không vẽ viền cạnh (viền là thứ làm lộ mạch nối các khối tường). ?thuc=0 trả lại cách nhìn phẳng cũ. */
const THUC = Q.get("thuc") !== "0";
const DI_HUONG = Math.min(4, renderer.capabilities.getMaxAnisotropy());   // 4 đủ cho sàn nhìn xiên; 16 tốn băng thông GPU mà mắt khó thấy
/* MÀU THẬT (chủ nhà 2026-09-27): nén tông TRUNG TÍNH (Khronos PBR Neutral) thay AgX — AgX làm mọi màu trắng thành xám
   nhạt (tôn trắng hệ số 0,84 hiện ~RGB 218, trần thạch cao 237); Neutral giữ đúng màu gốc của vật liệu tới vùng sáng. */
if (THUC) {
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  scene.environment = MOI_TRUONG;
  scene.environmentIntensity = 0.5;
}
/* ánh sáng XEM (nắng tắt): đèn chính theo camera lệch lên cao + đèn phụ ngay sau camera ⇒ MỌI mặt đang nhìn thấy đều
   sáng (chủ nhà 2026-09-27: «không bật nắng thì mọi mặt phải sáng» — tôn trắng ba mặt từng xám tối ở mặt khuất đèn) */
const DEN_MD = { troi: THUC ? 1.1 : 1.6, nang: 1.5, phu: 0.9 };
const troi = new THREE.HemisphereLight(0xfbf7ee, 0x8a8478, DEN_MD.troi);
scene.add(troi);
const nang = new THREE.DirectionalLight(0xffffff, DEN_MD.nang);
scene.add(nang, nang.target);
const nang2 = new THREE.DirectionalLight(0xffffff, DEN_MD.phu);
scene.add(nang2);

/* LƯỚI CÔN TRÙNG NHƯ THẬT (chủ nhà 3D #713, 2026-09-29): tấm lưới inox 316 18×16 sợi 0,23 là tấm mỏng 1mm màu xám
   phẳng trong .glb — nhìn như một tấm tôn mờ. Ở đây phủ lên nó một ảnh SỢI ĐAN đúng bước thật (18 sợi/inch ngang ≈ 1,41mm,
   16 sợi/inch đứng ≈ 1,59mm; sợi 0,23mm), nền trong suốt: gần thì thấy từng sợi đan trên-dưới, xa thì mipmap trộn thành
   màn xám trong ~70% như lưới thật. Toạ độ vân chiếu theo mặt phẳng tấm (trục mỏng nhất của hộp bao), đơn vị mét thật. */
const LUOI_O = 8, LUOI_PX = 16;                                  // 8×8 ô mỗi ảnh lặp, 16px mỗi ô
const LUOI_BUOC = [0.0254 / 18, 0.0254 / 16];
let VL_LUOI = null;
function vlLuoi() {
  if (VL_LUOI) return VL_LUOI;
  const n = LUOI_O * LUOI_PX, cv = document.createElement("canvas");
  cv.width = cv.height = n;
  const g = cv.getContext("2d");
  const soi = Math.max(2, Math.round((0.23 / 1.41) * LUOI_PX * 1.6));   // sợi hơi đậm hơn thật cho khỏi nhoè mất ở mipmap
  const ve = (doc, k, tren) => {                                   // một đoạn sợi giữa hai giao điểm, sáng ở đoạn nằm TRÊN
    const t = k * LUOI_PX, a = doc ? [0, t] : [t, 0];
    for (let j = 0; j < LUOI_O; j++) {
      const len = ((j + k) % 2 === 0) === tren;
      g.fillStyle = len ? "rgba(196,199,202,1)" : "rgba(118,121,124,1)";
      if (doc) g.fillRect(j * LUOI_PX, t - soi / 2, LUOI_PX, soi); else g.fillRect(t - soi / 2, j * LUOI_PX, soi, LUOI_PX);
    }
    return a;
  };
  g.clearRect(0, 0, n, n);
  for (let k = 0; k < LUOI_O; k++) ve(false, k + 0.5, false);
  for (let k = 0; k < LUOI_O; k++) ve(true, k + 0.5, true);
  const tx = new THREE.CanvasTexture(cv);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = DI_HUONG;
  VL_LUOI = new THREE.MeshStandardMaterial({ map: tx, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    metalness: 0.6, roughness: 0.4, envMapIntensity: 0.6, forceSinglePass: true, name: "Lưới inox 316 18×16" });
  VL_LUOI.userData = { khoa: "luoi" };
  return VL_LUOI;
}
function ganLuoiThat(o) {
  const hg = o.geometry;
  if (!hg.attributes.position) return;
  hg.computeBoundingBox();
  const s = hg.boundingBox.getSize(new THREE.Vector3()).toArray();
  const mong = s.indexOf(Math.min(...s));
  // lưới nằm trong khung toạ độ mô hình (z lên — nút gốc .glb mới xoay sang y lên): tấm đứng ⇒ v theo z, sợi đứng thẳng
  const [ta, tb] = mong === 2 ? [0, 1] : [mong === 0 ? 1 : 0, 2];
  const P = hg.attributes.position, uv = new Float32Array(P.count * 2);
  for (let i = 0; i < P.count; i++) {
    uv[2 * i] = P.getComponent(i, ta) / (LUOI_O * LUOI_BUOC[0]);
    uv[2 * i + 1] = P.getComponent(i, tb) / (LUOI_O * LUOI_BUOC[1]);
  }
  hg.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  o.material = vlLuoi();
}

/* ── NẮNG THẬT theo ngày + giờ ở Đà Nẵng (chủ nhà 2026-09-27: «xem nhà màu thật lúc mấy giờ, mùa nào») ─────────────
   Tắt (mặc định): hai đèn đi theo camera như cũ — dễ đọc hình. Bật: một mặt trời THẬT đổ bóng, vị trí tính như
   tools/sim-weather/nang.mjs (Spencer 1971: xích vĩ + phương trình thời gian; 16,03°B · 108,20°Đ; giờ đồng hồ GMT+7).
   Hướng: mặt tiền (−y mô hình) nhìn ra phương vị 315° (data/elevations.yaml front_facade_azimuth_deg) ⇒ +x = 225° (Tây Nam).
   Cường độ và sắc: trời quang, nắng yếu + ấm dần khi mặt trời thấp (khối khí dày); dưới chân trời chỉ còn ánh trời.
   HIỆU NĂNG: bản đồ bóng KHÔNG vẽ lại mỗi khung (autoUpdate tắt) — chỉ khi đổi nắng, đổi vật hiện, cắt, tách, bóc,
   bước thi công (boiBong). Xoay camera không tốn thêm lượt bóng nào. Khung bóng ôm vừa hộp mô hình ⇒ 2048 điểm đủ nét. */
const NANG = { bat: false, ngay: 172, gio: 8 };
const AZ_MAT_TIEN = 315, VI_DO_DN = 16.03, KINH_DO_DN = 108.2;
const doRad = Math.PI / 180;
function viTriMatTroi(ngay, gio) {                        // → {E, N, U} đơn vị (Đông, Bắc, Lên)
  const B = (2 * Math.PI * (ngay - 1)) / 365;
  const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(B) - 0.032077 * Math.sin(B) - 0.014615 * Math.cos(2 * B) - 0.040849 * Math.sin(2 * B));
  const d = 0.006918 - 0.399912 * Math.cos(B) + 0.070257 * Math.sin(B) - 0.006758 * Math.cos(2 * B)
    + 0.000907 * Math.sin(2 * B) - 0.002697 * Math.cos(3 * B) + 0.00148 * Math.sin(3 * B);
  const w = 15 * (gio + (4 * (KINH_DO_DN - 105)) / 60 + eot / 60 - 12) * doRad, L = VI_DO_DN * doRad;
  return { E: -Math.cos(d) * Math.sin(w), N: Math.sin(d) * Math.cos(L) - Math.cos(d) * Math.sin(L) * Math.cos(w),
    U: Math.sin(L) * Math.sin(d) + Math.cos(L) * Math.cos(d) * Math.cos(w) };
}
function huongMoHinh({ E, N, U }) {                        // (Đông, Bắc, Lên) → (x, y, z) mô hình
  const a = AZ_MAT_TIEN * doRad;
  return [E * Math.sin(a - Math.PI / 2) + N * Math.cos(a - Math.PI / 2), -(E * Math.sin(a) + N * Math.cos(a)), U];
}
const TEN_HUONG = ["Bắc", "Đông Bắc", "Đông", "Đông Nam", "Nam", "Tây Nam", "Tây", "Tây Bắc"];
function moTaNang() {
  const s = viTriMatTroi(NANG.ngay, NANG.gio);
  const cao = Math.asin(Math.max(-1, Math.min(1, s.U))) / doRad, az = (Math.atan2(s.E, s.N) / doRad + 360) % 360;
  return { cao, az, huong: TEN_HUONG[Math.round(az / 45) % 8] };
}
function boiBong() { if (NANG.bat) renderer.shadowMap.needsUpdate = true; }
function datBong(bat) {                                     // bật/tắt đổ bóng trên mọi lưới (và lô gộp) — chỉ khi đổi chế độ
  if (!GOC) return;
  GOC.traverse((o) => {
    if (!(o.isMesh || o.isBatchedMesh) || o.userData.dem) return;
    const vl = o.userData.vlGoc || o.material;
    o.receiveShadow = bat;
    o.castShadow = bat && !o.userData.ma && !o.userData.khoi_phong && !(vl && (vl.transparent || vl.transmission));
  });
}
renderer.shadowMap.type = THREE.PCFShadowMap;             // PCFSoft tốn thêm ~10 ms GPU/khung trên M3 Pro, nét bóng gần như nhau
renderer.shadowMap.autoUpdate = false;
nang.shadow.mapSize.set(2048, 2048);
nang.shadow.bias = -0.0004; nang.shadow.normalBias = 0.03;
function datNang(tuy = {}) {
  Object.assign(NANG, tuy);
  NANG.ngay = Math.max(1, Math.min(365, Math.round(NANG.ngay)));
  NANG.gio = Math.max(0, Math.min(24, NANG.gio));
  const bat = NANG.bat && !!GOC;
  // cờ đổ/nhận bóng đã đặt sẵn lúc dựng (datBong(true) — không tốn gì khi bóng tắt); bật nắng chỉ bật bản đồ bóng
  if (renderer.shadowMap.enabled !== bat) { renderer.shadowMap.enabled = bat; nang.castShadow = bat; }
  if (!bat) {
    troi.color.set(0xfbf7ee); troi.groundColor.set(0x8a8478); troi.intensity = DEN_MD.troi;
    nang.color.set(0xffffff); nang.intensity = DEN_MD.nang; nang2.visible = true;
    if (THUC) scene.environmentIntensity = 0.5;
    datDauNang(false); veNutNang(); veLai(); return;
  }
  const s = viTriMatTroi(NANG.ngay, NANG.gio), sinE = s.U;
  const hop = hopTheGioi && !hopTheGioi.isEmpty() ? hopTheGioi : new THREE.Box3().setFromObject(GOC);
  const tam = hop.getCenter(new THREE.Vector3()), r = hop.getSize(new THREE.Vector3()).length() / 2;
  const [x, y, z] = huongMoHinh(s);
  const d = m2w(x, y, z).sub(m2w(0, 0, 0)).normalize();
  nang.position.copy(tam).addScaledVector(d, r * 2); nang.target.position.copy(tam);
  nang.updateMatrixWorld(); nang.target.updateMatrixWorld();
  const c = nang.shadow.camera;
  c.left = -r; c.right = r; c.top = r; c.bottom = -r; c.near = r * 0.5; c.far = r * 3.5; c.updateProjectionMatrix();
  // trời quang: nắng trực xạ yếu dần theo khối khí (≈ e^(−0,17/ sin cao)), ấm dần khi thấp; ánh trời theo độ cao
  const k = Math.max(0, Math.min(1, sinE / 0.5));              // 0 ở chân trời → 1 khi cao ≥ 30°
  const tr = sinE > 0 ? Math.exp(-0.17 / Math.max(sinE, 0.03)) : 0;
  nang.intensity = 3.2 * tr;
  nang.color.setRGB(1, 0.62 + 0.36 * k, 0.38 + 0.54 * k);
  nang2.visible = false;
  const tr_ = Math.max(0, Math.min(1, (sinE + 0.1) / 0.4));    // chạng vạng: mặt trời dưới chân trời tới −6°
  troi.color.setRGB(0.62 + 0.18 * k, 0.72 + 0.12 * k, 0.9); troi.groundColor.set(0x8a8478);
  troi.intensity = 0.12 + 0.78 * tr_;
  if (THUC) scene.environmentIntensity = 0.1 + 0.2 * tr_;
  datDauNang(sinE > -0.1, tam, d, r);
  NANG.dW = sinE > -0.1 ? d.clone() : null; lbKhoa = "";                 // la bàn vẽ lại với chấm mặt trời
  boiBong(); veNutNang(); veLai(300);
}
function veNutNang() {
  const n = $("nut-nang"); if (n) n.setAttribute("aria-pressed", String(NANG.bat));
  const b = $("bang-nang"); if (!b) return;
  b.hidden = !NANG.bat;
  if (!NANG.bat) return;
  $("nang-ngay").value = NANG.ngay; $("nang-gio").value = Math.round(NANG.gio * 4);
  const dt = new Date(Date.UTC(2026, 0, NANG.ngay));
  const g = Math.floor(NANG.gio), p = Math.round((NANG.gio - g) * 60);
  const m = moTaNang();
  $("nang-so").textContent = `${dt.getUTCDate()}/${dt.getUTCMonth() + 1} · ${String(g).padStart(2, "0")}:${String(p).padStart(2, "0")} · `
    + (m.cao > 0 ? `cao ${Math.round(m.cao)}°, từ hướng ${m.huong} (${Math.round(m.az)}°)` : "mặt trời đã lặn");
}
/* dấu MẶT TRỜI khi bật nắng: đĩa vàng cỡ cố định trên màn hình ở phía mặt trời + tia nắng tới tâm nhà */
const DAU_NANG = (() => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128;
  const g = cv.getContext("2d");
  const r = g.createRadialGradient(64, 64, 8, 64, 64, 62);
  r.addColorStop(0, "rgba(255,244,190,1)"); r.addColorStop(0.35, "rgba(255,206,64,1)"); r.addColorStop(0.5, "rgba(255,190,40,.55)"); r.addColorStop(1, "rgba(255,190,40,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  // thử độ sâu: mặt trời nằm SAU nhà (nhìn ngược nắng) thì nhà che nó, như thật — không phủ lên mô hình
  const dia = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthWrite: false, sizeAttenuation: false, toneMapped: false }));
  dia.scale.set(0.07, 0.07, 1); dia.renderOrder = 10;
  const tia = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]),
    new THREE.LineDashedMaterial({ color: 0xf2a900, dashSize: 0.4, gapSize: 0.25, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
  tia.renderOrder = 10;
  const nhom = new THREE.Group(); nhom.add(dia, tia); nhom.visible = false; nhom.name = "dấu mặt trời";
  for (const o of [dia, tia]) { o.raycast = () => {}; o.frustumCulled = false; }
  scene.add(nhom);
  return { nhom, dia, tia };
})();
function datDauNang(bat, tam, d, r) {
  DAU_NANG.nhom.visible = !!bat;
  if (NET) for (const o of DAU_NANG.nhom.children) o.layers.set(1);   // vẽ ở lượt trong suốt, sau nét độ sâu (NET khai báo sau khối này)
  if (!bat) return;
  const p = tam.clone().addScaledVector(d, r * 3);
  DAU_NANG.dia.position.copy(p);
  const a = DAU_NANG.tia.geometry.attributes.position;
  a.setXYZ(0, p.x, p.y, p.z); a.setXYZ(1, tam.x, tam.y, tam.z); a.needsUpdate = true;
  DAU_NANG.tia.geometry.computeBoundingSphere(); DAU_NANG.tia.computeLineDistances();
}
/* MẶT PHẲNG GẦN theo mô hình (chống «lớp dưới nhoè lên lớp trên» — chủ nhà 2026-09-27, tôn trên chăn L2 cách 0,5 mm):
   bộ đệm độ sâu 24 bit phân giải ~z²/(gần·2²⁴). Gần = khoảng cách/500 cho ~0,6 mm ở 20 m — thua bề dày tôn. Đứng ngoài
   hộp mô hình thì đặt gần ngay trước mặt hộp (nới 1 m cho tách lớp, vật chú thích) ⇒ chính xác hơn hàng trăm lần; đứng
   trong nhà thì về như cũ. */
const _hopGan = new THREE.Box3(), _tamGan = new THREE.Vector3(), _coGan = new THREE.Vector3();
const GAN_TD = Q.get("gan") !== "0";                // ?gan=0: tắt (so sánh)
function datMatGan() {
  if (!GAN_TD || !hopTheGioi || hopTheGioi.isEmpty()) return;
  const kc = camera.position.distanceTo(controls.target);
  _hopGan.copy(hopTheGioi).expandByScalar(1);
  const ngoai = _hopGan.distanceToPoint(camera.position);
  const gan = Math.max(kc / 500, 0.005, ngoai * 0.9);
  const xa = Math.min(500, Math.max(gan * 2, camera.position.distanceTo(_hopGan.getCenter(_tamGan)) + _hopGan.getSize(_coGan).length()));
  if (Math.abs(gan - camera.near) > camera.near * 0.02 || Math.abs(xa - camera.far) > camera.far * 0.02) {
    camera.near = gan; camera.far = xa; camera.updateProjectionMatrix();
  }
}
/* HÂM NÓNG TRƯỚC (chủ nhà: «lần đầu bấm mục chậm»): biến thể vật liệu — mờ, làm nổi, có mặt cắt (clipping đổi chương
   trình đổ bóng của MỌI vật liệu), nắp cắt — biên dịch nền (compileAsync, song song) ngay sau khi mở, không đợi lần bấm
   đầu. Rồi viền cam của vật có vân tính dần lúc rảnh. */
async function hamNong() {
  if (!GOC || !renderer.compileAsync) return;
  const t0 = performance.now();
  const hinh = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0.001, 0), new THREE.Vector3(0.001, 0, 0)]);
  const am = new THREE.Scene();
  const goc = new Set(PHAN.map((o) => o.userData.vlGoc).filter((m) => m && m.isMaterial));
  const ds = [];
  for (const m of goc) ds.push(m, vlMoCua(m));
  for (const g of NAP) ds.push(g.nap.material, g.napMo.material);
  ds.push(...Object.values(VL_DEM));
  for (const m of ds) { const o = new THREE.Mesh(hinh, m); o.frustumCulled = false; o.receiveShadow = true; am.add(o); }
  for (const m of [VIEN, VIEN_NOI, VIEN_CHON]) { const o = new THREE.LineSegments(hinh, m); o.frustumCulled = false; am.add(o); }
  // biến thể BatchedMesh (lô gộp + lô đếm nắp) — chương trình khác Mesh thường (định nghĩa batching)
  const hinhLo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0.001, 0), new THREE.Vector3(0.001, 0, 0)]);
  hinhLo.setIndex([0, 1, 2]);
  const loAm = [];
  for (const m of [...goc, ...Object.values(VL_DEM)]) {
    const b = new THREE.BatchedMesh(1, 3, 3, m); b.colorTexture = null; b.addInstance(b.addGeometry(hinhLo)); b.frustumCulled = false; am.add(b); loAm.push(b);
  }
  // hai đích vẽ: lượt vật đục vẽ vào bộ đệm nét viền (không nén tông, không đổi hệ màu ⇒ chương trình KHÁC) và khung vẽ
  const cu = renderer.clippingPlanes, dich = renderer.getRenderTarget(), dichDs = NET ? [NET.rt, null] : [null];
  // three chỉ nạp số mặt cắt (clipping) trong render() — vẽ một cảnh RỖNG vào đích 1×1 cho nó nạp, rồi mới biên dịch
  const rong = new THREE.Scene(), tam1 = new THREE.WebGLRenderTarget(1, 1);
  let lan = 0;
  try {
    for (const cat of [cu, [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)]]) for (const d of dichDs) {
      renderer.clippingPlanes = cat;
      renderer.setRenderTarget(tam1); renderer.render(rong, camera);
      renderer.setRenderTarget(d);
      await renderer.compileAsync(am, camera, scene); lan++;
    }
  } catch (_) { /* trình duyệt cũ: bỏ qua, biên dịch lúc cần như trước */ }
  finally { renderer.clippingPlanes = cu; renderer.setRenderTarget(dich); tam1.dispose(); veLai(); }
  for (const b of loAm) b.dispose();
  performance.mark("xem:ham-nong");
  console.info(`hâm nóng: ${ds.length} vật liệu × ${lan} (thường / có mặt cắt × đích vẽ) trong ${Math.round(performance.now() - t0)} ms`);
  // viền cam cho vật có vân (chỉ hiện khi làm nổi): tính trên luồng nền, không còn việc dài lúc rảnh trên luồng chính
  const cho = PHAN.filter((o) => { const v = o.userData.vien, u = o.userData;
    return v && v.geometry === HINH_RONG && !u.khoi_phong && u.khong_vien !== true && u.khong_vien !== "True"; });
  const nen = await hinhNen(cho, true);
  for (const o of cho) {
    const v = o.userData.vien, r = nen.get(o.geometry.uuid);
    if (v.geometry !== HINH_RONG || !r || !r.e) continue;     // luồng nền không nhận ⇒ để vienNoi tính khi cần như cũ
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(r.e, 3));
    v.geometry = g; v.userData.vienMuon = true; v.visible = false;
  }
}
let nangChay = 0;
function chayNgay() {                                       // ▶ cả ngày 5:30 → 18:30 trong ~13 s
  if (nangChay) { cancelAnimationFrame(nangChay); nangChay = 0; $("nang-chay").textContent = "▶ Cả ngày"; return; }
  let t0 = null; $("nang-chay").textContent = "■ Dừng";
  const buoc = (now) => {
    if (t0 == null) t0 = now;
    const gio = 5.5 + ((now - t0) / 1000);
    datNang({ gio: Math.min(gio, 18.5) });
    if (gio < 18.5) nangChay = requestAnimationFrame(buoc); else { nangChay = 0; $("nang-chay").textContent = "▶ Cả ngày"; }
  };
  nangChay = requestAnimationFrame(buoc);
}

/* ── NÉT VIỀN theo độ sâu (chủ nhà 2026-09-24: «khó phân biệt hình khối») ─────────────────────────────
   Mặt có vân không vẽ viền cạnh (lộ mạch nối khối tường) nên khối cùng tông nhoè vào nhau. Tô nét trên ẢNH:
   (1) vật ĐỤC vẽ vào bộ đệm (màu + độ sâu, MSAA 4); (2) một tấm phủ màn hình đọc độ sâu, tô tối chỗ độ sâu gãy, và
   chép độ sâu ấy sang khung vẽ; (3) vật TRONG SUỐT (kính, rèm voan, khối mờ) + nét viền cạnh vẽ thẳng lên khung vẽ,
   thử độ sâu với vật đục — nên nét của thứ nằm SAU kính/rèm bị kính/rèm phủ đúng như thật.
   Đo gãy bằng sai phân bậc hai của 1/z — trên một mặt PHẲNG 1/z tuyến tính theo điểm ảnh nên sai phân = 0 dù nhìn
   xiên, và hai khối tường ghép phẳng không lộ mạch; góc gãy (tường gặp sàn) và mép bóng (vật trước nền) thì ≠ 0.
   Chi phí: mỗi vật vẫn vẽ đúng MỘT lần (tách hai lượt theo lớp camera, không vẽ lại hình học) — chỉ thêm một tấm
   phủ vài lần đọc độ sâu/điểm ảnh. Vật trong suốt, nét viền cạnh không vào bộ đệm độ sâu ⇒ không sinh nét. Tắt: ?vien=0 (vẽ thẳng như cũ) · phím V · nút «Nét viền». */
const NET = (() => {
  if (!VIEN_NET) return null;
  const dt = new THREE.DepthTexture(1, 1, THREE.UnsignedInt248Type);
  dt.format = THREE.DepthStencilFormat;
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4, stencilBuffer: true, depthTexture: dt,
    resolveStencilBuffer: false });                          // stencil chỉ dùng lúc vẽ nắp cắt, không cần gộp ra
  const vl = new THREE.ShaderMaterial({
    uniforms: { tMau: { value: rt.texture }, tSau: { value: dt }, uBuoc: { value: new THREE.Vector2() },
      uGan: { value: 0.01 }, uXa: { value: 500 }, uNguong: { value: 1 }, uManh: { value: 0.55 }, uLuong: { value: 0 }, uNen: { value: new THREE.Color() },
      uLogQ: { value: 0 } },
    defines: LOG_Z ? { DO_SAU_LOG: 1 } : {},
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `
      uniform sampler2D tMau; uniform sampler2D tSau; uniform vec2 uBuoc; uniform float uGan, uXa, uNguong, uManh, uLuong, uLogQ; uniform vec3 uNen;
      varying vec2 vUv;
      // độ sâu d (0…1) → 1/z: tuyến tính theo điểm ảnh trên mọi mặt phẳng. Thường: z = gần·xa / (xa − d·(xa − gần)).
      // Logarit (three: d = log2(1 + z) / log2(xa + 1)): z = 2^(d·log2(xa + 1)) − 1.
      #ifdef DO_SAU_LOG
      float nghich(vec2 p) { return 1.0 / max(exp2(texture2D(tSau, p).x * log2(uXa + 1.0)) - 1.0, 1e-6); }
      #else
      float nghich(vec2 p) { return (uXa - texture2D(tSau, p).x * (uXa - uGan)) / (uGan * uXa); }
      #endif
      void main() {
        vec4 mau = texture2D(tMau, vUv);
        float c = nghich(vUv);
        float l = nghich(vUv - vec2(uBuoc.x, 0.0)), r = nghich(vUv + vec2(uBuoc.x, 0.0));
        float d = nghich(vUv - vec2(0.0, uBuoc.y)), u = nghich(vUv + vec2(0.0, uBuoc.y));
        float m = max(c, max(max(l, r), max(d, u)));
        float g = max(abs(l + r - 2.0 * c), abs(d + u - 2.0 * c)) / m;
        // chi tiết mịn hơn ~2 điểm ảnh (sóng tôn, nan lam ở xa) cho sai phân lởm chởm thành chấm: đòi gãy còn thấy ở bước 2
        float l2 = nghich(vUv - vec2(2.0 * uBuoc.x, 0.0)), r2 = nghich(vUv + vec2(2.0 * uBuoc.x, 0.0));
        float d2 = nghich(vUv - vec2(0.0, 2.0 * uBuoc.y)), u2 = nghich(vUv + vec2(0.0, 2.0 * uBuoc.y));
        g = min(g, 0.5 * max(abs(l2 + r2 - 2.0 * c), abs(d2 + u2 - 2.0 * c)) / m);
        // bậc lượng tử của bộ đệm độ sâu 24 bit (uLuong, theo 1/z) — mặt ở xa có sai phân lởm chởm cỡ vài bậc: nâng ngưỡng theo đó
        #ifdef DO_SAU_LOG
        float nguong = uNguong + 6.0 * uLogQ;                 // logarit: bậc lượng tử TƯƠNG ĐỐI của 1/z không đổi theo khoảng cách
        #else
        float nguong = uNguong + 6.0 * uLuong / m;
        #endif
        // gãy nhẹ (sóng tôn, nan lam) nét nhạt; mép bóng và góc gãy lớn nét đậm — dải rộng để mặt gân không tối cả mảng
        float net = smoothstep(nguong, nguong * 8.0, g) * uManh;
        // nét MỘT điểm ảnh: ở mép bóng chỉ tô phía vật GẦN — điểm ảnh ở phía xa (có láng giềng gần hơn rõ rệt) bỏ qua.
        // Góc gãy (tường gặp sàn) láng giềng chỉ lệch chút ít nên vẫn tô.
        if (m > c * 1.03) net = 0.0;
        vec3 muc = vec3(0.03, 0.03, 0.028);
        gl_FragColor = vec4(mix(mau.rgb, muc, net), 1.0);
        #include <tonemapping_fragment>
        // nền (độ sâu = 1): vẽ thẳng lên khung vẽ thì màu nền không qua nén tông — giữ đúng màu ấy
        float sau = texture2D(tSau, vUv).x;
        if (sau >= 1.0) gl_FragColor.rgb = mix(uNen, toneMapping(muc), net);
        // nắp mặt cắt ghi màu hiển thị sẵn (sRGB, không nén tông) và đánh dấu alpha = 0 — giữ nguyên màu ấy
        else if (mau.a < 0.5) gl_FragColor.rgb = mix(sRGBTransferEOTF(vec4(mau.rgb, 1.0)).rgb, toneMapping(muc), net);
        gl_FragDepth = sau;                                   // khung vẽ nhận độ sâu vật đục cho lượt (3)
        #include <colorspace_fragment>
      }`,
    depthTest: true, depthFunc: THREE.AlwaysDepth, depthWrite: true,
  });
  const tam = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), vl);
  tam.frustumCulled = false;
  const canhPhu = new THREE.Scene(); canhPhu.add(tam);
  const camPhu = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const kich = new THREE.Vector2();
  let bat = true;
  try { if (localStorage.getItem("xem:vien_net") === "0") bat = false; } catch (_) { /* không có kho */ }
  // lớp camera: 0 = lượt (1) vật đục · 1 = lượt (3) trong suốt. Đèn phải sáng ở cả hai lượt.
  for (const o of scene.children) if (o.isLight) o.layers.enableAll();
  const doiLop = [];                                          // vật trong suốt khung này — trả về lớp 0 sau khi vẽ (bấm chọn dùng lớp 0)
  function ve() {
    renderer.getDrawingBufferSize(kich);
    if (rt.width !== kich.x || rt.height !== kich.y) rt.setSize(kich.x, kich.y);
    const u = vl.uniforms;
    u.uBuoc.value.set(1 / kich.x, 1 / kich.y);               // bước = 1 điểm ảnh THẬT ⇒ nét mảnh nhất màn hình vẽ được
    u.uGan.value = camera.near; u.uXa.value = camera.far;
    u.uLuong.value = (camera.far - camera.near) / (camera.near * camera.far) / 16777216;
    u.uLogQ.value = Math.LN2 * Math.log2(camera.far + 1) / 16777216;
    /* ngưỡng theo cỡ một điểm ảnh nhìn từ camera: góc gãy 90° cho g ≈ bước góc × độ dốc ⇒ ngưỡng ≈ 0,35 bước góc */
    u.uNguong.value = 0.35 * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / kich.y;
    u.uManh.value = bat ? 0.6 : 0;
    if (scene.background?.isColor) u.uNen.value.copy(scene.background);
    // chỉ vật đang ở lớp 0 (phân tích «ẩn vỏ» tắt lớp 0 — đừng bật lại), trả ĐÚNG mặt nạ cũ sau khi vẽ (soát Codex 2026-09-24)
    for (const o of PHAN) if (o.material.transparent && (o.layers.mask & 1)) { doiLop.push(o, o.layers.mask); o.layers.set(1); }
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);                           // (1) vật đục (lớp 0)
    renderer.setRenderTarget(null);
    renderer.render(canhPhu, camPhu);                         // (2) tấm phủ: màu + nét + độ sâu
    const ac = renderer.autoClear, nen = scene.background;
    renderer.autoClear = false; scene.background = null;      // nền màu buộc xoá khung vẽ dù autoClear tắt
    camera.layers.set(1);
    renderer.render(scene, camera);                           // (3) trong suốt + nét viền cạnh (lớp 1)
    renderer.autoClear = ac; scene.background = nen; camera.layers.set(0);
    for (let i = 0; i < doiLop.length; i += 2) doiLop[i].layers.mask = doiLop[i + 1];
    doiLop.length = 0;
  }
  function dat(v) {
    bat = v; try { localStorage.setItem("xem:vien_net", v ? "1" : "0"); } catch (_) { /* không có kho */ }
    const n = document.getElementById("nut-vien"); if (n) n.setAttribute("aria-pressed", String(bat));
    globalThis.VE_LAI?.();
  }
  return { ve, dat, bat: () => bat, rt };
})();
scene.matrixWorldAutoUpdate = false;       // ma trận cập nhật MỘT lần mỗi khung ở veCanh, không phải mỗi lượt vẽ (nét viền vẽ 2 lượt)
function veCanh() {
  scene.updateMatrixWorld();
  dongBoDem();                                                // lô đếm nắp cắt đọc hiện/ẩn thật — trước khi lô gộp giấu vật gốc
  const an = LO ? LO.truoc() : null;                          // vật đang ở trạng thái gốc: ẩn, vẽ qua lô gộp
  if (NET) NET.ve(); else renderer.render(scene, camera);
  if (an) for (const o of an) o.visible = true;
  if (NOI_LEN && NOI_LEN.g) veNoiLen();
}

let GOC = null;              // nút gốc của mô hình (mang phép xoay z-up → y-up)
const PHAN = [];             // mọi mesh vật thể
const THEO_ID = new Map();
let chon = null;             // mesh đang chọn
const anTay = new Set();     // id bị ẩn bằng H
let rieng = null;            // Set id đang "chỉ xem" (I) hoặc null
const lopTat = new Set();    // tên nhóm đang tắt
let hienMa = false;          // khối tham chiếu (ma)
let hienPhanTich = false;    // vật PHÂN TÍCH (props phan_tich, vd nước đọng) chỉ hiện khi lớp phân tích/mô phỏng bật
let anNgoai = null;          // bộ lọc ẩn do lớp NHIỆT · GIÓ đặt (xem nhiet.js) — null = không lọc

/* Gạch kính khuếch tán (ghi chú #27): kính truyền sáng có độ nhám — thứ phía sau hiện ra nhoè như thật,
   không trong suốt như kính thường. */
// ghi chú #9 (trang mái): "khuếch tán quá, giảm bớt" ⇒ nhám 0,55 → 0,30
/* Mặc định KHÔNG dùng transmission nữa (soát hiệu năng 2026-09-27): có một vật transmission trong khung là three vẽ LẠI mọi
   vật đục mỗi khung — +6.700 lượt vẽ khi có mặt cắt, GPU 10 → 5,9 ms khi bỏ. Kính mờ giả: trong suốt 0,6, nhám như cũ.
   ?truyen=1: trả lại kính truyền sáng thật (nhìn xuyên nhoè). */
const VL_GACH_KINH = Q.get("truyen") === "1"
  ? new THREE.MeshPhysicalMaterial({ color: 0xeef6f7, metalness: 0, roughness: 0.30, transmission: 1, thickness: 0.08, ior: 1.5, side: THREE.DoubleSide })
  : new THREE.MeshStandardMaterial({ color: 0xe4eef0, metalness: 0, roughness: 0.30, transparent: true, opacity: 0.6, depthWrite: false,
      side: THREE.DoubleSide, forceSinglePass: true });
const VL_CHON = new THREE.MeshStandardMaterial({ color: 0xd4856e, emissive: 0xb8412c, emissiveIntensity: 0.35, roughness: 0.5, side: THREE.DoubleSide });
// vật đang chọn mà đang XEM XUYÊN: vẫn tô màu chọn nhưng mờ, để thấy thứ nằm sau nó
const VL_CHON_MO = VL_CHON.clone(); VL_CHON_MO.transparent = true; VL_CHON_MO.opacity = 0.28; VL_CHON_MO.depthWrite = false;
const HINH_RONG = new THREE.BufferGeometry();   // viền không bao giờ hiện dùng chung hình rỗng này
/* Gỡ vật tạm (nháp, cột lớp, khoanh vùng) phải trả bộ đệm GPU: .clear()/.remove() một mình để lại hình + vật liệu trên GPU.
   Vật liệu dùng chung (khai ở đầu tệp) không bị huỷ — xem giaiPhong(). */
function giaiPhong(o) {
  o.traverse((c) => {
    if (c.geometry && c.geometry !== HINH_RONG) c.geometry.dispose();
    for (const m of [c.material].flat()) if (m && !m.userData?.dungChung) m.dispose();
  });
}
function xoaCon(g) { for (const c of [...g.children]) giaiPhong(c); g.clear(); }

/* ── GỘP LƯỚI THEO VẬT LIỆU (2026-09-24, chủ nhà duyệt) ────────────────────────────────────────────────
   ~2.500 vật × (lưới + viền) = ~5.000 lượt vẽ mỗi khung, trong khi cả nhà chỉ có ~76 vật liệu khác nhau. Mỗi vật liệu ĐỤC
   một THREE.BatchedMesh (WEBGL_multi_draw: một lượt vẽ cho cả lô), viền cạnh mọi vật một LineSegments gộp.
   Vật thể RIÊNG (PHAN) vẫn là nguồn thật — bấm chọn, ẩn/hiện, lớp nhiệt, tách lớp, kiểm tra đều đụng nó như cũ.
   Mỗi khung, ngay trước khi vẽ: vật nào đang ở TRẠNG THÁI GỐC (hiện, ở lớp 0, vật liệu = vật liệu của lô, chưa dời, không
   có mặt cắt) thì ẩn tạm và bật ô của nó trong lô; vật đã đổi trạng thái (đang chọn, mờ, tô nhiệt, dời…) tự vẽ riêng như
   trước. Nên mọi chức năng cũ đúng mà không phải biết có lô. Không gộp: vật trong suốt (thứ tự vẽ), vật ma, khoang khí,
   kính truyền sáng. Tắt: ?lo=0 (so sánh / dò lỗi). */
const VL_CHUNG = new Map();
function vlChung(m) {
  if (!m.isMeshStandardMaterial) return m;
  const t = (x) => x?.uuid || "";
  const k = [m.type, m.name, m.color.getHexString(), m.emissive.getHexString(), m.emissiveIntensity, m.roughness, m.metalness,
    m.opacity, m.transparent, m.alphaTest, m.side, m.vertexColors, m.flatShading, m.normalScale.x, m.normalScale.y,
    t(m.map), t(m.normalMap), t(m.roughnessMap), t(m.metalnessMap), t(m.emissiveMap), t(m.aoMap), t(m.alphaMap), t(m.envMap),
    m.transmission || 0, JSON.stringify(m.userData || {})].join("|");
  if (!VL_CHUNG.has(k)) VL_CHUNG.set(k, m);
  return VL_CHUNG.get(k);
}
let LO = null;
function dungLo() {
  if (Q.get("lo") === "0" || !GOC) return null;
  const nhom = new Map();
  for (const o of PHAN) {
    const u = o.userData, m = o.material;
    if (u.ma || u.khoi_phong || u.vat_lieu === "khoang" || m.transparent || m.transmission || !o.geometry.index
      || !m.isMeshStandardMaterial || o.parent !== GOC || o.renderOrder !== 0) continue;
    const khoa = m.uuid + "|" + Object.keys(o.geometry.attributes).sort().join();     // cùng bộ thuộc tính đỉnh mới chung lô
    if (!nhom.has(khoa)) nhom.set(khoa, []);
    nhom.get(khoa).push(o);
  }
  const goc = new THREE.Group(); goc.name = "lô gộp (vẽ thay vật riêng)";
  const DS = [];
  for (const ds of nhom.values()) {
    if (ds.length < 2) continue;                                  // một vật: lô không đỡ được gì
    let nv = 0, ni = 0;
    for (const o of ds) { nv += o.geometry.attributes.position.count; ni += o.geometry.index.count; }
    const bm = new THREE.BatchedMesh(ds.length, nv, ni, ds[0].material);
    bm.name = "lô " + ds[0].material.name; bm.raycast = () => {};
    // three r170 so `object.colorTexture` (không có — tên thật là _colorsTexture) với null ⇒ «đổi chương trình» ở MỌI lượt
    // vẽ của mọi lô (getProgram + getParameters, đo ~60 lần/khung). Gán null cho khớp. Bỏ khi lên three có sửa.
    bm.colorTexture = null;
    for (const o of ds) {
      o.updateMatrix();
      const iid = bm.addInstance(bm.addGeometry(o.geometry));
      bm.setMatrixAt(iid, o.matrix);
      bm.setVisibleAt(iid, false);
      DS.push({ o, bm, iid, vl: o.material, p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone(), dang: false, vien: -1, vienDang: false });
    }
    bm.computeBoundingBox(); bm.computeBoundingSphere();
    goc.add(bm);
  }
  if (!DS.length) return null;
  /* viền cạnh gộp: đoạn thẳng của mọi vật trong lô nối thành một mảng; bật/tắt từng vật bằng cách dựng lại chỉ số (chỉ khi
     tập vật đổi — bật/tắt lớp, chọn — không phải mỗi khung) */
  let tong = 0;
  for (const d of DS) { const g = d.o.userData.vien?.geometry; if (g && g !== HINH_RONG) { d.vien = tong; d.soVien = g.attributes.position.count; tong += d.soVien; } }
  const vt = new Float32Array(tong * 3);
  for (const d of DS) if (d.vien >= 0) vt.set(d.o.userData.vien.geometry.attributes.position.array, d.vien * 3);   // toạ độ lưới = toạ độ GOC (vật chưa dời)
  const gv = new THREE.BufferGeometry();
  gv.setAttribute("position", new THREE.BufferAttribute(vt, 3));
  const cs = new THREE.BufferAttribute(tong > 65535 ? new Uint32Array(tong) : new Uint16Array(tong), 1);
  cs.setUsage(THREE.DynamicDrawUsage);
  gv.setIndex(cs); gv.setDrawRange(0, 0);
  const vien = new THREE.LineSegments(gv, VIEN);
  vien.name = "viền gộp"; vien.raycast = () => {}; vien.frustumCulled = false;
  if (NET) vien.layers.set(1);                                    // như viền riêng: vẽ ở lượt trong suốt
  goc.add(vien);
  GOC.add(goc);
  console.info(`gộp lưới: ${DS.length} vật → ${goc.children.length - 1} lô theo vật liệu + 1 viền gộp`);
  const an = [];
  function truoc() {
    an.length = 0;
    let doiVien = false;
    // mặt cắt KHÔNG còn tắt lô gộp: bộ đếm nắp nay là lô riêng (dongBoDem), không phải con của vật
    for (const d of DS) {
      const o = d.o, v = o.userData.vien;
      let dung = o.visible && (o.layers.mask & 1) !== 0 && o.material === d.vl
        && o.position.equals(d.p) && o.quaternion.equals(d.q) && o.scale.equals(d.s);
      if (dung) for (const c of o.children) if (c.visible && c !== v) { dung = false; break; }   // con khác đang hiện (nắp, đánh dấu)
      if (dung && v && v.visible && v.material !== VIEN && v.geometry !== HINH_RONG) dung = false;   // viền đổi kiểu (phân tích «mờ»): vẽ riêng
      if (dung !== d.dang) { d.bm.setVisibleAt(d.iid, dung); d.dang = dung; }
      const vd = dung && d.vien >= 0 && v.visible && v.material === VIEN;
      if (vd !== d.vienDang) { d.vienDang = vd; doiVien = true; }
      if (dung) { o.visible = false; an.push(o); }
    }
    if (doiVien) {
      let n = 0; const a = cs.array;
      for (const d of DS) if (d.vienDang) for (let i = 0; i < d.soVien; i++) a[n++] = d.vien + i;
      cs.needsUpdate = true; gv.setDrawRange(0, n);
    }
    return an;
  }
  return { truoc, goc, soVat: DS.length, DS };
}
// nét viền cạnh không ghi độ sâu: nếu ghi, nét viền theo độ sâu (NET) tô đậm thêm quanh chính nó
const VIEN = new THREE.LineBasicMaterial({ color: 0x2a2a28, transparent: true, opacity: 0.28, depthWrite: false });
const VIEN_CHON = new THREE.LineBasicMaterial({ color: 0xb8412c, depthWrite: false });
const VIEN_NOI = new THREE.LineBasicMaterial({ color: 0x2a2a28, transparent: true, opacity: 0.85, depthWrite: false });   // viền mảnh TỐI quanh vật LÀM NỔI — không đổi màu vật
const VL_KHOANG = new THREE.MeshBasicMaterial({ color: 0xa9cbe8, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
/* khối PHÒNG (t1/t2): mặt khối trùng mặt tường nên ở mọi ô cửa nó hiện thành một màng mỏng chắn ngang — vẽ vô hình
   (vẫn bấm chọn, vẫn bật/tắt theo lớp «Phòng — …»). Chủ nhà 2026-09-22: màng trong suốt ở cửa giếng khi mở. */
const VL_KHOI_PHONG = new THREE.MeshBasicMaterial({ color: 0xa9cbe8, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide });

/* ── đổi toạ độ ────────────────────────────────────────────────────────── */
const m2w = (x, y, z) => GOC.localToWorld(new THREE.Vector3(x, y, z));
const w2m = (v) => GOC.worldToLocal(v.clone());
const f3 = (v) => [v.x, v.y, v.z].map((n) => n.toFixed(3)).join(",");
const mm = (n) => Math.round(n * 1000).toLocaleString("vi-VN");

/* ── nạp mô hình ───────────────────────────────────────────────────────── */
let xong, hienDau;
const READY = new Promise((r) => (xong = r));            // MỌI nhóm đã vào cảnh (công cụ kiểm, chụp ảnh chờ cái này)
const HIEN_DAU = new Promise((r) => (hienDau = r));      // đợt đầu đã dựng — đủ để hiện (trang việc chờ cái này)
/* THANH TIẾN ĐỘ (chủ nhà 2026-09-27): đọc window.TIEN_DO (xem.html ghi trạng thái từng nhóm) + giai đoạn của xem.js.
   Tóm tắt {pct, chu, xong} để ở TIEN_DO.tom và phát «tien-do-tom» (nhung.js chuyển lên trang việc). */
const TIEN = (() => {
  const TD = window.TIEN_DO || (window.TIEN_DO = { nhom: {}, giai_doan: "tai", t0: performance.now() });
  const el = document.createElement("div");
  el.id = "tien-do"; el.className = "tien-do"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
  el.innerHTML = '<div class="tien-do-thanh"><i></i></div><span></span>';
  let hen = 0;
  function tom() {
    const ds = Object.values(TD.nhom), n = ds.length || 1;
    const xongN = ds.filter((x) => x.trang === "xong" || x.trang === "loi" || x.vao).length;
    const lau = performance.now() - TD.t0 > 700;
    const cho = ds.filter((x) => x.trang === "cho").map((x) => x.ten);
    const pct = TD.giai_doan === "xong" ? 1 : Math.min(0.97, ds.reduce((a, x) => a + (x.vao ? 1 : x.trang === "xong" || x.trang === "loi" ? 0.85
      : x.trang === "tai" && x.tong ? 0.85 * x.da / x.tong : 0), 0) / n);
    let chu;
    if (TD.giai_doan === "dung") chu = `Đang dựng cảnh — ${xongN}/${ds.length} nhóm đã tải`;
    else if (TD.giai_doan === "them") chu = `Đang thêm: ${ds.filter((x) => !x.vao && x.trang !== "loi").map((x) => x.ten).join(", ")}`;
    else chu = `Đang tải mô hình — ${xongN}/${ds.length} nhóm` + (lau && cho.length ? ` · máy chủ đang dựng lại: ${cho.join(", ")}` : "");
    return { pct, chu, xong: TD.giai_doan === "xong" };
  }
  function ve() {
    hen = 0;
    const t = TD.tom = tom();
    if (!el.isConnected) { const k = document.getElementById("khung"); if (k) k.append(el); }
    el.hidden = t.xong;
    el.firstChild.firstChild.style.width = (t.pct * 100).toFixed(1) + "%";
    el.lastChild.textContent = t.chu;
    dispatchEvent(new Event("tien-do-tom"));
  }
  addEventListener("tien-do", () => { if (!hen) hen = requestAnimationFrame(ve); });
  const giai = (g) => { TD.giai_doan = g; ve(); };
  ve();
  return { giai, ve };
})();

/* MỘT TRANG, NHIỀU NHÓM KẾT CẤU (dung.py LINH_KIEN): mỗi nhóm một .glb do đúng một phiên dựng. Trang tải
   danh mục rồi MỌI nhóm, dời con của các gốc về một GOC chung (mọi gốc cùng phép xoay z-up → y-up, nên
   toạ độ mô hình giữ nguyên), gắn `userData.linh_kien` cho từng vật. `?m=` là CẢNH: nhóm hiện sẵn,
   tiêu đề, khung nhìn, bóc lớp, mặt cắt sẵn, lớp nhiệt, sổ ghi chú. `?nhom=a,b` đè nhóm hiện sẵn. */
let DM = { linh_kien: [], canh: {} };       // danh mục: nhóm + cảnh
let CANH = {};                              // cảnh đang mở
const lkTat = new Set();                    // nhóm kết cấu đang tắt
const LK_LOI = new Map();                   // nhóm không tải được → lý do
const LK_CO = [];                           // nhóm đã tải vào cảnh
async function napMoHinh() {
  const SOM = window.TAI_SOM;                  // xem.html đã xin sẵn danh mục + .glb (song song với module three)
  DM = await (SOM ? SOM.dm.catch(() => null) : null) || await (await fetch("mo-hinh/danh-muc.json", { cache: "no-store" })).json();
  performance.mark("xem:danh-muc");
  CANH = DM.canh[MA] || DM.canh.nha || { hien: DM.linh_kien.map((x) => x.ma) };
  const thuTu = [...CANH.hien, ...DM.linh_kien.map((x) => x.ma).filter((m) => !CANH.hien.includes(m))];
  const loader = new GLTFLoader();
  /* ẢNH VÂN DÙNG CHUNG giữa các nhóm: mỗi .glb tự tải ảnh vân của mình nên cùng một ảnh (tủ HMR, bê tông…) bị
     tải, giải mã và nạp lên GPU tới 7 lần — 120 lượt cho 54 ảnh, ~450 MB bộ nhớ GPU. Nay một ảnh + một bộ lấy
     mẫu = một Texture cho mọi nhóm. */
  const VAN_CHUNG = new Map();
  /* ẢNH NÉN GPU (KTX2 · Basis ETC1S, tools/3d/nen_ktx2.py): .glb mang nguồn KHR_texture_basisu cạnh jpg. Trình duyệt chuyển
     thẳng sang định dạng nén của GPU (BC/ETC2/ASTC) — ~8 lần nhỏ hơn RGBA của jpg, không phải giải jpg. Bộ giải (wasm) lấy
     cùng bản three trên CDN. Lỗi bất kỳ (không có bộ giải, tệp hỏng) ⇒ lặng lẽ dùng jpg. Tắt: ?ktx2=0 (so sánh). */
  let KTX2 = null;
  if (Q.get("ktx2") !== "0") {
    try {
      KTX2 = new KTX2Loader().setTranscoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/basis/")
        .setWorkerLimit(Math.max(4, Math.min(8, navigator.hardwareConcurrency || 4))).detectSupport(renderer);
      KTX2.init();                              // khởi động bộ giải ngay, không đợi ảnh vân đầu tiên (xem.html đã preload)
    }
    catch (e) { console.warn("không dùng được KTX2 — dùng jpg:", e); }
  }
  /* GÓI ẢNH VÂN (khung/goi_van.py → mo-hinh/van.bin, xem.html xin sẵn): "383V" · u32 độ dài JSON · JSON {tep: {đường:
     [vị trí, cỡ]}} · dữ liệu. Ảnh có trong gói ⇒ cắt ra, giải bằng KTX2Loader.parse; không có ⇒ xin tệp như cũ. Cắt bằng
     slice (CHÉP): KTX2Loader chuyển hẳn bộ đệm sang worker, chuyển một view thì mất cả gói. */
  const GOI_VAN = !KTX2 ? Promise.resolve(null) : Promise.resolve(SOM?.van).then((ab) => {
    if (!ab || ab.byteLength < 8 || new TextDecoder().decode(new Uint8Array(ab, 0, 4)) !== "383V") return null;
    const n = new DataView(ab).getUint32(4, true), dau = 8 + n + (-(8 + n) & 3);
    const tep = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 8, n))).tep, m = new Map();
    for (const [duong, [vt, co]] of Object.entries(tep)) m.set(new URL(duong, location.href).href, [dau + vt, co]);
    return {
      isImageBitmapLoader: false,
      load(url, ok, tien, loi) {                   // cùng chữ ký Loader.load — GLTFLoader.loadTextureImage gọi đúng hàm này
        const o = m.get(new URL(url, location.href).href);
        if (!o) return KTX2.load(url, ok, tien, loi);
        KTX2.parse(ab.slice(o[0], o[0] + o[1]), ok, (e) => { console.warn("gói ảnh vân: giải hỏng — xin tệp", url, e); KTX2.load(url, ok, tien, loi); });
      },
    };
  }).catch((e) => { console.warn("gói ảnh vân hỏng — xin từng tệp:", e); return null; });
  loader.register((parser) => ({
    name: "van_chung_383",
    loadTexture(i) {
      const td = parser.json.textures[i], bu = KTX2 && td.extensions?.KHR_texture_basisu;
      const img = parser.json.images?.[bu ? bu.source : td.source];
      if (!img?.uri || img.uri.startsWith("data:")) return null;           // ảnh nhúng: để GLTFLoader tự lo
      const khoa = new URL(img.uri, new URL(parser.options.path, location.href)).href + "|" + JSON.stringify(parser.json.samplers?.[td.sampler] || {});
      if (!VAN_CHUNG.has(khoa)) VAN_CHUNG.set(khoa, bu
        // bộ giải hỏng lúc khởi động (wasm/worker) thì lời hứa của KTX2Loader r170 treo mãi — chờ tối đa 20 s rồi dùng jpg
        // (đồng hồ 20 s bắt đầu SAU KHI gói về — gói lớn trên mạng chậm không bị tính là bộ giải treo)
        ? GOI_VAN.then((g) => Promise.race([parser.loadTextureImage(i, bu.source, g || KTX2), new Promise((r) => setTimeout(() => r(null), 20000))]))
          .then((t) => t || (console.warn("KTX2 không giải được — dùng jpg:", img.uri), parser.loadTexture(i)))   // loadTexture lõi = nguồn jpg
        : parser.loadTexture(i));
      return VAN_CHUNG.get(khoa);
    },
  }));
  /* KHÔNG còn ?t=Date.now() (buộc tải lại ~14 MB mỗi lần mở): ở máy, xem.py trả «no-cache» ⇒ trình duyệt hỏi lại
     mỗi lần (xem.py vẫn dựng lại nhóm cũ như trước) và nhận 304 nếu .glb không đổi; bản site mang ?v=<băm nội dung>
     do dong_goi_site.py ghi vào danh-muc ⇒ đổi nội dung là đổi địa chỉ. */
  const duongLk = (ma) => { const v = DM.linh_kien.find((x) => x.ma === ma)?.v; return `mo-hinh/lk/${ma}.glb` + (v ? `?v=${v}` : ""); };
  // bản xin sớm (xem.html) ⇒ chỉ phân tích; không có / hỏng ⇒ tải lại như cũ. Đường gốc "mo-hinh/lk/" để ảnh vân
  // tương đối giải đúng như loadAsync.
  const somGlb = SOM ? await SOM.glb.catch(() => null) : null;
  const napLk = (ma) => {
    const buf = somGlb?.get(ma);
    return buf ? buf.then((b) => loader.parseAsync(b, "mo-hinh/lk/"), () => loader.loadAsync(duongLk(ma)))
      : loader.loadAsync(duongLk(ma));
  };
  const hua = thuTu.map((ma) => napLk(ma)
    .then((g) => ({ ma, g })).catch((e) => { LK_LOI.set(ma, String(e.message || e)); return null; }));
  /* TẢI THEO ĐỢT (chủ nhà 2026-09-27: «tải chậm — tải từng phần»): xem.py dựng lại nhóm nào có tệp nguồn vừa đổi TRƯỚC khi
     trả .glb (có nhóm 6–8 s). Không chờ nhóm chậm nhất: đợt đầu = mọi nhóm về trong CHO_DAU ms (ít nhất một nhóm), dựng
     cảnh và hiện ngay; nhóm về sau được THÊM vào (themNhom) khi tới. ?cho_du=1: chờ đủ mọi nhóm như trước. */
  const CHO_DAU = Q.get("cho_du") === "1" ? 1e9 : 900;
  const da = new Map();
  hua.forEach((p, i) => p.then((r) => { da.set(thuTu[i], r); }));
  const tatCa = Promise.all(hua);
  const han = performance.now() + CHO_DAU;
  while (da.size < hua.length && (performance.now() < han || ![...da.values()].some(Boolean)))
    await Promise.race([tatCa, new Promise((r) => setTimeout(r, 40))]);
  performance.mark("xem:glb");                    // đợt đầu đã phân tích, kể cả ảnh vân
  const dau = [...da.values()].filter(Boolean);
  if (!dau.length) throw new Error("không nhóm nào tải được");
  gopNhom(dau);
  /* Liên kết ghi nhóm ĐANG TẮT (`an=`), không ghi danh sách nhóm đang bật: nhóm thêm sau ngày chép liên kết vẫn hiện
     (chủ nhà 2026-09-29: liên kết cũ `nhom=…` giấu mất nhóm «Phơi đồ» mới — «shouldn't happen like this»). `nhom=` cũ
     KHÔNG còn đọc: một danh sách đóng băng luôn giấu nhóm về sau. */
  const an = (Q.get("an") || "").split(",").filter(Boolean);
  for (const x of DM.linh_kien) if (!CANH.hien.includes(x.ma) || an.includes(x.ma)) lkTat.add(x.ma);
  scene.updateMatrixWorld(true);
  return { hua, daCo: new Set(dau.map((x) => x.ma)) };
}
/* GỘP NHÓM vào cảnh (đợt đầu và mọi nhóm về sau). userData gốc của từng nhóm giữ ở LK_UD để tính lại bản gộp mỗi lần. */
const LK_UD = [];
function gopNhom(co) {
  for (const { ma, g } of co) {
    const r = g.scene.children[0];
    r.traverse((o) => { if (o.isMesh) o.userData.linh_kien = ma; });
    LK_UD.push({ ma, ud: { ...(r.userData || {}) } });
    LK_CO.push(ma);                                   // nhóm THỰC SỰ tải được (cho lớp nhiệt)
    if (window.TIEN_DO?.nhom[ma]) window.TIEN_DO.nhom[ma].vao = true;
    if (!GOC) { GOC = r; scene.add(g.scene); continue; }
    for (const c of [...r.children]) GOC.add(c);        // cùng phép xoay gốc ⇒ toạ độ con giữ nguyên
  }
  const extras = {}, nhom = [], trinh_tu = [], chon_mot = [];
  for (const { ma, ud } of LK_UD) {
    for (const [k, v] of Object.entries(ud)) if (!(k in extras)) extras[k] = v;
    for (const n of ud.nhom || []) if (!nhom.includes(n)) nhom.push(n);
    // TRÌNH TỰ THI CÔNG: nhóm nào khai `trinh_tu` (danh sách bước) ở gốc thì vật của nhóm ấy mang `buoc`
    if (ud.trinh_tu && ud.trinh_tu.length) trinh_tu.push({ ma, buoc: ud.trinh_tu });
    // các biến thể tháp khai CÙNG công tắc (cùng tên lớp) ⇒ một công tắc lái cả ba
    for (const cm of ud.chon_mot || []) if (!chon_mot.some((x) => x.ma === cm.ma)) chon_mot.push(cm);
  }
  GOC.userData = { ...extras, nhom, chon_mot, trinh_tu, tieu_de: CANH.tieu_de || MA, lop_boc: CANH.lop_boc || [],
    mat_cat_san: CANH.mat_cat_san || [], khung_bo_nhom: CANH.khung_bo_nhom || [],
    khung_linh_kien: CANH.khung_linh_kien || null, linh_kien: DM.linh_kien };
}
/* bỏ bộ nắp cắt / lô gộp cũ trước khi dựng lại cho cảnh đã thêm nhóm */
const VL_NAP = new Map();          // khoá vật liệu → [nắp, nắp mờ]
function boNapCat() {
  for (const g of NAP) {
    scene.remove(g.nap, g.napMo); g.nap.geometry.dispose();
    for (const d of g.dem) { scene.remove(d.bm); d.bm.dispose(); }
  }
  NAP.length = 0; HO.length = 0;
}
function boLo() {
  if (!LO) return;
  LO.goc.parent?.remove(LO.goc);
  LO.goc.traverse((o) => { if (o.isBatchedMesh) o.dispose(); else if (o.isLineSegments) o.geometry.dispose(); });
  LO = null;
}

/* ── HÌNH NỀN SONG SONG (chủ nhà 2026-09-27: «mở lại trang chậm hơn»): cạnh viền (EdgesGeometry, ~190 ms) và kiểm khối
   kín cho nắp cắt (kinCua, ~80 ms) là toán hình thuần — chạy trên NHIỀU luồng nền ngay khi .glb phân tích xong, song song
   với phần dựng còn lại trên luồng chính. Kết quả y hệt bản luồng chính (cùng thuật toán, cùng làm tròn). Không có
   Worker (hoặc ?luong=0) ⇒ tính trên luồng chính như cũ. */
function thoHinh() {
  const canh = (P, I, nguong) => {               // = three r170 EdgesGeometry(geo, góc) — cùng khoá băm 4 chữ số
    const pr = 1e4, n = I ? I.length : P.length / 3, ra = [], du = {};
    const H = [0, 0, 0], ix = [0, 0, 0], v = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < n; i += 3) {
      for (let j = 0; j < 3; j++) { ix[j] = I ? I[i + j] : i + j; const k = ix[j] * 3; v[j][0] = P[k]; v[j][1] = P[k + 1]; v[j][2] = P[k + 2];
        H[j] = `${Math.round(v[j][0] * pr)},${Math.round(v[j][1] * pr)},${Math.round(v[j][2] * pr)}`; }
      if (H[0] === H[1] || H[1] === H[2] || H[2] === H[0]) continue;
      // pháp tuyến như Triangle.getNormal: (c − b) × (a − b), chuẩn hoá
      const ux = v[2][0] - v[1][0], uy = v[2][1] - v[1][1], uz = v[2][2] - v[1][2], wx = v[0][0] - v[1][0], wy = v[0][1] - v[1][1], wz = v[0][2] - v[1][2];
      let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const L = nx * nx + ny * ny + nz * nz;
      if (L > 0) { const s = 1 / Math.sqrt(L); nx *= s; ny *= s; nz *= s; } else { nx = ny = nz = 0; }
      for (let j = 0; j < 3; j++) {
        const jn = (j + 1) % 3, h = `${H[j]}_${H[jn]}`, hn = `${H[jn]}_${H[j]}`;
        if (hn in du && du[hn]) {
          const e = du[hn];
          if (nx * e[2] + ny * e[3] + nz * e[4] <= nguong) ra.push(v[j][0], v[j][1], v[j][2], v[jn][0], v[jn][1], v[jn][2]);
          du[hn] = null;
        } else if (!(h in du)) du[h] = [ix[j], ix[jn], nx, ny, nz];
      }
    }
    for (const k in du) { const e = du[k]; if (e) { const a = e[0] * 3, b = e[1] * 3; ra.push(P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2]); } }
    return new Float32Array(ra);
  };
  const kin = (P, I) => {                        // = kinCua (1 kín hướng ra · −1 kín hướng vào · 0 hở)
    const nv = P.length / 3, n = I ? I.length : nv, so = new Map(), ma = new Int32Array(nv), Q = [];
    for (let i = 0; i < nv; i++) {
      const k = Math.round(P[i * 3] * 1e5) + "," + Math.round(P[i * 3 + 1] * 1e5) + "," + Math.round(P[i * 3 + 2] * 1e5);
      let x = so.get(k); if (x === undefined) { x = so.size; so.set(k, x); Q.push([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]); } ma[i] = x;
    }
    const cm = new Map(); let tt = 0, soTG = 0;
    for (let t = 0; t + 2 < n; t += 3) {
      const i0 = I ? I[t] : t, i1 = I ? I[t + 1] : t + 1, i2 = I ? I[t + 2] : t + 2, a = ma[i0], b = ma[i1], c = ma[i2];
      if (a === b || b === c || a === c) continue;
      soTG++;
      for (const [p, q] of [[a, b], [b, c], [c, a]]) { const k = p < q ? p * 4194304 + q : q * 4194304 + p; let e = cm.get(k); if (!e) { e = [0, 0]; cm.set(k, e); } e[p < q ? 0 : 1]++; }
      const A = [P[i0 * 3], P[i0 * 3 + 1], P[i0 * 3 + 2]], B = [P[i1 * 3], P[i1 * 3 + 1], P[i1 * 3 + 2]], C = [P[i2 * 3], P[i2 * 3 + 1], P[i2 * 3 + 2]];
      tt += (A[0] * (B[1] * C[2] - B[2] * C[1]) + A[1] * (B[2] * C[0] - B[0] * C[2]) + A[2] * (B[0] * C[1] - B[1] * C[0])) / 6;
    }
    if (!soTG) return 0;
    const lech = []; for (const [k, e] of cm) if (e[0] !== e[1]) lech.push([Math.floor(k / 4194304), k % 4194304, e[0], e[1]]);
    if (lech.length && !chuT(lech, Q)) return 0;
    return tt >= 0 ? 1 : -1;
  };
  const chuT = (lech, Q) => {                    // = vaChuT
    if (lech.length > 4000) return false;
    const dinh = [...new Set(lech.flatMap((e) => [e[0], e[1]]))], dem = new Map();
    const cong = (a, b, n) => { const k = a < b ? a * 4194304 + b : b * 4194304 + a; dem.set(k, (dem.get(k) || 0) + (a < b ? n : -n)); };
    for (const [p, q, xuoi, nguoc] of lech) {
      const A = Q[p], B = Q[q], d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], L2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2], giua = [];
      for (const c of dinh) {
        if (c === p || c === q) continue;
        const w = [Q[c][0] - A[0], Q[c][1] - A[1], Q[c][2] - A[2]], t = (w[0] * d[0] + w[1] * d[1] + w[2] * d[2]) / L2;
        if (t <= 1e-6 || t >= 1 - 1e-6) continue;
        const r0 = w[0] - d[0] * t, r1 = w[1] - d[1] * t, r2 = w[2] - d[2] * t;
        if (r0 * r0 + r1 * r1 + r2 * r2 < 1e-10) giua.push([t, c]);
      }
      giua.sort((x, y) => x[0] - y[0]);
      const ch = [p, ...giua.map((g) => g[1]), q];
      for (let i = 0; i + 1 < ch.length; i++) cong(ch[i], ch[i + 1], xuoi - nguoc);
    }
    for (const x of dem.values()) if (x !== 0) return false;
    return true;
  };
  self.onmessage = (ev) => {
    const ra = [], chuyen = [];
    for (const j of ev.data) {
      const e = j.vien ? canh(j.P, j.I, j.nguong) : null, k = j.chiVien ? null : kin(j.P, j.I);
      ra.push({ id: j.id, e, k }); if (e) chuyen.push(e.buffer);
    }
    self.postMessage(ra, chuyen);
  };
}
/* Mỗi LƯỚI (geometry) một việc — nhiều vật dùng chung lưới chỉ tính một lần. Trả Map uuid lưới → {e, k}. */
function hinhNen(ds, chiVien = false) {
  const viec = new Map();
  for (const o of ds) {
    const g = o.geometry, p = g.attributes.position;
    if (viec.has(g.uuid)) { viec.get(g.uuid).vien ||= chiVien || o.userData.canVien; continue; }
    // chỉ nhận vị trí phẳng Float32 (không xen kẽ, không chuẩn hoá) — dạng khác để luồng chính tính như cũ
    if (!p || p.isInterleavedBufferAttribute || p.normalized || !(p.array instanceof Float32Array) || p.itemSize !== 3) continue;
    viec.set(g.uuid, { id: g.uuid, P: p.array.slice(0, p.count * 3), I: g.index ? g.index.array.slice(0, g.index.count) : null,
      vien: chiVien || !!o.userData.canVien, chiVien, nguong: Math.cos((25 * Math.PI) / 180) });
  }
  const ra = new Map();
  if (!viec.size || typeof Worker === "undefined" || Q.get("luong") === "0") return Promise.resolve(ra);
  let url;
  try { url = URL.createObjectURL(new Blob([`(${thoHinh.toString()})()`], { type: "text/javascript" })); }
  catch (_) { return Promise.resolve(ra); }
  const N = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1));
  // chia theo khối lượng (số đỉnh) cho đều các luồng
  const goi = Array.from({ length: N }, () => ({ ds: [], w: 0 }));
  for (const j of [...viec.values()].sort((a, b) => b.P.length - a.P.length)) { const g = goi.reduce((m, x) => (x.w < m.w ? x : m)); g.ds.push(j); g.w += j.P.length; }
  return Promise.all(goi.filter((g) => g.ds.length).map((g) => new Promise((xong) => {
    let w;
    try { w = new Worker(url); } catch (_) { xong(); return; }
    w.onmessage = (ev) => { for (const r of ev.data) ra.set(r.id, r); w.terminate(); xong(); };
    w.onerror = () => { w.terminate(); xong(); };                  // hỏng ⇒ phần ấy tính trên luồng chính
    w.postMessage(g.ds, g.ds.flatMap((j) => (j.I ? [j.P.buffer, j.I.buffer] : [j.P.buffer])));
  }))).then(() => { URL.revokeObjectURL(url); return ra; });
}

napMoHinh().then(async ({ hua, daCo }) => {
  TIEN.giai("dung");
  const info = GOC.userData;
  $("ten-mo-hinh").textContent = info.tieu_de;
  document.title = `${info.tieu_de} — Mô hình 3D 383`;
  const ganVat = (o) => {
    if (!o.isMesh) return;
    const u = o.userData;
    if (!u.id || u.__gan) return;
    u.__gan = true;
    if (u.vat_lieu === "khoang") o.material = u.khoi_phong ? VL_KHOI_PHONG : VL_KHOANG;   // khoang khí: bấm được; khối phòng vô hình
    if (u.vat_lieu === "gach_kinh") o.material = VL_GACH_KINH; // gạch kính: truyền sáng + nhám ⇒ nhìn xuyên thấy NHOÈ
    o.material.side = THREE.DoubleSide;
    if (o.material.metalness >= 0.5 && !o.material.envMap) { o.material.envMap = MOI_TRUONG; o.material.envMapIntensity = 0.7; }
    if (o.material.transparent) {
      o.material.depthWrite = false;
      /* vật trong suốt hai mặt: three vẽ HAI lượt (mặt sau rồi mặt trước), mỗi lượt đổi side + needsUpdate ⇒ tính lại
         chương trình ~60 lần/khung và gấp đôi lượt vẽ. Kính, lưới, rèm ở đây là tấm mỏng — một lượt là đủ. ?mot_luot=0: như cũ. */
      if (Q.get("mot_luot") !== "0") o.material.forceSinglePass = true;
    }
    if (!THUC && o.material.map) {                           // ?thuc=0: màu phẳng cũ (xuat_glb ghi kèm trong extras)
      const x = o.material.userData || {};
      o.material = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...(x.mau || [0.8, 0.8, 0.8])),
        roughness: x.nham ?? 0.8, metalness: x.kim_loai ?? 0, side: THREE.DoubleSide, name: o.material.name });
    }
    o.material = vlChung(o.material);                         // cùng định nghĩa vật liệu ở nhiều .glb ⇒ MỘT vật liệu (gộp lưới theo nó)
    if (THUC && u.vat_lieu === "luoi") ganLuoiThat(o);        // lưới côn trùng: sợi đan thật, nhìn xuyên (chủ nhà 3D #713)
    o.userData.vlGoc = o.material;
    const coVan = THUC && !!o.material.map;
    if (coVan) for (const t of [o.material.map, o.material.normalMap, o.material.roughnessMap, o.material.metalnessMap]) if (t) t.anisotropy = DI_HUONG;
    // mặt có vân và khối phòng KHÔNG BAO GIỜ hiện viền ⇒ khỏi tính EdgesGeometry (tốn lúc mở trang), giữ vật rỗng cho
    // chỗ khác đổi .material của viền (toThem, phân tích) như cũ
    const khongVien = coVan || !!u.khoi_phong || u.khong_vien === true || u.khong_vien === "True";   // khong_vien: vật bị lớp hoàn thiện liền phủ kín (#567)
    u.canVien = !khongVien;                                  // cạnh viền: luồng nền tính (hinhNen), gắn vào trước khi dựng lô
    const e = new THREE.LineSegments(HINH_RONG, VIEN);
    if (khongVien) e.visible = false;                         // khối phòng: không vẽ cạnh (màng ở ô cửa)
    e.raycast = () => {};
    // viền nằm đúng chỗ vật (ma trận riêng = đơn vị, không ai dời nó) ⇒ DÙNG CHUNG ma trận thế giới của vật, khỏi tính
    e.matrixAutoUpdate = false; e.matrixWorldAutoUpdate = false; e.matrixWorld = o.matrixWorld;
    e.__dungMaTranCha = true;                                 // lượt cập nhật ma trận bỏ qua hẳn (~2.800 nút mỗi khung)
    if (NET) e.layers.set(1);                                 // nét viền cạnh vẽ ở lượt trong suốt, sau nét độ sâu
    o.add(e);
    o.userData.vien = e;
    if (u.ma) { o.renderOrder = 2; }
    PHAN.push(o);
    THEO_ID.set(u.id, o);
  };
  GOC.traverse(ganVat);
  // cạnh viền + khối kín: luồng nền (hinhNen); lưới nào luồng nền không nhận thì tính ở đây như cũ
  const ganNen = (ds, nen) => {
    for (const o of ds) {
      const u = o.userData, r = nen.get(o.geometry.uuid);
      if (r) u.kinSo = r.k;
      if (!u.canVien) continue;
      let g;
      if (r && r.e) { g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(r.e, 3)); }
      else g = new THREE.EdgesGeometry(o.geometry, 25);
      u.vien.geometry = g;
    }
  };
  const nen = await hinhNen(PHAN);
  performance.mark("xem:hinh-nen");
  ganNen(PHAN, nen);
  if (Q.get("kiem_luong") === "1") {                  // phép thử: kết quả luồng nền phải TRÙNG bản luồng chính
    let lechCanh = 0, lechKin = 0, so = 0;
    for (const o of PHAN) {
      const u = o.userData, r = nen.get(o.geometry.uuid);
      if (!r) continue;
      so++;
      if (r.k !== kinCua(o.geometry)) lechKin++;
      if (u.canVien) { const a = new THREE.EdgesGeometry(o.geometry, 25).attributes.position.array, b = u.vien.geometry.attributes.position.array;
        if (a.length !== b.length || a.some((x, i) => Math.abs(x - b[i]) > 1e-6)) lechCanh++; }
    }
    window.__kiemLuong = { so, lechCanh, lechKin, luong: nen.size };
  }
  dungNapCat();
  LO = dungLo();
  dungBoc();
  dungCatSan();
  dungTrinhTu();
  dungNhomKetCau();
  khoiChonMot(info.chon_mot || []);
  // KHỐI PHÒNG (khí, trong suốt) TẮT sẵn: bật thì mặt của nó hiện thành tấm mờ ở mọi ô cửa, và nó
  // nuốt cú bấm vào mọi thứ trong phòng. Bật lại ở mục Lớp khi cần chọn theo phòng.
  for (const n of info.nhom || []) if (/(^|\/)Phòng — /.test(n) && !Q.get("lop")) lopTat.add(n);
  dungLop(info.nhom || []);
  LOP_TAT_MD = new Set(lopTat);                   // lớp tắt mặc định của cảnh — kịch bản 3D thiếu `lop_tat` thì về đây
  capNhatHien();
  damBaoNhomVung();
  apDungUrl();
  taiGhiChu();
  taiThuoc();
  hienDau();
  /* NHÓM VỀ SAU: gộp vào cảnh, dựng lại phần phụ thuộc (nắp cắt, lô gộp, lớp, bóc/tách), giữ nguyên trạng thái đang xem.
     Các nhóm về gần nhau (≤120 ms) gộp một lượt; các lượt nối đuôi nhau. READY xong khi mọi nhóm đã vào. */
  const con = hua.map((p) => p.then((r) => (r && !daCo.has(r.ma) ? r : null)));
  let chuoi = Promise.resolve(), hangCho = [], hen = 0;
  const themNhom = async (ds) => {
    const truoc = new Set(PHAN), nhomCu = new Set(GOC.userData.nhom || []), cmCu = new Set((GOC.userData.chon_mot || []).map((x) => x.ma));
    gopNhom(ds);
    GOC.traverse(ganVat);
    const moi = PHAN.filter((o) => !truoc.has(o));
    ganNen(moi, await hinhNen(moi));
    for (const n of GOC.userData.nhom || []) if (!nhomCu.has(n) && /(^|\/)Phòng — /.test(n) && !Q.get("lop")) { lopTat.add(n); LOP_TAT_MD.add(n); }
    boNapCat(); dungNapCat();
    boLo(); LO = dungLo();
    dungBoc(); dungCatSan(); dungTrinhTu(); dungNhomKetCau();
    khoiChonMot((GOC.userData.chon_mot || []).filter((x) => !cmCu.has(x.ma)));
    dungLop(GOC.userData.nhom || []);
    if (bocK) bocLop(bocK);
    if (tachKhe) tachLop(tachKhe);
    capNhatHien(); apMo(); datNapCat(); datBong(true);
    veLai(300);
    TIEN.ve();
  };
  for (const p of con) p.then((r) => {
    if (!r) return;
    hangCho.push(r); clearTimeout(hen);
    hen = setTimeout(() => { const ds = hangCho.splice(0); chuoi = chuoi.then(() => themNhom(ds)).catch((e) => console.warn("thêm nhóm hỏng:", e)); }, 120);
  });
  if (daCo.size < hua.length) TIEN.giai("them");
  Promise.all(con).then(() => new Promise((r) => setTimeout(r, 150))).then(() => chuoi).then(() => {
    TIEN.giai("xong"); performance.mark("xem:du"); xong();
  });
  moLopNhiet();
  moPhanTich();
  moKiemTra();
  performance.mark("xem:dung");
  datBong(true);                                  // cờ đổ/nhận bóng cho nắng thật — đặt một lần, bóng tắt thì three bỏ qua
  // hâm nóng SAU KHI mọi nhóm đã vào (nhóm về sau dựng lại nắp cắt / lô gộp — đừng biên dịch thứ sắp bị thay)
  if (Q.get("ham") !== "0") READY.then(() => setTimeout(hamNong, 300));   // sau khung đầu — không làm chậm lần hiện đầu tiên (?ham=0: tắt, so sánh)                   // cảnh dựng xong (lô, lớp, ghi chú)
}).catch((err) => {
  $("ten-mo-hinh").textContent = "Không tải được mô hình (" + (err.message || err) + ")";
});

/* ── NHÓM KẾT CẤU: bật/tắt cả một nhóm (một hay nhiều) ──────────────────── */
function dungNhomKetCau() {
  const ul = $("ds-lk");
  if (!ul) return;
  ul.replaceChildren();
  const dem = new Map();
  for (const o of PHAN) if (!o.userData.ma) dem.set(o.userData.linh_kien, (dem.get(o.userData.linh_kien) || 0) + 1);
  for (const x of DM.linh_kien) {
    const li = document.createElement("li");
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = !lkTat.has(x.ma); cb.disabled = LK_LOI.has(x.ma);
    cb.onchange = () => { cb.checked ? lkTat.delete(x.ma) : lkTat.add(x.ma); dungLop(GOC.userData.nhom || []); dungTrinhTu(); capNhatHien(); };
    const t = document.createElement("span");
    t.innerHTML = `${x.ten} <code class="mo">${x.ma}</code>`;
    const s = document.createElement("span"); s.className = "so"; s.textContent = LK_LOI.has(x.ma) ? "⛔" : (dem.get(x.ma) || 0);
    const lb = document.createElement("label"); lb.style.display = "contents";
    lb.append(cb, t, s); li.append(lb);
    li.title = LK_LOI.has(x.ma) ? `Không tải được: ${LK_LOI.get(x.ma)}` : `${x.mo_ta}\nPhiên sửa: «${x.phien}» — mo_hinh/${x.ma}.py`;
    const chi = document.createElement("button");
    chi.type = "button"; chi.className = "nut-mo"; chi.textContent = "chỉ";
    chi.title = "Chỉ hiện nhóm này";
    chi.onclick = (e) => { e.preventDefault(); lkTat.clear(); for (const y of DM.linh_kien) if (y.ma !== x.ma) lkTat.add(y.ma); dungNhomKetCau(); dungLop(GOC.userData.nhom || []); dungTrinhTu(); capNhatHien(); };
    li.append(chi);
    ul.append(li);
  }
}

/* ── LỚP NHIỆT · GIÓ · PHƯƠNG ÁN (chỉ ở máy) ──────────────────────────────
   Dữ liệu do tools/tinh-toan/xuat_nhiet_gio.mjs sinh ra cạnh .glb. Bản site KHÔNG có tệp ấy (và
   không có nhiet.js) — thiếu tệp thì không làm gì, trang vẫn là trình xem thường. */
function moLopNhiet() {
  if (!CANH.nhiet) return;                  // cảnh không khai lớp nhiệt thì không hỏi tệp
  /* MỘT NHÀ, HAI HỆ KHÍ: mỗi NHÓM KẾT CẤU có tệp nhiệt riêng (mai.nhiet.json = khe dưới tôn + khoang trần mái;
     thap_ong_khoi.nhiet.json = giếng + tháp). Nạp mọi nhóm đang có trong cảnh, không chỉ nhóm chính,
     để xem được cả nhà một lượt. Lớp nhiệt của nhóm nào TẮT thì lớp ấy tắt theo (gán lại .visible). */
  const ds = LK_CO.slice();
  for (const ma of ds.length ? ds : [MA]) {
    fetch(`mo-hinh/${ma}.nhiet.json`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && import(d.loai === "mai" ? "./nhiet_mai.js" : "./nhiet.js").then((m) => {
        m.batDau({
          THREE, scene, camera, GOC, data: d, benTrai: $("ben-trai"), khung: $("khung"),
          datAn: (f) => { anNgoai = f; capNhatHien(); },
          phanTich: (on) => { hienPhanTich = on; capNhatHien(); },
          nhinVao: (ds2) => khungVua(ds2),
        });
        if (window.NHIET) window[`NHIET_${ma}`] = window.NHIET;   // giữ cả window.NHIET (phép thử cũ) + tên theo nhóm
        nutNhietCaNha();
        const g = GOC.children.find((o) => (o.name === "lop-nhiet" || o.name === "lop-nhiet-mai") && !o.userData.lkNhiet);
        if (g) { g.userData.lkNhiet = ma; theoNhomKetCau(g, ma); LOP_NHIET.push(g); }
      }))
      .catch(() => {});
  }
}

/* ── LỚP «PHÂN TÍCH CẢ NHÀ» (chỉ ở máy, chỉ cảnh ?m=nha) ─────────────────
   Dữ liệu do `node tools/sim-weather/chay.mjs` chép sang mo-hinh/: nha.phan_tich.json (kết quả) + nha.vung.json
   (mô hình vùng) + tuỳ chọn nha.so_sanh.json (bàn chấm A | B). Bản site không có các tệp ấy — thiếu thì im
   lặng, trang vẫn là trình xem thường. `&phan_tich=1` mở sẵn lớp. Giao diện: tools/sim-weather/HOP_DONG.md §7.
   NẠP KHI CẦN (2026-09-24): tệp kết quả ~9 MB — không có `&phan_tich=1` thì chỉ hiện nút «Nạp lớp phân tích»,
   bấm mới tải (trước đây mọi lần mở ?m=nha đều tải + giải mã cả tệp dù không xem). */
let ptDangNap = null;
function napPhanTich(moSan) {
  if (ptDangNap) return ptDangNap;
  const lay = (f) => fetch(`mo-hinh/${f}`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  ptDangNap = lay("nha.phan_tich.json").then((kq) => kq && Promise.all([lay("nha.vung.json"), lay("nha.so_sanh.json")]).then(([vj, ss]) => vj
    && import("./phan_tich_nha.js").then((m) => m.batDau({
      THREE, scene, camera, GOC, canvas, data: kq, vung: vj, soSanh: ss,
      benTrai: $("ben-trai"), khung: $("khung"), moSan,
    })).then(() => true)))
    .then((ok) => { veLai(300); if (!ok) ptDangNap = null; return !!ok; })
    .catch((e) => { console.warn("lớp phân tích cả nhà không nạp được:", e); ptDangNap = null; });
  return ptDangNap;
}
function moPhanTich() {
  if (MA !== "nha") return;
  if (Q.get("phan_tich")) { napPhanTich(true); return; }
  const cucBo = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);     // ở máy: xem.py chạy được máy mô phỏng dù chưa có tệp
  fetch("mo-hinh/nha.phan_tich.json", { method: "HEAD", cache: "no-cache" }).then((r) => r.ok, () => false).then((co) => {
    if (!co && !cucBo) return;
    const sec = document.createElement("section");
    sec.innerHTML = `<h2>Phân tích cả nhà <span class="mo">chỉ ở máy</span></h2>
      <button type="button" class="nut-nho">Nạp lớp phân tích</button> <span class="mo">nhiệt · gió · tuổi khí · nắng · mưa</span>`;
    const nut = sec.querySelector("button");
    nut.onclick = () => {
      nut.disabled = true; nut.textContent = "Đang nạp…";
      napPhanTich(true).then((ok) => { if (ok) sec.remove(); else { nut.disabled = false; nut.textContent = "Không nạp được — thử lại"; } });
    };
    const ben = $("ben-trai");
    ben.insertBefore(sec, ben.querySelectorAll("section")[2] || null);
  });
}

/* MỘT CÔNG TẮC CHO CẢ NHÀ: hai lớp nhiệt (khoang mái · giếng + tháp) là HAI hệ khí riêng nhưng
   người xem muốn thấy cùng lúc — ô này bật/tắt cả hai (chủ nhà 2026-09-20). Chỉ hiện khi có ≥2 lớp. */
function nutNhietCaNha() {
  const o = [...document.querySelectorAll("#nm-bat, #nh-bat")];
  if (o.length < 2 || document.getElementById("nhiet-ca-nha")) return;
  const l = document.createElement("label");
  l.className = "chk";
  l.innerHTML = '<input type="checkbox" id="nhiet-ca-nha"> <b>Nhiệt · khí CẢ NHÀ</b> (bật cả hai lớp)';
  const s0 = o[0].closest("section");
  s0.parentNode.insertBefore(l, s0);
  l.querySelector("input").onchange = (e) => {
    const bat = e.target.checked;              // giữ ý muốn TRƯỚC khi click (click con làm ô này đổi theo)
    for (const cb of o) if (cb.checked !== bat) cb.click();
    e.target.checked = bat;
  };
  /* hai chú giải cùng góc trái-dưới thì chồng lên nhau — xếp chú giải THÁP lên trên chú giải MÁI */
  const st = document.createElement("style");
  st.textContent = ".nh-chu-giai { bottom: auto !important; top: 12px; }";
  document.head.appendChild(st);
  for (const cb of o) cb.addEventListener("change", () => {
    const ô = document.getElementById("nhiet-ca-nha");
    if (ô) ô.checked = o.every((c) => c.checked);
  });
}

/* lớp nhiệt đi theo nhóm kết cấu: module tự bật/tắt bằng .visible, còn nhóm tắt thì phủ quyết. */
const LOP_NHIET = [];
window.LOP_NHIET_TT = () => LOP_NHIET.map((g) => ({ ma: g.userData.lkNhiet, hien: g.visible }));   // cho phép thử
function theoNhomKetCau(g, ma) {
  let muon = g.visible;
  Object.defineProperty(g, "visible", {
    get: () => muon && !lkTat.has(ma),
    set: (v) => { muon = v; },
    configurable: true,
  });
}

/* ── KIỂM TRA (chỉ ở máy): nút «Kiểm tra» + ô kết quả — web/kiem_bang.js, lõi web/kiem.js ── */
/* CHẾ ĐỘ ĐÈN đã gỡ (chủ nhà 2026-09-24): dựng + xem ánh sáng ở Blender — tools/3d/blender/. */

function moKiemTra() {
  if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;     // bản site không mang kiem*.js
  import("./kiem_bang.js").then((m) => m.batDau({ THREE, GOC, PHAN, THEO_ID, ma: MA, khung: $("khung"),
    chon: (ds) => { datChon(ds[0] || null); for (const o of ds.slice(1)) { THEM.add(o); toThem(o, true); } hienThongTin(); },
    nhinVao: (ds) => khungVua(ds),
  })).catch((e) => console.warn("không nạp được ô Kiểm tra:", e));
}

/* ── hiển thị ──────────────────────────────────────────────────────────── */
/* lớp con LỒNG trong lớp đang tắt cũng tắt (công tắc phương án chứa công tắc Cất/Hạ riêng — thang B) */
function lopTatCha(n) { for (const t of lopTat) if (n && n.startsWith(t + " / ")) return true; return false; }
const QUAT_CHAY = new Map(), CANH_AN = new Set();   // quạt trần đang chạy (bảng công tắc) — xem chayQuat
function hienDuoc(o) {
  const u = o.userData;
  if (u.ma && !hienMa) return false;
  if (u.phan_tich && !hienPhanTich) return false;
  if (lkTat.has(u.linh_kien)) return false;
  if (lopTat.has(u.nhom) || lopTatCha(u.nhom)) return false;
  if (anTay.has(u.id) || CANH_AN.has(u.id)) return false;
  if (anNgoai && anNgoai(u)) return false;
  if (rieng && !rieng.has(u.id)) return false;
  if (BUOC_TT && u.buoc && u.linh_kien === BUOC_TT.ma && u.buoc > BUOC_TT.k) return false;
  return true;
}
function capNhatHien() { for (const o of PHAN) o.visible = hienDuoc(o); dungDsAn(); boiBong(); if (KT && KT.hop.length) veKichThuoc(); }
/* Vật đã ẩn bằng H không bấm vào được nữa ⇒ liệt kê ở đây, bấm một dòng là hiện lại + chọn nó. */
function dungDsAn() {
  const ul = $("ds-an");
  if (!ul) return;
  ul.replaceChildren();
  for (const id of anTay) {
    const o = THEO_ID.get(id);
    if (!o) continue;
    const li = document.createElement("li");
    li.textContent = "👁 " + o.userData.ten;
    li.title = "Bấm để hiện lại vật này";
    li.onclick = () => { anTay.delete(id); capNhatHien(); datChon(o); };
    ul.append(li);
  }
  for (const id of vatMo) {
    const o = THEO_ID.get(id);
    if (!o) continue;
    const li = document.createElement("li");
    li.textContent = "◐ " + o.userData.ten;
    li.title = "Đang xem xuyên — bấm để đặc lại";
    li.onclick = () => { vatMo.delete(id); apMo(); dungDsAn(); if (chon) hienThongTin(); };
    ul.append(li);
  }
  $("hien-het").hidden = anTay.size === 0 && !rieng && vatMo.size === 0;
}

function hopBaoThe(list) {
  const b = new THREE.Box3();
  for (const o of list) b.expandByObject(o);
  return b;
}

/* ── góc nhìn ──────────────────────────────────────────────────────────── */
const HUONG = {                       // hướng NHÌN TỪ (toạ độ mô hình)
  "truc-do": [0.85, -1.25, 0.95], "truoc": [0, -1, 0.08], "sau": [0, 1, 0.08],
  "tay-nam": [1, 0, 0.08], "dong-bac": [-1, 0, 0.08], "tren": [0, -0.0001, 1],
};
function khungVua(list, huong) {
  const b = hopBaoThe(list.filter((o) => o.visible));
  if (b.isEmpty()) return;
  const tam = b.getCenter(new THREE.Vector3());
  const r = b.getSize(new THREE.Vector3()).length() / 2;
  let d;
  if (huong) {
    const a = m2w(...huong).sub(m2w(0, 0, 0)).normalize();
    d = a;
  } else {
    d = camera.position.clone().sub(controls.target).normalize();
  }
  const dist = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05;
  controls.target.copy(tam);
  camera.position.copy(tam).addScaledVector(d, dist);
  camera.near = Math.max(dist / 500, 0.005);
  camera.updateProjectionMatrix();
  controls.update();
}
/* GÓC TỰ KHUNG (2026-09-28): mục trang việc không lưu góc nhìn `v` ⇒ camera khung vừa các vật đang LÀM NỔI, nhìn từ
   `huong` (tên trong HUONG hoặc [x,y,z] toạ độ mô hình; mặc định trục đo). Trả chuỗi góc "c=…;t=…" để bay tới, hoặc null
   khi không có vật làm nổi nào trong các nhóm đang hiện. `xa` nhân khoảng cách (1 = vừa khít). Mô hình đổi thì góc theo. */
function gocKhungNoiBat(huong, xa = 1) {
  if (!NOI_BAT) return null;
  const ds = PHAN.filter((o) => !o.userData.ma && !lkTat.has(o.userData.linh_kien) && noiBatCo(o));
  if (!ds.length) return null;
  const b = hopBaoThe(ds);
  if (b.isEmpty()) return null;
  const tam = b.getCenter(new THREE.Vector3());
  const r = Math.max(b.getSize(new THREE.Vector3()).length() / 2, 0.25);
  const h = Array.isArray(huong) ? huong : HUONG[huong] || HUONG["truc-do"];
  const d = m2w(...h).sub(m2w(0, 0, 0)).normalize();
  const kc = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05 * (Number(xa) || 1);
  const c = tam.clone().addScaledVector(d, kc);
  return `c=${f2(w2m(c))};t=${f2(w2m(tam))}`;
}
function phanKhung() {                 // vật thể dùng để khung vừa mặc định
  const bo = new Set((GOC.userData.khung_bo_nhom || []));
  const lk = GOC.userData.khung_linh_kien;
  const ds = PHAN.filter((o) => !o.userData.ma && o.visible && ![...bo].some((n) => o.userData.nhom.startsWith(n))
    && (!lk || lk.includes(o.userData.linh_kien)));
  return ds.length ? ds : PHAN.filter((o) => !o.userData.ma);
}
function datGoc(ten) {
  for (const b of document.querySelectorAll("[data-goc]")) b.setAttribute("aria-pressed", String(b.dataset.goc === ten));
  khungVua(phanKhung(), HUONG[ten]);
}
for (const b of document.querySelectorAll("[data-goc]")) b.onclick = () => datGoc(b.dataset.goc);

const f2 = (v) => [v.x, v.y, v.z].map((n) => n.toFixed(2)).join(",");
function chuoiGoc(p, vung) {
  // ≤120 ký tự (giới hạn cột `truoc` của sổ Supabase): camera 2 số lẻ, điểm/vùng 3 số lẻ.
  let s = `c=${f2(w2m(camera.position))};t=${f2(w2m(controls.target))}`;
  if (vung) s += `;p=${f3(vung.p1)};q=${f3(vung.p2)};n=${f2(vung.n)}`;
  else if (p) s += `;p=${f3(p)}`;
  return s;
}
function docChuoiGoc(s) {
  const r = {};
  for (const phan of String(s || "").split(";")) {
    const [k, v] = phan.split("=");
    const n = (v || "").split(",").map(Number);
    if (n.length === 3 && n.every(Number.isFinite)) r[k] = n;
  }
  return r;
}
function apGoc(s) {
  const g = docChuoiGoc(s);
  if (!g.c || !g.t) return false;
  camera.position.copy(m2w(...g.c));
  controls.target.copy(m2w(...g.t));
  camera.near = Math.max(camera.position.distanceTo(controls.target) / 500, 0.005);
  camera.updateProjectionMatrix();
  controls.update();
  for (const b of document.querySelectorAll("[data-goc]")) b.setAttribute("aria-pressed", "false");
  return true;
}

/* ── chọn ──────────────────────────────────────────────────────────────── */
/* CHỌN NHIỀU (Shift+bấm): `chon` là vật chính (bảng thông tin), THEM là các vật chọn thêm. Ẩn (H),
   chỉ xem (I), khung vừa (F) và ghi chú áp cho CẢ NHÓM; ghi chú lưu vật chính ở `neo`, còn lại ở `neo_them`. */
const THEM = new Set();
const vlChon = (o) => (!o.userData.ma && laMa(o) ? VL_CHON_MO : VL_CHON);
function toThem(o, bat) { o.material = bat ? vlChon(o) : (o.userData.vlHien || o.userData.vlGoc); o.userData.vien.material = bat ? VIEN_CHON : VIEN; }
function xoaThem() { for (const o of THEM) toThem(o, false); THEM.clear(); }
const cacChon = () => (chon ? [chon, ...THEM] : []);
function chonCong(o) {
  if (!chon) { datChon(o); return; }
  if (o === chon) { const k = [...THEM].pop(); if (k) THEM.delete(k); datChon(k || null, true); return; }
  if (THEM.has(o)) { THEM.delete(o); toThem(o, false); } else { THEM.add(o); toThem(o, true); }
  hienThongTin();
}
function datChon(o, giu = false) {
  if (!giu) xoaThem();
  if (chon) { chon.material = chon.userData.vlHien || chon.userData.vlGoc; chon.userData.vien.material = VIEN; }
  chon = o || null;
  if (chon) { chon.material = vlChon(chon); chon.userData.vien.material = VIEN_CHON; }
  toMach();
  hienThongTin();
}
/* CÙNG MẠCH ĐIỆN (chủ nhà 3D #506): chọn một điểm điện / bộ đèn mang `mach` ⇒ mọi vật cùng mạch (ổ, công tắc, đèn, thiết
   bị) + tủ cấp mạch ấy tô vàng. Chọn một TỦ (`tu_ma`) ⇒ mọi vật của mọi mạch tủ ấy cấp. Vật thuộc mạch vẽ riêng (khỏi lô). */
const MACH = new Set();
const VL_MACH = new THREE.MeshStandardMaterial({ color: 0xf2c14e, emissive: 0xc98a0b, emissiveIntensity: 0.55, roughness: 0.5 });
VL_MACH.userData.dungChung = true;
/* CÔNG TẮC / BỘ ĐIỀU KHIỂN (chủ nhà 2026-09-28): vật mang `dieu_khien` (dien.py — công tắc) ⇒ bảng bên hiện nút bật/tắt
   các bộ đèn nó điều khiển và nút chuyển thế các công tắc trạng thái (rèm động cơ…) nó điều khiển; đồng thời tô vàng chúng.
   `dieu_khien` = "mach" (mặc định: mọi bộ đèn cùng mạch) hoặc danh sách mã "E-…|rem_o10". */
function dieuKhienCua(u) {
  if (!u || !u.dieu_khien) return null;
  const ma = u.dieu_khien === "mach"
    ? [...new Set(PHAN.filter((o) => o.userData.bo_den && u.mach && o.userData.mach === u.mach).map((o) => o.userData.bo_den))]
    : u.dieu_khien.split("|");
  const den = ma.filter((i) => PHAN.some((o) => o.userData.bo_den === i));
  const quat = ma.filter((i) => PHAN.some((o) => laQuat(o, i)));
  const cms = ma.map((i) => (GOC.userData.chon_mot || []).find((cm) => cm.ma === i)).filter(Boolean);
  return { den, quat, cms };
}
/* QUẠT TRẦN (quat.py: vật tên «<mã hộp> — quạt trần: …»): bật ⇒ ba cánh ẩn, thay bằng đĩa mờ như cánh đang quay. */
const laQuat = (o, id) => (o.userData.ten || "").startsWith(id + " — quạt trần");
function chayQuat(id, bat) {
  const canh = PHAN.filter((o) => laQuat(o, id) && /: cánh \d/.test(o.userData.ten));
  for (const o of canh) { if (bat) CANH_AN.add(o.userData.id); else CANH_AN.delete(o.userData.id); }
  let dia = QUAT_CHAY.get(id);
  if (bat && !dia && canh.length) {
    const b = new THREE.Box3();
    for (const o of canh) b.expandByObject(o);
    const c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
    const mong = sz.x <= sz.y && sz.x <= sz.z ? "x" : (sz.y <= sz.z ? "y" : "z");     // trục quay = chiều mỏng nhất cụm cánh
    const r = Math.max(...["x", "y", "z"].filter((k) => k !== mong).map((k) => sz[k])) / 2;
    dia = new THREE.Mesh(new THREE.CircleGeometry(r, 48),
      new THREE.MeshBasicMaterial({ color: 0x8a6a4a, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    if (mong === "y") dia.rotation.x = -Math.PI / 2; else if (mong === "x") dia.rotation.y = Math.PI / 2;
    dia.position.copy(c); scene.add(dia); QUAT_CHAY.set(id, dia);
  }
  if (dia) dia.visible = bat;
  capNhatHien(); veLai(300);
}
const DEN_BAT = new Set(), DEN_ANH = new Map(), VL_SANG = new Map();
function vlSang(goc) {
  let m = VL_SANG.get(goc);
  if (!m) { m = goc.clone(); m.emissive = new THREE.Color(0xffe2b0); m.emissiveIntensity = 2.2; VL_SANG.set(goc, m); }
  return m;
}
function batDen(id, bat) {
  if (bat) DEN_BAT.add(id); else DEN_BAT.delete(id);
  let L = DEN_ANH.get(id);
  if (bat && !L) {
    const ms = PHAN.filter((o) => o.userData.bo_den === id && o.userData.phat_sang);
    if (ms.length) {
      const b = new THREE.Box3();
      for (const o of ms) b.expandByObject(o);
      const lm = Number(((ms[0].userData.quy_cach || "").match(/(\d+)\s*lm/) || [])[1]) || 600;
      L = new THREE.PointLight(0xffd6a0, 0.12 * lm / (4 * Math.PI), 6, 2);   // ~cd = quang thông/4π, hạ 0,12 vì cảnh đã có trời + nền
      L.position.copy(b.getCenter(new THREE.Vector3()));
      scene.add(L); DEN_ANH.set(id, L);
    }
  }
  if (L) L.visible = bat;
  apMo(); veLai(300);
}
function nutGat(nhan, bat, bam) {
  const g = document.createElement("button"); g.type = "button"; g.className = "gat";
  g.setAttribute("role", "switch"); g.setAttribute("aria-checked", String(bat)); g.setAttribute("aria-label", nhan);
  const t = document.createElement("span"); t.className = "gat-nhan"; t.textContent = bat ? "Bật" : "Tắt";
  const r = document.createElement("span"); r.className = "gat-ray"; r.append(document.createElement("span"));
  g.append(t, r); g.onclick = bam;
  return g;
}
function toMach() {
  for (const o of MACH) if (o !== chon && !THEM.has(o)) o.material = o.userData.vlHien || o.userData.vlGoc;
  MACH.clear();
  const u = chon && chon.userData;
  const dk = dieuKhienCua(u);
  if (dk) {                                            // vật công tắc điều khiển: tô vàng cả đèn + rèm… nó điều khiển
    const den = new Set(dk.den), nhom = new Set(dk.cms.flatMap((cm) => cm.lua_chon.map((lc) => lc.nhom)));
    for (const o of PHAN) {
      if (o === chon || !(den.has(o.userData.bo_den) || dk.quat.some((i) => laQuat(o, i))
        || [...nhom].some((n) => o.userData.nhom && o.userData.nhom.startsWith(n)))) continue;
      MACH.add(o);
      if (!THEM.has(o)) o.material = VL_MACH;
    }
  }
  if (!u || !(u.mach || u.tu_ma)) return;
  const tu = u.tu_ma || u.tu;
  for (const o of PHAN) {
    const v = o.userData;
    if (o === chon || !(u.mach ? (v.mach === u.mach || (tu && v.tu_ma === tu)) : v.tu === tu)) continue;
    MACH.add(o);
    if (!THEM.has(o)) o.material = VL_MACH;
  }
}
function hienThongTin() {
  if (KT && chon !== KT.chon) { KT.chon = chon; veKichThuoc(); }
  $("chua-chon").hidden = !!chon;
  $("thong-tin").hidden = !chon;
  $("gc-tieu-de").textContent = chon ? "Ghi chú cho vật thể này" : "Ghi chú cho góc nhìn này";
  if (!chon) return;
  const u = chon.userData;
  $("tt-nhom").textContent = u.nhom;
  $("tt-ten").textContent = u.ten;
  let th = $("tt-them");
  if (!th) { th = document.createElement("p"); th.id = "tt-them"; th.className = "mo"; $("tt-ten").after(th); }
  th.hidden = THEM.size === 0;
  th.textContent = THEM.size ? `+ ${THEM.size} vật thể chọn thêm (Shift+bấm để bỏ): ${[...THEM].map((o) => o.userData.ten).join(" · ")}` : "";
  // vật thuộc một CÔNG TẮC (cánh cửa đóng/mở…): hiện công tắc ngay ở đây
  let ttc = $("tt-cong-tac");
  if (!ttc) { ttc = document.createElement("div"); ttc.id = "tt-cong-tac"; ttc.className = "hang-cm"; th.after(ttc); }
  ttc.replaceChildren();
  const xcm = congTacCua(u);
  ttc.hidden = !xcm;
  if (xcm) {
    const t = document.createElement("span"); t.textContent = xcm.cm.nhan + " (O)";
    ttc.append(t, nutCongTac(xcm.cm, (lc) => {
      dungLop(GOC.userData.nhom || []); capNhatHien();
      // vật đang chọn vừa bị ẩn ⇒ chọn cánh tương ứng ở chỗ đứng mới
      const moi = PHAN.find((o) => o.userData.nhom === lc.nhom && o.visible);
      if (moi) datChon(moi); else hienThongTin();
    }));
  }
  // CÔNG TẮC ĐIỀU KHIỂN: nút bật/tắt từng bộ đèn + nút chuyển thế từng thứ nó điều khiển (rèm động cơ…)
  let tdk = $("tt-dieu-khien");
  if (!tdk) { tdk = document.createElement("div"); tdk.id = "tt-dieu-khien"; ttc.after(tdk); }
  tdk.replaceChildren();
  const dk = dieuKhienCua(u);
  tdk.hidden = !dk || !(dk.den.length || dk.quat.length || dk.cms.length);
  if (dk) {
    const tieu = document.createElement("p"); tieu.className = "mo"; tieu.textContent = "Công tắc này điều khiển:"; tdk.append(tieu);
    const hang = (nhan, nut) => {
      const h = document.createElement("div"); h.className = "hang-cm";
      const t = document.createElement("span"); t.textContent = nhan; h.append(t, nut); tdk.append(h);
    };
    for (const id of dk.den) {
      const o = PHAN.find((x) => x.userData.bo_den === id && x.userData.phat_sang);
      hang(`Đèn ${id}${o && o.userData.ten ? " — " + o.userData.ten.split(" — ").slice(1, 2).join("") : ""}`,
        nutGat(`Đèn ${id}`, DEN_BAT.has(id), () => { batDen(id, !DEN_BAT.has(id)); hienThongTin(); }));
    }
    if (dk.den.length > 1) {
      const bat = dk.den.every((i) => DEN_BAT.has(i));
      hang("Tất cả đèn", nutGat("Tất cả đèn", bat, () => { for (const i of dk.den) batDen(i, !bat); hienThongTin(); }));
    }
    for (const id of dk.quat) hang(`Quạt trần ${id}`, nutGat(`Quạt ${id}`, QUAT_CHAY.get(id)?.visible || false,
      () => { chayQuat(id, !(QUAT_CHAY.get(id)?.visible)); hienThongTin(); }));
    for (const cm of dk.cms) hang(cm.nhan, nutCongTac(cm, () => { dungLop(GOC.userData.nhom || []); capNhatHien(); toMach(); hienThongTin(); }));
  }
  $("tt-vl").textContent = u.vat_lieu_ten || u.vat_lieu;
  const b = new THREE.Box3();
  // hộp bao theo trục MÔ HÌNH: lấy từ thuộc tính min/max của lưới (đã ở toạ độ mô hình)
  chon.geometry.computeBoundingBox();
  b.copy(chon.geometry.boundingBox);
  const s = b.getSize(new THREE.Vector3());
  $("tt-kt").textContent = `${mm(s.x)} × ${mm(s.y)} × ${mm(s.z)} mm`;
  $("tt-cd").textContent = `+${b.min.z.toFixed(3)} → +${b.max.z.toFixed(3)} m`;
  $("tt-id").textContent = u.id;
  oThuoc(u);
  let ttm = $("tt-mach");
  if (!ttm) { ttm = document.createElement("p"); ttm.id = "tt-mach"; ttm.className = "mo"; $("tt-ten").after(ttm); }
  ttm.hidden = !MACH.size;
  ttm.textContent = MACH.size ? (u.mach ? `Mạch ${u.mach}${u.mach_vi ? " — " + u.mach_vi : ""} · tủ ${u.tu || "?"} · ${MACH.size} vật cùng mạch tô vàng`
    : `Tủ ${u.tu_ma} · ${MACH.size} vật trên các mạch tủ này cấp tô vàng`) : "";
  const xuyen = cacChon().every((o) => vatMo.has(o.userData.id));
  $("nut-xuyen").setAttribute("aria-pressed", String(xuyen));
  $("nut-xuyen").textContent = xuyen ? "Đặc lại (T)" : "Xem xuyên (T)";
  $("nut-xuyen").hidden = !!u.ma;          // khối tham chiếu vốn đã mờ
  $("tt-qc").textContent = u.quy_cach || "";
  $("tt-qc-k").hidden = !u.quy_cach;
  $("tt-nguon").textContent = u.nguon || "";
  $("tt-nguon-k").hidden = !u.nguon;
  $("tt-khop").textContent = (u.khop_voi || "").split("|").join(" · ");
  $("tt-khop-k").hidden = !u.khop_voi;
  const BO = new Set(["id", "ten", "nhom", "vat_lieu", "vat_lieu_ten", "quy_cach", "nguon", "khop_voi", "ma", "vlGoc", "vien", "name"]);
  const khac = Object.entries(u).filter(([k, v]) => !BO.has(k) && (typeof v !== "object"));
  const dl = $("tt-khac");
  dl.replaceChildren();
  for (const [k, v] of khac) {
    const dt = document.createElement("dt"); dt.textContent = k.replace(/_/g, " ");
    const dd = document.createElement("dd"); dd.textContent = String(v);
    dl.append(dt, dd);
  }
  $("tt-khac-k").hidden = khac.length === 0;
}

/* ── bắt điểm ──────────────────────────────────────────────────────────── */
const ray = new THREE.Raycaster();
const chuot = new THREE.Vector2();
let matCat = null;           // THREE.Plane đang cắt (toạ độ thế giới) hoặc null

/* lớp XEM XUYÊN (nút ◐ cạnh tên lớp): vẽ như khối tham chiếu — mờ, bấm xuyên qua được */
const lopMo = new Set();
const VL_MO = new Map();
const VL_NOI = new Map();    // vật liệu gốc → bản sao có sắc làm nổi (kịch bản 3D)
/* LÀM NỔI (kịch bản 3D): tập id vật và tên lớp được giữ nguyên; MỌI vật khác vẽ mờ như ◐. null = không làm nổi.
   Tên lớp khớp theo ĐẦU CHUỖI: «L2 · Lớp lót» khớp «L2 · Lớp lót: RL940 50mm …» và mọi lớp con — phiên khác sửa đuôi tên
   lớp thì cảnh đã lưu vẫn đúng. Ghi đủ mã + tên ngắn («L7 · Trần», không phải «L7») để khỏi khớp lớp khác. */
let NOI_BAT = null;
/* ĐỘ ĐẬM PHẦN CÒN LẠI khi làm nổi (chủ nhà 2026-09-28): mọi vật không được làm nổi vẽ ở độ đậm MO_NOI (0…0,5; mặc định
   0,12). Cảnh mang `mo` thì dùng số ấy — vd ba ô lam khoang trần nhỏ giữa cả mái: mờ phần còn lại nhiều hơn. Chỉ áp cho
   làm nổi; lớp ◐, xem xuyên vẫn mờ 0,12. Thanh «Làm nổi» ở ô trái (trình xem đầy đủ + chế độ soạn). */
const MO_NOI_MD = 0.12;
var MO_NOI = MO_NOI_MD;
const VL_MO_NB = new Map();
function vlMoNB(goc) {
  let m = VL_MO_NB.get(goc);
  if (!m) { m = goc.clone(); m.transparent = true; m.depthWrite = false; VL_MO_NB.set(goc, m); }
  m.opacity = Math.min(MO_NOI, trongSuot(goc));
  return m;
}
/* nét viền chung (VIEN) của phần còn lại mờ theo cùng tỉ lệ khi độ đậm xuống dưới mặc định — không thì ở `mo` 0,04 lưới
   viền của cả mái vẫn đậm như cũ và lấn mất vài vật nhỏ đang làm nổi. Không làm nổi ⇒ viền về độ đậm gốc. */
const VIEN_DAM = VIEN.opacity;
function vienTheoMo() { VIEN.opacity = NOI_BAT ? VIEN_DAM * Math.min(1, MO_NOI / MO_NOI_MD) : VIEN_DAM; }
function datMoNoi(v, giay = 0) {                    // đổi độ đậm, có thể đi dần
  const dich = Math.max(0, Math.min(0.5, Number.isFinite(+v) ? +v : MO_NOI_MD));
  cancelAnimationFrame(datMoNoi.raf);
  const hien = () => {
    for (const [goc, m] of VL_MO_NB) m.opacity = Math.min(MO_NOI, trongSuot(goc));
    vienTheoMo();
    const o = $("mo-noi"); if (o) { o.value = String(Math.round(MO_NOI * 100)); $("mo-noi-so").textContent = Math.round(MO_NOI * 100) + "%"; }
    veLai(60);
  };
  if (!(giay > 0) || Math.abs(dich - MO_NOI) < 1e-3) { MO_NOI = dich; hien(); return; }
  const a = MO_NOI, bd = performance.now();
  const buoc = (now) => {
    const k = Math.min(1, (now - bd) / (giay * 1000));
    MO_NOI = a + (dich - a) * em(k); hien();
    if (k < 1) datMoNoi.raf = requestAnimationFrame(buoc);
  };
  datMoNoi.raf = requestAnimationFrame(buoc);
}
function vlMoCua(goc) {
  let m = VL_MO.get(goc);
  if (!m) { m = goc.clone(); m.transparent = true; m.opacity = 0.12; m.depthWrite = false; VL_MO.set(goc, m); }
  return m;
}
function vlNoiCua(goc) {
  let m = VL_NOI.get(goc);
  if (!m) {
    m = goc.clone(); m.color.lerp(new THREE.Color(0xd9542f), 0.6); m.emissive = new THREE.Color(0xb8412c); m.emissiveIntensity = 0.35;
    VL_NOI.set(goc, m);
  }
  return m;
}
function noiBatCo(o, tap = NOI_BAT) {
  const u = o.userData;
  if (tap.has(u.id)) return true;
  for (const t of tap) {
    if (u.nhom && u.nhom.startsWith(t)) return true;
    if (t.endsWith("*") && u.id && u.id.startsWith(t.slice(0, -1))) return true;   // «lam-khung-*» = mọi vật có mã bắt đầu thế
  }
  return false;
}
const vatMo = new Set();     // id từng vật XEM XUYÊN (nút «Xem xuyên (T)» ở ô bên phải) — như ◐ của lớp, cho một vật
const laMa = (o) => o.userData.ma || lopMo.has(o.userData.nhom) || vatMo.has(o.userData.id);
function apMo() {
  vienTheoMo();
  for (const o of PHAN) {
    if (o.userData.ma) continue;
    const goc = o.userData.vlGoc;
    let m = goc;
    const moRieng = lopMo.has(o.userData.nhom) || vatMo.has(o.userData.id);
    const mo = moRieng || (NOI_BAT && !noiBatCo(o));
    if (mo) m = moRieng ? vlMoCua(goc) : vlMoNB(goc);
    else if (o.userData.phat_sang && DEN_BAT.has(o.userData.bo_den)) m = vlSang(goc);   // đèn đang bật (bảng công tắc)
    // LÀM NỔI: vật được làm nổi mang thêm sắc ấm (tự phát sáng nhẹ) — chỉ làm mờ phần còn lại thì vật nhỏ, mỏng hay
    // màu nhạt (nẹp, màng, tôn trắng) trông như không được chọn. Bản sao theo vật liệu gốc, dùng chung.
    // LÀM NỔI giữ NGUYÊN màu + vật liệu thật của vật (chủ nhà 2026-09-27: «đừng tô cam») — nổi nhờ phần còn lại mờ đi
    // và một viền mảnh tối quanh vật (VIEN_NOI)
    o.userData.vlHien = m;
    if (o !== chon && !THEM.has(o)) o.material = MACH.has(o) ? VL_MACH : m;
    else o.material = vlChon(o);
    vienNoi(o, !mo && !!NOI_BAT && noiBatCo(o));
    o.renderOrder = mo ? 2 : 0;
    o.userData.moNap = mo; demNap(o);
    // đang chuyển làm nổi (chuyenNoiBat): vật đổi phía đi bằng vật liệu mờ dần / rõ dần — kể cả khi apMo chạy lại giữa
    // chừng (bay camera), để chuyển không bị giật về trạng thái cuối
    if (CHUYEN_NB && CHUYEN_NB.tap && o.material === m && !MACH.has(o)
        && !(lopMo.has(o.userData.nhom) || vatMo.has(o.userData.id))) {
      const cu = CHUYEN_NB.tap.cu, mo0 = !!cu && !noiBatCo(o, cu);
      if (mo0 !== mo) { o.material = vlChuyen(mo ? VL_RA : VL_VAO, goc); o.renderOrder = 2; }
    }
  }
}
/* viền cam quanh vật làm nổi. Vật có vân không có sẵn cạnh (khỏi tính lúc mở trang) ⇒ tính khi cần lần đầu, và chỉ hiện
   lúc đang làm nổi. Khối phòng / vật bị phủ kín (khong_vien) không bao giờ có viền. */
function vienNoi(o, bat) {
  const v = o.userData.vien;
  if (!v || o.userData.khoi_phong || o.userData.khong_vien === true || o.userData.khong_vien === "True") return;
  if (bat && v.geometry === HINH_RONG) { v.geometry = new THREE.EdgesGeometry(o.geometry, 25); v.userData.vienMuon = true; }
  if (v.userData.vienMuon) v.visible = bat;
  if (o === chon || THEM.has(o)) return;
  v.material = bat ? VIEN_NOI : VIEN;
}
/* CHUYỂN LÀM NỔI (chủ nhà 2026-09-28): đổi cảnh L1 → L3 thì lớp L1 mờ DẦN đi, L3 rõ DẦN lên — đi thẳng từ trạng thái
   đầu sang trạng thái cuối, KHÔNG có bước giữa bỏ hết làm nổi rồi mới làm nổi lại. Gọi SAU khi NOI_BAT đã là tập mới
   và apMo() đã áp trạng thái cuối; `cu` = tập làm nổi trước đó. Vật đổi phía dùng bản sao vật liệu dùng chung theo
   vật liệu gốc (một bản «mờ dần», một bản «rõ dần»), chỉnh độ trong một lần mỗi khung. Trả Promise xong khi hết. */
const VL_RA = new Map(), VL_VAO = new Map();
var CHUYEN_NB = { raf: 0, xong: null, tap: null };   // var: apMo (ở trên) đọc nó; tap = {cu} khi đang chuyển
function trongSuot(goc) { return goc.transparent ? goc.opacity : 1; }
function vlChuyen(bang, goc) {
  let m = bang.get(goc);
  if (!m) { m = goc.clone(); m.transparent = true; m.depthWrite = false; bang.set(goc, m); }
  return m;
}
const tapKhac = (a, b) => (a ? [...a].sort().join("\n") : "") !== (b ? [...b].sort().join("\n") : "");
function datChuyen(k) {                             // k: 0 = trạng thái đầu, 1 = trạng thái cuối
  const mo = Math.min(MO_NOI, 1);
  for (const [goc, m] of VL_RA) m.opacity = trongSuot(goc) + (Math.min(mo, trongSuot(goc)) - trongSuot(goc)) * k;
  for (const [goc, m] of VL_VAO) m.opacity = Math.min(mo, trongSuot(goc)) + (trongSuot(goc) - Math.min(mo, trongSuot(goc))) * k;
}
function chuyenNoiBat(cu, giay = 0.6) {
  cancelAnimationFrame(CHUYEN_NB.raf);
  if (CHUYEN_NB.xong) { CHUYEN_NB.xong(); CHUYEN_NB.xong = null; }
  if (!(giay > 0) || !tapKhac(cu, NOI_BAT)) return Promise.resolve();
  CHUYEN_NB.tap = { cu };
  datChuyen(0);
  apMo();
  return new Promise((xong) => {
    CHUYEN_NB.xong = () => { CHUYEN_NB.tap = null; apMo(); veLai(60); xong(); };
    const bd = performance.now(), ms = giay * 1000;
    const buoc = (now) => {
      const k = Math.min(1, (now - bd) / ms);
      datChuyen(em(k));
      veLai(60);
      if (k < 1) CHUYEN_NB.raf = requestAnimationFrame(buoc);
      else { const x = CHUYEN_NB.xong; CHUYEN_NB.xong = null; x(); }
    };
    CHUYEN_NB.raf = requestAnimationFrame(buoc);
  });
}
function ban(ev, choMa = false) {
  const r = canvas.getBoundingClientRect();
  chuot.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(chuot, camera);
  const hits = ray.intersectObjects(PHAN.filter((o) => o.visible), false);
  const catBo = (h) => matCat && matCat.distanceToPoint(h.point) < 0;
  const laKhi = (o) => o.userData.vat_lieu === "khoang";
  for (const h of hits) {
    if (catBo(h)) continue;   // phần đã bị cắt bỏ
    if (!choMa && laMa(h.object) && hits.some((k) => !laMa(k.object))) continue;
    // khối KHÍ (khối phòng, khoang) chỉ được chọn khi sau nó không có vật thật nào
    if (laKhi(h.object) && hits.some((k) => !laKhi(k.object) && !catBo(k) && (choMa || !laMa(k.object)))) continue;
    return h;
  }
  return null;
}

let keo = null;
canvas.addEventListener("pointerdown", (e) => { keo = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener("pointerup", (e) => {
  if (e.daDung) { keo = null; return; }                            // cú bấm đã được dùng (đo lux ở chế độ Đèn)
  if (bienDoi) { if (e.button === 0) xongBienDoi(true); keo = null; return; }
  if (vuaKeoTay) { vuaKeoTay = false; keo = null; return; }         // vừa kéo tay nắm, không phải bấm
  if (!keo || Math.hypot(e.clientX - keo.x, e.clientY - keo.y) > 4) { keo = null; return; }
  keo = null;
  if (e.button !== 0) return;
  if (CHI_XEM()) return;                                           // chỉ xem: bấm không chọn vật
  if (cotBat) { chamCot(e); return; }
  if (veMT) { chamMuiTen(e); return; }
  if (vungBat) { chamVung(e); return; }
  const h = ban(e);
  if (doDangBat) { chamDo(h, e); return; }
  const v = banNhap(e);
  if (v) { chonNhap(v); return; }
  const vg = banCTGhi(e);
  if (vg) { batSua(vg.userData.gc, vg.userData.thu); return; }
  if (ctChon) chonNhap(null);
  if (e.shiftKey && h) { chonCong(h.object); return; }             // Shift+bấm: thêm/bớt khỏi nhóm chọn
  diemBam = h ? h.object.worldToLocal(h.point.clone()) : null;   // toạ độ mô hình thật, kể cả khi đang tách lớp
  datChon(h ? h.object : null);
});
canvas.addEventListener("dblclick", (e) => {
  const h = ban(e);
  if (h) { const d = h.point.clone().sub(controls.target); controls.target.add(d); camera.position.add(d); controls.update(); }
});
let diemBam = null;          // điểm (toạ độ mô hình) người xem bấm lần cuối — đi vào ghi chú

const nhanDi = $("nhan-di");
canvas.addEventListener("pointermove", (e) => {
  if (vungBat && vungTam) { xemTruocVung(e); }
  if (keo || !GOC) { nhanDi.hidden = true; return; }
  const h = ban(e);
  if (!h) { nhanDi.hidden = true; canvas.style.cursor = doDangBat ? "crosshair" : ""; return; }
  const r = canvas.getBoundingClientRect();
  nhanDi.style.left = e.clientX - r.left + "px";
  nhanDi.style.top = e.clientY - r.top + "px";
  const p = w2m(h.point);
  nhanDi.textContent = doDangBat ? `${h.object.userData.ten}  ·  +${p.z.toFixed(3)}` : h.object.userData.ten;
  nhanDi.hidden = false;
  canvas.style.cursor = doDangBat ? "crosshair" : CHI_XEM() ? "" : "pointer";
});
canvas.addEventListener("pointerleave", () => { nhanDi.hidden = true; });

/* ── CHỌN MỘT: một vật, nhiều chỗ đứng (cửa ĐÓNG / MỞ) ───────────────────
   Mô hình khai ở nhóm cha (`chon_mot`, xem khung/xuat_glb.py); mỗi chỗ đứng là một lớp con. Ở
   đây thành MỘT công tắc: chỉ một lớp con bật, mặc định theo `mac_dinh`. Hai ô tích riêng thì bật
   được cả hai — ra hai cánh cửa ở hai chỗ cùng lúc. Trạng thái khác mặc định đi vào liên kết (?tt=). */
const CHON_MOT = new Map();        // ma → nhãn đang chọn
const LOP_CHON_MOT = new Map();    // tên lớp con → { cm, nhan }
function khoiChonMot(ds) {
  const q = new Map((Q.get("tt") || "").split(",").filter(Boolean).map((x) => x.split(":")));
  for (const cm of ds) {
    for (const lc of cm.lua_chon) LOP_CHON_MOT.set(lc.nhom, { cm, nhan: lc.nhan });
    const muon = q.get(cm.ma);
    datChonMot(cm, cm.lua_chon.some((lc) => lc.nhan === muon) ? muon : cm.mac_dinh);
  }
}
function datChonMot(cm, nhan) {
  CHON_MOT.set(cm.ma, nhan);
  for (const lc of cm.lua_chon) lc.nhan === nhan ? lopTat.delete(lc.nhom) : lopTat.add(lc.nhom);
}
const laDongMo = (cm) => cm.lua_chon.length === 2 && cm.lua_chon.some((lc) => lc.nhan === "Đóng") && cm.lua_chon.some((lc) => lc.nhan === "Mở");
/* Nút công tắc: HAI lựa chọn ⇒ gạt kiểu iOS một chạm (bật = lựa chọn thứ hai, vd «Mở»); ba lựa chọn trở lên ⇒ dãy nút. */
function nutCongTac(cm, xong) {
  const ht = CHON_MOT.get(cm.ma);
  if (cm.lua_chon.length === 2) {
    const [a, b] = cm.lua_chon;
    const bat = ht === b.nhan;
    const g = document.createElement("button"); g.type = "button"; g.className = "gat";
    g.setAttribute("role", "switch"); g.setAttribute("aria-checked", String(bat)); g.setAttribute("aria-label", cm.nhan);
    g.title = `${a.nhan} ⇄ ${b.nhan}`;
    const nhanGat = document.createElement("span"); nhanGat.className = "gat-nhan"; nhanGat.textContent = bat ? b.nhan : a.nhan;
    const ray_ = document.createElement("span"); ray_.className = "gat-ray"; ray_.append(document.createElement("span"));
    g.append(nhanGat, ray_);
    g.onclick = () => { const lc = bat ? a : b; datChonMot(cm, lc.nhan); xong(lc); };
    return g;
  }
  const nn = document.createElement("span"); nn.className = "nhom-nut nho";
  if (cm.lua_chon.length > 3) nn.classList.add("nhieu");
  nn.setAttribute("role", "group"); nn.setAttribute("aria-label", cm.nhan);
  for (const lc of cm.lua_chon) {
    const b = document.createElement("button"); b.type = "button"; b.textContent = lc.nhan;
    b.setAttribute("aria-pressed", String(ht === lc.nhan));
    b.onclick = () => { datChonMot(cm, lc.nhan); xong(lc); };
    nn.append(b);
  }
  return nn;
}
/* Phím O: chuyển công tắc của vật đang chọn sang lựa chọn KẾ TIẾP (hai lựa chọn thì lật: ngăn kéo, cánh tủ, cửa;
   ba lựa chọn thì xoay vòng: cánh con «Đóng → Lật → Mở»). */
/* Công tắc của một vật: vật trong lớp con của công tắc, HOẶC vật khai `cong_tac: <mã>` (phần cố định của cụm có công
   tắc — thanh đứng cố định của thang kéo: bấm vào đâu trên thang cũng thấy công tắc, chủ nhà 3D #560). */
function congTacCua(u) {
  const x = LOP_CHON_MOT.get(u.nhom);
  if (x || !u.cong_tac) return x;
  for (const v of LOP_CHON_MOT.values()) if (v.cm.ma === u.cong_tac) return v;
  return undefined;
}
function latCongTacChon() {
  if (!chon) return false;
  const x = congTacCua(chon.userData);
  if (!x || x.cm.lua_chon.length < 2) return false;
  const ds = x.cm.lua_chon, i = ds.findIndex((c) => c.nhan === CHON_MOT.get(x.cm.ma));
  const lc = ds[(i + 1) % ds.length];
  datChonMot(x.cm, lc.nhan); dungLop(GOC.userData.nhom || []); capNhatHien();
  const moi = PHAN.find((o) => o.userData.nhom === lc.nhom && o.visible);
  if (moi) datChon(moi); else hienThongTin();
  return true;
}

if (Q.get("ve") === "thu") {
  window.__NHIP_YEN = () => soNhipYen;
  window.__LO = () => LO;                                          // phép thử gộp lưới (out/do_lo.mjs)
  // phép thử: tắt quán tính — đuôi quán tính nhích camera 1/1000 điểm ảnh mãi, đủ lật chỗ hai mặt đồng phẳng (tường ↔ lớp
  // hoàn thiện) chen nhau ⇒ hình «vẽ ép» khác hình trên màn dù không có gì cũ. Ngưỡng camLech() vẫn được thử qua kéo/cuộn.
  controls.enableDamping = false;
}
/* Bật lớp của một vật đang ẩn (bấm kết quả tìm, mở ghi chú): lớp con của công tắc thì CHUYỂN
   công tắc sang chỗ đứng ấy, không bật chồng lên chỗ đứng kia. */
function batLop(nhom) {
  const x = LOP_CHON_MOT.get(nhom);
  if (x) { datChonMot(x.cm, x.nhan); dungLop(GOC.userData.nhom || []); } else lopTat.delete(nhom);
}

/* ── lớp + tìm ─────────────────────────────────────────────────────────── */
function dungLop(nhom) {
  const ul = $("ds-lop");
  ul.replaceChildren();
  const dem = new Map();
  for (const o of PHAN) if (!o.userData.ma && !o.userData.phan_tich && !lkTat.has(o.userData.linh_kien)) dem.set(o.userData.nhom, (dem.get(o.userData.nhom) || 0) + 1);   // lớp của nhóm kết cấu đang tắt thì không liệt kê
  const them = (nhan, so, bat, doi) => {
    const li = document.createElement("li");
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = bat;
    cb.onchange = () => { doi(cb.checked); capNhatHien(); };
    const t = document.createElement("span"); t.textContent = nhan;
    const s = document.createElement("span"); s.className = "so"; s.textContent = so;
    const lb = document.createElement("label"); lb.style.display = "contents";
    lb.append(cb, t, s); li.append(lb); ul.append(li);
    return li;
  };
  const cmK = $("ds-chon-mot");
  cmK.replaceChildren();
  // Công tắc phương án có thể chỉ chứa nhóm con (cánh cửa, phụ kiện), không có lưới trực tiếp.
  const coVat = (nhom) => [...dem.keys()].some((n) => n === nhom || n.startsWith(nhom + " / "));
  for (const cm of GOC.userData.chon_mot || []) {
    if (!cm.lua_chon.some((lc) => coVat(lc.nhom))) continue;     // nhóm kết cấu mang nó đang tắt
    const hang = document.createElement("div"); hang.className = "hang-cm";
    const t = document.createElement("span"); t.textContent = cm.nhan;
    hang.append(t, nutCongTac(cm, () => { dungLop(GOC.userData.nhom || []); capNhatHien(); }));
    cmK.append(hang);
  }
  const hai = (GOC.userData.chon_mot || []).filter((cm) => laDongMo(cm) && cm.lua_chon.some((lc) => coVat(lc.nhom)));
  if (hai.length > 1) {                                            // «Mở hết / Đóng hết» — chỉ công tắc Đóng|Mở
    const hang = document.createElement("div"); hang.className = "hang-cm hang-het";
    const t = document.createElement("span"); t.textContent = `${hai.length} công tắc Đóng | Mở`;
    const nn = document.createElement("span"); nn.className = "nhom-nut nho";
    for (const nhan of ["Đóng", "Mở"]) {
      const b = document.createElement("button"); b.type = "button"; b.textContent = nhan === "Mở" ? "Mở hết" : "Đóng hết";
      b.onclick = () => { for (const cm of hai) datChonMot(cm, nhan); dungLop(GOC.userData.nhom || []); capNhatHien(); if (chon) hienThongTin(); };
      nn.append(b);
    }
    hang.append(t, nn); cmK.prepend(hang);
  }
  cmK.hidden = !cmK.children.length;
  for (const n of nhom) {
    if (!dem.has(n) || LOP_CHON_MOT.has(n)) continue;              // lớp con của công tắc: lái bằng công tắc
    const li = them(n, dem.get(n), !lopTat.has(n), (v) => (v ? lopTat.delete(n) : lopTat.add(n)));
    const mo = document.createElement("button");
    mo.type = "button"; mo.className = "nut-mo"; mo.textContent = "◐";
    mo.title = "Xem xuyên: vẽ lớp này như khối tham chiếu (mờ, bấm xuyên qua)";
    mo.setAttribute("aria-pressed", String(lopMo.has(n)));
    mo.onclick = (e) => { e.preventDefault(); lopMo.has(n) ? lopMo.delete(n) : lopMo.add(n); mo.setAttribute("aria-pressed", String(lopMo.has(n))); apMo(); };
    li.append(mo);
  }
  const soMa = PHAN.filter((o) => o.userData.ma).length;
  if (soMa) them("Khối tham chiếu (không thi công)", soMa, hienMa, (v) => (hienMa = v));
}
/* nắng thật: nút, bảng, phím N, ?nang=<ngày 1–365>,<giờ> */
if ($("nut-nang")) {
  $("nut-nang").onclick = () => datNang({ bat: !NANG.bat });
  $("nang-ngay").oninput = (e) => datNang({ ngay: Number(e.target.value) });
  $("nang-gio").oninput = (e) => datNang({ gio: Number(e.target.value) / 4 });
  $("nang-chay").onclick = chayNgay;
  for (const b of document.querySelectorAll("#bang-nang [data-ngay]")) b.onclick = () => {
    const n = new Date(), dau = Date.UTC(n.getFullYear(), 0, 1);
    datNang({ ngay: b.dataset.ngay === "hom-nay" ? Math.floor((Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) - dau) / 864e5) + 1 : Number(b.dataset.ngay) });
  };
  addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (document.body.classList.contains("nhung") && !document.body.classList.contains("nhung-sua")) return;   // trang việc trên site: không có nắng
    if (CHI_XEM()) return;
    datNang({ bat: !NANG.bat });
  });
  const qn = Q.get("nang");
  if (qn) READY.then(() => { const [a, b] = qn.split(",").map(Number); datNang({ bat: true, ngay: a || 172, gio: Number.isFinite(b) ? b : 8 }); });
}
if ($("nut-vien")) {
  if (!NET) $("nut-vien").hidden = true;                          // ?thuc=0 / ?vien=0: không có lượt nét viền
  else { $("nut-vien").setAttribute("aria-pressed", String(NET.bat())); $("nut-vien").onclick = () => NET.dat(!NET.bat()); }
}
$("hien-het").onclick = () => { anTay.clear(); rieng = null; vatMo.clear(); apMo(); capNhatHien(); if (chon) hienThongTin(); };

$("tim").addEventListener("input", () => {
  const q = boDau($("tim").value.trim());
  const ul = $("ket-qua");
  ul.replaceChildren();
  if (q.length < 2) return;
  const kq = PHAN.filter((o) => boDau(o.userData.ten).includes(q)).slice(0, 40);
  for (const o of kq) {
    const li = document.createElement("li");
    li.textContent = o.userData.ten;
    li.onclick = () => { if (!hienDuoc(o)) { anTay.delete(o.userData.id); rieng = null; batLop(o.userData.nhom); if (lkTat.delete(o.userData.linh_kien)) dungNhomKetCau(); if (o.userData.ma) hienMa = true; dungLop(GOC.userData.nhom || []); capNhatHien(); } datChon(o); khungVua([o]); };
    ul.append(li);
  }
});
function boDau(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase(); }

/* ── ẩn / riêng / khung ────────────────────────────────────────────────── */
function anChon() { if (chon) { for (const o of cacChon()) anTay.add(o.userData.id); datChon(null); capNhatHien(); } }
function riengChon() {
  if (rieng) { rieng = null; capNhatHien(); return; }
  if (chon) { rieng = new Set(cacChon().map((o) => o.userData.id)); capNhatHien(); khungVua(cacChon()); }
}
function khungChon() { khungVua(chon ? cacChon() : phanKhung()); }
$("nut-an").onclick = anChon;
/* XEM XUYÊN một vật (hay mọi vật đang chọn): mờ như khối tham chiếu, bấm xuyên qua được. Bấm lại để đặc
   trở lại; vật đang xem xuyên liệt kê dưới «Lớp» cùng vật đã ẩn — bấm một dòng để đặc lại. */
function xuyenChon() {
  const ds = cacChon();
  if (!ds.length) return;
  const tat = ds.every((o) => vatMo.has(o.userData.id));
  for (const o of ds) tat ? vatMo.delete(o.userData.id) : vatMo.add(o.userData.id);
  apMo(); dungDsAn(); hienThongTin();
}
$("nut-xuyen").onclick = xuyenChon;
$("nut-rieng").onclick = riengChon;
$("nut-khung").onclick = khungChon;

/* ── mặt cắt ───────────────────────────────────────────────────────────── */
let trucCat = "z";
let catViTriM = null;        // vị trí cắt CHÍNH XÁC (m, toạ độ mô hình) do catM/mặt cắt sẵn đặt; kéo thanh trượt là bỏ
let catMHien = null;         // vị trí cắt đang vẽ (m, toạ độ mô hình) — cho XEM.trangThai (kịch bản 3D)
function capNhatCat() {
  if ($("bang-cat").hidden) { renderer.clippingPlanes = []; matCat = null; datNapCat(); return; }
  for (const b of document.querySelectorAll("[data-truc]")) b.setAttribute("aria-pressed", String(b.dataset.truc === trucCat));
  const k = { x: 0, y: 1, z: 2 }[trucCat];
  const bb = new THREE.Box3();
  for (const o of PHAN) if (!o.userData.ma) { o.geometry.computeBoundingBox(); bb.union(o.geometry.boundingBox); }
  const lo = bb.min.getComponent(k), hi = bb.max.getComponent(k);
  const t = Number($("cat-vi-tri").value) / 1000;
  const v = catViTriM != null ? catViTriM : lo + (hi - lo) * t;
  catMHien = v;
  const dao = $("cat-dao").checked;
  const n = [0, 0, 0]; n[k] = dao ? 1 : -1;          // mặc định: giữ phần có toạ độ NHỎ hơn
  const p = [0, 0, 0]; p[k] = v;
  const nW = m2w(...n).sub(m2w(0, 0, 0)).normalize();
  matCat = new THREE.Plane().setFromNormalAndCoplanarPoint(nW, m2w(...p));
  renderer.clippingPlanes = [matCat];
  $("cat-so").textContent = (trucCat === "z" ? "+" : "") + v.toFixed(3) + " m";
  datNapCat();
}
function batCat(bat, truc, viTri, dao) {
  $("bang-cat").hidden = !bat;
  $("nut-cat").setAttribute("aria-pressed", String(bat));
  if (truc) trucCat = truc;
  if (viTri != null) { $("cat-vi-tri").value = String(viTri); catViTriM = null; }
  if (dao != null) $("cat-dao").checked = dao;
  capNhatCat();
}
/* TỰ CHỌN PHÍA (chủ nhà 2026-09-30): lúc bật «Cắt» hay đổi hướng cắt, giữ phần NẰM XA camera — camera đứng bên phần bị
   cắt bỏ nên luôn nhìn thẳng vào mặt cắt. Kéo thanh trượt không lật phía; «Đảo phía» vẫn bấm tay được. Cảnh / liên kết
   đặt sẵn phía (batCat có dao) thì giữ nguyên. */
function tuChonPhia() {
  if (!GOC || catMHien == null) return;
  const c = w2m(camera.position)[trucCat];
  $("cat-dao").checked = c < catMHien;          // camera ở phía toạ độ nhỏ ⇒ giữ phía lớn (đảo)
  capNhatCat();
}
function bamCat() { const bat = $("bang-cat").hidden; batCat(bat); if (bat) tuChonPhia(); }
$("nut-cat").onclick = bamCat;
function boCatSan() { catViTriM = null; catSanDang = -1; veCatSan(); }
for (const b of document.querySelectorAll("[data-truc]")) b.onclick = () => { trucCat = b.dataset.truc; boCatSan(); capNhatCat(); tuChonPhia(); };
$("cat-vi-tri").oninput = () => { boCatSan(); capNhatCat(); };
$("cat-dao").onchange = () => { catSanDang = -1; veCatSan(); capNhatCat(); };
function catTaiM(truc, m, dao) {      // cắt tại toạ độ mô hình m (mét) — đúng từng mm, thanh trượt chỉ theo gần đúng
  const k = { x: 0, y: 1, z: 2 }[truc];
  const bb = new THREE.Box3();
  for (const o of PHAN) if (!o.userData.ma) { o.geometry.computeBoundingBox(); bb.union(o.geometry.boundingBox); }
  const lo = bb.min.getComponent(k), hi = bb.max.getComponent(k);
  batCat(true, truc, Math.round(((m - lo) / (hi - lo)) * 1000), dao);
  catViTriM = m;
  catSanDang = -1; veCatSan();
  capNhatCat();
}

/* ── TÔ MẶT CẮT (nắp) ─────────────────────────────────────────────────────────
   Khi bật mặt cắt, mặt bị cắt của mọi khối ĐẶC KÍN được tô màu + nét gạch theo vật liệu,
   như mặt cắt kiến trúc — không có nó thì khối cắt ra rỗng và lớp mỏng không đọc được.
   Cách làm (stencil): mỗi nhóm vật liệu, vẽ mặt SAU (+1) và mặt TRƯỚC (−1) của khối đã bị
   cắt vào bộ đệm stencil, không ra màu; chỗ nào stencil ≠ 0 là chỗ mặt phẳng cắt nằm TRONG
   khối ⇒ vẽ một tấm lớn nằm trên mặt phẳng cắt, chỉ ở đó, và xoá stencil về 0 cho nhóm sau.
   Thứ tự nhờ renderOrder (vật thể 0 · nhóm g: đếm 1+0,01g, nắp 1+0,01g+0,005 · vật chú thích ≥3).
   Tấm nắp là ShaderMaterial không có đoạn clipping ⇒ mặt cắt không cắt chính nó.
   Chỉ khối KÍN 2-đa tạp (mỗi cạnh đúng hai tam giác, ngược chiều nhau) mới được tô — tô một
   lưới hở là tô tràn cả màn hình. Kính, lưới, khối tham chiếu, khoang khí không tô. */
const KHONG_TO = new Set(["kinh", "kinh_mu", "luoi", "ma", "khoang"]);
// khoá vật liệu → [nền, mực, kiểu nét, bước px]; kiểu: 0 đặc · 1 gạch chéo · 2 gạch chéo lưới
// · 3 bê tông (chấm + chéo thưa) · 4 sóng (bông khoáng) · 5 chấm
const KIEU_NAP = {
  betong: [0xd9d4c9, 0x5f5a50, 3, 10],
  tuong: [0xecd3c3, 0x8a4b35, 1, 7],
  thach_cao: [0xf7f4ee, 0xf7f4ee, 0, 0],
  bong_khoang: [0xf2dc86, 0x9c7a1e, 4, 8],
  mang_lot: [0xd4856e, 0xd4856e, 0, 0],
  mang_ct: [0x5e1f12, 0x5e1f12, 0, 0],
  xa_go: [0x3b4046, 0x3b4046, 0, 0],
  khung_tran: [0x5a616a, 0x5a616a, 0, 0],
  thep: [0x42484f, 0x42484f, 0, 0],
  inox: [0xa3a9af, 0x5c636a, 1, 4],
  nhom: [0x7f8791, 0x7f8791, 0, 0],
  ton: [0x26303a, 0x26303a, 0, 0],
  hap: [0x1c1c1c, 0x1c1c1c, 0, 0],
  panel: [0xe6e0d2, 0x8a8478, 2, 6],
  epdm: [0x0f0f0f, 0x0f0f0f, 0, 0],
  nap: [0x656c75, 0x656c75, 0, 0],
  thang: [0x6c7176, 0x6c7176, 0, 0],
  van_di: [0x5b6269, 0x5b6269, 0, 0],
};
const v3Hex = (h) => new THREE.Vector3(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);
function kieuNapCua(khoa, vl) {
  if (KIEU_NAP[khoa]) return KIEU_NAP[khoa];
  const c = vl.color ? vl.color.getHex() : 0x888888;      // sRGB
  const toi = (h) => Math.round(((c >> h) & 255) * 0.7) << h;
  const nen = toi(16) | toi(8) | toi(0);
  return [nen, 0x1d1d1b, 1, 8];
}
/* mo = nắp của vật đang MỜ (làm nổi vật khác, ◐, xem xuyên): trong suốt như chính vật mờ, vẽ ở lượt trong suốt */
const NAP_MO = 0.14;
function vlNap(kieu, mo = false) {
  const [nen, muc, k, buoc] = kieu;
  return new THREE.ShaderMaterial({
    uniforms: { uNen: { value: v3Hex(nen) }, uMuc: { value: v3Hex(muc) }, uKieu: { value: k }, uBuoc: { value: buoc || 8 }, uPR: { value: 1 },
      uA: { value: mo ? NAP_MO : NET ? 0 : 1 } },           // alpha 0 = dấu cho lượt nét viền (NET): màu này đã là màu hiển thị
    transparent: mo, depthWrite: !mo,
    // độ sâu logarit (LOG_Z): nắp viết độ sâu cùng thang với mọi vật — three tự đặt USE_LOGDEPTHBUF cho ShaderMaterial
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uNen; uniform vec3 uMuc; uniform float uKieu; uniform float uBuoc; uniform float uPR; uniform float uA;
      float net(float d, float s, float w) { float r = mod(d, s); r = min(r, s - r); return 1.0 - smoothstep(w * 0.5, w * 0.5 + 0.9, r); }
      void main() {
        #include <logdepthbuf_fragment>
        vec2 p = gl_FragCoord.xy / uPR;
        float s = uBuoc, m = 0.0;
        if (uKieu > 0.5 && uKieu < 1.5) m = net((p.x + p.y) * 0.7071, s, 0.8);
        else if (uKieu < 2.5 && uKieu > 1.5) m = max(net((p.x + p.y) * 0.7071, s, 0.7), net((p.x - p.y) * 0.7071, s, 0.7));
        else if (uKieu < 3.5 && uKieu > 2.5) {
          vec2 q = p + vec2(floor(p.y / s) * s * 0.5, 0.0);
          vec2 c = mod(q, s) - 0.5 * s;
          m = max(1.0 - smoothstep(0.6, 1.5, length(c)), 0.8 * net((p.x + p.y) * 0.7071, s * 3.0, 0.7));
        }
        else if (uKieu < 4.5 && uKieu > 3.5) m = net(p.y + sin(p.x * 6.2832 / (s * 2.0)) * s * 0.35, s, 0.9);
        else if (uKieu > 4.5) { vec2 c = mod(p, s) - 0.5 * s; m = 1.0 - smoothstep(0.6, 1.5, length(c)); }
        gl_FragColor = vec4(mix(uNen, uMuc, m), uA);
      }`,
    side: THREE.DoubleSide,
    stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp,
  });
}
function vlDem(mat, tang, mo = false) {
  const op = tang ? THREE.IncrementWrapStencilOp : THREE.DecrementWrapStencilOp;
  return new THREE.MeshBasicMaterial({ side: mat, colorWrite: false, depthWrite: false, depthTest: false, transparent: mo,
    stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc, stencilFail: op, stencilZFail: op, stencilZPass: op });
}
// bộ đếm của vật MỜ: cờ transparent để vào lượt trong suốt, cùng lượt với nắp mờ (không vẽ màu nên cờ ấy không đổi hình)
const VL_DEM = { sauTang: vlDem(THREE.BackSide, true), truocGiam: vlDem(THREE.FrontSide, false),
                 sauGiam: vlDem(THREE.BackSide, false), truocTang: vlDem(THREE.FrontSide, true),
                 moSauTang: vlDem(THREE.BackSide, true, true), moTruocGiam: vlDem(THREE.FrontSide, false, true),
                 moSauGiam: vlDem(THREE.BackSide, false, true), moTruocTang: vlDem(THREE.FrontSide, true, true) };
for (const m of [VL_GACH_KINH, VL_CHON, VL_CHON_MO, VIEN, VIEN_CHON, VL_KHOANG, VL_KHOI_PHONG, ...Object.values(VL_DEM)]) m.userData.dungChung = true;   // giaiPhong() không huỷ
/* 1 = kín, pháp tuyến ra ngoài · −1 = kín, pháp tuyến vào trong · 0 = hở / không nhất quán */
function kinCua(geo) {
  const pos = geo.attributes.position, idx = geo.index;
  const n = idx ? idx.count : pos.count;
  const so = new Map(), ma = new Int32Array(pos.count), P = [];
  for (let i = 0; i < pos.count; i++) {
    const k = Math.round(pos.getX(i) * 1e5) + "," + Math.round(pos.getY(i) * 1e5) + "," + Math.round(pos.getZ(i) * 1e5);
    let v = so.get(k); if (v === undefined) { v = so.size; so.set(k, v); P.push(new V3().fromBufferAttribute(pos, i)); } ma[i] = v;
  }
  const canh = new Map();                  // khoá cạnh (nhỏ, lớn) → [xuôi, ngược]
  const A = new V3(), B = new V3(), C = new V3();
  let tt = 0, soTG = 0;
  for (let t = 0; t + 2 < n; t += 3) {
    const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
    const a = ma[i0], b = ma[i1], c = ma[i2];
    if (a === b || b === c || a === c) continue;
    soTG++;
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      const k = p < q ? p * 4194304 + q : q * 4194304 + p;
      let e = canh.get(k); if (!e) { e = [0, 0]; canh.set(k, e); }
      e[p < q ? 0 : 1]++;
    }
    A.fromBufferAttribute(pos, i0); B.fromBufferAttribute(pos, i1); C.fromBufferAttribute(pos, i2);
    tt += A.dot(B.cross(C)) / 6;
  }
  if (!soTG) return 0;
  const lech = [];                         // cạnh chưa cân (xuôi ≠ ngược)
  for (const [k, e] of canh) if (e[0] !== e[1]) lech.push([Math.floor(k / 4194304), k % 4194304, e[0], e[1]]);
  if (lech.length && !vaChuT(lech, P)) return 0;
  return tt >= 0 ? 1 : -1;
}
/* chữ T: một cạnh dài bên này khớp với hai-ba cạnh ngắn bên kia (đỉnh nằm giữa cạnh) — lưới vẫn kín
   về hình học. Chẻ mỗi cạnh lệch tại các đỉnh nằm trên nó rồi đếm lại; cân hết ⇒ kín. */
function vaChuT(lech, P) {
  if (lech.length > 4000) return false;
  const dinh = [...new Set(lech.flatMap((e) => [e[0], e[1]]))];
  const dem = new Map();
  const cong = (a, b, n) => { const k = a < b ? a * 4194304 + b : b * 4194304 + a; dem.set(k, (dem.get(k) || 0) + (a < b ? n : -n)); };
  const d = new V3(), w = new V3();
  for (const [p, q, xuoi, nguoc] of lech) {
    const A = P[p], B = P[q];
    d.subVectors(B, A); const L2 = d.lengthSq();
    const giua = [];
    for (const c of dinh) {
      if (c === p || c === q) continue;
      w.subVectors(P[c], A);
      const t = w.dot(d) / L2;
      if (t <= 1e-6 || t >= 1 - 1e-6) continue;
      if (w.addScaledVector(d, -t).lengthSq() < 1e-10) giua.push([t, c]);
    }
    giua.sort((x, y) => x[0] - y[0]);
    const chuoi = [p, ...giua.map((g) => g[1]), q];
    for (let i = 0; i + 1 < chuoi.length; i++) cong(chuoi[i], chuoi[i + 1], xuoi - nguoc);
  }
  for (const v of dem.values()) if (v !== 0) return false;
  return true;
}
const NAP = [];                 // [{ khoa, nap: Mesh, dem: [Mesh] }]
const HO = [];                  // id các lưới đặc nhưng hở — không tô được (XEM.napCat() liệt kê)
let hopTheGioi = null;          // hộp bao mô hình (thế giới) — cỡ tấm nắp
function dungNapCat() {
  const nhom = new Map();
  let hoKhong = 0;
  hopTheGioi = new THREE.Box3();
  for (const o of PHAN) {
    const u = o.userData;
    if (!u.ma) hopTheGioi.expandByObject(o);
    const kin = u.kinSo !== undefined ? u.kinSo : kinCua(o.geometry);
    u.kin = kin !== 0;                     // cột lớp cũng dùng: khối kín ⇒ các điểm cắt đi thành cặp vào/ra
    if (u.ma || KHONG_TO.has(u.vat_lieu) || o.material.transparent) continue;
    if (!kin) { hoKhong++; HO.push(u.id); continue; }
    if (!nhom.has(u.vat_lieu)) nhom.set(u.vat_lieu, []);
    nhom.get(u.vat_lieu).push([o, kin]);
  }
  [...nhom.keys()].sort().forEach((khoa, g) => {
    const ds = nhom.get(khoa);
    const r0 = 1 + g * 0.01;
    const dem = [];
    /* NẮP MỜ: vật đang mờ đếm vào bộ đếm riêng ở lượt trong suốt (renderOrder 1,5+… < vật mờ 2), tô bằng nắp trong suốt —
       mặt cắt của vật bị làm mờ cũng mờ theo, không nổi đậm giữa khung. Nét viền bật (NET) thì lượt trong suốt vẽ ở
       lớp camera 1 (xem NET.ve) ⇒ bộ đếm mờ + nắp mờ nằm ở lớp 1. */
    const r1 = 1.5 + g * 0.01, lopMoCam = NET ? 1 : 0;
    /* BỘ ĐẾM GỘP LÔ (soát hiệu năng 2026-09-27): trước là 4 lưới con ẩn MỖI khối kín (~17.000 vật trong cây cảnh, tính ma
       trận mỗi khung; bật cắt là ~15.000 lượt vẽ). Nay mỗi nhóm vật liệu vài BatchedMesh — (thường | mờ) × (mặt sau | mặt
       trước) × (khối hướng ra | hướng vào) — một lượt vẽ mỗi lô; dongBoDem() chép hiện/ẩn + ma trận của từng khối vào lô. */
    for (const [laMo, bo] of [[0, [["sauTang", "truocGiam"], ["sauGiam", "truocTang"]]], [1, [["moSauTang", "moTruocGiam"], ["moSauGiam", "moTruocTang"]]]])
      for (const [dau, cap] of [[1, bo[0]], [-1, bo[1]]]) {
        const vat = ds.filter(([, k]) => k === dau).map(([o]) => o);
        if (!vat.length) continue;
        for (const ten of cap) {
          const bm = loDem(vat, VL_DEM[ten]);
          bm.renderOrder = laMo ? r1 : r0;
          if (laMo) bm.layers.set(lopMoCam);
          dem.push({ bm, laMo: !!laMo, vat: bm.userData.vat });
        }
      }
    const kieu = kieuNapCua(khoa, ds[0][0].material);
    // vật liệu nắp dùng lại qua các lần dựng lại (thêm nhóm về sau) — không huỷ vật liệu đang được biên dịch nền
    const vlN = VL_NAP.get(khoa) || VL_NAP.set(khoa, [vlNap(kieu), vlNap(kieu, true)]).get(khoa);
    const nap = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), vlN[0]);
    nap.renderOrder = r0 + 0.005; nap.visible = false; nap.frustumCulled = false; nap.raycast = () => {};
    const napMo = new THREE.Mesh(nap.geometry, vlN[1]);
    napMo.renderOrder = r1 + 0.005; napMo.visible = false; napMo.frustumCulled = false; napMo.raycast = () => {};
    napMo.layers.set(lopMoCam);
    scene.add(nap, napMo);
    NAP.push({ khoa, nap, napMo, dem, vat: ds.map((x) => x[0]), so: ds.length });
  });
  if (hoKhong) console.info(`tô mặt cắt: ${NAP.reduce((n, g) => n + g.so, 0)} khối kín trong ${NAP.length} nhóm vật liệu, bỏ ${hoKhong} lưới hở/không kín`);
}
function datNapCat() {
  boiBong();
  const bat = !!matCat;
  const pr = renderer.getPixelRatio();
  for (const g of NAP) {
    for (const d of g.dem) d.bm.visible = bat;
    g.nap.visible = g.napMo.visible = bat;
    if (!bat) continue;
    const tam = matCat.projectPoint(hopTheGioi.getCenter(new V3()), new V3());
    const s = hopTheGioi.getSize(new V3()).length() * 4 + 1;
    for (const n of [g.nap, g.napMo]) {
      n.position.copy(tam);
      n.quaternion.setFromUnitVectors(new V3(0, 0, 1), matCat.normal);
      n.scale.set(s, s, 1);
      n.material.uniforms.uPR.value = pr;
    }
  }
}
/* bộ đếm nắp theo trạng thái mờ của vật (apMo đặt userData.moNap): lô đếm đọc cờ ấy ở dongBoDem — ở đây chỉ hẹn vẽ lại */
function demNap() {}
/* lưới chỉ-vị-trí có chỉ số, dùng chung theo lưới gốc — mọi lưới trong một BatchedMesh phải cùng bộ thuộc tính */
const HINH_DEM = new Map();
function hinhDem(g) {
  let h = HINH_DEM.get(g.uuid);
  if (h) return h;
  const p = g.attributes.position;
  h = new THREE.BufferGeometry();
  h.setAttribute("position", p.isInterleavedBufferAttribute || p.normalized
    ? new THREE.BufferAttribute(Float32Array.from({ length: p.count * 3 }, (_, i) => p.getComponent(Math.floor(i / 3), i % 3)), 3) : p);
  h.setIndex(g.index || [...Array(p.count).keys()]);
  HINH_DEM.set(g.uuid, h);
  return h;
}
function loDem(vat, vl) {
  const hinh = vat.map((o) => hinhDem(o.geometry)), rieng = [...new Set(hinh)];
  const nv = rieng.reduce((a, h) => a + h.attributes.position.count, 0), ni = rieng.reduce((a, h) => a + h.index.count, 0);
  const bm = new THREE.BatchedMesh(vat.length, nv, ni, vl);
  bm.colorTexture = null;                        // như dungLo: tránh «đổi chương trình» mỗi lượt vẽ (three r170)
  const gid = new Map(rieng.map((h) => [h, bm.addGeometry(h)]));
  bm.userData.vat = vat.map((o, i) => {
    const iid = bm.addInstance(gid.get(hinh[i]));
    bm.setVisibleAt(iid, false);
    return { o, iid, hien: false, mt: new Float32Array(16).fill(NaN) };
  });
  bm.sortObjects = false; bm.frustumCulled = false;   // tách lớp dời khối ⇒ hộp bao cả lô cũ; từng khối vẫn tự loại theo khung nhìn
  bm.visible = false; bm.raycast = () => {}; bm.userData.dem = true; bm.name = "đếm nắp " + vl.uuid.slice(0, 4);
  scene.add(bm);
  return bm;
}
/* mỗi khung vẽ, CHỈ khi đang cắt: hiện/ẩn + ma trận từng khối chép vào lô đếm (đọc TRƯỚC khi lô gộp giấu vật gốc) */
function dongBoDem() {
  if (!matCat) return;
  for (const g of NAP) for (const d of g.dem) {
    const bm = d.bm;
    for (const x of d.vat) {
      const o = x.o, hien = o.visible && !!o.userData.moNap === d.laMo;
      if (hien !== x.hien) { bm.setVisibleAt(x.iid, hien); x.hien = hien; }
      if (!hien) continue;
      const e = o.matrixWorld.elements, m = x.mt;
      if (e[12] !== m[12] || e[13] !== m[13] || e[14] !== m[14] || e[0] !== m[0] || e[5] !== m[5] || e[10] !== m[10] || e[1] !== m[1]) {
        bm.setMatrixAt(x.iid, o.matrixWorld); m.set(e);
      }
    }
  }
}

/* ── CỘT LỚP (phím L): bấm một điểm → tia thẳng đứng đi xuống (−z mô hình) qua MỌI vật thể
   đang hiện tại (x, y) ấy → bảng từ trên xuống: tên, vật liệu, cao độ đỉnh/đáy, dày, khe tới lớp
   dưới. Mọi số là toạ độ MÔ HÌNH (đọc qua worldToLocal của chính vật ⇒ đúng cả khi đang tách lớp).
   Đang có mặt cắt đứng (x/y) thì điểm lấy TRÊN mặt phẳng cắt — đúng chỗ đang nhìn thấy nắp. */
let cotBat = false;
const nhomCot = new THREE.Group();
const fz = (z) => (z >= 0 ? "+" : "−") + Math.abs(z).toFixed(3);
function fmm(m) {
  const v = m * 1000;
  return Math.abs(v) < 10 ? v.toLocaleString("vi-VN", { maximumFractionDigits: 1 }) : Math.round(v).toLocaleString("vi-VN");
}
function batCot(bat) {
  if (bat) { thoiThem(); if (doDangBat) batDo(false); huyVung(); }
  cotBat = bat;
  $("nut-cot").setAttribute("aria-pressed", String(bat));
  $("bang-cot").hidden = !bat;
  if (!bat) { xoaCon(nhomCot); return; }
  if (!nhomCot.parent && GOC) GOC.add(nhomCot);
  $("cot-vi-tri").textContent = "";
  $("cot-than").replaceChildren();
  $("cot-huong-dan").textContent = "Bấm một điểm trên mô hình (hoặc trên mặt cắt đứng) để đọc các lớp theo phương đứng. Esc hoặc L: thôi";
}
function cotLop(x, y) {
  const b = new THREE.Box3();
  for (const o of PHAN) { o.geometry.computeBoundingBox(); b.union(o.geometry.boundingBox); }
  const rc = new THREE.Raycaster(m2w(x, y, b.max.z + 1), trucThe("z", -1), 0, Infinity);
  const hits = rc.intersectObjects(PHAN.filter((o) => o.visible), false);
  const theoVat = new Map();
  for (const h of hits) {
    const z = h.object.worldToLocal(h.point.clone()).z;
    if (!theoVat.has(h.object)) theoVat.set(h.object, []);
    const ds = theoVat.get(h.object);
    if (!ds.some((q) => Math.abs(q - z) < 1e-6)) ds.push(z);
  }
  const hang = [];
  for (const [o, zs] of theoVat) {
    zs.sort((p, q) => q - p);
    const u = o.userData;
    if (u.kin || zs.length % 2 === 0) for (let i = 0; i < zs.length; i += 2) hang.push({ o, tren: zs[i], duoi: zs[Math.min(i + 1, zs.length - 1)] });
    else for (const z of zs) hang.push({ o, tren: z, duoi: z });
  }
  hang.sort((p, q) => q.tren - p.tren || q.duoi - p.duoi);
  const kq = hang.map((h, i) => ({
    id: h.o.userData.id, ten: h.o.userData.ten, vat_lieu: h.o.userData.vat_lieu_ten || h.o.userData.vat_lieu,
    tren: +h.tren.toFixed(4), duoi: +h.duoi.toFixed(4), day_mm: +((h.tren - h.duoi) * 1000).toFixed(1),
    khe_mm: i + 1 < hang.length ? +((h.duoi - hang[i + 1].tren) * 1000).toFixed(1) : null,
  }));
  veCot(x, y, hang, kq);
  return kq;
}
function veCot(x, y, hang, kq) {
  if (!cotBat) batCot(true);
  xoaCon(nhomCot);
  const tren = hang.length ? hang[0].tren + 0.3 : 12, duoi = hang.length ? hang[hang.length - 1].duoi - 0.3 : 0;
  const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(x, y, tren), new V3(x, y, duoi)]),
    new THREE.LineBasicMaterial({ color: MAU_GHI, depthTest: false }));
  ln.renderOrder = 12; nhomCot.add(ln);
  const zs = []; for (const h of hang) zs.push(h.tren, h.duoi);
  if (zs.length) {
    const pts = new THREE.Points(new THREE.BufferGeometry().setFromPoints(zs.map((z) => new V3(x, y, z))),
      new THREE.PointsMaterial({ color: MAU_GHI, size: 5, sizeAttenuation: false, depthTest: false }));
    pts.renderOrder = 12; nhomCot.add(pts);
  }
  $("cot-vi-tri").textContent = `x ${x.toFixed(3)} · y ${y.toFixed(3)}`;
  $("cot-huong-dan").textContent = kq.length ? "Bấm dòng để chọn vật · bấm điểm khác để đọc lại · Esc: thôi" : "Không có vật thể đang hiện nào dưới điểm này.";
  const than = $("cot-than");
  than.replaceChildren();
  kq.forEach((r, i) => {
    const tr = document.createElement("tr");
    const o = hang[i].o;
    if (o.userData.vat_lieu === "khoang") tr.classList.add("khoang");
    for (const [t, lop] of [[r.ten, ""], [r.vat_lieu, "mo"], [fz(r.tren), "so"], [fz(r.duoi), "so"], [fmm(r.tren - r.duoi), "so"],
                            [r.khe_mm == null ? "" : r.khe_mm < -0.05 ? "chồng " + fmm(-r.khe_mm / 1000) : fmm(r.khe_mm / 1000), "so khe"]]) {
      const td = document.createElement("td"); td.textContent = t; if (lop) td.className = lop; tr.append(td);
    }
    tr.onclick = () => datChon(o);
    than.append(tr);
  });
}
function chamCot(e) {
  let p = null;
  if (matCat && trucCat !== "z") {
    const r = canvas.getBoundingClientRect();
    chuot.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(chuot, camera);
    const q = new V3();
    if (ray.ray.intersectPlane(matCat, q)) p = w2m(q);
  } else {
    const h = ban(e, true);
    if (h) p = h.object.worldToLocal(h.point.clone());
  }
  if (p) cotLop(p.x, p.y);
}
$("nut-cot").onclick = () => batCot(!cotBat);
$("cot-dong").onclick = () => batCot(false);

/* ── BÓC LỚP · TÁCH LỚP ───────────────────────────────────────────────────────
   Mô hình khai `lop_boc` ở nút gốc = danh sách TIỀN TỐ tên nhóm, từ trên xuống (tôn → … →
   thạch cao). Bóc k = tắt k lớp đầu qua cơ chế tắt lớp sẵn có (lopTat) nên ô «Lớp» khớp theo.
   Tách = nâng lớp thứ i (0 = trên cùng) lên (N−1−i)·khe theo +z mô hình. Vật thể không đổi hình,
   chỉ dời ⇒ bắt điểm vẫn trúng vật đang thấy; số đọc ra lấy qua worldToLocal của vật nên là
   toạ độ thật. Thước, khoanh vùng, vật chú thích thì tắt khi đang tách (điểm bấm lệch khỏi chỗ thật). */
let bocK = 0, tachKhe = 0;
const lopBoc = () => (GOC && Array.isArray(GOC.userData.lop_boc) ? GOC.userData.lop_boc : []);
function lopCuaNhom(n) { const ds = lopBoc(); for (let i = 0; i < ds.length; i++) if (String(n || "").startsWith(ds[i])) return i; return -1; }
/* ── TRÌNH TỰ THI CÔNG (ghi chú chủ nhà #115, 2026-09-23) ─────────────────
   Nhóm khai `trinh_tu` = [{so, ten, mo_ta}] ở gốc; mỗi vật thi công mang `buoc` (số bước). Thanh trượt ở bước k:
   hiện mọi vật có buoc ≤ k (vật hiện trạng không mang buoc nên luôn hiện). Tắt = về bước cuối (đủ cả tháp).
   Liên kết: ?buoc=<k>. */
let BUOC_TT = null;                 // { ma, k } — null = không lọc
function dungTrinhTu() {
  const ds = (GOC.userData.trinh_tu || []).filter((x) => !lkTat.has(x.ma));
  $("khoi-trinh-tu").hidden = !ds.length;
  if (!ds.length) { BUOC_TT = null; return; }
  const tt = ds[0];
  const n = tt.buoc.length;
  $("tt-truot").max = String(n);
  const q = Number(Q.get("buoc"));
  if (!BUOC_TT) BUOC_TT = { ma: tt.ma, k: q >= 1 && q <= n ? q : n };
  const ol = $("ds-trinh-tu");
  ol.replaceChildren();
  tt.buoc.forEach((b, i) => {
    const li = document.createElement("li");
    li.textContent = b.ten;
    li.title = b.mo_ta || "";
    li.onclick = () => datBuoc(i + 1);
    ol.append(li);
  });
  veTrinhTu();
}
function veTrinhTu() {
  const ds = GOC.userData.trinh_tu || [];
  const tt = ds.find((x) => BUOC_TT && x.ma === BUOC_TT.ma);
  if (!tt) return;
  const k = BUOC_TT.k, b = tt.buoc[k - 1];
  $("tt-truot").value = String(k);
  $("tt-so").textContent = `bước ${k}/${tt.buoc.length}`;
  $("tt-mo-ta").textContent = b ? `${b.ten}. ${b.mo_ta || ""}` : "";
  [...$("ds-trinh-tu").children].forEach((li, i) => { li.classList.toggle("sau", i + 1 > k); li.classList.toggle("dang", i + 1 === k); });
}
function datBuoc(k) {
  boiBong();
  if (!BUOC_TT) return 0;
  const tt = (GOC.userData.trinh_tu || []).find((x) => x.ma === BUOC_TT.ma);
  BUOC_TT.k = Math.max(1, Math.min(tt.buoc.length, Math.round(Number(k) || 1)));
  veTrinhTu();
  capNhatHien();
  return BUOC_TT.k;
}
$("tt-truot").addEventListener("input", (e) => datBuoc(e.target.value));
$("tt-lui").onclick = () => datBuoc((BUOC_TT?.k || 1) - 1);
$("tt-toi").onclick = () => datBuoc((BUOC_TT?.k || 1) + 1);

function dungBoc() {
  const ds = lopBoc();
  $("khoi-lop-cau-tao").hidden = !ds.length;
  if (!ds.length) return;
  for (const o of PHAN) o.userData.lopBoc = lopCuaNhom(o.userData.nhom);
  $("boc").max = String(ds.length);
  const ol = $("ds-boc");
  ol.replaceChildren();
  ds.forEach((t, i) => {
    const li = document.createElement("li");
    li.textContent = t.replace(/^Mái\s*[—-]\s*/, "");
    li.title = t;
    li.onclick = () => bocLop(bocK === i + 1 ? i : i + 1);
    ol.append(li);
  });
  veBoc();
}
function veBoc() {
  const ds = lopBoc();
  $("boc").value = String(bocK);
  $("boc-so").textContent = bocK ? `đã bóc ${bocK}/${ds.length}` : "đủ lớp";
  [...$("ds-boc").children].forEach((li, i) => li.classList.toggle("boc", i < bocK));
  $("tach").value = String(Math.round(tachKhe * 1000));
  $("tach-so").textContent = tachKhe ? `khe ${fmm(tachKhe)} mm` : "liền";
}
function bocLop(k) {
  boiBong();
  const ds = lopBoc();
  if (!ds.length) return 0;
  bocK = Math.max(0, Math.min(ds.length, Math.round(Number(k) || 0)));
  const tatCa = new Set(PHAN.map((o) => o.userData.nhom));
  for (const n of tatCa) { const i = lopCuaNhom(n); if (i < 0) continue; if (i < bocK) lopTat.add(n); else lopTat.delete(n); }
  dungLop(GOC.userData.nhom || []);
  capNhatHien();
  veBoc();
  return bocK;
}
function tachLop(khe) {
  boiBong();
  const ds = lopBoc();
  if (!ds.length) return 0;
  tachKhe = Math.max(0, Math.min(0.6, Number(khe) || 0));
  const N = ds.length;
  // tach_lech (vd lưới đỡ chăn của L2): vẫn thuộc lớp ấy nhưng hạ thêm tach_lech × khe — tách ra thấy rõ là một lớp riêng
  for (const o of PHAN) { const i = o.userData.lopBoc; o.position.z = i >= 0 ? ((N - 1 - i) + (Number(o.userData.tach_lech) || 0)) * tachKhe : 0; }
  GOC.updateMatrixWorld(true);
  if (tachKhe) { if (doDangBat) batDo(false); huyVung(); thoiThem(); }
  veBoc();
  if (KT.hop.length) veKichThuoc();
  return tachKhe;
}
function chanKhiTach() {                    // true = đang tách, đã báo, không cho làm
  if (!tachKhe) return false;
  $("bang-them").hidden = false;
  $("them-huong-dan").textContent = "Đang tách lớp — đưa «Tách lớp» về 0 rồi mới đo, khoanh vùng hay thêm vật chú thích.";
  clearTimeout(chanKhiTach.t);
  chanKhiTach.t = setTimeout(() => { if (!veMT) $("bang-them").hidden = true; }, 2600);
  return true;
}
$("boc").oninput = () => bocLop($("boc").value);
$("mo-noi").oninput = () => { datMoNoi(Number($("mo-noi").value) / 100); apMo(); };
$("boc-bot").onclick = () => bocLop(bocK - 1);
$("boc-them").onclick = () => bocLop(bocK + 1);
$("tach").oninput = () => tachLop(Number($("tach").value) / 1000);

/* ── MẶT CẮT SẴN: `mat_cat_san` ở nút gốc = [{ten, truc, m, dao}] → nút trong ô mặt cắt, phím P
   xoay vòng, ?cat_san=<i> mở sẵn. */
let catSanDang = -1;
const matCatSan = () => (GOC && Array.isArray(GOC.userData.mat_cat_san) ? GOC.userData.mat_cat_san : []);
function dungCatSan() {
  const ds = matCatSan(), k = $("cat-san");
  k.hidden = !ds.length;
  k.replaceChildren();
  ds.forEach((s, i) => {
    const b = document.createElement("button");
    b.textContent = s.ten || `Mặt cắt ${i + 1}`;
    b.title = `${String(s.truc).toUpperCase()} = ${Number(s.m).toFixed(3)} m${s.dao ? " · đảo phía" : ""} (phím P: mặt cắt kế tiếp)`;
    b.onclick = () => catSan(i);
    k.append(b);
  });
}
function catSan(i) {
  const ds = matCatSan();
  if (!ds.length) return false;
  i = ((Math.round(Number(i)) % ds.length) + ds.length) % ds.length;
  const s = ds[i];
  catTaiM(s.truc, Number(s.m), !!s.dao);
  catSanDang = i;
  veCatSan();
  return s.ten || true;
}
function veCatSan() { [...$("cat-san").children].forEach((b, i) => b.setAttribute("aria-pressed", String(i === catSanDang))); }

/* ── THƯỚC: bấm hai điểm → một thước (vật chú thích, lưu cùng ghi chú) ────────── */
let doDangBat = false;
let diemDo = null;                 // điểm thứ nhất (toạ độ THẾ GIỚI) hoặc null
const nhomDo = new THREE.Group();  // chấm của điểm thứ nhất
scene.add(nhomDo);
function batDo(bat) {
  if (bat && chanKhiTach()) return;
  if (bat) { thoiThem(); huyVung(); if (cotBat) batCot(false); }
  doDangBat = bat;
  $("bang-do").hidden = !bat;
  $("nut-do").setAttribute("aria-pressed", String(bat));
  diemDo = null; nhomDo.clear();
  $("do-kq").textContent = "Thước: bấm điểm thứ nhất (bắt vào đỉnh gần nhất · giữ Alt để không bắt). Esc: thôi";
}
$("nut-do").onclick = () => batDo(!doDangBat);
function batDinh(h, tuDo) {
  // bắt vào đỉnh của tam giác bị bấm nếu cách điểm bấm < 12 px trên màn hình
  if (tuDo) return h.point.clone();
  const pos = h.object.geometry.attributes.position;
  let tot = h.point, gan = 12;
  const r = canvas.getBoundingClientRect();
  const sp = (v) => { const q = v.clone().project(camera); return new THREE.Vector2((q.x + 1) * r.width / 2, (1 - q.y) * r.height / 2); };
  const p0 = sp(h.point);
  for (const i of [h.face.a, h.face.b, h.face.c]) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(h.object.matrixWorld);
    const d = sp(v).distanceTo(p0);
    if (d < gan) { gan = d; tot = v; }
  }
  return tot.clone();
}
function chamDo(h, e) {
  if (!h) return;
  const p = batDinh(h, e && e.altKey);
  if (!diemDo) {
    diemDo = p;
    const cau = new THREE.Mesh(new THREE.SphereGeometry(camera.position.distanceTo(p) / 250, 12, 8), new THREE.MeshBasicMaterial({ color: MAU_NHAP, depthTest: false }));
    cau.position.copy(p); cau.renderOrder = 10; nhomDo.add(cau);
    $("do-kq").textContent = "Bấm điểm thứ hai.";
    return;
  }
  const A = w2m(diemDo), B = w2m(p);
  diemDo = null; nhomDo.clear();
  const o = themNhap({ k: "thuoc", a: [A.x, A.y, A.z], b: [B.x, B.y, B.z] });
  const d = B.clone().sub(A);
  $("do-kq").innerHTML = `<strong class="mono">${mm(d.length())} mm</strong> <span class="mo mono">Δx ${mm(Math.abs(d.x))} · Δy ${mm(Math.abs(d.y))} · Δz ${mm(Math.abs(d.z))}</span> <span class="mo">— thước đã thêm vào ghi chú; bấm tiếp để đo nữa</span>`;
  chonNhap(o);
}

/* ── VẬT CHÚ THÍCH: cầu · mũi tên · hộp · thước ───────────────────────────────
   Người xem thêm vật để NÓI RÕ ghi chú (vd một mũi tên xuyên mô hình chỉ đường nắng).
   Vật mới là BẢN NHÁP (xanh) — dời/xoay/co giãn được như Blender: G · R · S, thêm X/Y/Z để
   khoá trục, gõ số để nhập đúng giá trị, Enter/bấm trái = xong, Esc/bấm phải = huỷ;
   Shift+D nhân đôi · X/Delete xoá · Shift+A thêm. Hoặc kéo tay nắm trên vật.
   Lưu ghi chú là lưu cả vật (trường `hinh`, toạ độ MÔ HÌNH); ghi chú đã xử lý thì vật
   biến mất cùng ghim. Bản ghi mỗi vật:
     cầu/hộp/mũi tên: {k, p:[x,y,z], q:[x,y,z,w], s:[sx,sy,sz]}  — mũi tên: p = ĐUÔI, trục +z
                      cục bộ là hướng, s[2] = chiều dài (m), s[0] = hệ số bề dày
     thước:           {k:"thuoc", a:[x,y,z], b:[x,y,z]}
   ------------------------------------------------------------------------- */
const MAU_NHAP = 0x2b6ca3, MAU_GHI = 0xb8412c;
const TEN_LOAI = { cau: "cầu", mui_ten: "mũi tên", hop: "hộp", thuoc: "thước" };
const nhomNhap = new THREE.Group(), nhomCTGhi = new THREE.Group();
const NHAP = [];                  // vật nháp (Object3D, userData.rec)
let ctChon = null;                // vật nháp đang chọn
const lopNhan = $("lop-nhan");    // nhãn chiều dài thước

function vlCT(mau, xuyen) {
  return new THREE.MeshStandardMaterial({ color: mau, roughness: 0.45, transparent: true, opacity: xuyen ? 0.9 : 0.6,
    depthTest: !xuyen, depthWrite: false, side: THREE.DoubleSide });
}
function hinhMuiTen(L, w) {
  const dauDai = Math.min(0.15 * w, 0.45 * L), rTruc = 0.012 * w, rDau = 0.045 * w;
  const truc = new THREE.CylinderGeometry(rTruc, rTruc, Math.max(L - dauDai, 0.001), 12);
  truc.rotateX(Math.PI / 2); truc.translate(0, 0, (L - dauDai) / 2);
  const dau = new THREE.ConeGeometry(rDau, dauDai, 16);
  dau.rotateX(Math.PI / 2); dau.translate(0, 0, L - dauDai / 2);
  return [truc, dau];
}
function dungVat(rec, mau) {
  const g = new THREE.Group();
  g.userData.rec = rec;
  if (rec.k === "thuoc") {
    const a = new V3(...rec.a), b = new V3(...rec.b);
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color: mau, depthTest: false }));
    ln.renderOrder = 12; g.add(ln);
    const r = Math.max(a.distanceTo(b) / 120, 0.006);
    for (const q of [a, b]) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color: mau, depthTest: false }));
      c.position.copy(q); c.renderOrder = 12; g.add(c);
    }
    return g;
  }
  const vl = vlCT(mau, rec.k === "mui_ten");
  const tao = (geo) => { const m = new THREE.Mesh(geo, vl); m.renderOrder = rec.k === "mui_ten" ? 12 : 3; g.add(m); };
  if (rec.k === "cau") tao(new THREE.SphereGeometry(0.5, 24, 16));
  else if (rec.k === "hop") tao(new THREE.BoxGeometry(1, 1, 1));
  else if (rec.k === "mui_ten") for (const geo of hinhMuiTen(rec.s[2], rec.s[0])) tao(geo);
  g.position.set(...rec.p);
  g.quaternion.set(...rec.q);
  if (rec.k !== "mui_ten") g.scale.set(...rec.s);
  return g;
}
/* mũi tên giữ scale = 1 — chiều dài/bề dày nằm trong rec.s và dựng lại hình, để đầu mũi
   tên không bị kéo dài theo thân */
function dongBo(o) {
  const r = o.userData.rec;
  if (r.k === "thuoc") return;
  r.p = o.position.toArray().map((n) => +n.toFixed(4));
  r.q = o.quaternion.toArray().map((n) => +n.toFixed(5));
  if (r.k === "mui_ten") {
    if (o.scale.x !== 1 || o.scale.y !== 1 || o.scale.z !== 1) {
      r.s = [r.s[0] * Math.sqrt(Math.abs(o.scale.x * o.scale.y)), r.s[1] * Math.sqrt(Math.abs(o.scale.x * o.scale.y)), r.s[2] * Math.abs(o.scale.z)];
      o.scale.set(1, 1, 1);
      veLaiMuiTen(o);
    }
  } else r.s = o.scale.toArray().map((n) => +Math.abs(n).toFixed(4));
  veNhap();
}
function veLaiMuiTen(o) {
  const r = o.userData.rec;
  const geos = hinhMuiTen(r.s[2], r.s[0]);
  o.children.forEach((m, i) => { m.geometry.dispose(); m.geometry = geos[i]; });
}
function themNhap(rec) {
  damBaoNhomVung();
  const o = dungVat(rec, MAU_NHAP);
  nhomNhap.add(o); NHAP.push(o);
  veNhap();
  return o;
}
function xoaNhap(o) {
  if (!o) return;
  if (ctChon === o) chonNhap(null);
  nhomNhap.remove(o); giaiPhong(o);
  NHAP.splice(NHAP.indexOf(o), 1);
  veNhap();
}
function xoaHetNhap() { chonNhap(null); for (const o of [...NHAP]) xoaNhap(o); }
function chonNhap(o) {
  if (ctChon) for (const m of ctChon.children) if (m.material && m.material.emissive) m.material.emissive.setHex(0);
  ctChon = o || null;
  if (ctChon && ctChon.userData.rec.k !== "thuoc") {
    for (const m of ctChon.children) if (m.material && m.material.emissive) m.material.emissive.setHex(0x3a2a00);
    tc.attach(ctChon);
  } else tc.detach();
  veNhap();
}
function tomTatRec(r) {
  if (r.k === "thuoc") return `thước ${mm(new V3(...r.a).distanceTo(new V3(...r.b)))} mm`;
  if (r.k === "mui_ten") return `mũi tên dài ${mm(r.s[2])} mm`;
  if (r.k === "cau") return `cầu Ø${mm(r.s[0])}${r.s[0] === r.s[1] && r.s[1] === r.s[2] ? "" : "…"} mm`;
  return `hộp ${mm(r.s[0])} × ${mm(r.s[1])} × ${mm(r.s[2])} mm`;
}
function veNhap() {
  const ul = $("ds-nhap");
  ul.replaceChildren();
  $("khoi-nhap").hidden = NHAP.length === 0;
  NHAP.forEach((o, i) => {
    const li = document.createElement("li");
    if (o === ctChon) li.classList.add("dang-chon");
    const t = document.createElement("span"); t.textContent = `${i + 1}. ${tomTatRec(o.userData.rec)}`;
    const x = document.createElement("button"); x.type = "button"; x.className = "nut-nho"; x.textContent = "Xoá";
    x.onclick = (e) => { e.stopPropagation(); xoaNhap(o); };
    li.onclick = () => chonNhap(o);
    li.append(t, x); ul.append(li);
  });
  veNhanThuoc();
}
/* nhãn chiều dài trên mọi thước (nháp + của ghi chú đang mở) */
function veNhanThuoc() {
  lopNhan.replaceChildren();
  const them = (r, lop) => {
    const el = document.createElement("div");
    el.className = "nhan-thuoc " + lop;
    el.textContent = mm(new V3(...r.a).distanceTo(new V3(...r.b))) + " mm";
    el.dataset.p = r.a.map((n, k) => (n + r.b[k]) / 2).join(",");
    lopNhan.append(el);
  };
  for (const o of NHAP) if (o.userData.rec.k === "thuoc") them(o.userData.rec, "nhap");
  for (const o of nhomCTGhi.children) if (o.userData.rec.k === "thuoc") them(o.userData.rec, "ghi");
}
function datNhanThuoc() {
  const r = canvas.getBoundingClientRect();
  if (KT && KT.hop.length && khoaGocKT() !== KT.goc) veKichThuoc();          // camera sang phía khác ⇒ đường ghi đổi cạnh
  for (const el of [...lopNhan.children, ...lopKT.children, ...(typeof lopNhanNoi !== "undefined" ? lopNhanNoi.children : [])]) {
    const v = (el.dataset.w ? new V3(...el.dataset.w.split(",").map(Number)) : m2w(...el.dataset.p.split(",").map(Number))).project(camera);
    el.style.display = v.z > 1 ? "none" : "";
    el.style.left = ((v.x + 1) * r.width) / 2 + "px";
    el.style.top = ((1 - v.y) * r.height) / 2 + "px";
  }
}

/* ── THƯỚC KÍCH THƯỚC theo cấu kiện (kho data/thuoc-3d.yaml — tools/3d/thuoc3d.py) ───────────────────────
   Ở chế độ soạn (xem.py, hoặc khung 3D nhúng đang «Sửa»): chọn vật → ô «Thước kích thước» → bật cho VẬT ấy hoặc cho
   một LỚP chứa nó. Từ đó chọn vật ấy / vật thuộc lớp ấy (kể cả lớp con) ⇒ ba đường ghi kích thước bao của CẤU KIỆN
   (vật, hoặc mọi vật đang hiện của lớp) — dài theo x · rộng theo y · cao theo z, mm, hộp bao theo trục mô hình.
   Đường ghi nằm ở cạnh hộp phía camera, đổi cạnh khi xoay sang phía khác. Bản đăng đọc mo-hinh/thuoc.json, chỉ xem. */
const THUOC_GHI = window.THUOC_GHI || null;
var KT = { ds: [], hop: [], goc: "", chon: null };   // var: hàm ở trên (hienThongTin, capNhatHien) chạm tới trước khi dòng này chạy               // ds: mục đã bật · hop: [{b: Box3 mô hình, lop: bool}] đang vẽ
const nhomKT = new THREE.Group();
nhomKT.renderOrder = 13;
const lopKT = document.createElement("div");
lopKT.id = "lop-kt";
lopNhan.after(lopKT);
const VL_KT = { vat: new THREE.LineBasicMaterial({ color: 0xb8412c, depthTest: false, transparent: true }),
                lop: new THREE.LineBasicMaterial({ color: 0x1f5f8b, depthTest: false, transparent: true }) };
for (const m of Object.values(VL_KT)) m.userData.dungChung = true;
const suaThuocDuoc = () => !!THUOC_GHI && (!document.body.classList.contains("nhung") || document.body.classList.contains("nhung-sua"));
const trongLop = (u, duong) => u.nhom === duong || (u.nhom || "").startsWith(duong + " / ");
const khopKT = (t, u) => (t.loai === "vat" ? t.muc === u.id : (!t.lk || t.lk === u.linh_kien) && trongLop(u, t.muc));
async function taiThuoc() {
  try {
    const r = await fetch("mo-hinh/thuoc.json", { cache: "no-cache" });
    if (r.ok) KT.ds = ((await r.json()).thuoc || []).filter((t) => t && t.muc);
  } catch { /* không có kho thước ⇒ không vẽ gì */ }
  veKichThuoc(); if (chon) hienThongTin();
}
function hopMoHinhKT(ds) {                            // hộp bao theo trục MÔ HÌNH (lưới đã ở toạ độ mô hình; tách lớp dời position)
  const b = new THREE.Box3(), h = new THREE.Box3();
  for (const o of ds) {
    if (!o.geometry) continue;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    b.union(h.copy(o.geometry.boundingBox).translate(o.position));
  }
  return b;
}
function khoaGocKT() {                               // camera đang ở phía nào của các hộp (x, y) — đổi phía thì vẽ lại
  if (!KT.hop.length || !GOC) return "";
  const c = w2m(camera.position);
  return KT.hop.map(({ b }) => `${c.x > (b.min.x + b.max.x) / 2 ? 1 : 0}${c.y > (b.min.y + b.max.y) / 2 ? 1 : 0}`).join("");
}
function veKichThuoc() {
  xoaCon(nhomKT); lopKT.replaceChildren();
  KT.hop = [];
  if (GOC && nhomKT.parent !== GOC) GOC.add(nhomKT);
  if (!chon || !KT.ds.length) { KT.goc = ""; veLai(60); return; }
  const u = chon.userData;
  for (const t of KT.ds) {
    if (!khopKT(t, u)) continue;
    const ds = t.loai === "vat" ? [chon] : PHAN.filter((o) => o.visible && (!t.lk || o.userData.linh_kien === t.lk) && trongLop(o.userData, t.muc));
    const b = hopMoHinhKT(ds);
    if (!b.isEmpty()) KT.hop.push({ b, lop: t.loai === "lop", ten: t.loai === "lop" ? t.muc.split(" / ").pop() : "" });
  }
  KT.goc = khoaGocKT();
  const c = GOC ? w2m(camera.position) : new V3();
  KT.hop.forEach(({ b, lop, ten }, i) => {
    const s = b.getSize(new V3());
    const g = Math.max(0.08, 0.06 * Math.max(s.x, s.y, s.z)) * (1 + 0.6 * i);   // khoảng lùi khỏi vật; hộp thứ hai lùi xa hơn
    const xn = c.x > (b.min.x + b.max.x) / 2 ? b.max.x : b.min.x, sx = xn === b.max.x ? 1 : -1;   // cạnh phía camera
    const yn = c.y > (b.min.y + b.max.y) / 2 ? b.max.y : b.min.y, sy = yn === b.max.y ? 1 : -1;
    const z0 = b.min.z, p = [];
    const doan = (a, bb) => p.push(...a, ...bb);
    const ghi = (a, bb, keo, dai) => {                // đường ghi a→bb, hai đường gióng theo hướng `keo` (từ vật ra), hai gạch chéo
      if (dai < 0.001) return;
      const A = new V3(...a), B = new V3(...bb), K = new V3(...keo);
      doan(A.clone().sub(K.clone().multiplyScalar(0.8)).toArray(), A.clone().addScaledVector(K, 0.15).toArray());
      doan(B.clone().sub(K.clone().multiplyScalar(0.8)).toArray(), B.clone().addScaledVector(K, 0.15).toArray());
      doan(A.toArray(), B.toArray());
      const d = B.clone().sub(A).normalize(), t = Math.min(0.04, dai / 6);
      const cheo = d.clone().add(K.clone().normalize()).normalize().multiplyScalar(t);
      for (const P of [A, B]) doan(P.clone().sub(cheo).toArray(), P.clone().add(cheo).toArray());
      const el = document.createElement("div");
      el.className = "nhan-thuoc kt" + (lop ? " lop" : "");
      el.textContent = mm(dai) + " mm";
      el.dataset.p = A.clone().add(B).multiplyScalar(0.5).toArray().join(",");
      lopKT.append(el);
    };
    ghi([b.min.x, yn + sy * g, z0], [b.max.x, yn + sy * g, z0], [0, sy * g, 0], s.x);            // dài theo x
    ghi([xn + sx * g, b.min.y, z0], [xn + sx * g, b.max.y, z0], [sx * g, 0, 0], s.y);            // rộng theo y
    ghi([xn + sx * g, yn + sy * g, b.min.z], [xn + sx * g, yn + sy * g, b.max.z], [sx * g, sy * g, 0], s.z);   // cao theo z
    if (ten) for (const el of [...lopKT.children].slice(-3)) el.title = "Lớp " + ten;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    const l = new THREE.LineSegments(geo, lop ? VL_KT.lop : VL_KT.vat);
    l.renderOrder = 13;
    nhomKT.add(l);
  });
  datNhanThuoc();
  veLai(60);
}
async function batThuoc(t, bat) {
  const r = await fetch(THUOC_GHI, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...t, bat }) });
  const kq = await r.text();
  if (!r.ok) throw new Error(kq || "Không lưu được thước (" + r.status + ").");
  KT.ds = JSON.parse(kq).thuoc || [];
  veKichThuoc(); hienThongTin();
}
/* ô «Thước kích thước» trong bảng vật đang chọn — chỉ ở chế độ soạn */
function oThuoc(u) {
  let k = $("tt-thuoc");
  if (!k) {
    k = document.createElement("div"); k.id = "tt-thuoc"; k.className = "tt-thuoc";
    $("tt-id").closest("dl").after(k);
  }
  k.replaceChildren();
  k.hidden = !suaThuocDuoc();
  if (k.hidden) return;
  const h = document.createElement("h3"); h.textContent = "Thước kích thước";
  const m = document.createElement("p"); m.className = "mo";
  m.textContent = "Bật cho vật này hoặc một lớp chứa nó — chọn vật / vật thuộc lớp ấy là hiện ba đường ghi kích thước.";
  const hang = document.createElement("div"); hang.className = "nut-hang";
  const cap = (u.nhom || "").split(" / ");
  const muc = [{ loai: "vat", muc: u.id, nhan: "Vật này" }]
    .concat(cap.map((_, i) => ({ loai: "lop", muc: cap.slice(0, i + 1).join(" / "), lk: u.linh_kien, nhan: "Lớp «" + cap[i] + "»" })));
  for (const t of muc) {
    const co = KT.ds.some((x) => x.loai === t.loai && x.muc === t.muc && (t.loai === "vat" || (x.lk || "") === (t.lk || "")));
    const b = document.createElement("button"); b.type = "button";
    b.setAttribute("aria-pressed", String(co));
    b.textContent = (co ? "✓ " : "") + t.nhan;
    b.title = t.loai === "vat" ? "Thước cho riêng vật này" : "Thước bao cả lớp " + t.muc + " — hiện khi chọn bất kỳ vật nào trong lớp";
    b.onclick = async () => { b.disabled = true; try { await batThuoc({ loai: t.loai, muc: t.muc, lk: t.lk }, !co); } catch (e) { alert(e.message); b.disabled = false; } };
    hang.append(b);
  }
  k.append(h, m, hang);
}

/* tay nắm kéo (TransformControls) — thêm cách thứ hai bên cạnh G/R/S */
const tc = new TransformControls(camera, canvas);
tc.setSpace("local");
tc.setSize(0.8);
scene.add(tc.getHelper());
let vuaKeoTay = false;
tc.addEventListener("dragging-changed", (e) => { controls.enabled = !e.value; if (!e.value) { vuaKeoTay = true; if (ctChon) dongBo(ctChon); } });
tc.addEventListener("objectChange", () => { if (ctChon && ctChon.userData.rec.k !== "mui_ten") dongBo(ctChon); });
function cheDoTay(m) {
  tc.setMode(m);
  for (const b of document.querySelectorAll("[data-tay]")) b.setAttribute("aria-pressed", String(b.dataset.tay === m));
}
for (const b of document.querySelectorAll("[data-tay]")) b.onclick = () => cheDoTay(b.dataset.tay);

/* đặt vật mới: tại điểm vừa bấm trên mô hình, không có thì tại tâm xoay */
function diemDat() {
  if (diemBam) return diemBam.clone();
  return w2m(controls.target);
}
function themVat(k) {
  if (chanKhiTach()) return;
  if (k === "mui_ten") { batVeMuiTen(); return; }
  if (k === "thuoc") { batDo(true); return; }
  thoiThem();
  const kc = camera.position.distanceTo(controls.target);
  const c = +Math.min(Math.max(kc / 25, 0.05), 0.5).toFixed(2);
  const p = diemDat();
  const o = themNhap({ k, p: [p.x, p.y, p.z], q: [0, 0, 0, 1], s: [c, c, c] });
  chonNhap(o);
}
for (const b of document.querySelectorAll("[data-them]")) b.onclick = () => themVat(b.dataset.them);

/* vẽ mũi tên: bấm ĐUÔI rồi bấm ĐẦU — trên mô hình, hoặc giữa khoảng trống (mặt phẳng
   qua điểm trước, quay về phía người xem) */
let veMT = null;                  // null | { duoi: V3 (mô hình) | null, xem: Object3D }
function batVeMuiTen() {
  if (chanKhiTach()) return;
  thoiThem(); if (doDangBat) batDo(false); huyVung(); if (cotBat) batCot(false);
  veMT = { duoi: null, xem: null };
  $("bang-them").hidden = false;
  $("them-huong-dan").textContent = "Mũi tên: bấm điểm ĐUÔI (trên mô hình hoặc giữa khoảng trống). Esc: thôi";
  canvas.style.cursor = "crosshair";
}
function thoiThem() {
  if (veMT && veMT.xem) nhomNhap.remove(veMT.xem);
  veMT = null;
  $("bang-them").hidden = true;
}
function diemKhong(e, quaW) {       // điểm trên mặt phẳng qua quaW (thế giới), vuông góc hướng nhìn
  const r = canvas.getBoundingClientRect();
  chuot.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(chuot, camera);
  const n = camera.getWorldDirection(new V3());
  const mp = new THREE.Plane().setFromNormalAndCoplanarPoint(n, quaW);
  const q = new V3();
  return ray.ray.intersectPlane(mp, q) ? q : null;
}
function diemMT(e) {
  const h = ban(e, true);
  if (h) return w2m(h.point);
  const w = diemKhong(e, veMT.duoi ? m2w(...veMT.duoi.toArray()) : controls.target);
  return w ? w2m(w) : null;
}
function recMuiTen(a, b) {
  const d = b.clone().sub(a);
  const L = Math.max(d.length(), 0.02);
  const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), d.clone().normalize());
  const w = +Math.min(Math.max(L / 2, 0.4), 3).toFixed(2);
  return { k: "mui_ten", p: [a.x, a.y, a.z].map((n) => +n.toFixed(4)), q: q.toArray().map((n) => +n.toFixed(5)), s: [w, w, +L.toFixed(4)] };
}
function chamMuiTen(e) {
  const p = diemMT(e);
  if (!p) return;
  if (!veMT.duoi) {
    veMT.duoi = p;
    $("them-huong-dan").textContent = "Bấm điểm ĐẦU mũi tên (kéo chuột để xem trước).";
    return;
  }
  const rec = recMuiTen(veMT.duoi, p);
  thoiThem();
  canvas.style.cursor = "";
  chonNhap(themNhap(rec));
}
function xemTruocMuiTen(e) {
  const p = diemMT(e);
  if (!p) return;
  if (veMT.xem) nhomNhap.remove(veMT.xem);
  veMT.xem = dungVat(recMuiTen(veMT.duoi, p), MAU_NHAP);
  nhomNhap.add(veMT.xem);
  $("them-huong-dan").textContent = `Mũi tên dài ${mm(p.distanceTo(veMT.duoi))} mm — bấm điểm ĐẦU.`;
}

/* ── G / R / S kiểu Blender ─────────────────────────────────────────────────── */
let bienDoi = null;   // { kieu, truc, so, o, p0, q0, s0, m0: Vector2 màn hình }
const TRUC = { x: new V3(1, 0, 0), y: new V3(0, 1, 0), z: new V3(0, 0, 1) };
function manHinh(vW) { const r = canvas.getBoundingClientRect(); const q = vW.clone().project(camera); return new THREE.Vector2((q.x + 1) * r.width / 2, (1 - q.y) * r.height / 2); }
let chuotCuoi = new THREE.Vector2();
function batBienDoi(kieu) {
  if (!ctChon || ctChon.userData.rec.k === "thuoc") return;
  const o = ctChon;
  bienDoi = { kieu, truc: null, so: "", o, p0: o.position.clone(), q0: o.quaternion.clone(),
              s0: o.userData.rec.k === "mui_ten" ? new V3(...o.userData.rec.s) : o.scale.clone(), m0: chuotCuoi.clone() };
  controls.enabled = false;
  tc.enabled = false;
  $("bang-bien-doi").hidden = false;
  capNhatBienDoi();
}
function tamManHinh(o) { return manHinh(o.getWorldPosition(new V3())); }
function capNhatBienDoi() {
  const b = bienDoi; if (!b) return;
  const o = b.o, rec = o.userData.rec;
  o.position.copy(b.p0); o.quaternion.copy(b.q0);
  const so = b.so === "" || b.so === "-" ? null : Number(b.so);
  let mo = "";
  if (b.kieu === "g") {
    let d;
    if (so != null && b.truc) d = TRUC[b.truc].clone().multiplyScalar(so);
    else {
      const wp = o.getWorldPosition(new V3());
      const w0 = diemKhongXY(b.m0, wp), w1 = diemKhongXY(chuotCuoi, wp);
      d = w0 && w1 ? w2m(w1).sub(w2m(w0)) : new V3();
      if (b.truc) d = TRUC[b.truc].clone().multiplyScalar(d.dot(TRUC[b.truc]));
    }
    o.position.add(d);
    mo = `Dời${b.truc ? " theo " + b.truc.toUpperCase() : ""} · Δ ${mm(d.length())} mm`;
  } else if (b.kieu === "r") {
    const c = tamManHinh(o);
    let goc;
    if (so != null) goc = THREE.MathUtils.degToRad(so);
    else goc = Math.atan2(-(chuotCuoi.y - c.y), chuotCuoi.x - c.x) - Math.atan2(-(b.m0.y - c.y), b.m0.x - c.x);
    const wp = o.getWorldPosition(new V3());
    const veNguoi = w2m(camera.position).sub(w2m(wp)).normalize();
    let truc = b.truc ? TRUC[b.truc].clone() : veNguoi;
    if (so == null && b.truc && truc.dot(veNguoi) < 0) goc = -goc;
    o.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(truc, goc).multiply(b.q0));
    mo = `Xoay${b.truc ? " quanh " + b.truc.toUpperCase() : ""} · ${THREE.MathUtils.radToDeg(goc).toFixed(1)}°`;
  } else {
    const c = tamManHinh(o);
    const f = so != null ? so : Math.max(chuotCuoi.distanceTo(c), 1) / Math.max(b.m0.distanceTo(c), 1);
    const s = b.s0.clone();
    if (b.truc) s.setComponent({ x: 0, y: 1, z: 2 }[b.truc], s.getComponent({ x: 0, y: 1, z: 2 }[b.truc]) * f);
    else s.multiplyScalar(f);
    if (rec.k === "mui_ten") { rec.s = s.toArray().map((n) => +Math.abs(n).toFixed(4)); veLaiMuiTen(o); }
    else o.scale.copy(s);
    mo = `Co giãn${b.truc ? " theo trục " + b.truc.toUpperCase() + " của vật" : ""} · ×${f.toFixed(3)}`;
  }
  $("bien-doi-kq").textContent = `${mo}${b.so !== "" ? "  [" + b.so + "]" : ""} — X/Y/Z khoá trục · gõ số · Enter/bấm: xong · Esc/chuột phải: huỷ`;
}
function diemKhongXY(m, quaW) {
  const r = canvas.getBoundingClientRect();
  chuot.set((m.x / r.width) * 2 - 1, -(m.y / r.height) * 2 + 1);
  ray.setFromCamera(chuot, camera);
  const mp = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new V3()), quaW);
  const q = new V3();
  return ray.ray.intersectPlane(mp, q) ? q : null;
}
function xongBienDoi(giu) {
  const b = bienDoi; if (!b) return;
  bienDoi = null;
  if (!giu) {
    b.o.position.copy(b.p0); b.o.quaternion.copy(b.q0);
    if (b.o.userData.rec.k === "mui_ten") { b.o.userData.rec.s = b.s0.toArray(); veLaiMuiTen(b.o); } else b.o.scale.copy(b.s0);
  }
  dongBo(b.o);
  controls.enabled = true; tc.enabled = true;
  $("bang-bien-doi").hidden = true;
}
function nhanDoi() {
  if (!ctChon) return;
  const rec = JSON.parse(JSON.stringify(ctChon.userData.rec));
  const o = themNhap(rec);
  chonNhap(o);
  if (rec.k !== "thuoc") batBienDoi("g");
}
canvas.addEventListener("pointermove", (e) => {
  const r = canvas.getBoundingClientRect();
  chuotCuoi.set(e.clientX - r.left, e.clientY - r.top);
  if (bienDoi) capNhatBienDoi();
  else if (veMT && veMT.duoi) xemTruocMuiTen(e);
});
canvas.addEventListener("contextmenu", (e) => { if (bienDoi) { e.preventDefault(); xongBienDoi(false); } });
function banNhap(e) {
  const r = canvas.getBoundingClientRect();
  chuot.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(chuot, camera);
  const h = ray.intersectObjects(NHAP.filter((o) => o.userData.rec.k !== "thuoc"), true)[0];
  if (!h) return null;
  let o = h.object; while (o.parent && !o.userData.rec) o = o.parent;
  return o;
}
/* ── NÚT «MÔ PHỎNG THỜI TIẾT» trên thanh công cụ (chỉ ở máy — bản site không có máy mô phỏng) ──────────
   Hai lối vào tools/sim-weather: lớp phân tích cả nhà trên chính mô hình này (cảnh ?m=nha) và trang mặt cắt dòng khí. */
(function nutMoPhong() {
  if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
  const nhom = document.querySelector('.thanh [aria-label="Công cụ"]');
  if (!nhom) return;
  const nut = document.createElement("button");
  nut.id = "nut-mo-phong"; nut.type = "button"; nut.textContent = "Mô phỏng thời tiết ▾";
  nut.title = "Mô phỏng cả nhà (tools/sim-weather): nhiệt, gió, tuổi khí, nắng, mưa trên mô hình · mặt cắt dòng khí";
  nhom.append(nut);
  const menu = document.createElement("div");
  menu.className = "menu-them"; menu.hidden = true; menu.setAttribute("role", "menu");
  menu.style.position = "fixed"; menu.style.zIndex = "60";
  menu.innerHTML = `<button type="button" role="menuitem" data-mp="lop">Bản đồ nhiệt · gió · tuổi khí trên mô hình</button>
    <a role="menuitem" href="mat_cat.html" target="_blank" rel="noopener" style="display:block;padding:var(--sp-2) var(--sp-3);font-size:var(--fs-data);color:inherit;text-decoration:none">Mặt cắt dòng khí (trang riêng) ↗</a>`;
  document.body.append(menu);
  nut.onclick = (e) => {
    e.stopPropagation();
    const r = nut.getBoundingClientRect();
    menu.style.top = `${r.bottom + 4}px`; menu.style.left = `${Math.max(8, Math.min(r.left, innerWidth - 300))}px`; menu.style.right = "auto";
    menu.hidden = !menu.hidden;
  };
  addEventListener("click", (e) => { if (!menu.contains(e.target)) menu.hidden = true; });
  menu.querySelector('[data-mp="lop"]').onclick = () => {
    menu.hidden = true;
    if (MA !== "nha") { const u = new URL(location.href); u.searchParams.set("m", "nha"); u.searchParams.set("phan_tich", "1"); location.href = u.toString(); return; }
    nut.disabled = true; nut.textContent = "Đang nạp mô phỏng…";
    napPhanTich(true).then((ok) => {
      nut.disabled = false; nut.textContent = "Mô phỏng thời tiết ▾";
      if (!ok) { nut.title = "Không nạp được lớp phân tích — chạy node tools/sim-weather/chay.mjs rồi tải lại"; return; }
      window.PHAN_TICH?.bat(true);
      document.querySelector("section.phan-tich")?.scrollIntoView({ behavior: "smooth", block: "start" });
      for (const s of document.querySelectorAll("#ben-trai section")) if (s.textContent.includes("Nạp lớp phân tích")) s.remove();
    });
  };
})();

$("nut-them").onclick = (e) => { e.stopPropagation(); $("menu-them").hidden = !$("menu-them").hidden; };
for (const b of document.querySelectorAll("#menu-them [data-them]")) b.addEventListener("click", () => ($("menu-them").hidden = true));
$("xoa-nhap").onclick = xoaHetNhap;

/* ── phím tắt ──────────────────────────────────────────────────────────── */
addEventListener("keydown", (e) => {
  if (e.target.closest("input, textarea, select, [contenteditable]")) return;
  /* Cmd/Ctrl + phím là của trình duyệt (chép, dán, chọn hết…) — trước đây Cmd+C rơi vào phím C
     (mặt cắt) và bị preventDefault nuốt. Chỉ giữ Ctrl+1/3/7 (góc nhìn kiểu Blender). */
  if ((e.metaKey || e.ctrlKey) && !(e.ctrlKey && /^[137]$/.test(e.key))) return;
  const k = e.key.toLowerCase();
  if (CHI_XEM() && !/^[01379]$/.test(k) && !["c", "p", "escape"].includes(k)) return;   // chỉ xem: góc nhìn + mặt cắt
  if (bienDoi) {                                   // đang G/R/S: mọi phím thuộc về phép biến đổi
    if (k === "escape") xongBienDoi(false);
    else if (k === "enter") xongBienDoi(true);
    else if (k === "x" || k === "y" || k === "z") { bienDoi.truc = bienDoi.truc === k ? null : k; capNhatBienDoi(); }
    else if (/^[0-9.]$/.test(e.key)) { bienDoi.so += e.key; capNhatBienDoi(); }
    else if (e.key === "-") { bienDoi.so = bienDoi.so.startsWith("-") ? bienDoi.so.slice(1) : "-" + bienDoi.so; capNhatBienDoi(); }
    else if (k === "backspace") { bienDoi.so = bienDoi.so.slice(0, -1); capNhatBienDoi(); }
    else if (k === "g" || k === "r" || k === "s") { const t = bienDoi.truc; xongBienDoi(false); batBienDoi(k); bienDoi.truc = t; capNhatBienDoi(); }
    e.preventDefault(); return;
  }
  if (e.shiftKey && k === "a") { $("menu-them").hidden = !$("menu-them").hidden; e.preventDefault(); return; }
  if (e.shiftKey && k === "d" && ctChon) { nhanDoi(); e.preventDefault(); return; }
  if (ctChon && (k === "g" || k === "r" || k === "s")) { batBienDoi(k); e.preventDefault(); return; }
  if (ctChon && (k === "x" || k === "delete" || k === "backspace")) { xoaNhap(ctChon); e.preventDefault(); return; }
  if (k === "escape") { datChon(null); chonNhap(null); thoiThem(); $("menu-them").hidden = true; if (doDangBat) batDo(false); if (vungBat || vungXong) huyVung(); if (cotBat) batCot(false); }
  else if (k === "f" || k === ".") khungChon();
  else if (k === "h" && e.altKey) { anTay.clear(); capNhatHien(); }
  else if (k === "h") anChon();
  else if (k === "i" || k === "/") riengChon();
  else if (k === "t") xuyenChon();
  else if (k === "o") latCongTacChon();                         // lật công tắc Đóng|Mở của vật đang chọn
  else if (k === "v" && NET) NET.dat(!NET.bat());                // nét viền theo độ sâu
  else if (k === "m") batDo(!doDangBat);
  else if (k === "c") bamCat();
  else if (k === "l") batCot(!cotBat);
  else if (k === "p" && matCatSan().length) catSan(catSanDang + 1);
  else if (k === "[" && lopBoc().length) bocLop(bocK - 1);
  else if (k === "]" && lopBoc().length) bocLop(bocK + 1);
  else if (e.ctrlKey && k === "1") nhinDocTruc("y", 1);          // Blender Ctrl+1: nhìn từ sau
  else if (e.ctrlKey && k === "3") nhinDocTruc("x", -1);         // Ctrl+3: từ phía Đông Bắc
  else if (e.ctrlKey && k === "7") nhinDocTruc("z", -1);         // Ctrl+7: từ dưới lên
  else if (k === "9") { const d = camera.position.clone().sub(controls.target); camera.position.copy(controls.target).sub(d); controls.update(); }
  else if (k === "0") datGoc("truc-do");
  else if (k === "1") datGoc("truoc");
  else if (k === "3") datGoc("tay-nam");
  else if (k === "7") datGoc("tren");
  else return;
  e.preventDefault();
});

/* ── liên kết chia sẻ ──────────────────────────────────────────────────── */
function urlHienTai() {
  const u = new URL(location.href);
  u.searchParams.set("m", MA);
  u.searchParams.set("v", chuoiGoc());
  u.searchParams.delete("nhom");
  const an = DM.linh_kien.map((x) => x.ma).filter((m) => lkTat.has(m) && CANH.hien.includes(m));
  if (an.length) u.searchParams.set("an", an.join(",")); else u.searchParams.delete("an");
  if (chon) u.searchParams.set("chon", chon.userData.id); else u.searchParams.delete("chon");
  if (!$("bang-cat").hidden) u.searchParams.set("cat", `${trucCat},${$("cat-vi-tri").value}${$("cat-dao").checked ? ",dao" : ""}`);
  else u.searchParams.delete("cat");
  if (!$("bang-cat").hidden && catSanDang >= 0) u.searchParams.set("cat_san", String(catSanDang)); else u.searchParams.delete("cat_san");
  if (bocK) u.searchParams.set("boc", String(bocK)); else u.searchParams.delete("boc");
  if (tachKhe) u.searchParams.set("tach", String(tachKhe)); else u.searchParams.delete("tach");
  if (vatMo.size) u.searchParams.set("xuyen", [...vatMo].join(",")); else u.searchParams.delete("xuyen");
  const tt = (GOC.userData.chon_mot || []).filter((cm) => CHON_MOT.get(cm.ma) !== cm.mac_dinh).map((cm) => `${cm.ma}:${CHON_MOT.get(cm.ma)}`);
  if (tt.length) u.searchParams.set("tt", tt.join(",")); else u.searchParams.delete("tt");
  const ttDs = (GOC.userData.trinh_tu || []).find((x) => BUOC_TT && x.ma === BUOC_TT.ma);
  if (ttDs && BUOC_TT.k < ttDs.buoc.length) u.searchParams.set("buoc", String(BUOC_TT.k)); else u.searchParams.delete("buoc");
  return u.toString();
}
$("nut-chep").onclick = async () => {
  const s = urlHienTai();
  try { await navigator.clipboard.writeText(s); $("nut-chep").textContent = "Đã chép"; }
  catch { prompt("Chép liên kết:", s); }
  setTimeout(() => ($("nut-chep").textContent = "Chép liên kết"), 1500);
};
function apDungUrl() {
  const c = Q.get("cat");
  if (c) { const [t, v, d] = c.split(","); batCat(true, t, Number(v), d === "dao"); }
  if (Q.get("cat_san") != null && matCatSan().length) catSan(Number(Q.get("cat_san")));
  if (Q.get("boc")) bocLop(Number(Q.get("boc")));
  if (Q.get("tach")) tachLop(Number(Q.get("tach")));
  if (Q.get("xuyen")) { for (const x of Q.get("xuyen").split(",")) if (THEO_ID.has(x)) vatMo.add(x); apMo(); dungDsAn(); }
  const id = Q.get("chon");
  if (id && THEO_ID.has(id)) datChon(THEO_ID.get(id));
  const v = Q.get("v");
  if (!(v && (HUONG[v] ? (datGoc(v), true) : apGoc(v)))) datGoc("truc-do");
}

/* ── ghi chú ───────────────────────────────────────────────────────────────
   Hai kho, cùng một dạng hàng (id, trang, neo, trich, truoc, noi_dung, nguoi,
   tra_loi_cho, da_xong, tao_luc):
     · CỤC BỘ — khi trang chạy qua tools/3d/xem.py: ghi vào tools/3d/ghi-chu/<mã>.json
       trong repo (không mật khẩu, không mạng; git mang nó qua máy khác);
     · SUPABASE — bản đăng trên site: bảng binh_luan của sổ bình luận, ghi cần mật khẩu chung.
   ------------------------------------------------------------------------- */
const CUC_BO = window.GHI_CHU_CUC_BO || null;
const CH = window.BINH_LUAN_CAU_HINH;
const API = !CUC_BO && CH && CH.url ? CH.url.replace(/\/+$/, "") + "/rest/v1" : null;
let GHI_CHU = [];

/* ── BẢN DỰNG: luôn bản mới nhất của mọi linh kiện (chỉ ở máy — xem.py) ─────────────────────
   Cảnh = nhiều linh kiện, mỗi linh kiện một phiên sửa (dung.py LINH_KIEN). Máy chủ dựng lại khi
   trang xin .glb; ở đây hỏi mỗi 4 giây xem có tệp nào đổi sau lần dựng đang xem không — có thì hiện
   nút tải lại, giữ nguyên góc nhìn / vật đang chọn / mặt cắt (urlHienTai). */
function dungNhanBanDung() {
  if (!CUC_BO) return;
  const el = document.createElement("div");
  el.id = "ban-dung";
  el.className = "ban-dung";
  document.querySelector(".thanh").insertBefore(el, document.querySelector(".thanh .nhom-nut"));
  const daTai = Date.now();
  async function hoi() {
    let d;
    try { d = await (await fetch("/api/ban-dung?kiem=1", { cache: "no-store" })).json(); }
    catch { return; }
    const ds = d.linh_kien || [];
    el.title = ds.map((x) => `${x.ten} (${x.ma}) — phiên «${x.phien}» · dựng ${(x.dung_luc || "—").slice(11)}\n`
      + Object.entries(x.nguon || {}).map(([t, g]) => `   ${t} sửa ${g}`).join("\n")
      + (x.loi ? `\n   ⛔ ${x.loi.split("\n").pop()}` : "")).join("\n\n");
    const loi = ds.filter((x) => x.loi);
    const moi = ds.filter((x) => (x.tep_doi || []).length
      || (x.dung_luc && new Date(x.dung_luc.replace(" ", "T")).getTime() > daTai + 1000));
    const ten = (xs) => xs.map((x) => x.ten).join(", ");
    if (loi.length) {
      el.dataset.tt = "loi";
      el.innerHTML = `⛔ ${ten(loi)}: dựng lỗi — đang xem bản cũ <button type="button">Thử lại</button>`;
    } else if (moi.length || LK_LOI.size) {
      el.dataset.tt = "moi";
      el.innerHTML = `● Có bản mới: ${ten(moi.length ? moi : ds.filter((x) => LK_LOI.has(x.ma)))} <button type="button">Tải lại</button>`;
    } else {
      el.dataset.tt = "ok";
      el.textContent = `${ds.length} nhóm · mới nhất`;
    }
    const pt = MA === "nha" && d.phan_tich;          // máy mô phỏng cả nhà (xem.py chạy tools/sim-weather/chay.mjs)
    if (pt && (pt.dang_chay || pt.loi)) {
      el.append(pt.dang_chay ? " · phân tích đang chạy lại…" : " · ⛔ phân tích hỏng (giữ số cũ)");
      el.title += `\n\nPhân tích cả nhà: ${pt.dang_chay ? "đang chạy node tools/sim-weather/chay.mjs" : pt.loi}`;
    }
    const b = el.querySelector("button");
    if (b) b.onclick = () => { b.disabled = true; b.textContent = "Đang dựng…"; location.href = urlHienTai(); };
  }
  hoi();
  setInterval(() => { if (!document.hidden) hoi(); }, 4000);
}
READY.then(dungNhanBanDung);
const nho = (k, v) => { try { if (v === undefined) return localStorage.getItem(k) || ""; localStorage.setItem(k, v); } catch { return ""; } };
$("gc-ten").value = nho("bl-ten");
$("gc-mk").value = nho("bl-mk");
if (CUC_BO) $("gc-mk").hidden = true;
function dau() { return { apikey: CH.khoa, Authorization: "Bearer " + CH.khoa, "Content-Type": "application/json" }; }
async function goiSupabase(ham, than) {
  const r = await fetch(API + "/rpc/" + ham, { method: "POST", headers: dau(), body: JSON.stringify(than) });
  const t = await r.text();
  if (r.ok) return t ? JSON.parse(t) : null;
  if (t.includes("SAI_MAT_KHAU")) throw new Error("Sai mật khẩu chung.");
  if (t.includes("NOI_DUNG_TRONG")) throw new Error("Chưa gõ nội dung.");
  throw new Error("Không lưu được (" + r.status + ").");
}
async function goiCucBo(duong, than) {
  const r = await fetch(CUC_BO + duong, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(than) });
  const t = await r.text();
  if (!r.ok) throw new Error(t || "Không lưu được (" + r.status + ").");
  return t ? JSON.parse(t) : null;
}
const KHO = {
  doc: async () => {
    if (CUC_BO) { const r = await fetch(`${CUC_BO}?trang=${encodeURIComponent(TRANG)}`); if (!r.ok) throw new Error(r.status); return r.json(); }
    const r = await fetch(`${API}/binh_luan?select=*&trang=eq.${encodeURIComponent(TRANG)}&order=tao_luc.asc`, { headers: dau() });
    if (!r.ok) throw new Error(r.status);
    return r.json();
  },
  them: (h) => CUC_BO ? goiCucBo("", { trang: TRANG, ...h })
    : h.hinh ? Promise.reject(new Error("Vật chú thích (cầu, mũi tên, hộp, thước) chỉ lưu được khi mở trình xem ở máy (tools/3d/xem.py) — sổ ghi chú trên site chưa có chỗ cho chúng. Xoá vật hoặc ghi chú bằng chữ."))
    : goiSupabase("them_binh_luan", { p_mat_khau: mk(), p_trang: TRANG, p_noi_dung: h.noi_dung, p_nguoi: h.nguoi, p_neo: h.neo ?? null, p_trich: h.trich ?? null, p_truoc: h.truoc ?? null, p_tra_loi_cho: h.tra_loi_cho ?? null }),
  xong: (id, xong) => CUC_BO ? goiCucBo("/xong", { trang: TRANG, id, xong })
    : goiSupabase("danh_dau_xong", { p_mat_khau: mk(), p_id: id, p_xong: xong }),
  // sửa chữ và/hoặc vật chú thích của ghi chú đã lưu — chỉ kho cục bộ (sổ trên site không có đường sửa)
  sua: (id, doi) => CUC_BO ? goiCucBo("/sua", { trang: TRANG, id, ...doi })
    : Promise.reject(new Error("Sửa ghi chú chỉ làm được khi mở trình xem ở máy (tools/3d/xem.py).")),
};

/* ── SỬA GHI CHÚ ĐÃ LƯU: nạp chữ + vật của ghi chú vào khung ghi chú thành NHÁP — dời/xoay/co giãn/xoá/thêm như lúc
   mới vẽ, rồi «Lưu sửa». Vào bằng nút «Sửa» trong danh sách, hoặc bấm thẳng vào vật đỏ của ghi chú trên mô hình.
   Trong lúc sửa, bản đỏ của chính ghi chú ấy ẩn đi (chỉ còn bản nháp xanh). */
let dangSua = null;               // ghi chú (hàng) đang sửa
function batSua(b, chonThu = -1) {
  if (!CUC_BO) { alert("Sửa ghi chú chỉ làm được khi mở trình xem ở máy (tools/3d/xem.py)."); return; }
  if (dangSua && dangSua.id === b.id) { if (chonThu >= 0 && NHAP[chonThu]) chonNhap(NHAP[chonThu]); return; }
  if (!dangSua && (NHAP.length || $("gc-noi-dung").value.trim())
      && !confirm("Đang có ghi chú nháp chưa lưu — bỏ nó để sửa ghi chú #" + b.id + "?")) return;
  xoaHetNhap(); huyVung();
  dangSua = b;
  for (const r of Array.isArray(b.hinh) ? b.hinh : []) themNhap(JSON.parse(JSON.stringify(r)));
  $("gc-noi-dung").value = b.noi_dung;
  $("gc-tieu-de").textContent = `Sửa ghi chú #${b.id}`;
  $("gc-luu").textContent = `Lưu sửa #${b.id}`;
  $("gc-huy-sua").hidden = false;
  veGhim();
  if (chonThu >= 0 && NHAP[chonThu]) chonNhap(NHAP[chonThu]);
  $("form-gc").scrollIntoView({ block: "nearest" });
  globalThis.VE_LAI?.();
}
function thoiSua() {
  if (!dangSua) return;
  dangSua = null;
  $("gc-tieu-de").textContent = "Ghi chú cho góc nhìn này";
  $("gc-luu").textContent = "Lưu ghi chú";
  $("gc-huy-sua").hidden = true;
  $("gc-noi-dung").value = "";
  xoaHetNhap();
  veGhim();
  globalThis.VE_LAI?.();
}
$("gc-huy-sua").onclick = thoiSua;
/* bấm vào vật đỏ của một ghi chú ⇒ sửa ghi chú ấy, chọn đúng vật vừa bấm */
function banCTGhi(e) {
  if (!CUC_BO || !nhomCTGhi.children.length) return null;
  const r = canvas.getBoundingClientRect();
  chuot.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(chuot, camera);
  const h = ray.intersectObjects(nhomCTGhi.children.filter((o) => o.userData.rec.k !== "thuoc"), true)[0];
  if (!h) return null;
  let o = h.object; while (o.parent && !o.userData.rec) o = o.parent;
  return o.userData.gc ? o : null;
}
async function taiGhiChu() {
  if (!CUC_BO && !API) { $("gc-trang-thai").textContent = "Chưa nối sổ ghi chú — vẫn xem được mô hình."; $("form-gc").hidden = true; return; }
  try {
    GHI_CHU = await KHO.doc();
    $("gc-trang-thai").textContent = CUC_BO ? "Ghi chú lưu ở máy này (tools/3d/ghi-chu/)." : "";
  } catch (e) { $("gc-trang-thai").textContent = "Không đọc được sổ ghi chú (" + e.message + ")."; }
  veGhiChu();
}
function veGhiChu() {
  const anXong = $("an-xong").checked;
  const goc = GHI_CHU.filter((b) => !b.tra_loi_cho);
  const mo = goc.filter((b) => !b.da_xong).length;
  $("dem-gc").textContent = goc.length ? `${mo} đang mở / ${goc.length}` : "";
  const ul = $("ds-gc");
  ul.replaceChildren();
  for (const b of goc) {
    if (anXong && b.da_xong) continue;
    const li = document.createElement("li");
    if (b.da_xong) li.classList.add("xong");
    const tra = GHI_CHU.filter((x) => x.tra_loi_cho === b.id);
    li.innerHTML = `<div class="gc-dau"><span class="gc-so">#${b.id}</span><span></span><span></span></div><div class="gc-vat"></div><p class="gc-nd"></p>`;
    li.querySelector(".gc-dau span:nth-child(2)").textContent = b.nguoi;
    li.querySelector(".gc-dau span:nth-child(3)").textContent = new Date(b.tao_luc).toLocaleDateString("vi-VN") + (b.da_xong ? " · đã xử lý" : "");
    li.querySelector(".gc-vat").textContent = b.trich || "Góc nhìn chung";
    { const g = docChuoiGoc(b.truoc);
      if (g.p && g.q && g.n) {
        const r = hinhVung(new THREE.Vector3(...g.p), new THREE.Vector3(...g.q), new THREE.Vector3(...g.n));
        const sp = document.createElement("div"); sp.className = "gc-vung";
        sp.textContent = `vùng khoanh ${mm(r.a)} × ${mm(r.b)} mm`;
        li.querySelector(".gc-vat").after(sp);
      } }
    if (Array.isArray(b.hinh) && b.hinh.length) {
      const sp = document.createElement("div"); sp.className = "gc-vung";
      sp.textContent = b.hinh.map(tomTatRec).join(" · ");
      li.querySelector(".gc-vat").after(sp);
    }
    li.querySelector(".gc-nd").textContent = b.noi_dung;
    for (const t of tra) {
      const p = document.createElement("p"); p.className = "gc-tra";
      p.textContent = `${t.nguoi}: ${t.noi_dung}`;
      if (CUC_BO) {
        const bs = document.createElement("button"); bs.className = "nut-nho"; bs.textContent = "Sửa";
        bs.onclick = async (e) => {
          e.stopPropagation();
          const nd = prompt(`Sửa trả lời #${t.id}:`, t.noi_dung);
          if (nd == null || nd.trim() === t.noi_dung) return;
          try { await KHO.sua(t.id, { noi_dung: nd }); await taiGhiChu(); } catch (er) { alert(er.message); }
        };
        p.append(" ", bs);
      }
      li.append(p);
    }
    const nut = document.createElement("div"); nut.className = "gc-nut";
    const bTra = document.createElement("button"); bTra.className = "nut-nho"; bTra.textContent = "Trả lời";
    bTra.onclick = (e) => { e.stopPropagation(); traLoi(b); };
    const bXong = document.createElement("button"); bXong.className = "nut-nho"; bXong.textContent = b.da_xong ? "Mở lại" : "Đã xử lý";
    bXong.onclick = async (e) => { e.stopPropagation(); try { await KHO.xong(b.id, !b.da_xong); await taiGhiChu(); } catch (er) { alert(er.message); } };
    nut.append(bTra, bXong);
    if (CUC_BO) {
      const bSua = document.createElement("button"); bSua.className = "nut-nho"; bSua.textContent = dangSua?.id === b.id ? "Đang sửa" : "Sửa";
      bSua.title = "Sửa chữ, dời / xoay / thêm / xoá vật chú thích của ghi chú này";
      bSua.onclick = (e) => { e.stopPropagation(); denGhiChu(b); batSua(b); };
      nut.append(bSua);
    }
    li.append(nut);
    li.onclick = () => denGhiChu(b);
    ul.append(li);
  }
  veGhim();
}
$("an-xong").onchange = veGhiChu;
function mk() { const v = $("gc-mk").value || nho("bl-mk"); if (!v) throw new Error("Cần mật khẩu chung (ô dưới cùng bên phải)."); return v; }
function denGhiChu(b) {
  if (b.neo && THEO_ID.has(b.neo)) {
    const o = THEO_ID.get(b.neo);
    if (!hienDuoc(o)) { anTay.delete(b.neo); rieng = null; batLop(o.userData.nhom); if (o.userData.ma) hienMa = true; capNhatHien(); }
    datChon(o);
    for (const id of b.neo_them || []) {
      const k = THEO_ID.get(id);
      if (!k) continue;
      if (!hienDuoc(k)) { anTay.delete(id); batLop(k.userData.nhom); capNhatHien(); }
      THEM.add(k); toThem(k, true);
    }
    hienThongTin();
  }
  if (!apGoc(b.truoc) && b.neo && THEO_ID.has(b.neo)) khungVua(cacChon());
}
async function traLoi(b) {
  const nd = prompt(`Trả lời ghi chú #${b.id}:`);
  if (!nd) return;
  try { await KHO.them({ noi_dung: nd, nguoi: $("gc-ten").value || "Khách", tra_loi_cho: b.id }); await taiGhiChu(); }
  catch (e) { alert(e.message); }
}
$("form-gc").onsubmit = async (e) => {
  e.preventDefault();
  const loi = $("gc-loi"); loi.hidden = true;
  try {
    nho("bl-ten", $("gc-ten").value); if (!CUC_BO) nho("bl-mk", $("gc-mk").value);
    if (dangSua) {
      await KHO.sua(dangSua.id, { noi_dung: $("gc-noi-dung").value, hinh: NHAP.map((o) => o.userData.rec) });
      thoiSua();
      await taiGhiChu();
      return;
    }
    await KHO.them({
      noi_dung: $("gc-noi-dung").value, nguoi: $("gc-ten").value || "Khách",
      neo: chon ? chon.userData.id : null, trich: chon ? chon.userData.ten + (THEM.size ? ` (+${THEM.size})` : "") : null,
      neo_them: THEM.size ? [...THEM].map((o) => o.userData.id) : null,
      truoc: chuoiGoc(chon ? diemBam : null, vungXong),
      hinh: NHAP.length ? NHAP.map((o) => o.userData.rec) : null,
    });
    $("gc-noi-dung").value = "";
    huyVung();
    xoaHetNhap();
    await taiGhiChu();
  } catch (er) { loi.textContent = er.message; loi.hidden = false; }
};

/* ghim số ghi chú tại điểm đã bấm */
const lopGhim = $("lop-ghim");
function veGhim() {
  lopGhim.replaceChildren();
  if (nhomVungGhi) xoaCon(nhomVungGhi);
  xoaCon(nhomCTGhi);
  for (const b of GHI_CHU) {
    if (b.tra_loi_cho || b.da_xong) continue;
    if (Array.isArray(b.hinh) && !(dangSua && dangSua.id === b.id))
      b.hinh.forEach((r, i) => { try { const o = dungVat(r, MAU_GHI); o.userData.gc = b; o.userData.thu = i; nhomCTGhi.add(o); } catch { /* bản ghi hỏng: bỏ qua */ } });
    const g = docChuoiGoc(b.truoc);
    if (g.p && g.q && g.n && nhomVungGhi) {
      const r = hinhVung(new THREE.Vector3(...g.p), new THREE.Vector3(...g.q), new THREE.Vector3(...g.n));
      nhomVungGhi.add(duongVung(r.pts, 0xb8412c));
    }
    if (!g.p) continue;
    const el = document.createElement("div");
    el.className = "ghim"; el.textContent = b.id; el.title = b.noi_dung;
    el.dataset.p = g.p.join(",");
    el.onclick = () => denGhiChu(b);
    lopGhim.append(el);
  }
  veNhanThuoc();
}
function datGhim() {
  const r = canvas.getBoundingClientRect();
  for (const el of lopGhim.children) {
    const v = m2w(...el.dataset.p.split(",").map(Number)).project(camera);
    const an = v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05;
    el.style.display = an ? "none" : "";
    el.style.left = ((v.x + 1) * r.width) / 2 + "px";
    el.style.top = ((1 - v.y) * r.height) / 2 + "px";
  }
}

/* ── khoanh vùng: hai góc trên MỘT mặt phẳng → hình chữ nhật (toạ độ mô hình) ─────────
   Mặt phẳng lấy theo mặt được bấm ở góc thứ nhất (pháp tuyến mặt đó); góc thứ hai là giao của
   tia chuột với chính mặt phẳng ấy, nên kéo ra ngoài vật vẫn được. Cạnh hình theo phương
   ngang (vuông góc trục đứng) và phương còn lại trong mặt — trên tường là rộng × cao. */
let vungBat = false, vungTam = null, vungXong = null;
let nhomVung = null, nhomVungGhi = null;       // xem trước / các vùng của ghi chú đang mở
function trucVung(n) {
  const u = Math.abs(n.z) > 0.9 ? new V3(1, 0, 0) : new V3(0, 0, 1).cross(n).normalize();
  return [u, n.clone().cross(u).normalize()];
}
function hinhVung(p1, p2, n) {
  const [u, v] = trucVung(n.clone().normalize());
  const d = p2.clone().sub(p1), a = d.dot(u), b = d.dot(v);
  const lech = n.clone().normalize().multiplyScalar(0.003);   // nhô 3mm khỏi mặt cho khỏi chìm
  const pts = [p1.clone(), p1.clone().addScaledVector(u, a), p1.clone().addScaledVector(u, a).addScaledVector(v, b),
               p1.clone().addScaledVector(v, b)].map((q) => q.add(lech));
  return { pts, a: Math.abs(a), b: Math.abs(b) };
}
function duongVung(pts, mau) {
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const l = new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color: mau, depthTest: false }));
  l.renderOrder = 11;
  return l;
}
function damBaoNhomVung() {
  if (!nhomVung && GOC) { nhomVung = new THREE.Group(); nhomVungGhi = new THREE.Group(); GOC.add(nhomVung, nhomVungGhi, nhomNhap, nhomCTGhi); }
}
function batVung() {
  if (chanKhiTach()) return;
  damBaoNhomVung();
  if (doDangBat) batDo(false);
  thoiThem();
  vungBat = true; vungTam = null; vungXong = null; xoaCon(nhomVung);
  if (!hienMa) { hienMa = true; dungLop(GOC.userData.nhom || []); capNhatHien(); }   // hiện tường giếng tham chiếu
  $("nut-vung").setAttribute("aria-pressed", "true");
  $("bang-vung").hidden = false;
  $("vung-huong-dan").textContent = "Bấm góc thứ nhất trên một mặt — tường giếng, kính, gờ… (Esc: thôi)";
  $("vung-kq").textContent = "";
  canvas.style.cursor = "crosshair";
}
function huyVung() {
  vungBat = false; vungTam = null; vungXong = null;
  if (nhomVung) xoaCon(nhomVung);
  $("nut-vung").setAttribute("aria-pressed", "false");
  $("bang-vung").hidden = true;
  $("vung-kq").textContent = "";
}
function giaoMatPhang(e, p1, n) {
  const r = canvas.getBoundingClientRect();
  chuot.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(chuot, camera);
  const nW = m2w(n.x, n.y, n.z).sub(m2w(0, 0, 0)).normalize();
  const mp = new THREE.Plane().setFromNormalAndCoplanarPoint(nW, m2w(p1.x, p1.y, p1.z));
  const q = new V3();
  return ray.ray.intersectPlane(mp, q) ? w2m(q) : null;
}
function chamVung(e) {
  if (!vungTam) {
    const h = ban(e, true);
    if (!h) return;
    vungTam = { p1: w2m(h.point), n: h.face.normal.clone().normalize() };   // lưới đặt trong hệ mô hình
    $("vung-huong-dan").textContent = "Bấm góc thứ hai (kéo chuột để xem trước)";
    return;
  }
  const p2 = giaoMatPhang(e, vungTam.p1, vungTam.n);
  if (!p2) return;
  vungXong = { p1: vungTam.p1, p2, n: vungTam.n };
  const r = hinhVung(vungXong.p1, p2, vungXong.n);
  xoaCon(nhomVung); nhomVung.add(duongVung(r.pts, 0x1d1d1b));
  vungBat = false; vungTam = null;
  $("bang-vung").hidden = true; $("nut-vung").setAttribute("aria-pressed", "false");
  $("vung-kq").textContent = `Vùng ${mm(r.a)} × ${mm(r.b)} mm — gõ ghi chú rồi Lưu`;
  canvas.style.cursor = "";
  $("gc-noi-dung").focus();
}
function xemTruocVung(e) {
  const p2 = giaoMatPhang(e, vungTam.p1, vungTam.n);
  if (!p2) return;
  const r = hinhVung(vungTam.p1, p2, vungTam.n);
  xoaCon(nhomVung); nhomVung.add(duongVung(r.pts, 0x1d1d1b));
  $("vung-huong-dan").textContent = `${mm(r.a)} × ${mm(r.b)} mm — bấm góc thứ hai`;
}
$("nut-vung").onclick = () => (vungBat ? huyVung() : batVung());

/* ── LA BÀN TRỤC kiểu Blender (góc trên phải) ─────────────────────────────────
   Sáu trục MÔ HÌNH (X = Tây Nam, Y = Đông Nam/phía sau, Z = lên): trục dương là chấm đặc có
   chữ + đoạn nối tâm, trục âm là vòng rỗng (di chuột vào mới hiện chữ). Bấm một trục ⇒ nhìn
   DỌC trục ấy từ phía đó (giữ khoảng cách, không khung lại — như Blender); bấm lại đúng trục
   đang nhìn ⇒ lật sang phía ngược. Kéo trên la bàn ⇒ xoay quanh tâm xoay. */
const LB_TRUC = [["x", 1, "#e5484d"], ["y", 1, "#7cb518"], ["z", 1, "#2f80ed"],
                 ["x", -1, "#e5484d"], ["y", -1, "#7cb518"], ["z", -1, "#2f80ed"]];
const laBan = $("la-ban");
const NS_SVG = "http://www.w3.org/2000/svg";
let lbHover = null, lbKeo = null, lbDong = null, lbViTri = [];
function svgEl(ten, thuoc) { const e = document.createElementNS(NS_SVG, ten); for (const k in thuoc) e.setAttribute(k, thuoc[k]); return e; }
function trucThe(t, dau) {                 // hướng THẾ GIỚI của trục mô hình
  const v = [0, 0, 0]; v[{ x: 0, y: 1, z: 2 }[t]] = dau;
  return m2w(...v).sub(m2w(0, 0, 0)).normalize();
}
let lbKhoa = "", lbLuc = 0;
function veLaBan() {
  if (!GOC) return;
  const khoa = camera.quaternion.toArray().map((v) => v.toFixed(4)).join() + lbHover + (NANG.bat ? "☀" : "");   // không đổi hướng ⇒ không dựng lại SVG
  if (khoa === lbKhoa) return;
  // đang xoay: dựng lại SVG tối đa ~20 lần/giây (trước: mỗi khung); hẹn một khung nữa để la bàn khớp khi camera dừng
  const bay = performance.now();
  if (bay - lbLuc < 50) { veLai(60); return; }
  lbLuc = bay;
  lbKhoa = khoa;
  const qi = camera.quaternion.clone().invert();
  const R = 38;
  const ds = LB_TRUC.map(([t, dau, mau]) => {
    const v = trucThe(t, dau).applyQuaternion(qi);
    return { t, dau, mau, x: v.x * R, y: -v.y * R, z: v.z, khoa: t + dau };
  }).sort((a, b) => a.z - b.z);                 // xa trước, gần sau
  lbViTri = ds;
  laBan.replaceChildren();
  for (const d of ds) if (d.dau > 0) laBan.append(svgEl("line", { x1: 0, y1: 0, x2: d.x, y2: d.y, stroke: d.mau, "stroke-width": 3, "stroke-linecap": "round" }));
  for (const d of ds) {
    const g = svgEl("g", { class: "truc", "data-khoa": d.khoa });
    const sang = lbHover === d.khoa;
    const r = d.dau > 0 ? 11 : 9;
    g.append(svgEl("circle", d.dau > 0
      ? { cx: d.x, cy: d.y, r: sang ? r + 1.5 : r, fill: d.mau, stroke: sang ? "#fff" : "none", "stroke-width": 2 }
      : { cx: d.x, cy: d.y, r, fill: sang ? d.mau : "rgba(255,255,255,.35)", "fill-opacity": sang ? 0.85 : 1, stroke: d.mau, "stroke-width": 2 }));
    if (d.dau > 0 || sang) {
      const tx = svgEl("text", { x: d.x, y: d.y + 0.5 });
      tx.textContent = (d.dau < 0 ? "−" : "") + d.t.toUpperCase();
      g.append(tx);
    }
    laBan.append(g);
  }
  // CHẤM MẶT TRỜI trên la bàn khi bật nắng — luôn thấy nắng tới từ phía nào, kể cả khi mặt trời ngoài khung hình
  if (NANG.bat && NANG.dW) {
    const v = NANG.dW.clone().applyQuaternion(qi), x = v.x * R, y = -v.y * R;
    const g = svgEl("g", { class: "mat-troi", "aria-label": "Hướng nắng" });
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4;
      g.append(svgEl("line", { x1: x + Math.cos(a) * 9, y1: y + Math.sin(a) * 9, x2: x + Math.cos(a) * 13, y2: y + Math.sin(a) * 13, stroke: "#e39b00", "stroke-width": 2, "stroke-linecap": "round" })); }
    g.append(svgEl("circle", { cx: x, cy: y, r: 7, fill: "#ffc933", stroke: "#e39b00", "stroke-width": 1.5, opacity: v.z < 0 ? 0.55 : 1 }));
    laBan.append(g);
  }
}
function nhinDocTruc(t, dau) {
  let d = trucThe(t, dau);
  const hienTai = camera.position.clone().sub(controls.target).normalize();
  if (hienTai.dot(d) > 0.999) d = trucThe(t, -dau);              // đang nhìn đúng trục ⇒ lật
  if (t === "z") d.add(trucThe("y", -1).multiplyScalar(1e-4)).normalize();   // tránh điểm kỳ dị trên/dưới
  const kc = camera.position.distanceTo(controls.target);
  const tu = camera.position.clone().sub(controls.target), den = d.multiplyScalar(kc);
  const q = new THREE.Quaternion().setFromUnitVectors(tu.clone().normalize(), den.clone().normalize());
  const q0 = new THREE.Quaternion(), t0 = performance.now();
  lbDong = (now) => {                                             // quay mượt 180ms
    const k = Math.min((now - t0) / 180, 1), e = 1 - (1 - k) ** 3;
    const qq = q0.clone().slerp(q, e);
    camera.position.copy(controls.target).add(tu.clone().applyQuaternion(qq));
    controls.update();
    if (k >= 1) { camera.position.copy(controls.target).add(den); controls.update(); lbDong = null; }
  };
  for (const b of document.querySelectorAll("[data-goc]")) b.setAttribute("aria-pressed", "false");
}
/* trục dưới con trỏ: chấm GẦN người xem nhất trong bán kính 12 (toạ độ viewBox) */
function trucTai(e) {
  const r = laBan.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * 120 - 60, y = ((e.clientY - r.top) / r.height) * 120 - 60;
  let tot = null;
  for (const d of lbViTri) if (Math.hypot(d.x - x, d.y - y) <= 12 && (!tot || d.z > tot.z)) tot = d;
  return tot ? tot.khoa : null;
}
laBan.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  laBan.setPointerCapture(e.pointerId);
  lbKeo = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, khoa: trucTai(e) };
});
laBan.addEventListener("pointerleave", () => { if (!lbKeo) lbHover = null; });
laBan.addEventListener("pointermove", (e) => {
  if (!lbKeo) { lbHover = trucTai(e); laBan.style.cursor = lbHover ? "pointer" : ""; return; }
  const dx = e.clientX - lbKeo.x, dy = e.clientY - lbKeo.y;
  lbKeo.x = e.clientX; lbKeo.y = e.clientY;
  if (Math.hypot(e.clientX - lbKeo.x0, e.clientY - lbKeo.y0) < 3) return;
  lbKeo.keo = true; laBan.classList.add("dang-keo");
  const off = camera.position.clone().sub(controls.target);
  const sp = new THREE.Spherical().setFromVector3(off);
  sp.theta -= dx * 0.012;
  sp.phi = Math.min(Math.max(sp.phi - dy * 0.012, 0.001), Math.PI - 0.001);
  camera.position.copy(controls.target).add(new V3().setFromSpherical(sp));
  controls.update();
  for (const b of document.querySelectorAll("[data-goc]")) b.setAttribute("aria-pressed", "false");
});
laBan.addEventListener("pointerup", (e) => {
  const k = lbKeo; lbKeo = null; laBan.classList.remove("dang-keo");
  if (!k || k.keo || !k.khoa) return;
  nhinDocTruc(k.khoa[0], Number(k.khoa.slice(1)));
});

/* ── vòng vẽ ───────────────────────────────────────────────────────────── */
function coLai() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    return true;
  }
  return false;
}
let lanVeCuoi = 0, soNhipYen = 0;          // soNhipYen: số nhịp liền không vẽ (phép thử chờ trình xem yên hẳn)
const camVe = { p: new THREE.Vector3(), q: new THREE.Quaternion(), t: new THREE.Vector3() };   // camera của khung vẽ cuối
/* camera lệch khỏi khung vẽ cuối quá ~1/20 điểm ảnh? — so với khung ĐÃ VẼ chứ không với khung trước: quán tính của
   OrbitControls còn nhích camera từng chút dưới ngưỡng update() báo, cộng dồn lại thành hình lệch vài điểm ảnh */
function camLech() {
  const kc = camera.position.distanceTo(controls.target) || 1, e = (kc * 4e-5) ** 2;       // ~1/20 điểm ảnh: tôn sóng dày
  return camera.position.distanceToSquared(camVe.p) > e || controls.target.distanceToSquared(camVe.t) > e   // ⇒ lệch nhỏ hơn thế vẫn
    || 1 - Math.abs(camera.quaternion.dot(camVe.q)) > 2e-10;                                    // hiện thành vân moiré
}
function ve(now = performance.now()) {
  requestAnimationFrame(ve);
  const doiCo = coLai();
  const dong = controls.update();                               // true khi camera còn trôi (quán tính)
  if (lbDong) lbDong(now);
  if (!(VE_LIEN_TUC || canVe || doiCo || dong || lbDong || now < veToi || now - lanVeCuoi > VE_AN_TOAN || camLech())) { soNhipYen++; return; }   // đứng yên: không vẽ
  canVe = false; lanVeCuoi = now; soNhipYen = 0;
  camVe.p.copy(camera.position); camVe.q.copy(camera.quaternion); camVe.t.copy(controls.target);
  const d = camera.position.clone().sub(controls.target).normalize();
  if (!NANG.bat) nang.position.copy(controls.target).add(new THREE.Vector3(d.x + 0.6, 1.2, d.z + 0.4).multiplyScalar(20));
  nang2.position.copy(controls.target).add(new THREE.Vector3(d.x, d.y + 0.15, d.z).multiplyScalar(20));   // ngay sau camera
  datMatGan();
  if (GOC) { datGhim(); datNhanThuoc(); veLaBan(); }
  veCanh();
}
controls.addEventListener("change", () => veLai());
ve();

/* ── KỊCH BẢN 3D: trạng thái một cảnh, đọc ra và áp lại TẠI CHỖ (không tải lại trang) ─────────────
   Trang hồ sơ mở trình xem MỘT lần trong khung 3D (tools/site/web/khung-3d.html) rồi mỗi nút cảnh chỉ gửi
   một trạng thái qua postMessage (web/nhung.js). Kho: data/canh-3d.yaml. Dạng trạng thái — mọi khoá tuỳ chọn:
     canh      mã cảnh trong danh mục (lớp bóc, mặt cắt sẵn, khung nhìn) — đổi tại chỗ, mọi nhóm đã tải sẵn
     v         góc nhìn "c=x,y,z;t=x,y,z" (toạ độ mô hình)       nhom     nhóm kết cấu đang hiện
     lop_tat / lop_bat  lớp tắt thêm / bật thêm so với mặc định của cảnh      lop_mo  lớp ◐ xem xuyên    an  vật ẩn (H)    rieng  chỉ xem (I)    xuyen  vật xem xuyên (T)
     noi_bat   id vật / tên lớp (đầu chuỗi) / «tiền-tố-mã*» làm nổi — mọi vật khác mờ
     cat       {truc, m, dao} mặt cắt tại toạ độ m      cat_san  số thứ tự mặt cắt sẵn
     boc       số lớp bóc   tach  khe tách lớp (m)   buoc  bước trình tự thi công   tt  {công tắc: lựa chọn}
     chon      id vật đang chọn    hien_ma  hiện khối tham chiếu
   Áp một trạng thái = đặt LẠI TỪ ĐẦU mọi thứ trên (khoá vắng ⇒ mặc định của cảnh), nên các cảnh không dính nhau. */
let MA_CANH = MA;
let LOP_TAT_MD = new Set();
const LOP_CM = () => new Set((GOC.userData.chon_mot || []).flatMap((cm) => cm.lua_chon.map((lc) => lc.nhan && lc.nhom)));
function doiCanh(ma) {
  const c = DM.canh[ma];
  if (!c || ma === MA_CANH) return;
  MA_CANH = ma; CANH = c;
  Object.assign(GOC.userData, { tieu_de: c.tieu_de || ma, lop_boc: c.lop_boc || [], mat_cat_san: c.mat_cat_san || [],
    khung_bo_nhom: c.khung_bo_nhom || [], khung_linh_kien: c.khung_linh_kien || null });
  $("ten-mo-hinh").textContent = GOC.userData.tieu_de;
  tachLop(0); bocK = 0; catSanDang = -1;
  dungBoc(); dungCatSan();
}
function trangThai() {
  const tt = { canh: MA_CANH, v: chuoiGoc() };
  const nhom = DM.linh_kien.map((x) => x.ma).filter((m) => !lkTat.has(m) && !LK_LOI.has(m));
  tt.nhom = nhom;
  // lớp: chỉ ghi phần KHÁC mặc định của cảnh; lớp do công tắc (tt) và do bóc lớp (boc) lái thì để khoá ấy mang
  const boQua = (n) => LOP_CM().has(n) || (bocK && lopCuaNhom(n) >= 0 && lopCuaNhom(n) < bocK);
  const tat = [...lopTat].filter((n) => !LOP_TAT_MD.has(n) && !boQua(n));
  const bat = [...LOP_TAT_MD].filter((n) => !lopTat.has(n) && !boQua(n));
  if (tat.length) tt.lop_tat = tat;
  if (bat.length) tt.lop_bat = bat;
  if (lopMo.size) tt.lop_mo = [...lopMo];
  if (anTay.size) tt.an = [...anTay];
  if (rieng) tt.rieng = [...rieng];
  if (vatMo.size) tt.xuyen = [...vatMo];
  if (NOI_BAT) tt.noi_bat = [...NOI_BAT];
  if (Math.abs(MO_NOI - MO_NOI_MD) > 1e-3) tt.mo = +MO_NOI.toFixed(2);
  if (NOI_LEN.ds) tt.noi_len = { ds: [...NOI_LEN.ds], khe: +NOI_LEN.khe.toFixed(2), ...(NOI_LEN.lop ? { lop: NOI_LEN.lop } : {}) };
  if (!$("bang-cat").hidden) {
    if (catSanDang >= 0) tt.cat_san = catSanDang;
    else tt.cat = { truc: trucCat, m: +Number(catMHien).toFixed(3), dao: $("cat-dao").checked };
  }
  if (bocK) tt.boc = bocK;
  if (tachKhe) tt.tach = +tachKhe.toFixed(3);
  const ttDs = (GOC.userData.trinh_tu || []).find((x) => BUOC_TT && x.ma === BUOC_TT.ma);
  if (ttDs && BUOC_TT.k < ttDs.buoc.length) tt.buoc = BUOC_TT.k;
  const cm = {};
  for (const x of GOC.userData.chon_mot || []) if (CHON_MOT.get(x.ma) !== x.mac_dinh) cm[x.ma] = CHON_MOT.get(x.ma);
  if (Object.keys(cm).length) tt.tt = cm;
  if (chon) tt.chon = chon.userData.id;
  if (hienMa) tt.hien_ma = true;
  if (NANG.bat) tt.nang = [NANG.ngay, +NANG.gio.toFixed(2)];
  return tt;
}
/* bay camera: tâm xoay đi thẳng, hướng nhìn quay theo cung (không chui qua mô hình), khoảng cách đổi dần */
let bayRaf = 0;
const em = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
function bayToi(s, giay) {
  const g = docChuoiGoc(s);
  if (!g.c || !g.t) return false;
  cancelAnimationFrame(bayRaf);
  const c1 = m2w(...g.c), t1 = m2w(...g.t);
  const dat = (c, t) => {
    camera.position.copy(c); controls.target.copy(t);
    camera.near = Math.max(c.distanceTo(t) / 500, 0.005);
    camera.updateProjectionMatrix(); controls.update();
  };
  if (!(giay > 0)) { dat(c1, t1); return Promise.resolve(); }
  const t0 = controls.target.clone(), d0 = camera.position.clone().sub(t0), d1 = c1.clone().sub(t1);
  const r0 = d0.length(), r1 = d1.length();
  /* THỜI GIAN THEO QUÃNG BAY (chủ nhà 2026-09-27: camera gần như đứng yên mà vẫn chờ đủ giây): quãng = max(dời tâm, dời
     camera) so với khoảng nhìn, hoặc góc quay so với 60° — đủ quãng thì bay đủ `giay`, quãng nhỏ thì ngắn theo tỉ lệ,
     gần như không đổi thì đặt thẳng. */
  const quang = Math.max(t0.distanceTo(t1) / Math.max(r0, 0.5), camera.position.distanceTo(c1) / Math.max(r0, 0.5),
    d0.angleTo(d1) / (Math.PI / 3), Math.abs(r1 - r0) / Math.max(r0, 0.5));
  if (quang < 0.02) { dat(c1, t1); return Promise.resolve(); }
  giay *= Math.max(0.25, Math.min(1, quang));
  const q = new THREE.Quaternion().setFromUnitVectors(d0.clone().normalize(), d1.clone().normalize());
  const q0 = new THREE.Quaternion(), bd = performance.now(), ms = giay * 1000;
  const buoc = (now) => {
    const k = Math.min(1, (now - bd) / ms), e = em(k);
    const t = t0.clone().lerp(t1, e);
    const d = d0.clone().normalize().applyQuaternion(q0.clone().slerp(q, e)).multiplyScalar(r0 + (r1 - r0) * e);
    dat(t.clone().add(d), t);
    veLai(60);
    if (k < 1) bayRaf = requestAnimationFrame(buoc); else xong();
  };
  let xong;
  const p = new Promise((r) => (xong = r));      // trả Promise (truthy) — kịch bản chờ bay xong mới sang bước sau
  bayRaf = requestAnimationFrame(buoc);
  return p;
}
let tachRaf = 0;
function tachDan(khe, giay, dzCam = 0) {
  cancelAnimationFrame(tachRaf);
  const b0 = Math.max(0, Math.min(0.6, Number(khe) || 0));
  if (!(giay > 0) || !lopBoc().length || Math.abs(b0 - tachKhe) < 1e-4) { tachLop(khe); doiCam(dzCam); return Promise.resolve(); }
  const c0 = camera.position.clone(), t0 = controls.target.clone(), d = m2w(0, 0, dzCam).sub(m2w(0, 0, 0));
  giay *= Math.max(0.3, Math.min(1, Math.abs(b0 - tachKhe) / 0.25));   // tách / ghép một chút thì nhanh hơn tách hẳn
  return new Promise((xong) => {
  const a = tachKhe, b = b0, bd = performance.now(), ms = giay * 1000;
  const buoc = (now) => {
    const k = Math.min(1, (now - bd) / ms), e = em(k);
    tachLop(a + (b - a) * e);
    if (dzCam) { camera.position.copy(c0).addScaledVector(d, e); controls.target.copy(t0).addScaledVector(d, e); controls.update(); }
    veLai(60);
    if (k < 1) tachRaf = requestAnimationFrame(buoc); else xong();
  };
  tachRaf = requestAnimationFrame(buoc);
  });
}
function doiCam(dz) {                     // dời camera + tâm xoay theo phương đứng dz (m, toạ độ mô hình)
  if (!dz) return;
  const d = m2w(0, 0, dz).sub(m2w(0, 0, 0));
  camera.position.add(d); controls.target.add(d); controls.update();
}
/* lớp bóc (lop_boc) của vật làm nổi đầu tiên — khi tách, lớp thứ i nâng (N−1−i)·khe; biết i thì dời camera theo đúng lớp ấy */
function lopNoi() {
  if (!NOI_BAT) return -1;
  for (const o of PHAN) if (o.visible && noiBatCo(o) && o.userData.lopBoc >= 0) return o.userData.lopBoc;
  return -1;
}
const nangLop = (i, khe) => (i >= 0 ? (lopBoc().length - 1 - i) * khe : 0);
/* bật / tắt tách lớp mà GIỮ góc nhìn vào lớp đang làm nổi: lớp ấy và camera đi cùng nhau */
function tachGiu(khe, giay = 0.8) {
  const i = lopNoi();
  return tachDan(khe, giay, nangLop(i, khe) - nangLop(i, tachKhe));
}
function apTrangThai(tt = {}, { bay = 0.8, tachDe = null, giuCam = false, giuNoiLen = false } = {}) {
  if (!GOC) return false;
  KB_SO++; cancelAnimationFrame(bayRaf); cancelAnimationFrame(tachRaf);   // cảnh mới cắt ngang kịch bản / chuyển động đang chạy
  if (tt.canh) doiCanh(tt.canh);
  const ids = (xs) => (xs || []).filter((x) => THEO_ID.has(x));
  lkTat.clear();
  const nhom = tt.nhom || CANH.hien || DM.linh_kien.map((x) => x.ma);
  for (const x of DM.linh_kien) if (!nhom.includes(x.ma)) lkTat.add(x.ma);
  lopTat.clear();
  for (const n of LOP_TAT_MD) lopTat.add(n);
  for (const n of tt.lop_tat || []) lopTat.add(n);
  for (const n of tt.lop_bat || []) lopTat.delete(n);
  for (const cm of GOC.userData.chon_mot || []) {
    const muon = (tt.tt || {})[cm.ma];
    datChonMot(cm, cm.lua_chon.some((lc) => lc.nhan === muon) ? muon : cm.mac_dinh);
  }
  lopMo.clear(); for (const n of tt.lop_mo || []) lopMo.add(n);
  anTay.clear(); for (const i of ids(tt.an)) anTay.add(i);
  rieng = tt.rieng ? new Set(ids(tt.rieng)) : null;
  vatMo.clear(); for (const i of ids(tt.xuyen)) vatMo.add(i);
  const noiCu = NOI_BAT;
  NOI_BAT = tt.noi_bat && tt.noi_bat.length ? new Set(tt.noi_bat) : null;
  datMoNoi(tt.mo != null ? tt.mo : MO_NOI_MD, bay > 0 ? Math.min(bay, 0.8) : 0);
  if (tt.noi_len && tt.noi_len.ds) noiLen(tt.noi_len.ds, { khe: tt.noi_len.khe ?? 0.5, lop: tt.noi_len.lop, ten: tt.noi_len.ten });
  else if (!giuNoiLen) boNoiLen();
  hienMa = !!tt.hien_ma;
  if (tt.nang) datNang({ bat: true, ngay: tt.nang[0], gio: tt.nang[1] });   // cảnh không mang nắng ⇒ giữ nắng người xem đang chọn
  if (BUOC_TT) BUOC_TT.k = Number.MAX_SAFE_INTEGER;
  dungNhomKetCau(); dungLop(GOC.userData.nhom || []); dungTrinhTu();
  if (BUOC_TT) datBuoc(tt.buoc || Number.MAX_SAFE_INTEGER);
  bocLop(tt.boc || 0);
  capNhatHien(); apMo(); dungDsAn();
  if (tt.cat_san != null && matCatSan().length) { batCat(true); catSan(tt.cat_san); }
  else if (tt.cat && tt.cat.truc) catTaiM(tt.cat.truc, Number(tt.cat.m), !!tt.cat.dao);
  else { catSanDang = -1; batCat(false); }
  datChon(tt.chon && THEO_ID.has(tt.chon) ? THEO_ID.get(tt.chon) : null);
  chuyenNoiBat(noiCu, bay > 0 ? Math.min(bay, 0.8) : 0);   // bay = 0: dừng chuyển đang chạy, về thẳng trạng thái mới   // làm nổi đi dần từ cảnh cũ sang cảnh mới, cùng lúc camera bay
  // tachDe: người xem ghi đè khe tách (nút «Tách lớp») — góc nhìn của cảnh chụp ở khe của CẢNH, nên dời camera theo lớp nổi
  const khe = tachDe != null ? tachDe : tt.tach || 0;
  let v = tt.v || gocKhungNoiBat(tt.huong, tt.xa);
  if (!tt.v && v) {                  // góc tự khung khi nhóm chậm còn đang tải: tải đủ thì khung lại (nếu cảnh chưa đổi)
    const so = KB_SO;
    READY.then(() => { if (so !== KB_SO) return; const v2 = gocKhungNoiBat(tt.huong, tt.xa); if (v2 && v2 !== v) bayToi(v2, 0.6); });
  }
  const dz = nangLop(lopNoi(), khe) - nangLop(lopNoi(), tt.tach || 0);
  if (v && dz) { const g = docChuoiGoc(v); if (g.c && g.t) { g.c[2] += dz; g.t[2] += dz; v = `c=${g.c.join(",")};t=${g.t.join(",")}`; } }
  // TÁCH LỚP TRƯỚC, xong rồi mới bay camera (chủ nhà 2026-09-27) — hai chuyển động cùng lúc khó theo dõi
  const bayCam = () => { if (!(v && bayToi(v, bay))) khungVua(phanKhung(), HUONG["truc-do"]); veLai(300); };
  const doiTach = Math.abs(khe - tachKhe) > 1e-4 && lopBoc().length;
  if (giuCam) tachLop(khe);
  else if (doiTach && bay > 0) tachDan(khe, bay).then(bayCam);
  else { tachLop(khe); bayCam(); }
  veLai(300);
  return true;
}
/* KỊCH BẢN CHUYỂN ĐỘNG của một mục (viec-3d.yaml `kich_ban`): tt = cảnh nền (nhóm, lớp, mặt cắt…) đặt tức thì,
   camera và khe tách GIỮ NGUYÊN; rồi chạy lần lượt các bước, bước sau chờ bước trước xong:
     {buoc:"tach", khe, giay}   {buoc:"camera", v, giay}   {buoc:"noi_bat", ds}   {buoc:"cho", giay}
   Kịch bản có bước noi_bat ⇒ cảnh nền chưa làm nổi gì. tachDe (nút «Tách lớp» của người xem) thắng khe của bước tach.
   Áp cảnh khác (apTrangThai) hay chạy kịch bản khác ⇒ kịch bản đang chạy dừng ở bước kế. */
let KB_SO = 0;
async function chayKichBan(tt = {}, ds = [], { tachDe = null } = {}) {
  if (!GOC) return false;
  const nen = { ...tt };
  delete nen.v;
  // kịch bản có bước làm nổi ⇒ cảnh nền GIỮ làm nổi đang hiện (không bỏ hết rồi làm nổi lại); bước ấy chuyển dần sang tập mới
  if (ds.some((b) => b.buoc === "noi_bat")) { if (NOI_BAT) nen.noi_bat = [...NOI_BAT]; else delete nen.noi_bat; }
  const coTach = ds.some((b) => b.buoc === "tach");
  apTrangThai(nen, { bay: 0, tachDe: coTach ? tachKhe : tachDe, giuCam: true, giuNoiLen: ds.some((b) => b.buoc === "noi_len") });
  const so = ++KB_SO;
  for (const b of ds) {
    if (so !== KB_SO) return false;
    const giay = Math.max(0, Math.min(10, Number(b.giay) || 0));
    if (b.buoc === "tach") await tachDan(tachDe != null ? tachDe : b.khe, giay);
    else if (b.buoc === "camera") { const v = b.v || gocKhungNoiBat(b.huong, b.xa); await (v && bayToi(v, giay)); }
    else if (b.buoc === "noi_bat") {
      const cu = NOI_BAT;
      NOI_BAT = b.ds && b.ds.length ? new Set(b.ds) : null;
      apMo();
      await chuyenNoiBat(cu, b.giay != null ? giay : 0.6);
    }
    else if (b.buoc === "cho") await new Promise((r) => setTimeout(r, giay * 1000));
    else if (b.buoc === "noi_len") await noiLen(b.ds || [], { khe: b.khe ?? 0.5, giay: b.giay != null ? giay : 0.8, ten: b.ten, lop: b.lop });
    veLai(300);
  }
  return so === KB_SO;
}
/* làm nổi từ chỗ đang chọn — nút trong trình xem khi khung 3D đang ở chế độ soạn */
function noiBatChon(theoLop) {
  const ds = cacChon();
  if (!ds.length) { NOI_BAT = null; apMo(); return null; }
  NOI_BAT = new Set(ds.map((o) => (theoLop ? o.userData.nhom : o.userData.id)));
  apMo();
  return [...NOI_BAT];
}


/* ── NỔI LÊN — xem rời một cấu kiện (chủ nhà 2026-09-28) ─────────────────────────────────────────────────────
   Đưa MỘT cấu kiện (ds = mã các vật của nó, vd năm bộ phận một ô lam) ra GIỮA khung nhìn, vẽ TRÊN mọi thứ (lớp riêng,
   xoá chiều sâu, phủ một màn mờ lên cảnh sau), xoay ngang cho các lớp của nó tách sang hai bên người xem, rồi TÁCH RỜI:
   bộ phận xếp theo trục mỏng nhất của cấu kiện (trục xuyên tường của ô lam), mỗi bộ phận dời ra khe × cỡ. Thanh «Tách
   rời» ở giữa đáy khung; ✕ đóng. Rê chuột lên một bộ phận: sáng lên + ba đường ghi kích thước thật (mm) + tên.
   Kịch bản: bước {buoc: noi_len, ds, khe 0…1, giay, lop?}; trạng thái cảnh: tt.noi_len = {ds, khe, lop?}. Áp cảnh khác ⇒ đóng.
   lop (tuỳ chọn): [[mã…], [mã…], …] — tách theo LỚP đã đặt thay vì theo tâm, vd gạch | bê tông | thép: thép nằm trong
   bê tông có cùng tâm nên tách theo tâm không kéo nó ra được. Lớp sau cùng nằm gần người xem nhất. */
var NOI_LEN = { ds: null, khe: 0, g: null, bo: [], truc: new THREE.Vector3(), buoc: 0.3, raf: 0, re: null };
const canhNoi = new THREE.Scene();
canhNoi.add(new THREE.HemisphereLight(0xffffff, 0x9a948a, 1.5));
const denNoi = new THREE.DirectionalLight(0xffffff, 1.6);
canhNoi.add(denNoi, denNoi.target);
const canhMan = new THREE.Scene(), camMan = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
canhMan.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
  new THREE.MeshBasicMaterial({ color: 0xf7f6f2, transparent: true, opacity: 0.72, depthTest: false, depthWrite: false })));
const VL_DUONG_NOI = new THREE.LineBasicMaterial({ color: 0xb8412c, depthTest: false, transparent: true });
const lopNhanNoi = document.createElement("div"); lopNhanNoi.id = "lop-noi"; lopNhan.after(lopNhanNoi);
const bangNoi = document.createElement("div");
bangNoi.className = "bang-noi-len"; bangNoi.hidden = true;
bangNoi.innerHTML = '<span class="noi-ten" id="noi-ten"></span><label class="noi-truot">Tách rời <input id="noi-khe" type="range" min="0" max="100" step="1" value="50" aria-label="Tách rời các bộ phận"></label><button type="button" id="noi-dong" title="Đóng xem rời (Esc)">✕</button>';
canvas.parentElement.append(bangNoi);
$("noi-khe").oninput = (e) => { datKheNoi(Number(e.target.value) / 100); };
$("noi-dong").onclick = () => boNoiLen();
function boNoiLen() {
  cancelAnimationFrame(NOI_LEN.raf);
  if (NOI_LEN.g) {
    canhNoi.remove(NOI_LEN.g);
    NOI_LEN.g.traverse((c) => { if (c.isLineSegments) c.geometry.dispose(); if (c.isMesh) c.material.dispose(); });
  }
  Object.assign(NOI_LEN, { ds: null, g: null, bo: [], re: null, khe: 0, lop: null, khoaLop: "" });
  bangNoi.hidden = true; lopNhanNoi.replaceChildren();
  veLai(60);
}
function datKheNoi(khe) {
  NOI_LEN.khe = Math.max(0, Math.min(1, khe));
  for (const b of NOI_LEN.bo) b.m.position.copy(b.goc).addScaledVector(NOI_LEN.truc, b.hang * NOI_LEN.khe * NOI_LEN.buoc);
  $("noi-khe").value = String(Math.round(NOI_LEN.khe * 100));
  if (NOI_LEN.re) veGhiNoi(NOI_LEN.re);
  veLai(60);
}
/* dựng lại nhóm nổi ở giữa khung: tâm cấu kiện đặt tại tâm xoay, cỡ ~55% chiều cao khung nhìn, xoay quanh phương đứng cho
   trục tách nằm chéo 35° so với phương ngang màn hình (thấy cả mặt lẫn khoảng tách). */
function noiLen(ds, { khe = 0.5, giay = 0, ten = "", lop = null } = {}) {
  const vat = (ds || []).map((i) => THEO_ID.get(i)).filter(Boolean);
  if (!vat.length || !GOC) { boNoiLen(); return Promise.resolve(); }
  const khoaLop = lop && lop.length ? JSON.stringify(lop) : "";
  const cung = NOI_LEN.g && NOI_LEN.ds && NOI_LEN.ds.join("|") === ds.join("|") && (NOI_LEN.khoaLop || "") === khoaLop;
  if (!cung) {
    const khe0 = NOI_LEN.g ? NOI_LEN.khe : 0;
    boNoiLen();
    const B = new THREE.Box3(), h = new THREE.Box3();
    for (const o of vat) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); B.union(h.copy(o.geometry.boundingBox)); }
    const C = B.getCenter(new V3()), S = B.getSize(new V3());
    const truc = S.x <= S.y ? new V3(1, 0, 0) : new V3(0, 1, 0);          // trục mỏng nhất trên mặt bằng = trục tách
    const g = new THREE.Group();
    GOC.updateMatrixWorld(true);
    const qG = new THREE.Quaternion(), sG = new V3(), pG = new V3();
    GOC.matrixWorld.decompose(pG, qG, sG);
    // xoay quanh phương đứng thế giới: trục tách → phải·cos35° + về phía camera·sin35°
    const len = new V3(0, 1, 0);
    const toi = camera.position.clone().sub(controls.target); toi.y = 0; toi.normalize();
    const phai = new V3().crossVectors(len, toi).normalize();
    const muon = phai.clone().multiplyScalar(Math.cos(0.61)).addScaledVector(toi, Math.sin(0.61)).normalize();
    const trucW = truc.clone().applyQuaternion(qG); trucW.y = 0; trucW.normalize();
    const qYaw = new THREE.Quaternion().setFromUnitVectors(trucW, muon);
    g.quaternion.copy(qYaw).multiply(qG);
    const kc = camera.position.distanceTo(controls.target);
    const caoKhung = 2 * kc * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const lon = Math.max(S.x, S.y, S.z);
    g.scale.setScalar((0.55 * caoKhung / Math.max(lon, 0.01)) * sG.x);
    g.position.copy(controls.target);
    // bộ phận xếp theo toạ độ tâm trên trục tách; cùng hàng nếu lệch < 3mm
    const tam = vat.map((o) => o.geometry.boundingBox.getCenter(new V3()).dot(truc));
    const hang = [...new Set(tam.map((t) => Math.round(t / 0.003)))].sort((a, b) => a - b);
    const lopCua = new Map();
    if (khoaLop) lop.forEach((ids, k) => ids.forEach((i) => lopCua.set(i, k)));
    const bo = vat.map((o, i) => {
      const vl = (o.userData.vlGoc || o.material).clone();
      vl.transparent = false; vl.opacity = 1; vl.depthWrite = true;
      const m = new THREE.Mesh(o.geometry, vl);
      m.userData = { id: o.userData.id, ten: o.userData.ten, vlGoc: vl };
      const goc = C.clone().negate();
      m.position.copy(goc);
      g.add(m);
      const h_ = khoaLop ? (lopCua.get(o.userData.id) ?? 0) - (lop.length - 1) / 2 : hang.indexOf(Math.round(tam[i] / 0.003)) - (hang.length - 1) / 2;
      return { m, goc, hang: h_ };
    });
    canhNoi.add(g);
    Object.assign(NOI_LEN, { ds: [...ds], g, bo, truc, buoc: Math.max(lon * 0.3, 0.12), khe: khe0, lop: khoaLop ? lop : null, khoaLop });
    NOI_LEN.ten = ten || vat[0].userData.ten;                        // tên mục trang việc (ten), không thì tên vật đầu
    $("noi-ten").textContent = NOI_LEN.ten;
    bangNoi.hidden = false;
  }
  cancelAnimationFrame(NOI_LEN.raf);
  if (!(giay > 0)) { datKheNoi(khe); return Promise.resolve(); }
  const a = NOI_LEN.khe, bd = performance.now();
  return new Promise((xong) => {
    const buoc = (now) => {
      const k = Math.min(1, (now - bd) / (giay * 1000));
      datKheNoi(a + (khe - a) * em(k));
      if (k < 1) NOI_LEN.raf = requestAnimationFrame(buoc); else xong();
    };
    NOI_LEN.raf = requestAnimationFrame(buoc);
  });
}
function veNoiLen() {
  const ac = renderer.autoClear;
  renderer.autoClear = false;
  renderer.setRenderTarget(null);
  renderer.render(canhMan, camMan);
  renderer.clearDepth();
  denNoi.position.copy(camera.position); denNoi.target.position.copy(controls.target);
  renderer.render(canhNoi, camera);
  renderer.autoClear = ac;
}
/* rê chuột: bộ phận dưới con trỏ sáng lên, ba đường ghi kích thước bao của nó (mm thật) + tên */
const rayNoi = new THREE.Raycaster();
function veGhiNoi(b) {
  for (const c of [...NOI_LEN.g.children]) if (c.isLineSegments) { NOI_LEN.g.remove(c); c.geometry.dispose(); }
  lopNhanNoi.replaceChildren();
  if (!b) return;
  const bb = b.m.geometry.boundingBox.clone().translate(b.m.position);        // toạ độ trong nhóm nổi (mô hình, đã dời)
  const s = bb.getSize(new V3());
  const c = NOI_LEN.g.worldToLocal(camera.position.clone());
  const g = Math.max(0.02, 0.08 * Math.max(s.x, s.y, s.z));
  const xn = c.x > (bb.min.x + bb.max.x) / 2 ? bb.max.x : bb.min.x, sx = xn === bb.max.x ? 1 : -1;
  const yn = c.y > (bb.min.y + bb.max.y) / 2 ? bb.max.y : bb.min.y, sy = yn === bb.max.y ? 1 : -1;
  const p = [];
  const ghi = (a, e, keo, dai) => {
    if (dai < 0.001) return;
    const A = new V3(...a), E = new V3(...e), K = new V3(...keo);
    p.push(...A.clone().sub(K.clone().multiplyScalar(0.8)).toArray(), ...A.clone().addScaledVector(K, 0.15).toArray());
    p.push(...E.clone().sub(K.clone().multiplyScalar(0.8)).toArray(), ...E.clone().addScaledVector(K, 0.15).toArray());
    p.push(...A.toArray(), ...E.toArray());
    const el = document.createElement("div");
    el.className = "nhan-thuoc kt";
    el.textContent = mm(dai) + " mm";
    el.dataset.w = NOI_LEN.g.localToWorld(A.clone().add(E).multiplyScalar(0.5)).toArray().join(",");
    lopNhanNoi.append(el);
  };
  ghi([bb.min.x, yn + sy * g, bb.min.z], [bb.max.x, yn + sy * g, bb.min.z], [0, sy * g, 0], s.x);
  ghi([xn + sx * g, bb.min.y, bb.min.z], [xn + sx * g, bb.max.y, bb.min.z], [sx * g, 0, 0], s.y);
  ghi([xn + sx * g, yn + sy * g, bb.min.z], [xn + sx * g, yn + sy * g, bb.max.z], [sx * g, sy * g, 0], s.z);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  const l = new THREE.LineSegments(geo, VL_DUONG_NOI); l.renderOrder = 20;
  NOI_LEN.g.add(l);
  const t = document.createElement("div");
  t.className = "nhan-thuoc noi-bo-phan";
  const tenBo = b.m.userData.ten.startsWith(NOI_LEN.ten + " — ") ? b.m.userData.ten.slice(NOI_LEN.ten.length + 3) : "";
  t.textContent = tenBo || (b.m.userData.ten === NOI_LEN.ten ? "khung" : b.m.userData.ten);
  t.dataset.w = NOI_LEN.g.localToWorld(new V3((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, bb.max.z)).toArray().join(",");
  lopNhanNoi.append(t);
  datNhanThuoc();
}
canvas.addEventListener("pointermove", (e) => {
  if (!NOI_LEN.g || e.buttons) return;
  const r = canvas.getBoundingClientRect();
  rayNoi.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const h = rayNoi.intersectObjects(NOI_LEN.bo.map((b) => b.m), false)[0];
  const b = h ? NOI_LEN.bo.find((x) => x.m === h.object) : null;
  if (b) $("nhan-di").hidden = true;                             // nhãn rê chuột của cảnh sau không lộ qua lớp nổi
  if (b === NOI_LEN.re) return;
  if (NOI_LEN.re) NOI_LEN.re.m.material.emissive?.setHex(0);
  NOI_LEN.re = b;
  if (b) b.m.material.emissive?.setHex(0x5a2a10);
  veGhiNoi(b);
  veLai(60);
});
addEventListener("keydown", (e) => { if (e.key === "Escape" && NOI_LEN.g) boNoiLen(); });
/* ── điều khiển từ ngoài (tools/3d/chup.mjs) ───────────────────────────── */
window.XEM = {
  ready: READY,
  hienDau: HIEN_DAU,                                                     // đợt đầu đã dựng (nhóm chậm còn đang thêm)
  buoc: (k) => datBuoc(k),                                               // trình tự thi công: hiện tới bước k
  hienVat: (id) => (THEO_ID.has(id) ? THEO_ID.get(id).visible : null),   // phép thử: vật có đang hiện không
  goc: (s) => (HUONG[s] ? datGoc(s) : apGoc(s)),
  chon: (id) => datChon(id ? THEO_ID.get(id) || null : null),
  khung: (ids) => khungVua(ids ? ids.map((i) => THEO_ID.get(i)).filter(Boolean) : phanKhung()),
  an: (ids) => { for (const i of ids) anTay.add(i); capNhatHien(); },
  rieng: (ids) => { rieng = ids ? new Set(ids) : null; capNhatHien(); },
  lop: (ten, bat) => { bat ? lopTat.delete(ten) : lopTat.add(ten); capNhatHien(); },
  ma: (bat) => { hienMa = bat; capNhatHien(); },
  cat: (truc, viTri, dao) => batCat(!!truc, truc, viTri, dao),
  catM: (truc, m, dao) => catTaiM(truc, m, dao),   // cắt tại toạ độ mô hình m (mét) thay vì vị trí thanh trượt
  catSan: (i) => catSan(i),                        // mặt cắt sẵn thứ i của mô hình (mat_cat_san)
  cotLop: (x, y) => cotLop(x, y),                  // bảng lớp theo phương đứng tại (x, y) mô hình
  bocLop: (k) => bocLop(k),                        // tắt k lớp đầu của lop_boc
  tachLop: (khe) => tachLop(khe),                  // tách lớp, khe (m) 0…0,6
  napCat: () => ({ nhom: NAP.map((g) => ({ khoa: g.khoa, so: g.so })), ho: HO }),
  chonTai: (s) => { const g = docChuoiGoc(s); diemBam = g.p ? new THREE.Vector3(...g.p) : null; },
  denGhiChu: (so) => { const b = GHI_CHU.find((x) => x.id === so); if (b) denGhiChu(b); return !!b; },
  taiGhiChu: () => taiGhiChu(),
  chuoiGoc: () => chuoiGoc(diemBam),
  trangThai: () => trangThai(),                     // kịch bản 3D: trạng thái cảnh đang xem
  apTrangThai: (tt, tuy) => apTrangThai(tt, tuy),   // kịch bản 3D: áp lại một cảnh tại chỗ
  chayKichBan: (tt, ds, tuy) => chayKichBan(tt, ds, tuy),   // trang việc 3D: cảnh nền + các bước chuyển động lần lượt
  noiBat: (theoLop) => noiBatChon(theoLop),         // làm nổi vật (hoặc lớp) đang chọn, mờ phần còn lại
  boNoiBat: () => { NOI_BAT = null; apMo(); },
  noiLen: (ds, tuy) => noiLen(ds, tuy || {}),        // xem rời một cấu kiện: ds = mã vật, tuy = {khe 0…1, giay}
  boNoiLen: () => boNoiLen(),
  noiLenHien: () => (NOI_LEN.g ? { ds: NOI_LEN.ds, khe: NOI_LEN.khe, bo: NOI_LEN.bo.length } : null),
  datNoiBat: (ds) => { NOI_BAT = ds && ds.length ? new Set(ds) : null; apMo(); return NOI_BAT ? [...NOI_BAT] : []; },
  dangChon: () => cacChon().map((o) => ({ id: o.userData.id, ten: o.userData.ten, nhom: o.userData.nhom })),
  tachGiu: (khe, giay) => { tachGiu(khe, giay); return khe; },
  tachHien: () => tachKhe,
  nang: (tuy) => { if (tuy) datNang(tuy); return { ...NANG, ...moTaNang() }; },   // nắng thật: {bat, ngay 1–365, gio 0–24}
  demNoiBat: () => (NOI_BAT ? PHAN.filter((o) => o.visible && noiBatCo(o)).length : null),   // phép thử: số vật đang hiện được làm nổi
  chieu: (x, y, z) => {                  // toạ độ mô hình → điểm màn hình (cho phép thử bấm chuột)
    const v = m2w(x, y, z).project(camera), r = canvas.getBoundingClientRect();
    return [r.left + ((v.x + 1) * r.width) / 2, r.top + ((1 - v.y) * r.height) / 2];
  },
  ghiChu: () => GHI_CHU,
  veMotKhung: () => { controls.update(); datMatGan(); if (GOC) { datGhim(); datNhanThuoc(); } veCanh(); },
  laBan: (khoa) => nhinDocTruc(khoa[0], Number(khoa.slice(1))),
  huongNhin: () => { const d = w2m(camera.position).sub(w2m(controls.target)).normalize(); return [d.x, d.y, d.z].map((n) => +n.toFixed(3)); },
  // vật chú thích (phép thử tự động)
  them: (rec) => { const o = themNhap(rec); chonNhap(o); return NHAP.length; },
  nhap: () => NHAP.map((o) => o.userData.rec),
  bienDoi: (kieu, truc, so) => { batBienDoi(kieu); if (truc) bienDoi.truc = truc; if (so != null) bienDoi.so = String(so); capNhatBienDoi(); xongBienDoi(true); return ctChon && ctChon.userData.rec; },
};
// điều khiển từ ngoài đổi cảnh không qua chuột/phím ⇒ mỗi lệnh XEM.* hẹn vẽ lại (vẽ khi cần)
for (const [k, f] of Object.entries(window.XEM)) if (typeof f === "function") window.XEM[k] = (...a) => { try { return f(...a); } finally { veLai(300); } };
