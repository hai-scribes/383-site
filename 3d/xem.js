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
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { heThong } from "./he_thong.js";

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
const VIEN_NET = Q.get("vien") !== "0";   // nét viền theo độ sâu — xem NET bên dưới
/* ĐỘ SÂU LOGARIT — TẮT mặc định (soát hiệu năng 2026-09-27 trên M3 Pro thật): gl_FragDepth ở mọi shader phá loại mặt
   khuất sớm của GPU Apple ⇒ thời gian GPU mỗi khung ×3 (10 → 31 ms cả nhà). Nhoè «lớp dưới qua tôn» đã hết nhờ mặt phẳng
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
let canVe = true, veToi = 0, KHUNG_LIEN = 0;   // KHUNG_LIEN > 0: có thứ đang chuyển động, vẽ mọi khung (XEM.yeuCauKhung)
/* vẽ liên tục tới khi gọi hàm trả về (gọi lại nhiều lần vô hại) — cho chuyển động của mô-đun khác */
function khungLienTuc() { KHUNG_LIEN++; let xong = false; return () => { if (!xong) { xong = true; KHUNG_LIEN = Math.max(0, KHUNG_LIEN - 1); } }; }
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
  /* hẹn giờ KHÔNG vẽ lại (chủ nhà 2026-10-31 «kéo camera chậm»): lượt quét sổ sách của mô-đun (chồng lùi, bảng danh sách — không
     đổi cảnh) mà đi qua bản bọc dưới thì mỗi nhịp 100–300 ms là một lượt vẽ cả nhà ⇒ trình xem không bao giờ rảnh, GPU bận sẵn
     khi kéo. Việc nào ĐỔI cảnh thì tự gọi VE_LAI(). */
  globalThis.HEN_KHONG_VE = { setTimeout: window.setTimeout.bind(window), setInterval: window.setInterval.bind(window) };
  const boc = (g) => (fn, ...r) => g((...a) => { try { return typeof fn === "function" ? fn(...a) : undefined; } finally { canVe = true; } }, ...r);
  window.setTimeout = boc(window.setTimeout.bind(window));
  if (VE_AN_TOAN !== Infinity) window.setInterval = boc(window.setInterval.bind(window));   // ?ve=thu: lượt hỏi 4s không được che hình cũ
  THREE.DefaultLoadingManager.onLoad = () => veLai(200);        // ảnh vân vật liệu giải mã xong
}
renderer.localClippingEnabled = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 500);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.screenSpacePanning = true;
controls.zoomToCursor = true;          // chụm / lăn phóng VỀ chỗ ngón tay / con trỏ như Bản đồ Apple, không về tâm xoay
// Cuộn sát tâm làm bán kính xoay → 0, và pan của OrbitControls cũng → 0: kéo như bị kẹt.
controls.minDistance = 0.5;
controls.addEventListener("start", () => {
  controls.panSpeed = Math.max(1, 2 / Math.max(camera.position.distanceTo(controls.target), controls.minDistance));
});
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
/* ĐANG KÉO CAMERA (chủ nhà 2026-10-31 «dragging the camera feels slow»): việc nặng không gấp (đổi bản mịn LOD — dựng nét
   viền cạnh trên luồng chính, đo 60–185 ms/khung khi xoay gần bếp) hoãn tới lúc thả tay. */
let KEO_CAM = false;
controls.addEventListener("start", () => { KEO_CAM = true; });
controls.addEventListener("end", () => { KEO_CAM = false; veLai(); });
/* KÉO KẸT (chủ nhà 2026-10-31 «even if I release … moving the cursor still keeps dragging»): OrbitControls chỉ thôi kéo khi
   NHẬN được pointerup trên khung vẽ; cú thả lạc (menu chuột phải của hệ điều hành mở giữa chừng, một trình nghe khác chặn
   sự kiện, đổi tiêu điểm cửa sổ) để nó kẹt ở thế kéo và chuột rê không bấm vẫn xoay nhà. Chuột di mà KHÔNG nút nào đang
   giữ trong khi controls còn giữ con trỏ ⇒ kết thúc cú kéo ấy. Chạy ở pha bắt của window, trước trình nghe của controls. */
addEventListener("pointermove", (e) => {
  if (e.pointerType !== "mouse" || e.buttons !== 0 || !controls._pointers?.length) return;
  for (const id of [...controls._pointers]) {
    try { controls._onPointerUp({ pointerId: id, pointerType: "mouse" }); }
    catch { controls._pointers.length = 0; controls.state = -1; }
  }
}, true);
/* ── ÁNH SÁNG: «MÀU THẬT» LÀ CÁCH XEM DUY NHẤT (chủ nhà 2026-10-24: «reflect the color of our house in real neutral light,
   without affecting by any lights»; 2026-10-25: «Màu thật is now the only mode») ──────────────────────────────────────
   HỘP ĐÈN TRẮNG ĐỀU — phép thử «lò trắng» của vật liệu PBR: không đèn nào (không trời, không đèn theo camera, đèn phòng
   bật chỉ tự phát sáng chứ không chiếu), môi trường là một quả cầu trắng trung tính sáng đều mọi hướng, không nén tông
   (tuyến tính, phơi sáng 1). Mặt khuếch tán hiện ĐÚNG màu gốc của vật liệu (mã sRGB trong khung/vat_lieu.py, hay màu ảnh
   vân) dù nhìn từ hướng nào; kim loại hiện đúng sắc phản xạ của nó; mặt bóng chỉ sáng thêm vài phần trăm như mẫu sơn
   thật đặt trong hộp đèn. Không còn bóng tối nên hình khối đọc bằng nét viền độ sâu (NET). Nền xám trung tính (như vách
   hộp so màu) để mắt không bị nền kéo lệch. Màu trên màn hình vẫn chỉ đúng bằng màn hình (sRGB, độ sáng vừa phải).
   Mọi vật liệu dùng môi trường của cảnh, envMapIntensity mặc định 1 — đừng gắn envMap / hạ cường độ riêng.
   Tuyến tính phơi sáng 1 = giữ nguyên màu (chỉ cắt trên 1,0); KHÔNG dùng NoToneMapping — lượt nét viền gọi toneMapping(). */
const MT_TRANG = (() => {                                   // quả cầu trắng tuyến tính 1,0 mọi hướng
  const c = new THREE.Scene();
  c.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide })));
  return new THREE.PMREMGenerator(renderer).fromScene(c, 0).texture;
})();
renderer.toneMapping = THREE.LinearToneMapping;
renderer.toneMappingExposure = 1;
scene.environment = MT_TRANG;
scene.environmentIntensity = 1;
scene.background = new THREE.Color().setRGB(0.36, 0.36, 0.36);   // xám trung tính ~sRGB 160
const DI_HUONG = Math.min(4, renderer.capabilities.getMaxAnisotropy());   // 4 đủ cho sàn nhìn xiên; 16 tốn băng thông GPU mà mắt khó thấy

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

/* MẶT PHẲNG GẦN theo mô hình (chống «lớp dưới nhoè lên lớp trên» — chủ nhà 2026-09-27, hai lớp mái sát nhau dưới 1 mm):
   bộ đệm độ sâu 24 bit phân giải ~z²/(gần·2²⁴). Gần = khoảng cách/500 cho ~0,6 mm ở 20 m — thua bề dày tôn. Đứng ngoài
   hộp mô hình thì đặt gần ngay trước mặt hộp (nới 1 m cho tách lớp, vật chú thích) ⇒ chính xác hơn hàng trăm lần; đứng
   trong nhà thì về như cũ. */
const _hopGan = new THREE.Box3(), _tamGan = new THREE.Vector3(), _coGan = new THREE.Vector3(), _hopCT = new THREE.Box3();
const GAN_TD = Q.get("gan") !== "0";                // ?gan=0: tắt (so sánh)
function datMatGan() {
  if (!GAN_TD || !hopTheGioi || hopTheGioi.isEmpty()) return;
  const kc = camera.position.distanceTo(controls.target);
  _hopGan.copy(hopTheGioi);
  /* ĐANG CẮT: phần nhà phía bị cắt không vẽ ⇒ xén hộp về phía còn hiện (chủ nhà 2026-10-31, ảnh chụp «Tầng 1»: nhìn từ trên
     xuống mặt cắt bằng, camera nằm TRONG hộp cả nhà nên mặt gần rơi về khoảng cách/500 ≥ 5 mm — sàn ở xa 8–10 m thì bậc độ
     sâu ~1–3 mm, mặt gạch +0,302 tranh với vữa mạch / bản sàn +0,300 ngay dưới thành mảng bậc thang xám). Mặt cắt luôn
     vuông góc một trục (capNhatCat) ⇒ xén thẳng biên hộp theo trục ấy. */
  if (matCat) {
    const n = matCat.normal, d = -matCat.constant;              // giữ phía n·x ≥ d … tức n·x + constant ≥ 0
    for (const [k, c] of [["x", n.x], ["y", n.y], ["z", n.z]]) {
      if (Math.abs(c) < 0.999) continue;
      const v = d / c;
      if (c > 0) _hopGan.min[k] = Math.max(_hopGan.min[k], v); else _hopGan.max[k] = Math.min(_hopGan.max[k], v);
    }
    if (_hopGan.isEmpty()) _hopGan.copy(hopTheGioi);
  }
  // vật chú thích (nháp, của ghi chú, vùng) đặt được ra NGOÀI hộp nhà — gộp vào hộp, kẻo mặt gần / xa cắt mất chúng
  for (const g of [nhomNhap, nhomCTGhi, nhomVung, nhomVungGhi]) {
    if (g && g.children.length && g.visible) { _hopCT.setFromObject(g); if (!_hopCT.isEmpty()) _hopGan.union(_hopCT); }
  }
  _hopGan.expandByScalar(1);
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
/* ── NÉT VIỀN theo độ sâu (chủ nhà 2026-09-24: «khó phân biệt hình khối») ─────────────────────────────
   Mặt có vân không vẽ viền cạnh (lộ mạch nối khối tường) nên khối cùng tông nhoè vào nhau. Tô nét trên ẢNH:
   (1) vật ĐỤC vẽ vào bộ đệm (màu + độ sâu, MSAA 4); (2) một tấm phủ màn hình đọc độ sâu, tô tối chỗ độ sâu gãy, và
   chép độ sâu ấy sang khung vẽ; (3) vật TRONG SUỐT (kính, rèm voan, khối mờ) + nét viền cạnh vẽ thẳng lên khung vẽ,
   thử độ sâu với vật đục — nên nét của thứ nằm SAU kính/rèm bị kính/rèm phủ đúng như thật.
   Đo gãy bằng sai phân bậc hai của 1/z — trên một mặt PHẲNG 1/z tuyến tính theo điểm ảnh nên sai phân = 0 dù nhìn
   xiên, và hai khối tường ghép phẳng không lộ mạch; góc gãy (tường gặp sàn) và mép bóng (vật trước nền) thì ≠ 0.
   Chi phí: mỗi vật vẫn vẽ đúng MỘT lần (tách hai lượt theo lớp camera, không vẽ lại hình học) — chỉ thêm một tấm
   phủ vài lần đọc độ sâu/điểm ảnh. Vật trong suốt, nét viền cạnh không vào bộ đệm độ sâu ⇒ không sinh nét. Tắt: ?vien=0 (vẽ thẳng như cũ) · phím V · nút «Nét viền». */
const NET_DAU = { value: 0 };
const VL_DAY = new WeakSet();
function danhDauDay(m) {                       // vật liệu sóng dày (VIEN_THUA): đánh dấu alpha cho NET mờ dần nếp sóng ở xa
  if (!m || VL_DAY.has(m) || !(m.isMeshStandardMaterial || m.isMeshBasicMaterial)) return;   // Basic: bản trắng của XAM
  VL_DAY.add(m);
  const truoc = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    truoc?.call(m, sh, r);
    sh.uniforms.uNetDau = NET_DAU;
    sh.fragmentShader = "uniform float uNetDau;\n" + sh.fragmentShader.replace("#include <opaque_fragment>",
      "#include <opaque_fragment>\n  if (uNetDau > 0.5) gl_FragColor.a = 0.75;");
  };
  const k0 = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => (k0 ? k0() : "") + "|day";
  m.needsUpdate = true;
}
const NET = (() => {
  if (!VIEN_NET) return null;
  const dt = new THREE.DepthTexture(1, 1, THREE.UnsignedInt248Type);
  dt.format = THREE.DepthStencilFormat;
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4, stencilBuffer: true, depthTexture: dt,
    resolveStencilBuffer: false });                          // stencil chỉ dùng lúc vẽ nắp cắt, không cần gộp ra
  const vl = new THREE.ShaderMaterial({
    uniforms: { tMau: { value: rt.texture }, tSau: { value: dt }, uBuoc: { value: new THREE.Vector2() },
      uGan: { value: 0.01 }, uXa: { value: 500 }, uNguong: { value: 1 }, uManh: { value: 0.55 }, uLuong: { value: 0 }, uNen: { value: new THREE.Color() },
      uLogQ: { value: 0 }, uK: { value: 0.002 } },
    defines: LOG_Z ? { DO_SAU_LOG: 1 } : {},
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `
      uniform sampler2D tMau; uniform sampler2D tSau; uniform vec2 uBuoc; uniform float uGan, uXa, uNguong, uManh, uLuong, uLogQ, uK; uniform vec3 uNen;
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
        // MẶT SÓNG DÀY (tôn ốp sóng vuông — alpha 0,75 đánh dấu ở lượt (1), xem VL_DAY): nếp sóng cách 50 mm, nhìn xa còn < 4
        // điểm ảnh thì hàng trăm nét một điểm ảnh lấy mẫu chồng thành vân vòng cung (soát điện thoại 2026-10-21) — mờ dần nét
        // gãy nhẹ của nếp sóng; mép bóng / góc gãy lớn của tấm vẫn giữ
        if (mau.a > 0.6 && mau.a < 0.9) net *= max(smoothstep(1.5, 4.0, 0.05 * c / uK), smoothstep(nguong * 20.0, nguong * 60.0, g));
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
    u.uK.value = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / kich.y;
    if (scene.background?.isColor) u.uNen.value.copy(scene.background);
    // chỉ vật đang ở lớp 0 (phân tích «ẩn vỏ» tắt lớp 0 — đừng bật lại), trả ĐÚNG mặt nạ cũ sau khi vẽ (soát Codex 2026-09-24).
    // MỌI vật đang hiện trong cảnh, không riêng PHAN (chủ nhà 2026-10-23: «hình mới thêm không hiện ở góc không có lưới nào
    // phía sau»): vật không ghi độ sâu (trong suốt / depthWrite tắt — vật nháp, nhãn, lớp phủ của mô-đun) vẽ ở lượt (1) thì
    // điểm ảnh của nó vẫn mang độ sâu 1 ⇒ tấm phủ (2) coi là NỀN và tô đè màu nền lên. Vật không vẽ màu (bộ đếm nắp cắt
    // ghi stencil) ở lại lượt (1).
    scene.traverseVisible((o) => {
      if (!(o.layers.mask & 1) || !o.material) return;
      const m = o.material, vao = (x) => x.colorWrite !== false && (x.transparent || x.depthWrite === false);
      if (Array.isArray(m) ? m.some(vao) : vao(m)) { doiLop.push(o, o.layers.mask); o.layers.set(1); }
    });
    renderer.setRenderTarget(rt);
    NET_DAU.value = 1;                                        // vật liệu sóng dày ghi alpha 0,75 vào bộ đệm — chỉ ở lượt này
    try { renderer.render(scene, camera); }                   // (1) vật đục (lớp 0)
    finally { NET_DAU.value = 0; }
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
const _kichVe = new THREE.Vector2();
function veCanh() {
  scene.updateMatrixWorld();
  LOD_MIN.buoc();
  DANH_DAU.dung();                                            // vòng đánh dấu vật nhỏ — đọc hiện/ẩn thật, trước lô gộp                                             // bản mịn theo cỡ trên màn hình — trước lô gộp
  renderer.getDrawingBufferSize(_kichVe); VIEN_K.value = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / Math.max(1, _kichVe.y);
  dongBoDem();                                                // lô đếm nắp cắt đọc hiện/ẩn thật — trước khi lô gộp giấu vật gốc
  const tap = XAM.tap();                                      // cụm đang chọn ⇒ mọi thứ khác xám trơn (XAM)
  const an = LO ? LO.truoc(tap) : null;                       // vật đang ở trạng thái gốc: ẩn, vẽ qua lô gộp
  const doiXam = tap ? XAM.doi(tap) : null;
  try { if (NET) NET.ve(); else renderer.render(scene, camera); }
  finally { if (doiXam) XAM.tra(doiXam); }
  if (an) for (const o of an) o.visible = true;
  VIEN_CUM.ve();                                              // viền quanh cả cụm đang chọn (sau lượt chính, vật gốc đã hiện lại)
  if (NOI_LEN && NOI_LEN.g) veNoiLen();
}

/* ── TÔNG THEO HƯỚNG MẶT cho bản trắng (học Anatomy 2026-10-27: phần nền không vân, không màu nhưng vẫn ĐỌC RA KHỐI) ──
   Trắng không chiếu sáng thì mọi mặt một màu — khối chỉ còn đọc bằng nét. Ở đây mỗi điểm ảnh nhân màu trắng với một hệ số
   theo hướng mặt: mặt NGỬA (sàn, mặt bàn, đỉnh tường) sáng nhất ×1,03; mặt đứng ×0,915…0,99 theo góc với một nguồn sáng cố
   định trên-trái-trước CAMERA (xoay tới đâu cũng đọc như nhau); mặt ÚP (trần nhìn từ dưới) ×0,93. Hệ số liên tục (không
   lượng tử) nên mặt cong không thành bậc thang. Vẫn MeshBasic: không đèn, không ảnh — thêm một tích vô hướng mỗi điểm ảnh.
   Pháp tuyến lấy từ ĐẠO HÀM vị trí trên màn hình (phẳng từng tam giác — đúng như bản vẽ thật, vốn flatShading): .glb của ta
   không mang thuộc tính normal (khung/xuat_glb.py), đọc `normal` trong shader là đọc rác còn sót của thuộc tính khác
   (đo 2026-10-27: sàn ra hướng ngang). ?xam=phang: trắng phẳng như trước. */
const TONG_MAT = Q.get("xam") !== "phang";
function tongMat(m) {
  if (!TONG_MAT) return m;
  const truoc = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    truoc?.call(m, sh, r);
    sh.vertexShader = "varying vec3 vPTong;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n  vPTong = mvPosition.xyz;");
    sh.fragmentShader = "varying vec3 vPTong;\n" + sh.fragmentShader.replace("#include <opaque_fragment>", `{
    vec3 nV = normalize(cross(dFdx(vPTong), dFdy(vPTong)));
    if (dot(nV, vPTong) > 0.0) nV = -nV;                     // luôn là mặt quay về camera
    vec3 nW = (vec4(nV, 0.0) * viewMatrix).xyz;              // về hệ thế giới (y lên)
    float ben = 0.915 + 0.075 * clamp(dot(nV, normalize(vec3(-0.5, 0.3, 0.8))), 0.0, 1.0);
    float k = mix(ben, 1.03, smoothstep(0.55, 0.9, nW.y));
    k = mix(k, 0.93, smoothstep(0.55, 0.9, -nW.y));
    outgoingLight *= k;
  }
  #include <opaque_fragment>`);
  };
  const k0 = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => (k0 ? k0() : "") + "|tong";
  m.needsUpdate = true;
  return m;
}

/* ── CHỌN ⇒ CÒN LẠI TRẮNG TRƠN (chủ nhà 2026-10-25: «khi một vật được chọn và làm sáng, mọi thứ khác không vân, không màu»;
   cùng ngày: «trắng mờ, không phải xám» · «trắng hơn nữa, và vật bỏ chọn tốn ít CPU, GPU hơn») ──
   Chỉ trong lượt vẽ chính: mỗi vật đang hiện NGOÀI cụm chọn (kể cả lô gộp) tạm mang một vật liệu TRẮNG KHÔNG CHIẾU SÁNG
   (MeshBasicMaterial): không ánh đèn, không ảnh vân / pháp tuyến / nhám ⇒ mỗi điểm ảnh chỉ một màu, rẻ nhất GPU vẽ được; hình
   khối đọc bằng nét viền cạnh + nét gãy độ sâu (NET) như cũ. Vật liệu trắng DÙNG CHUNG theo vài thuộc tính còn ý nghĩa (trong
   suốt, độ đục, mặt, ghi độ sâu, alphaMap…) ⇒ cả nhà chỉ vài chương trình đổ bóng, ít đổi trạng thái giữa các lượt vẽ. Kính
   vẫn trong suốt (giữ độ đục). Trả vật liệu thật ngay sau lượt vẽ ⇒ bấm chọn, lô gộp, mặt nạ viền cụm (màu thật soi xuyên)
   không biết gì. Cụm chọn rời lô gộp (truoc(bo)) để giữ vật liệu thật. Vật liệu không phải PBR (nắp cắt, bộ đếm stencil,
   nét) để nguyên. Tắt: ?xam=0. */
const XAM = (() => {
  const TAT = Q.get("xam") === "0";
  const MAU = new THREE.Color(0xebe9e4), CACHE = new WeakMap(), CHUNG = new Map();   // trắng ngà dịu (2026-10-25: «hơi bớt trắng»)
  function vl(m) {
    if (Array.isArray(m)) { const a = m.map(vl); return a.every((x, i) => x === m[i]) ? m : a; }
    // vật liệu TÔ TRẠNG THÁI (giuMau: vàng «cùng mạch / điều khiển / nguồn», đèn đang sáng, quạt đang chạy, làm nổi xanh)
    // giữ nguyên — chúng chỉ hiện khi đang chọn, đúng lúc XAM chạy (soát Opus 2026-10-25)
    if (!m || !m.isMeshStandardMaterial || m.colorWrite === false || m.userData.giuMau) return m;
    let x = CACHE.get(m);
    // độ đục / trong suốt của vật liệu mờ đổi TẠI CHỖ (thanh «Độ đậm», mờ dần khi chuyển cảnh) ⇒ bản trắng phải theo
    if (x && (x.opacity !== m.opacity || x.transparent !== m.transparent)) x = null;
    if (!x) {
      const day = VL_DAY.has(m);
      const k = [m.transparent, m.opacity, m.side, m.depthWrite, m.depthTest, m.alphaTest, m.alphaMap?.uuid || "", m.forceSinglePass,
        m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits, day].join("|");
      x = CHUNG.get(k);
      if (!x) {
        x = new THREE.MeshBasicMaterial({ color: MAU, transparent: m.transparent, opacity: m.opacity, side: m.side,
          depthWrite: m.depthWrite, depthTest: m.depthTest, alphaTest: m.alphaTest, alphaMap: m.alphaMap, forceSinglePass: m.forceSinglePass,
          polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits });
        x.name = "trắng (bỏ chọn)"; x.userData = { dungChung: true };
        tongMat(x);                                               // khối đọc bằng tông mặt, không chỉ bằng nét
        if (day) danhDauDay(x);                                  // tôn sóng: giữ dấu cho NET mờ nếp sóng ở xa
        CHUNG.set(k, x);
      }
      CACHE.set(m, x);
    }
    return x;
  }
  let dsCu = null, reCu = null, tapCu = null;                     // tập cụm chọn dựng lại chỉ khi chọn / rê đổi, không mỗi khung
  const tap = () => {
    if (TAT || !cheDoSua()) return null;                          // chế độ xem: chọn vật không đổi màu phần còn lại
    // cụm đang RÊ giữ màu thật như cụm chọn (chủ nhà 2026-10-31: «hovering should still do slight highlight like normal mode»)
    const ds = VIEN_CUM.ds(), re = VIEN_CUM.dsRe();
    if (ds !== dsCu || re !== reCu) { dsCu = ds; reCu = re; tapCu = ds && ds.length ? new Set(re ? [...ds, ...re] : ds) : null; }
    return tapCu;
  };
  function doi(bo) {
    const ds = [];
    scene.traverseVisible((o) => {
      if (!o.isMesh || bo.has(o) || !o.material) return;
      const m = vl(o.material);
      if (m !== o.material) { ds.push(o, o.material); o.material = m; }
    });
    return ds;
  }
  const tra = (ds) => { for (let i = 0; i < ds.length; i += 2) ds[i].material = ds[i + 1]; };
  return { tap, doi, tra, bat: !TAT, mau: MAU };
})();

let GOC = null;              // nút gốc của mô hình (mang phép xoay z-up → y-up)
const PHAN = [];             // mọi mesh vật thể
const THEO_ID = new Map();
let chon = null;             // mesh đang chọn
const anTay = new Set();     // id bị ẩn theo cảnh (kịch bản 3D `an`, XEM.an) — người xem không còn nút/phím ẩn (2026-10-21)
let rieng = null;            // Set id «chỉ xem» (cảnh `rieng`, trang con kiểu hạng mục `nen`, CHI TIẾT CỤM) hoặc null
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
      DS.push({ o, bm, iid, vl: o.material, g: o.userData.hinhGoc || o.geometry, p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone(), dang: false, vien: -1, vienDang: false });
    }
    bm.computeBoundingBox(); bm.computeBoundingSphere();
    goc.add(bm);
  }
  if (!DS.length) return null;
  /* viền cạnh gộp: đoạn thẳng của mọi vật trong lô nối thành một mảng; bật/tắt từng vật bằng cách dựng lại chỉ số (chỉ khi
     tập vật đổi — bật/tắt lớp, chọn — không phải mỗi khung) */
  const gv = new THREE.BufferGeometry();
  let cs;
  // viền THƯỜNG của từng vật (đã bỏ mạch phẳng nếu lượt giấu mạch xong — `vienLien`, kể cả vật đang chọn) nối thành một mảng.
  // Gọi lại khi lượt giấu mạch (luồng nền) trả kết quả: chỉ chép lại mảng viền, không dựng lại lô.
  function napVien() {
    let tong = 0;
    const hinh = (d) => { const u = d.o.userData; return u.vienLien || u.vien?.geometry; };
    for (const d of DS) { d.vien = -1; d.vienDang = false; const g = hinh(d); if (g && g !== HINH_RONG) { d.vien = tong; d.soVien = g.attributes.position.count; tong += d.soVien; } }
    const vt = new Float32Array(tong * 3);
    for (const d of DS) if (d.vien >= 0) vt.set(hinh(d).attributes.position.array, d.vien * 3);   // toạ độ lưới = toạ độ GOC (vật chưa dời)
    gv.dispose();
    gv.setAttribute("position", new THREE.BufferAttribute(vt, 3));
    // khoảng cách nét của tôn sóng (m) — VIEN mờ dần nét khi khoảng ấy trên màn hình < vài điểm ảnh (xem VIEN_THUA)
    const th = new Float32Array(tong);
    for (const d of DS) if (d.vien >= 0 && VIEN_THUA[d.o.userData.vat_lieu]) th.fill(VIEN_THUA[d.o.userData.vat_lieu], d.vien, d.vien + d.soVien);
    gv.setAttribute("thua", new THREE.BufferAttribute(th, 1));
    cs = new THREE.BufferAttribute(tong > 65535 ? new Uint32Array(tong) : new Uint16Array(tong), 1);
    cs.setUsage(THREE.DynamicDrawUsage);
    gv.setIndex(cs); gv.setDrawRange(0, 0);
  }
  napVien();
  const vien = new THREE.LineSegments(gv, VIEN);
  vien.name = "viền gộp"; vien.raycast = () => {}; vien.frustumCulled = false;
  if (NET) vien.layers.set(1);                                    // như viền riêng: vẽ ở lượt trong suốt
  goc.add(vien);
  GOC.add(goc);
  console.info(`gộp lưới: ${DS.length} vật → ${goc.children.length - 1} lô theo vật liệu + 1 viền gộp`);
  const an = [];
  function truoc(bo = null) {                                     // bo: vật phải vẽ riêng khung này (cụm đang chọn — XAM)
    an.length = 0;
    let doiVien = false;
    // mặt cắt KHÔNG còn tắt lô gộp: bộ đếm nắp nay là lô riêng (dongBoDem), không phải con của vật
    for (const d of DS) {
      const o = d.o, v = o.userData.vien;
      let dung = !bo?.has(o) && o.visible && (o.layers.mask & 1) !== 0 && o.material === d.vl && o.geometry === d.g    // bản mịn (LOD): vẽ riêng
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
  return { truoc, goc, soVat: DS.length, DS, napVien };
}

/* ── LÀM NỔI THIẾT BỊ (thay vòng đánh dấu — chủ nhà 2026-10-25: «highlight component instead of dots») ─────────────────
   Cảnh mang `danh_dau: true` (trang con: nen_3d.py tự bật khi quá nửa vật làm nổi là vật nhỏ — ổ, công tắc, cảm biến, đầu
   báo, điểm wifi, đoạn ống chờ → apTrangThai tt.danh_dau): mọi vật ĐANG LÀM NỔI, đang hiện, mang tô nhấn + viền ngoài dày
   2,5 điểm ảnh CSS của chính hình nó (VIEN_CUM.datNoi — cùng bộ viền với cụm chọn) — thấy đúng thiết bị, không còn chấm cam
   chỉ chỗ tâm. Phần bị tường che tô nhạt hơn nhưng vẫn hiện. Dựng lại tập khi bật / tắt, khi làm nổi đổi, hoặc khi số vật
   đang hiện đổi (bật lớp, nhóm về sau). */
const DANH_DAU = (() => {
  let bat = false, ban = true, khoa = "", nbCu = null, so = 0;
  function dung() {
    if (!bat || !NOI_BAT || !GOC) { if (so) { so = 0; khoa = ""; VIEN_CUM.datNoi(null); } return; }
    const ds = PHAN.filter((o) => o.visible && !o.userData.ma && noiBatCo(o));
    const k = ds.length + ":" + PHAN.length;
    if (!ban && k === khoa && NOI_BAT === nbCu) return;
    ban = false; khoa = k; nbCu = NOI_BAT; so = ds.length;
    VIEN_CUM.datNoi(ds);
  }
  return { bat: (b) => { bat = b; ban = true; veLai(60); }, dung, dang: () => bat, so: () => so };
})();

/* ── BẢN MỊN — LOD (chủ nhà 2026-10-22: «zooming in has better resolution and more topology… then zoom out the whole
   house; objects can have different version of LOD depending on camera zooming level») ──────────────────────────────
   Vật cong (ống, vành, ống uốn, khối build123d — extras.lod) có bản mịn ~3× số cạnh, pháp tuyến mượt, trong
   mo-hinh/lk/<nhóm>.lod.glb (khung/xuat_glb.py xuat_lod). Thước đo theo CỠ TRÊN MÀN HÌNH của phần CONG: extras.lod = cỡ
   cong (m, xuat_glb _co_cong: 2 × bán kính cong trung vị — ống: đường kính, kể cả ống dài chạy chéo / uốn; đo bằng hộp
   hay cầu bao thì ống chạy dọc nhà đòi bản mịn cả khi nhìn cả nhà), chia khoảng cách tới điểm GẦN NHẤT của hộp bao, ra
   điểm ảnh thật — đúng cho cả xoay gần lẫn thu phóng ống kính: > LEN thì đổi sang bản mịn, < XUONG thì về bản thường (khoảng
   trễ để không nhảy qua lại). Tệp mịn của một nhóm chỉ tải khi có vật của nhóm ấy vượt LEN — nhìn cả nhà không tải gì.
   Đổi hình tại chỗ (o.geometry), vật liệu / chọn / viền cụm / tia bấm giữ nguyên; vật đang mịn tự rời lô gộp (DS.g).
   Cạnh viền của bản mịn tính lại (25° như bản thường). Bộ kiểm hình (?chup=1) và ?lod=0: tắt. */
const LOD_MIN = (() => {
  const TAT = Q.get("lod") === "0" || Q.has("chup");
  const LEN = 90, XUONG = 60;                            // cạnh giữa trên màn hình, điểm ảnh bộ đệm vẽ (ống 16 cạnh ở 90 px: mỗi cạnh ~18 px — thấy gãy)
  const NHOM = new Map();                                // nhóm → Promise<Map(id → hình mịn)> | Map
  let lan = 0, ds = null;
  const camXet = { p: new THREE.Vector3(NaN, 0, 0), q: new THREE.Quaternion(), n: -1 };   // camera ở lần xét cuối
  const hop = new THREE.Box3(), co = new THREE.Vector3(), kich = new THREE.Vector2();
  function tai(ma) {
    if (NHOM.has(ma)) return NHOM.get(ma);
    const x = DM?.linh_kien?.find((l) => l.ma === ma);
    const url = `mo-hinh/lk/${ma}.lod.glb` + (x?.vl ? `?v=${x.vl}` : "");
    const p = new GLTFLoader().loadAsync(url).then((g) => {
      const lodV = g.scene.children[0]?.userData?.lod_v;
      const goc = [...LK_UD].reverse().find((x) => x.ma === ma)?.ud?.lod_v;
      const m = new Map();
      if (!lodV || !goc || lodV !== goc) console.warn("bản mịn khác phiên bản bản gốc:", ma);
      else g.scene.traverse((o) => { if (o.isMesh && o.userData?.id) m.set(o.userData.id, o.geometry); });
      NHOM.set(ma, m); veLai(60);
      return m;
    }, (e) => { console.warn("bản mịn không tải được:", ma, e?.message || e); NHOM.set(ma, new Map()); return null; });
    NHOM.set(ma, p);
    return p;
  }
  function dat(o, min) {
    const u = o.userData;
    if (min) {
      if (!u.hinhGoc) u.hinhGoc = o.geometry;
      o.geometry = u.hinhMin;
      if (u.vien && u.canVien && u.vien.geometry !== HINH_RONG) {
        if (!u.vienGoc) u.vienGoc = u.vien.geometry;
        u.vien.geometry = u.vienMin || (u.vienMin = new THREE.EdgesGeometry(u.hinhMin, 25));
      }
    } else {
      o.geometry = u.hinhGoc;
      if (u.vienGoc && u.vien && u.vien.geometry === u.vienMin) u.vien.geometry = u.vienGoc;
    }
    u.dangMin = min;
  }
  function buoc() {
    if (TAT || !GOC) return;
    const bay = performance.now();
    // hẹn xét lại CHỈ khi camera đã dời từ lần xét cuối / còn việc hoãn / số vật đổi (chủ nhà 2026-10-31 «kéo camera chậm»: hẹn
    // vô điều kiện thì mỗi lần hẹn là một lượt vẽ cả nhà, lượt ấy lại rơi vào khung 150 ms ⇒ vẽ lại ~5 lần/giây mãi khi rảnh)
    const doi = buoc.con || !camXet.p.equals(camera.position) || !camXet.q.equals(camera.quaternion) || camXet.n !== PHAN.length;
    if (bay - lan < 150) { if (!buoc.hen && doi) buoc.hen = setTimeout(() => { buoc.hen = 0; veLai(); }, 160); return; }
    if (!doi) return;
    lan = bay; buoc.con = false;
    camXet.p.copy(camera.position); camXet.q.copy(camera.quaternion); camXet.n = PHAN.length;
    if (!ds || ds.length === 0 || ds.soPhan !== PHAN.length) { ds = PHAN.filter((o) => o.userData.lod && o.isMesh); ds.soPhan = PHAN.length; }
    renderer.getDrawingBufferSize(kich);
    const k = kich.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    for (const o of ds) {
      const u = o.userData;
      if (u.khoa9) continue;                             // đang giãn kiểu 9 ô ở chế độ sửa (dat_do.js ap9) — hình là bản chép riêng, đừng đổi
      if (!o.visible) { if (u.dangMin) dat(o, false); continue; }
      const g = u.hinhGoc || o.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      hop.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
      const d = hop.distanceToPoint(camera.position);
      const px = d < 1e-3 ? Infinity : (+u.lod > 0 && +u.lod !== 1 ? +u.lod : (hop.getSize(co), co.x + co.y + co.z - Math.max(co.x, co.y, co.z) - Math.min(co.x, co.y, co.z))) * k / d;
      if (!u.dangMin && px > LEN) {
        // đang kéo camera, hoặc khung này đã tiêu > 6 ms cho bản mịn ⇒ để khung sau / lúc thả tay (nét viền dựng trên luồng chính)
        if (KEO_CAM || performance.now() - bay > 6) { buoc.con = true; if (!buoc.hen) buoc.hen = setTimeout(() => { buoc.hen = 0; veLai(); }, 160); continue; }
        if (u.hinhMin) { dat(o, true); continue; }
        const m = NHOM.get(u.linh_kien);
        if (m instanceof Map) { const h = m.get(u.id); if (h) { u.hinhMin = h; dat(o, true); } else u.lod = 0; }
        else if (!m) tai(u.linh_kien);
      } else if (u.dangMin && px < XUONG) dat(o, false);
    }
  }
  return { buoc, dem: () => (ds || []).filter((o) => o.userData.dangMin).length, nhom: () => [...NHOM.keys()] };
})();
// nét viền cạnh không ghi độ sâu: nếu ghi, nét viền theo độ sâu (NET) tô đậm thêm quanh chính nó
const VIEN = new THREE.LineBasicMaterial({ color: 0x2a2a28, transparent: true, opacity: 0.28, depthWrite: false });
/* NÉT DÀY ĐẶC MỜ DẦN (soát điện thoại 2026-10-21: tôn ốp sóng vuông nhìn cả nhà thành vân giao thoa hình vòng cung): cạnh
   từng sóng là cạnh thật 90°, nhưng nhìn xa hàng trăm nét cách nhau < 3 điểm ảnh lấy mẫu chồng nhau thành vân. Mỗi vật liệu
   sóng khai khoảng cách nét (m); nét mờ dần khi khoảng ấy trên màn hình còn 4 → 1,5 điểm ảnh (lại gần thì hiện lại). Vật khác
   (thuộc tính 0) không đổi. uK = 2·tan(fov/2) / chiều cao bộ đệm vẽ, đặt mỗi khung ở veCanh. */
const VIEN_THUA = { ton: 0.05 };
const VIEN_K = { value: 0.002 };
VIEN.onBeforeCompile = (sh) => {
  sh.uniforms.uK = VIEN_K;
  sh.vertexShader = "attribute float thua;\nuniform float uK;\nvarying float vMoNet;\n" + sh.vertexShader.replace("#include <project_vertex>",
    "#include <project_vertex>\n  vMoNet = thua > 0.0 ? smoothstep(1.5, 4.0, thua / max(uK * gl_Position.w, 1e-6)) : 1.0;");
  sh.fragmentShader = "varying float vMoNet;\n" + sh.fragmentShader.replace("#include <opaque_fragment>", "diffuseColor.a *= vMoNet;\n#include <opaque_fragment>");
};
VIEN.customProgramCacheKey = () => "vien-thua";
const VIEN_CHON = new THREE.LineBasicMaterial({ color: 0x2563eb, depthWrite: false });
const VIEN_NOI = new THREE.LineBasicMaterial({ color: 0x2a2a28, transparent: true, opacity: 0.85, depthWrite: false });   // viền mảnh TỐI quanh vật LÀM NỔI — không đổi màu vật
const VL_KHOANG = new THREE.MeshBasicMaterial({ color: 0xa9cbe8, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
/* khối PHÒNG (t1/t2): mặt khối trùng mặt tường nên ở mọi ô cửa nó hiện thành một màng mỏng chắn ngang — vẽ vô hình
   (vẫn bấm chọn, vẫn bật/tắt theo lớp «Phòng — …»). Chủ nhà 2026-09-22: màng trong suốt ở cửa giếng khi mở. */
const VL_KHOI_PHONG = new THREE.MeshBasicMaterial({ color: 0xa9cbe8, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide });

/* ── đổi toạ độ ────────────────────────────────────────────────────────── */
const m2w = (x, y, z) => GOC.localToWorld(new THREE.Vector3(x, y, z));
const w2m = (v) => GOC.worldToLocal(v.clone());
const f3 = (v) => [v.x, v.y, v.z].map((n) => n.toFixed(3)).join(",");
const mm = (n) => (Math.round(n * 1000) || 0).toLocaleString("vi-VN");   // || 0: không in «-0»

/* ── nạp mô hình ───────────────────────────────────────────────────────── */
let xong, hienDau;
const READY = new Promise((r) => (xong = r));
/* móc cho mô-đun phụ (nguon_dien.js, bo_cuc.js): chạy mỗi khung vẽ (sau ghim) · mỗi lần đổi vật đang chọn */
const MOI_KHUNG = [], KHI_CHON = [], KHI_THEM = [];            // MỌI nhóm đã vào cảnh (công cụ kiểm, chụp ảnh chờ cái này)
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
let NAP_LK = null, THEM_NHOM = null;   // napMoHinh / lượt thêm nhóm — cho taiKhiCan
const DANG_TAI = new Map();
function taiKhiCan(ma) {
  if (!DANG_TAI.has(ma)) DANG_TAI.set(ma, READY.then(() => NAP_LK(ma)).then((g) => THEM_NHOM([{ ma, g }]))
    .catch((e) => { DANG_TAI.delete(ma); throw e; }));
  return DANG_TAI.get(ma);
}
const paTre = () => !GOC?.userData.phuong_an_vat_lieu && !!DM?.linh_kien?.some((x) => x.ma === "phuong_an" && x.tai_khi_can);
async function napMoHinh() {
  const SOM = window.TAI_SOM;                  // xem.html đã xin sẵn danh mục + .glb (song song với module three)
  DM = await (SOM ? SOM.dm.catch(() => null) : null) || await (await fetch("mo-hinh/danh-muc.json", { cache: "no-store" })).json();
  performance.mark("xem:danh-muc");
  CANH = DM.canh[MA] || DM.canh.nha || { hien: DM.linh_kien.map((x) => x.ma) };
  /* TẢI KHI CẦN (bản đăng: phương án vật liệu ~18 MB): nhóm mang `tai_khi_can` không vào lượt tải đầu — nút của nó gọi
     taiKhiCan(ma) (NAP_LK + THEM_NHOM) lúc người xem cần. */
  const tre = new Set(DM.linh_kien.filter((x) => x.tai_khi_can).map((x) => x.ma));
  const thuTu = [...CANH.hien, ...DM.linh_kien.map((x) => x.ma).filter((m) => !CANH.hien.includes(m))].filter((m) => !tre.has(m));
  const loader = new GLTFLoader();
  /* ẢNH VÂN DÙNG CHUNG giữa các nhóm: mỗi .glb tự tải ảnh vân của mình nên cùng một ảnh (tủ HMR, bê tông…) bị
     tải, giải mã và nạp lên GPU tới 7 lần — 120 lượt cho 54 ảnh, ~450 MB bộ nhớ GPU. Nay một ảnh + một bộ lấy
     mẫu = một Texture cho mọi nhóm. */
  const VAN_CHUNG = new Map();
  const VAN_SAU = Q.get("van_cho") !== "1";             // ảnh vân về sau, cảnh không chờ (xem vanTam)
  /* ẢNH NÉN GPU (KTX2 · Basis ETC1S, tools/3d/nen_ktx2.py): .glb mang nguồn KHR_texture_basisu cạnh jpg. Trình duyệt chuyển
     thẳng sang định dạng nén của GPU (BC/ETC2/ASTC) — ~8 lần nhỏ hơn RGBA của jpg, không phải giải jpg. Bộ giải (wasm) lấy
     cùng bản three trên CDN. Lỗi bất kỳ (không có bộ giải, tệp hỏng) ⇒ lặng lẽ dùng jpg. Tắt: ?ktx2=0 (so sánh). */
  let KTX2 = null;
  if (Q.get("ktx2") !== "0" && !DM.khong_van) {          // bản đăng không mang ảnh vân ⇒ khỏi khởi động bộ giải (wasm + luồng)
    try {
      KTX2 = new KTX2Loader().setTranscoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/basis/")
        .setWorkerLimit(Math.max(4, Math.min(8, navigator.hardwareConcurrency || 4))).detectSupport(renderer);
      KTX2.init();                              // khởi động bộ giải ngay, không đợi ảnh vân đầu tiên (xem.html đã preload)
      KTX2_CHUNG = KTX2;                        // phương án vật liệu nạp ảnh vân lười bằng chính bộ giải này (napVanPa)
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
      if (!VAN_CHUNG.has(khoa)) VAN_CHUNG.set(khoa, VAN_SAU ? vanTam(parser, i, img.uri, layVan(parser, i, img, bu)) : layVan(parser, i, img, bu));
      return VAN_CHUNG.get(khoa);
    },
  }));
  /* ẢNH VÂN VỀ SAU (2026-10-21, chủ nhà: bản đăng phải giống máy, có vân, mà không chậm): .glb không chờ ảnh — mỗi ảnh
     trả ngay một ảnh tạm 1×1 mang đúng màu / độ nhám / pháp tuyến phẳng của vật liệu (trông như bản không vân), cảnh dựng
     và hiện ngay; ảnh thật giải xong thì CHÉP vào chính đối tượng ảnh tạm ⇒ mọi vật liệu (kể cả bản sao, lô gộp) đổi theo,
     không biên dịch lại shader. Định dạng khác (nén GPU / mipmap) ⇒ three tự cấp lại bộ nhớ ảnh. ?van_cho=1: chờ đủ như cũ. */
  function vanTam(parser, i, uri, that) {
    const loai = /\/(mau|nham|phap)\.[a-z0-9]+$/.exec(uri)?.[1] || "mau";
    const vd = (parser.json.materials || []).find((m) => [m.pbrMetallicRoughness?.baseColorTexture, m.pbrMetallicRoughness?.metallicRoughnessTexture,
      m.normalTexture].some((t) => t && t.index === i));
    const x = vd?.extras || {}, b = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255);
    const sRGB = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
    const px = loai === "phap" ? [128, 128, 255, 255] : loai === "nham" ? [0, b(x.nham ?? 0.8), b(x.kim_loai ?? 0), 255]
      : [...(x.mau || [0.8, 0.8, 0.8]).map((c) => b(sRGB(c))), 255];
    const tam = new THREE.DataTexture(new Uint8Array(px), 1, 1);
    tam.needsUpdate = true;
    that.then((t) => {
      if (!t) return;
      const da = tam.colorSpace, aniso = tam.anisotropy;         // GLTFLoader / trình xem đã đặt trên ảnh tạm — giữ
      tam.isDataTexture = !!t.isDataTexture; tam.isCompressedTexture = !!t.isCompressedTexture;
      tam.image = t.image; tam.mipmaps = t.mipmaps || [];
      // wrapS/wrapT: LẶP theo sampler của .glb — thiếu hai khoá này (2026-10-21 → 22) thì ảnh tạm giữ «kẹp mép» mặc định, mọi
      // toạ độ vân > 1 lấy cột mép ảnh ⇒ vân gỗ thành sọc ngang, gạch / tường thành mảng phẳng (chủ nhà: «texture looks weird»)
      for (const k of ["format", "type", "internalFormat", "generateMipmaps", "minFilter", "magFilter", "wrapS", "wrapT", "flipY", "unpackAlignment", "premultiplyAlpha"]) tam[k] = t[k];
      tam.colorSpace = da; tam.anisotropy = aniso;
      tam.needsUpdate = true;
      veLai(60);
    }).catch(() => {});
    return Promise.resolve(tam);
  }
  function layVan(parser, i, img, bu) {
    return bu
        // bộ giải hỏng lúc khởi động (wasm/worker) thì lời hứa của KTX2Loader r170 treo mãi — chờ tối đa 20 s rồi dùng jpg
        // (đồng hồ 20 s bắt đầu SAU KHI gói về — gói lớn trên mạng chậm không bị tính là bộ giải treo)
        ? GOI_VAN.then((g) => Promise.race([parser.loadTextureImage(i, bu.source, g || KTX2), new Promise((r) => setTimeout(() => r(null), 20000))]))
          .then((t) => t || (console.warn("KTX2 không giải được — dùng jpg:", img.uri), parser.loadTexture(i)))   // loadTexture lõi = nguồn jpg
        : parser.loadTexture(i);
  }
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
  NAP_LK = napLk;
  const hua = thuTu.map((ma) => napLk(ma)
    .then((g) => ({ ma, g })).catch((e) => { LK_LOI.set(ma, String(e.message || e)); return null; }));
  /* TẢI THEO ĐỢT (chủ nhà 2026-09-27: «tải chậm — tải từng phần»): xem.py dựng lại nhóm nào có tệp nguồn vừa đổi TRƯỚC khi
     trả .glb (có nhóm 6–8 s). Không chờ nhóm chậm nhất: đợt đầu = mọi nhóm về trong CHO_DAU ms (ít nhất một nhóm), dựng
     cảnh và hiện ngay; nhóm về sau được THÊM vào (themNhom) khi tới. ?cho_du=1: chờ đủ mọi nhóm như trước. */
  const CHO_DAU = Q.get("cho_du") === "1" ? 1e9 : 900;
  const da = new Map();
  hua.forEach((p, i) => p.then((r) => { da.set(thuTu[i], r); }));
  const tatCa = Promise.all(hua);
  /* Bản đăng (danh mục mang `dot`, xem xem.html «HAI ĐỢT»): đợt đầu = ĐÚNG các nhóm đợt 1 (vỏ nhà nhìn từ ngoài) — dựng ngay
     khi chúng về đủ, không chờ đồng hồ CHO_DAU; nội thất, điện, đèn… về sau được thêm vào như mọi nhóm đến muộn. */
  const dot1 = DM.linh_kien.some((x) => x.dot) ? thuTu.filter((m) => (DM.linh_kien.find((x) => x.ma === m)?.dot || 1) === 1) : null;
  if (dot1 && Q.get("cho_du") !== "1") await Promise.all(hua.filter((_, i) => dot1.includes(thuTu[i])));
  const han = performance.now() + (dot1 ? 0 : CHO_DAU);
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
  // `tat_mac_dinh` của cảnh (bối cảnh nhà bên): tắt khi mở trang, trừ khi liên kết đã ghi trạng thái nhóm (`an=` có mặt)
  const tatDau = Q.has("an") ? [] : CANH.tat_mac_dinh || [];
  for (const x of DM.linh_kien) if (!CANH.hien.includes(x.ma) || an.includes(x.ma) || tatDau.includes(x.ma)) lkTat.add(x.ma);
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
    // một công tắc khai ở NHIỀU nhóm (cùng mã — vd «màu khung» cổng: khuôn + ray + đoạn ray trên từng cánh quay, chủ nhà 3D
    // #774): mỗi nhãn MỘT nút, `them` = các lớp khác cùng nhãn — datChonMot bật/tắt cả `nhom` lẫn `them`
    for (const cm of ud.chon_mot || []) {
      let cu = chon_mot.find((x) => x.ma === cm.ma);
      if (!cu) { cu = { ...cm, lua_chon: [], ...(cm.an_lop ? { an_lop: {} } : {}) }; chon_mot.push(cu); }
      // `an_lop` khai ở nhiều nhóm (công tắc «Mặt tiền tầng 2»: mat_tien + mai) ⇒ gộp, mỗi nhóm góp lớp của nó
      for (const [nhan, ds] of Object.entries(cm.an_lop || {})) {
        cu.an_lop = cu.an_lop || {};
        cu.an_lop[nhan] = [...new Set([...(cu.an_lop[nhan] || []), ...ds])];
      }
      for (const lc of cm.lua_chon) {
        const x = cu.lua_chon.find((y) => y.nhan === lc.nhan);
        if (!x) cu.lua_chon.push({ ...lc, them: [] });
        else if (x.nhom !== lc.nhom && !x.them.includes(lc.nhom)) x.them.push(lc.nhom);
      }
    }
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

/* ── MẠCH PHẲNG KHÔNG HIỆN NÉT (chủ nhà 2026-10-16: «mặt tường, mái thành nhiều mảnh rời thay vì một mặt liền»).
   Mỗi cấu kiện vẫn là MỘT vật riêng (bấm chọn riêng, tra.py, quy cách riêng) — nhưng nhìn phải liền một mặt. Nét viền cạnh
   (EdgesGeometry) vẽ quanh TỪNG vật nên chỗ hai mảnh cùng vật liệu ghép phẳng (trụ tường | mảng trên lanh tô | tường kế bên,
   tấm tôn cạnh tấm tôn) lộ thành một đường kẻ. Ở đây bỏ khỏi viền THƯỜNG những đoạn cạnh mà mặt kề nó CHẠY TIẾP sang một
   vật khác: cùng vật liệu, cùng mặt phẳng, cùng hướng — dò một điểm cách cạnh MACH_EPS về phía ngoài mặt, rơi vào tam giác
   của vật kia là mạch. Cũng giấu mạch TRONG một vật ghép từ nhiều mảnh (mặt sơn liền khoét ô cửa): cạnh chỉ có một tam giác
   vì mảnh bên kia chia khác (mối chữ T) mà phía bên kia vẫn là mặt của chính vật ấy. Góc thật (mặt gặp mặt khác hướng, mép
   ô cửa, đổi vật liệu) giữ nguyên.
   Viền ĐẦY ĐỦ vẫn giữ ở `vienDu`: vật đang chọn / chọn thêm / làm nổi hiện đủ khung của chính nó (datVien).
   Không xét: vật trong công tắc trạng thái (thế khác có thể không hiện) — trừ vật khai `mach_lien` —, khối phòng, khối tham
   chiếu, vật trong suốt.
   Giới hạn: mạch giấu theo cảnh lúc nạp — ẩn một lớp đi thì mép vật kề nó chỗ ấy không có nét viền cạnh (nét theo độ sâu
   vẫn vẽ mép bóng). ?mach=1 tắt (vẽ viền đủ như cũ). */
const MACH_EPS = 0.003;                                  // m — điểm dò cách cạnh; mạch ghép thật khít hơn nhiều
const AN_MACH = Q.get("mach") !== "1";
const MACH_TG_TOI_DA = 3000;                             // vật nhiều tam giác hơn: giữ viền đủ
function datVien(o, m) {
  const u = o.userData, v = u.vien;
  v.material = m;
  if (u.vienLien) v.geometry = m === VIEN ? u.vienLien : u.vienDu;
}
/* Phần toán chạy trên LUỒNG NỀN (không chặn trang): nhận bảng lưới (toạ độ lưới + chỉ số + viền đủ, mỗi lưới một lần) và
   bảng vật (lưới nào, ma trận thế giới, mã vật liệu), trả viền đã bỏ mạch cho các vật được giao (null = không đổi). */
function thoMach() {
  self.onmessage = (ev) => {
    const { luoi, vat, giao, EPS, O } = ev.data;
    const khoa = (r, dd) => `${r.nx},${r.ny},${r.nz},${dd}`;
    const oLuoi = (lo, hi, f) => {
      for (let i = Math.floor(lo[0] / O); i <= Math.floor(hi[0] / O); i++) for (let j = Math.floor(lo[1] / O); j <= Math.floor(hi[1] / O); j++)
        for (let k = Math.floor(lo[2] / O); k <= Math.floor(hi[2] / O); k++) f(((i * 73856093) ^ (j * 19349663) ^ (k * 83492791)) | 0);   // trùng mã chỉ thêm ứng viên — lọc hộp bao loại
    };
    // tam giác thế giới của mọi vật, xếp theo mặt phẳng có hướng (pháp tuyến 1e-3, khoảng cách 2 mm) rồi theo ô 0,5 m
    const MP = new Map(), TG = [];
    vat.forEach((v, iv) => {
      const { P, I } = luoi[v.g], e = v.M, n = I ? I.length : P.length / 3, ds = [];
      const W = new Float64Array(P.length);
      for (let i = 0; i < P.length; i += 3) {
        const x = P[i], y = P[i + 1], z = P[i + 2];
        W[i] = e[0] * x + e[4] * y + e[8] * z + e[12]; W[i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; W[i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      }
      const w = (i) => [W[i * 3], W[i * 3 + 1], W[i * 3 + 2]];
      for (let t = 0; t + 2 < n; t += 3) {
        const ia = I ? I[t] : t, ib = I ? I[t + 1] : t + 1, ic = I ? I[t + 2] : t + 2;
        const a = w(ia), b = w(ib), c = w(ic);
        const u1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], u2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const nn = [u1[1] * u2[2] - u1[2] * u2[1], u1[2] * u2[0] - u1[0] * u2[2], u1[0] * u2[1] - u1[1] * u2[0]];
        const L = Math.hypot(nn[0], nn[1], nn[2]);
        if (L < 1e-9) continue;
        nn[0] /= L; nn[1] /= L; nn[2] /= L;
        const r = { iv, vl: v.vl, a, b, c, n: nn, d: Math.round((nn[0] * a[0] + nn[1] * a[1] + nn[2] * a[2]) / 0.002),
          nx: Math.round(nn[0] * 1e3), ny: Math.round(nn[1] * 1e3), nz: Math.round(nn[2] * 1e3),
          lo: [Math.min(a[0], b[0], c[0]), Math.min(a[1], b[1], c[1]), Math.min(a[2], b[2], c[2])],
          hi: [Math.max(a[0], b[0], c[0]), Math.max(a[1], b[1], c[1]), Math.max(a[2], b[2], c[2])], ia, ib, ic };
        ds.push(r);
        const k = khoa(r, r.d);
        let mp = MP.get(k); if (!mp) MP.set(k, (mp = new Map()));
        oLuoi(r.lo, r.hi, (cc) => { let x = mp.get(cc); if (!x) mp.set(cc, (x = [])); x.push(r); });
      }
      TG.push(ds);
    });
    const trong = (r, q) => {                            // q nằm trong tam giác r (đồng phẳng — đã lọc theo mặt phẳng)
      const a = r.a, b = r.b, c = r.c, n = r.n;
      const cung = (p1, p2) => {
        const x0 = p2[0] - p1[0], x1 = p2[1] - p1[1], x2 = p2[2] - p1[2], y0 = q[0] - p1[0], y1 = q[1] - p1[1], y2 = q[2] - p1[2];
        return n[0] * (x1 * y2 - x2 * y1) + n[1] * (x2 * y0 - x0 * y2) + n[2] * (x0 * y1 - x1 * y0) >= -1e-9;
      };
      return cung(a, b) && cung(b, c) && cung(c, a);
    };
    const phuQ = (x, q) => q[0] >= x.lo[0] - 1e-4 && q[0] <= x.hi[0] + 1e-4 && q[1] >= x.lo[1] - 1e-4 && q[1] <= x.hi[1] + 1e-4
      && q[2] >= x.lo[2] - 1e-4 && q[2] <= x.hi[2] + 1e-4 && trong(x, q);
    const h = (x, y, z) => `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
    const ra = [], chuyen = [];
    let soBo = 0;
    for (const iv of giao) {
      const v = vat[iv], { P, E } = luoi[v.g], tg = TG[iv], e = v.M;
      // đỉnh lưới → mã đỉnh hàn theo toạ độ làm tròn như EdgesGeometry; cạnh (cặp mã) → các tam giác của chính vật kề cạnh
      const maDinh = new Map(), ma = new Int32Array(P.length / 3);
      for (let i = 0; i < P.length; i += 3) { const k = h(P[i], P[i + 1], P[i + 2]); let m = maDinh.get(k); if (m === undefined) maDinh.set(k, (m = maDinh.size)); ma[i / 3] = m; }
      const ke = new Map(), N = maDinh.size + 1, kc = (p, q) => (p < q ? p * N + q : q * N + p);
      for (const r of tg) {
        const m3 = [ma[r.ia], ma[r.ib], ma[r.ic]];
        for (let j = 0; j < 3; j++) { const k = kc(m3[j], m3[(j + 1) % 3]); let ds = ke.get(k); if (!ds) ke.set(k, (ds = [])); ds.push(r); }
      }
      const W = (x, y, z) => [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
      const out = [];
      let doi = false;
      for (let i = 0; i < E.length; i += 6) {
        const pa = [E[i], E[i + 1], E[i + 2]], pb = [E[i + 3], E[i + 4], E[i + 5]];
        const giu = () => out.push(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2]);
        const ma_ = maDinh.get(h(...pa)), mb_ = maDinh.get(h(...pb));
        const ts = ma_ === undefined || mb_ === undefined ? null : ke.get(kc(ma_, mb_));
        if (!ts) { giu(); continue; }
        const wa = W(...pa), wb = W(...pb), dv = [wb[0] - wa[0], wb[1] - wa[1], wb[2] - wa[2]], L = Math.hypot(...dv);
        if (L < 1e-6) { giu(); continue; }
        const K = Math.min(64, Math.max(1, Math.ceil(L / 0.05)));
        let phu = null;
        const giua = [(wa[0] + wb[0]) / 2, (wa[1] + wb[1]) / 2, (wa[2] + wb[2]) / 2];
        const s = EPS + 1e-4, lo = [0, 1, 2].map((j) => Math.min(wa[j], wb[j]) - s), hi = [0, 1, 2].map((j) => Math.max(wa[j], wb[j]) + s);
        for (const r of ts) {
          // ứng viên cùng mặt phẳng với r quanh cạnh: vật khác cùng vật liệu, hoặc mảnh khác của CHÍNH vật (mối chữ T)
          const ung = new Set();
          r.kd ||= [khoa(r, r.d - 1), khoa(r, r.d), khoa(r, r.d + 1)];
          for (const kd of r.kd) {
            const mp = MP.get(kd);
            if (mp) oLuoi(lo, hi, (cc) => { for (const x of mp.get(cc) || []) if (!ung.has(x) && !ts.includes(x) && (x.iv === iv || x.vl === v.vl)
              && x.lo[0] <= hi[0] && x.hi[0] >= lo[0] && x.lo[1] <= hi[1] && x.hi[1] >= lo[1] && x.lo[2] <= hi[2] && x.hi[2] >= lo[2]) ung.add(x); });
          }
          if (!ung.size) continue;
          // hướng trong mặt phẳng, vuông góc cạnh, ra NGOÀI tam giác r
          let w = [r.n[1] * dv[2] - r.n[2] * dv[1], r.n[2] * dv[0] - r.n[0] * dv[2], r.n[0] * dv[1] - r.n[1] * dv[0]];
          const lw = Math.hypot(...w); w = w.map((x) => x / lw);
          const tam = [(r.a[0] + r.b[0] + r.c[0]) / 3 - giua[0], (r.a[1] + r.b[1] + r.c[1]) / 3 - giua[1], (r.a[2] + r.b[2] + r.c[2]) / 3 - giua[2]];
          if (w[0] * tam[0] + w[1] * tam[1] + w[2] * tam[2] > 0) w = w.map((x) => -x);
          phu ||= new Array(K).fill(false);
          const dsU = [...ung];
          let truoc = null;                              // tam giác vừa phủ mẫu trước — mẫu kế thường cũng nằm trong nó
          for (let k = 0; k < K; k++) {
            if (phu[k]) continue;
            const t = (k + 0.5) / K, q = [wa[0] + dv[0] * t + w[0] * EPS, wa[1] + dv[1] * t + w[1] * EPS, wa[2] + dv[2] * t + w[2] * EPS];
            if (truoc && phuQ(truoc, q)) { phu[k] = true; continue; }
            truoc = dsU.find((x) => phuQ(x, q)) || null;
            phu[k] = !!truoc;
          }
        }
        if (!phu || !phu.some(Boolean)) { giu(); continue; }
        doi = true;
        for (let k = 0; k < K;) {                        // giữ các khúc KHÔNG phải mạch
          if (phu[k]) { k++; soBo++; continue; }
          let k1 = k; while (k1 < K && !phu[k1]) k1++;
          const t0 = k / K, t1 = k1 / K;
          out.push(...pa.map((x, j) => x + (pb[j] - x) * t0), ...pa.map((x, j) => x + (pb[j] - x) * t1));
          k = k1;
        }
      }
      const f = doi ? new Float32Array(out) : null;
      ra.push({ iv, e: f }); if (f) chuyen.push(f.buffer);
    }
    self.postMessage({ ra, soBo }, chuyen);
  };
}
/* điện thoại (chạm, màn hẹp): ít luồng nền hơn — mỗi luồng giữ một bản chép lưới, iOS giết trang / luồng khi thiếu bộ nhớ.
   CHO_LUONG_MS: luồng nền im quá lâu thì coi như chết (xem chó canh ở anMach, hinhNen). */
const DIEN_THOAI = matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 820;
const CHO_LUONG_MS = 15000;
let MACH_LUOT = 0, MACH_HEN = 0, MACH_XONG = Promise.resolve();
const MACH_CHO = [];
/* Hẹn một lượt giấu mạch — các lần gọi gần nhau (nhóm về sau nối đuôi) gộp một lượt. MACH_XONG: lời hứa của lượt mới nhất. */
function henMach() {
  if (!AN_MACH) return MACH_XONG;
  clearTimeout(MACH_HEN);
  MACH_XONG = new Promise((xong) => MACH_CHO.push(xong));
  MACH_HEN = setTimeout(() => {
    const cho = MACH_CHO.splice(0);
    anMach().catch((e) => console.warn("giấu mạch phẳng hỏng:", e)).finally(() => cho.forEach((f) => f()));
  }, 150);
  return MACH_XONG;
}
async function anMach() {
  if (typeof Worker === "undefined") return;
  const luot = ++MACH_LUOT, t0 = performance.now();
  const nhomCM = (GOC.userData.chon_mot || []).flatMap((c) => c.lua_chon.flatMap(lopLC));
  const xet = (o) => {
    const u = o.userData, m = u.vlGoc;
    return o.isMesh && m && !u.ma && !u.khoi_phong && u.vat_lieu !== "khoang" && !m.transparent && !m.transmission
      && (u.mach_lien === true || u.mach_lien === "True" || !nhomCM.some((n) => (u.nhom || "").startsWith(n)));   // mach_lien: mảng lấp góc vòm trong công tắc phương án cửa (#476)
  };
  // vật chi tiết dày tam giác (chữ biển số, nan, viên gạch…) không phải «mặt»: giữ viền đủ — dò mối chữ T trong nó tốn nhất
  const soTG = (o) => (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
  const coVien = (o) => o.userData.canVien && (o.userData.vienDu || o.userData.vien.geometry) !== HINH_RONG && soTG(o) <= MACH_TG_TOI_DA;
  const lam = PHAN.filter((o) => coVien(o) && xet(o));
  const vlCan = new Set(lam.map((o) => o.userData.vlGoc)), maVl = new Map([...vlCan].map((m, i) => [m, i]));
  const luoi = [], soLuoi = new Map(), vat = [], giao = [];
  const lamSet = new Set(lam);
  for (const o of PHAN) {
    if (!vlCan.has(o.userData.vlGoc) || !xet(o)) continue;
    const g = o.geometry, laLam = lamSet.has(o);
    const k = g.uuid + (laLam ? "|" + (o.userData.vienDu || o.userData.vien.geometry).uuid : "");
    if (!soLuoi.has(k)) {
      const P = g.attributes.position;
      if (!P || P.isInterleavedBufferAttribute || P.itemSize !== 3) continue;
      soLuoi.set(k, luoi.length);
      luoi.push({ P: Float32Array.from(P.array.subarray(0, P.count * 3)), I: g.index ? Uint32Array.from(g.index.array.subarray(0, g.index.count)) : null,
        E: laLam ? (o.userData.vienDu || o.userData.vien.geometry).attributes.position.array.slice() : null });
    }
    o.updateWorldMatrix(true, false);
    if (laLam) giao.push(vat.length);
    vat.push({ g: soLuoi.get(k), M: Array.from(o.matrixWorld.elements), vl: maVl.get(o.userData.vlGoc), o });
  }
  const tGoi = performance.now();
  const N = DIEN_THOAI ? 1 : Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 4) - 1));
  let url;
  try { url = URL.createObjectURL(new Blob([`(${thoMach.toString()})()`], { type: "text/javascript" })); } catch (_) { return; }
  const phan = Array.from({ length: N }, () => []);
  giao.forEach((iv, i) => phan[i % N].push(iv));
  const goi = vat.map(({ g, M, vl }) => ({ g, M, vl }));
  let soBo = 0, tGui = 0;
  const kq = await Promise.all(phan.filter((p) => p.length).map((p) => new Promise((xong, hong) => {
    const w = new Worker(url);
    // CHÓ CANH (chủ nhà 2026-10-28: điện thoại kẹt «Đang thêm», bấm cửa không được): iOS giết luồng nền khi thiếu bộ nhớ mà
    // không gọi onmessage lẫn onerror ⇒ lời hứa treo mãi, READY không bao giờ tới. Quá giờ ⇒ bỏ lượt giấu mạch (chỉ là thẩm mỹ)
    const cho = setTimeout(() => { w.terminate(); hong(new Error("luồng giấu mạch không trả lời — bỏ qua")); }, CHO_LUONG_MS);
    w.onmessage = (ev) => { clearTimeout(cho); w.terminate(); soBo += ev.data.soBo; xong(ev.data.ra); };
    w.onerror = (e) => { clearTimeout(cho); w.terminate(); hong(e); };
    const _t = performance.now(); w.postMessage({ luoi, vat: goi, giao: p, EPS: MACH_EPS, O: 0.5 }); tGui += performance.now() - _t;
  })));
  URL.revokeObjectURL(url);
  const tVe = performance.now();
  if (luot !== MACH_LUOT) return;                        // đã có lượt mới hơn (nhóm về sau) — bỏ kết quả cũ
  for (const { iv, e } of kq.flat()) {
    const o = vat[iv].o, u = o.userData, du = u.vienDu || u.vien.geometry;
    if (u.vienLien && u.vienLien !== du) u.vienLien.dispose();
    u.vienDu = du;
    if (e) { u.vienLien = new THREE.BufferGeometry(); u.vienLien.setAttribute("position", new THREE.BufferAttribute(e, 3)); }
    else u.vienLien = du;
    datVien(o, u.vien.material);
  }
  if (LO) LO.napVien();
  veLai();
  console.info(`giấu mạch phẳng (luồng nền ×${N}): ${lam.length} vật, bỏ ${soBo} khúc ~5 cm trong ${Math.round(performance.now() - t0)} ms — luồng chính: gói ${Math.round(tGoi - t0)} + gửi ${Math.round(tGui)} + áp ${Math.round(performance.now() - tVe)} ms`);
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
  const N = DIEN_THOAI ? 2 : Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1));
  // chia theo khối lượng (số đỉnh) cho đều các luồng
  const goi = Array.from({ length: N }, () => ({ ds: [], w: 0 }));
  for (const j of [...viec.values()].sort((a, b) => b.P.length - a.P.length)) { const g = goi.reduce((m, x) => (x.w < m.w ? x : m)); g.ds.push(j); g.w += j.P.length; }
  return Promise.all(goi.filter((g) => g.ds.length).map((g) => new Promise((xong) => {
    let w;
    try { w = new Worker(url); } catch (_) { xong(); return; }
    // chó canh như anMach: luồng bị giết im ⇒ quá giờ coi như hỏng, phần ấy tính trên luồng chính — nhóm vẫn vào cảnh
    const cho = setTimeout(() => { w.terminate(); console.warn("luồng hình nền không trả lời — tính trên luồng chính"); xong(); }, CHO_LUONG_MS);
    w.onmessage = (ev) => { clearTimeout(cho); for (const r of ev.data) ra.set(r.id, r); w.terminate(); xong(); };
    w.onerror = () => { clearTimeout(cho); w.terminate(); xong(); };                  // hỏng ⇒ phần ấy tính trên luồng chính
    w.postMessage(g.ds, g.ds.flatMap((j) => (j.I ? [j.P.buffer, j.I.buffer] : [j.P.buffer])));
  }))).then(() => { URL.revokeObjectURL(url); return ra; });
}

/* ── PHIÊN BẢN (chủ nhà 2026-10-23: «3d view và 3d view của site hay lệch»): thanh tiêu đề hiện commit đang xem. Site đọc
   phien-ban.json (dong_goi_site.py ghi); máy hỏi /api/phien-ban rồi so với phien-ban.json trên site — khác commit, hoặc bên
   nào còn tệp chưa commit ⇒ tô cam. Khớp từng tệp vẫn là việc của tools/site/lech_site.py. */
const SITE_3D = "https://hai-scribes.github.io/383-site/3d/";
const tenBan = (p) => (p && p.commit ? p.commit + (p.chua_commit ? ` +${p.chua_commit}` : "") : "?");
async function hienPhienBan() {
  const el = $("phien-ban"), lay = (u) => fetch(u, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!el) return;
  const may = await lay("/api/phien-ban");
  if (!may) {                                                       // bản đăng: chỉ một dòng
    const s = await lay("phien-ban.json");
    if (!s) return;
    el.textContent = `bản ${s.commit}`;
    el.title = s.chua_commit ? `Đóng gói từ ${s.commit} cộng ${s.chua_commit} tệp chưa commit` : `Đóng gói từ commit ${s.commit}`;
  } else {
    const s = await lay(SITE_3D + "phien-ban.json");
    const khop = !!s && s.commit === may.commit && !s.chua_commit && !may.chua_commit;
    el.textContent = `máy ${tenBan(may)} · site ${s ? tenBan(s) : "chưa có"}`;
    el.classList.toggle("lech", !khop);
    el.title = khop ? "Máy và site cùng commit, không tệp chưa commit — cùng nguồn."
      : "Máy và site chưa cùng một nguồn (+n = số tệp chưa commit). Đăng lại: build_site.py → publish_github.py → lech_site.py.";
  }
  el.hidden = false;
}

napMoHinh().then(async ({ hua, daCo }) => {
  TIEN.giai("dung");
  const info = GOC.userData;
  $("ten-mo-hinh").textContent = info.tieu_de;
  hienPhienBan();
  document.title = `${info.tieu_de} — Mô hình 3D 383`;
  const ganVat = (o) => {
    if (!o.isMesh) return;
    const u = o.userData;
    if (!u.id || u.__gan) return;
    u.__gan = true;
    if (u.vat_lieu === "khoang") o.material = u.khoi_phong ? VL_KHOI_PHONG : VL_KHOANG;   // khoang khí: bấm được; khối phòng vô hình
    if (u.vat_lieu === "gach_kinh") o.material = VL_GACH_KINH; // gạch kính: truyền sáng + nhám ⇒ nhìn xuyên thấy NHOÈ
    o.material.side = THREE.DoubleSide;
    if (o.material.transparent) {
      o.material.depthWrite = false;
      /* vật trong suốt hai mặt: three vẽ HAI lượt (mặt sau rồi mặt trước), mỗi lượt đổi side + needsUpdate ⇒ tính lại
         chương trình ~60 lần/khung và gấp đôi lượt vẽ. Kính, lưới, rèm ở đây là tấm mỏng — một lượt là đủ. ?mot_luot=0: như cũ. */
      if (Q.get("mot_luot") !== "0") o.material.forceSinglePass = true;
    }
    o.material = vlChung(o.material);                         // cùng định nghĩa vật liệu ở nhiều .glb ⇒ MỘT vật liệu (gộp lưới theo nó)
    if (VIEN_THUA[u.vat_lieu]) danhDauDay(o.material);
    if (u.vat_lieu === "luoi") ganLuoiThat(o);        // lưới côn trùng: sợi đan thật, nhìn xuyên (chủ nhà 3D #713)
    o.userData.vlGoc = o.material;
    const coVan = !!o.material.map;
    if (coVan) for (const t of [o.material.map, o.material.normalMap, o.material.roughnessMap, o.material.metalnessMap]) if (t) t.anisotropy = DI_HUONG;
    // mặt có vân và khối phòng KHÔNG BAO GIỜ hiện viền ⇒ khỏi tính EdgesGeometry (tốn lúc mở trang), giữ vật rỗng cho
    // chỗ khác đổi .material của viền (toThem, phân tích) như cũ
    // bản đăng không mang ảnh vân (DM.khong_van): vật liệu CÓ vân ở máy vẫn không viền — hai trình xem vẽ cùng một kiểu
    const vanTat = !!DM?.khong_van && (DM.khoa_van || []).includes(o.material.userData?.khoa);
    const khongVien = coVan || vanTat || !!u.khoi_phong || u.khong_vien === true || u.khong_vien === "True";   // khong_vien: vật bị lớp hoàn thiện liền phủ kín (#567)
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
  henMach();                                      // luồng nền: bỏ nét mạch giữa các mảnh ghép phẳng
  dungBoc();
  dungCatSan();
  dungTrinhTu();
  dungNhomKetCau();
  khoiChonMot(info.chon_mot || []);
  dungPhuongAn();
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
    henMach();
    dungBoc(); dungCatSan(); dungTrinhTu(); dungNhomKetCau();
    khoiChonMot((GOC.userData.chon_mot || []).filter((x) => !cmCu.has(x.ma)));
    // công tắc đã có mà nhóm mới góp thêm lớp / `an_lop` (vd «Mặt tiền tầng 2»: mat_tien về trước, mai về sau) ⇒ áp lại
    for (const cm of (GOC.userData.chon_mot || []).filter((x) => cmCu.has(x.ma))) {
      for (const lc of cm.lua_chon) for (const n of lopLC(lc)) LOP_CHON_MOT.set(n, { cm, nhan: lc.nhan });
      datChonMot(cm, CHON_MOT.get(cm.ma) ?? cm.mac_dinh);
    }
    dungPhuongAn();
    dungLop(GOC.userData.nhom || []);
    if (bocK) bocLop(bocK);
    if (tachKhe) tachLop(tachKhe);
    capNhatHien(); apMo(); datNapCat();
    veLai(300);
    TIEN.ve();
  };
  THEM_NHOM = (ds) => (chuoi = chuoi.then(() => themNhom(ds)));
  for (const p of con) p.then((r) => {
    if (!r) return;
    hangCho.push(r); clearTimeout(hen);
    hen = setTimeout(() => { const ds = hangCho.splice(0); chuoi = chuoi.then(() => themNhom(ds)).catch((e) => console.warn("thêm nhóm hỏng:", e)); }, 120);
  });
  if (daCo.size < hua.length) TIEN.giai("them");
  Promise.all(con).then(() => new Promise((r) => setTimeout(r, 150))).then(() => chuoi).then(() => MACH_XONG).then(() => {
    TIEN.giai("xong"); performance.mark("xem:du"); xong();
  });
  moLopNhiet();
  moPhanTich();
  moKiemTra();
  READY.then(moNguonDien);
  READY.then(moDatDo);
  performance.mark("xem:dung");
  // hâm nóng SAU KHI mọi nhóm đã vào (nhóm về sau dựng lại nắp cắt / lô gộp — đừng biên dịch thứ sắp bị thay)
  if (Q.get("ham") !== "0") READY.then(() => setTimeout(hamNong, 300));   // sau khung đầu — không làm chậm lần hiện đầu tiên (?ham=0: tắt, so sánh)                   // cảnh dựng xong (lô, lớp, ghi chú)
}).catch((err) => {
  $("ten-mo-hinh").textContent = "Không tải được mô hình (" + (err.message || err) + ")";
});

/* ── NHÓM KẾT CẤU + LỚP: MỘT cây (chủ nhà 2026-10-10 «trùng, rối») ────────
   Mỗi nhóm kết cấu một dòng: ▸ mở ra các lớp của nhóm · tên · số vật (mờ) · ◎ chỉ hiện nhóm này (hoặc giữ lâu trên tên)
   · công tắc bật/tắt. Lớp nằm TRONG nhóm của nó (dungLop rót vào `ul.lop-con`), không còn danh sách «Lớp» thứ hai.
   Mã nhóm (t1, bep…) chỉ còn trong chú thích khi rê chuột — không ai cần đọc nó. Nhóm đang mở nhớ ở LK_MO. */
const LK_MO = new Set((() => { try { return JSON.parse(localStorage.getItem("xem-lk-mo") || "[]"); } catch { return []; } })());
const luuLkMo = () => { try { localStorage.setItem("xem-lk-mo", JSON.stringify([...LK_MO])); } catch { /* chế độ riêng tư */ } };
function chiNhom(ma) {
  lkTat.clear(); for (const y of DM.linh_kien) if (y.ma !== ma) lkTat.add(y.ma);
  dungNhomKetCau(); dungLop(GOC.userData.nhom || []); dungTrinhTu(); capNhatHien();
}
function dungNhomKetCau() {
  const ul = $("ds-lk");
  if (!ul) return;
  ul.replaceChildren();
  const dem = new Map();
  for (const o of PHAN) if (!o.userData.ma) dem.set(o.userData.linh_kien, (dem.get(o.userData.linh_kien) || 0) + 1);
  for (const x of DM.linh_kien) {
    const li = document.createElement("li"); li.className = "cay-nhom"; li.dataset.lk = x.ma;
    li.classList.toggle("mo", LK_MO.has(x.ma));
    const hang = document.createElement("div"); hang.className = "cay-hang";
    const ten = document.createElement("button"); ten.type = "button"; ten.className = "cay-ten";
    ten.setAttribute("aria-expanded", String(LK_MO.has(x.ma)));
    const nhanTen = document.createElement("span"); nhanTen.textContent = x.ten;
    const s = document.createElement("span"); s.className = "so"; s.textContent = LK_LOI.has(x.ma) ? "⛔" : (dem.get(x.ma) || 0);
    ten.append(nhanTen, s);
    ten.title = (LK_LOI.has(x.ma) ? `Không tải được: ${LK_LOI.get(x.ma)}` : `${x.mo_ta || x.ten}\nPhiên sửa: «${x.phien}» — mo_hinh/${x.ma}.py`)
      + "\nBấm: xem các lớp · giữ lâu: chỉ hiện nhóm này";
    // giữ lâu (ngón tay) = chỉ hiện nhóm này; bấm thường = mở / gập các lớp
    let hen = 0, daGiu = false;
    ten.addEventListener("pointerdown", () => { daGiu = false; clearTimeout(hen); hen = setTimeout(() => { daGiu = true; chiNhom(x.ma); }, 550); });
    for (const ev of ["pointerup", "pointerleave", "pointercancel"]) ten.addEventListener(ev, () => clearTimeout(hen));
    ten.addEventListener("contextmenu", (e) => e.preventDefault());
    ten.onclick = () => {
      if (daGiu) { daGiu = false; return; }
      LK_MO.has(x.ma) ? LK_MO.delete(x.ma) : LK_MO.add(x.ma); luuLkMo();
      li.classList.toggle("mo", LK_MO.has(x.ma)); ten.setAttribute("aria-expanded", String(LK_MO.has(x.ma)));
    };
    const chi = document.createElement("button");
    chi.type = "button"; chi.className = "nut-chi"; chi.textContent = "◎";
    chi.title = "Chỉ hiện nhóm này"; chi.setAttribute("aria-label", `Chỉ hiện nhóm ${x.ten}`);
    chi.onclick = () => chiNhom(x.ma);
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.className = "cong-tac"; cb.checked = !lkTat.has(x.ma); cb.disabled = LK_LOI.has(x.ma);
    cb.setAttribute("aria-label", `Hiện nhóm ${x.ten}`);
    cb.onchange = () => { cb.checked ? lkTat.delete(x.ma) : lkTat.add(x.ma); dungLop(GOC.userData.nhom || []); dungTrinhTu(); capNhatHien(); };
    hang.append(ten, chi, cb);
    const con = document.createElement("ul"); con.className = "lop-con";
    li.append(hang, con);
    ul.append(li);
  }
}

/* ── LỚP NHIỆT · GIÓ · PHƯƠNG ÁN (chỉ ở máy) ──────────────────────────────
   Dữ liệu do tools/tinh-toan/xuat_nhiet_gio.mjs sinh ra cạnh .glb. Bản site KHÔNG có tệp ấy (và
   không có nhiet.js) — thiếu tệp thì không làm gì, trang vẫn là trình xem thường. */
function moLopNhiet() {
  if (!CANH.nhiet) return;                  // cảnh không khai lớp nhiệt thì không hỏi tệp
  /* MỘT NHÀ, HAI HỆ KHÍ: mỗi NHÓM KẾT CẤU có tệp nhiệt riêng (mai.nhiet.json = khoang trần mái;
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
  if (CHI_XEM() || document.body.classList.contains("nhung")) return;   // bản đăng / nhúng không mang tệp phân tích — khỏi hỏi (404)
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

/* ── NGUỒN ĐIỆN (web/nguon_dien.js): mục «Nguồn điện» / «Cấp cho» của vật đang chọn trong bảng Chi tiết, chuỗi nguồn tô vàng.
   Chỉ khi nhóm `dien` mang bảng `bang_dien` (thuộc tính gốc — chỉ ở máy). Chế độ điện cũ (nút «⚡ Điện», phím E, ?dien=1) đã
   gỡ (chủ nhà 2026-10-25) — điện · wifi · nhà thông minh xem ở trang con cùng tên (data/viec-3d.yaml). */
var NGUON = null;                          // { toLai } của nguon_dien.js — chỉ ở máy
function moNguonDien() {
  if (!GOC.userData.bang_dien || CHI_XEM()) return;
  import("./nguon_dien.js").then((m) => {
    const ok = NGUON = m.batDau({ GOC, PHAN, chon: (o) => datChon(o), khungVua: (ds) => khungVua(ds), khiChon: (f) => KHI_CHON.push(f),
      // chuỗi nguồn: tô vàng thêm (cùng kiểu «cùng mạch» của toMach — lần chọn sau toMach tự xoá)
      toVang: (ds) => { for (const o of ds) if (!laTo(o)) { MACH.add(o); o.material = VL_MACH; } veLai(200); },
      datNguon: (sec) => { NGUON_CT = sec; if (CT.mo) veChiTiet(); } });
    if (ok && chon) datChon(chon, true);       // vật chọn sẵn (?chon=) trước khi mô-đun tải: dựng «Nguồn điện» cho nó
  }).catch((e) => console.warn("không nạp được nguồn điện:", e));
}

/* ── DỜI · XOAY · BỎ · THẢ ĐỒ ĐẠC (web/dat_do.js, chỉ ở máy — ghi vào mặt bằng qua tools/3d/dat_do.py) ── */
function moDatDo() {
  if (!CUC_BO || !/^(localhost|127\.0\.0\.1)$/.test(location.hostname) || CHI_XEM()) return;
  import("./dat_do.js").then((m) => {
    window.__DAT_DO = m.batDau({ THREE, GOC, PHAN, canvas, camera, controls, m2w, w2m, veLai,
      datChon: (o) => datChon(o), khiChon: (f) => KHI_CHON.push(f), khiThem: (f) => KHI_THEM.push(f), cacChon: () => cacChon(), cheDoSua: () => cheDoSua(), khiDoiSua: (f) => KHI_DOI_SUA.push(f),
      moiKhung: (f) => MOI_KHUNG.push(f), ban: (e) => ban(e),
      tenCum: (o) => cumCua(o)?.ten || o.userData.ten || "vật",
      cum: (o) => cumCua(o)?.ds || null,
      // «Phương án» của chế độ sửa (web/sua/khung_sua.js): phương án VẬT LIỆU (loại · màu, data/phuong-an-vat-lieu.yaml) của cụm
      // chứa vật — công tắc phương án thường khung_sua tự liệt kê qua XEM.congTacVat
      coPaVatLieu: (o) => { if (paTre()) { taiKhiCan("phuong_an").catch(() => {}); return 0; } const c = o && cumCua(o); return c ? paCuaCum(c).cks.length : 0; },   // nhóm phương án tải khi cần: nạp ngầm, khung sau mới có
      moPaVatLieu: (o) => { const c = o && cumCua(o); if (c) { CUM_CHON = c; moMenuPa(c); } },
      ghiChu: async (o, noi_dung) => { const b = await KHO.them({ noi_dung, nguoi: "Khách", neo: o.userData.id, trich: o.userData.ten, truoc: chuoiGoc() }); await taiGhiChu(); return b; },   // vật chưa có đường ghi: dời thành ghi chú
      an: (ids) => { for (const i of ids) anTay.add(i); capNhatHien(); veLai(60); },
      hien: (ids) => { for (const i of ids) anTay.delete(i); capNhatHien(); veLai(60); } });
  }).catch((e) => console.warn("không nạp được dời đồ đạc:", e));
}

/* ── KIỂM TRA (chỉ ở máy): nút «Kiểm tra» + ô kết quả — web/kiem_bang.js, lõi web/kiem.js ── */
/* CHẾ ĐỘ ĐÈN đã gỡ (chủ nhà 2026-09-24): dựng + xem ánh sáng ở Blender — tools/3d/blender/. */

function moKiemTra() {
  if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;     // bản site không mang kiem*.js
  import("./kiem_bang.js").then((m) => m.batDau({ THREE, GOC, PHAN, THEO_ID, ma: MA, khung: $("khung"),
    chon: (ds) => { datChon(ds[0] || null); for (const o of ds.slice(1)) { THEM.add(o); toThem(o); } vienChon(); hienThongTin(); },
    nhinVao: (ds) => khungVua(ds),
  })).catch((e) => console.warn("không nạp được ô Kiểm tra:", e));
}

/* ── hiển thị ──────────────────────────────────────────────────────────── */
/* lớp con LỒNG trong lớp đang tắt cũng tắt (công tắc phương án chứa công tắc Cất/Hạ riêng — thang B) */
function lopTatCha(n) { for (const t of lopTat) if (n && n.startsWith(t + " / ")) return true; return false; }
const LOP_AN_PA = new Set();       // lớp mà lựa chọn công tắc đang chọn vẽ thay (`chon_mot.an_lop`) — xem datChonMot
function lopAnPa(n) { for (const t of LOP_AN_PA) if (n === t || (n && n.startsWith(t + " / "))) return true; return false; }
const QUAT_CHAY = new Map(), CANH_AN = new Set();   // quạt trần đang chạy (bảng công tắc) — xem chayQuat
const PA_AN = new Set();           // id vật của nhóm khác mà một cấu kiện vẽ thay (`an_vat`) (ô «Phương án vật liệu»)
function hienDuoc(o) {
  const u = o.userData;
  if (u.ma && !hienMa) return false;
  if (u.phan_tich && !hienPhanTich) return false;
  if (lkTat.has(u.linh_kien)) return false;
  if (lopTat.has(u.nhom) || lopTatCha(u.nhom) || lopAnPa(u.nhom)) return false;
  if (anTay.has(u.id) || CANH_AN.has(u.id)) return false;
  if (PA_AN.has(u.id) && !lkTat.has("phuong_an")) return false;   // vật gốc mà phương án vẽ thay (`an_vat`)
  if (anNgoai && anNgoai(u)) return false;
  if (rieng && !rieng.has(u.id)) return false;
  if (BUOC_TT && u.buoc && u.linh_kien === BUOC_TT.ma && u.buoc > BUOC_TT.k) return false;
  return true;
}
const DANG_CM = new Map();            // công tắc đang diễn: ma → hàm tới đích ngay (xem datChonMot)
const AN_CHUYEN = new Set();          // vật thế cũ đang được bản tạm thay khi chuyển thế có chuyển động — giữ ẩn tới lúc xong
function capNhatHien() {
  // lớp / nhóm vừa bị tắt trong lúc công tắc của nó đang diễn ⇒ cho lượt ấy tới đích (bản tạm nằm ngoài PHAN, không tự ẩn —
  // soát Codex vòng 3). Ngay sau khi bắt đầu diễn, vật thế cũ vẫn hienDuoc nên không bị cắt ngang.
  for (const [, f] of [...DANG_CM]) if (f.ds?.some((o) => AN_CHUYEN.has(o) && !hienDuoc(o))) f();
  for (const o of PHAN) o.visible = hienDuoc(o) && !AN_CHUYEN.has(o); if (KT && KT.hop.length) veKichThuoc(); doiHien(); }
/* thứ đang hiện đổi (công tắc ở thẻ Trạng thái, phương án, kịch bản…): vật đang chọn bị ẩn ⇒ chọn đúng bộ phận ấy ở thế mới;
   nút nổi + bảng chi tiết theo thế mới */
function doiHien() {
  if (!chon || doiHien.dang) return;
  doiHien.dang = true;
  try { if (!hienDuoc(chon)) giuChon(); else { datNutNoi(); if (CT.mo) veChiTiet(); } } finally { doiHien.dang = false; }
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
  // màn đứng (điện thoại): góc ngang hẹp hơn góc đứng — khung theo góc hẹp hơn, không thì phần làm nổi bị cắt hai bên
  const nua = Math.min(THREE.MathUtils.degToRad(camera.fov / 2), Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
  const kc = r / Math.sin(nua) * 1.05 * (Number(xa) || 1);
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
/* CHỌN CẢ CỤM (chủ nhà 2026-10-21: «chạm lá lam của cửa ⇒ sáng cả cửa, thẻ của cả cửa»): `chon` vẫn là BỘ PHẬN vừa chạm
   (ghi chú neo vào nó, liên kết ?chon=, thước đã lưu), CUM_CHON là cụm chứa nó (`cumCua`) — viền màu quanh cả cụm (VIEN_CUM),
   thẻ bên phải nói về cả cụm. Bộ phận chạm vào mà có công tắc (cánh, ngăn, rèm, cửa sổ hất…) ⇒ tô cam phần chuyển động (CAM)
   + nút nổi ngay trên nó (NUT_NOI). CHỌN NHIỀU (Shift+bấm): THEM là các vật chọn thêm — ghi chú lưu vật chính ở `neo`,
   còn lại ở `neo_them`. */
/* THẺ NỔI (bản đăng, khung nhúng không soạn): thẻ cụm nổi trên khung vẽ, ô trái ẩn (= bộ chọn CSS của thẻ nổi) */
const laTheNoi = () => { const c = document.body.classList; return (c.contains("chi-xem") && !c.contains("nhung")) || (c.contains("nhung") && !c.contains("nhung-sua")); };
const THEM = new Set();
const CAM = new Set();             // bộ phận nhấn: phần chuyển động của công tắc nút nổi, hoặc bộ phận chọn trong Chi tiết
let CUM_CHON = null;
/* CHỌN CHỈ CÓ VIỀN (chủ nhà 2026-10-25: «vật được chọn bỏ phần tô thêm, chỉ cần viền»): vật chọn, chọn thêm, bộ phận nhấn
   giữ đúng vật liệu và nét cạnh thường — không ánh cam, không tô màu nhấn, không nét cạnh đỏ; chỉ viền ngoài cụm (VIEN_CUM). */
const vlChon = (o) => o.userData.vlHien || o.userData.vlGoc;
const laTo = (o) => CAM.has(o) || THEM.has(o);
function toThem(o) { o.material = vlChon(o); datVien(o, VIEN); }
function xoaThem() { for (const o of THEM) toThem(o); THEM.clear(); }
const cacChon = () => (chon ? [chon, ...THEM] : []);
/* viền + tập trung cho CẢ nhóm chọn: cụm của vật chính và cụm của từng vật chọn thêm (Shift+bấm) — vật thêm cũng đậm như vật chính */
// trang việc (nhung.js «khong_the», chủ nhà 2026-10-29): vật chọn không viền xanh — chỉ còn nút công tắc theo ngữ cảnh
const dsVienChon = () => document.body.classList.contains("khong-the") && !document.body.classList.contains("nhung-sua") ? [] : [...new Set([...(CUM_CHON ? CUM_CHON.ds : []), ...[...THEM].flatMap((o) => cumCua(o)?.ds || [o])])];
function vienChon() {
  const moi = dsVienChon(), cu = VIEN_CUM.ds() || [];
  if (moi.length !== cu.length || moi.some((o, i) => o !== cu[i])) VIEN_CUM.dat(moi);
}
function datCam(ds) {
  for (const o of CAM) if (!THEM.has(o)) toThem(o);
  CAM.clear();
  for (const o of ds || []) { CAM.add(o); toThem(o); }
}
function chonCong(o) {
  if (!chon) { datChon(o); return; }
  if (o === chon) { const k = [...THEM].pop(); if (k) { THEM.delete(k); toThem(k); } datChon(k || null, true); return; }
  if (THEM.has(o)) { THEM.delete(o); toThem(o); } else { THEM.add(o); toThem(o); }
  vienChon();
  hienThongTin();
  for (const f of KHI_THEM) f(cacChon());                       // dat_do.js: nhóm chọn nhiều món dời cùng nhau
}
function datChon(o, giu = false) {
  if (!giu) xoaThem();
  chon = o || null;
  const cu = CUM_CHON;
  CUM_CHON = chon ? cumCua(chon) : null;
  vienChon();
  if (CT.mo && CUM_CHON !== CT.cum) dongChiTiet(false);           // chọn sang cụm khác (tìm, ghi chú, kịch bản) ⇒ thôi chi tiết
  if (CT.mo) CT.phan = chon ? nhomPhanCua(chon) : null;
  datNutNoi();
  toMach();
  hienThongTin();
  document.body.classList.toggle("co-chon", !!chon && !CT.mo);   // bản đăng / nhúng: thẻ nổi «cụm đang chọn» hiện theo lớp này
  for (const f of KHI_CHON) f(chon);
  // chỉ khi sang CỤM khác: chọn lại một phần cùng cụm (đổi thế đóng/mở thay vật) không được nuốt cú bấm «Chi tiết» đang tới
  if (chon && cu !== CUM_CHON) { lucChon = performance.now(); $("ben-phai").scrollTop = 0; }     // thẻ mở lại luôn từ đầu (tên + ✕ thấy được)
  if (chon && cu !== CUM_CHON && theGon()) requestAnimationFrame(() => requestAnimationFrame(() => giuTrongKhung(CUM_CHON ? CUM_CHON.ds : [chon])));
  veLai(60);
}
/* Ô PHẢI CHỈ HIỆN KHI CÓ VIỆC (chủ nhà 2026-10-30 «the right side panel should not show if nothing is selected»): đang chọn
   vật, hay đang soạn ghi chú (đang sửa, có vật chú thích nháp, đang đo / khoanh vùng, ô chữ có chữ hoặc đang gõ). Ô phải nổi
   trên khung 3D chứ không chiếm cột ⇒ chọn vật không làm khung co giãn. Ghi chú cho cả góc nhìn mà không chọn vật: nút
   «Viết ghi chú» ở thẻ «Ghi chú» bên trái. */
let viet = false;                       // chủ nhà bấm «Viết ghi chú» khi chưa chọn gì
function capNhatPhai() {
  const o = $("gc-noi-dung");
  let mo;
  try { mo = !!chon || viet || !!dangSua || NHAP.length > 0 || vungBat || !!vungXong || doDangBat
    || !!o?.value.trim() || ($("ben-phai").contains(document.activeElement) && document.activeElement !== document.body);
  } catch { return; }                    // lúc nạp: biến của thước / vùng / sửa chưa khai báo
  if (document.body.classList.contains("mo-phai") !== mo) document.body.classList.toggle("mo-phai", mo);
}
MOI_KHUNG.push(capNhatPhai);
KHI_CHON.push(() => { viet = false; capNhatPhai(); });
/* GỌN Ô TRÁI (cùng ngày «the left panel can be collapsed so we can have the main view as wide as possible»): nút ở góc trên
   trái khung 3D, phím B; nhớ theo trình duyệt. */
function gonTrai(v) {
  document.body.classList.toggle("gon-trai", v);
  try { localStorage.setItem("xem:gon_trai", v ? "1" : "0"); } catch { /* không có kho */ }
  const n = $("nut-gon-trai");
  if (n) { n.setAttribute("aria-pressed", String(v)); n.textContent = v ? "›" : "‹"; n.title = v ? "Mở ô trái (phím B)" : "Gọn ô trái cho khung 3D rộng hơn (phím B)"; }
  veLai(60);
}
try { if (localStorage.getItem("xem:gon_trai") === "1") gonTrai(true); } catch { /* không có kho */ }
function datCheDoSua(v) {
  CHE_DO_SUA = !!v;
  document.body.classList.toggle("che-do-sua", CHE_DO_SUA);
  $("nut-sua-3d")?.setAttribute("aria-pressed", String(CHE_DO_SUA));
  VIEN_CUM.tapTrung();
  datNutNoi();
  for (const f of KHI_DOI_SUA) f(CHE_DO_SUA);
  veLai(60);
}
if ($("nut-sua-3d")) $("nut-sua-3d").onclick = () => datCheDoSua(!CHE_DO_SUA);
if ($("nut-gon-trai")) { $("nut-gon-trai").onclick = () => gonTrai(!document.body.classList.contains("gon-trai")); if (!document.body.classList.contains("gon-trai")) gonTrai(false); }
/* THẺ GỌN (điện thoại, bản đăng / nhúng): vật vừa chọn không được nằm dưới thẻ đáy hay thanh trên nổi — dời camera (cả
   tâm xoay) theo phương đứng màn hình cho tâm vật về giữa phần khung còn thấy. Vật đã thấy trọn thì không đụng. */
const theGon = () => (CHI_XEM() || (document.body.classList.contains("nhung") && !document.body.classList.contains("nhung-sua")))
  && matchMedia("(max-width: 700px), (max-height: 560px)").matches;
let giuHoat = 0;
function giuTrongKhung(ds) {
  const r = canvas.getBoundingClientRect(), the = $("ben-phai").getBoundingClientRect(), th = document.querySelector(".thanh");
  const thNoi = th && getComputedStyle(th).position === "fixed" && getComputedStyle(th).display !== "none";
  const tren = Math.max(r.top, thNoi ? th.getBoundingClientRect().bottom : r.top) + 8;
  const duoi = (the.height && the.top > r.top ? Math.min(the.top, r.bottom) : r.bottom) - 12;
  const b = new THREE.Box3();
  for (const o of ds) if (o.visible !== false) b.expandByObject(o);
  if (b.isEmpty() || duoi - tren < 60) return;
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(camera);
    const y = r.top + (1 - p.y) / 2 * r.height; y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (y0 >= tren && y1 <= duoi) return;
  const dy = (tren + duoi) / 2 - (y0 + y1) / 2;                  // > 0: vật phải xuống trên màn hình
  const tam = b.getCenter(new THREE.Vector3());
  const d = camera.position.distanceTo(tam), wpp = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / r.height;
  const len = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).multiplyScalar(dy * wpp);
  const p0 = camera.position.clone(), t0 = controls.target.clone(), bd = performance.now(), so = ++giuHoat;
  const buoc = () => {
    if (so !== giuHoat) return;
    const k = Math.min(1, (performance.now() - bd) / 320), e = 1 - (1 - k) ** 3;
    camera.position.copy(p0).addScaledVector(len, e); controls.target.copy(t0).addScaledVector(len, e);
    controls.update(); veLai(60);
    if (k < 1) requestAnimationFrame(buoc);
  };
  requestAnimationFrame(buoc);
}
/* ô mặt cắt đang hiện ⇒ --day-cat = chiều cao của nó: thẻ chọn ở điện thoại đứng trên ô, không che thanh kéo */
{ const bc = $("bang-cat");
  const doCat = () => { const h = bc && !bc.hidden ? bc.getBoundingClientRect().height + 8 : 0; document.documentElement.style.setProperty("--day-cat", h + "px"); };
  if (bc) { new MutationObserver(doCat).observe(bc, { attributes: true, attributeFilter: ["hidden", "class"] }); if ("ResizeObserver" in window) new ResizeObserver(doCat).observe(bc); }
  doCat(); }
/* chiều cao thanh trên (nổi trên khung vẽ ở điện thoại) — các nút góc trên của khung đặt dưới nó */
{ const th = document.querySelector(".thanh");
  const doThanh = () => { if (th) document.documentElement.style.setProperty("--thanh-h", th.offsetHeight + "px"); };
  if (th && "ResizeObserver" in window) new ResizeObserver(doThanh).observe(th); doThanh(); }
const m3 = (n) => n.toLocaleString("vi-VN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
/* cao độ của một hộp tính TRÊN SÀN HOÀN THIỆN của tầng chứa nó (mm) — «cao 800» của riêng vật dễ đọc nhầm là chiều cao
   so với sàn (lan can đứng trên gờ 300: cao 800 nhưng đỉnh +1 100 trên sàn, chủ nhà 3D #1076). Tầng = sàn cao nhất không
   cao hơn đáy vật quá 200; ngoài mọi tầng (mái, tháp) thì cao độ tuyệt đối từ mặt vỉa hè. */
const soDau = (m) => (Math.round(m * 1000) >= 0 ? "+" : "−") + mm(Math.abs(m));
function sanCuaHop(b) { return (DM?.cot_san || []).filter((t) => t.cao <= b.min.z + 0.2 && b.min.z < t.tran).pop() || null; }
function caoDoSan(b) {
  const san = sanCuaHop(b);
  return san ? `đáy ${soDau(b.min.z - san.cao)} · đỉnh ${soDau(b.max.z - san.cao)} mm trên sàn ${san.ten.toLowerCase()}`
    : `đáy +${m3(b.min.z)} · đỉnh +${m3(b.max.z)} m (từ mặt vỉa hè)`;
}
/* CÙNG MẠCH ĐIỆN (chủ nhà 3D #506): chọn một điểm điện / bộ đèn mang `mach` ⇒ mọi vật cùng mạch (ổ, công tắc, đèn, thiết
   bị) + tủ cấp mạch ấy tô vàng. Chọn một TỦ (`tu_ma`) ⇒ mọi vật của mọi mạch tủ ấy cấp. Vật thuộc mạch vẽ riêng (khỏi lô). */
const MACH = new Set();
const VL_MACH = new THREE.MeshStandardMaterial({ color: 0xf2c14e, emissive: 0xc98a0b, emissiveIntensity: 0.55, roughness: 0.5 });
VL_MACH.userData.giuMau = true;            // XAM không tô trắng
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
  const quatHut = ma.filter((i) => PHAN.some((o) => o.userData.quat_ma === i));
  const cms = ma.map((i) => (GOC.userData.chon_mot || []).find((cm) => cm.ma === i)).filter(Boolean);
  return { den, quat, quatHut, cms };
}
/* QUẠT HÚT / CHUYỂN KHÍ / CẤP GIÓ TƯƠI (vật mang `quat_ma` = mã điểm): công tắc chạy / tắt — quạt nhiều tốc độ
   (`quat_toc` «thap|cao», hai phím khoá chéo) chọn Tắt · Thấp · Cao. Đang chạy: mặt nạ phát sáng xanh nhạt (mạnh hơn ở
   tốc độ cao) — chỉ là dấu hiệu trên hình, không đổi vật liệu thật. */
const QUAT_HUT = new Map(), VL_GIO = new Map();
function vlGio(goc, cao) {
  const k = goc.uuid + (cao ? ":cao" : ":thap");
  let m = VL_GIO.get(k);
  if (!m) {
    m = goc.clone();
    if (m.emissive) { m.emissive = new THREE.Color(0x7fd3ff); m.emissiveIntensity = cao ? 0.9 : 0.45; }
    else if (m.color) m.color = m.color.clone().lerp(new THREE.Color(0x7fd3ff), cao ? 0.6 : 0.35);
    m.userData = { ...(m.userData || {}), dungChung: true, giuMau: true };
    VL_GIO.set(k, m);
  }
  return m;
}
function chayQuatHut(id, che) {                       // che: "" tắt · "chay" · "thap" · "cao" — vật liệu do apMo dựng lại
  if (che) QUAT_HUT.set(id, che); else QUAT_HUT.delete(id);
  apMo(); veLai(300);
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
const DEN_BAT = new Set(), VL_SANG = new Map();
function vlSang(goc) {
  let m = VL_SANG.get(goc);
  if (!m) { m = goc.clone(); m.emissive = new THREE.Color(0xffe2b0); m.emissiveIntensity = 2.2; m.userData = { ...m.userData, giuMau: true }; VL_SANG.set(goc, m); }
  return m;
}
function batDen(id, bat) {
  if (bat) DEN_BAT.add(id); else DEN_BAT.delete(id);
  // đèn bật chỉ tự phát sáng (vlSang) — hộp đèn trắng «Màu thật» không có đèn chiếu lên vật
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
function toMach() { toMachDien(); NGUON?.toLai(chon); }   // chuỗi nguồn (nguon_dien.js) tô lại sau khi MACH bị xoá
function toMachDien() {
  for (const o of MACH) if (!laTo(o)) o.material = o.userData.vlHien || o.userData.vlGoc;
  MACH.clear();
  const u = chon && uDien();
  const dk = dieuKhienCua(u);
  if (dk) {                                            // vật công tắc điều khiển: tô vàng cả đèn + rèm… nó điều khiển
    const den = new Set(dk.den), nhom = new Set(dk.cms.flatMap((cm) => cm.lua_chon.map((lc) => lc.nhom)));
    for (const o of PHAN) {
      if (laTo(o) || !(den.has(o.userData.bo_den) || dk.quat.some((i) => laQuat(o, i))
        || [...nhom].some((n) => o.userData.nhom && o.userData.nhom.startsWith(n)))) continue;
      MACH.add(o);
      o.material = VL_MACH;
    }
  }
  if (!u || !(u.mach || u.tu_ma)) return;
  const tu = u.tu_ma || u.tu;
  for (const o of PHAN) {
    const v = o.userData;
    if (laTo(o) || v === u || !(u.mach ? (v.mach === u.mach || (tu && v.tu_ma === tu)) : v.tu === tu)) continue;
    MACH.add(o);
    o.material = VL_MACH;
  }
}
/* ── CỤM (chủ nhà 2026-10-21: «chạm một phần của cửa là chọn cả cửa») ──────────────────────────────────────────────
   Cụm = một thứ dựng được, mua được, nghiệm thu được: cửa (khuôn + cánh + lá lam + bản lề + khoá), cửa sổ, tủ, lan can,
   cầu thang, quạt, đèn, thiết bị… Tường, mảng, lớp hoàn thiện, sàn, trần, ống chờ, khối tham chiếu đứng RIÊNG (một vật một
   cụm). Gom bằng bốn luật, theo thứ tự (hợp nhất, cụm nào quá 500 vật hoặc trải quá 7 m thì luật ấy không gom):
     1. cùng `cum` nhóm dựng gắn sẵn (cụm khai rõ thắng mọi luật dưới);
     2. cùng MÃ trong tên (O01, D13, W13, A2, UA1, V01, ST03, E-T1-16, L-T2-02…) trong cùng nhóm kết cấu + cùng tầng, VÀ liền
        nhau (≤ 5 cm) — mã kiểu máy (TC600VS, RKY25), bán kính R20, bu-lông M8, tầng T2 không phải mã cụm;
     3. cùng một công tắc TRẠNG THÁI (đóng/mở, cuốn/thả… — mọi thế của nó; công tắc phương án/màu thì không gom);
     4. cùng thân tên («Bồn cầu — két» ~ «Bồn cầu — thân») VÀ chạm nhau (≤ 3 cm).
   Dựng một lần khi chọn lần đầu, dựng lại khi có nhóm mới vào cảnh. Phép thử: XEM.cum(id). */
const LE_DON = /^(tường|mảng|sơn|ốp|lớp|len chân|lanh tô|sàn|trần|gạch|vữa|bê tông|dầm|cột|móng|khối phòng|nền|mặt hẻm|bệ dưới|hoàn thiện|góc ngoài|góc trong|khoang|mặt tường|mặt trần|mặt sàn|mặt cột|ốp cột|mặt hộp kỹ thuật|ốp hộp kỹ thuật)(?![\p{L}\p{N}])/iu;
// bỏ tiền tố tầng («Tầng 2 — ») và tiền tố nhóm việc («Hoàn thiện — », «Bếp — ») — phần còn lại mới nói vật là gì
const boTang = (t) => String(t || "").replace(/^Tầng [^—]+?\s*—\s*/, "").replace(/^(?:Hoàn thiện|Bếp)\s*—\s*/, "");
const tangCua = (t) => (String(t || "").match(/^(Tầng [^—·]+?)\s*[—·]/) || [])[1] || "";
const laDon = (u) => !!(u.ma || u.phan_tich || u.khoi_phong || u.vat_lieu === "khoang") || LE_DON.test(boTang(u.ten)) || /ống chờ/.test(u.ten || "");
const MA_CUM = /(?<![\p{L}\p{N}.])([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*\d[A-Z0-9]*)(?![\p{L}\p{N}×])/gu;
function maCum(ten) {
  for (const m of boTang(ten).matchAll(MA_CUM)) {
    const c = m[1];
    if (/^(?:[RML]\d+|T\d|IP\d+)$/.test(c) || !/^(?:[A-Z]{1,2}\d{1,3}(?:P\d+)?|[A-Z]+(?:-[A-Z0-9]+)+)$/.test(c)) continue;
    return c;
  }
  return null;
}
const boNgoac = (t) => String(t || "").replace(/\s*\([^)]*\)/g, "").replace(/\s{2,}/g, " ").trim();
function thanCum(ten) {
  const t = boTang(ten), p = t.split(/ — |: /);
  if (p.length < 2) return boNgoac(t);
  const s = boNgoac(p.slice(0, -1).join(" — "));
  return s.length < 6 ? null : s;
}
/* công tắc PHƯƠNG ÁN (đổi loại / màu / so trước–sau) — không phải trạng thái đóng mở: vào menu «Phương án», không gom cụm */
const laPaCT = (cm) => /^(?:pa_|mau_|pha_|phuong_an)/.test(cm.ma) || !!cm.an_lop || /(^|\s)(màu|phương án)(\s|$)/i.test(cm.nhan);
const hopVat = (o) => { const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); return g.boundingBox; };   // hình không đổi ⇒ hộp tính một lần
const theTich = (o) => { const b = hopVat(o); return (b.max.x - b.min.x) * (b.max.y - b.min.y) * (b.max.z - b.min.z); };
let CUM = null;
function dungCum() {
  const T0 = performance.now(), ds = PHAN.filter((o) => o.isMesh), n = ds.length;
  const cha = Int32Array.from({ length: n }, (_, i) => i);
  const goc = (i) => { while (cha[i] !== i) { cha[i] = cha[cha[i]]; i = cha[i]; } return i; };
  const hop = ds.map(hopVat), b = new THREE.Box3(), s = new THREE.Vector3();
  const gop = (ids, khai = false) => {                         // khai: cụm khai rõ (`cum`) — luôn gom, không giới hạn
    if (ids.length < 2 || (!khai && ids.length > 500)) return;
    if (!khai) { b.makeEmpty(); for (const i of ids) b.union(hop[i]); b.getSize(s); if (Math.max(s.x, s.y, s.z) > 7) return; }
    const a = goc(ids[0]); for (const i of ids) { const r = goc(i); if (r !== a) cha[r] = a; }
  };
  const gan = (i, j, e) => { const A = hop[i], B = hop[j];
    return A.min.x - e <= B.max.x && B.min.x - e <= A.max.x && A.min.y - e <= B.max.y && B.min.y - e <= A.max.y && A.min.z - e <= B.max.z && B.min.z - e <= A.max.z; };
  const lien = (ids, e) => {                                     // từng mảng liền nhau (chạm trong e mét) của một nhóm
    const da = new Set();
    for (const i of ids) {
      if (da.has(i)) continue;
      const m = [i]; da.add(i);
      for (let k = 0; k < m.length; k++) for (const j of ids) if (!da.has(j) && gan(m[k], j, e)) { da.add(j); m.push(j); }
      gop(m);
    }
  };
  const theo = (f) => { const g = new Map(); ds.forEach((o, i) => { const k = f(o.userData); if (k) { if (!g.has(k)) g.set(k, []); g.get(k).push(i); } }); return g.values(); };
  const tu = (u) => !u.cum && !laDon(u);
  for (const ids of theo((u) => u.cum && "cum:" + u.cum)) gop(ids, true);
  for (const ids of theo((u) => { const c = tu(u) && maCum(u.ten); return c && `${u.linh_kien}|${tangCua(u.ten)}|${c}`; })) lien(ids, 0.05);
  const ct = new Map();
  // MẶT HOÀN THIỆN có cụm khai rõ (sàn một phòng, một mặt / dải ốp tường, ốp một cột) KHÔNG gom theo công tắc — công tắc phương
  // án WC đổi cả sàn + tường + hộp kỹ thuật nhưng bấm sàn chỉ được sàn (chủ nhà 2026-10-31: «floor of a room should not include
  // the column … wall of each room is different selection … each column separate»)
  const matHT = (u) => u.cum && u.linh_kien === "hoan_thien" && /^Hoàn thiện — /.test(u.ten || "");
  ds.forEach((o, i) => { if ((laDon(o.userData) && !o.userData.cum) || matHT(o.userData)) return;
    for (const cm of congTacCuaVat(o.userData)) if (!laPaCT(cm)) { if (!ct.has(cm)) ct.set(cm, []); ct.get(cm).push(i); } });
  for (const ids of ct.values()) gop(ids);
  for (const ids of theo((u) => { const t = tu(u) && thanCum(u.ten); return t && `${u.linh_kien}|${t}`; })) lien(ids, 0.03);
  const map = new Map(), goi = new Map();
  ds.forEach((o, i) => { const r = goc(i); if (!goi.has(r)) goi.set(r, { ds: [] }); const c = goi.get(r); c.ds.push(o); map.set(o, c); });
  CUM = { theo: map, n: PHAN.length, ms: performance.now() - T0 };
}
function cumCua(o) {
  if (!o || !o.isMesh) return null;
  if (!CUM || CUM.n !== PHAN.length) dungCum();
  const c = CUM.theo.get(o);
  if (c && !c.ten) moTaCum(c);
  return c || null;
}
const hoa = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
function moTaCum(c) {
  c.cms = []; c.pas = [];
  for (const o of c.ds) for (const cm of congTacCuaVat(o.userData)) { const l = laPaCT(cm) ? c.pas : c.cms; if (!l.includes(cm)) l.push(cm); }
  const u0 = c.ds[0].userData;
  c.tang = tangCua(u0.ten);
  c.ten = tenCum(c);
}
/* tên cụm: cụm khai sẵn › nhãn công tắc duy nhất («Tầng 2 · cửa O14» → «Cửa O14») › chữ chung đứng trước mã («khuôn cửa O01»,
   «cánh 1 cửa O01» → «Cửa O01») › thân tên vật to nhất («Bếp — thân tủ A2» → «Tủ A2») */
function tenCum(c) {
  const u0 = c.ds[0].userData;
  if (c.ds.length === 1) return hoa(boTang(u0.ten));
  const k = c.ds.find((o) => o.userData.cum);
  if (k) return hoa(k.userData.cum.replace(/^O\d+P\d+\s*—\s*/, ""));
  if (c.cms.length && c.cms.every((cm) => cm.nhan === c.cms[0].nhan)) {
    // nhãn công tắc «nơi · thứ» / «thứ · phần»: «WC master · ghế sen gập» → «Ghế sen gập», «Tủ quần áo chính · cánh» → «Tủ quần áo chính»
    const t = c.cms[0].nhan.replace(/^Tầng [^·—]+?\s*[·—]\s*/, ""), m = t.match(/^(.+?)\s*·\s*(.+)$/);
    return hoa(!m ? t : /^(WC|Phòng|Bếp|Sảnh|Ban công)\b/.test(m[1]) ? m[2] : /^(cánh|cánh tủ|ngăn|cửa)$/.test(m[2]) ? m[1] : t);
  }
  const dem = new Map();
  for (const o of c.ds) { const m = maCum(o.userData.ten); if (m) dem.set(m, (dem.get(m) || 0) + 1); }
  const ma = [...dem].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (ma && /^ST\d/.test(ma)) return `Cầu thang ${ma}`;
  if (ma && c.ds.every((o) => boTang(o.userData.ten).startsWith(ma))) {   // điểm điện, đèn, quạt: «E-T1-13 — Ổ đầu sofa»
    const dai = c.ds.map((o) => thanCum(o.userData.ten) || "").sort((a, b) => b.length - a.length)[0];
    return dai && dai !== ma ? dai : boNgoac(boTang(c.ds.reduce((a, o) => (o.userData.ten.length > a.userData.ten.length ? o : a), c.ds[0]).userData.ten));
  }
  if (ma) {
    const truoc = c.ds.map((o) => { const t = boNgoac(thanCum(o.userData.ten) || boTang(o.userData.ten)), i = t.indexOf(ma); return i > 0 ? t.slice(0, i).trim().split(/\s+/) : null; }).filter(Boolean);
    let chung = truoc[0] || [];
    for (const w of truoc) { let n = 0; while (n < chung.length && n < w.length && chung[chung.length - 1 - n] === w[w.length - 1 - n]) n++; chung = chung.slice(chung.length - n); }
    if (chung.length) return hoa(`${chung.join(" ")} ${ma}`);
    const dem2 = new Map(); for (const w of truoc) { const x = w[w.length - 1]; dem2.set(x, (dem2.get(x) || 0) + 1); }   // không chung hết: chữ đứng trước mã nhiều nhất («cửa»)
    const tu = [...dem2].sort((a, b) => b[1] - a[1])[0];
    if (tu && tu[1] * 2 >= truoc.length && /^(cửa|cổng|tủ|kệ|thang|rèm|lam|bàn|ghế|quạt|đèn|giường|bồn|chậu|vòi|lưới)$/.test(tu[0])) return hoa(`${tu[0]} ${ma}`);
  }
  const lon = c.ds.reduce((a, o) => (theTich(o) > theTich(a) ? o : a), c.ds[0]);
  return hoa(boNgoac(thanCum(lon.userData.ten) || boTang(lon.userData.ten)).replace(/^(Bếp|Hoàn thiện)\s*—\s*/, "").replace(/^thân\s+/, ""));
}
function phuDeCum(c) {
  const lk = (DM?.linh_kien || []).find((x) => x.ma === c.ds[0].userData.linh_kien)?.ten || "";
  const t = boDau(c.tang).replace(/\s*\(.*\)/, "");
  return [c.tang, lk && !(t && boDau(lk).startsWith(t)) ? lk : ""].filter(Boolean).join(" · ");
}
/* hộp bao (toạ độ mô hình) của các vật đang hiện; tách lớp dời position nên cộng vào */
function hopCum(ds, b = new THREE.Box3()) {
  b.makeEmpty();
  for (const o of ds) if (hienDuoc(o)) { const h = hopVat(o); if (o.position.lengthSq()) b.union(h.clone().translate(o.position)); else b.union(h); }
  return b;
}
const soCo = (b) => {
  const s = b.getSize(new THREE.Vector3());
  const [r, d] = s.x >= s.y ? [s.x, s.y] : [s.y, s.x];
  return [r, d, s.z];
};
const coChu = (b) => { const [r, d, c] = soCo(b); return `${mm(r)} × ${mm(d)} × ${mm(c)} mm`; };
function vatLieuCum(ds) {
  const vl = new Map();
  for (const o of ds) if (hienDuoc(o)) { const t = o.userData.vat_lieu_ten || o.userData.vat_lieu; if (t) vl.set(t, (vl.get(t) || 0) + theTich(o)); }
  return [...vl].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}
/* câu quy cách: bỏ nguồn nội bộ («(chủ nhà …)», «#976»), tách câu */
function cauQC(qc) {
  qc = String(qc || "").replace(/\s*\((?:[^()]*?(?:chủ nhà|ghi chú|#\d{2,})[^()]*?)\)/giu, "").replace(/\s{2,}/g, " ");
  // câu mang `mã` là ghi chú dựng mô hình («Đọc từ `leaves` của bản vẽ») — không phải quy cách cho người đọc
  return qc.split(/(?<=[.;!?])\s+(?=[A-ZÀ-ỸĐ0-9«(⚠])/u).map((x) => x.trim()).filter((x) => x && !x.includes("`"))
    // đầu mã điểm điện «E-T1-93 · cong_tac · Phòng khách · cao 1300mm trên sàn — …» và nhãn «HÌNH:» là chữ nối dữ liệu,
    // không phải câu cho người đọc (chủ nhà 3D #31) — bỏ, giữ phần nói về vật
    .map((x) => x.replace(/^[A-Z][A-Z0-9]*(?:-[A-Za-z0-9]+)+\s+·\s+[a-z0-9_]+\s+·[^—]*—\s*/u, "").replace(/^HÌNH:\s*/u, ""))
    .filter(Boolean);
}
/* quy cách đại diện cụm: chuỗi quy cách chiếm nhiều thể tích nhất trong các vật đang hiện (thân cửa, thân tủ…) */
function qcCum(c) {
  const dem = new Map(), ma = c.ds.map((o) => maCum(o.userData.ten)).find(Boolean), ten = boDau(c.ten);
  for (const o of c.ds) {
    const q = o.userData.quy_cach; if (!q || !hienDuoc(o)) continue;
    const dung = boDau(q).startsWith(ten) || (ma && q.slice(0, 80).includes(ma)) ? 20 : 1;   // quy cách nói đúng tên / mã cụm thắng khối to
    // quy cách của MỘT bộ phận («Cánh 3/4 của ô cửa…», tay nắm, bản lề, chốt) không đại diện cả cụm — thẻ cụm nói về cả cụm
    const bp = /^(Cánh (?!1\/1\b)\d+\/\d+|Cánh (?:trái|phải)|Tay (?:nắm|gạt|bản lề)|Bản lề|Chốt|CHỐT|Khoá|Đệm|Lá lam|Ngăn|Đá ngưỡng|Ngưỡng|Nẹp)\b/u.test(q.trim()) ? 0.02 : 1;
    dem.set(q, (dem.get(q) || 0) + (theTich(o) + 1e-9) * dung * bp);
  }
  return [...dem].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}
/* TÓM TẮT CÔNG DỤNG (chủ nhà 3D #33, #44: «mỗi vật một câu nó dùng để làm gì», thay khối quy cách dài trên thẻ):
   mo-hinh/tom-tat.json — luật data/tom-tat-3d.yaml giải ra câu cho từng mã vật (tools/3d/tom_tat.py; máy qua xem.py, site
   lúc đóng gói). {cau: [câu…], vat: {mã vật: số thứ tự câu}}. Độ phủ soát bằng tools/3d/kiem_tom_tat.py. */
const TOM = { theoVat: null, hua: null };
function taiTomTat() {
  if (!TOM.hua) TOM.hua = fetch("mo-hinh/tom-tat.json").then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => {
    TOM.theoVat = new Map();
    if (d) for (const [id, i] of Object.entries(d.vat || {})) TOM.theoVat.set(id, d.cau[i]);
    if (chon) hienThongTin();
  });
  return TOM.hua;
}
function tomTat(ds) {
  if (!TOM.theoVat) { taiTomTat(); return ""; }
  for (const o of ds) { const c = TOM.theoVat.get(o.userData.id); if (c) return c; }
  return "";
}
/* dòng mạch của công tắc / điểm điện đang chọn (thứ cùng mạch tô vàng) — ở bảng Chi tiết */
function machChu() {
  if (!MACH.size) return "";
  const ud = uDien() || {};
  return ud.mach ? `Mạch ${ud.mach}${ud.mach_vi ? " — " + ud.mach_vi : ""} · tủ ${ud.tu || "?"} · ${MACH.size} vật cùng mạch tô vàng`
    : ud.tu_ma ? `Tủ ${ud.tu_ma} · ${MACH.size} vật trên các mạch tủ này cấp tô vàng`
    : `${MACH.size} vật nó điều khiển tô vàng`;                 // bản đăng: công tắc không mang mã mạch / tủ
}
/* «Nguồn điện» của vật đang chọn (nguon_dien.js dựng, chỉ ở máy) — hiện trong bảng Chi tiết */
let NGUON_CT = null;
/* QUY CÁCH gạch đầu dòng: 4 ý đầu, phần còn lại gấp lại */
function veQuyCach(qc, khoi, congDung = "") {
  const chu = (s) => boDau(s).replace(/[^a-z0-9]+/g, " ").trim();
  const cd = chu(congDung);
  // câu đã nói ở dòng công dụng đầu bảng thì không nhắc lại
  const cau = cauQC(qc).filter((c) => !cd || !(cd.includes(chu(c).slice(0, 40)) || chu(c).includes(cd.slice(0, 40))));
  if (!cau.length) return;
  const ul = document.createElement("ul"); ul.className = "qc-ds";
  ul.append(...cau.slice(0, 4).map((c) => Object.assign(document.createElement("li"), { textContent: c })));
  khoi.append(ul);
  if (cau.length > 4) {
    const d = document.createElement("details"), s = document.createElement("summary");
    s.textContent = `Thêm ${cau.length - 4} ý`;
    const u2 = document.createElement("ul"); u2.className = "qc-ds";
    u2.append(...cau.slice(4).map((c) => Object.assign(document.createElement("li"), { textContent: c })));
    d.append(s, u2); khoi.append(d);
  }
}
/* vật đại diện cho phần điện của cụm (công tắc + khe phím…): vật mang dieu_khien / mạch / tủ */
const uDien = () => {
  if (!chon) return null;
  const u = chon.userData;
  if (u.dieu_khien || u.mach || u.tu_ma) return u;
  return CUM_CHON?.ds.map((o) => o.userData).find((x) => x.dieu_khien || x.mach || x.tu_ma) || u;
};
function veDieuKhien(khoi) {                 // nút bật/tắt đèn, quạt, thế rèm… của công tắc điện đang chọn
  const dk = dieuKhienCua(uDien());
  if (!dk || !(dk.den.length || dk.quat.length || dk.quatHut.length || dk.cms.length)) return;
  const tieu = document.createElement("p"); tieu.className = "mo"; tieu.textContent = "Công tắc này điều khiển:"; khoi.append(tieu);
  const hang = (nhan, nut) => {
    const h = document.createElement("div"); h.className = "hang-cm";
    const t = document.createElement("span"); t.textContent = nhan; h.append(t, nut); khoi.append(h);
  };
  for (const id of dk.den) {
    const o = PHAN.find((x) => x.userData.bo_den === id && x.userData.phat_sang);
    // tên bộ đèn: bỏ đuôi bộ phận («— mặt sáng») và mã đầu — bản máy «E-… — Đèn âm trần…», bản đăng «E-… · đèn âm trần · phòng»
    const tenDen = o && o.userData.ten ? o.userData.ten.replace(/ — [^—]*$/, "").replace(id, "").replace(/^\s*[—·]\s*/, "") : "";
    hang(tenDen || "Đèn", nutGat(tenDen || "Đèn", DEN_BAT.has(id), () => { batDen(id, !DEN_BAT.has(id)); hienThongTin(); }));   // tên chủ nhà thấy, không mã điểm
  }
  if (dk.den.length > 1) {
    const bat = dk.den.every((i) => DEN_BAT.has(i));
    hang("Tất cả đèn", nutGat("Tất cả đèn", bat, () => { for (const i of dk.den) batDen(i, !bat); hienThongTin(); }));
  }
  for (const id of dk.quat) hang(tenHien((PHAN.find((x) => x.userData.ma_diem === id)?.userData.ten || "Quạt trần").split(" — ").slice(0, 2).join(" — ")), nutGat("Quạt trần", QUAT_CHAY.get(id)?.visible || false,
    () => { chayQuat(id, !(QUAT_CHAY.get(id)?.visible)); hienThongTin(); }));
  for (const id of dk.quatHut) {
    const o = PHAN.find((x) => x.userData.quat_ma === id);
    const ten = o?.userData.ten ? "Quạt hút — " + tenHien(o.userData.ten).replace(/^E-[^ ]+ — /, "").split(" — ")[0] : "Quạt hút";
    const che = QUAT_HUT.get(id) || "";
    if (o?.userData.quat_toc) {                        // hai tốc độ khoá chéo: một nhóm ba nút, chỉ một nút sáng
      const nn = document.createElement("span"); nn.className = "nhom-nut nho";
      nn.setAttribute("role", "group"); nn.setAttribute("aria-label", ten);
      for (const [ma_, nh] of [["", "Tắt"], ["thap", "Thấp"], ["cao", "Cao"]]) {
        const b = document.createElement("button"); b.type = "button"; b.textContent = nh;
        b.setAttribute("aria-pressed", String(che === ma_));
        b.onclick = () => { chayQuatHut(id, ma_); hienThongTin(); };
        nn.append(b);
      }
      hang(ten, nn);
    } else {
      hang(ten, nutGat(ten, !!che, () => { chayQuatHut(id, che ? "" : "chay"); hienThongTin(); }));
    }
  }
  for (const cm of dk.cms) hang(cm.nhan, nutCongTac(cm, () => { doiTrangThai(); }));
}

/* ── THẺ CỤM bên phải (bản đăng + khung nhúng: thẻ nổi) ── */
/* HỆ THỐNG điện · mạng · nhà thông minh của vật chọn (web/he_thong.js): khối ngắn trên thẻ + mục đầy đủ trong Chi tiết.
   Bảng: thuộc tính gốc `bang_dien` (máy) hoặc mo-hinh/bang-dien.json (bản đăng) — tải về thì vẽ lại thẻ. */
const HE_THONG = heThong({ GOC: () => GOC, khiSan: () => { if (chon) hienThongTin(); } });
function hienThongTin() {
  if (KT && chon !== KT.chon) { KT.chon = chon; veKichThuoc(); }
  $("chua-chon").hidden = !!chon;
  $("thong-tin").hidden = !chon;
  datGoiYGhiChu();
  if (CT.mo) veChiTiet();
  if (!chon || !CUM_CHON) return;
  const c = CUM_CHON;
  $("tt-nhom").textContent = phuDeCum(c);
  $("tt-ten").textContent = c.ten;
  let th = $("tt-them");
  if (!th) { th = document.createElement("p"); th.id = "tt-them"; th.className = "mo"; $("tt-ten").after(th); }
  th.hidden = THEM.size === 0;
  th.textContent = THEM.size ? `+ ${THEM.size} vật chọn thêm (Shift+bấm để bỏ): ${[...new Set([...THEM].map((o) => cumCua(o)?.ten || o.userData.ten))].join(" · ")}` : "";
  const vl = vatLieuCum(c.ds);
  $("tt-vl").textContent = vl.length > 4 ? `${vl.slice(0, 4).join(" · ")} · và ${vl.length - 4} vật liệu khác` : vl.join(" · ") || "—";
  const b = hopChuan(c.ds);
  $("tt-kt").textContent = b.isEmpty() ? "—" : coChu(b);
  $("tt-kt").previousElementSibling.textContent = "Rộng × dày × cao";
  // THẺ GỌN (chủ nhà 2026-10-30): cao độ, câu công dụng, phương án chỉ ở «Chi tiết» — thẻ còn tên, vật liệu, cỡ, công tắc
  // công tắc tường: nút bật/tắt thứ nó điều khiển ngay trên thẻ
  let tdk = $("tt-dieu-khien");
  if (!tdk) { tdk = document.createElement("div"); tdk.id = "tt-dieu-khien"; $("tt-chi-tiet").before(tdk); }
  tdk.replaceChildren(); veDieuKhien(tdk); tdk.hidden = !tdk.childElementCount;
  $("tt-chi-tiet").textContent = c.ds.length > 1 ? `Chi tiết · ${demPhan(c)} bộ phận` : "Chi tiết";
}
const demPhan = (c) => c.ds.filter(hienDuoc).length;
// chạm chọn vật trên điện thoại: thẻ hiện NGAY dưới ngón tay ⇒ cú «click» của chính lần chạm ấy rơi vào nút này (soát điện
// thoại 2026-10-21, ngang màn hình) — bỏ click tới trong 450 ms sau khi chọn
let lucChon = 0;
$("tt-chi-tiet").onclick = () => { if (performance.now() - lucChon < 450) return; moChiTiet(); };

/* ── PHƯƠNG ÁN CỦA CỤM (chủ nhà 2026-10-31: chỉ còn ở CHẾ ĐỘ SỬA — nút «Phương án» cạnh «Vật liệu» trên thanh đáy,
   web/sua/vat_lieu.js; thẻ vật / «Chi tiết» ở chế độ xem không còn nút này, sơn thử · vật liệu thử ở chế độ xem đã gỡ — dùng
   «Vật liệu» của chế độ sửa): menu chọn loại · màu của các công tắc phương án + phương án vật liệu ── */
const laMauCT = (cm) => cm.ma.startsWith("mau_") || /(^|\s)màu(\s|$)/i.test(cm.nhan);
function paCuaCum(c) {
  const cks = [], bang = GOC.userData.phuong_an_vat_lieu;
  if (bang) for (const o of c.ds) for (const ck of paApVao(o.userData)) if (!cks.includes(ck)) cks.push(ck);
  // công tắc MÀU dựng sẵn («Cửa O02 · màu khung») không lên menu: khối «Sơn màu» bên dưới đổi màu mọi bộ phận, theo từng phần
  // (chủ nhà 2026-10-23: «remove the default customizing section … if some object has it already»)
  const cms = c.pas.filter((cm) => !(cm.ma.startsWith("pa_") && cks.some((ck) => "pa_" + ck.ma === cm.ma)) && !cm.an_lop && !laMauCT(cm));
  return { cms, cks };
}
let MENU_PA = null;
function moMenuPa(c) {
  if (!MENU_PA) {
    MENU_PA = document.createElement("div"); MENU_PA.id = "menu-pa-cum"; MENU_PA.className = "tam-noi menu-pa-cum";
    MENU_PA.setAttribute("role", "dialog"); MENU_PA.setAttribute("aria-modal", "false"); MENU_PA.hidden = true;
    document.body.append(MENU_PA);
    addEventListener("pointerdown", (e) => { if (!MENU_PA.hidden && !MENU_PA.contains(e.target) && !e.target.closest('[data-v="phuong-an"]')) dongMenuPa(); }, true);
  }
  MENU_PA.cum = c; MENU_PA.goi = document.activeElement?.closest?.("button") || null;
  if (paTre()) {                                     // bản đăng: nhóm phương án tải khi cần — tải xong mới có loại + màu
    taiKhiCan("phuong_an").then(() => { CUM = null; if (chon) datChon(chon, true); if (CUM_CHON) veMenuPa(CUM_CHON); },
      (e) => console.warn("không tải được phương án vật liệu:", e));
  }
  veMenuPa(c);
  MENU_PA.hidden = false;
  document.body.classList.add("mo-menu-pa");
  MENU_PA.querySelector("button")?.focus({ preventScroll: true });
}
function dongMenuPa() {
  if (!MENU_PA || MENU_PA.hidden) return false;
  MENU_PA.hidden = true; document.body.classList.remove("mo-menu-pa");
  if (MENU_PA.goi?.isConnected) MENU_PA.goi.focus({ preventScroll: true });   // trả tiêu điểm về nút đã mở
  return true;
}
const mauLC = (lc) => {                              // màu của một lựa chọn công tắc màu: vật liệu của vật đầu tiên trong lớp ấy
  const o = PHAN.find((x) => x.isMesh && lopLC(lc).some((n) => trongLop(x.userData, n)) && x.userData.vlGoc?.color);
  return o ? o.userData.vlGoc.color.getStyle() : null;
};
function veMenuPa(c) {
  const m = MENU_PA; m.replaceChildren();
  const dau = document.createElement("div"); dau.className = "tam-dau";
  const h = document.createElement("h2"); h.textContent = "Phương án"; h.id = "menu-pa-tieu-de";
  m.setAttribute("aria-labelledby", "menu-pa-tieu-de");
  const p = document.createElement("p"); p.className = "mo"; p.textContent = c.ten;
  const x = document.createElement("button"); x.type = "button"; x.className = "tt-dong tam-x"; x.textContent = "✕"; x.setAttribute("aria-label", "Đóng phương án");
  x.onclick = dongMenuPa;
  const tde = document.createElement("div"); tde.append(h, p);
  dau.append(tde, x); m.append(dau);
  const { cms, cks } = paCuaCum(c), bang = GOC.userData.phuong_an_vat_lieu;
  const doi = (f) => { f(); giuChon(); if (CUM_CHON) veMenuPa(CUM_CHON); };
  for (const cm of cms) {
    const k = document.createElement("section"); k.className = "pa-muc";
    const t = document.createElement("h3"); t.textContent = hoa(cm.nhan.replace(/^Tầng [^·—]+?\s*[·—]\s*/, ""));
    const mau = /(^|\s)màu(\s|$)/i.test(cm.nhan);
    const hang = document.createElement("div"); hang.className = mau ? "pa-mau pa-mau-nhan" : "chip-loc pa-loai"; hang.setAttribute("role", "radiogroup"); hang.setAttribute("aria-label", t.textContent);
    const da = new Set();
    for (const lc of cm.lua_chon) {
      if (da.has(lc.nhan)) continue; da.add(lc.nhan);
      const bt = document.createElement("button"); bt.type = "button"; bt.className = mau ? "pa-o-mau co-nhan" : "chip";
      bt.setAttribute("role", "radio"); const dang = CHON_MOT.get(cm.ma) === lc.nhan;
      bt.setAttribute("aria-checked", String(dang));
      if (mau) { const i = document.createElement("i"); i.style.background = mauLC(lc) || "#ccc"; const s = document.createElement("span"); s.textContent = lc.nhan; bt.append(i, s); }
      else bt.textContent = lc.nhan;
      bt.onclick = () => doi(() => { datChonMot(cm, lc.nhan, true); dungLop(GOC.userData.nhom || []); capNhatHien(); });
      hang.append(bt);
    }
    k.append(t, hang); m.append(k);
  }
  for (const ck of cks) {
    const pa = paCua(ck), st = PA.get(ck.ma) || {};
    const k = document.createElement("section"); k.className = "pa-muc";
    const t = document.createElement("h3"); t.textContent = ck.ten; k.append(t);
    const nhan = document.createElement("p"); nhan.className = "mo"; nhan.textContent = "Loại"; k.append(nhan);
    const chips = document.createElement("div"); chips.className = "chip-loc pa-loai"; chips.setAttribute("role", "radiogroup"); chips.setAttribute("aria-label", `${ck.ten} — loại`);
    for (const p_ of ck.phuong_an) {
      const bt = document.createElement("button"); bt.type = "button"; bt.className = "chip";
      bt.setAttribute("role", "radio"); bt.setAttribute("aria-checked", String(p_.ma === pa.ma));
      bt.textContent = (ck.de_xuat?.loai === p_.ma ? "★ " : "") + String(p_.ten).split(" — ")[0]; bt.title = p_.ten;
      bt.onclick = () => doi(() => { PA.set(ck.ma, { loai: p_.ma, mau: (p_.mau || []).includes(st.mau) ? st.mau : p_.mau_mac_dinh || null }); doiPa(); });
      chips.append(bt);
    }
    k.append(chips);
    if (pa.vat_lieu) { const v = document.createElement("p"); v.className = "pa-vl"; v.textContent = pa.vat_lieu; k.append(v); }
    if (pa.mau?.length) {
      const nm = document.createElement("p"); nm.className = "mo"; nm.textContent = "Màu" + (st.mau && bang.mau[st.mau] ? ": " + bang.mau[st.mau].ten : ""); k.append(nm);
      const hm = document.createElement("div"); hm.className = "pa-mau"; hm.setAttribute("role", "radiogroup"); hm.setAttribute("aria-label", `${ck.ten} — màu`);
      for (const mk of pa.mau) {
        const bt = document.createElement("button"); bt.type = "button"; bt.className = "pa-o-mau";
        bt.setAttribute("role", "radio"); bt.setAttribute("aria-checked", String(mk === st.mau));
        bt.title = bang.mau[mk].ten; bt.setAttribute("aria-label", bt.title);
        const i = document.createElement("i"); i.style.background = chamPa(bang.mau[mk]); bt.append(i);
        bt.onclick = () => doi(() => { PA.set(ck.ma, { loai: pa.ma, mau: mk }); doiPa(); });
        hm.append(bt);
      }
      k.append(hm);
    }
    m.append(k);
  }
  if (paTre()) { const p2 = document.createElement("p"); p2.className = "mo"; p2.textContent = "Đang tải phương án vật liệu…"; m.append(p2); }
}

/* ── NÚT NỔI TRÊN KHUNG VẼ (chủ nhà 2026-10-21: «chạm cánh phải của cửa ⇒ nút mở đúng cánh ấy, nút đi theo cánh») ──────────
   Bộ phận vừa chạm thuộc một công tắc trạng thái ⇒ phần chuyển động của nó tô cam (CAM) + một nút nổi neo vào giữa phần ấy
   (chiếu mỗi khung vẽ, ẩn khi ra sau camera). Chạm nút ⇒ chỉ phần ấy đổi thế:
     · công tắc hai thế: sang thế kia («Mở cánh», «Đóng cánh», «Thả xuống», «Cuốn lên», «Kéo ra»…);
     · công tắc nhiều thế mà mỗi thế là một tổ hợp cánh (D13: Đóng · Mở hai cánh · Mở cánh Tây Nam · Mở cánh Đông Bắc) ⇒ chọn
       thế khác thế đang có ĐÚNG ở cánh vừa chạm, ít thay đổi nhất (dichTheoCanh — đọc từ hình, không ghi tay);
     · còn lại (cửa sổ O16 Đóng · 45° · 90°, rèm ba thế) ⇒ nút mở một menu nhỏ các thế.
   Bộ phận không chuyển động mà cụm chỉ có MỘT công tắc trạng thái (chạm khuôn, hộp cuốn) ⇒ nút neo vào phần chuyển động.
   Sau khi đổi, nút trượt tới chỗ mới của phần ấy (CSS transition), chạm lại để trả về. */
const NN = { cm: null, lc: null, ds: [], neo: new THREE.Vector3(), x: NaN, y: NaN, hien: false, co: false, goc: Array.from({ length: 8 }, () => new THREE.Vector3()) };
const thanTT = (ten) => { const p = boNgoac(String(ten || "")).split(/ — |: /); return p.length > 1 ? p.slice(0, -1).join(" — ") : p[0]; };   // thân bỏ thế «(đóng)»
const tenBP = (ten) => boNgoac(ten);                                   // tên bộ phận bỏ thế — tìm lại nó ở thế mới
const HOP_LC = new Map();
function hopTheoThan(lc) {                                            // thế lc: thân tên → hộp bao (mô hình) — hình không đổi ⇒ nhớ
  let m = HOP_LC.get(lc);
  if (m && m.n === PHAN.length) return m.map;
  const map = new Map(), ns = lopLC(lc);
  for (const o of PHAN) if (o.isMesh && ns.some((n) => trongLop(o.userData, n))) {
    const k = thanTT(o.userData.ten); if (!map.has(k)) map.set(k, new THREE.Box3()); map.get(k).union(hopVat(o));
  }
  HOP_LC.set(lc, { map, n: PHAN.length });
  return map;
}
const trungHop = (a, b) => a.min.distanceToSquared(b.min) < 25e-6 && a.max.distanceToSquared(b.max) < 25e-6;
function dichTheoCanh(cm, than) {
  const ht = cm.lua_chon.find((lc) => lc.nhan === CHON_MOT.get(cm.ma));
  if (!ht) return null;
  const A = hopTheoThan(ht);
  if (!A.has(than)) return null;
  let tot = null, it = Infinity, hoa_ = false;
  for (const lc of cm.lua_chon) {
    if (lc === ht || lc.nhan === ht.nhan) continue;
    const B = hopTheoThan(lc);
    if (!B.has(than) || trungHop(A.get(than), B.get(than))) continue;   // cánh vừa chạm phải đổi chỗ
    let n = 0;
    for (const [k, h] of A) if (!B.has(k) || !trungHop(h, B.get(k))) n++;
    if (n < it) { it = n; tot = lc; hoa_ = false; } else if (n === it) hoa_ = true;
  }
  return hoa_ ? null : tot;
}
/* Cánh `than` của công tắc nhiều thế đang MỞ hay ĐÓNG — đọc từ HÌNH: cánh đang ở đúng chỗ của nó trong thế «Đóng» thì đóng.
   (Không đọc chữ «(mở…)» trong tên: tay gạt, chốt, cảm biến của cánh mang nhãn của CẢ công tắc — «(mở cánh đông bắc)» —
   nên cánh Tây Nam đang đóng vẫn bị coi là mở và nút ghi «Đóng cánh». Chủ nhà 3D #6.) Công tắc không có thế «Đóng» ⇒ đọc tên
   nhưng chỉ tính khung / kính, bỏ phụ kiện. */
function canhDangMo(cm, than, ds) {
  const ht = cm.lua_chon.find((lc) => lc.nhan === CHON_MOT.get(cm.ma)), dong = cm.lua_chon.find((lc) => lc.nhan === "Đóng");
  if (ht && dong) {
    if (ht === dong) return false;
    const A = hopTheoThan(ht).get(than), B = hopTheoThan(dong).get(than);
    if (A && B) return !trungHop(A, B);
  }
  const re = /\((?:mở|MỞ|lùa|LÙA)(?![\p{L}])/u, loi = ds.filter((o) => /— (?:khung|kính|lá|tấm)\b/u.test(o.userData.ten));
  return (loi.length ? loi : ds).some((o) => re.test(o.userData.ten));
}
function danhTu(cm, o) {
  const s = boDau(cm.nhan + " " + (o?.userData.ten || ""));
  if (/cua so/.test(s)) return "cửa sổ";
  if (/ngan|thung rac|gia gia vi/.test(s)) return "ngăn";
  if (/\bnap\b/.test(s)) return "nắp";
  if (/\bcanh\b|\bcua\b|\btu\b/.test(s)) return "cánh";
  return "";
}
/* phần chuyển động (các vật đang hiện) của công tắc cm trong cụm c; than: chỉ phần mang thân ấy (một cánh của cửa nhiều cánh) */
function phanDong(cm, than) {
  const ht = cm.lua_chon.find((lc) => lc.nhan === CHON_MOT.get(cm.ma));
  if (!ht) return [];
  const ns = lopLC(ht);
  const ds = PHAN.filter((o) => o.isMesh && hienDuoc(o) && ns.some((n) => trongLop(o.userData, n)));
  const rieng_ = than ? ds.filter((o) => thanTT(o.userData.ten) === than) : [];
  return rieng_.length ? rieng_ : ds;
}
/* công tắc có phần chuyển động gần bộ phận vừa chạm nhất (tâm hộp bao); công tắc không có phần đang hiện thì bỏ */
function congTacGanNhat(cms, o) {
  const t = hopVat(o).getCenter(new THREE.Vector3()), b = new THREE.Box3(), c = new THREE.Vector3();
  let tot = null, kc = Infinity;
  for (const cm of cms) {
    const ds = phanDong(cm); if (!ds.length) continue;
    b.makeEmpty(); for (const x of ds) b.union(hopVat(x));
    const d = b.getCenter(c).distanceToSquared(t);
    if (d < kc) { kc = d; tot = cm; }
  }
  return tot;
}
function datNutNoi() {
  NN.cm = null; NN.lc = null; NN.ds = [];
  const o = chon, c = CUM_CHON;
  let cm = null, than = null;
  if (o && c && !THEM.size && (cheDoSua() || CT.mo)) {              // chế độ xem: chọn vật chỉ có viền (Chi tiết vẫn có nút)
    cm = congTacCuaVat(o.userData).find((x) => !laPaCT(x)) || null;
    if (cm && cm.lua_chon.length > 2 && new Set(phanDong(cm).map((x) => thanTT(x.userData.ten))).size > 1) than = thanTT(o.userData.ten);
    if (!cm && !CT.mo && c.cms.length === 1) cm = c.cms[0];
    if (!cm && !CT.mo && c.cms.length > 1) cm = congTacGanNhat(c.cms, o);   // chạm khuôn của cửa nhiều công tắc: công tắc gần chỗ chạm nhất
    if (!cm && CT.mo && CT.phan) { const p = CT.nhom?.find((g) => g.khoa === CT.phan); cm = p && p.ds.map((x) => congTacCuaVat(x.userData).find((y) => !laPaCT(y))).find(Boolean) || null; }
  }
  // CHẾ ĐỘ SỬA: công tắc đổi VẬT LIỆU (gạch sàn / ốp WC, sàn phòng ngủ, chia dải ốp…) không có nút nổi trên vật — đã có «Phương án»
  // và «Vật liệu» ở thanh đáy (chủ nhà 2026-10-31: «some object show contextual button of change the material, remove them»)
  if (cm && cheDoSua() && (/^Hoàn thiện — /.test(o.userData.ten || "") && o.userData.cum || /gạch|vật liệu|màu|sơn|terrazzo|dải ốp/i.test(cm.nhan))) cm = null;
  if (cm) {
    NN.cm = cm;
    NN.ds = phanDong(cm, than);
    NN.lc = cm.lua_chon.length === 2 ? cm.lua_chon.find((lc) => lc.nhan !== CHON_MOT.get(cm.ma)) || null : than ? dichTheoCanh(cm, than) : null;
    NN.than = than;
  }
  // tô cam: phần chuyển động của nút nổi; trong Chi tiết, bộ phận đang chọn ở danh sách
  const p = CT.mo && CT.phan ? CT.nhom?.find((g) => g.khoa === CT.phan)?.ds.filter(hienDuoc) : null;
  datCam(p || NN.ds);                                                 // Chi tiết + bộ phận đang chọn: chỉ bộ phận ấy cam
  veNutNoi();
}
/* CHỤM PHÓNG: chỉ mô hình được phóng (chủ nhà 2026-10-21). iOS Safari bỏ qua maximum-scale và touch-action khi
   chụm bắt đầu ngoài khung vẽ ⇒ chặn cử chỉ gesture* của WebKit và touchmove nhiều ngón ở cả trang; OrbitControls đọc
   sự kiện con trỏ trên khung vẽ nên vẫn chụm phóng mô hình bình thường. */
for (const ten of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(ten, (e) => e.preventDefault(), { passive: false });
document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
/* PHÓNG TRANG Ở MÁY TÍNH cũng chặn (chủ nhà 2026-10-24: «disable the zoom in and out of the page so it will not be confused
   with behaviour of the 3d view»): chụm bàn rê = wheel + ctrlKey, Ctrl/⌘+lăn chuột, Ctrl/⌘ + «+» «−» «0». Chỉ bỏ hành vi mặc
   định (không dừng lan truyền) ⇒ trên khung vẽ OrbitControls vẫn nhận wheel và phóng mô hình như thường. */
addEventListener("wheel", (e) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }, { capture: true, passive: false });
addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && ["=", "+", "-", "_", "0"].includes(e.key)) e.preventDefault();
}, { capture: true });
let NUT_NOI = null, MENU_NOI = null;
function veNutNoi() {
  if (!NUT_NOI) {
    NUT_NOI = document.createElement("button"); NUT_NOI.type = "button"; NUT_NOI.id = "nut-noi"; NUT_NOI.className = "nut-noi"; NUT_NOI.hidden = true;
    // chạm chọn trên màn cảm ứng: nút hiện ngay dưới ngón tay ⇒ trình duyệt bắn «click» bù vào nút — bỏ cú bấm < 350 ms sau khi hiện
    // «click» bù của CHÍNH cú chạm vừa chọn thì bỏ: cú bấm thật luôn có pointerdown trên nút, «click» bù thì không. Không so
    // khoảng cách — WebKit (iOS) kéo «click» bù về nút gần nhất, lệch 15 px so với chỗ nhấc ngón. Bàn phím / trợ năng (detail 0) luôn qua.
    NUT_NOI.onpointerdown = () => { NUT_NOI.luc = performance.now(); };
    NUT_NOI.onclick = (e) => {
      e.stopPropagation();
      if (e.detail && CHAM_CUOI && !(NUT_NOI.luc > CHAM_CUOI.t)) return;
      bamNutNoi();
    };
    MENU_NOI = document.createElement("div"); MENU_NOI.id = "menu-noi"; MENU_NOI.className = "menu-noi"; MENU_NOI.setAttribute("role", "menu"); MENU_NOI.hidden = true;
    $("khung").append(NUT_NOI, MENU_NOI);
    addEventListener("pointerdown", (e) => { if (!MENU_NOI.hidden && !MENU_NOI.contains(e.target) && e.target !== NUT_NOI) dongMenuNoi(); }, true);
  }
  dongMenuNoi();
  const cm = NN.cm;
  NN.co = !!cm && NN.ds.length > 0;                                   // có nút (cố ý) — khác với «đang ra ngoài khung»
  NUT_NOI.hidden = !NN.co;
  if (!NN.co) { NN.hien = false; window.XEM_HOOK?.nutAn?.(); return; }
  const b = new THREE.Box3(); for (const o of NN.ds) b.union(hopVat(o));
  NN.neo.copy(m2w(...b.getCenter(new THREE.Vector3()).toArray()));
  for (let i = 0; i < 8; i++) NN.goc[i].copy(m2w(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z));
  let nhan;
  if (!NN.lc) nhan = CHON_MOT.get(cm.ma) || "Trạng thái";
  else if (NN.than) {                                                 // một cánh của cửa nhiều cánh: «Mở cánh» / «Đóng cánh»
    nhan = `${canhDangMo(cm, NN.than, NN.ds) ? "Đóng" : "Mở"} ${danhTu(cm, chon)}`.trim();
  } else nhan = /^(Đóng|Mở)$/.test(NN.lc.nhan) ? `${NN.lc.nhan} ${danhTu(cm, chon)}`.trim() : NN.lc.nhan;
  /* MỘT CHỮ, MỘT NGHĨA (chủ nhà 2026-10-21: «nút to quá — một chữ thôi»; rà soát: chữ trên nút luôn là VIỆC sẽ làm): công tắc
     hai thế ⇒ động từ đầu của thế đích («Mở», «Đóng», «Thả», «Cuốn», «Kéo», «Hạ», «Cất», «Khoá»…); nhiều thế ⇒ «Chọn ▾» mở menu,
     thế đang có đánh dấu ✓ trong menu. Câu đủ ở aria-label + title. */
  const mot = (t) => String(t).split(/[\s·]+/)[0];
  const chu = NN.lc ? mot(nhan) : "Chọn";
  NUT_NOI.replaceChildren();
  const t = document.createElement("span"); t.className = "nn-chu"; t.textContent = chu;
  NUT_NOI.append(t);
  NUT_NOI.classList.toggle("nhieu", !NN.lc);
  const day = NN.lc ? `${nhan} — ${cm.nhan}` : `${cm.nhan}: đang ${nhan} — chọn thế`;
  NUT_NOI.setAttribute("aria-label", day); NUT_NOI.title = day;
  NUT_NOI.setAttribute("aria-haspopup", NN.lc ? "false" : "menu");

  NN.x = NN.y = NaN;
  viTriNutNoi();
  const nh = neoNutNoi();
  // tu/den/scene cho đường báo: phần đang hiện của cụm và bản của nó ở thế đích (công tắc nhiều thế ⇒ không có đích, không báo)
  const hk = window.XEM_HOOK?.nutHien;
  try { if (hk) hk({ ma: nh.ma, cm, phan: nh.phan, neo: nh.neo, tuNhan: nh.the, denNhan: nh.toi, veLai, khungLienTuc,
    tu: nh.phan.filter((o) => o.visible), den: nh.toi ? hienSauKhi(cm, nh.toi) : [], scene }); } catch (e) { console.warn("XEM_HOOK.nutHien lỗi:", e); }
}
/* điểm neo + phần chuyển động của nút nổi (thế giới) — cho mô-đun khác vẽ cạnh nút; null khi không có nút */
const neoNutNoi = () => (NN.cm && NUT_NOI && NN.ds.length ? { ma: NN.cm.ma, the: CHON_MOT.get(NN.cm.ma), toi: NN.lc?.nhan || null, neo: NN.neo.clone(), phan: NN.ds.slice(), nut: NUT_NOI } : null);
const _nn = new THREE.Vector3();
function viTriNutNoi() {                                             // mỗi khung vẽ: chiếu điểm neo lên màn hình
  if (!NUT_NOI || !NN.co) return;                                     // ra ngoài khung thì vẫn chiếu mỗi khung — vào lại là hiện
  // sau camera xét bằng toạ độ camera, không bằng z chiếu: điểm neo ngoài mặt phẳng xa (nhìn từ trên có mặt cắt) vẫn trước mặt
  const sau = camera.isPerspectiveCamera && _nn.copy(NN.neo).applyMatrix4(camera.matrixWorldInverse).z > -camera.near;
  _nn.copy(NN.neo).project(camera);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  // sau camera ⇒ ẩn; ra ngoài mép khung (cánh mở về phía người xem) ⇒ ghim vào mép, vẫn chạm được
  const ra = sau || Math.abs(_nn.x) > 3 || Math.abs(_nn.y) > 3;
  NUT_NOI.hidden = ra; NN.hien = !ra;
  if (ra) { if (MENU_NOI && !MENU_NOI.hidden) dongMenuNoi(); return; }
  const bw = NUT_NOI.offsetWidth || 120, bh = NUT_NOI.offsetHeight || 36;
  let px = (_nn.x + 1) * w / 2, py = (1 - _nn.y) * h / 2;
  /* bộ phận nhỏ trên màn (nhìn cả nhà): nút không đè lên bộ phận — đặt cạnh hộp chiếu của nó (phải, rồi trái, trên, dưới) */
  let l = Infinity, r = -Infinity, tr = Infinity, d = -Infinity, truoc = true;
  for (const g of NN.goc) {
    if (camera.isPerspectiveCamera && _nn.copy(g).applyMatrix4(camera.matrixWorldInverse).z > -camera.near) { truoc = false; break; }
    _nn.copy(g).project(camera);
    const sx = (_nn.x + 1) * w / 2, sy = (1 - _nn.y) * h / 2;
    l = Math.min(l, sx); r = Math.max(r, sx); tr = Math.min(tr, sy); d = Math.max(d, sy);
  }
  if (truoc) {
    const ox = Math.max(0, Math.min(r, px + bw / 2) - Math.max(l, px - bw / 2)), oy = Math.max(0, Math.min(d, py + bh / 2) - Math.max(tr, py - bh / 2));
    const dt = Math.max(1, (r - l) * (d - tr));
    if (r - l < bw || d - tr < bh || ox * oy > 0.5 * dt) {
      if (r + 10 + bw <= w - 8) px = r + 10 + bw / 2;
      else if (l - 10 - bw >= 8) px = l - 10 - bw / 2;
      else if (tr - 10 - bh >= 8) py = tr - 10 - bh / 2;
      else py = d + 10 + bh / 2;
    }
  }
  const x = Math.round(Math.min(w - bw / 2 - 8, Math.max(bw / 2 + 8, px)));
  let yMax = h - 30;
  if (laTheNoi() && chon) {                                          // bản đăng / nhúng: thẻ nổi nằm trên khung vẽ — nút không chui dưới thẻ
    const k = canvas.getBoundingClientRect(), t = $("ben-phai").getBoundingClientRect();
    if (t.height && x + bw / 2 > t.left - k.left && x - bw / 2 < t.right - k.left) yMax = Math.min(yMax, t.top - k.top - 26);
  }
  const y = Math.round(Math.min(Math.max(30, yMax), Math.max(30, py)));
  if (x === NN.x && y === NN.y) return;
  NN.x = x; NN.y = y;
  NUT_NOI.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  if (MENU_NOI && !MENU_NOI.hidden) datViTriMenuNoi();
}
function bamNutNoi() {
  if (!NN.cm) return false;
  if (!NN.lc) { MENU_NOI.hidden ? moMenuNoi() : dongMenuNoi(); return true; }
  apCongTac(NN.cm, NN.lc.nhan);
  return true;
}
function apCongTac(cm, nhan) {
  NUT_NOI?.classList.add("dang-doi");                                 // trượt theo phần chuyển động tới chỗ mới
  clearTimeout(apCongTac.hen); apCongTac.hen = setTimeout(() => NUT_NOI?.classList.remove("dang-doi"), 450);
  datChonMot(cm, nhan, true);
  doiTrangThai();
}
/* sau mọi lần đổi thế (nút nổi, thẻ, menu): dựng lại lớp + Trạng thái, hiện/ẩn, rồi giữ chọn ở đúng bộ phận ấy ở thế mới */
function doiTrangThai() { dungLop(GOC.userData.nhom || []); capNhatHien(); toMach(); giuChon(); THUOC_CUM.ve(); veLai(300); }
function giuChon() {
  if (!chon) { hienThongTin(); return; }
  let o = chon;
  if (!hienDuoc(o)) {
    const k = tenBP(o.userData.ten), c = CUM_CHON;
    o = (c && (c.ds.find((x) => hienDuoc(x) && tenBP(x.userData.ten) === k) || c.ds.find((x) => hienDuoc(x) && thanTT(x.userData.ten) === thanTT(chon.userData.ten))
      || c.ds.find(hienDuoc))) || PHAN.find((x) => x.isMesh && hienDuoc(x) && tenBP(x.userData.ten) === k) || null;
  }
  datChon(o, true);
}
function moMenuNoi() {
  const cm = NN.cm; if (!cm) return;
  MENU_NOI.replaceChildren();
  const da = new Set();
  for (const lc of cm.lua_chon) {
    if (da.has(lc.nhan)) continue; da.add(lc.nhan);
    const b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "menuitemradio");
    b.setAttribute("aria-checked", String(CHON_MOT.get(cm.ma) === lc.nhan)); b.textContent = lc.nhan;
    b.onclick = (e) => { e.stopPropagation(); dongMenuNoi(); apCongTac(cm, lc.nhan); };
    MENU_NOI.append(b);
  }
  MENU_NOI.onkeydown = phimMenuNoi;
  MENU_NOI.hidden = false; NUT_NOI.setAttribute("aria-expanded", "true");
  datViTriMenuNoi();
  (MENU_NOI.querySelector('[aria-checked="true"]') || MENU_NOI.firstChild)?.focus({ preventScroll: true });
}
function datViTriMenuNoi() {
  const w = canvas.clientWidth, h = canvas.clientHeight, mw = MENU_NOI.offsetWidth, mh = MENU_NOI.offsetHeight;
  const x = Math.min(w - mw - 8, Math.max(8, NN.x - mw / 2));
  const y = NN.y + 30 + mh < h - 8 ? NN.y + 30 : Math.max(8, NN.y - 30 - mh);
  MENU_NOI.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}
function dongMenuNoi(veNut) {
  if (!MENU_NOI || MENU_NOI.hidden) return false;
  const dangTrong = MENU_NOI.contains(document.activeElement);
  MENU_NOI.hidden = true; NUT_NOI?.setAttribute("aria-expanded", "false");
  if (veNut || dangTrong) NUT_NOI?.focus({ preventScroll: true });       // tiêu điểm về nút đã mở trình đơn
  return true;
}
/* bàn phím trong trình đơn nổi (role=menu): ↑ ↓ Home End chuyển mục, Esc đóng về nút, Tab đóng */
function phimMenuNoi(e) {
  const ds = [...MENU_NOI.querySelectorAll('[role="menuitemradio"]')];
  const i = ds.indexOf(document.activeElement);
  const toi = { ArrowDown: (i + 1) % ds.length, ArrowUp: (i - 1 + ds.length) % ds.length, Home: 0, End: ds.length - 1 }[e.key];
  if (toi !== undefined && ds.length) { e.preventDefault(); e.stopPropagation(); ds[toi].focus({ preventScroll: true }); }
  else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); dongMenuNoi(true); }
  else if (e.key === "Tab") dongMenuNoi();
}
MOI_KHUNG.push(viTriNutNoi);

/* ── CHI TIẾT CỤM (chủ nhà 2026-10-21): khung nhìn chỉ còn cụm đang chọn, camera vừa nó; ✕ về lại đúng như trước
   (camera, thứ đang hiện, mặt cắt, tách lớp, làm nổi, vật đang chọn). Trái: danh sách bộ phận (gộp bộ phận cùng tên + cùng cỡ,
   «lá lam ×25»); chạm một dòng ⇒ bộ phận ấy tô cam + bảng phải nói về nó (‹ Cả cụm để về). Phải: thông tin cả cụm. Công cụ
   duy nhất: công tắc «Thước». Điện thoại: danh sách và thông tin là MỘT tấm dưới khung vẽ (hai thẻ), không che mô hình. */
var CT = { mo: false, cum: null, phan: null, nhom: null, luu: null, thuoc: true, the: "tt", cao: false, lan: 0 };
try { CT.thuoc = localStorage.getItem("xem:thuoc_cum") !== "0"; } catch { /* không có kho */ }
function dungKhungCT() {
  if ($("ct-dau")) return;
  const app = document.querySelector(".app");
  const dau = document.createElement("header"); dau.id = "ct-dau"; dau.className = "ct-dau";
  dau.innerHTML = `<button type="button" id="ct-dong" class="ct-dong" aria-label="Đóng chi tiết, về lại cả nhà (Esc)" title="Về lại cả nhà (Esc)">✕</button>
    <div class="ct-tieu"><p class="nhom-cua" id="ct-nhom"></p><h1 id="ct-ten"></h1></div>
    <label class="ct-thuoc" title="Thước kích thước cả cụm và bộ phận đang chọn (phím M)"><span>Thước</span><input type="checkbox" id="ct-thuoc" role="switch"></label>`;
  const the = document.createElement("div"); the.id = "ct-the"; the.className = "ct-the";
  the.innerHTML = `<button type="button" class="ct-keo" aria-label="Mở rộng tấm" aria-expanded="false" aria-controls="ct-trai ct-phai"><span></span></button>
    <div class="ct-the-nut" role="tablist" aria-label="Chi tiết"><button type="button" role="tab" data-the="ds" aria-controls="ct-trai">Bộ phận</button><button type="button" role="tab" data-the="tt" aria-controls="ct-phai">Thông tin</button></div>`;
  const trai = document.createElement("aside"); trai.id = "ct-trai"; trai.className = "ben trai ct-ben";
  trai.innerHTML = `<h2>Bộ phận <span class="dem" id="ct-dem"></span></h2><ul id="ct-ds" class="ct-ds" aria-label="Bộ phận của cụm"></ul>`;
  const phai = document.createElement("aside"); phai.id = "ct-phai"; phai.className = "ben phai ct-ben"; phai.setAttribute("aria-live", "polite");
  app.append(dau, the, trai, phai);
  $("ct-dong").onclick = () => dongChiTiet();
  $("ct-thuoc").onchange = (e) => datThuocCT(e.target.checked);
  for (const b of the.querySelectorAll("[data-the]")) b.onclick = () => datTheCT(b.dataset.the);
  const keo = the.querySelector(".ct-keo");
  const datCao = (cao) => { CT.cao = cao; document.body.classList.toggle("ct-cao", cao); keo.setAttribute("aria-expanded", String(cao));
    keo.setAttribute("aria-label", cao ? "Thu gọn tấm" : "Mở rộng tấm"); veLai(300); };
  keo.onclick = () => datCao(!CT.cao);
  // kéo tay nắm lên / xuống (≥ 24 px) cũng đổi độ cao, như tấm dưới của iOS
  let y0 = null;
  keo.addEventListener("pointerdown", (e) => { y0 = e.clientY; keo.setPointerCapture?.(e.pointerId); });
  keo.addEventListener("pointerup", (e) => { if (y0 != null && Math.abs(e.clientY - y0) >= 24) { datCao(e.clientY < y0); keo.dataset.keo = "1"; } y0 = null; });
  keo.addEventListener("click", (e) => { if (keo.dataset.keo) { delete keo.dataset.keo; e.stopImmediatePropagation(); } }, true);
}
function datTheCT(t) {
  CT.the = t; document.body.dataset.ct = t;
  for (const b of document.querySelectorAll("#ct-the [data-the]")) b.setAttribute("aria-selected", String(b.dataset.the === t));
}
function datThuocCT(bat) {
  CT.thuoc = !!bat;
  try { localStorage.setItem("xem:thuoc_cum", bat ? "1" : "0"); } catch { /* không có kho */ }
  if ($("ct-thuoc")) $("ct-thuoc").checked = CT.thuoc;
  THUOC_CUM.ve(); veLai(60);
}
/* camera vừa một nhóm vật, giữ hướng nhìn đang có; màn đứng (điện thoại) lấy góc ngang hẹp hơn */
function khungVuaGon(ds, xa = 1.15) {
  const b = hopCum(ds);
  if (b.isEmpty()) return;
  const tam = m2w(...b.getCenter(new THREE.Vector3()).toArray());
  const r = Math.max(b.getSize(new THREE.Vector3()).length() / 2, 0.15);
  const nua = Math.min(THREE.MathUtils.degToRad(camera.fov / 2), Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
  const d = camera.position.clone().sub(controls.target).normalize();
  const kc = r / Math.sin(nua) * xa;
  const c = tam.clone().addScaledVector(d, kc);
  // bay tới (chuyển động nối hai cảnh, ~0,45 s; «giảm chuyển động» thì đặt thẳng)
  return bayToi(`c=${f3(w2m(c))};t=${f3(w2m(tam))}`, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.45);
}
/* dừng quán tính của OrbitControls (phần xoay còn dư được áp hết rồi xoá) — trước khi đặt camera cố định */
function dungQuanTinh() { const d = controls.enableDamping; controls.enableDamping = false; controls.update(); controls.enableDamping = d; }
function moChiTiet() {
  taiSanPham();                                                     // thẻ «Sản phẩm» (san-pham.json) — tải sẵn trước khi vẽ bảng
  const c = CUM_CHON;
  if (!c || CT.mo) return;
  dungQuanTinh();
  dungKhungCT(); dongMenuPa();
  const catMo = !$("bang-cat").hidden;
  CT.luu = { c: camera.position.clone(), t: controls.target.clone(), near: camera.near, rieng, chon, noi: NOI_BAT, tach: tachKhe,
    cat: catMo ? { truc: trucCat, m: catMHien, dao: $("cat-dao").checked, san: catSanDang } : null };
  CT.mo = true; CT.cum = c; CT.phan = null; CT.nhom = null;
  rieng = new Set(c.ds.map((o) => o.userData.id));
  if (NOI_BAT) { NOI_BAT = null; apMo(); }
  if (catMo) { catSanDang = -1; batCat(false); }
  if (tachKhe) tachLop(0);
  capNhatHien();
  document.body.classList.add("xem-chi-tiet");
  document.body.classList.remove("co-chon");                         // bản đăng: thẻ nổi nhường chỗ cho tấm chi tiết
  datTheCT(matchMedia("(max-width: 820px)").matches ? "tt" : CT.the);
  $("ct-thuoc").checked = CT.thuoc;
  datNutNoi(); veChiTiet();
  // bố cục đổi (thanh, hai ô bên) ⇒ khung vẽ đổi cỡ: khung vừa SAU khi trình xem đo lại
  // đóng trước khi hai khung này chạy (soát Opus vòng 3) ⇒ thôi, không bay camera về cụm đè lên góc vừa trả lại
  const so = ++CT.lan;
  requestAnimationFrame(() => requestAnimationFrame(() => { if (!CT.mo || so !== CT.lan) return; coLai(); khungVuaGon(c.ds); THUOC_CUM.ve(); veLai(300); }));
  $("ct-dong").focus({ preventScroll: true });
}
function dongChiTiet(khoi = true) {
  if (!CT.mo) return;
  const L = CT.luu;
  CT.mo = false; CT.cum = null; CT.phan = null; CT.nhom = null;
  document.body.classList.remove("xem-chi-tiet", "ct-cao"); CT.cao = false;
  dongMenuNoi(); dongMenuPa();
  rieng = L.rieng; NOI_BAT = L.noi;
  capNhatHien(); apMo();
  THUOC_CUM.ve();
  if (L.cat) { if (L.cat.san >= 0 && matCatSan().length) { batCat(true); catSan(L.cat.san); } else if (L.cat.m != null) catTaiM(L.cat.truc, L.cat.m, L.cat.dao); }
  if (L.tach) tachLop(L.tach);
  if (khoi) {
    cancelAnimationFrame(bayRaf);                    // camera đang bay vào cụm (khungVuaGon) thì dừng — không đè góc trả lại
    dungQuanTinh();
    const datLai = () => { camera.position.copy(L.c); controls.target.copy(L.t); camera.near = L.near; camera.updateProjectionMatrix(); controls.update(); veLai(60); };
    datLai();
    datChon(L.chon && L.chon.isMesh ? L.chon : chon, false);
    giuChon();
    requestAnimationFrame(() => { coLai(); veLai(300); });
    $("tt-chi-tiet")?.focus({ preventScroll: true });
  }
  veLai(300);
}
/* bộ phận của cụm: vật đang hiện gộp theo tên bộ phận (bỏ phần đầu chung của cả cụm, bỏ thế «(đóng)», bỏ số thứ tự cuối) + cỡ */
function nhomPhan(c) {
  const hien = c.ds.filter(hienDuoc);
  const doan = (o) => boTang(o.userData.ten).split(" — ").map(boNgoac).filter(Boolean);
  const ds = hien.map(doan);
  let chung = ds[0] ? ds[0].length - 1 : 0;
  for (const d of ds) { let k = 0; while (k < chung && k < d.length - 1 && d[k] === ds[0][k]) k++; chung = k; }
  // gộp theo tên bỏ số thứ tự cuối («lá lam 1…11» → «lá lam ×11»); cùng tên mà khác cỡ thì tách theo cỡ, giữ số thứ tự
  const theoTen = new Map();
  hien.forEach((o, i) => {
    const d = ds[i], du = d.slice(Math.min(chung, d.length - 1)).join(" — ") || boTang(o.userData.ten);
    const m = du.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)$/);
    let ten = m ? m[1] : du;
    if (boDau(ten).startsWith(boDau(c.ten) + " — ")) ten = ten.slice(c.ten.length + 3);   // «Cửa ra ban công D13 — bệ…» → «Bệ…»
    ten = hoa(ten);
    if (!theoTen.has(ten)) theoTen.set(ten, []);
    theoTen.get(ten).push({ o, so: m ? m[2] : "", co: coChu(hopVat(o)) });
  });
  const ra = [];
  for (const [ten, xs] of theoTen) {
    const coDs = new Map(); for (const x of xs) { if (!coDs.has(x.co)) coDs.set(x.co, []); coDs.get(x.co).push(x); }
    for (const [co, ys] of coDs) {
      const so = coDs.size > 1 ? ys.map((y) => y.so).filter(Boolean).join(", ") : "";
      const t = so ? `${ten} ${so}` : ten, vs = ys.map((y) => y.o);
      ra.push({ khoa: t + "|" + co, ten: t, co, ds: vs, dong: vs.some((o) => congTacCuaVat(o.userData).some((cm) => !laPaCT(cm))) });
    }
  }
  return ra.sort((a, b) => (b.dong - a.dong) || a.ten.localeCompare(b.ten, "vi", { numeric: true }));
}
function nhomPhanCua(o) {
  if (!CT.mo) return null;
  if (!CT.nhom) CT.nhom = nhomPhan(CT.cum);
  return CT.nhom.find((g) => g.ds.includes(o))?.khoa || null;
}
function chonPhanCT(khoa) {
  if (!CT.mo) return;
  CT.nhom = nhomPhan(CT.cum);
  const g = khoa ? CT.nhom.find((x) => x.khoa === khoa) : null;
  CT.phan = g ? g.khoa : null;
  chon = g ? g.ds[0] : chon;
  datNutNoi(); veChiTiet(); THUOC_CUM.ve();
  if (g && matchMedia("(max-width: 820px)").matches) datTheCT("tt");
  for (const f of KHI_CHON) f(chon);
  veLai(60);
}
function hangSo(dl, k, v, mono = true) {
  const dt = document.createElement("dt"), dd = document.createElement("dd");
  dt.textContent = k; dd.textContent = v; if (mono) dd.className = "mono"; dl.append(dt, dd);
}
/* ── SẢN PHẨM (chủ nhà 2026-10-23: «select Details can see the info model of that device … model to buy, the type tile,
   id and images in real life»): mo-hinh/san-pham.json — luật data/san-pham-3d.yaml giải ra mã vật (tools/3d/san_pham.py,
   máy qua xem.py, site lúc đóng gói). Một vật ⇒ một hay vài thẻ: mã · loại · hãng · mẫu cần mua · quy cách · ảnh thật. */
const SP = { theoVat: null, hua: null };
function taiSanPham() {
  if (!SP.hua) SP.hua = fetch("mo-hinh/san-pham.json").then((r) => (r.ok ? r.json() : { san_pham: [] }))
    .catch(() => ({ san_pham: [] })).then((d) => {
      SP.theoVat = new Map();
      for (const s of d.san_pham || []) for (const id of s.vat) {
        if (!SP.theoVat.has(id)) SP.theoVat.set(id, []);
        SP.theoVat.get(id).push(s);
      }
      if (CT.mo) veChiTiet();
    });
  return SP.hua;
}
function sanPhamCua(ds) {
  if (!SP.theoVat) { taiSanPham(); return []; }
  const ra = new Map();
  for (const o of ds) for (const s of SP.theoVat.get(o.userData.id) || []) ra.set(s.ma, s);
  return [...ra.values()];
}
function veSanPham(k, ds) {
  const sps = sanPhamCua(ds);
  if (!sps.length) {
    // chưa có thẻ: nói ra thay vì lặng lẽ bỏ mục (soát #37) — thẻ mới thêm ở data/san-pham-3d.yaml, đếm bằng san_pham.py
    if (SP.theoVat) { const p = document.createElement("p"); p.className = "mo sp-chua"; p.textContent = "Chưa có thẻ sản phẩm cho bộ phận này."; k.append(p); }
    return;
  }
  const h3 = document.createElement("h3"); h3.textContent = sps.length > 1 ? `Sản phẩm · ${sps.length}` : "Sản phẩm"; k.append(h3);
  for (const s of sps) {
    const the = document.createElement("div"); the.className = "sp-the";
    if (s.anh.length) {
      const hang = document.createElement("div"); hang.className = "sp-anh";
      for (const a of s.anh) {
        const ln = document.createElement("a"); ln.href = a.tep; ln.target = "_blank"; ln.rel = "noopener";
        ln.title = a.ghi || s.ten || "";
        const im = document.createElement("img"); im.src = a.tep; im.alt = a.ghi || s.ten || ""; im.loading = "lazy";
        ln.append(im); hang.append(ln);
      }
      the.append(hang);
    }
    const dl = document.createElement("dl"); dl.className = "so";
    hangSo(dl, "Mã", s.ma);
    for (const [kk, nh] of [["loai", "Loại"], ["ten", "Tên"], ["hang", "Hãng"], ["model", "Mẫu cần mua"], ["quy_cach", "Quy cách"],
      ["cach_lat", "Cách lát"], ["trang_thai", "Trạng thái"]]) if (s[kk]) hangSo(dl, nh, s[kk], kk === "model" && s[kk].length < 32);
    the.append(dl);
    if (s.ghi) { const p = document.createElement("p"); p.className = "mo"; p.textContent = s.ghi; the.append(p); }
    if (s.lien_ket) {
      const a = document.createElement("a"); a.href = s.lien_ket; a.target = "_blank"; a.rel = "noopener"; a.className = "sp-lk";
      a.textContent = "Trang sản phẩm ↗"; the.append(a);
    }
    k.append(the);
  }
}
/* BẢNG CHI TIẾT xếp theo thứ chủ nhà đọc (chủ nhà 3D #31, 2026-10-23): TÊN (đầu tấm / đầu mục) → CÔNG DỤNG → sản phẩm
   (ảnh thật) → thông số → trạng thái → quy cách; khối hệ thống điện · mạng · nhà thông minh GẤP SẴN ở cuối. Công dụng: vai
   trò trong bảng điện (he_thong.js congDung), không thì `cong_dung` của thẻ sản phẩm (data/san-pham-3d.yaml). */
function congDungCT(k, ds, truoc = []) {
  // nhiều thẻ khớp (cửa + khoá + bản lề của nó): thẻ phủ NHIỀU vật đang xem nhất, hoà thì thẻ HẸP nhất — cả cụm cửa nói về
  // cửa, bộ phận khoá nói về khoá
  const id = new Set(ds.map((o) => o.userData.id)), phu = (s) => s.vat.filter((x) => id.has(x)).length;
  const cd = tomTat(chon && ds.includes(chon) ? [chon, ...ds] : ds) || HE_THONG.congDung(ds) || sanPhamCua(ds).filter((s) => s.cong_dung)
    .sort((a, b) => phu(b) - phu(a) || a.vat.length - b.vat.length)[0]?.cong_dung || "";
  k.append(...truoc);
  if (cd) { const p = document.createElement("p"); p.className = "ct-cong-dung"; p.textContent = hoa(cd); k.append(p); }
  return cd;
}
function veMucQC(k, tieu, qc, cd) {
  const tam = document.createElement("div"); veQuyCach(qc, tam, cd);
  if (!tam.childElementCount) return;
  const h3 = document.createElement("h3"); h3.textContent = tieu; k.append(h3, ...tam.childNodes);
}
/* điện của vật đang chọn trong bảng Chi tiết: dòng mạch + chuỗi «Nguồn điện» (chủ nhà 3D #44: dời khỏi thẻ nhỏ) */
function veDienCT(k) {
  const m = machChu();
  if (m) { const p = document.createElement("p"); p.className = "mo"; p.textContent = m; k.append(p); }
  if (NGUON_CT) k.append(NGUON_CT);
}
function veHeThongCT(k, ds) {
  const tam = document.createElement("div"); HE_THONG.chiTiet(tam, ds);
  if (!tam.childElementCount) return;
  const d = document.createElement("details"), s = document.createElement("summary");
  d.className = "ct-he-thong"; s.textContent = "Điện · mạng · nhà thông minh";
  d.append(s, ...tam.childNodes); k.append(d);
}
function veChiTiet() {
  if (!CT.mo || !$("ct-dau")) return;
  const c = CT.cum;
  CT.nhom = nhomPhan(c);
  if (CT.phan && !CT.nhom.some((g) => g.khoa === CT.phan)) {             // đổi thế: bộ phận ấy đổi tên/cỡ ⇒ tìm lại theo vật đang chọn
    CT.phan = chon ? CT.nhom.find((g) => g.ds.includes(chon))?.khoa || null : null;
  }
  $("ct-nhom").textContent = phuDeCum(c);
  $("ct-ten").textContent = c.ten;
  $("ct-dem").textContent = CT.nhom.reduce((s, g) => s + g.ds.length, 0);
  // danh sách bộ phận
  const ul = $("ct-ds"); ul.replaceChildren();
  for (const g of CT.nhom) {
    const li = document.createElement("li");
    const b = document.createElement("button"); b.type = "button"; b.className = "ct-muc" + (g.dong ? " dong" : "");
    b.setAttribute("aria-pressed", String(g.khoa === CT.phan));
    b.innerHTML = `<span class="ct-muc-ten"></span><span class="ct-muc-co mono"></span>`;
    b.firstChild.textContent = g.ten + (g.ds.length > 1 ? ` ×${g.ds.length}` : "");
    b.lastChild.textContent = g.co.replace(" mm", "");
    if (g.dong) b.title = "Bộ phận chuyển động — chạm để chọn rồi dùng nút nổi trên mô hình";
    b.onclick = () => chonPhanCT(g.khoa === CT.phan ? null : g.khoa);
    li.append(b); ul.append(li);
  }
  // bảng phải
  const k = document.createElement("div"); k.id = "ct-tt";
  const g = CT.phan ? CT.nhom.find((x) => x.khoa === CT.phan) : null;
  if (g) {
    const lui = document.createElement("button"); lui.type = "button"; lui.className = "ct-lui"; lui.textContent = "‹ Cả cụm";
    lui.onclick = () => chonPhanCT(null);
    const h = document.createElement("h2"); h.textContent = g.ten + (g.ds.length > 1 ? ` ×${g.ds.length}` : "");
    const u = g.ds[0].userData, b = hopCum(g.ds.slice(0, 1));
    const dl = document.createElement("dl"); dl.className = "so";
    hangSo(dl, "Vật liệu", u.vat_lieu_ten || u.vat_lieu || "—", false);
    hangSo(dl, "Rộng × dày × cao", g.co);
    hangSo(dl, "Cao độ", caoDoSan(b));
    const cd = congDungCT(k, g.ds, [lui, h]);
    veSanPham(k, g.ds);
    k.append(dl);
    veHangCT(k, [...new Set(g.ds.flatMap((o) => congTacCuaVat(o.userData)).filter((cm) => !laPaCT(cm)))]);
    if (u.quy_cach) veMucQC(k, "Quy cách", u.quy_cach, cd);
    if (u.khop_voi) {
      const d = document.createElement("details"), s = document.createElement("summary"), p = document.createElement("p");
      s.textContent = "Cố ý giao với"; p.textContent = u.khop_voi.split("|").join(" · "); d.append(s, p); k.append(d);
    }
    const tk = document.createElement("div"); k.append(tk); oThuoc(u, tk);
    veDienCT(k);
    veHeThongCT(k, g.ds);
  } else {
    const cd = congDungCT(k, c.ds);
    veSanPham(k, c.ds);
    const dl = document.createElement("dl"); dl.className = "so";
    const vl = vatLieuCum(c.ds), b = hopChuan(c.ds), bh = hopCum(c.ds);
    hangSo(dl, "Vật liệu", vl.join(" · ") || "—", false);
    if (!b.isEmpty()) {
      const [r, d, z] = soCo(b);
      hangSo(dl, "Rộng × dày × cao", `${mm(r)} × ${mm(d)} × ${mm(z)} mm`);
      // thế đang xem (cánh mở, rèm thả) chiếm chỗ khác cỡ chế tạo ⇒ ghi thêm, không thay
      if (!bh.isEmpty() && !trungHop(b, bh)) hangSo(dl, "Thế đang xem chiếm", coChu(bh));
      hangSo(dl, "Cao độ", caoDoSan(b));
      if (sanCuaHop(b)) hangSo(dl, "Cao độ tuyệt đối", `đáy +${m3(b.min.z)} · đỉnh +${m3(b.max.z)} m từ mặt vỉa hè`);
      hangSo(dl, "Vị trí ngang", `${m3(b.min.x)} → ${m3(b.max.x)} m về phía Tây Nam`);
      hangSo(dl, "Vị trí dọc", `${m3(b.min.y)} → ${m3(b.max.y)} m vào trong nhà`);
    }
    k.append(dl);
    const goc = document.createElement("p"); goc.className = "mo tt-goc";
    goc.textContent = "Vị trí tính từ góc lô mặt tiền phía Đông Bắc (mốc 1 trên sổ đỏ); cao độ tính từ mặt vỉa hè ±0.";
    k.append(goc);
    veHangCT(k, c.cms);
    const dk = document.createElement("div"); dk.className = "ct-dk"; veDieuKhien(dk); if (dk.childElementCount) k.append(dk);
    void cd;
    veDienCT(k);
    veHeThongCT(k, chon && c.ds.includes(chon) ? [chon, ...c.ds.filter((o) => o !== chon)] : c.ds);
  }
  const phai = $("ct-phai"), cu = phai.querySelector("#ct-tt");
  const cuon = phai.scrollTop;
  if (cu) cu.replaceWith(k); else phai.append(k);
  if (g === (veChiTiet.cuoi || null)) phai.scrollTop = cuon;
  veChiTiet.cuoi = g;
}
/* dòng công tắc trạng thái trong bảng chi tiết (gạt hai thế, dãy nút nhiều thế) */
function veHangCT(k, cms) {
  if (!cms.length) return;
  const h3 = document.createElement("h3"); h3.textContent = "Trạng thái"; k.append(h3);
  const ds = document.createElement("div"); ds.className = "ct-cong-tac";
  for (const cm of cms) {
    const h = document.createElement("div"); h.className = cm.lua_chon.length > 2 ? "hang-cm doc" : "hang-cm";
    const t = document.createElement("span"); t.textContent = hoa(cm.nhan.replace(/^Tầng [^·—]+?\s*[·—]\s*/, ""));
    h.append(t, nutCongTac(cm, () => doiTrangThai()));
    ds.append(h);
    const mt = moTaChonMot(cm, "ct-" + cm.ma); if (mt) ds.append(mt);
  }
  k.append(ds);
}

/* ── VIỀN CỤM + RÊ CHUỘT + TẬP TRUNG (chủ nhà 2026-10-21: «viền màu quanh cả cụm, không tô đặc»; học Jig cùng ngày:
   «tô nhẹ + viền đậm hơn cho vật rê chuột và vật đang chọn», «chọn vật ⇒ mọi thứ khác mờ dần về nền như chuyển cảnh — không
   đổi vật liệu, chỉ phần nền») ───────────────────────────────────────────────────────────────────────────────────────
   Sau lượt vẽ chính: vẽ riêng cụm đang CHỌN (lớp camera 3) và cụm đang RÊ (lớp 4) vào hai bộ đệm mặt nạ (vật liệu trắng phẳng,
   độ sâu riêng); một tấm phủ màn hình rồi chồng ba lớp, dưới lên:
     1. TẬP TRUNG — điểm ảnh nào KHÔNG phải phần nhìn thấy của cụm chọn thì phủ màu nền, độ phủ mờ dần 0 → 0,72 (0,5 s) khi chọn,
        về 0 (0,35 s) khi bỏ chọn; vật liệu, ánh sáng, vật khác không đổi gì.
     2. TÔ NHẸ — chỉ cụm rê ánh màu nhấn 9 %; cụm chọn KHÔNG tô (chủ nhà 2026-10-25: «chỉ cần viền»).
     3. VIỀN — ngoài bóng cụm, mép mềm: chọn dày 1,75 điểm ảnh CSS, rê 1 (mờ dần vào 0,12 s, ra 0,25 s như Jig); phần viền mà cụm bị vật
        khác che (so độ sâu mặt nạ với độ sâu cảnh của lượt NET) vẽ nhạt hơn, để vẫn thấy cửa nằm sau tường.
   Không có lượt NET (?vien=0) thì coi như mọi phần đều thấy. Chỉ chạy khi có gì để vẽ; không cấp phát mỗi khung.
   Thứ vẽ SAU lớp này (đường báo chuyển thế — không bị phủ nền): XEM.veSau(f) — f(renderer, camera). */
/* CHẾ ĐỘ SỬA (chủ nhà 2026-10-30: «1 button, click it will enable the edit mode where we can move around and interact like
   open, close parts of object right on the 3d view»): chọn vật ở chế độ XEM chỉ có viền — không nút theo ngữ cảnh (nút công
   tắc, hàng nút dời đồ), không đường báo chuyển thế, phần còn lại của nhà giữ nguyên. Bật chế độ sửa (nút «Sửa», phím E) thì
   chọn vật như trước: nhà mờ về nền quanh cụm chọn (tập trung), nút công tắc + đường báo, dời · xoay · nâng hạ · bỏ đồ.
   Khung nhúng trang việc (không soạn) luôn ở chế độ sửa — nút công tắc của nó là việc chính (chủ nhà 2026-10-29). */
let CHE_DO_SUA = false;
const KHI_DOI_SUA = [];
const cheDoSua = () => CHE_DO_SUA || (document.body.classList.contains("nhung") && !document.body.classList.contains("nhung-sua"));
const VE_SAU = new Set();
const VIEN_CUM = (() => {
  const LOP = 3, LOP_RE = 4, LOP_NOI = 5;
  let ds = null, dsRe = null, dsNoi = null, giuMo = null;              // giuMo: mặt nạ cụm vừa bỏ chọn — giữ tới khi nền hết phủ
  /* MẶT NẠ KHỬ RĂNG CƯA (chủ nhà 2026-10-21: «viền độ phân giải thấp quá, làm mịn hơn»): mặt nạ trắng vẽ không MSAA thì mỗi
     điểm ảnh chỉ 0 hoặc 1 ⇒ mép viền là bậc thang theo lưới điểm ảnh, rồi trình duyệt phóng khung vẽ 1,5× lên màn 2–3× làm bậc
     to thêm. MSAA 4 (aa) cho độ phủ thật 0…1 ở mép — viền tính khoảng cách tới mép từ độ phủ đó (xem vien()). Không tăng độ
     phân giải khung vẽ: trần 1,5× ở trên là số đo bộ nhớ / thời gian GPU. */
  const matNa = (mau, stencil = false, aa = false) => {
    const dt = stencil ? new THREE.DepthTexture(1, 1, THREE.UnsignedInt248Type) : new THREE.DepthTexture(1, 1);
    if (stencil) dt.format = THREE.DepthStencilFormat;  // có stencil: nắp mặt cắt riêng của cụm chọn (xem dưới)
    return new THREE.WebGLRenderTarget(1, 1, { depthTexture: dt, depthBuffer: true, stencilBuffer: stencil, samples: aa ? 4 : 0,
      type: mau ? THREE.HalfFloatType : THREE.UnsignedByteType });
  };
  /* NẮP CẮT TRONG MẶT NẠ (soát trình duyệt 2026-10-21): có mặt cắt thì cụm chọn bị khoét hở — mặt nạ nhìn xuống thấy lòng trong
     (mặt đáy, sâu hơn) còn cảnh thấy nắp cắt ở mặt phẳng ⇒ cụm bị coi là «bị che»: viền nhạt, soi xuyên tô đè. Đếm stencil mặt
     sau (+) / mặt trước (−) của riêng cụm rồi tô một tấm phẳng trên mặt cắt chỗ stencil ≠ 0 — đúng mẹo nắp của cảnh. */
  const vlDem = [THREE.BackSide, THREE.FrontSide].map((side, i) => new THREE.MeshBasicMaterial({ side, colorWrite: false, depthWrite: false,
    depthTest: false, stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc,
    stencilZPass: i ? THREE.DecrementWrapStencilOp : THREE.IncrementWrapStencilOp, stencilZFail: i ? THREE.DecrementWrapStencilOp : THREE.IncrementWrapStencilOp,
    stencilFail: i ? THREE.DecrementWrapStencilOp : THREE.IncrementWrapStencilOp }));
  // ShaderMaterial (clipping mặc định TẮT) như nắp của cảnh: tấm nằm ĐÚNG trên mặt cắt — vật liệu thường bị chính mặt cắt xén
  // lởm chởm khi cắt xiên (soát Codex vòng 4)
  const napMN = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ side: THREE.DoubleSide,
    // cùng thang độ sâu với cảnh khi ?logz=1 (khối logdepthbuf như vlNap)
    vertexShader: "#include <common>\n#include <logdepthbuf_pars_vertex>\nvoid main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n#include <logdepthbuf_vertex>\n}",
    fragmentShader: "#include <logdepthbuf_pars_fragment>\nvoid main(){\n#include <logdepthbuf_fragment>\ngl_FragColor = vec4(1.0); }",
    stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc }));
  napMN.frustumCulled = false;
  const canhNap = new THREE.Scene(); canhNap.add(napMN);
  // bóng trắng ĐẶC (độ phủ + độ sâu — kính trong cụm vẫn ghi độ sâu, soát Codex) cho cụm chọn và cụm rê; màu thật của cụm
  // chọn vẽ riêng, chỉ khi đang tập trung, chỉ để soi xuyên
  const rt = matNa(false, true, true), rtRe = matNa(false, true, true), rtMau = matNa(true), rtNoi = matNa(false, true, true);   // rê cũng nắp cắt (cùng hàm vẽ) — bản màu thì không
  // không có lượt NET (?vien=0): tự vẽ độ sâu cả cảnh — không thì vật che (tường trước cửa) bị coi là cụm, tô màu
  // và không mờ (soát Codex #11 + trình duyệt #7). Chỉ chạy khi có cụm chọn / rê.
  const rtCanh = matNa(false), vlSau = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });   // hai mặt: vật thấy mặt sau vẫn ghi độ sâu
  const vlMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const vl = new THREE.ShaderMaterial({
    uniforms: { tMat: { value: rt.texture }, tMau: { value: rtMau.texture }, tSauMat: { value: rt.depthTexture }, tRe: { value: rtRe.texture }, tSauRe: { value: rtRe.depthTexture },
      tNoi: { value: rtNoi.texture }, tSauNoi: { value: rtNoi.depthTexture }, uCoNoi: { value: 0 }, uRNoi: { value: 2.5 },
      tSau: { value: null }, uCoSau: { value: 0 }, uBuoc: { value: new THREE.Vector2() }, uR: { value: 1.75 }, uRRe: { value: 1 },
      uMau: { value: new THREE.Color(0x2563eb) }, uNen: { value: new THREE.Color(0xf7f6f2) },
      uChon: { value: 0 }, uRe: { value: 0 }, uMo: { value: 0 }, uCoChon: { value: 0 }, uCoRe: { value: 0 }, uPhu: { value: 0.72 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `
      uniform sampler2D tMat, tMau, tSauMat, tRe, tSauRe, tNoi, tSauNoi, tSau; uniform float uCoSau, uR, uRRe, uRNoi, uChon, uRe, uMo, uCoChon, uCoRe, uCoNoi, uPhu; uniform vec2 uBuoc;
      uniform vec3 uMau, uNen;
      varying vec2 vUv;
      // điểm mép mặt nạ MSAA phủ một phần: độ sâu đã gộp có thể là giá trị xoá (1) ⇒ đừng coi là «bị che»
      float thay(sampler2D sau, vec2 p) { float z = texture2D(sau, p).x; return uCoSau < 0.5 || z > 0.999999 ? 1.0 : step(z, texture2D(tSau, p).x + 2e-6); }
      // viền ngoài bóng mặt nạ: x = có viền, y = phần viền nhìn thấy (không bị che)
      // VIỀN MƯỢT (chủ nhà 2026-10-21 «viền thô quá»; 2026-10-22 «this level of aliasing is too much»): viền = mặt nạ NỞ RA
      // bằng làm mờ Gauss. Bản cũ dò 16 hướng × 4 khoảng rồi lấy max — mép viền bám vào vị trí mẫu nên răng cưa, lượn sóng
      // (đo ở màn 2×). Nay: B = mặt nạ (độ phủ MSAA) chập Gauss σ = r/2 trên lưới điểm ảnh trong 3σ; mép viền là đường đồng
      // mức B = Φ(−2) (= cách mép vật đúng 2σ = r trên cạnh thẳng); khử răng cưa theo GRADIENT CHÍNH XÁC của B (đạo hàm nhân
      // Gauss, không dùng fwidth — có nhánh thoát sớm) ⇒ mép viền liên tục, mịn 1 điểm ảnh ở mọi góc nghiêng; góc bo tròn.
      vec2 vien(sampler2D m, sampler2D sau, float r) {
        float sg = clamp(r * 0.5, 0.6, 2.0), R = ceil(3.0 * sg);         // vòng lặp dưới phủ tới 6 điểm ảnh
        // thoát sớm (soát Codex vòng 8: xoay máy chậm ở màn lớn): 16 mẫu ở R và R/2 — không chạm mặt nạ thì xa mọi mép
        float gan8 = 0.0;
        for (int i = 0; i < 8; i++) {
          vec2 d = vec2(cos(float(i) * 0.78539816), sin(float(i) * 0.78539816)) * uBuoc;
          gan8 += texture2D(m, vUv + d * (R + 0.5)).a + texture2D(m, vUv + d * (R * 0.5)).a;
        }
        if (gan8 < 0.001) return vec2(0.0);
        float B = 0.0, W = 0.0, nhat = 0.0; vec2 G = vec2(0.0), oNhat = vec2(0.0);
        float k2 = 0.5 / (sg * sg);
        for (int j = -6; j <= 6; j++) for (int i = -6; i <= 6; i++) {
          vec2 o = vec2(float(i), float(j));
          float dd = dot(o, o);
          if (dd > R * R + 0.5) continue;
          float w = exp(-dd * k2);
          float a = texture2D(m, vUv + o * uBuoc).a;
          W += w; B += w * a; G += w * a * o;
          if (a > 0.5 && w > nhat) { nhat = w; oNhat = o; }          // điểm mặt nạ gần nhất (dự phòng thử thấy / bị che)
        }
        B /= W; G /= W * sg * sg;
        const float MUC = 0.02275;                                     // Φ(−2)
        float g = max(length(G), 1e-4);
        float x = clamp((B - MUC) / g + 0.5, 0.0, 1.0);
        if (x <= 0.0) return vec2(0.0);
        // thấy / bị che: thấy ở BẤT KỲ điểm mặt nạ nào quanh đó (trong 3σ) là thấy. Phép thử độ sâu từng điểm lưỡng lự cả
        // trên mặt thấy rõ (đo 2026-10-22: lấy trung bình thì mép trên bậc đá cũng nhạt) — chỉ cụm nằm hẳn sau vật khác mới nhạt.
        // Chỉ chạy ở điểm ảnh có viền.
        float th = 0.0, tw = 0.0;
        for (int j = -6; j <= 6; j++) for (int i = -6; i <= 6; i++) {
          vec2 o = vec2(float(i), float(j));
          float dd = dot(o, o);
          if (dd > R * R + 0.5) continue;
          vec2 p = vUv + o * uBuoc;
          if (texture2D(m, p).a < 0.99) continue;                    // mép mặt nạ: độ sâu MSAA gộp không tin được
          th = max(th, thay(sau, p)); tw = 1.0;
          if (th > 0.5) break;
        }
        float ro = tw > 0.0 ? th : thay(sau, vUv + oNhat * uBuoc);
        return vec2(x, ro);
      }
      vec4 tren(vec4 duoi, vec3 c, float a) {           // chồng lớp c (độ đục a) lên duoi (không nhân trước)
        float o = a + duoi.a * (1.0 - a);
        return o < 1e-4 ? vec4(0.0) : vec4((c * a + duoi.rgb * duoi.a * (1.0 - a)) / o, o);
      }
      void main() {
        // độ phủ mặt nạ tại chỗ (song tuyến — mép mềm) thay cho phép thử cứng «> 0,5»: mép tô, mép mờ nền, mép viền đều trộn
        float phuChon = uCoChon > 0.5 ? texture2D(tMat, vUv).a : 0.0, phuRe = uCoRe > 0.5 ? texture2D(tRe, vUv).a : 0.0;
        float thChon = phuChon > 0.002 ? thay(tSauMat, vUv) : 0.0, thRe = phuRe > 0.002 ? thay(tSauRe, vUv) : 0.0;
        float chonThay = phuChon * thChon, chonChe = phuChon * (1.0 - thChon), reThay = phuRe * thRe;
        vec4 c = vec4(0.0);
        // vật đang RÊ cũng thoát lớp mờ (chủ nhà 2026-10-31: «in edit mode, hovering should still do slight highlight like
        // normal mode») — có món đang chọn thì phần còn lại mờ trắng, vật dưới con trỏ hiện lại màu thật + ánh nhẹ như chế độ xem
        if (uMo > 0.001) c = tren(c, uNen, uMo * uPhu * (1.0 - max(chonThay, reThay * uRe)));
        // SOI XUYÊN: phần cụm chọn bị vật khác che (cửa sau tường) hiện màu thật của nó qua lớp đã mờ — tập trung là thấy vật
        if (chonChe > 0.002 && uMo > 0.001) {
          vec4 m = texture2D(tMau, vUv);
          vec3 t = m.rgb / max(m.a, 1e-3);
          c = tren(c, t, uMo * 0.85 * m.a * chonChe);
        }
        // LÀM NỔI THIẾT BỊ (trang con, thay vòng đánh dấu): tô nhấn 35 % phần thấy, 18 % phần bị che (ổ, ống chờ trong
        // tường vẫn tìm được), viền dày bên ngoài — dưới lớp cụm chọn
        float phuNoi = uCoNoi > 0.5 ? texture2D(tNoi, vUv).a : 0.0;
        if (phuNoi > 0.002 && phuChon < 0.5) { float th = thay(tSauNoi, vUv); c = tren(c, uMau, phuNoi * mix(0.18, 0.35, th)); }
        if (uCoNoi > 0.5 && phuNoi < 0.999 && phuChon < 0.5) { vec2 v = vien(tNoi, tSauNoi, uRNoi); if (v.x > 0.002) c = tren(c, uMau, mix(0.5, 1.0, v.y) * v.x * (1.0 - phuNoi)); }
        // cụm chọn: không tô (chủ nhà 2026-10-25 «chỉ cần viền»); cụm rê vẫn ánh nhẹ
        if (uRe > 0.0 && reThay > 0.002) c = tren(c, uMau, 0.09 * uRe * reThay);
        // mép trong của viền: trộn theo độ phủ mặt nạ tại chỗ (không cắt cứng ở 0,5 — cắt cứng là bậc thang)
        if (uChon > 0.0 && uCoChon > 0.5 && phuChon < 0.999) { vec2 v = vien(tMat, tSauMat, uR); if (v.x > 0.002) c = tren(c, uMau, mix(0.42, 1.0, v.y) * uChon * v.x * (1.0 - phuChon)); }
        if (uRe > 0.001 && uCoRe > 0.5 && phuRe < 0.999 && phuChon < 0.5) { vec2 v = vien(tRe, tSauRe, uRRe); if (v.x > 0.002) c = tren(c, uMau, mix(0.3, 0.75, v.y) * uRe * v.x * (1.0 - phuRe)); }
        if (c.a < 0.002) discard;
        gl_FragColor = c;
        #include <colorspace_fragment>
      }`,
    transparent: true, depthTest: false, depthWrite: false,
  });
  vl.toneMapped = false;                                 // tô màu phẳng; màu soi xuyên = màu tuyến tính của mặt nạ (renderer nén tuyến tính, phơi sáng 1 — giữ nguyên)
  const tam = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), vl);
  tam.frustumCulled = false;
  const canhPhu = new THREE.Scene(); canhPhu.add(tam);
  const camPhu = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const kich = new THREE.Vector2(), mauXoa = new THREE.Color();
  let rong = 1.75, rongRe = 1;                                     // nửa bề dày cũ (chủ nhà 2026-10-21)                                       // bề dày viền (điểm ảnh CSS) — đổi qua kieu()
  // độ mạnh mờ dần theo ĐỒNG HỒ (không theo số khung — máy chậm vẽ thưa vẫn đúng giờ): đổi đích ⇒ đi từ giá trị hiện có tới
  // đích trong vao (lên) / ra (xuống) giây, rút ngắn theo quãng còn lại
  const TW = { mo: { v: 0, toi: 0, tu: 0, t0: 0, dur: 0, vao: 0.5, ra: 0.35 }, re: { v: 0, toi: 0, tu: 0, t0: 0, dur: 0, vao: 0.12, ra: 0.25 } };
  const dich = (x, toi) => { if (x.toi === toi) return; x.toi = toi; x.tu = x.v; x.t0 = performance.now(); x.dur = (toi > x.v ? x.vao : x.ra) * Math.abs(toi - x.v) * 1000; };
  let dungKhung = null;
  const lop = (list, l, bat) => { if (list) for (const o of list) bat ? o.layers.enable(l) : o.layers.disable(l); };
  const dangDoi = () => Object.values(TW).some((x) => x.v !== x.toi);
  function nhip() {                                                 // xin khung liên tục khi đang mờ dần, trả khi xong
    if (dangDoi()) { if (!dungKhung) dungKhung = khungLienTuc(); }
    else if (dungKhung) { dungKhung(); dungKhung = null; }
    veLai(60);
  }
  function dat(moi) {
    const co = moi && moi.length ? moi : null;
    if (ds && !co) { giuMo = ds; } else lop(ds, LOP, false);       // bỏ chọn: mặt nạ cũ ở lại tới khi nền hết phủ
    if (co && giuMo) { lop(giuMo, LOP, false); giuMo = null; }
    ds = co;
    lop(ds, LOP, true);
    dich(TW.mo, ds && cheDoSua() ? 1 : 0);                         // tập trung (nhà mờ về nền) chỉ ở chế độ sửa
    nhip();
  }
  function datRe(moi) {
    /* rê lên cụm đang chọn VẪN ánh nhẹ (chủ nhà 2026-10-30 «I select an object, it seems that object get dehighlighted
       slightly too»: đo — vật chọn khi chuột đã rời trùng từng điểm ảnh với vật chưa chọn; cái «nhạt đi» là lớp ánh rê 9 %
       tắt đúng lúc bấm). Nay bấm chọn chỉ thêm viền; viền rê không vẽ đè viền chọn (phuChon trong shader). */
    const co = moi && moi.length ? moi : null;
    if (co === dsRe || (co && dsRe && co.length === dsRe.length && co.every((o, i) => o === dsRe[i]))) return;
    if (co) { lop(dsRe, LOP_RE, false); dsRe = co; lop(dsRe, LOP_RE, true); }
    dich(TW.re, co ? 1 : 0);                                        // ra: giữ mặt nạ cũ tới khi mờ hết
    nhip();
  }
  const DEN = [];                                         // đèn của cảnh — bật thêm lớp mặt nạ lúc vẽ màu thật (đèn cũng lọc theo lớp)
  // chỉ khối KÍN, đặc, có tô nắp mới được đếm stencil — kính, lưới hở, vật ma để lại số đếm lẻ ⇒ nắp giả (soát Codex vòng 4)
  const demDuoc = (o) => o.userData.kin !== false && !o.userData.ma && !o.material?.transparent && !KHONG_TO.has(o.userData.vat_lieu);
  function veMatNa(dich, l, mau = false, ds = null) {
    const nen = scene.background, phu = scene.overrideMaterial, ac = renderer.autoClear, aXoa = renderer.getClearAlpha();
    renderer.getClearColor(mauXoa);
    const lm = camera.layers.mask, d0 = renderer.getRenderTarget();
    if (mau) { DEN.length = 0; scene.traverse((o) => { if (o.isLight && !o.layers.isEnabled(l)) { o.layers.enable(l); DEN.push(o); } }); }
    try {
      scene.background = null; scene.overrideMaterial = mau ? null : vlMat; camera.layers.set(l);
      renderer.autoClear = true; renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(dich); renderer.render(scene, camera);
      if (matCat && !mau) {                                         // nắp cắt của riêng cụm (xem trên) — bản màu chỉ để soi xuyên
                                                                    // phần bị che; chỗ nắp luôn «thấy» nên bỏ được 3 lượt vẽ
        renderer.autoClear = false;
        // mọi lưới đang ở lớp mặt nạ — gồm bản tạm của công tắc đang diễn (soát Codex vòng 5), không chỉ `ds`
        const boDem = []; scene.traverse((o) => { if (o.isMesh && o.layers.isEnabled(l) && !demDuoc(o)) boDem.push(o); });
        for (const o of boDem) o.layers.disable(l);
        try { for (const v of vlDem) { scene.overrideMaterial = v; renderer.render(scene, camera); } }
        finally { for (const o of boDem) o.layers.enable(l); }
        scene.overrideMaterial = null;
        napMN.position.copy(matCat.projectPoint(hopTheGioi.getCenter(new THREE.Vector3()), new THREE.Vector3()));
        napMN.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), matCat.normal);
        const k = hopTheGioi.getSize(new THREE.Vector3()).length() * 4 + 1; napMN.scale.set(k, k, 1);
        napMN.layers.set(l);
        renderer.render(canhNap, camera);
      }
    } finally {
      camera.layers.mask = lm; scene.overrideMaterial = phu; scene.background = nen;
      renderer.setClearColor(mauXoa, aXoa); renderer.setRenderTarget(d0); renderer.autoClear = ac;
      for (const o of DEN) o.layers.disable(l);
    }
  }
  function ve() {
    const bay = performance.now();
    for (const x of Object.values(TW)) if (x.v !== x.toi) {
      const k = x.dur > 0 ? Math.min(1, (bay - x.t0) / x.dur) : 1;
      x.v = k >= 1 ? x.toi : x.tu + (x.toi - x.tu) * k;
    }
    if (TW.mo.v === 0 && giuMo) { lop(giuMo, LOP, false); giuMo = null; }
    if (TW.re.v === 0 && TW.re.toi === 0 && dsRe) { lop(dsRe, LOP_RE, false); dsRe = null; }
    if (dangDoi()) veLai(60); else if (dungKhung) { dungKhung(); dungKhung = null; }
    const matChon = ds || giuMo;
    if (matChon || dsRe || dsNoi) {
      renderer.getDrawingBufferSize(kich);
      for (const r of [rt, rtRe, rtMau, rtNoi]) if (r.width !== kich.x || r.height !== kich.y) r.setSize(kich.x, kich.y);
      if (matChon) { veMatNa(rt, LOP, false, matChon); if (TW.mo.v > 0.001) veMatNa(rtMau, LOP, true); }   // màu thật: chỉ khi đang tập trung
      if (dsRe) veMatNa(rtRe, LOP_RE, false, dsRe);
      if (dsNoi) veMatNa(rtNoi, LOP_NOI, false, dsNoi);
      const u = vl.uniforms;
      u.uCoChon.value = matChon ? 1 : 0; u.uCoRe.value = dsRe ? 1 : 0; u.uCoNoi.value = dsNoi ? 1 : 0;   // mặt nạ không vẽ lượt này ⇒ coi như rỗng
      u.uRNoi.value = 2.5 * renderer.getPixelRatio();
      u.uBuoc.value.set(1 / kich.x, 1 / kich.y);
      u.uR.value = rong * renderer.getPixelRatio(); u.uRRe.value = rongRe * renderer.getPixelRatio();
      if (NET) u.tSau.value = NET.rt.depthTexture;
      else {
        if (rtCanh.width !== kich.x || rtCanh.height !== kich.y) rtCanh.setSize(kich.x, kich.y);
        const nen = scene.background, phu = scene.overrideMaterial, d0 = renderer.getRenderTarget(), ac0 = renderer.autoClear;
        // tấm nắp cắt của cảnh là tấm phẳng KHỔNG LỒ chỉ hiện trong khung stencil — vật liệu đè bỏ stencil ⇒ ghi độ sâu cả
        // tấm; ẩn chúng ở lượt này (soát Codex vòng 3)
        const napAn = []; for (const g of NAP) for (const n of [g.nap, g.napMo]) if (n.visible) { n.visible = false; napAn.push(n); }
        // vật trong suốt (kính) không ghi độ sâu ở lượt thường — cũng không ở đây, không thì cửa sau kính bị coi là bị che
        scene.traverse((o) => { if (o.isMesh && o.visible && o.material?.transparent) { o.visible = false; napAn.push(o); } });
        try { scene.background = null; scene.overrideMaterial = vlSau; renderer.autoClear = true; renderer.setRenderTarget(rtCanh); renderer.render(scene, camera); }
        finally { scene.background = nen; scene.overrideMaterial = phu; renderer.setRenderTarget(d0); renderer.autoClear = ac0; for (const n of napAn) n.visible = true; }
        u.tSau.value = rtCanh.depthTexture;
      }
      u.uCoSau.value = 1;
      u.uChon.value = ds ? 1 : 0; u.uRe.value = TW.re.v; u.uMo.value = TW.mo.v;
      u.uPhu.value = XAM.bat ? 0.5 : 0.72;                          // nền đã trắng trơn (XAM) ⇒ phủ vừa, hình khối còn đọc được
      // phủ về màu nền — nhưng khi phần còn lại đã trắng trơn (XAM) thì phủ TRẮNG: «Màu thật» có nền xám so màu, phủ về
      // nền xám làm cả nhà xám lại (chủ nhà 2026-10-25: «trắng mờ, không phải xám»)
      if (XAM.bat) u.uNen.value.copy(XAM.mau); else if (scene.background?.isColor) u.uNen.value.copy(scene.background);
      const ac = renderer.autoClear;
      renderer.autoClear = false; renderer.render(canhPhu, camPhu); renderer.autoClear = ac;
    }
    for (const f of VE_SAU) { try { f(renderer, camera); } catch (e) { console.warn("XEM.veSau lỗi:", e); } }
  }
  /* móc cho mô-đun khác: kieu({mau, rong, rongRe}) đổi màu / bề dày viền */
  const kieu = ({ mau, rong: r, rongRe: rr } = {}) => { if (mau != null) vl.uniforms.uMau.value.set(mau); if (r > 0) rong = r; if (rr > 0) rongRe = rr; veLai(60); };
  // vật LÀM NỔI có viền + tô nhấn (DANH_DAU): đổi tập thì đổi lớp camera, không cấp phát mỗi khung
  function datNoi(moi) {
    const co = moi && moi.length ? moi : null;
    lop(dsNoi, LOP_NOI, false); dsNoi = co; lop(dsNoi, LOP_NOI, true);
    veLai(60);
  }
  const tapTrung = () => { dich(TW.mo, ds && cheDoSua() ? 1 : 0); nhip(); };   // đổi chế độ sửa ⇒ mờ / rõ dần
  return { dat, datRe, datNoi, ve, tapTrung, ds: () => ds, dsRe: () => dsRe, dsNoi: () => dsNoi, kieu, manh: () => ({ mo: TW.mo.v, re: TW.re.v }) };
})();

/* ── BÓNG ĐỠ dưới cụm chọn (học Anatomy 2026-10-27: «a soft halo under the base and under anything lifted») ──────────────
   Nền đã trắng trơn thì vật treo (đèn, quạt trần, dàn lạnh, rèm) và đồ đứng trên sàn trông như lơ lửng. Một vệt mờ tối dịu
   nằm trên mặt NGỬA gần nhất ngay dưới cụm (tia thẳng đứng từ tâm đáy hộp bao, bỏ qua chính cụm, kính, vật ma): sát sàn thì
   gọn và đậm hơn, càng cao càng loe rộng và nhạt. Vẽ sau lớp tập trung (VE_SAU — không bị phủ nền), thử độ sâu với cảnh nên
   tường / đồ phía trước che đúng. Độ đậm theo đúng nhịp mờ dần của lớp tập trung (không bật phụt). Cụm quá lớn (sàn cả phòng,
   tường dài > 6 m) không có bóng. Tính lại chỉ khi cụm đổi hoặc khe tách lớp đổi. ?bong=0: tắt. */
const BONG_CHON = (() => {
  if (Q.get("bong") === "0") return null;
  const vl = new THREE.ShaderMaterial({
    uniforms: { uKich: { value: new THREE.Vector2(1, 1) }, uNua: { value: new THREE.Vector2(0.5, 0.5) }, uLoe: { value: 0.1 }, uDam: { value: 0 },
      uMau: { value: new THREE.Color(0x4a463e) } },
    // vP: toạ độ trên tấm tính bằng MÉT (tấm co giãn không đều — khoảng cách phải đo cùng một đơn vị hai chiều)
    vertexShader: "#include <common>\n#include <logdepthbuf_pars_vertex>\nuniform vec2 uKich;\nvarying vec2 vP;\nvoid main(){ vP = position.xy * uKich; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n#include <logdepthbuf_vertex>\n}",
    fragmentShader: `#include <logdepthbuf_pars_fragment>
      uniform vec2 uKich, uNua; uniform float uLoe, uDam; uniform vec3 uMau; varying vec2 vP;
      void main(){
        #include <logdepthbuf_fragment>
        vec2 q = abs(vP) - uNua;                                   // khoảng cách tới chữ nhật đáy (âm = bên trong)
        float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
        float a = uDam * (1.0 - smoothstep(-0.35 * uLoe, uLoe, d));
        if (a < 0.002) discard;
        gl_FragColor = vec4(uMau, a);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
  });
  vl.toneMapped = false;
  const tam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), vl);
  tam.rotation.x = -Math.PI / 2; tam.frustumCulled = false; tam.raycast = () => {};
  const canh = new THREE.Scene(); canh.add(tam);
  const rc = new THREE.Raycaster(), _b = new THREE.Box3(), _c = new THREE.Vector3(), _n = new THREE.Vector3();
  let dsCu = null, kheCu = -1, co = false, dam0 = 0;
  function tinh(ds) {
    co = false;
    if (!ds || !ds.length) return;
    _b.makeEmpty(); for (const o of ds) if (o.visible !== false) _b.expandByObject(o);
    if (_b.isEmpty()) return;
    const sx = _b.max.x - _b.min.x, sz = _b.max.z - _b.min.z;
    if (Math.max(sx, sz) > 6 || sx * sz > 12) return;
    const bo = new Set(ds);
    _b.getCenter(_c);
    rc.set(_c.set(_c.x, _b.min.y + 0.01, _c.z), _n.set(0, -1, 0)); rc.far = 8;
    const ung = PHAN.filter((o) => o.visible && !bo.has(o) && !o.userData.ma && !o.material?.transparent);
    let nen = null;
    for (const h of rc.intersectObjects(ung, false)) {
      if (!h.face) continue;
      if (_n.copy(h.face.normal).transformDirection(h.object.matrixWorld).y > 0.7) { nen = h; break; }   // mặt NGỬA đầu tiên
    }
    if (!nen) return;
    const cach = Math.max(0, _b.min.y - nen.point.y);             // vật cách mặt đỡ bao nhiêu (m, thế giới)
    const loe = 0.09 + 0.14 * Math.min(cach, 2.5);                 // mép mềm (m): sát sàn ~9 cm, treo cao loe tới ~44 cm
    tam.position.set((_b.min.x + _b.max.x) / 2, nen.point.y + 0.002, (_b.min.z + _b.max.z) / 2);
    tam.scale.set(sx + 2.2 * loe, sz + 2.2 * loe, 1);
    tam.updateMatrixWorld();
    vl.uniforms.uKich.value.set(tam.scale.x, tam.scale.y);
    vl.uniforms.uNua.value.set(sx / 2, sz / 2);
    vl.uniforms.uLoe.value = loe;
    dam0 = 0.3 / (1 + 0.8 * cach);
    co = true;
  }
  let doiLuc = 0;                                                  // lúc khe tách vừa đổi (0 = đứng yên)
  VE_SAU.add((r, cam) => {
    const ds = VIEN_CUM.ds(), mo = VIEN_CUM.manh().mo, bay = performance.now();
    if (ds && ds !== dsCu) { dsCu = ds; kheCu = tachKhe; doiLuc = 0; tinh(ds); }   // bỏ chọn: giữ bóng cũ tới khi mờ hết
    else if (ds && tachKhe !== kheCu) { kheCu = tachKhe; doiLuc = bay; co = false; veLai(200); }
    // khe đang chạy (tách so le, kéo thanh trượt) đổi MỖI khung: ẩn bóng, tính lại một lần khi khe đứng yên 150 ms —
    // không lọc + bắn tia cả nhà 60 lần/giây (soát Codex 2026-10-28)
    else if (doiLuc && bay - doiLuc > 150) { doiLuc = 0; tinh(ds); }
    else if (doiLuc) veLai(200);
    if (!co || mo < 0.002) return;
    vl.uniforms.uDam.value = dam0 * mo;
    const ac = r.autoClear; r.autoClear = false;
    try { r.render(canh, cam); } finally { r.autoClear = ac; }
  });
  return { tinh };
})();

/* ── THƯỚC CỤM (Chi tiết; thiết kế 2026-10-21, soát Codex) ─────────────────────────────────────────────────────
   Ba kích thước bao của cụm — rộng · sâu · cao theo trục mô hình — đo trên hộp bao Ở THẾ CHUẨN (cánh đóng, rèm cuốn, thang
   cất: cỡ để chế tạo, không phải chỗ cánh mở chiếm), cộng hai (hoặc ba, khi chiều thứ ba > 80 mm hay > 15 %) kích thước của
   bộ phận đang chọn. Vẽ bằng SVG phủ trên khung vẽ, tính lại MỖI khung vẽ (khung chỉ vẽ khi camera / cảnh đổi):
     · mỗi trục chọn trong 4 cạnh song song của hộp cạnh NẰM NGOÀI hình chiếu của hộp xa nhất về phía pháp tuyến ra ngoài (trên
       màn hình), ưu tiên cạnh dưới cho rộng/sâu, cạnh trái/phải cho cao; đường ghi lùi ra ngoài 24 px (bộ phận 14 px), đường
       gióng cách vật 3 px, hai gạch 45° dài 8 px nét 1,5 px;
     · nhãn viên thuốc nền giấy viền tối, 13 px (14 px điện thoại) số đều; ưu tiên bộ phận rồi cao, rộng, sâu; đè nhau thì trượt
       dọc đường ghi rồi lùi ra ngoài; đường ngắn dưới 56 px thì bỏ (số vẫn ở bảng); điện thoại tối đa 3 nhãn.
   Thước đã lưu (data/thuoc-3d.yaml) vẫn vẽ ở khung chính như cũ. */
const THUOC_CUM = (() => {
  const NS = "http://www.w3.org/2000/svg";
  let svg = null, lopNhanCT = null;
  const P = Array.from({ length: 8 }, () => new THREE.Vector3()), S = Array.from({ length: 8 }, () => [0, 0]);
  const _b = new THREE.Box3(), _v = new THREE.Vector3();
  const dung = () => {
    svg = document.createElementNS(NS, "svg"); svg.id = "thuoc-cum"; svg.setAttribute("aria-hidden", "true");
    lopNhanCT = document.createElement("div"); lopNhanCT.id = "nhan-thuoc-cum"; lopNhanCT.setAttribute("aria-hidden", "true");
    $("khung").append(svg, lopNhanCT);
  };
  // bao lồi (chuỗi đơn điệu) của 8 điểm chiếu — để biết đường ghi có rơi vào trong hình vật không
  function baoLoi(ds) {
    const p = ds.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cheo = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const d = [], t = [];
    for (const x of p) { while (d.length >= 2 && cheo(d[d.length - 2], d[d.length - 1], x) <= 0) d.pop(); d.push(x); }
    for (const x of p.reverse()) { while (t.length >= 2 && cheo(t[t.length - 2], t[t.length - 1], x) <= 0) t.pop(); t.push(x); }
    return d.slice(0, -1).concat(t.slice(0, -1));
  }
  const trongBao = (bao, x, y) => {                                     // mọi tích chéo cùng dấu ⇒ ở trong (không phụ thuộc chiều vòng)
    let am = false, duong = false;
    for (let i = 0; i < bao.length; i++) { const a = bao[i], b = bao[(i + 1) % bao.length];
      const k = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); if (k < 0) am = true; else if (k > 0) duong = true; }
    return bao.length > 2 && !(am && duong);
  };
  // các cạnh song song trục k: cặp đỉnh chỉ khác bit k (đỉnh i: bit0 = x, bit1 = y, bit2 = z)
  const CANH = [0, 1, 2].map((k) => [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => !(i >> k & 1)).map((i) => [i, i | 1 << k]));
  function chieu(b, w, h) {
    for (let i = 0; i < 8; i++) {
      P[i].set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z);
      _v.copy(P[i]); GOC.localToWorld(_v); _v.project(camera);
      if (_v.z > 1 || _v.z < -1) return false;
      S[i][0] = (_v.x + 1) * w / 2; S[i][1] = (1 - _v.y) * h / 2;
    }
    return true;
  }
  /* một kích thước: chọn cạnh, trả {a, b, n, l, gia} theo điểm ảnh — hoặc null nếu quá ngắn */
  function chonCanh(k, bao, cx, cy, lui, toiThieu) {
    let tot = null;
    for (const [i, j] of CANH[k]) {
      const a = S[i], b = S[j], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
      if (l < toiThieu) continue;
      let nx = -dy / l, ny = dx / l;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (nx * (mx - cx) + ny * (my - cy) < 0) { nx = -nx; ny = -ny; }
      const ra = nx * (mx - cx) + ny * (my - cy);                          // cạnh này ở xa tâm bao nhiêu về phía ngoài
      if (trongBao(bao, mx + nx * (lui - 2), my + ny * (lui - 2))) continue;   // đường ghi rơi vào hình vật
      const diem = ra + (k === 2 ? 0.35 * Math.abs(nx) : 0.35 * Math.max(0, ny)) * 40;
      if (!tot || diem > tot.diem) tot = { a, b, nx, ny, l, diem };
    }
    return tot;
  }
  const O = [];                                                          // ô dùng lại: {g, l: [5 line], nhan, chu, rong, cao}
  function o_(i) {
    if (O[i]) return O[i];
    const g = document.createElementNS(NS, "g"), l = [];
    for (let k = 0; k < 5; k++) { const x = document.createElementNS(NS, "line"); g.append(x); l.push(x); }
    const nhan = document.createElement("div");
    svg.append(g); lopNhanCT.append(nhan);
    return (O[i] = { g, l, nhan, chu: "", rong: 0, cao: 0, lop: "" });
  }
  const dat4 = (l, x1, y1, x2, y2) => { l.setAttribute("x1", x1.toFixed(1)); l.setAttribute("y1", y1.toFixed(1)); l.setAttribute("x2", x2.toFixed(1)); l.setAttribute("y2", y2.toFixed(1)); };
  const muc = [], laNhan = [], _bp = new THREE.Box3(), _s = new THREE.Vector3(), Q2 = S.map(() => [0, 0]);
  function ve() {
    if (!svg) dung();
    const bat = !!(CT.mo && CT.thuoc && GOC);
    svg.style.display = lopNhanCT.style.display = bat ? "" : "none";
    let dung_ = 0;
    if (bat) {
      const w = canvas.clientWidth, h = canvas.clientHeight, dt = w <= 820 || matchMedia("(max-width: 820px)").matches;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`); svg.setAttribute("width", w); svg.setAttribute("height", h);
      muc.length = 0; laNhan.length = 0;
      if (NUT_NOI && !NUT_NOI.hidden && NN.x === NN.x) {             // nhãn thước tránh nút nổi
        const bw = NUT_NOI.offsetWidth / 2 + 6, bh = NUT_NOI.offsetHeight / 2 + 6; laNhan.push([NN.x - bw, NN.y - bh, NN.x + bw, NN.y + bh]);
      }
      const g = CT.phan ? CT.nhom?.find((x) => x.khoa === CT.phan) : null;
      if (g) {
        const b = hopCum(g.ds.slice(0, 1), _bp);
        if (!b.isEmpty()) {
          b.getSize(_s);
          const ds = [[0, _s.x], [1, _s.y], [2, _s.z]].sort((p, q) => q[1] - p[1]);
          const ba = ds[2][1] > 0.08 || ds[2][1] > 0.15 * ds[0][1];
          for (const [k] of ds.slice(0, ba ? 3 : 2)) muc.push({ k, b, lop: "phan" });
        }
      }
      const bc = hopChuan(CT.cum.ds, _b);
      if (!bc.isEmpty()) for (const k of [2, 0, 1]) muc.push({ k, b: bc, lop: g ? "cum mo" : "cum" });
      let hopDang = null, bao = null, cx = 0, cy = 0;
      for (const m of muc) {
        if (dt && dung_ >= 3) break;
        if (m.b !== hopDang) {
          hopDang = m.b;
          if (!chieu(m.b, w, h)) { bao = null; continue; }
          for (let i = 0; i < 8; i++) { Q2[i][0] = S[i][0]; Q2[i][1] = S[i][1]; }
          bao = baoLoi(Q2); cx = 0; cy = 0; for (const p of S) { cx += p[0] / 8; cy += p[1] / 8; }
        }
        if (!bao) continue;
        const lui = m.lop === "phan" ? 14 : 24;
        const c = chonCanh(m.k, bao, cx, cy, lui, 56);
        if (!c) continue;
        const ax = c.a[0] + c.nx * lui, ay = c.a[1] + c.ny * lui, bx = c.b[0] + c.nx * lui, by = c.b[1] + c.ny * lui;
        const ux = (bx - ax) / c.l, uy = (by - ay) / c.l, gx = (ux + c.nx) * 2.83, gy = (uy + c.ny) * 2.83;
        const o = o_(dung_);
        const chu = mm(m.b.max.getComponent(m.k) - m.b.min.getComponent(m.k));
        if (o.lop !== m.lop) { o.lop = m.lop; o.g.setAttribute("class", "tc " + m.lop); o.nhan.className = "nhan-tc " + m.lop; }
        if (o.chu !== chu) { o.chu = chu; o.nhan.textContent = chu; o.rong = 0; }
        o.nhan.title = ["Rộng (ngang nhà)", "Sâu (dọc nhà)", "Cao"][m.k] + (m.lop === "phan" ? " — bộ phận" : " — cả cụm");
        o.nhan.style.display = "";
        if (!o.rong) { o.rong = o.nhan.offsetWidth || 48; o.cao = o.nhan.offsetHeight || 22; }
        let x = (ax + bx) / 2, y = (ay + by) / 2, ok = false;
        for (const [t, lt] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 1], [0.3, 1], [-0.3, 1], [0, 2]]) {
          const xx = x + ux * c.l * t + c.nx * lt * (o.cao + 2), yy = y + uy * c.l * t + c.ny * lt * (o.cao + 2);
          const r = [xx - o.rong / 2 - 2, yy - o.cao / 2 - 2, xx + o.rong / 2 + 2, yy + o.cao / 2 + 2];
          if (r[0] < 4 || r[2] > w - 4 || r[1] < 4 || r[3] > h - 4) continue;
          if (laNhan.some((q) => r[0] < q[2] && q[0] < r[2] && r[1] < q[3] && q[1] < r[3])) continue;
          x = xx; y = yy; laNhan.push(r); ok = true; break;
        }
        if (!ok) { o.nhan.style.display = "none"; continue; }
        dat4(o.l[0], c.a[0] + c.nx * 3, c.a[1] + c.ny * 3, ax + c.nx * 6, ay + c.ny * 6);     // hai đường gióng
        dat4(o.l[1], c.b[0] + c.nx * 3, c.b[1] + c.ny * 3, bx + c.nx * 6, by + c.ny * 6);
        dat4(o.l[2], ax, ay, bx, by);                                                         // đường ghi
        dat4(o.l[3], ax - gx, ay - gy, ax + gx, ay + gy);                                     // gạch 45°
        dat4(o.l[4], bx - gx, by - gy, bx + gx, by + gy);
        o.g.style.display = "";
        o.nhan.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
        dung_++;
      }
    }
    for (let i = dung_; i < O.length; i++) { O[i].g.style.display = "none"; O[i].nhan.style.display = "none"; }
    ve.so = dung_;
  }
  return { ve, so: () => ve.so || 0 };
})();
MOI_KHUNG.push(() => { if (CT.mo) THUOC_CUM.ve(); });
/* hộp bao ở THẾ CHUẨN: vật trong công tắc trạng thái chỉ tính ở thế «Đóng / Cất / Cuốn lên / Gập lên / Đẩy vào» (không có
   thì thế mặc định); công tắc phương án (màu, loại) tính đúng thế đang xem. Cỡ để chế tạo — không đổi khi người xem mở cánh. */
const THE_GON = /^(Đóng|Cất|Gập lên|Đẩy vào|Cuốn lên|Nâng)/;
const lcChuan = (cm) => cm.lua_chon.find((lc) => THE_GON.test(lc.nhan)) || cm.lua_chon.find((lc) => lc.nhan === cm.mac_dinh) || cm.lua_chon[0];
function trongTheChuan(o) {
  const u = o.userData;
  if (lkTat.has(u.linh_kien) || (u.ma && !hienMa) || (u.phan_tich && !hienPhanTich)) return false;
  for (const cm of congTacCuaVat(u)) {
    if (u.cong_tac === cm.ma) continue;
    const lc = laPaCT(cm) ? cm.lua_chon.find((l) => l.nhan === CHON_MOT.get(cm.ma)) : lcChuan(cm);
    if (!lc || !lopLC(lc).some((n) => trongLop(u, n))) return false;
  }
  return true;
}
function hopChuan(ds, b = new THREE.Box3()) {
  b.makeEmpty();
  const co = ds.filter(trongTheChuan);
  // phụ kiện nhỏ đứng tách khỏi thân (hít cửa trên tường, cảm biến xa khung) không tính vào cỡ chế tạo của cụm
  const tong = co.reduce((s, o) => s + theTich(o), 0), than = new THREE.Box3();
  for (const o of co) if (theTich(o) >= 0.02 * tong) than.union(hopVat(o));
  for (const o of co) { const h = hopVat(o); if (than.isEmpty() || theTich(o) >= 0.02 * tong || h.intersectsBox(than)) b.union(h); }
  return b.isEmpty() ? hopCum(ds, b) : b;
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
   Tên lớp khớp theo ĐẦU CHUỖI: «L1 · Tôn» khớp «L1 · Tôn cách nhiệt: tôn + xốp PU + …» và mọi lớp con — phiên khác sửa đuôi tên
   lớp thì cảnh đã lưu vẫn đúng. Ghi đủ mã + tên ngắn («L6 · Trần», không phải «L6») để khỏi khớp lớp khác. */
let NOI_BAT = null;
/* ĐỘ ĐẬM PHẦN CÒN LẠI khi làm nổi (chủ nhà 2026-09-28): mọi vật không được làm nổi vẽ ở độ đậm MO_NOI (0…0,5; mặc định
   0,12). Cảnh mang `mo` thì dùng số ấy — vd ba ô lam khoang trần nhỏ giữa cả mái: mờ phần còn lại nhiều hơn. Chỉ áp cho
   làm nổi; lớp ◐, xem xuyên vẫn mờ 0,12. Thanh «Làm nổi» ở ô trái (trình xem đầy đủ + chế độ soạn). */
const MO_NOI_MD = 0.12;
var MO_NOI = MO_NOI_MD;
const VL_MO_NB = new Map();
/* phần còn lại khi làm nổi mang KIỂU BỎ CHỌN của XAM — trắng ngà không chiếu sáng, không vân, không màu — chỉ trong suốt
   (chủ nhà 2026-10-25, trang việc: «all others should be in the deselected styling … and transparent. So no colours»).
   ?xam=0 ⇒ bản sao màu thật như cũ. */
function vlMoNB(goc) {
  let m = VL_MO_NB.get(goc);
  if (!m) {
    if (XAM.bat && goc.isMeshStandardMaterial && !goc.userData.giuMau) {
      m = new THREE.MeshBasicMaterial({ color: XAM.mau, side: goc.side, alphaMap: goc.alphaMap, alphaTest: goc.alphaTest });
      m.name = "trắng mờ (ngoài làm nổi)";
      tongMat(m);
      if (VL_DAY.has(goc)) danhDauDay(m);
    } else m = goc.clone();
    m.transparent = true; m.depthWrite = false; VL_MO_NB.set(goc, m);
  }
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
    m = goc.clone(); m.color.lerp(new THREE.Color(0x3b82f6), 0.6); m.emissive = new THREE.Color(0x1d4ed8); m.emissiveIntensity = 0.35;   // xanh lam (chủ nhà 2026-10-25)
    m.userData = { ...m.userData, giuMau: true };
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
const laMa = (o) => o.userData.ma || lopMo.has(o.userData.nhom);
function apMo() {
  vienTheoMo();
  const kmn = $("khoi-mo-noi"); if (kmn) kmn.hidden = !NOI_BAT;
  for (const o of PHAN) {
    if (o.userData.ma) continue;
    const goc = o.userData.vlGoc;
    let m = goc;
    const moRieng = lopMo.has(o.userData.nhom);
    const mo = moRieng || (NOI_BAT && !noiBatCo(o));
    if (mo) m = moRieng ? vlMoCua(goc) : vlMoNB(goc);
    else if (o.userData.phat_sang && DEN_BAT.has(o.userData.bo_den)) m = vlSang(goc);   // đèn đang bật (bảng công tắc)
    else if (o.userData.quat_ma && QUAT_HUT.has(o.userData.quat_ma)) m = vlGio(goc, QUAT_HUT.get(o.userData.quat_ma) === "cao");
    // LÀM NỔI: vật được làm nổi mang thêm sắc ấm (tự phát sáng nhẹ) — chỉ làm mờ phần còn lại thì vật nhỏ, mỏng hay
    // màu nhạt (nẹp, màng, tôn trắng) trông như không được chọn. Bản sao theo vật liệu gốc, dùng chung.
    // LÀM NỔI giữ NGUYÊN màu + vật liệu thật của vật (chủ nhà 2026-09-27: «đừng tô cam») — nổi nhờ phần còn lại mờ đi
    // và một viền mảnh tối quanh vật (VIEN_NOI)
    o.userData.vlHien = m;
    if (!laTo(o)) o.material = MACH.has(o) ? VL_MACH : m;
    else o.material = vlChon(o);
    vienNoi(o, !mo && !!NOI_BAT && noiBatCo(o));
    o.renderOrder = mo ? 2 : 0;
    o.userData.moNap = mo; demNap(o);
    // đang chuyển làm nổi (chuyenNoiBat): vật đổi phía đi bằng vật liệu mờ dần / rõ dần — kể cả khi apMo chạy lại giữa
    // chừng (bay camera), để chuyển không bị giật về trạng thái cuối
    if (CHUYEN_NB && CHUYEN_NB.tap && o.material === m && !MACH.has(o)
        && !lopMo.has(o.userData.nhom)) {
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
  if (laTo(o)) return;
  datVien(o, bat ? VIEN_NOI : VIEN);
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
  // TRANG VIỆC (nhúng, không soạn) đang làm nổi: chỉ vật làm nổi bấm được — phần còn lại là nền trong suốt, bấm xuyên qua
  // (chủ nhà 2026-10-25: «in an agenda view, only parts of the agenda can be selected»)
  const chiNoi = NOI_BAT && document.body.classList.contains("nhung") && !document.body.classList.contains("nhung-sua");
  for (const h of hits) {
    if (catBo(h)) continue;   // phần đã bị cắt bỏ
    if (chiNoi && !noiBatCo(h.object)) continue;
    if (!choMa && laMa(h.object) && hits.some((k) => !laMa(k.object))) continue;
    // khối KHÍ (khối phòng, khoang) chỉ được chọn khi sau nó không có vật thật nào
    if (laKhi(h.object) && hits.some((k) => !laKhi(k.object) && !catBo(k) && (choMa || !laMa(k.object)))) continue;
    return h;
  }
  return null;
}

/* CỬ CHỈ NGÓN TAY THEO APPLE (HIG «Gestures» — cách Bản đồ / Ảnh / Xem nhanh 3D làm, 2026-10-29):
   một ngón kéo = xoay · hai ngón chụm = phóng về phía giữa hai ngón (zoomToCursor) · hai ngón kéo = dời · hai ngón VẶN = quay
   quanh trục đứng (qua ngưỡng 12° mới bắt, kẻo chụm thành quay) · chạm = chọn (xê dịch ≤ 10 px như UITapGestureRecognizer;
   chuột vẫn 4 px) · chạm HAI LẦN = bay vào điểm chạm, gần gấp đôi (không bỏ chọn vật vừa chọn) · HAI NGÓN chạm một cái = lùi
   ra gấp đôi · GIỮ yên = hiện tên vật dưới ngón (màn cảm ứng không có «rê chuột»), nhấc ra là chọn. Cú chạm nào từng có
   ngón thứ hai thì không phải cú chạm chọn (hết chụm nhấc ngón cuối từng chọn / bỏ chọn nhầm). */
const CC = { ngon: new Map(), nhieu: false, max: 0, t0: 0, xa: 0, goc: null, van: 0, dangVan: false, giu: false, hen: 0, chamTruoc: null };
const XE_DICH = (e) => (e.pointerType === "touch" ? 10 : 4);
const BAY_GIAY = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.35);
const gocHaiNgon = () => { const [a, b] = [...CC.ngon.values()]; return Math.atan2(b.y - a.y, b.x - a.x); };
function boGiu() {
  clearTimeout(CC.hen);
  if (CC.giu) { CC.giu = false; nhanDi.hidden = true; VIEN_CUM.datRe(null); }
}
canvas.addEventListener("pointerdown", (e) => {
  if (e.isPrimary) CC.ngon.clear();                               // ngón đầu của cú chạm mới: bỏ ngón nhấc ra ngoài khung còn sót
  if (!CC.ngon.size) Object.assign(CC, { nhieu: false, max: 0, t0: performance.now(), xa: 0, dangVan: false, van: 0 });
  CC.ngon.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
  CC.max = Math.max(CC.max, CC.ngon.size);
  CC.nhieu = CC.max > 1;
  CC.goc = CC.ngon.size === 2 ? gocHaiNgon() : null;
  boGiu();
  if (e.pointerType === "touch" && CC.ngon.size === 1 && GOC && !BV.bat && !doDangBat)
    CC.hen = setTimeout(() => {
      const h = ban(e);
      if (!h || CC.ngon.size !== 1) return;
      CC.giu = true;
      const c = cumCua(h.object); VIEN_CUM.datRe(c ? c.ds.filter(hienDuoc) : [h.object]);
      // nhãn nằm TRÊN ngón tay (ngón che phía dưới), lật xuống khi sát mép trên
      const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      nhanDi.textContent = tenHien(h.object.userData.ten); nhanDi.hidden = false;
      nhanDi.style.left = x + "px"; nhanDi.style.top = y + "px";
      nhanDi.style.transform = `translate(-50%, ${y - nhanDi.offsetHeight - 56 < 4 ? "40px" : "calc(-100% - 56px)"})`;
      navigator.vibrate?.(8);
      veLai(150);
    }, 500);
});
canvas.addEventListener("pointermove", (e) => {
  const n = CC.ngon.get(e.pointerId);
  if (!n) return;
  n.x = e.clientX; n.y = e.clientY;
  CC.xa = Math.max(CC.xa, Math.hypot(n.x - n.x0, n.y - n.y0));
  if (CC.xa > XE_DICH(e)) boGiu();
  // vặn hai ngón: theo ngón như xoay ảnh trên bàn — vặn thuận chiều kim đồng hồ ⇒ nhà quay thuận theo
  if (CC.ngon.size !== 2 || CC.goc == null || BV.bat || !controls.enabled || !controls.enableRotate) return;
  const g = gocHaiNgon();
  let d = g - CC.goc; d = Math.atan2(Math.sin(d), Math.cos(d));
  CC.goc = g; CC.van += d;
  if (!CC.dangVan && Math.abs(CC.van) > THREE.MathUtils.degToRad(12)) { CC.dangVan = true; d = CC.van; }
  if (CC.dangVan) { controls._rotateLeft(-d); controls.update(); veLai(150); }
});
for (const ev of ["pointerup", "pointercancel"]) canvas.addEventListener(ev, (e) => {
  if (!CC.ngon.delete(e.pointerId)) return;
  CC.goc = CC.ngon.size === 2 ? gocHaiNgon() : null;
  if (CC.ngon.size) return;
  boGiu();
  // hai ngón cùng chạm rồi nhấc nhanh, không xê dịch ⇒ lùi ra (Bản đồ Apple)
  if (ev === "pointerup" && e.pointerType === "touch" && CC.max === 2 && !CC.dangVan && CC.xa <= 10 && performance.now() - CC.t0 < 300) phongRa();
});
/* chạm hai lần: lần chạm trước ≤ 300 ms, cách ≤ 30 px (ngón) / 6 px (chuột) — trả true thì cú chạm này không chọn nữa */
function chamDoi(e) {
  const tr = CC.chamTruoc, now = performance.now();
  const doi = tr && now - tr.t < 300 && Math.hypot(e.clientX - tr.x, e.clientY - tr.y) <= (e.pointerType === "touch" ? 30 : 6);
  CC.chamTruoc = doi ? null : { t: now, x: e.clientX, y: e.clientY };
  return !!doi;
}
function phongVao(e) {
  if (BV.bat) { bvPhong(0.5, e.clientX, e.clientY); return; }
  const h = ban(e);
  if (!h) return;
  // cú chạm đầu có thể vừa BỎ chọn chính vật ấy (chạm lại vật đang chọn) — chạm hai lần luôn kết thúc với vật ấy được chọn
  if (!CT.mo && !(chon && (CUM_CHON ? cumCua(h.object) === CUM_CHON : h.object === chon))) {
    diemBam = h.object.worldToLocal(h.point.clone()); datChon(h.object);
  }
  const p = h.point, c = p.clone().add(camera.position.clone().sub(p).multiplyScalar(0.5));
  if (c.distanceTo(p) < controls.minDistance) c.copy(p).add(camera.position.clone().sub(p).setLength(controls.minDistance));
  bayToi(`c=${f3(w2m(c))};t=${f3(w2m(p))}`, BAY_GIAY());
}
function phongRa() {
  if (BV.bat) { const r = canvas.getBoundingClientRect(); bvPhong(2, r.left + r.width / 2, r.top + r.height / 2); return; }
  if (!controls.enabled || !controls.enableZoom) return;
  const t = controls.target, c = t.clone().add(camera.position.clone().sub(t).multiplyScalar(2));
  if (c.distanceTo(t) > controls.maxDistance) c.copy(t).add(camera.position.clone().sub(t).setLength(controls.maxDistance));
  bayToi(`c=${f3(w2m(c))};t=${f3(w2m(t))}`, BAY_GIAY());
}

let keo = null;
canvas.addEventListener("pointerdown", (e) => { keo = { x: e.clientX, y: e.clientY }; });
let CHAM_CUOI = null;                                           // cú chạm cuối trên khung vẽ — chặn «click» bù rơi vào nút nổi vừa hiện
canvas.addEventListener("pointerup", (e) => { CHAM_CUOI = { t: performance.now(), x: e.clientX, y: e.clientY }; }, true);
canvas.addEventListener("pointerup", (e) => {
  if (e.daDung) { keo = null; return; }                            // cú bấm đã được dùng (đo lux ở chế độ Đèn)
  if (bienDoi) { if (e.button === 0) xongBienDoi(true); keo = null; return; }
  if (vuaKeoTay) { vuaKeoTay = false; keo = null; return; }         // vừa kéo tay nắm, không phải bấm
  if (!keo || CC.nhieu || CC.xa > XE_DICH(e)) { keo = null; return; }
  keo = null;
  if (e.button !== 0) return;
  // bản đăng (chỉ xem) VẪN chọn được (chủ nhà 2026-10-10): chạm một bộ phận ⇒ thẻ nổi của CẢ CỤM + nút nổi đóng/mở nếu bộ
  // phận ấy chuyển động được. Không ghi chú, không thước đo.
  if (veMT) { chamMuiTen(e); return; }
  if (vungBat) { chamVung(e); return; }
  if (!doDangBat && chamDoi(e)) { phongVao(e); return; }
  const h = ban(e);
  if (doDangBat) { chamDo(h, e); return; }
  const v = banNhap(e);
  if (v) { chonNhap(v); return; }
  const vg = banCTGhi(e);
  if (vg) { batSua(vg.userData.gc, vg.userData.thu); return; }
  if (ctChon) chonNhap(null);
  if (CT.mo) {                                                    // CHI TIẾT: chạm bộ phận ⇒ chọn nó; chạm nền ⇒ về thông tin cả cụm
    diemBam = h ? h.object.worldToLocal(h.point.clone()) : diemBam;
    if (h && CT.phan && nhomPhanCua(h.object) === CT.phan) { chonPhanCT(null); return; }   // chạm lại phần đang chọn ⇒ bỏ chọn phần
    if (h) { datChon(h.object); if (matchMedia("(max-width: 820px)").matches) datTheCT("tt"); } else chonPhanCT(null);
    return;
  }
  if (e.shiftKey && h) { chonCong(h.object); return; }             // Shift+bấm: thêm/bớt khỏi nhóm chọn
  // chạm lại vật (cụm) đang chọn ⇒ bỏ chọn (chủ nhà 2026-10-24: «tap an object to select, tap that object again to deselect»)
  if (h && chon && !THEM.size && (CUM_CHON ? cumCua(h.object) === CUM_CHON : h.object === chon)) { diemBam = null; datChon(null); return; }
  diemBam = h ? h.object.worldToLocal(h.point.clone()) : null;   // toạ độ mô hình thật, kể cả khi đang tách lớp
  datChon(h ? h.object : null);
});
let diemBam = null;          // điểm (toạ độ mô hình) người xem bấm lần cuối — đi vào ghi chú

const nhanDi = $("nhan-di");
/* tên để HIỆN (chỉ hiển thị, không đổi dữ liệu): bỏ ngoặc trạng thái «(ĐÓNG)» «(Mở 90°)» «(lùa)»… */
const THE_NGOAC = /\s*\((?:đóng|mở|lùa|thả|cuốn|kéo|cất|hạ|nâng|gập|bật|tắt|khoá|mở khoá|voan|che|kín)(?![\p{L}])[^)]*\)/giu;
const tenHien = (ten) => String(ten || "").replace(THE_NGOAC, "").replace(/\s{2,}/g, " ").trim();
canvas.addEventListener("pointermove", (e) => {
  if (CC.giu) return;                                             // đang giữ ngón xem tên — đừng xoá nhãn vì ngón run
  if (vungBat && vungTam) { xemTruocVung(e); }
  if (keo || !GOC) { nhanDi.hidden = true; VIEN_CUM.datRe(null); return; }
  if (doDangBat) { doChuot = e; if (xemTruocDo(e)) { canvas.style.cursor = "crosshair"; return; } }
  const h = ban(e);
  if (!h) { nhanDi.hidden = true; VIEN_CUM.datRe(null); canvas.style.cursor = doDangBat ? "crosshair" : ""; return; }
  // RÊ CHUỘT (học Jig 2026-10-21): cả cụm dưới con trỏ ánh màu nhẹ + viền mảnh — chuột / bút thôi (chạm không có «rê»);
  // bản đăng chỉ xem VẪN chọn được cụm (2026-10-10) nên cũng báo trước bấm sẽ chọn gì
  if (e.pointerType !== "touch" && !doDangBat) { const c = cumCua(h.object); VIEN_CUM.datRe(c ? c.ds.filter(hienDuoc) : [h.object]); }
  const r = canvas.getBoundingClientRect();
  const p = w2m(h.point), ten = tenHien(h.object.userData.ten);
  nhanDi.textContent = doDangBat ? `${ten}  ·  +${p.z.toFixed(3)}` : ten;
  nhanDi.hidden = false;
  // nhãn lật vào trong khung vẽ khi con trỏ sát mép phải / dưới (không bị cắt)
  const x = e.clientX - r.left, y = e.clientY - r.top, nw = nhanDi.offsetWidth, nh = nhanDi.offsetHeight;
  const lx = x + 12 + nw > r.width - 4, ly = y + 12 + nh > r.height - 4;
  nhanDi.style.left = x + "px"; nhanDi.style.top = y + "px";
  nhanDi.style.transform = `translate(${lx ? `calc(-100% - 12px)` : "12px"}, ${ly ? `calc(-100% - 12px)` : "12px"})`;
  canvas.style.cursor = doDangBat ? "crosshair" : "pointer";
});
canvas.addEventListener("pointerleave", () => { nhanDi.hidden = true; VIEN_CUM.datRe(null); });

/* ── CHỌN MỘT: một vật, nhiều chỗ đứng (cửa ĐÓNG / MỞ) ───────────────────
   Mô hình khai ở nhóm cha (`chon_mot`, xem khung/xuat_glb.py); mỗi chỗ đứng là một lớp con. Ở
   đây thành MỘT công tắc: chỉ một lớp con bật, mặc định theo `mac_dinh`. Hai ô tích riêng thì bật
   được cả hai — ra hai cánh cửa ở hai chỗ cùng lúc. Trạng thái khác mặc định đi vào liên kết (?tt=). */
const CHON_MOT = new Map();        // ma → nhãn đang chọn
const LOP_CHON_MOT = new Map();    // tên lớp con → { cm, nhan }
const lopLC = (lc) => [lc.nhom, ...(lc.them || [])];        // mọi lớp của một lựa chọn công tắc
function khoiChonMot(ds) {
  const q = new Map((Q.get("tt") || "").split(",").filter(Boolean).map((x) => x.split(":")));
  for (const cm of ds) {
    for (const lc of cm.lua_chon) for (const n of lopLC(lc)) LOP_CHON_MOT.set(n, { cm, nhan: lc.nhan });
    const muon = q.get(cm.ma);
    datChonMot(cm, cm.lua_chon.some((lc) => lc.nhan === muon) ? muon : cm.mac_dinh);
  }
}
/* MÓC CHO MÔ-ĐUN KHÁC (2026-10-21, chuyen_dong.js — chỉ đọc window.XEM_HOOK, trình xem không import gì):
     XEM_HOOK.chuyenTrangThai({ ma, cm, tuNhan, denNhan, tu, den, scene, veLai, xong }) → hàm huỷ (tuỳ chọn): trình xem gọi nó
        khi cần tới đích ngay (bấm chồng, quá 4 s) — móc gỡ bản tạm, trả vật nguồn, rồi trình xem tự xong()
        mọi lần đổi thế một công tắc đi qua đây. tu = vật đang hiện của thế cũ, den = vật của thế đích (đang ẩn), cm = bản ghi
        chon_mot (lua_chon có nhãn). Móc diễn chuyển động rồi gọi xong() — xong() đổi lớp thật + capNhatHien NGAY trong lượt gọi.
        Không có móc ⇒ xong() ngay (đổi tức thì như cũ). Móc lỗi / quên gọi xong() ⇒ trình xem tự gọi sau 4 s.
     XEM_HOOK.nutHien({ ma, cm, phan, neo, tuNhan, denNhan, tu, den, scene, veLai, khungLienTuc }) · XEM_HOOK.nutAn()  — nút nổi hiện
        (neo: Vector3 thế giới, phan: lưới phần chuyển động; khungLienTuc() bật vẽ liên tục, trả hàm dừng) / ẩn.
     window.XEM_HOOK đọc LÚC GỌI (gắn sau khi trang mở vẫn ăn).
     XEM.veSau(f) — f(renderer, camera) vẽ SAU lớp viền + tập trung (đường báo không bị phủ nền); trả hàm gỡ.
     XEM.yeuCauKhung(bat) — bật/tắt vẽ liên tục trong lúc có thứ đang chuyển động (đếm lồng nhau).  */
function apLopChonMot(cm, nhan) {
  // công tắc của nút nổi đổi thế bằng BẤT KỲ đường nào (nút, thẻ, phương án, kịch bản, khôi phục) ⇒ dựng lại nút + đường báo
  // sau khi người gọi xong việc hiện/ẩn (chủ nhà 2026-10-21: đường báo cũ nằm lại sau khi đổi thế = chỉ ngược chiều)
  if (NN.cm && NN.cm.ma === cm.ma && !apLopChonMot.cho && !apLopChonMot.thu) {
    apLopChonMot.cho = true;
    queueMicrotask(() => { apLopChonMot.cho = false; if (NN.cm && NN.cm.ma === cm.ma) datNutNoi(); });
  }
  for (const lc of cm.lua_chon) for (const n of lopLC(lc)) lc.nhan === nhan ? lopTat.delete(n) : lopTat.add(n);
  // phương án THAY CẢ LỚP khác (tháp giếng trời: `an_lop` = {nhãn: [đường lớp]}) — lớp ấy tắt khi lựa chọn đang chọn,
  // giữ riêng khỏi lopTat để kịch bản / người xem tắt bật lớp không đụng nhau
  if (cm.an_lop) {
    for (const ds of Object.values(cm.an_lop)) for (const n of ds) LOP_AN_PA.delete(n);
    for (const n of cm.an_lop[nhan] || []) LOP_AN_PA.add(n);
  }
}
const lopCuaThe = (cm, t) => { const lc = cm.lua_chon.find((x) => x.nhan === t); const ns = lc ? lopLC(lc) : [];
  return PHAN.filter((o) => o.isMesh && ns.some((n) => o.userData.nhom === n || (o.userData.nhom || "").startsWith(n + " / "))); };
/* vật của thế `nhan` SẼ HIỆN nếu chuyển sang thế ấy — thử áp lớp rồi trả lại y nguyên (công tắc lồng trong thế đích: chỉ
   lấy thế con đang chọn, không lấy cả hai bản «lùa đóng / lùa mở» nằm trong «cụm mở») — cho chuyển động + đường báo */
function hienSauKhi(cm, nhan) {
  const tat = new Set(lopTat), an = new Set(LOP_AN_PA), cu = CHON_MOT.get(cm.ma);
  CHON_MOT.set(cm.ma, nhan); apLopChonMot.thu = true; apLopChonMot(cm, nhan); apLopChonMot.thu = false;
  const ra = lopCuaThe(cm, nhan).filter(hienDuoc);
  lopTat.clear(); for (const n of tat) lopTat.add(n);
  LOP_AN_PA.clear(); for (const n of an) LOP_AN_PA.add(n);
  if (cu === undefined) CHON_MOT.delete(cm.ma); else CHON_MOT.set(cm.ma, cu);
  return ra;
}
/* Lượt chuyển đang diễn theo công tắc: ma → hàm cho tới đích NGAY (bỏ chuyển động, đổi lớp của nó). Bấm lần nữa khi còn đang
   diễn (A→B rồi B→C), áp cảnh / phương án khác, hay móc treo quá 4 s ⇒ lượt cũ kết thúc gọn trước, lượt mới tính từ thế B
   đã hiện thật (soát Codex 2026-10-21: trước kia lượt sau thấy `tu` rỗng, bản tạm cũ còn chạy, vật nguồn hiện lại sai). */
/* `chay`: thao tác của NGƯỜI XEM (nút nổi, thẻ Trạng thái) ⇒ có chuyển động qua XEM_HOOK.chuyenTrangThai; nạp cảnh, phương án,
   kịch bản, khôi phục ⇒ đổi thẳng. Trong lúc diễn THẾ CŨ vẫn là sự thật (CHON_MOT, lớp, chọn, nút nổi, tô cam đều theo thế cũ;
   vật thế cũ nằm trong AN_CHUYEN — ẩn, bản tạm đang đi thay); tới đích mới ghi thế mới + đổi lớp (soát trình duyệt 2026-10-21:
   ghi trước làm nút nổi mất phần chuyển động ⇒ biến mất, cú chạm thứ hai lọt xuống mô hình, tô cam rớt giữa chừng). */
function datChonMot(cm, nhan, chay = false, sau = null) {
  // ĐI QUA THẾ GIỮA (`chon_mot.qua` = {"A>B": thế giữa}, chủ nhà 2026-10-24 — cửa xếp O03): người xem bấm A → B thì diễn A → giữa
  // rồi giữa → B, lượt sau bắt đầu khi lượt trước tới đích. Đổi thẳng (không chuyển động) thì về B ngay.
  if (chay && !sau && cm.qua) {
    const giua = cm.qua[`${CHON_MOT.get(cm.ma)}>${nhan}`];
    if (giua && giua !== nhan && cm.lua_chon.some((lc) => lc.nhan === giua)) {
      datChonMot(cm, giua, true, () => { if (CHON_MOT.get(cm.ma) === giua) { datChonMot(cm, nhan, true, () => {}); doiTrangThai(); } });
      return;
    }
  }
  // lượt đang diễn của CHÍNH công tắc này, hoặc của công tắc lồng trong / bọc ngoài nó (cụm quay ↔ cánh lùa bên trong): tới
  // đích hết trước, rồi mới tính `tu` / `den` (soát Codex vòng 2 — không thì lượt con còn chạy, bản gốc của nó đang ẩn nên
  // lượt cha bỏ sót, con tới đích vào một thế cha đã ẩn)
  if (DANG_CM.size) {
    const cua = new Set(cm.lua_chon.flatMap((lc) => lopCuaThe(cm, lc.nhan)));
    for (const [ma, f] of [...DANG_CM]) if (ma === cm.ma || f.ds?.some((o) => cua.has(o))) f();
  }
  const cu = CHON_MOT.get(cm.ma);
  const moc = chay ? window.XEM_HOOK?.chuyenTrangThai : null;
  const doi = () => { CHON_MOT.set(cm.ma, nhan); apLopChonMot(cm, nhan); };
  if (!moc || cu === undefined || cu === nhan) { doi(); if (sau) sau(); return; }
  const den = hienSauKhi(cm, nhan);
  const tu = lopCuaThe(cm, cu).filter((o) => o.visible);
  let dongBo = true, xongRoi = false, huy = null;
  const xong = () => {
    if (xongRoi) return; xongRoi = true; clearTimeout(hen);
    if (DANG_CM.get(cm.ma) === toiNgay) DANG_CM.delete(cm.ma);
    for (const o of tu) AN_CHUYEN.delete(o);
    doi();
    capNhatHien();
    if (!dongBo) doiTrangThai();                                    // muộn: dựng lại lớp, hiện/ẩn, chọn, nút nổi, thẻ, chi tiết
    if (sau) sau();                                                 // lượt nối tiếp (đi qua thế giữa)
  };
  // tới đích ngay: móc gỡ bản tạm + trả vật nguồn (huy), rồi đổi lớp — cùng một nhịp, không nháy
  const toiNgay = () => { try { if (typeof huy === "function") huy(); } catch (e) { console.warn(e); } xong(); };
  const hen = setTimeout(toiNgay, 4000);                            // móc không gọi xong() ⇒ vẫn đổi, hình không lệch trạng thái
  toiNgay.ds = [...tu, ...den];
  DANG_CM.set(cm.ma, toiNgay);
  for (const o of tu) AN_CHUYEN.add(o);
  try { huy = moc({ ma: cm.ma, cm, tuNhan: cu, denNhan: nhan, tu, den, scene, veLai, khungLienTuc, xong }); }
  catch (e) { console.warn("XEM_HOOK.chuyenTrangThai lỗi:", e); xong(); }
  dongBo = false;
}
const laDongMo = (cm) => cm.lua_chon.length === 2 && cm.lua_chon.some((lc) => lc.nhan === "Đóng") && cm.lua_chon.some((lc) => lc.nhan === "Mở");
/* Nút công tắc: HAI lựa chọn ⇒ gạt kiểu iOS một chạm (bật = lựa chọn thứ hai, vd «Mở»); ba lựa chọn trở lên ⇒ dãy nút. */
/* Mô tả lựa chọn ĐANG CHỌN của một công tắc (`chon_mot.mo_ta` = {nhãn: câu}) — phương án tháp giếng trời in số đo
   (giờ nóng, dòng khí, sáng, mưa, neo) ngay dưới nút để so khi bấm chuyển. */
function moTaChonMot(cm, noi = "ds") {
  const c = cm.mo_ta && cm.mo_ta[CHON_MOT.get(cm.ma)];
  document.querySelectorAll(`.cm-mo-ta[data-noi="${noi}"]`).forEach((x) => x.remove());
  if (!c) return null;
  const p = document.createElement("p"); p.className = "cm-mo-ta mo"; p.dataset.noi = noi; p.textContent = c;
  return p;
}
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
    g.onclick = () => { const lc = bat ? a : b; datChonMot(cm, lc.nhan, true); xong(lc); };
    return g;
  }
  const nn = document.createElement("span"); nn.className = "nhom-nut nho";
  if (cm.lua_chon.length > 3) nn.classList.add("nhieu");
  nn.setAttribute("role", "group"); nn.setAttribute("aria-label", cm.nhan);
  for (const lc of cm.lua_chon) {
    const b = document.createElement("button"); b.type = "button"; b.textContent = lc.nhan;
    b.setAttribute("aria-pressed", String(ht === lc.nhan));
    b.onclick = () => { datChonMot(cm, lc.nhan, true); xong(lc); };
    nn.append(b);
  }
  return nn;
}
/* Công tắc của một vật: vật trong lớp con của công tắc, HOẶC vật khai `cong_tac: <mã>` (phần cố định của cụm có công
   tắc — thanh đứng cố định của thang kéo: bấm vào đâu trên thang cũng thấy công tắc, chủ nhà 3D #560). */
/* Mọi công tắc chứa một vật: lớp của vật và các lớp cha (phương án lồng phương án: cánh cửa quay nằm trong «Quay hai
   cánh»), cộng công tắc vật tự khai (`cong_tac`). Trong cùng → ngoài cùng. */
function congTacCuaVat(u) {
  const ra = [], p = (u.nhom || "").split(" / ");
  for (let i = p.length; i > 0; i--) { const x = LOP_CHON_MOT.get(p.slice(0, i).join(" / ")); if (x && !ra.includes(x.cm)) ra.push(x.cm); }
  if (u.cong_tac) for (const v of LOP_CHON_MOT.values()) if (v.cm.ma === u.cong_tac) { if (!ra.includes(v.cm)) ra.push(v.cm); break; }
  return ra;
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

/* ── PHƯƠNG ÁN VẬT LIỆU (nhóm `phuong_an`, bảng data/phuong-an-vat-lieu.yaml) ─────────────────────────────────
   Mỗi cấu kiện hai ô thả xuống: LOẠI đổi HÌNH (công tắc chon_mot `pa_<mã>` — mỗi loại một lớp con, «Như hồ sơ» rỗng) ·
   MÀU đổi vật liệu PBR của phần thân (vật mang `pa_vai: than`; cao su, dải LED giữ vật liệu riêng). Cấu kiện khai
   `doi_vat_lieu_lop` (nẹp mũi bậc) không có hình riêng: đổi vật liệu mọi vật thuộc lớp có tên ấy (trừ phần phụ
   `pa_vai: phu` — dải cao su); «Như hồ sơ» trả
   vật liệu gốc. Đây là chỗ DUY NHẤT trình xem thay vật liệu của mô hình — màu đọc từ bảng, cùng trường mau/kim_loai/nham
   với khung/vat_lieu.py. Lựa chọn nhớ trong trình duyệt (`pa383`); loại khác mặc định đi vào liên kết qua ?tt= như mọi
   công tắc, và cả loại + màu đi qua ?pa=<mã>:<loại>:<màu>,… (nẹp mũi bậc không có công tắc).
   Cấu kiện khai `an_vat: [id]` vẽ lại cả trạng thái hồ sơ ⇒ vật gốc của nhóm khác ẩn khi nhóm
   phương án bật, hiện lại khi tắt nhóm. */
const PA = new Map();              // mã cấu kiện → { loai, mau }
const VL_PA = new Map();           // khoá màu → vật liệu
let PA_KHOI = false;
const PA_MO = new Set();           // thẻ phương án đang mở (ô trái)
/* VÂN RIÊNG MỖI MÀU (chủ nhà 2026-10-24: «mỗi vật liệu phải có vân riêng, không chỉ đổi màu»): mỗi màu trỏ `vl_co_san` =
   khoá pa_* có ảnh ở vat-lieu/<khoá>/ (xước · bóng · anode hạt · đồng giả cổ · nhựa · gỗ · sơn, van_vat_lieu.py). Vật liệu
   hiện ngay màu phẳng, ảnh nạp LƯỜI lần đầu chọn (KTX2 bằng bộ giải chung, hỏng ⇒ jpg) rồi gắn vào chính vật liệu ấy.
   Toạ độ vân: kênh uv1 theo MÉT (uvMetPa — cùng luật khung/xuat_glb.py _uv_met), không đụng uv gốc của vật; ảnh lặp mỗi
   `van_co` mét. Vân chạy dọc CHIỀU DÀI vật (nẹp: xước / vệt đùn / thớ gỗ dọc thanh). */
var KTX2_CHUNG;                    // var, không khởi tạo: napMoHinh (khai trên) có thể gán trước khi dòng này chạy
const VAN_PA = new Map();         // khoá vật liệu → Promise<[màu, nhám-kim loại, pháp tuyến]>
function napVanPa(vk, ktx2) {
  if (!VAN_PA.has(vk)) {
    const jpg = (t) => new Promise((ok, loi) => new THREE.TextureLoader().load(`vat-lieu/${vk}/${t}.jpg`, ok, undefined, loi));
    const nap = (t) => (!ktx2 || !KTX2_CHUNG ? jpg(t)
      : Promise.race([new Promise((ok, loi) => KTX2_CHUNG.load(`vat-lieu/${vk}/${t}.ktx2`, ok, undefined, loi)),
        new Promise((ok) => setTimeout(() => ok(null), 20000))]).catch(() => null).then((x) => x || jpg(t)));
    VAN_PA.set(vk, Promise.all(["mau", "nham", "phap"].map(nap)));
  }
  return VAN_PA.get(vk);
}
function uvMetPa(g, doc, goVan) {
  if (!g?.attributes.position || !g.attributes.normal || g.userData.uvMetPa === doc + goVan) return;
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  if (!g.boundingBox) g.computeBoundingBox();
  const c = g.boundingBox.getSize(new V3());
  const dungDoc = c.z > Math.max(c.x, c.y), nangY = c.y > c.x;   // vật đứng (nẹp má cửa) · vật nằm dọc trục y
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
    let a, b;                                                     // a = dọc chiều dài vật, b = ngang
    if (Math.abs(nz) > 0.9) [a, b] = nangY ? [y, x] : [x, y];
    else {
      const h = Math.hypot(nx, ny) || 1, tx = -ny / h, ty = nx / h;
      let bx = -nz * ty, by = nz * tx, bz = nx * ty - ny * tx;
      if (bz < 0) { bx = -bx; by = -by; bz = -bz; }
      const ngang = x * tx + y * ty, len = x * bx + y * by + z * bz;
      [a, b] = dungDoc ? [len, ngang] : [ngang, len];
    }
    if (goVan) [a, b] = [b, a];                                   // ảnh gỗ: thớ chạy theo trục v của ảnh
    uv[2 * i] = a; uv[2 * i + 1] = b;
  }
  g.setAttribute("uv1", new THREE.BufferAttribute(uv, 2));
  g.userData.uvMetPa = doc + goVan;
}
function chamPa(m) {                                             // ô màu trong bảng: mẩu ảnh vân, chưa có ảnh ⇒ màu phẳng
  const c = new THREE.Color().setRGB(...m.mau).getStyle();
  return m.vl_co_san ? `url("vat-lieu/${m.vl_co_san}/mau.jpg") center / 500% ${c}` : c;
}
function vlPa(bang, k, o) {
  const m = bang.mau[k];
  if (!m) return null;
  if (m.vl_co_san && m.van_co) {
    const go = /(^|_)go_/.test(m.vl_co_san) ? 1 : 0;
    uvMetPa(o.geometry, 1, go);
    if (o.userData.hinhGoc && o.userData.hinhGoc !== o.geometry) uvMetPa(o.userData.hinhGoc, 1, go);
  }
  if (!VL_PA.has(k)) {
    const vl = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...m.mau), metalness: m.kim_loai ?? 0,
      roughness: m.nham ?? 0.5, side: THREE.DoubleSide, name: m.ten });
    vl.userData = { dungChung: true, mau: m.mau, nham: m.nham, kim_loai: m.kim_loai };
    VL_PA.set(k, vl);
    if (m.vl_co_san && m.van_co) napVanPa(m.vl_co_san, m.van_ktx2).then(([tm, tn, tp]) => {
      for (const t of [tm, tn, tp]) {
        t.channel = 1; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / m.van_co[0], 1 / m.van_co[1]);
        t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.needsUpdate = true;
      }
      tm.colorSpace = THREE.SRGBColorSpace;
      Object.assign(vl, { map: tm, roughnessMap: tn, metalnessMap: tn, normalMap: tp, roughness: 1, metalness: 1 });
      vl.color.setRGB(1, 1, 1);
      vl.needsUpdate = true;
      veLai(60);
    }).catch((e) => console.warn("phương án vật liệu: không nạp được vân", m.vl_co_san, e));
  }
  return VL_PA.get(k);
}
const paCua = (ck) => ck.phuong_an.find((p) => p.ma === PA.get(ck.ma)?.loai) || ck.phuong_an[0];
function luuPa() {
  try { localStorage.setItem("pa383", JSON.stringify(Object.fromEntries(PA))); } catch { /* chế độ riêng tư */ }
}
function apPa(bang, ck) {
  const pa = paCua(ck), st = PA.get(ck.ma);
  if (!ck.doi_vat_lieu_lop) {
    const cm = (GOC.userData.chon_mot || []).find((c) => c.ma === "pa_" + ck.ma);
    if (cm && cm.lua_chon.some((lc) => lc.nhan === pa.ten)) datChonMot(cm, pa.ten);
  }
  const ds = ck.doi_vat_lieu_lop
    ? PHAN.filter((o) => (o.userData.nhom || "").includes(ck.doi_vat_lieu_lop) && o.userData.pa_vai !== "phu")
    : PHAN.filter((o) => o.userData.pa_cau_kien === ck.ma && o.userData.pa_vai === "than");
  for (const o of ds) {
    const u = o.userData;
    if (!u.vlGoc0) { u.vlGoc0 = u.vlGoc; u.vat_lieu_ten0 = u.vat_lieu_ten; }
    const vl = pa.mau && st.mau ? vlPa(bang, st.mau, o) : null, cu = u.vlGoc;
    u.vlGoc = vl || u.vlGoc0;
    // vật đang mang đúng vật liệu thường (không chọn / mờ / tô) ⇒ thay ngay: lượt mở trang (?pa=, lựa chọn đã nhớ) không
    // chạy apMo sau dungPhuongAn nên trước đây màu đã chọn chỉ hiện khi có nhóm khác về sau
    if (o.material === cu) { o.material = u.vlGoc; if (u.vlHien === cu) u.vlHien = u.vlGoc; }
    u.vat_lieu_ten = vl ? `${pa.ten} — ${bang.mau[st.mau].ten}` : u.vat_lieu_ten0;
  }
}
function dungPhuongAn() {
  const bang = GOC.userData.phuong_an_vat_lieu, khoi = $("khoi-pa");
  if (!khoi) return;
  khoi.hidden = !bang;
  if (!bang) return;
  PA_AN.clear();
  for (const ck of bang.cau_kien) for (const id of ck.an_vat || []) PA_AN.add(id);
  if (!PA_KHOI) {                                                 // một lần: liên kết (?tt=, ?pa=) thắng bộ nhớ trình duyệt
    PA_KHOI = true;
    let nho = {};
    try { if (!laTheNoi()) nho = JSON.parse(localStorage.getItem("pa383") || "{}"); } catch { /* bỏ */ }   // site: luôn mở ở «Như hồ sơ»
    const qPa = new Map((Q.get("pa") || "").split(",").filter(Boolean).map((x) => { const [c, l, m] = x.split(":"); return [c, { l, m }]; }));
    const qTt = new Set((Q.get("tt") || "").split(",").filter((x) => x.startsWith("pa_")).map((x) => x.split(":")[0].slice(3)));
    for (const ck of bang.cau_kien) {
      let loai = nho[ck.ma]?.loai, mau = nho[ck.ma]?.mau;
      if (qTt.has(ck.ma)) {                                      // ?tt= đã đặt công tắc ⇒ loại theo công tắc
        const cm = (GOC.userData.chon_mot || []).find((c) => c.ma === "pa_" + ck.ma);
        loai = ck.phuong_an.find((p) => p.ten === CHON_MOT.get(cm?.ma))?.ma || loai;
      }
      if (qPa.has(ck.ma)) ({ l: loai, m: mau } = qPa.get(ck.ma));
      const pa = ck.phuong_an.find((p) => p.ma === loai) || ck.phuong_an[0];
      if (!(pa.mau || []).includes(mau)) mau = pa.mau_mac_dinh || null;
      PA.set(ck.ma, { loai: pa.ma, mau });
    }
  }
  /* MỖI CẤU KIỆN MỘT THẺ GỌN (chủ nhà 2026-10-10): đầu thẻ = tên + loại, màu đang xem (chấm màu) + huy hiệu ★ nếu đang là đề
     xuất; bấm đầu thẻ mở ra: chip LOẠI (★ trên loại đề xuất), chấm MÀU (★ trên màu đề xuất), «Vì sao đề xuất · vật liệu ·
     giá» gấp lại. Loại không có màu riêng thì không có hàng màu (trước: ô thả «— theo hồ sơ —» trống). Thẻ đang mở nhớ ở
     PA_MO — dựng lại sau mỗi lần chọn không gập thẻ người xem đang xem. */
  const ds = $("ds-pa");
  ds.replaceChildren();
  const nut = document.createElement("div"); nut.className = "nhom-nut nho pa-bo";
  const coDx = bang.cau_kien.some((ck) => ck.de_xuat);            // bản đăng mang bảng rút gọn: không có đề xuất
  for (const [nhan, lay] of [...(coDx ? [["★ Xem bộ đề xuất", (ck) => ({ loai: ck.de_xuat?.loai || ck.phuong_an[0].ma, mau: ck.de_xuat?.mau || null })]] : []),
                             ["Như hồ sơ", (ck) => ({ loai: ck.phuong_an[0].ma, mau: null })]]) {
    const b = document.createElement("button"); b.type = "button"; b.textContent = nhan;
    b.onclick = () => { for (const ck of bang.cau_kien) PA.set(ck.ma, lay(ck)); doiPa(); };
    nut.append(b);
  }
  ds.append(nut);
  // CÔNG TẮC SO SÁNH PHƯƠNG ÁN (`chon_mot` mang the: "pa", chủ nhà 3D #376): mỗi công tắc một thẻ
  // luôn mở ở đầu thẻ «Phương án», dãy nút chọn thế + dòng số so sánh của thế đang xem
  for (const cm of (GOC.userData.chon_mot || []).filter((c) => c.the === "pa")) {
    const the = document.createElement("div"); the.className = "pa-the mo";
    const dau = document.createElement("div"); dau.className = "pa-dau";
    const ten = document.createElement("span"); ten.className = "pa-ten"; ten.textContent = cm.nhan;
    const hien = document.createElement("span"); hien.className = "pa-hien"; hien.textContent = CHON_MOT.get(cm.ma) || cm.mac_dinh;
    dau.append(ten, hien);
    const than = document.createElement("div"); than.className = "pa-than";
    // đổi THẲNG (không diễn chuyển động): thay cả sàn hai tầng một lượt, thẻ dựng lại ngay với số của thế mới
    const nn = document.createElement("span"); nn.className = "nhom-nut nho"; nn.setAttribute("role", "group"); nn.setAttribute("aria-label", cm.nhan);
    for (const lc of cm.lua_chon) {
      const b = document.createElement("button"); b.type = "button"; b.textContent = lc.nhan;
      b.setAttribute("aria-pressed", String((CHON_MOT.get(cm.ma) || cm.mac_dinh) === lc.nhan));
      b.onclick = () => { datChonMot(cm, lc.nhan); dungLop(GOC.userData.nhom || []); capNhatHien(); toMach(); if (chon) hienThongTin(); dungPhuongAn(); veLai(); };
      nn.append(b);
    }
    than.append(nn);
    if (cm.mo_ta) { const p = document.createElement("p"); p.className = "pa-ten-day"; p.textContent = cm.mo_ta[CHON_MOT.get(cm.ma)] || ""; than.append(p); }
    the.append(dau, than);
    ds.append(the);
  }
  const ngan = (t) => String(t || "").split(" — ")[0];             // tên loại ngắn cho chip: phần trước « — »
  const chamMau = (k) => chamPa(bang.mau[k]);
  for (const ck of bang.cau_kien) {
    if (!PA.has(ck.ma)) PA.set(ck.ma, { loai: ck.phuong_an[0].ma, mau: null });
    apPa(bang, ck);
    const pa = paCua(ck), st = PA.get(ck.ma);
    const dx = ck.de_xuat || {};
    const theoDx = !!dx.loai && pa.ma === dx.loai && (st.mau || null) === (dx.mau || null);
    const the = document.createElement("div"); the.className = "pa-the"; the.classList.toggle("mo", PA_MO.has(ck.ma));
    // đầu thẻ
    const dau = document.createElement("button"); dau.type = "button"; dau.className = "pa-dau";
    dau.setAttribute("aria-expanded", String(PA_MO.has(ck.ma)));
    const ten = document.createElement("span"); ten.className = "pa-ten"; ten.textContent = ck.ten;
    const hien = document.createElement("span"); hien.className = "pa-hien";
    if (pa.mau?.length && st.mau && bang.mau[st.mau]) {
      const c = document.createElement("i"); c.className = "pa-cham"; c.style.background = chamMau(st.mau); hien.append(c);
    }
    hien.append(ngan(pa.ten) + (pa.mau?.length && st.mau && bang.mau[st.mau] ? " · " + bang.mau[st.mau].ten : ""));
    dau.append(ten, hien);
    if (theoDx) { const h = document.createElement("span"); h.className = "pa-huy dang"; h.textContent = "★ Đề xuất"; dau.append(h); }
    else if (dx.loai) { const h = document.createElement("span"); h.className = "pa-huy"; h.textContent = "★ có đề xuất"; dau.append(h); }
    dau.onclick = () => { PA_MO.has(ck.ma) ? PA_MO.delete(ck.ma) : PA_MO.add(ck.ma); the.classList.toggle("mo", PA_MO.has(ck.ma)); dau.setAttribute("aria-expanded", String(PA_MO.has(ck.ma))); };
    // thân thẻ: chip loại
    const than = document.createElement("div"); than.className = "pa-than";
    const chips = document.createElement("div"); chips.className = "chip-loc pa-loai"; chips.setAttribute("role", "radiogroup"); chips.setAttribute("aria-label", `${ck.ten} — loại`);
    for (const p of ck.phuong_an) {
      const b = document.createElement("button"); b.type = "button"; b.className = "chip";
      b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(p.ma === pa.ma)); b.setAttribute("aria-pressed", String(p.ma === pa.ma));
      b.textContent = (p.ma === dx.loai ? "★ " : "") + ngan(p.ten); b.title = p.ten;
      b.onclick = () => { PA.set(ck.ma, { loai: p.ma, mau: (p.mau || []).includes(st.mau) ? st.mau : p.mau_mac_dinh || null }); doiPa(); };
      chips.append(b);
    }
    than.append(chips);
    const tenDay = document.createElement("p"); tenDay.className = "pa-ten-day"; tenDay.textContent = pa.ten; than.append(tenDay);
    // chấm màu (chỉ khi loại này có màu)
    if (pa.mau?.length) {
      const hm = document.createElement("div"); hm.className = "pa-mau"; hm.setAttribute("role", "radiogroup"); hm.setAttribute("aria-label", `${ck.ten} — màu`);
      for (const k of pa.mau) {
        const b = document.createElement("button"); b.type = "button"; b.className = "pa-o-mau";
        b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(k === st.mau));
        b.title = bang.mau[k].ten + (pa.ma === dx.loai && k === dx.mau ? " — ★ đề xuất" : "");
        b.setAttribute("aria-label", b.title);
        const c = document.createElement("i"); c.style.background = chamMau(k); b.append(c);
        if (pa.ma === dx.loai && k === dx.mau) b.classList.add("de-xuat");
        b.onclick = () => { PA.set(ck.ma, { loai: pa.ma, mau: k }); doiPa(); };
        hm.append(b);
      }
      than.append(hm);
    }
    // gấp: lý do đề xuất + vật liệu · thi công · giá
    const ct = document.createElement("details");
    const tom = document.createElement("summary"); tom.textContent = dx.loai ? "Vì sao đề xuất · vật liệu · giá" : "Vật liệu · thi công · giá";
    ct.append(tom);
    if (dx.loai) {
      const ly = document.createElement("p"); ly.className = "pa-dx";
      ly.textContent = (theoDx ? "★ Đang xem đề xuất. " : `★ Đề xuất: ${ck.phuong_an.find((x) => x.ma === dx.loai)?.ten}${dx.mau ? " — " + bang.mau[dx.mau].ten : ""}. `) + (dx.ly_do || "");
      ct.append(ly);
      if (!theoDx) {
        const b = document.createElement("button"); b.type = "button"; b.className = "nut-nho"; b.textContent = "★ Xem đề xuất này";
        b.onclick = () => { PA.set(ck.ma, { loai: dx.loai, mau: dx.mau || null }); doiPa(); };
        ct.append(b);
      }
    }
    const dong = (nhan, chu) => { if (!chu) return; const p_ = document.createElement("p"); const b_ = document.createElement("b"); b_.textContent = nhan + ": "; p_.append(b_, chu); ct.append(p_); };
    dong("Ở đâu", ck.o_dau); dong("Khối lượng", ck.khoi_luong);
    dong("Vật liệu", pa.vat_lieu); dong("Quy cách", pa.quy_cach); dong("Nguồn", (pa.nguon_ref || []).join(", "));
    dong("Giá tham khảo", pa.gia_tham_khao); dong("Lưu ý", pa.luu_y);
    if (pa.thi_cong?.length) {
      const ul = document.createElement("ul");
      for (const t of pa.thi_cong) { const li = document.createElement("li"); li.textContent = t; ul.append(li); }
      dong("Thi công", " "); ct.append(ul);
    }
    if (ct.children.length > 1) than.append(ct);                 // bản đăng: không có gì để gấp
    the.append(dau, than);
    ds.append(the);
  }
}
/* PHƯƠNG ÁN VẬT LIỆU CỦA CỤM (chủ nhà 3D #976 → menu «Phương án» của thẻ cụm, 2026-10-21): mọi cấu kiện phương án ÁP VÀO
   một vật của cụm — vật hình phương án (`pa_cau_kien`), vật thuộc lớp cấu kiện đổi vật liệu (`doi_vat_lieu_lop`), vật cấu kiện vẽ
   lại (`an_vat`), và vật hồ sơ chạm hộp bao của hình phương án (tường ốp mà nẹp mép nằm trên, ô cửa mà nẹp sàn chạy qua).
   Bản đăng tải nhóm phương án khi cần: chưa tải thì chưa biết hộp bao ⇒ chỉ hiện ở thẻ của chính hình phương án. */
const HOP_PA = new Map();                // mã cấu kiện → hộp bao (toạ độ mô hình) TỪNG hình phương án của nó, kể cả loại đang ẩn
function hopPa(ck) {                     // từng hộp, không gộp: nẹp sàn ở ba cửa gộp lại thành một hộp phủ nửa tầng
  if (!HOP_PA.has(ck.ma)) {
    const ds = PHAN.filter((o) => o.isMesh && o.userData.pa_cau_kien === ck.ma);
    if (!ds.length) return null;                                         // nhóm phương án chưa tải: hỏi lại lần sau
    HOP_PA.set(ck.ma, ds.map((o) => hopVat(o).clone().expandByScalar(0.02)));
  }
  return HOP_PA.get(ck.ma);
}
function paApVao(u) {
  const bang = GOC.userData.phuong_an_vat_lieu;
  if (!bang || !u || u.ma || u.phan_tich) return [];
  const o = THEO_ID.get(u.id), hop = o && o.isMesh ? hopVat(o) : null;
  return bang.cau_kien.filter((ck) => u.pa_cau_kien === ck.ma
    || (ck.doi_vat_lieu_lop && (u.nhom || "").includes(ck.doi_vat_lieu_lop) && u.pa_vai !== "phu")
    || (ck.an_vat || []).includes(u.id)
    || (!u.pa_cau_kien && hop && (hopPa(ck) || []).some((h) => h.intersectsBox(hop))));
}
function doiPa() {
  if (!laTheNoi()) luuPa();
  dungPhuongAn();
  dungLop(GOC.userData.nhom || []);
  capNhatHien(); apMo();
  if (chon) hienThongTin();
  veLai(200);
}

/* ── lớp + tìm ─────────────────────────────────────────────────────────── */
function dungLop(nhom) {
  const dem = new Map(), lkCua = new Map();                       // lớp → số vật · lớp → nhóm kết cấu chứa nó
  for (const o of PHAN) if (!o.userData.ma && !o.userData.phan_tich && !lkTat.has(o.userData.linh_kien)) {   // lớp của nhóm kết cấu đang tắt thì không liệt kê
    dem.set(o.userData.nhom, (dem.get(o.userData.nhom) || 0) + 1);
    if (!lkCua.has(o.userData.nhom)) lkCua.set(o.userData.nhom, o.userData.linh_kien);
  }
  /* một dòng có công tắc: nhãn + số (mờ) + [nút phụ] + công tắc gạt; bấm cả dòng là gạt */
  const dong = (ul, nhan, so, bat, doi, tieuDe) => {
    const li = document.createElement("li"); li.className = "cay-lop";
    const lb = document.createElement("label"); lb.className = "cay-hang";
    const t = document.createElement("span"); t.className = "cay-nhan"; t.textContent = nhan;
    if (so !== "") { const s = document.createElement("span"); s.className = "so"; s.textContent = so; t.append(" ", s); }
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.className = "cong-tac"; cb.checked = bat;
    cb.onchange = () => { doi(cb.checked); capNhatHien(); };
    lb.append(t, cb); li.append(lb); ul.append(li);
    if (tieuDe) li.title = tieuDe;
    return li;
  };
  const conCua = new Map([...document.querySelectorAll("#ds-lk > li.cay-nhom")].map((li) => [li.dataset.lk, li.querySelector(":scope > ul.lop-con")]));
  for (const ul of conCua.values()) ul.replaceChildren();
  const lopCo = nhom.filter((n) => dem.has(n) && !LOP_CHON_MOT.has(n));   // lớp con của công tắc: lái bằng công tắc
  const coTen = new Set(lopCo);
  for (const n of lopCo) {
    const ul = conCua.get(lkCua.get(n));
    if (!ul) continue;
    // tên lớp là đường dẫn «A / B / C»: chỉ hiện đoạn cuối, thụt vào theo số lớp cha đang có trong danh sách
    const doan = n.split(" / ");
    let sau = 0;
    for (let i = 1; i < doan.length; i++) if (coTen.has(doan.slice(0, i).join(" / "))) sau++;
    const li = dong(ul, doan[doan.length - 1], dem.get(n), !lopTat.has(n), (v) => (v ? lopTat.delete(n) : lopTat.add(n)), n);
    if (sau) li.style.setProperty("--sau", sau);
    const mo = document.createElement("button");
    mo.type = "button"; mo.className = "nut-mo"; mo.textContent = "◐";
    mo.title = "Xem xuyên: vẽ lớp này như khối tham chiếu (mờ, bấm xuyên qua)";
    mo.setAttribute("aria-label", "Xem xuyên lớp " + doan[doan.length - 1]);
    mo.setAttribute("aria-pressed", String(lopMo.has(n)));
    mo.onclick = (e) => { e.preventDefault(); lopMo.has(n) ? lopMo.delete(n) : lopMo.add(n); mo.setAttribute("aria-pressed", String(lopMo.has(n))); apMo(); };
    li.querySelector("input").before(mo);
  }
  for (const [ma, ul] of conCua) {
    if (ul.children.length) continue;
    const li = document.createElement("li"); li.className = "cay-trong mo";
    li.textContent = lkTat.has(ma) ? "Nhóm đang tắt — bật để xem các lớp." : "Nhóm này không chia lớp.";
    ul.append(li);
  }
  // khối tham chiếu: một dòng riêng cuối cây
  const lk = $("ds-lk");
  lk.querySelector(":scope > li.cay-ma")?.remove();
  const soMa = PHAN.filter((o) => o.userData.ma).length;
  if (soMa) dong(lk, "Khối tham chiếu (không thi công)", soMa, hienMa, (v) => (hienMa = v)).classList.add("cay-ma");
  dungCongTac(dem, lkCua);
}

/* ── TRẠNG THÁI: công tắc cửa, rèm, ngăn kéo… (chủ nhà 2026-10-10: 56 dòng một cột khó tìm) ──
   Lọc theo LOẠI (dải chip: Cửa · Cửa sổ, lam · Rèm · Tủ, ngăn kéo · Khác) và xếp theo NHÓM KẾT CẤU (Tầng 1, Bếp tầng 1…) —
   nhóm là chỗ ở trong nhà. Tiền tố trùng tên nhóm («Bếp · », «Tầng 1 (Trệt) · ») bỏ khỏi nhãn. Mỗi dòng cao ≥ 44:
   hai thế ⇒ gạt, nhiều thế ⇒ dãy nút cả bề ngang dưới tên. «Đóng hết / Mở hết» chỉ áp cho các công tắc đang lọc. */
const LOAI_CT = [
  ["cua", "Cửa"], ["cua-so", "Cửa sổ, lam"], ["rem", "Rèm"], ["tu", "Tủ, ngăn kéo"], ["khac", "Khác"],
];
let locCt = "";
function loaiCongTac(nhan) {
  const s = boDau(nhan);
  if (/\brem\b/.test(s)) return "rem";
  if (/la lat|mieng xa|dong khi|gian phoi|thang keo/.test(s)) return "khac";
  if (/^(tu|bep|ngan|canh thap)\b/.test(s)) return "tu";              // «Tủ trên cửa sổ» là tủ, không phải cửa sổ
  if (/cua so|lam mat tien|canh truot|mu kinh/.test(s)) return "cua-so";
  if (/\bcua\b|khoa/.test(s)) return "cua";
  if (/\btu\b|ngan|\bke\b|canh thap|^bep/.test(s)) return "tu";
  return "khac";
}
function dungCongTac(dem, lkCua) {
  const cmK = $("ds-chon-mot");
  cmK.replaceChildren();
  // Công tắc phương án có thể chỉ chứa nhóm con (cánh cửa, phụ kiện), không có lưới trực tiếp.
  const lopCua = (nhom) => [...dem.keys()].find((n) => n === nhom || n.startsWith(nhom + " / "));
  const tenLk = new Map((DM?.linh_kien || []).map((x) => [x.ma, x.ten]));
  const ds = [];
  for (const cm of GOC.userData.chon_mot || []) {
    if (cm.ma.startsWith("pa_")) continue;                          // phương án vật liệu: lái bằng ô «Phương án vật liệu»
    if (cm.the === "pa") continue;                                  // công tắc so sánh phương án (cỡ gạch…): ở thẻ «Phương án»
    const lc = cm.lua_chon.map((x) => lopCua(x.nhom)).find(Boolean);
    if (!lc) continue;                                              // nhóm kết cấu mang nó đang tắt
    if (cm.lua_chon.every((x) => lopTatCha(x.nhom) || lopAnPa(x.nhom))) continue;   // nằm trong phương án / lựa chọn đang ẩn
    ds.push({ cm, loai: loaiCongTac(cm.nhan), cho: tenLk.get(lkCua.get(lc)) || "Khác" });
  }
  if (!ds.length) { cmK.hidden = true; return; }
  cmK.hidden = false;
  const demLoai = new Map();
  for (const x of ds) demLoai.set(x.loai, (demLoai.get(x.loai) || 0) + 1);
  if (locCt && !demLoai.has(locCt)) locCt = "";
  const dungLai = () => { dungLop(GOC.userData.nhom || []); capNhatHien(); toMach(); if (chon) hienThongTin(); };
  // dải chip lọc
  const loc = document.createElement("div"); loc.className = "chip-loc"; loc.setAttribute("role", "group"); loc.setAttribute("aria-label", "Lọc theo loại");
  for (const [ma, ten] of [["", "Tất cả"], ...LOAI_CT]) {
    if (ma && !demLoai.has(ma)) continue;
    const b = document.createElement("button"); b.type = "button"; b.className = "chip";
    b.setAttribute("aria-pressed", String(locCt === ma));
    b.innerHTML = `<span></span> <span class="so"></span>`;
    b.firstChild.textContent = ten; b.lastChild.textContent = ma ? demLoai.get(ma) : ds.length;
    b.onclick = () => { locCt = ma; dungCongTac(dem, lkCua); };
    loc.append(b);
  }
  cmK.append(loc);
  const hien = ds.filter((x) => !locCt || x.loai === locCt);
  const hai = hien.filter((x) => laDongMo(x.cm)).map((x) => x.cm);
  if (hai.length > 1) {                                            // «Mở hết / Đóng hết» — chỉ công tắc Đóng|Mở đang lọc
    const hang = document.createElement("div"); hang.className = "hang-cm hang-het";
    const t = document.createElement("span"); t.textContent = `Cả ${hai.length} cánh`;
    const nn = document.createElement("span"); nn.className = "nhom-nut nho";
    for (const nhan of ["Đóng", "Mở"]) {
      const b = document.createElement("button"); b.type = "button"; b.textContent = nhan === "Mở" ? "Mở hết" : "Đóng hết";
      b.onclick = () => { for (const cm of hai) datChonMot(cm, nhan, true); dungLai(); };
      nn.append(b);
    }
    hang.append(t, nn); cmK.append(hang);
  }
  let cho = null;
  for (const x of [...hien].sort((a, b) => (a.cho === b.cho ? 0 : ds.findIndex((y) => y.cho === a.cho) - ds.findIndex((y) => y.cho === b.cho)))) {
    if (x.cho !== cho) {
      cho = x.cho;
      const h = document.createElement("h4"); h.className = "cm-cho"; h.textContent = cho; cmK.append(h);
    }
    const hang = document.createElement("div"); hang.className = "hang-cm";
    const t = document.createElement("span"); t.className = "cm-ten";
    // bỏ tiền tố trùng tên nhóm: «Bếp · A1 giá…» dưới «Bếp tầng 1» → «A1 giá…»
    const m = x.cm.nhan.match(/^(.+?)\s+(?:·|—)\s+(.+)$/);
    const goc = m && boDau(m[1].replace(/\s*\(.*?\)\s*/g, " ").trim());
    let nhan = m && goc && boDau(cho).startsWith(goc) ? m[2] : x.cm.nhan;
    nhan = nhan.charAt(0).toUpperCase() + nhan.slice(1);
    t.textContent = nhan; t.title = x.cm.nhan;
    hang.append(t, nutCongTac(x.cm, dungLai));
    cmK.append(hang);
    if (x.cm.mo_ta) { const p = document.createElement("p"); p.className = "cm-mo-ta mo"; p.textContent = x.cm.mo_ta[CHON_MOT.get(x.cm.ma)] || ""; cmK.append(p); }
  }
}
if ($("nut-vien")) {
  if (!NET) $("nut-vien").hidden = true;                          // ?vien=0: không có lượt nét viền
  else { $("nut-vien").setAttribute("aria-pressed", String(NET.bat())); $("nut-vien").onclick = () => NET.dat(!NET.bat()); }
}

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

$("tt-dong").onclick = () => datChon(null);

/* ── mặt cắt ───────────────────────────────────────────────────────────── */
let trucCat = "z";
let catViTriM = null;        // vị trí cắt CHÍNH XÁC (m, toạ độ mô hình) do catM/mặt cắt sẵn đặt; kéo thanh trượt là bỏ
let catMHien = null;         // vị trí cắt đang vẽ (m, toạ độ mô hình) — cho XEM.trangThai (kịch bản 3D)
/* Thanh trượt cắt chạy trên hộp bao NGÔI NHÀ — bỏ bối cảnh `nha_ben` (nhà hàng xóm, hẻm), không thì cả đoạn đầu kéo chỉ
   cắt qua nhà bên mà nhà mình chưa đổi (chủ nhà 2026-10-18). Chỉ nạp mỗi bối cảnh thì lấy nó. */
function hopCat() {
  const bb = new THREE.Box3(), tatCa = new THREE.Box3();
  for (const o of PHAN) if (!o.userData.ma) {
    o.geometry.computeBoundingBox(); tatCa.union(o.geometry.boundingBox);
    if (o.userData.linh_kien !== "nha_ben") bb.union(o.geometry.boundingBox);
  }
  return bb.isEmpty() ? tatCa : bb;
}
function capNhatCat() {
  if ($("bang-cat").hidden) { renderer.clippingPlanes = []; matCat = null; datNapCat(); return; }
  for (const b of document.querySelectorAll("[data-truc]")) b.setAttribute("aria-pressed", String(b.dataset.truc === trucCat));
  const k = { x: 0, y: 1, z: 2 }[trucCat];
  const bb = hopCat();
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
  const bb = hopCat();
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
  xop_pu: [0xeedc9e, 0xa88f3a, 5, 6],
  bac_ton: [0xd4d8dd, 0xd4d8dd, 0, 0],
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
for (const m of [VL_GACH_KINH, VIEN, VIEN_CHON, VL_KHOANG, VL_KHOI_PHONG, ...Object.values(VL_DEM)]) m.userData.dungChung = true;   // giaiPhong() không huỷ
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
/* CHỈ KHỐI CẮT NGANG MẶT PHẲNG (soát hiệu năng 2026-10-21, chủ nhà: «performance top notch» — điện thoại cắt tầng ~30 ms/
   khung): khối nằm trọn một phía mặt cắt đếm vào rồi đếm ra (phía hiện) hoặc bị xén hết (phía khuất) — luôn để stencil 0, vẽ
   chỉ tốn công. Chỉ giữ khối có cầu bao cắt ngang mặt phẳng; nhóm vật liệu không còn khối nào thì bỏ cả lô đếm lẫn tấm nắp
   (một tấm phủ kín màn hình mỗi nhóm). Cầu bao xét lại khi mặt cắt đổi hoặc khối dời. */
const _cauCat = new THREE.Sphere();
let catKhoa = "";
function dongBoDem() {
  if (!matCat) return;
  const khoa = `${matCat.normal.x},${matCat.normal.y},${matCat.normal.z},${matCat.constant}`, doiCat = khoa !== catKhoa;
  catKhoa = khoa;
  for (const g of NAP) {
    const co = [0, 0];                                          // [thường, mờ]: số khối đang đếm của nhóm
    for (const d of g.dem) {
      const bm = d.bm;
      let n = 0;
      for (const x of d.vat) {
        const o = x.o, e = o.matrixWorld.elements, m = x.mt;
        const doi = e[12] !== m[12] || e[13] !== m[13] || e[14] !== m[14] || e[0] !== m[0] || e[5] !== m[5] || e[10] !== m[10] || e[1] !== m[1];
        if (doi || doiCat || x.ngang === undefined) {
          const gm = o.geometry; if (!gm.boundingSphere) gm.computeBoundingSphere();
          _cauCat.copy(gm.boundingSphere).applyMatrix4(o.matrixWorld);
          x.ngang = Math.abs(matCat.distanceToPoint(_cauCat.center)) <= _cauCat.radius + 1e-4;
        }
        if (doi) { bm.setMatrixAt(x.iid, o.matrixWorld); m.set(e); }   // cả khi đang ẩn: không thì cầu bao xét lại mỗi khung
        const hien = x.ngang && o.visible && !!o.userData.moNap === d.laMo;
        if (hien !== x.hien) { bm.setVisibleAt(x.iid, hien); x.hien = hien; }
        if (hien) n++;
      }
      bm.visible = n > 0;
      co[d.laMo ? 1 : 0] += n;
    }
    g.nap.visible = co[0] > 0; g.napMo.visible = co[1] > 0;
  }
}

/* ── CỘT LỚP — chỉ còn cho máy (chup.mjs --cot, XEM.cotLop): tia thẳng đứng đi xuống (−z mô hình) qua MỌI vật thể đang
   hiện tại (x, y) → danh sách từ trên xuống: tên, vật liệu, cao độ đỉnh/đáy, dày, khe tới lớp dưới. Toạ độ MÔ HÌNH (đọc qua
   worldToLocal của chính vật ⇒ đúng cả khi đang tách lớp). Nút «Cột lớp», phím L và bảng nổi đã gỡ (chủ nhà 2026-10-25). */
function fmm(m) {
  const v = m * 1000;
  return Math.abs(v) < 10 ? v.toLocaleString("vi-VN", { maximumFractionDigits: 1 }) : Math.round(v).toLocaleString("vi-VN");
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
  return hang.map((h, i) => ({
    id: h.o.userData.id, ten: h.o.userData.ten, vat_lieu: h.o.userData.vat_lieu_ten || h.o.userData.vat_lieu,
    tren: +h.tren.toFixed(4), duoi: +h.duoi.toFixed(4), day_mm: +((h.tren - h.duoi) * 1000).toFixed(1),
    khe_mm: i + 1 < hang.length ? +((h.duoi - hang[i + 1].tren) * 1000).toFixed(1) : null,
  }));
}

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
// kheLop(i): khe riêng của lớp i trong lúc tách so le (tachDan) — mặc định mọi lớp cùng khe
function tachLop(khe, kheLop = null) {
  const ds = lopBoc();
  if (!ds.length) return 0;
  tachKhe = Math.max(0, Math.min(0.6, Number(khe) || 0));
  if (!kheLop) tachLopHien.clear();               // đặt thẳng (thanh trượt, cảnh, chụp) ⇒ hết so le
  const N = ds.length;
  // tach_lech (vật mang thuộc tính này): vẫn thuộc lớp ấy nhưng hạ thêm tach_lech × khe — tách ra thấy rõ là một lớp riêng
  for (const o of PHAN) { const i = o.userData.lopBoc; o.position.z = i >= 0 ? ((N - 1 - i) + (Number(o.userData.tach_lech) || 0)) * (kheLop ? kheLop(i) : tachKhe) : 0; }
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
  if (bat) { thoiThem(); huyVung(); }
  doDangBat = bat;
  $("bang-do").hidden = !bat;
  $("nut-do").setAttribute("aria-pressed", String(bat));
  diemDo = null; nhomDo.clear();
  $("do-kq").textContent = "Thước: bấm điểm thứ nhất (bắt vào đỉnh gần nhất · giữ Alt để không bắt · giữ Shift để đo thẳng theo trục). Esc: thôi";
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
/* ĐIỂM CUỐI của thước theo con trỏ (sau khi có điểm thứ nhất). Thường: điểm bắt trên mặt vật (như cú bấm). Giữ Shift: khoá
   theo trục mô hình X / Y / Z gần hướng con trỏ nhất trên màn hình — điểm cuối là chỗ tia nhìn qua con trỏ gần trục ấy nhất,
   nên đo thẳng được cả khi đầu kia lơ lửng giữa không trung. Trả { p (THẾ GIỚI), truc: 0|1|2|-1 } hoặc null. */
function diemCuoiDo(e, h) {
  if (!diemDo) return null;
  if (!e.shiftKey) return h ? { p: batDinh(h, e.altKey), truc: -1 } : null;
  const r = canvas.getBoundingClientRect();
  chuot.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(chuot, camera);
  const o = ray.ray.origin, d = ray.ray.direction, A = diemDo;
  const sp = (v) => { const q = v.clone().project(camera); return new THREE.Vector2((q.x + 1) * r.width / 2, (1 - q.y) * r.height / 2); };
  const a0 = sp(A), lech = new THREE.Vector2(e.clientX - r.left, e.clientY - r.top).sub(a0);
  if (lech.length() < 2) return { p: A.clone(), truc: -1 };
  const goc0 = m2w(0, 0, 0);
  let tot = null;
  for (let k = 0; k < 3; k++) {
    const u = m2w(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0).sub(goc0).normalize();
    const s = sp(A.clone().add(u)).sub(a0);
    if (s.length() < 1e-3) continue;                                   // nhìn dọc trục ⇒ không chọn được trục ấy
    const cos = Math.abs(s.normalize().dot(lech.clone().normalize()));
    if (tot && cos <= tot.cos) continue;
    const b = u.dot(d), w = A.clone().sub(o), mau = 1 - b * b;          // điểm trên trục gần tia nhìn nhất
    if (mau < 1e-6) continue;
    const t = (b * d.dot(w) - u.dot(w)) / mau;
    tot = { cos, p: A.clone().addScaledVector(u, t), truc: k };
  }
  return tot && { p: tot.p, truc: tot.truc };
}
const MAU_TRUC = [0xd8473a, 0x3f9b3a, 0x2f6fd0];                    // X đỏ · Y lục · Z lam (như Blender)
let doTam = null;                                                       // đường + chấm xem trước đi theo con trỏ (dựng lần đầu dùng)
const dungDoTam = () => {
  const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(), new V3()]), new THREE.LineBasicMaterial({ color: MAU_NHAP, depthTest: false }));
  const cau = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: MAU_NHAP, depthTest: false }));
  ln.renderOrder = cau.renderOrder = 11; ln.frustumCulled = false;
  return { ln, cau };
};
let doChuot = null;                                                     // sự kiện chuột cuối (cho Shift nhấn / nhả tại chỗ)
function xemTruocDo(e) {
  if (!doDangBat || !diemDo || !e) return false;
  const k = diemCuoiDo(e, e.shiftKey ? null : ban(e));
  doTam ||= dungDoTam();
  if (!k) { nhomDo.remove(doTam.ln, doTam.cau); return false; }
  const mau = k.truc >= 0 ? MAU_TRUC[k.truc] : MAU_NHAP;
  doTam.ln.geometry.setFromPoints([diemDo, k.p]); doTam.ln.material.color.setHex(mau);
  doTam.cau.position.copy(k.p); doTam.cau.scale.setScalar(camera.position.distanceTo(k.p) / 250); doTam.cau.material.color.setHex(mau);
  if (!doTam.ln.parent) nhomDo.add(doTam.ln, doTam.cau);
  const d = w2m(k.p).sub(w2m(diemDo));
  nhanDi.textContent = `${mm(d.length())} mm` + (k.truc >= 0 ? `  ·  theo ${"XYZ"[k.truc]}` : `  ·  Δx ${mm(Math.abs(d.x))} · Δy ${mm(Math.abs(d.y))} · Δz ${mm(Math.abs(d.z))}`);
  $("do-kq").textContent = `Bấm điểm thứ hai — ${mm(d.length())} mm. Giữ Shift: đo thẳng theo trục X / Y / Z.`;
  const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  nhanDi.hidden = false;
  const lx = x + 12 + nhanDi.offsetWidth > r.width - 4, ly = y + 12 + nhanDi.offsetHeight > r.height - 4;
  nhanDi.style.left = x + "px"; nhanDi.style.top = y + "px";
  nhanDi.style.transform = `translate(${lx ? `calc(-100% - 12px)` : "12px"}, ${ly ? `calc(-100% - 12px)` : "12px"})`;
  veLai(60);
  return true;
}
for (const t of ["keydown", "keyup"]) addEventListener(t, (e) => {
  if (e.key !== "Shift" || !doDangBat || !diemDo || !doChuot) return;
  const { clientX, clientY, altKey } = doChuot;
  xemTruocDo({ clientX, clientY, altKey, shiftKey: t === "keydown" });
});
function chamDo(h, e) {
  if (diemDo && e && e.shiftKey) { const k = diemCuoiDo(e, null); if (k) { h = { daCo: k.p }; } }
  if (!h) return;
  const p = h.daCo || batDinh(h, e && e.altKey);
  if (!diemDo) {
    diemDo = p;
    const cau = new THREE.Mesh(new THREE.SphereGeometry(camera.position.distanceTo(p) / 250, 12, 8), new THREE.MeshBasicMaterial({ color: MAU_NHAP, depthTest: false }));
    cau.position.copy(p); cau.renderOrder = 10; nhomDo.add(cau);
    $("do-kq").textContent = "Bấm điểm thứ hai — giữ Shift để đo thẳng theo trục X / Y / Z.";
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
  for (const el of [...lopNhan.children, ...lopKT.children, ...(typeof lopBV !== "undefined" ? lopBV.children : []), ...(typeof lopNhanNoi !== "undefined" ? lopNhanNoi.children : [])]) {
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
  // CHI TIẾT CỤM có thước riêng (THUOC_CUM) ⇒ thước đã lưu chỉ vẽ ở khung chính. Thước của MỘT vật hiện khi chọn bất kỳ
  // bộ phận nào cùng cụm với nó (chạm nan lan can vẫn thấy thước tay vịn đã lưu).
  if (!chon || !KT.ds.length || CT.mo) { KT.goc = ""; veLai(60); return; }
  const u = chon.userData, cung = new Set((CUM_CHON?.ds || [chon]).map((o) => o.userData.id));
  for (const t of KT.ds) {
    if (!(t.loai === "vat" ? cung.has(t.muc) : khopKT(t, u))) continue;
    const vat = t.loai === "vat" ? THEO_ID.get(t.muc) : null;
    if (t.loai === "vat" && !(vat && vat.visible)) continue;
    const ds = t.loai === "vat" ? [vat] : PHAN.filter((o) => o.visible && (!t.lk || o.userData.linh_kien === t.lk) && trongLop(o.userData, t.muc));
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
/* ── BẢN VẼ KÍCH THƯỚC (chủ nhà 2026-10-27: nút «Kích thước» của trang việc, chế độ MẶC ĐỊNH của mọi mục) ──────────────
   Nhìn thẳng vuông góc mặt chính của các vật đang làm nổi — góc nhìn hẹp 2° từ xa nên gần như chiếu song song, đo trên hình
   không méo — khoá xoay, chỉ còn kéo và phóng (phóng = thu góc nhìn, không tiến camera lại gần). Mặt chính = trục mà các bộ
   phận mỏng nhất, cân theo diện tích mặt (cánh cửa → mặt đứng, lớp sàn → mặt bằng). Đường ghi mm, đặt ngoài vật:
   hàng trong = chuỗi mép của từng bộ phận (hộp bao theo trục mô hình), hàng ngoài = kích thước tổng; mặt đứng thêm mặt sàn
   nền đang hiện ngay dưới vật (đo cao từ sàn). Số là số dựng: lấy từ chính hình học của mô hình, làm tròn mm. */
const BV = { bat: false, fov0: camera.fov, truc: null, zoom: null };
const nhomBV = new THREE.Group();
nhomBV.renderOrder = 14;
const lopBV = document.createElement("div");
lopBV.id = "lop-bv";
lopKT.after(lopBV);
const VL_BV = new THREE.LineBasicMaterial({ color: 0x1d1d1b, depthTest: false, transparent: true });
VL_BV.userData.dungChung = true;
const BV_FOV = 2;
function vatBV() {
  const hien = PHAN.filter((o) => o.isMesh && o.visible && o.geometry);
  const noi = NOI_BAT ? hien.filter((o) => noiBatCo(o)) : hien;
  // mục có làm nổi mà nhóm của vật làm nổi chưa tải xong ⇒ CHƯA có gì để vẽ (đừng vẽ nền thay — tôn mái thành «bản vẽ»);
  // lượt vẽ lại sau READY lo phần còn lại
  return NOI_BAT ? noi : hien;
}
function banVe(bat, chi = null, bp = null, lai = false) {          // lai: lượt vẽ lại sau khi nhóm tải chậm xong — không hẹn thêm                       // chi: mã vật của MỘT bộ phận — chỉ ghi kích thước nó · bp: tên bộ phận
  if (!GOC) return false;
  xoaCon(nhomBV); lopBV.replaceChildren();
  if (!bat) {
    if (BV.noiBp && NOI_BAT === BV.noiBp) { NOI_BAT = BV.noi0 ?? null; apMo(); }
    BV.tap = BV.tatCa = BV.noiBp = null;
    if (BV.catDang) { BV.catDang = false; batCat(false); }
    if (BV.bat) {
      BV.bat = false;
      camera.fov = BV.fov0; camera.updateProjectionMatrix();
      controls.enableRotate = true; controls.enableZoom = true;
      if (BV.nut) { controls.mouseButtons.LEFT = BV.nut.chuot; controls.touches.ONE = BV.nut.cham; }
      document.body.classList.remove("ban-ve");
    }
    veLai(60);
    return false;
  }
  // nhóm tải chậm (đợt sau) xong ⇒ vẽ lại đúng lượt này: vật của cửa có thể chưa có lúc vẽ đầu (soát Codex 2026-10-28)
  BV.chi = chi; BV.bp = bp;
  if (!lai) {                                                       // hẹn MỘT lượt vẽ lại; lượt ấy không hẹn tiếp (không vòng lặp)
    const so = (BV.so = (BV.so || 0) + 1);
    READY.then(() => { if (BV.bat && BV.so === so) banVe(true, BV.chi, BV.bp, true); });
  }
  // bản vẽ là thế ĐÓNG: cửa đang mở thì cánh nằm vuông góc ô, nhìn thẳng thành thấy cánh mà ô và khuôn thành một nét
  // (D04 mặc định mở). Trang việc áp lại thế của mục khi về 3D.
  for (const cm of GOC.userData.chon_mot || []) if (CHON_MOT.get(cm.ma) !== "Đóng" && cm.lua_chon.some((lc) => lc.nhan === "Đóng")) datChonMot(cm, "Đóng");
  capNhatHien();
  // tập vật của bản vẽ: lấy lúc vẽ CẢ vật; vẽ một bộ phận thì giữ tập ấy (hướng nhìn, danh sách bộ phận) và chỉ làm nổi bộ
  // phận — phần còn lại của vật mờ đi làm nền
  // về CẢ vật sau một bộ phận: NOI_BAT đang là tập bộ phận ⇒ trả làm nổi của mục trước khi lấy tập (vòng góc trang cửa)
  if (!chi && BV.noiBp && NOI_BAT === BV.noiBp) { NOI_BAT = BV.noi0 ?? null; BV.noiBp = null; apMo(); }
  if (!chi || !BV.tap) { BV.noi0 = NOI_BAT; BV.tap = vatBV().map((o) => o.userData.id); BV.tatCa = vatNoiBatMoiThe(); }
  else if (lai) {                                                    // lượt vẽ lại sau nhóm chậm: lấy lại tập CẢ vật (vật mới về)
    const nb = NOI_BAT; NOI_BAT = BV.noi0 ?? null;                     // theo làm nổi của mục, không theo bộ phận (soát Codex 2)
    BV.tap = vatBV().map((o) => o.userData.id); BV.tatCa = vatNoiBatMoiThe(); NOI_BAT = nb;
  }
  const ds = BV.tap.map((i) => THEO_ID.get(i)).filter((o) => o && o.visible);
  if (!ds.length) return false;
  if (chi && chi.length) { NOI_BAT = BV.noiBp = new Set(chi); apMo(); }
  if (nhomBV.parent !== GOC) GOC.add(nhomBV);
  const cap0 = ds.map((o) => [o, hopMoHinhKT([o])]).filter(([, b]) => !b.isEmpty());
  // CHỦ THỂ của bản vẽ (viec-3d.yaml tt.ban_ve_chu): chỉ những vật ấy chọn mặt nhìn và sinh số — vd quạt trên mũ tháp:
  // tháp là nền, số là của quạt + đế quạt
  const capChu = !tapChi0(chi) && BV.chu ? cap0.filter(([o]) => noiBatCo(o, BV.chu)) : [];
  const cap = capChu.length ? capChu : cap0;
  const hop = cap.map(([, b]) => b);

  // trục nhìn (luôn theo CẢ vật — chọn một bộ phận không lật hướng nhìn): bộ phận mỏng nhất theo trục nào, cân theo diện tích hai cạnh còn lại
  // chỉ vật DẠNG TẤM bỏ phiếu (cạnh mỏng ≤ ½ cạnh giữa: kính, tấm, lá) — thanh khuôn 40 × 60 × 395 mỏng theo mặt tường nên
  // phiếu của nó chỉ sai hướng (W10: bốn thanh khuôn + đố cánh thắng tấm kính, bản vẽ nhìn vào cạnh cửa sổ). Không có tấm
  // nào thì mọi vật bỏ phiếu như cũ
  const phieu = (chiTam) => {
    const c = [0, 0, 0];
    for (const b of hop) {
      const s = b.getSize(new V3()).toArray(), xep = [...s].sort((p, q) => p - q), k = s.indexOf(xep[0]);
      if (chiTam && xep[0] > 0.5 * xep[1]) continue;
      c[k] += s[(k + 1) % 3] * s[(k + 2) % 3];
    }
    return c;
  };
  const can = phieu(true).some((x) => x > 0) ? phieu(true) : phieu(false);
  // HƯỚNG NHÌN ÉP (trang việc, nút ‹ › cạnh «3D»): «x+» · «x-» · «y+» · «y-» · «z+» · «z-» — camera đứng ở phía ấy; vắng thì tự
  // chọn. «ngang» (trang cửa, chủ nhà 2026-10-29): nhìn vào CẠNH vật — trục ngang còn lại so với mặt tự chọn, ghi bề dày khuôn,
  // cánh, nẹp
  const epMd = BV.huongMd, tTu = epMd ? "xyz".indexOf(epMd[0]) : can.indexOf(Math.max(...can));
  const ep = /^[xyz][+-]$/.test(BV.huong || "") ? BV.huong : BV.huong === "ngang" ? null : epMd;
  const t = ep ? "xyz".indexOf(ep[0]) : BV.huong === "ngang" ? (tTu === 0 ? 1 : 0) : tTu;
  // chỉ ghi kích thước vật trên MẶT PHẲNG CHÍNH (quanh bộ phận lớn nhất mỏng theo trục nhìn ± 0,25 m) — hít cửa trên tường
  // vuông góc, vật sau lưng… vẫn vẽ nhưng không kéo chuỗi số ra xa
  let chinh = null, wMax = -1;
  for (const b of hop) { const s = b.getSize(new V3()).toArray(), w = s[(t + 1) % 3] * s[(t + 2) % 3]; if (w > wMax) { wMax = w; chinh = b; } }
  const d0 = chinh.min.getComponent(t) - 0.25, d1 = chinh.max.getComponent(t) + 0.25;
  const tapChi = chi && chi.length ? new Set(chi) : null;
  const capMat = tapChi ? cap.filter(([o]) => tapChi.has(o.userData.id))
    : BV.cat && t === 2 ? cap                                       // mặt cắt ngang: lọc theo cao độ cắt ở dưới, không theo mặt chính
    : cap.filter(([, b]) => b.max.getComponent(t) >= d0 && b.min.getComponent(t) <= d1);
  if (!capMat.length) return false;
  // PHỤ KIỆN (bản lề, tay nắm, khoá, chốt, bu-lông, hít…) không sinh mép, không vào kích thước tổng — mép của chúng ghi thành
  // những số không thuộc cấu kiện nào (D09: chốt cánh ngoài khuôn kéo tổng thành 3464, «954» là mép tay nắm)
  const capVat = tapChi ? capMat : capMat.filter(([o]) => !laPhuKienBV(o)).length ? capMat.filter(([o]) => !laPhuKienBV(o)) : capMat;
  // BỘ PHẬN LẮP: vật cùng tên gốc («… — cánh 1 cửa D09 (ĐÓNG) — đố ngang dưới» → «… — cánh 1 cửa D09 (ĐÓNG)») gộp thành MỘT
  // hộp — số ghi bề rộng cánh 792, không ghi mép từng thanh đố (soát bản vẽ 2026-10-29: D09 ghi 887 / 721 / 695 / 798)
  // MẶT CẮT NGANG (trang cửa, «cat»: nhìn từ trên xuống qua mặt cắt ngang cao ~1,2 m — chủ nhà 2026-10-29): chỉ vật mặt cắt đi
  // qua mới sinh số — má khuôn, nẹp chỉ hai mặt tường, bề dày cánh; đầu vòm, ô thoáng phía trên không kéo chuỗi số
  const hopCaVat = new THREE.Box3(); for (const [, b] of capVat) hopCaVat.union(b);
  const zCat = BV.cat && t === 2 ? hopCaVat.min.z + Math.min(1.2, 0.45 * (hopCaVat.max.z - hopCaVat.min.z)) : null;
  const capCat = zCat == null ? capVat : capVat.filter(([, b]) => b.min.z <= zCat && b.max.z >= zCat);
  const capGhi = tapChi ? capVat : gopLapBV(capCat.length ? capCat : capVat);
  const hopGhi = capGhi.map(([, b]) => b);
  const B = new THREE.Box3(); for (const b of hopGhi) B.union(b);
  // VỊ TRÍ bộ phận (trang cửa, «vi_tri»: lam chân, tay nắm): khung + mép tổng là cả cửa ⇒ chuỗi số ghi cả chỗ đặt (cách sàn, cách
  // mép cánh) lẫn cỡ của bộ phận
  if (tapChi && BV.viTri) for (const [o, b] of cap) if (!laPhuKienBV(o)) B.union(b);
  // VỊ TRÍ TRÊN TƯỜNG (trang cửa, «tuong»: cửa sổ — chủ nhà 2026-10-30): khung + mép tổng là bức tường chứa vật, mép trong chỉ là
  // hộp bao cả vật ⇒ chuỗi số ghi khoảng cách từ đầu tường, mặt sàn, đỉnh tường tới ô cửa cùng cỡ ô
  let capGhiTuong = null;
  if (BV.tuong && !tapChi) {
    const o0 = B.clone(), c0 = o0.getCenter(new V3());
    for (const o of PHAN) {
      if (!o.visible || !o.isMesh || !/(^|— )tường /.test(o.userData.ten || "")) continue;
      const b = hopMoHinhKT([o]);
      if (b.containsPoint(c0)) B.union(b);
    }
    if (!B.equals(o0)) capGhiTuong = [[{ userData: { ten: "ô cửa" } }, o0]];
  }
  // SỐ ĐO DỰNG khai sẵn trong mô hình (extras kt_dung của khuôn — tang.py _kt_cua_vom): có cho bộ phận này thì vẽ ĐÚNG các số ấy
  // (số dựng là số mặt đứng — mặt bằng / mặt cắt ngang tự dò mép)
  // mặt cắt ngang: số khai cho «<bộ phận> — mặt cắt» (tiết diện nẹp chỉ) — khung phóng vào đúng các điểm ấy; «ngang» / «đứng»
  // theo trục bản vẽ mà đoạn số chạy dọc
  const ktMc = t === 2;
  const kt = ds.flatMap((o) => o.userData.kt_dung || []).filter((k) => k.bp === (bp || "Cả cửa") + (ktMc ? " — mặt cắt" : ""))
    .map((k) => (ktMc ? { ...k, kieu: Math.abs(k.b[0] - k.a[0]) >= Math.abs(k.b[1] - k.a[1]) ? "ngang" : "dung" } : k));
  if (ktMc && kt.length) B.makeEmpty();
  for (const k of kt) { B.expandByPoint(new V3(...k.a)); B.expandByPoint(new V3(...k.b)); }
  if (ktMc && kt.length) B.expandByScalar(0.012);
  // mặt cắt ngang cửa RỘNG (> 1,2 m — cổng, cửa chính): cả bề ngang thì má khuôn, cánh chỉ còn vài điểm ảnh ⇒ khung phóng vào MỘT
  // má khuôn đầu (0,4 m), số ghi trong khung ấy
  // mép cuối của khung phóng không phải mép vật nào ⇒ bỏ khỏi chuỗi số, không ghi tổng theo trục ấy (truc_phong)
  let trucPhong = -1;
  if (zCat != null && t === 2 && !kt.length) {
    const wDoc = Math.abs(B.max.y - B.min.y) > Math.abs(B.max.x - B.min.x) ? 1 : 0;
    if (B.max.getComponent(wDoc) - B.min.getComponent(wDoc) > 1.2) { B.max.setComponent(wDoc, B.min.getComponent(wDoc) + 0.4); trucPhong = wDoc; }
  }
  const TEN = ["x", "y", "z"], c = w2m(camera.position), tam = B.getCenter(new V3());
  // phía nhìn tự chọn theo camera lúc vẽ ĐẦU của tập vật; các góc sau (bộ phận, quay về) giữ phía ấy — camera lúc ấy là
  // camera bản vẽ trước, không phải góc 3D
  const khoaPhia = BV.tap.join("|") + "#" + t;
  const dau = ep ? (ep[1] === "+" ? 1 : -1) : t === 2 ? 1
    : BV.bat && BV.phia && BV.phia.k === khoaPhia ? BV.phia.d : (c.getComponent(t) >= tam.getComponent(t) ? 1 : -1);
  if (!ep && t !== 2) BV.phia = { k: khoaPhia, d: dau };
  const tu = t === 2 ? 0 : t === 0 ? 1 : 0, tv = t === 2 ? 1 : 2;   // trục ngang / đứng trên bản vẽ (mô hình)
  const mepTrong = new Map();
  // mép THẲNG của bộ phận trên bản vẽ: CẠNH lưới có hai đầu cùng toạ độ trục k và dài ≥ 40 % bề cao / rộng của chính vật ấy
  // theo trục kia của bản vẽ — cạnh má khuôn, vai vòm, mép lá… (cạnh trên cung, cạnh tiết diện nẹp ở đỉnh vòm ngắn nên không vào)
  if (tapChi) for (const [k, k2] of [[tu, tv], [tv, tu]]) {
    const tr = new Map();
    for (const [o, hb] of cap) {
      if (!tapChi.has(o.userData.id)) continue;
      const toiThieu = Math.max(0.05, 0.4 * (hb.max.getComponent(k2) - hb.min.getComponent(k2)));
      const g_ = o.geometry, pos = g_.attributes.position, idx = g_.index, p0 = o.position.toArray();
      const n = idx ? idx.count : pos.count, dinh = (j) => (idx ? idx.getX(j) : j);
      const canh = new Map();                                     // cạnh (hai đầu làm tròn) → [toạ độ, dài, pháp tuyến các mặt kề]
      const A = new V3(), Bq = new V3(), Cq = new V3(), nn = new V3(), e1 = new V3();
      const khoa = (v) => `${Math.round(v.x * 2000)},${Math.round(v.y * 2000)},${Math.round(v.z * 2000)}`;
      for (let f = 0; f + 2 < n; f += 3) {
        const ii = [dinh(f), dinh(f + 1), dinh(f + 2)];
        A.fromBufferAttribute(pos, ii[0]); Bq.fromBufferAttribute(pos, ii[1]); Cq.fromBufferAttribute(pos, ii[2]);
        nn.subVectors(Bq, A).cross(e1.subVectors(Cq, A));
        if (nn.lengthSq() < 1e-14) continue;
        nn.normalize();
        for (const [P1, P2] of [[A, Bq], [Bq, Cq], [Cq, A]]) {
          if (Math.abs(P1.getComponent(k) - P2.getComponent(k)) > 0.0003) continue;
          const dai = Math.abs(P1.getComponent(k2) - P2.getComponent(k2));
          if (dai < toiThieu) continue;
          const kk = [khoa(P1), khoa(P2)].sort().join("|");
          if (!canh.has(kk)) canh.set(kk, [P1.getComponent(k) + p0[k], dai, []]);
          canh.get(kk)[2].push(nn.clone());
        }
      }
      // cạnh GÃY (hai mặt kề lệch ≥ 40°) hoặc cạnh biên — cạnh giữa các dải bo tròn của nẹp không vào
      for (const [x, dai, ns] of canh.values()) {
        const gay = ns.length < 2 || ns.some((a_, i) => ns.slice(i + 1).some((b_) => a_.dot(b_) < 0.766));
        if (!gay) continue;
        const q = Math.round(x * 2000);
        tr.set(q, Math.max(tr.get(q) || 0, dai));
      }
    }
    mepTrong.set(k, [...tr].sort((a, b) => b[1] - a[1]).map(([q]) => q / 2000));
  }


  BV.truc = TEN[t] + (dau > 0 ? "+" : "-");
  // camera: góc hẹp, khung vừa vật + chỗ cho hai hàng đường ghi mỗi phía
  const Su = B.max.getComponent(tu) - B.min.getComponent(tu), Sv = B.max.getComponent(tv) - B.min.getComponent(tv);
  // khoảng giữa các hàng đường ghi (m) — tiết diện khai sẵn (nẹp chỉ, vài chục mm): hàng theo cỡ khung, không theo cỡ cửa
  const g = ktMc && kt.length ? Math.max(0.008, 0.09 * Math.max(Su, Sv)) : Math.max(0.06, 0.07 * Math.max(Su, Sv));
  const leKhung = ktMc && kt.length ? 12 : 6;                        // tiết diện: số hai phía, nhãn dài hơn cả khung ⇒ lề rộng
  const cao = Math.max(Sv + leKhung * g, (Su + leKhung * g) / Math.max(camera.aspect, 0.2));
  camera.fov = BV_FOV; camera.updateProjectionMatrix();
  const D = cao / 2 / Math.tan(THREE.MathUtils.degToRad(BV_FOV / 2));
  let d = trucThe(TEN[t], dau);
  if (t === 2) d.add(trucThe("y", -1).multiplyScalar(1e-4)).normalize();
  const lech = [0, 0, 0]; lech[tu] = lech[tv] = ktMc && kt.length ? 0 : -0.6 * g;          // dời tâm khung về phía hai hàng đường ghi
  const tamW = m2w(tam.x + lech[0], tam.y + lech[1], tam.z + lech[2]);
  controls.target.copy(tamW);
  camera.position.copy(tamW).addScaledVector(d, D);
  if (!BV.bat) BV.nut = { chuot: controls.mouseButtons.LEFT, cham: controls.touches.ONE };
  controls.enableRotate = false; controls.enableZoom = false;
  controls.mouseButtons.LEFT = THREE.MOUSE.PAN; controls.touches.ONE = THREE.TOUCH.PAN;   // kéo một ngón / chuột trái = dời bản vẽ
  controls.update();
  BV.bat = true; document.body.classList.add("ban-ve");
  if (zCat != null) { catTaiM("z", zCat, false); BV.catDang = true; }
  else if (BV.catDang) { BV.catDang = false; batCat(false); }
  // mặt phẳng đặt đường ghi: mặt hộp phía camera
  // (mặt cắt ngang: ngay dưới mặt cắt — phía trên bị cắt bỏ, đường ghi đặt ở đó thì mất theo)
  const mat = zCat != null ? zCat - 0.002 : dau > 0 ? B.max.getComponent(t) + 0.002 : B.min.getComponent(t) - 0.002;
  const P = (u, v) => { const p = [0, 0, 0]; p[t] = mat; p[tu] = u; p[tv] = v; return p; };
  // mép: hai đầu của từng bộ phận ≥ `nho` (bỏ phụ kiện vụn — vít, lá lam, núm); bộ phận lớn xét trước; mép mới phải cách
  // mọi mép đã có ≥ `tol` (≈ một nhãn số trên màn hình) để số không chồng nhau; tối đa 10 mép một hàng
  // CÙNG MỘT BỘ SỐ ở mọi màn hình (chủ nhà 2026-10-28: site và máy, điện thoại và máy tính phải ghi đúng những số ấy):
  // khoảng cách tối thiểu giữa hai mép tính theo một khung CHUẨN — vuông, cao 800 điểm ảnh — chỉ từ hình học của vật,
  // không theo cỡ khung vẽ hay tỉ lệ cửa sổ. Cỡ màn hình chỉ đổi cách bày số (so le), không đổi số nào được ghi.
  const caoChuan = Math.max(Sv + 6 * g, Su + 6 * g);
  const mep = (k, S) => {
    const mpx = caoChuan / 800;                                     // mét mỗi điểm ảnh của khung chuẩn
    // bộ phận và mặt cắt ngang: mép sát nhau vẫn ghi (nẹp phồng 25, cánh 40), số so le
    const min_ = tapChi || zCat != null || capGhiTuong;
    const tol = min_ ? Math.max(0.003, 4 * mpx) : Math.max(0.03, 44 * mpx), nho = min_ ? 0.004 : Math.max(0.03, S * 0.04);
    const ds_ = (capGhiTuong || capGhi).map(([o, b]) => [b.min.getComponent(k), b.max.getComponent(k), o.userData ? o.userData.ten || "" : o.ten])
      .filter(([a, b]) => b - a >= nho);
    // MÔ-ĐUN LẶP trước: bộ phận cùng cỡ (± 3 mm) theo trục này có ≥ 2 cái — cánh, ô kính, tấm — là nhịp người đọc cần; rồi mới
    // tới bộ phận lẻ, lớn trước
    // số cái cùng cỡ: dãy đông hơn xét trước (bốn cánh 798 trước hai cánh ô thoáng 1 579 nằm trên chúng)
    const lap = ds_.map(([a, b]) => ds_.filter(([c, d]) => Math.abs((d - c) - (b - a)) < 0.003).length);
    const thu = ds_.map((d, i) => [d, lap[i] >= 2 ? lap[i] : 0]).sort(([p, lp], [q, lq]) => (lq - lp) || ((q[1] - q[0]) - (p[1] - p[0]))).map(([d]) => d);
    const ra = [B.min.getComponent(k), B.max.getComponent(k)];
    nguonBV[k] = new Map([[ra[0], "tổng"], [ra[1], "tổng"]]);
    // mép mô-đun lặp được đứng sát mép khác (khuôn 60 cạnh cánh) — số ngắn so le; mép lẻ cần cách xa một nhãn số
    const tolLap = tapChi ? tol : Math.max(0.008, 6 * mpx);
    const them = (x, ten, sat = tol) => {
      if (ra.length >= 12 || ra.some((y) => Math.abs(y - x) < sat)) return;
      if (x < ra[0] - 1e-4 || x > ra[1] + 1e-4) return;              // mép ngoài khung (mặt cắt phóng vào một má khuôn)
      ra.push(x); nguonBV[k].set(x, ten);
    };
    thu.forEach(([a, b, ten]) => { const l = ds_.filter(([c, d]) => Math.abs((d - c) - (b - a)) < 0.003).length >= 2;
      them(a, ten, l ? tolLap : tol); them(b, ten, l ? tolLap : tol); });
    // MỘT bộ phận: thêm mép THẲNG bên trong khối (má khuôn, gờ chặn, vai vòm…)
    for (const x of tapChi ? mepTrong.get(k) || [] : []) them(x, "mép trong");
    return ra.sort((p, q) => p - q);
  };
  const nguonBV = {};
  const mu = mep(tu, Su), mv = mep(tv, Sv);
  if (trucPhong === tu) mu.pop(); else if (trucPhong === tv) mv.pop();
  if (tv === 2) {                                                 // mặt đứng: mặt sàn đang hiện ngay dưới vật
    const u0 = B.min.getComponent(tu), u1 = B.max.getComponent(tu);
    let san = null;
    for (const o of PHAN) {
      if (!o.visible || !o.isMesh || !/^Sàn Tầng/.test(o.userData.nhom || "")) continue;
      const b = hopMoHinhKT([o]);
      if (b.max.getComponent(tu) < u0 || b.min.getComponent(tu) > u1) continue;
      if (b.max.z <= B.min.z + 0.003 && b.max.z > B.min.z - 0.6 && (san == null || b.max.z > san)) san = b.max.z;
    }
    if (san != null && B.min.z - san > 0.004) mv.unshift(san);
  }
  const p = [];
  const doan = (a, b) => p.push(...a, ...b);
  const ngan = 40 * cao / Math.max(200, canvas.clientHeight);    // đoạn ngắn hơn ~40 điểm ảnh: số so le hai bên đường ghi
  let le = 0;
  const nhanBV = (a, b, chu, dung, them = "") => {
    const el = document.createElement("div");
    el.className = "nhan-thuoc bv" + (dung ? " dung" : "") + them;
    el.textContent = chu;
    el.dataset.p = new V3(...a).add(new V3(...b)).multiplyScalar(0.5).toArray().join(",");
    lopBV.append(el);
  };
  const ghi = (a, b, keo, dai, dung, nhan = "", anSo = false) => {   // đường ghi a→b, gióng theo `keo` về phía vật, gạch chéo hai đầu
    if (dai < 0.0005) return;
    const A = new V3(...a), Bv = new V3(...b), K = new V3(...keo);
    for (const Q of [A, Bv]) doan(Q.clone().addScaledVector(K, 0.25).toArray(), Q.clone().addScaledVector(K, -0.12).toArray());
    doan(A.toArray(), Bv.toArray());
    const h = Bv.clone().sub(A).normalize(), r = Math.min(g * 0.12, dai / 4);
    const cheo = h.clone().add(K.clone().normalize()).normalize().multiplyScalar(r);
    for (const Q of [A, Bv]) doan(Q.clone().sub(cheo).toArray(), Q.clone().add(cheo).toArray());
    if (anSo) return;
    nhanBV(a, b, String(Math.round(dai * 1000)) + (nhan ? " " + nhan : ""), dung, dai < ngan ? ((le++ % 2) ? " le-a" : " le-b") : "");
  };
  const chuoi = (ms, k, hang, ngang) => {                         // một hàng đường ghi qua các mép `ms`
    const ab = (x0, x1) => {
      if (ngang) { const v = B.min.getComponent(tv) - hang * g, keo = [0, 0, 0]; keo[tv] = hang * g; return [P(x0, v), P(x1, v), keo]; }
      const u = B.min.getComponent(tu) - hang * g, keo = [0, 0, 0]; keo[tu] = hang * g; return [P(u, x0), P(u, x1), keo];
    };
    // nhịp BẰNG NHAU liền nhau (± 3 mm, ≥ 2 nhịp) ghi MỘT số «n × L» giữa dãy — bốn cánh 798 thành «4 × 798»; chỉ gộp khi
    // n × L khớp đoạn đo của dãy trong 2 mm (soát Codex 2026-10-29: 10 nhịp 798–801 không được ghi «10 × 801» ⇒ 8 010 ≠ 8 007),
    // không thì ghi từng số
    for (let i = 0; i + 1 < ms.length;) {
      const L = Math.round((ms[i + 1] - ms[i]) * 1000);
      let j = i + 1;
      while (j + 1 < ms.length && Math.abs(Math.round((ms[j + 1] - ms[j]) * 1000) - L) <= 3) j++;
      const tongDay = Math.round((ms[j] - ms[i]) * 1000);
      if (j - i >= 2 && Math.abs((j - i) * Math.round(tongDay / (j - i)) - tongDay) > 2) j = i + 1;   // không khớp ⇒ ghi lẻ
      const n = j - i;
      for (let q = i; q < j; q++) { const [a, b, keo] = ab(ms[q], ms[q + 1]); ghi(a, b, keo, ms[q + 1] - ms[q], !ngang, "", n >= 2); }
      // số của dãy = TRUNG BÌNH nhịp (n × số ấy khớp đoạn dãy trong 1–2 mm, không lấy nhịp đầu)
      if (n >= 2) { const [a, b] = ab(ms[i], ms[j]); nhanBV(a, b, `${n} × ${Math.round((ms[j] - ms[i]) * 1000 / n)}`, !ngang); }
      i = j;
    }
  };
  const tong = (ms) => [ms[0], ms[ms.length - 1]];
  let cu = null, cv = null;                                       // mô-đun chồng mép (nếu có) theo hai trục bản vẽ
  if (kt.length) {
    const giuaU = (B.min.getComponent(tu) + B.max.getComponent(tu)) / 2;
    for (const k of kt) {
      const ua = k.a[tu], va = k.a[tv], ub = k.b[tu], vb = k.b[tv], keo = [0, 0, 0];
      if (k.kieu === "ngang") {
        const v = B.min.getComponent(tv) - k.hang * g; keo[tv] = k.hang * g;
        ghi(P(ua, v), P(ub, v), keo, Math.abs(ub - ua), false, k.ten);
      } else if (k.kieu === "dung") {
        const trai = ua <= giuaU, u = trai ? B.min.getComponent(tu) - k.hang * g : B.max.getComponent(tu) + k.hang * g;
        keo[tu] = (trai ? 1 : -1) * k.hang * g;
        ghi(P(u, va), P(u, vb), keo, Math.abs(vb - va), true, k.ten);
      } else if (k.kieu === "r") {                                 // bán kính: đường từ tâm cung ra cung + nhãn ở đầu
        doan(P(ua, va), P(ub, vb));
        const el = document.createElement("div");
        el.className = "nhan-thuoc bv";
        el.textContent = `${k.ten || "R"} ${Math.round(Math.hypot(ub - ua, vb - va) * 1000)}`;
        el.dataset.p = P(ub, vb).join(",");
        lopBV.append(el);
      }
    }
  } else {
    // MÔ-ĐUN CHỒNG MÉP (cánh cổng D01 gối lên nhau 51): chuỗi mép sinh mảnh vụn «670 | 51 | 692» không phải bề cánh nào ⇒
    // hàng trong ghi TỪNG mô-đun đủ bề của nó, so le hai hàng (1 và 1,5), tổng ở hàng 2 như mọi bản vẽ
    const chong = (k, S) => {
      if (tapChi) return null;
      // bộ phận chính (≥ 15 % bề vật) không phải khung bao suốt (chứa ≥ 2 bộ phận khác), trùng nhau thì giữ một
      let ds_ = hopGhi.map((b) => [b.min.getComponent(k), b.max.getComponent(k)]).filter(([a, b]) => b - a >= 0.15 * S);
      ds_ = ds_.filter(([a, b]) => ds_.filter(([c, d]) => c >= a - 0.003 && d <= b + 0.003 && (d - c) < (b - a) - 0.006).length < 2);
      ds_ = ds_.filter(([a, b], i) => !ds_.slice(0, i).some(([c, d]) => Math.abs(a - c) < 0.003 && Math.abs(b - d) < 0.003))
        .sort((p, q) => p[0] - q[0]);
      if (ds_.length < 2 || ds_.length > 8) return null;
      // một HÀNG: mỗi cái bắt đầu sau nửa cái trước, và MỌI cặp kề nhau chồng mép 3 mm … < ½ bề nhỏ hơn (một cái đứng
      // tách khỏi dãy thì không phải hàng chồng mép — soát Codex 2026-10-29)
      for (let i = 1; i < ds_.length; i++) {
        const [a0, b0] = ds_[i - 1], [a1, b1] = ds_[i], w = Math.min(b0 - a0, b1 - a1), ch = b0 - a1;
        if (a1 < a0 + 0.5 * (b0 - a0) || ch <= 0.003 || ch >= 0.5 * w) return null;
      }
      return ds_;
    };
    const hangMoDun = (ds, ngang) => ds.forEach(([a, b], i) => {
      const hang = i % 2 ? 1.5 : 1, keo = [0, 0, 0];
      if (ngang) { const v = B.min.getComponent(tv) - hang * g; keo[tv] = hang * g; ghi(P(a, v), P(b, v), keo, b - a, false); }
      else { const u = B.min.getComponent(tu) - hang * g; keo[tu] = hang * g; ghi(P(u, a), P(u, b), keo, b - a, true); }
    });
    cu = chong(tu, Su); cv = chong(tv, Sv);
    if (cu) { hangMoDun(cu, true); chuoi(tong(mu), tu, 2, true); }
    else if (trucPhong === tu) chuoi(mu, tu, 1, true);
    else { if (mu.length > 2) chuoi(mu, tu, 1, true); chuoi(tong(mu), tu, mu.length > 2 ? 2 : 1, true); }
    if (cv) { hangMoDun(cv, false); chuoi(tong(mv), tv, 2, false); }
    else if (trucPhong === tv) chuoi(mv, tv, 1, false);
    else { if (mv.length > 2) chuoi(mv, tv, 1, false); chuoi(tong(mv), tv, mv.length > 2 ? 2 : 1, false); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  const l = new THREE.LineSegments(geo, VL_BV);
  l.renderOrder = 14;
  nhomBV.add(l);
  datNhanThuoc();
  veLai(120);
  const bePh = (ds) => ds && ds.map(([a, b]) => Math.round((b - a) * 1000));
  return { truc: BV.truc, ngang: mu.map((x) => Math.round(x * 1000)), dung: mv.map((x) => Math.round(x * 1000)),
           ...(cu || cv ? { mo_dun: { ngang: bePh(cu), dung: bePh(cv) } } : {}),
           // mép nào do bộ phận nào sinh — để soát bản vẽ bằng máy; window.__BV_SOAT = 1 thì kèm hộp từng vật (bo) và cỡ (tat)
           nguon: { ngang: mu.map((x) => nguonBV[tu]?.get(x) || "sàn"), dung: mv.map((x) => nguonBV[tv]?.get(x) || "sàn") },
           ...(window.__BV_SOAT ? { bo: capMat.map(([o, b]) => [o.userData.ten, laPhuKienBV(o) ? 1 : 0, ...[tu, tv].flatMap((k) =>
             [b.min.getComponent(k), b.max.getComponent(k)].map((x) => Math.round(x * 1000)))]),
             tat: cap0.map(([o, b]) => [o.userData.ten, ...b.getSize(new V3()).toArray().map((x) => Math.round(x * 1000))]) } : {}) };
}
/* Phụ kiện gắn trên cấu kiện — vẽ, nhưng không sinh mép ghi kích thước của cả vật. So từ ĐẦU mỗi đoạn tên sau « — » (không
   so giữa chữ: «má khoá», «má bản lề» là thanh khuôn; «bông khoáng» không phải khoá) */
const PHU_KIEN_BV = /^(bản lề|tay nắm|tay gạt|hoa hồng|cổ tay gạt|cần tay gạt|khoá|ổ khoá|ruột khoá|núm|chốt|thanh chốt|bát nhận|tấm nhận|cần quay|giá treo|móc|lẫy|hộp tay quay|dây hãm|hộp dây hãm|bát |đệm chặn|cữ chặn|tay bản lề|tay đỡ|đoạn ray|ray treo|bu-lông|bulông|đai ốc|long đen|vít|hít|gioăng|ke góc|chặn cửa|ty treo|hộp đấu dây|cầu dao|ống chờ|ống mềm|đệm cao su|cảm biến)/i;
function laPhuKienBV(o) {
  const p = (o.userData.ten || "").split(" — ");
  return p.some((d, i) => (i > 0 || p.length === 1) && PHU_KIEN_BV.test(d.replace(/^(Đèn|Tầng \d[^—]*)\s*/, "").trim()));
}
const tapChi0 = (chi) => !!(chi && chi.length);
/* gom vật thành BỘ PHẬN LẮP theo tên gốc (bỏ đoạn cuối sau « — »): «Tầng 1 (Trệt) — cánh 1 cửa D09 (ĐÓNG) — đố ngang dưới»
   → «Tầng 1 (Trệt) — cánh 1 cửa D09 (ĐÓNG)», «Quạt hút giếng trời — cổ côn» → «Quạt hút giếng trời». Tên hai đoạn chỉ gộp
   khi tên gốc CỤ THỂ (≥ 2 chữ, không phải tầng / nơi chốn: «Tầng 2 — tường Tây Bắc», «Tháp — kính», «Cửa — …» không gộp —
   soát Codex 2026-10-29: gốc một chữ gom nhầm nhiều cánh khác nhau thành một hộp); nhóm phải ≥ 2 vật và nằm gọn trong 7 m. */
const GOC_NOI_BV = /^(Tầng \d|Tầng|Mái|Sàn|Tháp|Phòng|Bếp|WC|Sảnh|Ban công|Giếng|Sân|Hốc|Cầu thang)\b/;
function gopLapBV(cap) {
  const nhom = new Map(), le = [];
  for (const [o, b] of cap) {
    const p = (o.userData.ten || "").split(" — ");
    const k = p.length >= 3 ? p.slice(0, -1).join(" — ")
      : p.length === 2 && !GOC_NOI_BV.test(p[0]) && p[0].trim().split(/\s+/).length >= 2 ? p[0] : null;
    if (!k) { le.push([o, b]); continue; }
    if (!nhom.has(k)) nhom.set(k, []);
    nhom.get(k).push([o, b]);
  }
  const ra = [...le];
  for (const [k, ds] of nhom) {
    const B = new THREE.Box3(); for (const [, b] of ds) B.union(b);
    const s = B.getSize(new V3());
    if (ds.length < 2 || Math.max(s.x, s.y, s.z) > 7) ra.push(...ds);
    else ra.push([{ ten: k, userData: null }, B]);
  }
  return ra;
}
/* BỘ PHẬN CHÍNH của vật đang vẽ (trang cửa — chủ nhà 2026-10-27): gom vật đang hiện + làm nổi theo tên
   thành vài bộ phận cốt lõi; luật đầu tiên khớp thắng, còn lại là «Cánh». Trả [{ten, ids}] theo thứ tự luật. */
const BO_PHAN = [["Bản lề", /bản lề|cối (trên|dưới)/i],                       // thứ tự KHỚP: «bát nhận … (trên khuôn)» là khoá
  ["Khoá và tay nắm", /khoá|tay gạt|tay nắm|lưỡi gà|chốt|núm vặn|bát nhận|rãnh mở|tay quay/i], ["Lam chân", /lá lam|lam chân/i],
  ["Giữ cánh mở", /hít cửa|chặn cửa|đệm chặn|tay giữ/i], ["Gioăng", /gioăng/i], ["Nẹp chỉ", /nẹp chỉ/i], ["Khuôn", /khuôn|khung bao|đố (ngang|đứng) cố định|ngưỡng/i],
  ["Kính", /kính/i], ["Cánh", /./]];
const BO_PHAN_HIEN = ["Khuôn", "Nẹp chỉ", "Cánh", "Kính", "Bản lề", "Khoá và tay nắm", "Lam chân", "Gioăng", "Giữ cánh mở"];   // thứ tự HIỆN
// vật làm nổi ở MỌI thế công tắc (Đóng lẫn Mở) — danh sách bộ phận không phụ thuộc cửa đang đóng hay mở lúc hỏi
function vatNoiBatMoiThe() {
  return NOI_BAT ? PHAN.filter((o) => o.isMesh && o.geometry && !o.userData.ma && noiBatCo(o)).map((o) => o.userData.id) : [];
}
function boPhanBV() {
  const ra = new Map(BO_PHAN_HIEN.map((ten) => [ten, []]));
  const ds = ((BV.bat && BV.tatCa) || vatNoiBatMoiThe()).map((i) => THEO_ID.get(i)).filter(Boolean);
  for (const o of ds) ra.get(BO_PHAN.find(([, re]) => re.test(o.userData.ten || ""))[0]).push(o.userData.id);
  // `lech_do`: góc lệch của khuôn so với trục nhà trên mặt bằng (độ) — tường xiên (cổng D01) thì hộp bao từng thanh phình ra,
  // mặt cắt ngang ghi số theo trục nhà là số sai ⇒ trang cửa bỏ góc mặt cắt
  return [...ra].filter(([, ids]) => ids.length).map(([ten, ids]) => ({ ten, ids, ...(ten === "Khuôn" ? { lech_do: lechMatBang(ids) } : {}) }));
}
function lechMatBang(ids) {                                        // hướng chính của các đỉnh trên mặt bằng (PCA), lệch khỏi trục x/y gần nhất
  let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const i of ids) {
    const o = THEO_ID.get(i); if (!o || !o.geometry) continue;
    const pos = o.geometry.attributes.position, p0 = o.position;
    for (let j = 0; j < pos.count; j++) {
      const x = pos.getX(j) + p0.x, y = pos.getY(j) + p0.y;
      n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
    }
  }
  if (n < 3) return 0;
  const mx = sx / n, my = sy / n, cxx = sxx / n - mx * mx, cyy = syy / n - my * my, cxy = sxy / n - mx * my;
  const g = THREE.MathUtils.radToDeg(0.5 * Math.atan2(2 * cxy, cxx - cyy));
  const r = ((g % 90) + 90) % 90;
  return Math.round(Math.min(r, 90 - r) * 10) / 10;
}
// phóng trong bản vẽ = thu / mở góc nhìn quanh con trỏ (OrbitControls tiến camera thì hết chiếu song song)
function bvPhong(k, cx, cy) {
  const r = canvas.getBoundingClientRect();
  const nx = ((cx - r.left) / r.width) * 2 - 1, ny = 1 - ((cy - r.top) / r.height) * 2;
  const fov = Math.min(BV_FOV * 4, Math.max(0.02, camera.fov * k));
  const kc = camera.position.distanceTo(controls.target);
  const h0 = 2 * kc * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), h1 = 2 * kc * Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const phai = new V3().setFromMatrixColumn(camera.matrixWorld, 0), len = new V3().setFromMatrixColumn(camera.matrixWorld, 1);
  const dx = (nx * (h0 - h1) / 2) * camera.aspect, dy = ny * (h0 - h1) / 2;
  const doi = phai.multiplyScalar(dx).addScaledVector(len, dy);
  camera.position.add(doi); controls.target.add(doi);
  camera.fov = fov; camera.updateProjectionMatrix(); controls.update(); veLai(60);
}
canvas.addEventListener("wheel", (e) => {
  if (!BV.bat) return;
  e.preventDefault();
  bvPhong(Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)), e.clientX, e.clientY);
}, { passive: false });
const bvCham = new Map();
canvas.addEventListener("pointerdown", (e) => { if (BV.bat && e.pointerType === "touch") bvCham.set(e.pointerId, [e.clientX, e.clientY]); });
canvas.addEventListener("pointermove", (e) => {
  if (!BV.bat || !bvCham.has(e.pointerId) || bvCham.size !== 2) { if (bvCham.has(e.pointerId)) bvCham.set(e.pointerId, [e.clientX, e.clientY]); return; }
  const [a, b] = [...bvCham.values()], d0 = Math.hypot(a[0] - b[0], a[1] - b[1]);
  bvCham.set(e.pointerId, [e.clientX, e.clientY]);
  const [a2, b2] = [...bvCham.values()], d1 = Math.hypot(a2[0] - b2[0], a2[1] - b2[1]);
  if (d0 > 4 && d1 > 4) bvPhong(d0 / d1, (a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2);
});
for (const ev of ["pointerup", "pointercancel"]) canvas.addEventListener(ev, (e) => bvCham.delete(e.pointerId));
async function batThuoc(t, bat) {
  const r = await fetch(THUOC_GHI, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...t, bat }) });
  const kq = await r.text();
  if (!r.ok) throw new Error(kq || "Không lưu được thước (" + r.status + ").");
  KT.ds = JSON.parse(kq).thuoc || [];
  veKichThuoc(); hienThongTin();
}
/* ô «Thước kích thước» trong bảng bộ phận đang chọn của CHI TIẾT CỤM — chỉ ở chế độ soạn */
function oThuoc(u, k) {
  if (!k) return;
  k.id = "tt-thuoc"; k.className = "tt-thuoc";
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
  thoiThem(); if (doDangBat) batDo(false); huyVung();
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
   Hai lối vào tools/sim-weather, cùng trên mô hình này (cảnh ?m=nha): lớp phân tích cả nhà và dòng khí 3D trong nhà (khi3d.js). */
(function nutMoPhong() {
  if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
  const nhom = document.querySelector('.thanh [aria-label="Công cụ"]');
  if (!nhom) return;
  const nut = document.createElement("button");
  nut.id = "nut-mo-phong"; nut.type = "button"; nut.textContent = "Mô phỏng thời tiết ▾";
  nut.title = "Mô phỏng cả nhà (tools/sim-weather): nhiệt, gió, tuổi khí, nắng, mưa trên mô hình · dòng khí 3D trong nhà";
  nhom.append(nut);
  const menu = document.createElement("div");
  menu.className = "menu-them"; menu.hidden = true; menu.setAttribute("role", "menu");
  menu.style.position = "fixed"; menu.style.zIndex = "60";
  menu.innerHTML = `<button type="button" role="menuitem" data-mp="lop">Bản đồ nhiệt · gió · tuổi khí trên mô hình</button>
    <button type="button" role="menuitem" data-mp="khi3d">Dòng khí 3D trong nhà (hạt · lát · nhiệt độ mặt)</button>`;
  document.body.append(menu);
  menu.querySelector('[data-mp="khi3d"]').onclick = () => {   // trên ?m=nha nạp tại chỗ (giữ góc nhìn, vật đang chọn); cảnh khác thì chuyển trang
    menu.hidden = true;
    if (MA !== "nha") { const u = new URL(location.href); u.searchParams.set("m", "nha"); u.searchParams.set("phan_tich", "1"); u.searchParams.set("khi3d", "1"); location.href = u.toString(); return; }
    if (window.PHAN_TICH?.khi3d) { window.PHAN_TICH.khi3d(); return; }
    nut.disabled = true; nut.textContent = "Đang nạp mô phỏng…";
    napPhanTich(true).then((ok) => { nut.disabled = false; nut.textContent = "Mô phỏng thời tiết ▾"; if (ok) window.PHAN_TICH?.khi3d?.(); });
  };
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
  if (CHI_XEM() && !/^[01379]$/.test(k) && !["c", "p", "escape", "o", "enter"].includes(k)) return;   // chỉ xem: góc nhìn, mặt cắt, đóng/mở, chi tiết
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
  if (CT.mo) {                                    // CHI TIẾT CỤM: chỉ Esc (lui một bậc), O (nút nổi), thước
    if (k === "escape") { if (!dongMenuNoi() && !dongMenuPa()) { if (CT.phan) chonPhanCT(null); else dongChiTiet(); } }
    else if (k === "o") bamNutNoi();
    else if (k === "m") datThuocCT(!CT.thuoc);
    else return;
    e.preventDefault(); return;
  }
  if (k === "escape") { if (dongMenuNoi() || dongMenuPa()) { e.preventDefault(); return; } viet = false; datChon(null); chonNhap(null); thoiThem(); $("menu-them").hidden = true; if (doDangBat) batDo(false); if (vungBat || vungXong) huyVung(); }
  else if (k === "enter" && chon && CUM_CHON) moChiTiet();
  else if (k === "o") bamNutNoi();                              // nút nổi: đóng/mở bộ phận đang chọn
  else if (k === "v" && NET) NET.dat(!NET.bat());                // nét viền theo độ sâu
  else if (k === "e") datCheDoSua(!CHE_DO_SUA);                  // chế độ sửa
  else if (k === "b") gonTrai(!document.body.classList.contains("gon-trai"));   // gọn / mở ô trái
  else if (k === "g") datAnGhim(!anGhim);                        // ẩn/hiện ghi chú trên khung 3D
  else if (k === "m") batDo(!doDangBat);
  else if (k === "c") bamCat();                                   // mặt cắt cả ở chế độ sửa (nút «Mặt cắt» trên thanh trên, chủ nhà 2026-10-31)
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
  // nhóm tắt-mặc-định đang BẬT: ghi `an=` (kể cả rỗng) để liên kết mở lại đúng như đang thấy
  if (an.length || (CANH.tat_mac_dinh || []).some((m) => !lkTat.has(m) && LK_CO.includes(m))) u.searchParams.set("an", an.join(","));
  else u.searchParams.delete("an");
  if (chon) u.searchParams.set("chon", chon.userData.id); else u.searchParams.delete("chon");
  if (!$("bang-cat").hidden) u.searchParams.set("cat", `${trucCat},${$("cat-vi-tri").value}${$("cat-dao").checked ? ",dao" : ""}`);
  else u.searchParams.delete("cat");
  if (!$("bang-cat").hidden && catSanDang >= 0) u.searchParams.set("cat_san", String(catSanDang)); else u.searchParams.delete("cat_san");
  if (bocK) u.searchParams.set("boc", String(bocK)); else u.searchParams.delete("boc");
  if (tachKhe) u.searchParams.set("tach", String(tachKhe)); else u.searchParams.delete("tach");
  u.searchParams.delete("xuyen");
  const tt = (GOC.userData.chon_mot || []).filter((cm) => CHON_MOT.get(cm.ma) !== cm.mac_dinh).map((cm) => `${cm.ma}:${CHON_MOT.get(cm.ma)}`);
  if (tt.length) u.searchParams.set("tt", tt.join(",")); else u.searchParams.delete("tt");
  const bangPa = GOC.userData.phuong_an_vat_lieu;
  const pa = bangPa ? bangPa.cau_kien.filter((ck) => PA.has(ck.ma) && PA.get(ck.ma).loai !== ck.phuong_an[0].ma)
    .map((ck) => `${ck.ma}:${PA.get(ck.ma).loai}:${PA.get(ck.ma).mau || ""}`) : [];
  if (pa.length) u.searchParams.set("pa", pa.join(",")); else u.searchParams.delete("pa");
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
    el.removeAttribute("aria-label");
    if (loi.length) {
      el.dataset.tt = "loi";
      el.innerHTML = `<span class="ban-dung-chu">⛔ Dựng lỗi: ${ten(loi)} — đang xem bản cũ</span> <button type="button">Thử lại</button>`;
    } else if (moi.length || LK_LOI.size) {
      el.dataset.tt = "moi";
      el.innerHTML = `<span class="ban-dung-chu">● Có bản mới: ${ten(moi.length ? moi : ds.filter((x) => LK_LOI.has(x.ma)))}</span> <button type="button">Tải lại</button>`;
    } else {
      el.dataset.tt = "ok";
      // bản mới nhất: chỉ một chấm xanh (chữ «18 nhóm · mới nhất» lặp tên mô hình) — chi tiết khi rê chuột
      el.textContent = ""; el.setAttribute("aria-label", `${ds.length} nhóm · bản dựng mới nhất`);
      el.title = `${ds.length} nhóm · bản dựng mới nhất\n\n` + el.title;
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
$("gc-mk").value = nho("bl-mk");
if (CUC_BO) $("gc-mk").parentElement.hidden = true;   // sổ ở máy: không cần mật khẩu — cả hàng ẩn
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
  $("gc-tieu-de").textContent = `Sửa ghi chú #${b.id}`; $("gc-tieu-de").hidden = false;
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
  $("gc-tieu-de").hidden = true;
  $("gc-luu").textContent = "Lưu ghi chú";
  $("gc-huy-sua").hidden = true;
  $("gc-noi-dung").value = "";
  xoaHetNhap();
  veGhim();
  globalThis.VE_LAI?.();
}
$("gc-huy-sua").onclick = thoiSua;
/* ô ghi chú (chủ nhà 2026-10-21): không tiêu đề — chữ mờ trong ô nói ghi chú cho gì; Enter gửi, Shift+Enter xuống dòng */
function datGoiYGhiChu() {
  $("gc-noi-dung").placeholder = (!chon ? "Ghi chú cho góc nhìn này" : THEM.size ? `Ghi chú chung cho ${THEM.size + 1} vật đang chọn` : "Ghi chú cho cụm này")
    + " — cần sửa gì? Enter để gửi.";
}
$("gc-noi-dung").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.shiftKey || e.isComposing || e.keyCode === 229) return;   // gõ tiếng Việt (IME) đang ghép chữ: không gửi
  e.preventDefault();
  if ($("gc-noi-dung").value.trim()) $("form-gc").requestSubmit();   // sổ ghi chú cần chữ: ô rỗng (kể cả có vật chú thích nháp) không gửi
});
datGoiYGhiChu();
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
    li.dataset.id = b.id;
    if (b.da_xong) li.classList.add("xong");
    if (gcChon === b.id || dangSua?.id === b.id) li.classList.add("dang-chon");
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
    const bXong = document.createElement("button"); bXong.className = "nut-nho"; bXong.textContent = b.da_xong ? "Mở lại" : "Xong — xoá";
    bXong.onclick = async (e) => { e.stopPropagation(); try { await KHO.xong(b.id, !b.da_xong); await taiGhiChu(); } catch (er) { alert(er.message); } };
    nut.append(bTra, bXong);
    if (CUC_BO) {
      const bSua = document.createElement("button"); bSua.className = "nut-nho"; bSua.textContent = dangSua?.id === b.id ? "Đang sửa" : "Sửa";
      bSua.title = "Sửa chữ, dời / xoay / thêm / xoá vật chú thích của ghi chú này";
      bSua.onclick = (e) => { e.stopPropagation(); denGhiChu(b); batSua(b); };
      nut.append(bSua);
    }
    li.append(nut);
    li.onclick = () => chonGhiChu(b, false);
    ul.append(li);
  }
  veGhim();
}
$("an-xong").onchange = veGhiChu;
for (const ev of ["input", "focus", "blur"]) $("gc-noi-dung").addEventListener(ev, () => {
  if (ev === "blur" && !$("gc-noi-dung").value.trim()) viet = false;   // bỏ ô trống ⇒ thôi «Viết ghi chú»
  requestAnimationFrame(capNhatPhai);
});
if ($("nut-viet-gc")) $("nut-viet-gc").onclick = () => { viet = true; capNhatPhai(); $("gc-noi-dung").focus(); };
function mk() { const v = $("gc-mk").value || nho("bl-mk"); if (!v) throw new Error("Cần mật khẩu chung (ô dưới cùng bên phải)."); return v; }
/* CHỌN MỘT GHI CHÚ ĐÃ CÓ (chủ nhà 2026-10-18 «không chọn được ghi chú cũ để sửa»): bấm ghim số trên khung 3D hay dòng trong
   danh sách ⇒ bay tới góc nhìn của nó, mở thẻ «Ghi chú», tô + cuộn tới dòng ấy; bấm ghim ở trình xem máy ⇒ vào chế độ sửa luôn */
let gcChon = null;
/* GHI CHÚ ĐANG CHỌN = VẬT CỦA NÓ LÀM NỔI (chủ nhà 2026-10-28 «when selecting comments, the object of that comment should be
   highlighted as selected»): góc nhìn đã lưu hay đứng ngoài nhà, sau lớp ốp tôn ⇒ vật được chọn mà không thấy. Chọn ghi chú
   ⇒ vật neo + vật thêm của nó làm nổi (mọi vật khác mờ như kịch bản 3D), chọn vật khác / bấm ra ngoài ⇒ thôi. Không đè làm
   nổi của cảnh / trang việc đang mở. */
let GC_NOI = null;
function noiGhiChu(b) {
  const ids = [b.neo, ...(b.neo_them || [])].filter((id) => id && THEO_ID.has(id));
  if (!ids.length || (NOI_BAT && NOI_BAT !== GC_NOI)) return;
  GC_NOI = new Set(ids); NOI_BAT = GC_NOI; apMo(); veLai(60);
}
function boNoiGhiChu() {
  if (GC_NOI && NOI_BAT === GC_NOI) { NOI_BAT = null; apMo(); veLai(60); }
  GC_NOI = null;
}
KHI_CHON.push((o) => { if (GC_NOI && (!o || !GC_NOI.has(o.userData.id))) boNoiGhiChu(); });
function chonGhiChu(b, sua) {
  gcChon = b.id;
  if (anGhim) datAnGhim(false);
  denGhiChu(b);
  noiGhiChu(b);
  window.BO_CUC?.moThe?.("ghi-chu");
  if (sua && CUC_BO && !b.tra_loi_cho) batSua(b);
  veGhiChu();
  const li = document.querySelector(`#ds-gc li[data-id="${b.id}"]`);
  if (li) { if (li.closest("details")) li.closest("details").open = true; li.scrollIntoView({ block: "nearest" }); }
}
function denGhiChu(b) {
  if (b.neo && THEO_ID.has(b.neo)) {
    const o = THEO_ID.get(b.neo);
    if (!hienDuoc(o)) { anTay.delete(b.neo); rieng = null; batLop(o.userData.nhom); if (o.userData.ma) hienMa = true; capNhatHien(); }
    datChon(o);
    for (const id of b.neo_them || []) {
      const k = THEO_ID.get(id);
      if (!k) continue;
      if (!hienDuoc(k)) { anTay.delete(id); batLop(k.userData.nhom); capNhatHien(); }
      THEM.add(k); toThem(k);
    }
    vienChon();
    hienThongTin();
  }
  if (!apGoc(b.truoc) && b.neo && THEO_ID.has(b.neo)) khungVua(cacChon());
}
async function traLoi(b) {
  const nd = prompt(`Trả lời ghi chú #${b.id}:`);
  if (!nd) return;
  try { await KHO.them({ noi_dung: nd, nguoi: "Khách", tra_loi_cho: b.id }); await taiGhiChu(); }
  catch (e) { alert(e.message); }
}
$("form-gc").onsubmit = async (e) => {
  e.preventDefault();
  const loi = $("gc-loi"); loi.hidden = true;
  try {
    if (!CUC_BO) nho("bl-mk", $("gc-mk").value);
    if (dangSua) {
      await KHO.sua(dangSua.id, { noi_dung: $("gc-noi-dung").value, hinh: NHAP.map((o) => o.userData.rec) });
      thoiSua();
      await taiGhiChu();
      return;
    }
    await KHO.them({
      noi_dung: $("gc-noi-dung").value, nguoi: "Khách",
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
/* NÚT ẨN GHI CHÚ (chủ nhà 2026-10-30 «add a button to hide comments on the 3d view»): ẩn ghim số, vật chú thích, vùng khoanh
   và thước đã lưu của mọi ghi chú khỏi khung 3D; danh sách bên trái vẫn còn. Chọn một ghi chú trong danh sách ⇒ hiện lại.
   Nhớ theo trình duyệt (phím G). */
let anGhim = false;
try { anGhim = localStorage.getItem("xem:an_ghim") === "1"; } catch { /* không có kho */ }
function datAnGhim(v) {
  anGhim = v;
  try { localStorage.setItem("xem:an_ghim", v ? "1" : "0"); } catch { /* không có kho */ }
  $("nut-an-gc")?.setAttribute("aria-pressed", String(!v));
  veGhim(); datGhim(); veLai(60);
}
if ($("nut-an-gc")) { $("nut-an-gc").setAttribute("aria-pressed", String(!anGhim)); $("nut-an-gc").onclick = () => datAnGhim(!anGhim); }
function veGhim() {
  lopGhim.replaceChildren();
  if (nhomVungGhi) xoaCon(nhomVungGhi);
  xoaCon(nhomCTGhi);
  if (document.body.classList.contains("nhung")) return;   // nhúng trong trang việc: không ghi chú — ghim, vật chú thích, vùng khoanh đều ẩn
  if (anGhim) { veNhanThuoc(); return; }
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
    el.onclick = () => chonGhiChu(b, true);
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
  const khoa = camera.quaternion.toArray().map((v) => v.toFixed(4)).join() + lbHover;   // không đổi hướng ⇒ không dựng lại SVG
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
/* trục dưới con trỏ: chấm GẦN người xem nhất trong bán kính ~22 px (toạ độ viewBox) */
function trucTai(e) {
  const r = laBan.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * 120 - 60, y = ((e.clientY - r.top) / r.height) * 120 - 60;
  let tot = null;
  const ban = Math.max(12, (22 * 120) / r.width);                 // vùng bấm mỗi chấm ≥ 44 px (ngón tay), chồng nhau thì chấm gần thắng
  for (const d of lbViTri) if (Math.hypot(d.x - x, d.y - y) <= ban && (!tot || d.z > tot.z)) tot = d;
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
  if (!(VE_LIEN_TUC || KHUNG_LIEN > 0 || canVe || doiCo || dong || lbDong || now < veToi || now - lanVeCuoi > VE_AN_TOAN || camLech())) { soNhipYen++; return; }   // đứng yên: không vẽ
  canVe = false; lanVeCuoi = now; soNhipYen = 0;
  camVe.p.copy(camera.position); camVe.q.copy(camera.quaternion); camVe.t.copy(controls.target);
  datMatGan();
  if (GOC) { datGhim(); datNhanThuoc(); veLaBan(); for (const f of MOI_KHUNG) f(); }
  veCanh();
}
controls.addEventListener("change", () => veLai());
ve();

/* ── KỊCH BẢN 3D: trạng thái một cảnh, đọc ra và áp lại TẠI CHỖ (không tải lại trang) ─────────────
   Trang hồ sơ mở trình xem MỘT lần trong khung 3D (tools/site/web/khung-3d.html) rồi mỗi nút cảnh chỉ gửi
   một trạng thái qua postMessage (web/nhung.js). Kho: data/canh-3d.yaml. Dạng trạng thái — mọi khoá tuỳ chọn:
     canh      mã cảnh trong danh mục (lớp bóc, mặt cắt sẵn, khung nhìn) — đổi tại chỗ, mọi nhóm đã tải sẵn
     v         góc nhìn "c=x,y,z;t=x,y,z" (toạ độ mô hình)       nhom     nhóm kết cấu đang hiện
     lop_tat / lop_bat  lớp tắt thêm / bật thêm so với mặc định của cảnh      lop_mo  lớp ◐ xem xuyên    an  vật ẩn    rieng  chỉ hiện các vật này
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
/* NỀN TỰ ĐỘNG (soát Opus 2026-10-25): cảnh kiểu hạng mục (`nen` của nen_3d.py) dựng `rieng` = làm nổi + nền và `mo` 0,2 lúc
   áp. Trả trạng thái («⤓ Chụp góc» ở viec.html → YAML) mà ghi `rieng` đã nở thành mã vật + `mo` 0,2 thì nen_3d coi mục là
   cảnh riêng, thôi tính nền — vật mới không bao giờ vào, mã viên gạch đổi là lặng lẽ mất. Còn đúng tập nền ấy (chưa ai đổi
   chỉ-xem) thì trả lại `nen`/`nen_nhom` (khoá ngoài KHOA_TT, viec3d.py bỏ khi lưu) thay vì `rieng`, bỏ `mo` 0,2 và
   `danh_dau` (nen_3d tính lại), nhóm về đúng nhóm của mục. */
let NEN_TT = null;
function trangThai() {
  // đang mở «Chi tiết» cụm: cảnh tạm (chỉ cụm, camera vừa cụm, mặt cắt / tách lớp / làm nổi tắt) — trả cảnh SẼ VỀ khi đóng
  // (CT.luu), không trả cảnh tạm (soát Fable vòng 2: «⤓ Chụp góc» lúc Chi tiết mở ghi `rieng` = cụm)
  const L = CT.mo ? CT.luu : null;
  const rg = L ? L.rieng : rieng, nb = L ? L.noi : NOI_BAT, chonTT = L ? (L.chon?.isMesh ? L.chon : chon) : chon;
  const tt = { canh: MA_CANH, v: L ? `c=${f2(w2m(L.c))};t=${f2(w2m(L.t))}` : chuoiGoc() };
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
  if (rg) tt.rieng = [...rg];
  if (nb) tt.noi_bat = [...nb];
  if (DANH_DAU.dang()) tt.danh_dau = true;
  if (Math.abs(MO_NOI - MO_NOI_MD) > 1e-3) tt.mo = +MO_NOI.toFixed(2);
  if (NOI_LEN.ds) tt.noi_len = { ds: [...NOI_LEN.ds], khe: +NOI_LEN.khe.toFixed(2), ...(NOI_LEN.lop ? { lop: NOI_LEN.lop } : {}) };
  if (L) {
    if (L.cat) { if (L.cat.san >= 0) tt.cat_san = L.cat.san; else tt.cat = { truc: L.cat.truc, m: +Number(L.cat.m).toFixed(3), dao: L.cat.dao }; }
  } else if (!$("bang-cat").hidden) {
    if (catSanDang >= 0) tt.cat_san = catSanDang;
    else tt.cat = { truc: trucCat, m: +Number(catMHien).toFixed(3), dao: $("cat-dao").checked };
  }
  if (bocK) tt.boc = bocK;
  const tach = L ? L.tach : tachKhe;
  if (tach) tt.tach = +tach.toFixed(3);
  const ttDs = (GOC.userData.trinh_tu || []).find((x) => BUOC_TT && x.ma === BUOC_TT.ma);
  if (ttDs && BUOC_TT.k < ttDs.buoc.length) tt.buoc = BUOC_TT.k;
  const cm = {};
  for (const x of GOC.userData.chon_mot || []) if (CHON_MOT.get(x.ma) !== x.mac_dinh) cm[x.ma] = CHON_MOT.get(x.ma);
  if (Object.keys(cm).length) tt.tt = cm;
  if (chonTT) tt.chon = chonTT.userData.id;
  if (hienMa) tt.hien_ma = true;
  if (NEN_TT && NEN_TT.kb === KB_SO && rg && rg === NEN_TT.rieng) {
    delete tt.rieng; delete tt.danh_dau;
    if (tt.mo != null && Math.abs(tt.mo - 0.2) < 1e-3) delete tt.mo;
    // mục khai `nhom` ⇒ về đúng nhóm ấy (bỏ nhóm nền thêm vào); mục không khai ⇒ để nguyên nhóm đang bật (lọc hết sẽ
    // thành `nhom: []` = tắt mọi nhóm khi áp lại)
    if (NEN_TT.nhomGoc) { const goc = new Set(NEN_TT.nhomGoc); tt.nhom = tt.nhom.filter((m) => !NEN_TT.nenNhom.includes(m) || goc.has(m)); }
  }
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
    const d = d0.clone().normalize().applyQuaternion(q0.clone().slerp(q, e)).multiplyScalar(r0 * Math.pow(r1 / r0, e));   // khoảng nhìn nội suy theo log: phóng nhà → chi tiết đều tay, không bò rồi giật
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
/* TÁCH SO LE (học Anatomy 2026-10-27, «stagger the springs»): lớp không cùng đi một lúc. Tách: lớp NGOÀI CÙNG (trên cùng,
   i = 0) đi trước, lớp trong theo sau; ghép: ngược lại — lớp trong về trước, lớp ngoài về sau cùng. Theo thứ tự ấy lớp trên
   luôn ở trên lớp dưới (không lớp nào xuyên qua lớp nào) ở MỌI khung, kể cả khi đảo chiều giữa chừng (bắt đầu lại từ khe
   từng lớp đang có). Tổng thời gian không đổi; độ so le tối đa 35 % thời gian. iTheo: lớp camera đi theo (tachGiu). */
const tachLopHien = new Map();                    // i → khe hiện có của lớp i khi đang/đã tách so le (rỗng = mọi lớp = tachKhe)
function tachDan(khe, giay, dzCam = 0, iTheo = -1) {
  cancelAnimationFrame(tachRaf);
  const b0 = Math.max(0, Math.min(0.6, Number(khe) || 0));
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) giay = 0;
  const N = lopBoc().length;
  const datThang = () => { tachLopHien.clear(); tachLop(khe); doiCam(dzCam); return Promise.resolve(); };
  if (!(giay > 0) || !N) return datThang();
  const a0 = (i) => (tachLopHien.has(i) ? tachLopHien.get(i) : tachKhe);
  let lech = 0; for (let i = 0; i < N; i++) lech = Math.max(lech, Math.abs(b0 - a0(i)));
  if (lech < 1e-4) return datThang();
  const c0 = camera.position.clone(), t0 = controls.target.clone(), d = m2w(0, 0, dzCam).sub(m2w(0, 0, 0));
  giay *= Math.max(0.3, Math.min(1, lech / 0.25));   // tách / ghép một chút thì nhanh hơn tách hẳn
  return new Promise((xong) => {
  const a = tachKhe, b = b0, bd = performance.now(), ms = giay * 1000;
  const tu = Array.from({ length: N }, (_, i) => a0(i));
  const M = Math.max(1, N - 2), so = Math.min(0.35, 0.07 * M);                       // lớp cuối (i = N−1) không nâng
  const hang = (i) => (b > a ? i : N - 2 - i) / M;                                    // thứ tự xuất phát 0…1
  const ei = (k, i) => em(Math.max(0, Math.min(1, (k - hang(i) * so) / (1 - so))));
  const buoc = (now) => {
    const k = Math.min(1, (now - bd) / ms), e = em(k);
    for (let i = 0; i < N; i++) tachLopHien.set(i, tu[i] + (b - tu[i]) * ei(k, i));
    tachLop(a + (b - a) * e, (i) => tachLopHien.get(i) ?? tachKhe);
    if (k >= 1) { tachLopHien.clear(); tachLop(b); }
    const eCam = iTheo >= 0 && iTheo < N ? ei(k, iTheo) : e;                             // camera đi cùng lớp nó theo
    if (dzCam) { camera.position.copy(c0).addScaledVector(d, eCam); controls.target.copy(t0).addScaledVector(d, eCam); controls.update(); }
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
  return tachDan(khe, giay, nangLop(i, khe) - nangLop(i, tachLopHien.get(i) ?? tachKhe), i);   // từ khe lớp ấy đang có (đảo chiều giữa chừng)
}
function apTrangThai(tt = {}, { bay = 0.8, tachDe = null, giuCam = false, giuNoiLen = false } = {}) {
  if (!GOC) return false;
  KB_SO++; cancelAnimationFrame(bayRaf); cancelAnimationFrame(tachRaf);   // cảnh mới cắt ngang kịch bản / chuyển động đang chạy
  // CẢNH KIỂU HẠNG MỤC (trang con 3D, tools/3d/nen_3d.py): `nen` = tường, cột, sàn kề vật làm nổi ⇒ chỉ hiện làm nổi + nền,
  // nền mờ 0,2; `nen_nhom` = nhóm kết cấu cần bật cho chúng
  NEN_TT = null;
  if (tt.nen && tt.noi_bat?.length) {
    NEN_TT = { kb: KB_SO, nhomGoc: tt.nhom || null, nenNhom: tt.nen_nhom || [], rieng: null };
    tt = { ...tt, rieng: [...tt.noi_bat, ...tt.nen], mo: 0.2, nhom: [...new Set([...(tt.nhom || []), ...(tt.nen_nhom || [])])] };
  }
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
  // rieng nhận như noi_bat: mã vật, tên lớp (đầu chuỗi — gồm mọi thế của công tắc trong lớp ấy) hoặc «tiền-tố*»
  const moRieng = () => new Set(PHAN.filter((o) => noiBatCo(o, new Set(tt.rieng))).map((o) => o.userData.id));
  rieng = tt.rieng ? moRieng() : null;
  if (NEN_TT) NEN_TT.rieng = rieng;
  // nhóm tải chậm: dựng lại tập chỉ-xem; đang mở «Chi tiết» thì tập ấy là cảnh SẼ VỀ (CT.luu), đừng đè tập tạm của cụm
  if (tt.rieng) { const so = KB_SO; READY.then(() => { if (so !== KB_SO) return; const m = moRieng(); if (NEN_TT) NEN_TT.rieng = m;
    if (CT.mo) CT.luu.rieng = m; else { rieng = m; capNhatHien(); } }); }
  const noiCu = NOI_BAT;
  NOI_BAT = tt.noi_bat && tt.noi_bat.length ? new Set(tt.noi_bat) : null;
  // bản vẽ kích thước của mục: CHỦ THỂ (vật được ghi số — phần còn lại của làm nổi chỉ là nền) + mặt nhìn mặc định
  BV.chu = tt.ban_ve_chu && tt.ban_ve_chu.length ? new Set(tt.ban_ve_chu) : null;
  BV.huongMd = /^[xyz][+-]$/.test(tt.ban_ve_huong || "") ? tt.ban_ve_huong : null;
  // trang việc (khung nhúng, chế độ tập trung): KHÔNG tô xanh vật làm nổi (chủ nhà 2026-10-27) — vật nổi nhờ phần còn lại mờ đi
  DANH_DAU.bat(!!tt.danh_dau && !!NOI_BAT && !document.body.classList.contains("nhung"));
  datMoNoi(tt.mo != null ? tt.mo : MO_NOI_MD, bay > 0 ? Math.min(bay, 0.8) : 0);
  if (tt.noi_len && tt.noi_len.ds) noiLen(tt.noi_len.ds, { khe: tt.noi_len.khe ?? 0.5, lop: tt.noi_len.lop, ten: tt.noi_len.ten });
  else if (!giuNoiLen) boNoiLen();
  hienMa = !!tt.hien_ma;
  if (BUOC_TT) BUOC_TT.k = Number.MAX_SAFE_INTEGER;
  dungNhomKetCau(); dungLop(GOC.userData.nhom || []); dungTrinhTu();
  if (BUOC_TT) datBuoc(tt.buoc || Number.MAX_SAFE_INTEGER);
  bocLop(tt.boc || 0);
  capNhatHien(); apMo();
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
    // nhóm tải chậm xong: khung lại góc 3D — trừ khi đang ở bản vẽ kích thước (camera bản vẽ do banVe đặt, đừng bay đè)
    READY.then(() => { if (so !== KB_SO || BV.bat) return; const v2 = gocKhungNoiBat(tt.huong, tt.xa); if (v2 && v2 !== v) bayToi(v2, 0.6); });
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
canhNoi.environment = MT_TRANG;                          // cùng hộp đèn trắng «Màu thật» với cảnh chính, không đèn
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
  denGhiChu: (so) => { const b = GHI_CHU.find((x) => x.id === so); if (b) chonGhiChu(b, false); return !!b; },
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
  // CỤM + CHI TIẾT + NÚT NỔI (phép thử, 2026-10-21)
  cum: (id) => { const c = cumCua(THEO_ID.get(id)); return c && { ten: c.ten, phu_de: phuDeCum(c), so: c.ds.length, hien: c.ds.filter(hienDuoc).length,
    ds: c.ds.map((o) => o.userData.id), cong_tac: c.cms.map((cm) => cm.ma), phuong_an: c.pas.map((cm) => cm.ma),
    hop: (() => { const h = hopCum(c.ds); return [h.min.toArray(), h.max.toArray()].map((v) => v.map((n) => +n.toFixed(3))); })(), co: coChu(hopChuan(c.ds)) }; },
  dsCum: () => { cumCua(PHAN.find((o) => o.isMesh)); const da = new Set(), ra = [];
    for (const c of CUM.theo.values()) if (!da.has(c)) { da.add(c); if (c.ds.length > 1) { if (!c.ten) moTaCum(c); ra.push([c.ten, c.ds.length, c.ds[0].userData.linh_kien]); } }
    return { so_cum: da.size, ms: +CUM.ms.toFixed(1), ds: ra.sort((a, b) => b[1] - a[1]) }; },
  cumChon: () => CUM_CHON && { ten: CUM_CHON.ten, so: CUM_CHON.ds.length, vien: (VIEN_CUM.ds() || []).length, cam: [...CAM].map((o) => o.userData.id) },
  nutNoi: () => (NN.cm ? { cong_tac: NN.cm.ma, the: CHON_MOT.get(NN.cm.ma), toi: NN.lc?.nhan || null, nhan: NUT_NOI?.textContent || "", hien: !!NUT_NOI && !NUT_NOI.hidden,
    xy: [NN.x, NN.y], phan: NN.ds.map((o) => o.userData.id) } : null),
  bamNutNoi: () => bamNutNoi(),
  // KHAY SỬA (khung_sua.js, 2026-10-31): công tắc / phương án của cụm chứa vật — chế độ sửa ẩn ô trái nên đổi phương án ngay trên thanh đáy
  congTacVat: (id) => { const c = cumCua(THEO_ID.get(id)); return c ? [...c.pas, ...c.cms].map((cm) => ({ ma: cm.ma, nhan: cm.nhan, the: CHON_MOT.get(cm.ma), lua_chon: cm.lua_chon.map((l) => l.nhan) })) : []; },
  datCongTac: (ma, nhan) => { const cm = (GOC.userData.chon_mot || []).find((x) => x.ma === ma); if (!cm || !cm.lua_chon.some((l) => l.nhan === nhan)) return false;
    datChonMot(cm, nhan, true); dungLop(GOC.userData.nhom || []); capNhatHien(); return true; },
  neoNutNoi: () => neoNutNoi(),
  veSau: (f) => { VE_SAU.add(f); veLai(60); return () => { VE_SAU.delete(f); veLai(60); }; },   // móc: vẽ sau lớp viền / tập trung
  yeuCauKhung: (bat) => { KHUNG_LIEN = Math.max(0, KHUNG_LIEN + (bat ? 1 : -1)); return KHUNG_LIEN; },   // móc: vẽ liên tục khi đang diễn                     // móc: điểm neo (thế giới) + phần chuyển động của nút nổi
  vienCum: VIEN_CUM,                                // móc: viền cụm — dat(ds) · kieu({mau, rong}) · ds()
  diemVat: (id) => {                     // phép thử chạm thật: một điểm màn hình mà tia bắn trúng ĐÚNG vật này (null nếu bị che hết)
    const o = THEO_ID.get(id); if (!o || !o.visible) return null;
    const r = canvas.getBoundingClientRect(), pos = o.geometry.attributes.position, tam = hopVat(o).getCenter(new THREE.Vector3());
    const v = new THREE.Vector3(), n = pos.count, buoc = Math.max(1, Math.floor(n / 300));
    for (let i = -1; i < n; i += buoc) {
      if (i < 0) v.copy(tam); else v.fromBufferAttribute(pos, i).lerp(tam, 0.25);
      const w = m2w(v.x, v.y, v.z).project(camera);
      if (Math.abs(w.x) > 0.98 || Math.abs(w.y) > 0.98 || w.z > 1) continue;
      const e = { clientX: r.left + (w.x + 1) * r.width / 2, clientY: r.top + (1 - w.y) * r.height / 2 };
      const h = ban(e);
      if (h && h.object === o) return [Math.round(e.clientX), Math.round(e.clientY)];
    }
    return null;
  },
  chiTiet: (bat) => { if (bat === true) moChiTiet(); else if (bat === false) dongChiTiet(); return CT.mo ? { ten: CT.cum.ten, phan: CT.phan, bo_phan: (CT.nhom || []).map((g) => [g.ten, g.ds.length]), thuoc: THUOC_CUM.so() } : null; },
  phanCT: (i) => { const g = CT.nhom?.[i]; chonPhanCT(g ? g.khoa : null); return g ? g.ten : null; },
  thuocCT: (bat) => { datThuocCT(bat); THUOC_CUM.ve(); return THUOC_CUM.so(); },
  /* mọi công tắc trạng thái + chỗ neo nút nổi + nhãn (soát toàn bộ, 2026-10-21) */
  soatNutNoi: () => {
    const ra = [], giu = chon, the = new Map(CHON_MOT);
    for (const cm of GOC.userData.chon_mot || []) {
      if (laPaCT(cm)) continue;
      const ht = cm.lua_chon.find((lc) => lc.nhan === CHON_MOT.get(cm.ma));
      const o = ht && PHAN.find((x) => x.isMesh && hienDuoc(x) && lopLC(ht).some((n) => trongLop(x.userData, n)));
      if (!o) { ra.push({ ma: cm.ma, nhan: cm.nhan, loi: "không có bộ phận đang hiện" }); continue; }
      datChon(o);
      ra.push({ ma: cm.ma, nhan: cm.nhan, the: CHON_MOT.get(cm.ma), cum: CUM_CHON?.ten, so_cum: CUM_CHON?.ds.length, nut: NUT_NOI?.textContent || "", toi: NN.lc?.nhan || "(menu)",
        phan: NN.ds.length, neo: NN.ds.length ? w2m(NN.neo).toArray().map((n) => +n.toFixed(2)) : null });
    }
    for (const [k, v] of the) if (CHON_MOT.get(k) !== v) { const cm = GOC.userData.chon_mot.find((x) => x.ma === k); if (cm) datChonMot(cm, v); }
    datChon(giu);
    return ra;
  },
  /* soát nhãn nút nổi của cửa nhiều cánh (chủ nhà 3D #6): mọi công tắc ≥ 3 thế, mọi thế, mọi cánh — nhãn «Mở» chỉ khi cánh đang ĐÓNG
     và thế đích MỞ cánh ấy, «Đóng» chỉ khi thế đích đưa cánh về chỗ của thế «Đóng»; trả danh sách lỗi (rỗng = đạt) */
  soatNhanCanh: () => {
    const loi = [], giu = chon, the = new Map(CHON_MOT);
    for (const cm of GOC.userData.chon_mot || []) {
      const dong = cm.lua_chon.find((lc) => lc.nhan === "Đóng");
      if (laPaCT(cm) || !dong || new Set(cm.lua_chon.map((l) => l.nhan)).size < 3) continue;
      for (const lc of cm.lua_chon) {
        datChonMot(cm, lc.nhan);
        const ht = cm.lua_chon.find((x) => x.nhan === CHON_MOT.get(cm.ma));
        const thans = new Set(phanDong(cm).map((x) => thanTT(x.userData.ten)));
        if (thans.size < 2) continue;
        for (const than of thans) {
          const o = phanDong(cm, than).find((x) => thanTT(x.userData.ten) === than);
          if (!o) continue;
          datChon(o);
          if (!NN.lc || !NN.than) { loi.push(`${cm.ma} [${lc.nhan}] ${than}: không có nút một chạm`); continue; }
          const dongBox = hopTheoThan(dong).get(than), nay = hopTheoThan(ht).get(than), dich = hopTheoThan(NN.lc).get(than);
          const chu = NUT_NOI?.textContent || "", dangDong = !!(dongBox && nay && trungHop(nay, dongBox)), dichDong = !!(dongBox && dich && trungHop(dich, dongBox));
          const mong = dangDong ? "Mở" : "Đóng";
          if (chu !== mong || (dangDong && dichDong) || (!dangDong && !dichDong && chu === "Đóng") || (dich && nay && trungHop(dich, nay)))
            loi.push(`${cm.ma} [${lc.nhan}] ${than}: nút «${chu}» → «${NN.lc.nhan}» (cánh đang ${dangDong ? "đóng" : "mở"}, đích ${dichDong ? "đóng" : "mở"})`);
        }
      }
    }
    for (const [k, v] of the) if (CHON_MOT.get(k) !== v) { const cm = GOC.userData.chon_mot.find((x) => x.ma === k); if (cm) datChonMot(cm, v); }
    capNhatHien(); datChon(giu);
    return loi;
  },
  chonTen: (ten) => { const o = PHAN.find((x) => x.userData.ten && x.userData.ten.startsWith(ten) && hienDuoc(x)); if (o) datChon(o); return !!o; },
  tachGiu: (khe, giay) => { tachGiu(khe, giay); return khe; },
  banVe: (bat, chi, bp, huong, them) => { BV.huong = huong || null; BV.cat = !!(them && them.cat); BV.viTri = !!(them && them.vi_tri); BV.tuong = !!(them && them.tuong); return banVe(bat, chi, bp); },
  boPhan: () => boPhanBV(),                         // bộ phận chính của vật đang làm nổi (Khuôn, Cánh, Bản lề…)                       // bản vẽ kích thước (trang việc, nút «Kích thước»): true bật · false về 3D
  banVeDang: () => (BV.bat ? BV.truc : null),
  tachHien: () => tachKhe,
  machVat: (id) => { const u = THEO_ID.get(id)?.userData; if (!u) return null;   // phép thử giấu mạch phẳng: số điểm viền đủ / viền thường
    return { du: u.vienDu?.attributes.position.count ?? null, lien: u.vienLien?.attributes.position.count ?? null, vl: u.vlGoc?.name, dang: u.vien.geometry === u.vienDu ? "du" : u.vien.geometry === u.vienLien ? "lien" : "khac" }; },
  // soát cả cảnh (mạch ghép lại lộ — chủ nhà 2026-10-23): vật đã giấu mạch mà đang vẽ viền khác bản liền dù viền THƯỜNG,
  // và vật trong lô gộp có mảng viền gộp không khớp bản liền. Cả hai phải 0.
  machDem: () => {
    const lech = [];
    let giau = 0;
    for (const o of PHAN) {
      const u = o.userData;
      if (!u.vienLien || u.vienLien === u.vienDu) continue;
      giau++;
      if (u.vien.material === VIEN && u.vien.geometry !== u.vienLien && u.vien.geometry !== u.vienMin) lech.push(u.id);
    }
    const lo = LO ? LO.DS.filter((d) => d.vien >= 0 && d.o.userData.vienLien && d.soVien !== d.o.userData.vienLien.attributes.position.count).map((d) => d.o.userData.id) : [];
    return { luot: MACH_LUOT, giau, ve_du: lech.length, lo_lech: lo.length, vi_du: [...lech, ...lo].slice(0, 10) };
  },
  demNoiBat: () => (NOI_BAT ? PHAN.filter((o) => o.visible && noiBatCo(o)).length : null),   // phép thử: số vật đang hiện được làm nổi
  chieu: (x, y, z) => {                  // toạ độ mô hình → điểm màn hình (cho phép thử bấm chuột)
    const v = m2w(x, y, z).project(camera), r = canvas.getBoundingClientRect();
    return [r.left + ((v.x + 1) * r.width) / 2, r.top + ((1 - v.y) * r.height) / 2];
  },
  ghiChu: () => GHI_CHU,
  veMotKhung: () => { controls.update(); datMatGan(); if (GOC) { datGhim(); datNhanThuoc(); } veCanh(); },
  // phép thử ảnh vân: số ảnh trên vật liệu đang dùng · số đã về (khác ảnh tạm 1×1) · số không LẶP (kẹp mép = vân hỏng)
  vanAnh: () => { const da = new Set(); let that = 0, kep = 0;
    scene.traverse((o) => { for (const m of [o.material].flat()) for (const t of [m?.map, m?.normalMap, m?.roughnessMap]) if (t && !t.isCanvasTexture && !da.has(t)) {   // nhãn vẽ bằng canvas: kẹp mép là đúng
     
      da.add(t); if ((t.image?.width || 0) > 1) that++; if (t.wrapS !== THREE.RepeatWrapping || t.wrapT !== THREE.RepeatWrapping) kep++; } });
    return { n: da.size, that, cho: da.size - that, kep }; },
  laBan: (khoa) => nhinDocTruc(khoa[0], Number(khoa.slice(1))),
  huongNhin: () => { const d = w2m(camera.position).sub(w2m(controls.target)).normalize(); return [d.x, d.y, d.z].map((n) => +n.toFixed(3)); },
  // vật chú thích (phép thử tự động)
  them: (rec) => { const o = themNhap(rec); chonNhap(o); return NHAP.length; },
  nhap: () => NHAP.map((o) => o.userData.rec),
  matGan: () => ({ gan: +camera.near.toFixed(3), xa: +camera.far.toFixed(3), cam: w2m(camera.position).toArray().map((n) => +n.toFixed(3)) }),   // phép thử: vật chú thích ngoài hộp nhà vẫn trong khoảng vẽ
  bienDoi: (kieu, truc, so) => { batBienDoi(kieu); if (truc) bienDoi.truc = truc; if (so != null) bienDoi.so = String(so); capNhatBienDoi(); xongBienDoi(true); return ctChon && ctChon.userData.rec; },
};
// điều khiển từ ngoài đổi cảnh không qua chuột/phím ⇒ mỗi lệnh XEM.* hẹn vẽ lại (vẽ khi cần)
for (const [k, f] of Object.entries(window.XEM)) if (typeof f === "function") window.XEM[k] = (...a) => { try { return f(...a); } finally { veLai(300); } };
