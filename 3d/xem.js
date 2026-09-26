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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: true, powerPreference: "high-performance" });   // stencil: tô mặt cắt
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
scene.background = new THREE.Color(0xefeae0);
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 500);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.screenSpacePanning = true;
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
if (THUC) {
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.15;
  scene.environment = MOI_TRUONG;
  scene.environmentIntensity = 0.5;
}
scene.add(new THREE.HemisphereLight(0xfbf7ee, 0x8a8478, THUC ? 0.9 : 1.6));
const nang = new THREE.DirectionalLight(0xffffff, 1.8);
scene.add(nang);
const nang2 = new THREE.DirectionalLight(0xffffff, 0.5);
scene.add(nang2);

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
      uGan: { value: 0.01 }, uXa: { value: 500 }, uNguong: { value: 1 }, uManh: { value: 0.55 }, uLuong: { value: 0 }, uNen: { value: new THREE.Color() } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `
      uniform sampler2D tMau; uniform sampler2D tSau; uniform vec2 uBuoc; uniform float uGan, uXa, uNguong, uManh, uLuong; uniform vec3 uNen;
      varying vec2 vUv;
      // độ sâu d (0…1) → 1/z (z = gần·xa / (xa − d·(xa − gần))): tuyến tính theo điểm ảnh trên mọi mặt phẳng
      float nghich(vec2 p) { return (uXa - texture2D(tSau, p).x * (uXa - uGan)) / (uGan * uXa); }
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
        float nguong = uNguong + 6.0 * uLuong / m;
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
  return { ve, dat, bat: () => bat };
})();
scene.matrixWorldAutoUpdate = false;       // ma trận cập nhật MỘT lần mỗi khung ở veCanh, không phải mỗi lượt vẽ (nét viền vẽ 2 lượt)
function veCanh() {
  scene.updateMatrixWorld();
  const an = LO ? LO.truoc() : null;                          // vật đang ở trạng thái gốc: ẩn, vẽ qua lô gộp
  if (NET) NET.ve(); else renderer.render(scene, camera);
  if (an) for (const o of an) o.visible = true;
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
const VL_GACH_KINH = new THREE.MeshPhysicalMaterial({ color: 0xeef6f7, metalness: 0, roughness: 0.30,
  transmission: 1, thickness: 0.08, ior: 1.5, side: THREE.DoubleSide });
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
   Vật thể RIÊNG (PHAN) vẫn là nguồn thật — bấm chọn, ẩn/hiện, xuyên tường, lớp nhiệt, tách lớp, kiểm tra đều đụng nó như cũ.
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
     tập vật đổi — bật/tắt lớp, chọn, xuyên tường — không phải mỗi khung) */
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
    const cat = !!matCat;                                          // mặt cắt: nắp tô cần từng vật riêng ⇒ tạm không gộp
    for (const d of DS) {
      const o = d.o, v = o.userData.vien;
      let dung = !cat && o.visible && (o.layers.mask & 1) !== 0 && o.material === d.vl
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
let xong;
const READY = new Promise((r) => (xong = r));

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
  const kq = await Promise.all(thuTu.map((ma) => napLk(ma)
    .then((g) => ({ ma, g })).catch((e) => { LK_LOI.set(ma, String(e.message || e)); return null; })));
  performance.mark("xem:glb");                    // mọi nhóm đã phân tích, kể cả ảnh vân
  const co = kq.filter(Boolean);
  LK_CO.length = 0; for (const { ma } of co) LK_CO.push(ma);   // nhóm THỰC SỰ tải được (cho lớp nhiệt)
  if (!co.length) throw new Error("không nhóm nào tải được");
  const extras = {};
  for (const { ma, g } of co) {
    const r = g.scene.children[0];
    r.traverse((o) => { if (o.isMesh) o.userData.linh_kien = ma; });
    for (const [k, v] of Object.entries(r.userData || {})) if (!(k in extras)) extras[k] = v;
    if (!GOC) { GOC = r; scene.add(g.scene); continue; }
    for (const c of [...r.children]) GOC.add(c);        // cùng phép xoay gốc ⇒ toạ độ con giữ nguyên
  }
  const nhom = [];
  for (const { g } of co) for (const n of g.scene.children[0].userData.nhom || []) if (!nhom.includes(n)) nhom.push(n);
  // TRÌNH TỰ THI CÔNG: nhóm nào khai `trinh_tu` (danh sách bước) ở gốc thì vật của nhóm ấy mang `buoc`
  const trinh_tu = [];
  for (const { ma, g } of co) { const tt = g.scene.children[0].userData.trinh_tu; if (tt && tt.length) trinh_tu.push({ ma, buoc: tt }); }
  const chon_mot = [];      // các biến thể tháp khai CÙNG công tắc (cùng tên lớp) ⇒ một công tắc lái cả ba
  for (const { g } of co) for (const cm of g.scene.children[0].userData.chon_mot || []) if (!chon_mot.some((x) => x.ma === cm.ma)) chon_mot.push(cm);
  GOC.userData = { ...extras, nhom, chon_mot, trinh_tu, tieu_de: CANH.tieu_de || MA, lop_boc: CANH.lop_boc || [],
    mat_cat_san: CANH.mat_cat_san || [], khung_bo_nhom: CANH.khung_bo_nhom || [],
    khung_linh_kien: CANH.khung_linh_kien || null, linh_kien: DM.linh_kien };
  const muon = Q.get("nhom") ? Q.get("nhom").split(",") : CANH.hien;
  for (const x of DM.linh_kien) if (!muon.includes(x.ma)) lkTat.add(x.ma);
  scene.updateMatrixWorld(true);
}

napMoHinh().then(() => {
  const info = GOC.userData;
  $("ten-mo-hinh").textContent = info.tieu_de;
  document.title = `${info.tieu_de} — Mô hình 3D 383`;
  GOC.traverse((o) => {
    if (!o.isMesh) return;
    const u = o.userData;
    if (!u.id) return;
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
    o.userData.vlGoc = o.material;
    const coVan = THUC && !!o.material.map;
    if (coVan) for (const t of [o.material.map, o.material.normalMap, o.material.roughnessMap, o.material.metalnessMap]) if (t) t.anisotropy = DI_HUONG;
    // mặt có vân và khối phòng KHÔNG BAO GIỜ hiện viền ⇒ khỏi tính EdgesGeometry (tốn lúc mở trang), giữ vật rỗng cho
    // chỗ khác đổi .material của viền (toThem, phân tích) như cũ
    const khongVien = coVan || !!u.khoi_phong || u.khong_vien === true || u.khong_vien === "True";   // khong_vien: vật bị lớp hoàn thiện liền phủ kín (#567)
    const e = new THREE.LineSegments(khongVien ? HINH_RONG : new THREE.EdgesGeometry(o.geometry, 25), VIEN);
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
  });
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
  capNhatHien();
  damBaoNhomVung();
  apDungUrl();
  taiGhiChu();
  xong();
  moLopNhiet();
  moPhanTich();
  moKiemTra();
  performance.mark("xem:dung");                   // cảnh dựng xong (lô, lớp, ghi chú)
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
  /* MỘT NHÀ, HAI HỆ KHÍ: mỗi NHÓM KẾT CẤU có tệp nhiệt riêng (mai.nhiet.json = khoang mái L2/L7;
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
function hienDuoc(o) {
  const u = o.userData;
  if (u.ma && !hienMa) return false;
  if (u.phan_tich && !hienPhanTich) return false;
  if (lkTat.has(u.linh_kien)) return false;
  if (lopTat.has(u.nhom) || lopTatCha(u.nhom)) return false;
  if (anTay.has(u.id)) return false;
  if (anNgoai && anNgoai(u)) return false;
  if (rieng && !rieng.has(u.id)) return false;
  if (BUOC_TT && u.buoc && u.linh_kien === BUOC_TT.ma && u.buoc > BUOC_TT.k) return false;
  return true;
}
function capNhatHien() { for (const o of PHAN) o.visible = hienDuoc(o); dungDsAn(); }
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
function toMach() {
  for (const o of MACH) if (o !== chon && !THEM.has(o)) o.material = o.userData.vlHien || o.userData.vlGoc;
  MACH.clear();
  const u = chon && chon.userData;
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
  $("tt-vl").textContent = u.vat_lieu_ten || u.vat_lieu;
  const b = new THREE.Box3();
  // hộp bao theo trục MÔ HÌNH: lấy từ thuộc tính min/max của lưới (đã ở toạ độ mô hình)
  chon.geometry.computeBoundingBox();
  b.copy(chon.geometry.boundingBox);
  const s = b.getSize(new THREE.Vector3());
  $("tt-kt").textContent = `${mm(s.x)} × ${mm(s.y)} × ${mm(s.z)} mm`;
  $("tt-cd").textContent = `+${b.min.z.toFixed(3)} → +${b.max.z.toFixed(3)} m`;
  $("tt-id").textContent = u.id;
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
const vatMo = new Set();     // id từng vật XEM XUYÊN (nút «Xem xuyên (T)» ở ô bên phải) — như ◐ của lớp, cho một vật
const laMa = (o) => o.userData.ma || lopMo.has(o.userData.nhom) || vatMo.has(o.userData.id);
function apMo() {
  for (const o of PHAN) {
    if (o.userData.ma) continue;
    const goc = o.userData.vlGoc;
    let m = goc;
    const mo = lopMo.has(o.userData.nhom) || vatMo.has(o.userData.id) || XUYEN_TD.mo.has(o.userData.id);
    if (mo) {
      m = VL_MO.get(goc);
      if (!m) {
        m = goc.clone(); m.transparent = true; m.opacity = 0.12; m.depthWrite = false;
        VL_MO.set(goc, m);
      }
    }
    o.userData.vlHien = m;
    if (o !== chon && !THEM.has(o)) o.material = MACH.has(o) ? VL_MACH : m;
    else o.material = vlChon(o);
    o.renderOrder = mo ? 2 : 0;
  }
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
    if (XUYEN_TD.mo.has(h.object.userData.id)) continue;   // tường tự mờ vì chắn camera: bấm xuyên qua
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
  canvas.style.cursor = doDangBat ? "crosshair" : "pointer";
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

/* ── XUYÊN TƯỜNG TỰ ĐỘNG ────────────────────────────────────────────────
   Tường, sàn, trần, cột, lớp hoàn thiện nằm GIỮA camera và tâm xoay thì tự vẽ mờ + bấm xuyên qua —
   xoay vào trong phòng mà không phải ẩn tay. Bộ riêng (không đụng vatMo/lopMo). Tắt khi chụp ảnh (?chup=1) hoặc
   ?xuyen_td=0; nút «Xuyên tường» trên thanh công cụ bật/tắt, nhớ theo máy. */
const XUYEN_TD = (() => {
  const VL = new Set(["tuong", "betong", "thach_cao", "son_trang_ngoai", "son_kem", "son_dat_nung", "gach_bong_gio",
    "xi_mang", "tuong_rao", "nha_ben", "mai_ben", "panel", "ton"]);
  const chan = (o) => VL.has(o.userData.vat_lieu) || /^Hoàn thiện/.test(o.userData.ten || "");
  let bat = !Q.get("chup") && Q.get("xuyen_td") !== "0";
  try { if (!Q.get("chup") && localStorage.getItem("xem:xuyen_td") === "0") bat = false; } catch (_) { /* không có kho */ }
  const mo = new Set();
  const r = new THREE.Raycaster();
  let khoa = "", luc = 0;
  function capNhat(ep = false) {
    const k = bat ? camera.position.toArray().map((v) => v.toFixed(2)).join() + controls.target.toArray().map((v) => v.toFixed(2)).join() : "tat";
    const bay = performance.now();
    if (!ep && k === khoa) return;
    if (!ep && bay - luc < 90) { veLai(100); return; }       // bị hoãn: hẹn một khung nữa, kẻo camera dừng mà tường chưa mờ
    khoa = k; luc = bay;
    const moi = new Set();
    if (bat) {
      const dich = controls.target;
      const kc = camera.position.distanceTo(dich);
      const ung = PHAN.filter((o) => o.visible && chan(o));
      const len = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
      const phai = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const lech = Math.min(0.35, kc * 0.06);
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const d = dich.clone().addScaledVector(phai, dx * lech).addScaledVector(len, dy * lech);
        const huong = d.clone().sub(camera.position);
        const L = huong.length();
        r.set(camera.position, huong.normalize()); r.far = L - 0.05;
        for (const h of r.intersectObjects(ung, false)) {
          if (matCat && matCat.distanceToPoint(h.point) < 0) continue;
          // chỉ làm mờ mặt ĐỨNG (tường, cột): sàn / trần / lớp lát nằm ngang chắn camera là thứ đang xem, không mờ (#257)
          if (h.face && Math.abs(h.face.normal.clone().transformDirection(h.object.matrixWorld).z) > 0.7) continue;
          moi.add(h.object.userData.id);
        }
      }
    }
    if (moi.size === mo.size && [...moi].every((i) => mo.has(i))) return;
    mo.clear(); for (const i of moi) mo.add(i);
    apMo();
  }
  function dat(v) {
    bat = v; try { localStorage.setItem("xem:xuyen_td", v ? "1" : "0"); } catch (_) { /* không có kho */ }
    const n = $("nut-xuyen-td"); if (n) n.setAttribute("aria-pressed", String(bat));
    capNhat(true);
  }
  return { mo, capNhat, dat, bat: () => bat };
})();
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
  for (const cm of GOC.userData.chon_mot || []) {
    if (!cm.lua_chon.some((lc) => dem.has(lc.nhom))) continue;     // nhóm kết cấu mang nó đang tắt
    const hang = document.createElement("div"); hang.className = "hang-cm";
    const t = document.createElement("span"); t.textContent = cm.nhan;
    hang.append(t, nutCongTac(cm, () => { dungLop(GOC.userData.nhom || []); capNhatHien(); }));
    cmK.append(hang);
  }
  const hai = (GOC.userData.chon_mot || []).filter((cm) => laDongMo(cm) && cm.lua_chon.some((lc) => dem.has(lc.nhom)));
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
if ($("nut-vien")) {
  if (!NET) $("nut-vien").hidden = true;                          // ?thuc=0 / ?vien=0: không có lượt nét viền
  else { $("nut-vien").setAttribute("aria-pressed", String(NET.bat())); $("nut-vien").onclick = () => NET.dat(!NET.bat()); }
}
if ($("nut-xuyen-td")) {
  $("nut-xuyen-td").setAttribute("aria-pressed", String(XUYEN_TD.bat()));
  $("nut-xuyen-td").onclick = () => XUYEN_TD.dat(!XUYEN_TD.bat());
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
function capNhatCat() {
  if ($("bang-cat").hidden) { renderer.clippingPlanes = []; matCat = null; datNapCat(); return; }
  for (const b of document.querySelectorAll("[data-truc]")) b.setAttribute("aria-pressed", String(b.dataset.truc === trucCat));
  const k = { x: 0, y: 1, z: 2 }[trucCat];
  const bb = new THREE.Box3();
  for (const o of PHAN) if (!o.userData.ma) { o.geometry.computeBoundingBox(); bb.union(o.geometry.boundingBox); }
  const lo = bb.min.getComponent(k), hi = bb.max.getComponent(k);
  const t = Number($("cat-vi-tri").value) / 1000;
  const v = catViTriM != null ? catViTriM : lo + (hi - lo) * t;
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
$("nut-cat").onclick = () => batCat($("bang-cat").hidden);
function boCatSan() { catViTriM = null; catSanDang = -1; veCatSan(); }
for (const b of document.querySelectorAll("[data-truc]")) b.onclick = () => { trucCat = b.dataset.truc; boCatSan(); capNhatCat(); };
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
function vlNap(kieu) {
  const [nen, muc, k, buoc] = kieu;
  return new THREE.ShaderMaterial({
    uniforms: { uNen: { value: v3Hex(nen) }, uMuc: { value: v3Hex(muc) }, uKieu: { value: k }, uBuoc: { value: buoc || 8 }, uPR: { value: 1 },
      uA: { value: NET ? 0 : 1 } },                         // alpha 0 = dấu cho lượt nét viền (NET): màu này đã là màu hiển thị
    vertexShader: "void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      uniform vec3 uNen; uniform vec3 uMuc; uniform float uKieu; uniform float uBuoc; uniform float uPR; uniform float uA;
      float net(float d, float s, float w) { float r = mod(d, s); r = min(r, s - r); return 1.0 - smoothstep(w * 0.5, w * 0.5 + 0.9, r); }
      void main() {
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
function vlDem(mat, tang) {
  const op = tang ? THREE.IncrementWrapStencilOp : THREE.DecrementWrapStencilOp;
  return new THREE.MeshBasicMaterial({ side: mat, colorWrite: false, depthWrite: false, depthTest: false,
    stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc, stencilFail: op, stencilZFail: op, stencilZPass: op });
}
const VL_DEM = { sauTang: vlDem(THREE.BackSide, true), truocGiam: vlDem(THREE.FrontSide, false),
                 sauGiam: vlDem(THREE.BackSide, false), truocTang: vlDem(THREE.FrontSide, true) };
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
    const kin = kinCua(o.geometry);
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
    for (const [o, kin] of ds) {
      for (const vl of kin > 0 ? [VL_DEM.sauTang, VL_DEM.truocGiam] : [VL_DEM.sauGiam, VL_DEM.truocTang]) {
        const m = new THREE.Mesh(o.geometry, vl);
        m.renderOrder = r0; m.visible = false; m.raycast = () => {};
        m.userData.dem = true;
        o.add(m); dem.push(m);
      }
    }
    const nap = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), vlNap(kieuNapCua(khoa, ds[0][0].material)));
    nap.renderOrder = r0 + 0.005; nap.visible = false; nap.frustumCulled = false; nap.raycast = () => {};
    scene.add(nap);
    NAP.push({ khoa, nap, dem, so: ds.length });
  });
  if (hoKhong) console.info(`tô mặt cắt: ${NAP.reduce((n, g) => n + g.so, 0)} khối kín trong ${NAP.length} nhóm vật liệu, bỏ ${hoKhong} lưới hở/không kín`);
}
function datNapCat() {
  const bat = !!matCat;
  const pr = renderer.getPixelRatio();
  for (const g of NAP) {
    for (const m of g.dem) m.visible = bat;
    g.nap.visible = bat;
    if (!bat) continue;
    const tam = matCat.projectPoint(hopTheGioi.getCenter(new V3()), new V3());
    g.nap.position.copy(tam);
    g.nap.quaternion.setFromUnitVectors(new V3(0, 0, 1), matCat.normal);
    const s = hopTheGioi.getSize(new V3()).length() * 4 + 1;
    g.nap.scale.set(s, s, 1);
    g.nap.material.uniforms.uPR.value = pr;
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
function tachLop(khe) {
  const ds = lopBoc();
  if (!ds.length) return 0;
  tachKhe = Math.max(0, Math.min(0.6, Number(khe) || 0));
  const N = ds.length;
  for (const o of PHAN) { const i = o.userData.lopBoc; o.position.z = i >= 0 ? (N - 1 - i) * tachKhe : 0; }
  GOC.updateMatrixWorld(true);
  if (tachKhe) { if (doDangBat) batDo(false); huyVung(); thoiThem(); }
  veBoc();
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
  for (const el of lopNhan.children) {
    const v = m2w(...el.dataset.p.split(",").map(Number)).project(camera);
    el.style.display = v.z > 1 ? "none" : "";
    el.style.left = ((v.x + 1) * r.width) / 2 + "px";
    el.style.top = ((1 - v.y) * r.height) / 2 + "px";
  }
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
  else if (k === "x") XUYEN_TD.dat(!XUYEN_TD.bat());             // xuyên tường tự động
  else if (k === "v" && NET) NET.dat(!NET.bat());                // nét viền theo độ sâu
  else if (k === "m") batDo(!doDangBat);
  else if (k === "c") batCat($("bang-cat").hidden);
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
  u.searchParams.set("nhom", DM.linh_kien.map((x) => x.ma).filter((m) => !lkTat.has(m)).join(","));
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
let lbKhoa = "";
function veLaBan() {
  if (!GOC) return;
  const khoa = camera.quaternion.toArray().map((v) => v.toFixed(4)).join() + lbHover;   // không đổi hướng ⇒ không dựng lại SVG
  if (khoa === lbKhoa) return;
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
  nang.position.copy(controls.target).add(new THREE.Vector3(d.x + 0.6, 1.2, d.z + 0.4).multiplyScalar(20));
  nang2.position.copy(controls.target).add(new THREE.Vector3(-d.x - 0.5, 0.4, -d.z).multiplyScalar(20));
  if (GOC) { datGhim(); datNhanThuoc(); veLaBan(); XUYEN_TD.capNhat(); }
  veCanh();
}
controls.addEventListener("change", () => veLai());
ve();

/* ── điều khiển từ ngoài (tools/3d/chup.mjs) ───────────────────────────── */
window.XEM = {
  ready: READY,
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
  chieu: (x, y, z) => {                  // toạ độ mô hình → điểm màn hình (cho phép thử bấm chuột)
    const v = m2w(x, y, z).project(camera), r = canvas.getBoundingClientRect();
    return [r.left + ((v.x + 1) * r.width) / 2, r.top + ((1 - v.y) * r.height) / 2];
  },
  ghiChu: () => GHI_CHU,
  veMotKhung: () => { controls.update(); if (GOC) { datGhim(); datNhanThuoc(); } veCanh(); },
  laBan: (khoa) => nhinDocTruc(khoa[0], Number(khoa.slice(1))),
  huongNhin: () => { const d = w2m(camera.position).sub(w2m(controls.target)).normalize(); return [d.x, d.y, d.z].map((n) => +n.toFixed(3)); },
  // vật chú thích (phép thử tự động)
  them: (rec) => { const o = themNhap(rec); chonNhap(o); return NHAP.length; },
  nhap: () => NHAP.map((o) => o.userData.rec),
  bienDoi: (kieu, truc, so) => { batBienDoi(kieu); if (truc) bienDoi.truc = truc; if (so != null) bienDoi.so = String(so); capNhatBienDoi(); xongBienDoi(true); return ctChon && ctChon.userData.rec; },
};
// điều khiển từ ngoài đổi cảnh không qua chuột/phím ⇒ mỗi lệnh XEM.* hẹn vẽ lại (vẽ khi cần)
for (const [k, f] of Object.entries(window.XEM)) if (typeof f === "function") window.XEM[k] = (...a) => { try { return f(...a); } finally { veLai(300); } };
