/* DỜI · XOAY · NÂNG HẠ · BỎ · THẢ ĐỒ ĐẠC TRÊN TRÌNH XEM (chủ nhà 2026-10-29/30). Chỉ ở máy — ghi thẳng vào mặt bằng.
   Yêu cầu: «chọn một vật thì dời được, xoay từng 90°» · «bỏ được vật; thư viện lớn tìm được, kéo thả vào 3D» · «giao diện
   theo ngữ cảnh như game» · «thôi kéo là LƯU NGAY» · «kéo lên xuống được» · «chọn nhiều món dời cả nhóm».

   HỌC TỪ GAME:
     · NÚT THEO NGỮ CẢNH bám ngay trên vật đang chọn (game xây trên di động: chạm công trình ⇒ hàng nút tròn hiện cạnh nó;
       Planet Coaster: thao tác mở từ chính vật) — không phải thanh dưới đáy màn hình xa vật: ⟲ ⟳ xoay 90° · ↕ nâng hạ · 🗑 bỏ.
     · NẮM VẬT MÀ KÉO (Animal Crossing): chạm vật đang chọn rồi kéo là dời; kéo chỗ khác vẫn xoay camera.
     · THẢ TAY LÀ ĐẶT (Animal Crossing: buông là đặt) — nhưng chỉ là NHÁP: «Xác nhận» mới ghi, «Huỷ» / tắt chế độ sửa về như cũ. Chỗ thả bị chặn ⇒ vật về CHỖ HỢP LỆ GẦN NHẤT vừa đi qua rồi lưu chỗ ấy
       (The Sims từ chối chỗ đỏ — không bao giờ ghi chỗ đỏ); chưa qua chỗ hợp lệ nào thì về chỗ cũ. Hoàn tác: ⌘/Ctrl+Z, nút trên thông báo.
     · TẤM IN DẤU dưới chân mỗi món xanh / đỏ khi đang kéo (The Sims tô đỏ chỗ không đặt được), lý do hiện ngay dưới hàng nút.
     · NÂNG HẠ (Planet Coaster: mũi tên trục đứng; The Sims: phím 9 / 0): kéo nút ↕ lên xuống, hoặc phím 9 nâng · 0 hạ (PageUp /
       PageDown), bước 50 mm, Alt 5 mm. Không có vật bay (luật chủ nhà, kiem_bay.py): món nâng lên phải ĐỨNG TRÊN mặt món khác /
       bệ bếp, hoặc áp tường để treo — không thì đỏ.
     · CHỌN NHIỀU (Planet Coaster chọn nhiều món): Shift+bấm thêm / bớt món; kéo, xoay (quanh tâm cả nhóm), nâng hạ, bỏ áp
       cho cả nhóm, một lần ghi.
     · bám lưới 50 mm tính từ chỗ cũ (vật áp tường kéo dọc tường vẫn áp tường), giữ Alt: 5 mm; xoay R / . · Shift+R / , ; Delete bỏ.
     · THƯ VIỆN (data/furniture-presets.yaml): kéo một cỡ thả vào khung là nháp (Xác nhận mới ghi); chạm cỡ ⇒ món đặt vào chỗ trống gần giữa khung nhất.
   Nguồn thật: data/floorplans/<tầng>.geometry.yaml furniture — ghi qua tools/3d/dat_do.py → tools/floorplan/edit.py (một
   đường ghi với trình vẽ). Món mới thả hiện bằng khối giữ chỗ đúng cỡ tới khi tải lại («Có bản mới»). */

export function batDau(api) {
  const { THREE, GOC, PHAN, canvas, camera, controls, veLai, m2w, w2m } = api;
  const V3 = THREE.Vector3, TRUC_Z = new V3(0, 0, 1);
  const BUOC = 0.05, BUOC_MIN = 0.005;                                // bám lưới 50 mm · Alt 5 mm (mét)
  const DUNG = new Map();                                             // khoá «t1:F33» → chỗ lúc DỰNG {x, y, rot, z} (lưới mang hình ở chỗ ấy)
  const NAY = new Map();                                              // khoá → chỗ đang có trên mặt bằng + cỡ, tên, nâng hạ được không
  const GIU_CHO = new Map();                                          // khoá → khối giữ chỗ của món mới thả (chưa dựng lại)
  const HOAN_TAC = [];
  let SAN = { t1: 0.3, t2: 4.2 }, MAY_OK = true;
  /* THIẾT BỊ (bản đăng trên site, iPhone — chủ nhà 2026-11-02): không có xem.py ⇒ chế độ sửa CHỈ ĐỔI VẬT LIỆU; lời gọi máy của
     mô-đun vật liệu trả lời trên trình duyệt (web/sua/thiet_bi.js), lựa chọn + mẫu tự thêm lưu ở máy này. Dời · xoay · bỏ ·
     thả đồ, tường, kho… tắt. */
  const THIET_BI = !!api.thietBi;
  if (THIET_BI) { MAY_OK = false; document.body.classList.add("thiet-bi"); }
  let NHOM = [];                                                      // khoá các món đang chọn (dời được)
  let E = null;                                                       // lượt kéo: {kieu: "xy" | "z" | "xoay", ks, dau, nay, ok, loi, hl}
  // móc cho các mô-đun web/sua/*.js (xem «MỞ RỘNG» cuối tệp)
  const KHI_KEO = [], KHI_THOI_KEO = [], PHIM = [], KHI_LUI = [], NHAP_NGOAI = [], NUT_NGOAI = [], KHI_XAC_NHAN = [];

  const khoaCua = (dd) => `${dd.tang}:${dd.id}`;
  const laMon = (o) => o && o.userData.do_dac && !o.userData.trang_thai_phu && !o.userData.ma;
  const dsCua = (k) => PHAN.filter((o) => o.userData.do_dac && khoaCua(o.userData.do_dac) === k);
  const LAT0 = new Map();                                             // khoá → món đã LẬT (mirrored) trên mặt bằng lúc tải (mô-đun bien_doi nạp)
  const chep = (s) => ({ x: s.x, y: s.y, rot: s.rot, z: s.z, k: s.k ?? 1, kx: s.kx ?? 1, ky: s.ky ?? 1, kz: s.kz ?? 1, lat: !!s.lat });   // k: phóng đều so với lúc dựng · kx ky kz: kéo riêng rộng · sâu · cao · lat: lật gương
  function nhan(o) {
    const d = o.userData.do_dac, k = khoaCua(d);
    if (!DUNG.has(k)) {
      const ds = dsCua(k), hop = new THREE.Box3();
      for (const m of ds) hop.expandByObject(m);
      const hD = hop.isEmpty() ? 0 : hop.max.y - hop.min.y;            // cao lúc dựng (thế giới y lên) — phóng to / thu nhỏ ghi height_mm
      DUNG.set(k, { x: d.x / 1000, y: d.y / 1000, rot: d.rot, z: (d.z || 0) / 1000, k: 1, lat: !!LAT0.get(k) });
      NAY.set(k, { x: d.x / 1000, y: d.y / 1000, rot: d.rot, z: (d.z || 0) / 1000, k: 1, kx: 1, ky: 1, kz: 1, lat: !!LAT0.get(k), w: d.w, d: d.d, hD, tang: d.tang, id: d.id, ten: d.ten || d.id, doc: d.doc !== false });
      for (const m of ds) if (!m.userData.p0) { m.userData.p0 = m.position.clone(); m.userData.q0 = m.quaternion.clone(); m.userData.s0 = m.scale.clone(); }
    }
    return k;
  }

  /* ── đặt hình của món theo chỗ s = {x, y, rot, z, k} — xoay quanh tâm món, trục đứng mô hình; phóng k quanh điểm chân món ── */
  const _M = new THREE.Matrix4(), _L = new THREE.Matrix4(), _P = new V3(), _Q = new THREE.Quaternion(), _S = new V3();
  /* ── PHÓNG KIỂU 9 Ô (chủ nhà 2026-10-31: «keep most parts at their original size and stretch only the middle parts, like
     2D 9-slice — enlarging a 4-leg chair keeps the legs the same size, only the seat grows»). Mỗi trục của món (u rộng · v sâu ·
     z cao, khung lúc dựng) chia ba: hai đầu dày E = min(200 mm, 30 % bề món) giữ NGUYÊN cỡ và chỉ trượt theo mép, phần giữa
     giãn / co cho đủ cỡ mới — mép ngoài vẫn đúng chỗ của phóng thẳng (tay nắm, dấu chân, luật chỗ đặt không đổi). Bộ phận nhỏ
     nằm trọn phần giữa (chân giữa, núm, đèn bàn…) trượt nguyên khối theo tâm của nó. Cỡ mới nhỏ hơn hai đầu cộng lại ⇒ phóng
     thẳng trục ấy. Làm trên ĐỈNH lưới (bản chép riêng từng lưới của món đang sửa) — trở về cỡ cũ thì trả hình gốc. Lưới
     instanced / không có đỉnh thì phóng thẳng như trước. Chỉ là hình xem trước: dựng lại sau «Xác nhận» theo cỡ mới. */
  const DAU_9 = 0.2, TI_9 = 0.3, NHO_9 = 0.25;
  const KHUNG_9 = new Map();                                          // khoá món → {ds, lo, hi, phan:[{o, plo, phi, lop:[…]}]}
  const _N3 = new THREE.Matrix3(), _Mi = new THREE.Matrix4();
  function chupLop(x, M, goc) {                                       // đỉnh + pháp tuyến của một vật (gốc hoặc con cháu) trong khung món
    const pos = x.geometry.attributes.position, nA = x.geometry.attributes.normal, v = new V3();
    _N3.getNormalMatrix(M);
    const loc = new Float32Array(pos.count * 3), nor = nA ? new Float32Array(pos.count * 3) : null;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(M).toArray(loc, i * 3);
      if (nor) v.fromBufferAttribute(nA, i).applyMatrix3(_N3).normalize().toArray(nor, i * 3);
    }
    return { x, goc, loc, nor, geo0: x.geometry, am: M.determinant() < 0, p: x.position.clone(), q: x.quaternion.clone(), s: x.scale.clone() };
  }
  function khung9(k, g, goc) {
    const ds = dsCua(k), c0 = KHUNG_9.get(k);
    if (c0 && c0.ds.length === ds.length && c0.ds.every((o, i) => o === ds[i])) return c0;
    if (c0) tra9(c0);
    const A = new THREE.Matrix4().makeRotationZ(-THREE.MathUtils.degToRad(g.rot)).multiply(new THREE.Matrix4().makeTranslation(-goc.x, -goc.y, -goc.z));
    if (g.lat) A.premultiply(new THREE.Matrix4().makeScale(-1, 1, 1));   // khung món lúc dựng — đã lật thì về chưa lật
    const c = { ds, lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity], phan: [] }, M = new THREE.Matrix4();
    for (const o of ds) {
      if (!(o.isMesh && !o.isInstancedMesh && o.geometry?.attributes?.position)) { c.phan.push({ o, cung: true }); continue; }
      const u = o.userData;
      if (u.dangMin && u.hinhGoc) {                                   // đang ở BẢN MỊN (LOD, xem.js LOD_MIN) ⇒ về bản thường trước khi chép đỉnh
        o.geometry = u.hinhGoc; if (u.vien && u.vienGoc) u.vien.geometry = u.vienGoc; u.dangMin = false;
      }
      M.compose(u.p0, u.q0, u.s0).premultiply(A);
      const lop = [chupLop(o, M, true)];
      // con cháu có đỉnh (đường viền cạnh, chi tiết lồng): toạ độ theo lưới gốc ⇒ cùng đi qua ánh xạ; mọi con cháu (cả nhóm
      // rỗng ở giữa) về ma trận đơn vị khi giãn, trả lại khi thôi
      o.updateWorldMatrix(false, true); _Mi.copy(o.matrixWorld).invert();
      o.traverse((x) => {
        if (x === o) return;
        if (x.geometry?.attributes?.position && !x.isInstancedMesh) lop.push(chupLop(x, M.clone().multiply(_Mi.clone().multiply(x.matrixWorld)), false));
        else lop.push({ x, goc: false, rong: true, p: x.position.clone(), q: x.quaternion.clone(), s: x.scale.clone() });
      });
      const plo = [Infinity, Infinity, Infinity], phi = [-Infinity, -Infinity, -Infinity], L = lop[0].loc;
      for (let i = 0; i < L.length; i++) { const a = i % 3; if (L[i] < plo[a]) plo[a] = L[i]; if (L[i] > phi[a]) phi[a] = L[i]; }
      for (let a = 0; a < 3; a++) { c.lo[a] = Math.min(c.lo[a], plo[a]); c.hi[a] = Math.max(c.hi[a], phi[a]); }
      c.phan.push({ o, plo, phi, lop });
    }
    KHUNG_9.set(k, c);
    return c;
  }
  function tra9(c) {                                                  // trả hình gốc + ma trận con cháu cho mọi lưới đã giãn kiểu 9 ô
    for (const p of c.phan) {
      if (p.cung) continue;
      for (const l of p.lop) {
        if (l.geo9) { l.x.geometry = l.geo0; l.geo9.dispose(); l.geo9 = null; }
        if (!l.goc) { l.x.position.copy(l.p); l.x.quaternion.copy(l.q); l.x.scale.copy(l.s); }
      }
      delete p.o.userData.khoa9;
    }
  }
  function ap9(k, g, goc, den, s, F) {                                // false ⇒ món không có lưới đỉnh nào, để đường cũ lo
    const c = khung9(k, g, goc);
    if (!c.phan.some((p) => p.lop)) return false;
    const ham = F.map((f, a) => {                                     // ánh xạ một trục: x lúc dựng → x mới (f) + độ giãn tại x (d, cho pháp tuyến)
      const lo = c.lo[a], hi = c.hi[a], E = hi - lo, m = Math.min(DAU_9, E * TI_9);
      if (!(E > 1e-6) || Math.abs(f - 1) < 1e-9 || E * f < 2 * m) return { f: (x) => x * f, d: () => f, m: 0 };
      const lo2 = lo * f, hi2 = hi * f, km = (hi2 - lo2 - 2 * m) / (E - 2 * m);
      return { m, lo, hi, f: (x) => x <= lo + m ? x - lo + lo2 : x >= hi - m ? x - hi + hi2 : lo2 + m + (x - lo - m) * km,
        d: (x) => (x <= lo + m || x >= hi - m ? 1 : km) };
    });
    const q9 = new THREE.Quaternion().setFromAxisAngle(TRUC_Z, THREE.MathUtils.degToRad(s.rot));
    for (const p of c.phan) {
      if (p.cung) {                                                   // không có đỉnh: phóng thẳng quanh gốc món
        const B = new THREE.Matrix4().makeRotationZ(THREE.MathUtils.degToRad(s.rot)).multiply(new THREE.Matrix4().makeScale(!!s.lat !== !!g.lat ? -F[0] : F[0], F[1], F[2]))
          .multiply(new THREE.Matrix4().makeRotationZ(-THREE.MathUtils.degToRad(g.rot)));
        _P.copy(p.o.userData.p0).sub(goc).applyMatrix4(B).add(den);
        _L.compose(new V3(), p.o.userData.q0, p.o.userData.s0); _M.multiplyMatrices(B, _L); _M.setPosition(_P);
        _M.decompose(p.o.position, _Q, _S); p.o.quaternion.copy(_Q); p.o.scale.copy(_S);
        continue;
      }
      p.o.userData.khoa9 = true;                                      // LOD không đổi hình lưới đang giãn
      const dich = ham.map((h, a) => {                                // bộ phận nhỏ trọn phần giữa trục a ⇒ trượt nguyên khối
        if (!h.m || p.plo[a] < h.lo + h.m || p.phi[a] > h.hi - h.m || p.phi[a] - p.plo[a] > (h.hi - h.lo) * NHO_9) return null;
        const t = (p.plo[a] + p.phi[a]) / 2; return h.f(t) - t;
      });
      for (const l of p.lop) {
        if (l.rong) { l.x.position.set(0, 0, 0); l.x.quaternion.identity(); l.x.scale.set(1, 1, 1); continue; }
        if (!l.geo9) {
          l.geo9 = l.geo0.clone();                                    // đỉnh gốc có thể nén (số nguyên chuẩn hoá, đan xen) ⇒ thay bằng mảng số thực
          l.geo9.setAttribute("position", new THREE.BufferAttribute(new Float32Array(l.loc.length), 3));
          if (l.nor) l.geo9.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(l.nor.length), 3));
          if (l.am && l.x.isMesh) {                                   // khung có phép lật ⇒ đỉnh đã soi gương: đảo chiều tam giác cho mặt trước đúng
            const id = l.geo9.index ? Array.from(l.geo9.index.array) : Array.from({ length: l.loc.length / 3 }, (_, i) => i);
            for (let i = 0; i + 2 < id.length; i += 3) [id[i + 1], id[i + 2]] = [id[i + 2], id[i + 1]];
            l.geo9.setIndex(id);
          }
          l.x.geometry = l.geo9;
          if (!l.goc) { l.x.position.set(0, 0, 0); l.x.quaternion.identity(); l.x.scale.set(1, 1, 1); }
        }
        const ar = l.geo9.attributes.position.array, L = l.loc, nr = l.nor && l.geo9.attributes.normal.array, N = l.nor;
        for (let i = 0; i < L.length; i += 3) {
          let a0 = 1, a1 = 1, a2 = 1;
          for (let a = 0; a < 3; a++) {
            const x = L[i + a];
            if (dich[a] != null) ar[i + a] = x + dich[a];
            else { ar[i + a] = ham[a].f(x); if (nr) { const dd = ham[a].d(x); if (a === 0) a0 = dd; else if (a === 1) a1 = dd; else a2 = dd; } }
          }
          if (nr) {                                                   // pháp tuyến theo phép giãn tại đỉnh: chia cho độ giãn từng trục rồi chuẩn hoá
            const nx = N[i] / a0, ny = N[i + 1] / a1, nz = N[i + 2] / a2, l2 = Math.hypot(nx, ny, nz) || 1;
            nr[i] = nx / l2; nr[i + 1] = ny / l2; nr[i + 2] = nz / l2;
          }
        }
        l.geo9.attributes.position.needsUpdate = true; if (nr) l.geo9.attributes.normal.needsUpdate = true;
        l.geo9.computeBoundingBox(); l.geo9.computeBoundingSphere();
        if (l.x.isLine) l.x.computeLineDistances();
      }
      p.o.position.copy(den); p.o.quaternion.copy(q9); p.o.scale.set(s.lat ? -1 : 1, 1, 1);   // lật gương ở ma trận lưới — three tự đảo mặt
    }
    return true;
  }
  function apCho(k, s) {
    const g = DUNG.get(k), f = s.k ?? 1, fx = f * (s.kx ?? 1), fy = f * (s.ky ?? 1), fz = f * (s.kz ?? 1);
    if (g) {
      const zs = sanMon(k), goc = new V3(g.x, g.y, zs + g.z), den = new V3(s.x, s.y, zs + s.z);
      const doiCo = Math.abs(fx - 1) > 1e-9 || Math.abs(fy - 1) > 1e-9 || Math.abs(fz - 1) > 1e-9;
      const da9 = doiCo && ap9(k, g, goc, den, s, [fx, fy, fz]);
      if (!da9 && KHUNG_9.has(k)) { tra9(KHUNG_9.get(k)); KHUNG_9.delete(k); }   // về cỡ cũ ⇒ hình gốc
      if (da9) { /* 9 ô — xong */ }
      else if (fx === fy && fy === fz && !!s.lat === !!g.lat) {            // đường nhanh: xoay + phóng đều
        const q = new THREE.Quaternion().setFromAxisAngle(TRUC_Z, THREE.MathUtils.degToRad(s.rot - g.rot));
        for (const o of dsCua(k)) {
          o.position.copy(o.userData.p0.clone().sub(goc).applyQuaternion(q).multiplyScalar(f).add(den));
          o.quaternion.copy(q).multiply(o.userData.q0);
          o.scale.copy(o.userData.s0).multiplyScalar(f);
        }
      } else {                                                         // kéo riêng từng chiều / lật gương: tuyến tính B·A, A = xoay −rot lúc dựng, B = xoay rot · lật u · co giãn theo khung món
        const A = new THREE.Matrix4().makeRotationZ(-THREE.MathUtils.degToRad(g.rot));
        const B = new THREE.Matrix4().makeRotationZ(THREE.MathUtils.degToRad(s.rot)).multiply(new THREE.Matrix4().makeScale(!!s.lat !== !!g.lat ? -fx : fx, fy, fz));
        const BA = B.multiply(A);
        for (const o of dsCua(k)) {
          _P.copy(o.userData.p0).sub(goc).applyMatrix4(BA).add(den);
          _L.compose(new V3(), o.userData.q0, o.userData.s0);
          _M.multiplyMatrices(BA, _L); _M.setPosition(_P);
          _M.decompose(o.position, _Q, _S); o.quaternion.copy(_Q); o.scale.copy(_S);
        }
      }
    }
    const gc = GIU_CHO.get(k);
    if (gc) {
      gc.position.set(s.x, s.y, gc.userData.san + s.z + gc.userData.h * fz / 2); gc.rotation.set(0, 0, THREE.MathUtils.degToRad(s.rot));
      gc.scale.set(fx, fy, fz);
    }
    veLai(60);
  }
  const apHet = (m) => { for (const [k, s] of m) apCho(k, s); };

  /* ── tấm in dấu dưới chân mỗi món (xanh / đỏ), vẽ xuyên vật ── */
  const TAM = [];
  function tam(i) {
    if (!TAM[i]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x3a8f4a, transparent: true, opacity: 0.3, depthTest: false }));
      const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new V3(-.5, -.5, 0), new V3(.5, -.5, 0), new V3(.5, .5, 0), new V3(-.5, .5, 0)]),
        new THREE.LineBasicMaterial({ color: 0x3a8f4a, depthTest: false }));
      m.renderOrder = l.renderOrder = 999; m.raycast = l.raycast = () => {};
      GOC.add(m, l); TAM[i] = [m, l];
    }
    return TAM[i];
  }
  const SAN_MON = new Map();                                          // khoá → cốt mặt sàn dưới món (mô hình), đo một lần từ lưới lúc dựng
  function sanMon(k) {
    const gc = GIU_CHO.get(k);
    if (gc) return gc.userData.san;
    if (!SAN_MON.has(k)) {
      let z = Infinity;
      for (const o of dsCua(k)) { o.geometry.computeBoundingBox(); z = Math.min(z, o.geometry.boundingBox.min.z + o.userData.p0.z); }
      SAN_MON.set(k, z - DUNG.get(k).z);
    }
    return SAN_MON.get(k);
  }
  function veTam() {
    let i = 0;
    if (E) for (const k of E.ks) {
      const s = E.nay.get(k), n = NAY.get(k), z = sanMon(k) + s.z;
      const mau = E.ok === false ? 0xb8412c : E.ok ? 0x3a8f4a : 0x8a8780;
      for (const o of tam(i++)) {
        o.visible = true; o.position.set(s.x, s.y, z + 0.006); o.rotation.set(0, 0, THREE.MathUtils.degToRad(s.rot));
        o.scale.set(n.w / 1000 * (s.k ?? 1) * (s.kx ?? 1), n.d / 1000 * (s.k ?? 1) * (s.ky ?? 1), 1); o.material.color.setHex(mau);
      }
    }
    for (; i < TAM.length; i++) for (const o of TAM[i]) o.visible = false;
    veLai(60);
  }

  /* ── NÚT THEO NGỮ CẢNH: hàng nút tròn bám ngay trên nhóm đang chọn ── */
  const khung = canvas.parentElement;
  const nc = document.createElement("div");
  nc.className = "dd-nc"; nc.hidden = true; nc.setAttribute("role", "toolbar"); nc.setAttribute("aria-label", "Món đang chọn");
  nc.innerHTML = `<div class="dd-nc-nut">
      <button type="button" data-v="xoay-" aria-label="Xoay ngược 90°" title="Xoay ngược 90° (Shift+R)">⟲</button>
      <button type="button" data-v="xoay+" aria-label="Xoay 90°" title="Xoay 90° (R)">⟳</button>
      <button type="button" data-v="doc" aria-label="Nâng hạ — kéo lên xuống" title="Kéo lên / xuống để nâng hạ (phím 9 nâng · 0 hạ)">↕</button>
      <button type="button" data-v="nho" aria-label="Thu nhỏ 10%" title="Thu nhỏ 10% (phím −)">−</button>
      <button type="button" data-v="to" aria-label="Phóng to 10%" title="Phóng to 10% (phím +)">+</button>
    </div><div class="dd-nc-chu" aria-live="polite"></div>`;
  khung.append(nc);
  const ncChu = nc.querySelector(".dd-nc-chu"), nutDoc = nc.querySelector('[data-v="doc"]');
  const bao = document.createElement("div");
  bao.className = "dd-bao"; bao.hidden = true; bao.setAttribute("role", "status");
  khung.append(bao);
  let henBao = 0;
  function thongBao(s, hoanTac, giu) {
    bao.innerHTML = ""; bao.append(document.createTextNode(s));
    if (hoanTac) { const b = document.createElement("button"); b.type = "button"; b.textContent = "Hoàn tác"; b.onclick = () => hoanTacCuoi(); bao.append(b); }
    bao.hidden = false; clearTimeout(henBao); if (!giu) henBao = setTimeout(() => (bao.hidden = true), 6000);
  }
  const mm = (m) => Math.round(m * 1000).toLocaleString("vi-VN");
  const hs = (k) => (+k).toLocaleString("vi-VN", { maximumFractionDigits: 2 });   // hệ số phóng: 1,1 · 0,91
  const tenNhom = (ks) => (ks.length === 1 ? NAY.get(ks[0]).ten : `${ks.length} món`);
  function chuNc() {
    if (!NHOM.length) return "";
    if (!E) {
      const n = NAY.get(NHOM[0]);
      return NHOM.length > 1 ? `${NHOM.length} món — kéo để dời cả nhóm` : `${n.ten}${n.z > 0.005 ? ` · cao ${mm(n.z)}` : ""}${Math.abs((n.k ?? 1) - 1) > 1e-3 ? ` · ×${hs(n.k)}` : ""}`;
    }
    const k0 = E.ks[0], a = E.dau.get(k0), b = E.nay.get(k0);
    const doi = E.kieu === "z" ? `cao ${mm(b.z)} mm` : `dời ${mm(b.x - a.x)} · ${mm(b.y - a.y)} mm`;
    return `${doi} · ${E.ok === false ? "⛔ " + E.loi[0] : E.ok ? "✓ đặt được" : "…"}`;
  }
  const _a = new V3(), _b = new V3();
  function veChan() {                                                // KHUNG CHÂN lúc đang chọn (chưa kéo): thấy món chiếm sàn tới đâu — kéo thì veTam tô xanh / đỏ
    if (E) return;
    let i = 0;
    if (api.cheDoSua?.() !== false) for (const k of NHOM) {
      const n = NAY.get(k); if (!n) continue;
      for (const o of tam(i++)) {
        o.visible = true; o.position.set(n.x, n.y, sanMon(k) + n.z + 0.006); o.rotation.set(0, 0, THREE.MathUtils.degToRad(n.rot));
        o.scale.set(n.w / 1000 * (n.k ?? 1) * (n.kx ?? 1), n.d / 1000 * (n.k ?? 1) * (n.ky ?? 1), 1); o.material.color.setHex(0x2d6cdf);
      }
    }
    for (; i < TAM.length; i++) for (const o of TAM[i]) o.visible = false;
  }
  function neoNc() {
    veChan();
    const vat = !NHOM.length && VAT_CHON;
    if (!NHOM.length && !vat) { nc.hidden = true; return; }
    const b = new THREE.Box3();
    for (const o of vat ? VAT_CHON.ds : NHOM.flatMap((k) => (GIU_CHO.has(k) ? [GIU_CHO.get(k)] : dsCua(k)))) if (o.visible !== false) b.expandByObject(o);
    if (b.isEmpty()) { nc.hidden = true; return; }
    const c = b.getCenter(_a), top = _b.set(c.x, b.max.y, c.z);         // hộp ở toạ độ THẾ GIỚI (y lên)
    const p = top.clone().project(camera);
    if (p.z > 1) { nc.hidden = true; return; }
    const r = canvas.getBoundingClientRect(), rk = khung.getBoundingClientRect();
    const x = r.left - rk.left + (p.x + 1) / 2 * r.width, y = r.top - rk.top + (1 - p.y) / 2 * r.height;
    nc.hidden = false;
    nutDoc.hidden = !vat && NHOM.some((k) => !NAY.get(k).doc);
    for (const n of nc.querySelectorAll('[data-v="xoay-"], [data-v="xoay+"]')) n.hidden = !!vat;
    for (const n of nc.querySelectorAll('[data-v="nho"], [data-v="to"]')) n.hidden = laSan(vat);   // sàn: chỉ đổi vật liệu (đặt lại mỗi lần — chọn vật khác thì hiện lại)
    if (laSan(vat)) nutDoc.hidden = true;   // vật khác: dời · nâng hạ · phóng (bỏ: Delete · chép: ⌘C ⌘V)
    for (const n of NUT_NGOAI) n.el.hidden = !n.hien({ nhom: NHOM, vat: VAT_CHON });
    ncChu.textContent = vat ? chuVat(VAT_CHON) : chuNc();
    nc.classList.toggle("dang-keo", !!E);
    nc.classList.toggle("do", !!E && E.ok === false);
    const w = nc.offsetWidth, h = nc.offsetHeight;
    const bp = document.getElementById("ben-phai"), rp = bp && bp.offsetParent ? bp.getBoundingClientRect() : null;
    const phai = rp && rp.left > rk.left && rp.left < rk.right ? rp.left - rk.left : rk.width;   // ô phải nổi trên khung ⇒ hộp nút đứng trái nó
    nc.style.left = Math.max(8, Math.min(phai - w - 8, x - w / 2)) + "px";
    nc.style.top = Math.max(8, Math.min(rk.height - h - 8, y - h - 14)) + "px";
  }
  api.moiKhung(neoNc);

  let rieng = false;                                                  // đang chọn khối giữ chỗ (không phải vật của cảnh)
  function datNhom(ds) {
    if (E) return;
    const ks = [];
    for (const o of ds || []) if (laMon(o)) { const k = nhan(o); if (!ks.includes(k)) ks.push(k); }
    const t = ks.length ? NAY.get(ks[0]).tang : null;
    NHOM = api.cheDoSua?.() === false ? [] : ks.filter((k) => NAY.get(k).tang === t);   // một nhóm một tầng · chỉ ở chế độ sửa
    VAT_CHON = api.cheDoSua?.() === false || ks.length ? null : nhomVat(ds);   // không phải món đồ: dời hình, xác nhận thành ghi chú
    veLai(60);
  }
  api.khiChon(() => { const ds = api.cacChon(); if (ds.length) rieng = false; if (!rieng) datNhom(ds); });   // chọn vật thật ⇒ thôi khối giữ chỗ
  api.khiThem((ds) => { rieng = false; datNhom(ds); });
  api.khiDoiSua?.(() => {
    if (!api.cheDoSua()) huy("Tắt chế độ sửa: đã huỷ");                // chưa xác nhận ⇒ về như cũ
    if (!rieng) datNhom(api.cacChon()); else if (!api.cheDoSua()) { rieng = false; NHOM = []; veLai(60); }
  });

  /* ── DỜI MỌI VẬT KHÁC (chủ nhà 2026-10-30 «move anything, even wall, windows, all»): tường, cửa, đèn, ổ điện… dựng từ
     nhiều tệp dữ liệu, trình xem không có đường ghi cho chúng ⇒ kéo chỉ dời HÌNH; «Xác nhận» ghi thành ghi chú dời đúng số
     mm gắn vào vật (sổ ghi chú — AI áp vào dữ liệu nguồn rồi dựng lại). Phải chạm chọn vật trước rồi mới kéo được — kéo vật
     chưa chọn vẫn là xoay camera, kẻo mỗi cú xoay trên tường thành dời tường. */
  const VAT = new Map();                                              // khoá (id các lưới) → {ds, p0, d: {x, y, z} mét mô hình, ten, neo}
  let VAT_CHON = null;
  function nhomVat(ds) {
    const ok = [...new Set((ds || []).flatMap((o) => api.cum?.(o) || [o]))].filter((o) => PHAN.includes(o) && !laMon(o));   // cả cụm (cửa = khuôn + cánh + bản lề…)
    if (!ok.length) return null;
    const khoa = ok.map((o) => o.userData.id).sort().join("|");
    if (!VAT.has(khoa)) VAT.set(khoa, gocVat({ khoa, ds: ok, ten: api.tenCum(ok[0]), neo: ok[0] }));
    return VAT.get(khoa);
  }
  const KHONG = { x: 0, y: 0, z: 0, k: 1 };
  // SÀN không nắm-kéo (2026-10-31): bấm sàn để đổi gạch / sơn — kéo nhẹ lúc bấm từng trượt cả mặt sàn đi 1 m; như game xây nhà, sàn là mặt để lát
  const laSan = (v) => !!v && /^Sàn\b/.test(v.ten || "");
  function gocVat(v) {                                                // chỗ + cỡ hiện tại thành gốc; tâm phóng = giữa đáy khối bao
    v.p0 = new Map(v.ds.map((o) => [o, o.position.clone()])); v.s0 = new Map(v.ds.map((o) => [o, o.scale.clone()]));
    const b = new THREE.Box3(); for (const o of v.ds) b.expandByObject(o);
    const c = b.getCenter(new V3());
    v.tam = w2m(new V3(c.x, b.min.y, c.z));
    v.d = { ...KHONG };
    return v;
  }
  function apVat(v) {                                                 // dịch theo trục mô hình + phóng quanh tâm, đổi về toạ độ riêng của lưới cha
    const k = v.d.k ?? 1, a = m2w(0, 0, 0), b = m2w(v.d.x, v.d.y, v.d.z), t = m2w(v.tam.x, v.tam.y, v.tam.z);
    for (const o of v.ds) {
      const p = o.parent, tl = p.worldToLocal(t.clone());
      o.position.copy(v.p0.get(o)).sub(tl).multiplyScalar(k).add(tl).add(p.worldToLocal(b.clone()).sub(p.worldToLocal(a.clone())));
      o.scale.copy(v.s0.get(o)).multiplyScalar(k);
    }
    veLai(60);
  }
  const giongD = (a, b) => Math.abs(a.x - b.x) < 1e-4 && Math.abs(a.y - b.y) < 1e-4 && Math.abs(a.z - b.z) < 1e-4 && Math.abs((a.k ?? 1) - (b.k ?? 1)) < 1e-4;
  const coDoi = (v) => v.sao || v.bo || !giongD(v.d, KHONG);
  function boVat(v) {                                                 // Delete trên vật khác: bản sao chưa ghi thì bỏ hẳn; vật thật ẩn đi (nháp)
    if (v.sao) { boSaoVat(v); HOAN_TAC.push({ kieu: "cho_saovat_bo", v, ten: `bỏ bản sao ${v.ten}` }); }
    else { v.bo = true; api.an(v.ds.map((o) => o.userData.id)); HOAN_TAC.push({ kieu: "cho_bovat", v, ten: `bỏ ${v.ten}` }); }
    rieng = false; NHOM = []; VAT_CHON = null; api.datChon(null); veXn();
    thongBao(`Đã bỏ ${v.ten} — «Xác nhận» để ghi, ⌘Z hoặc «Huỷ» để lấy lại.`);
  }
  let demSaoVat = 0;
  function danVat(v, dat = null) {                                    // bản sao vật khác: lưới chép cùng cha, lệch sang bên một bề rộng · dat: dựng lại bản sao đã lưu (im lặng)
    const ds = v.ds.map((o) => { const c = o.clone(false); c.userData = { ...c.userData, nguonId: o.userData.id }; o.parent.add(c); return c; }), cha = v.ds[0].parent;
    const b = new THREE.Box3(); for (const o of v.ds) b.expandByObject(o);
    const rong = Math.min(2, Math.abs(w2m(b.max.clone()).x - w2m(b.min.clone()).x) + 0.1);
    const n = gocVat({ khoa: `saovat:${++demSaoVat}`, ds, ten: v.ten, neo: v.neo, sao: !dat, goc: cha });
    if (dat) { n.d = { ...KHONG, ...dat }; VAT.set(n.khoa, n); apVat(n); gocVat(n); return n; }
    rieng = false; NHOM = []; api.datChon(null);
    n.d = { ...KHONG, x: Math.round(rong / BUOC) * BUOC || BUOC };
    VAT.set(n.khoa, n); VAT_CHON = n; apVat(n);
    HOAN_TAC.push({ kieu: "cho_saovat", v: n, ten: `bản sao ${n.ten}` }); veXn();
    thongBao(`Đã dán bản sao ${n.ten} — kéo tới chỗ muốn đặt, rồi «Xác nhận».`);
    return n;
  }
  function boSaoVat(n) { for (const o of n.ds) o.parent?.remove(o); VAT.delete(n.khoa); if (VAT_CHON === n) VAT_CHON = null; veLai(60); }

  /* LỚP DỜI ĐÃ XÁC NHẬN của vật khác không có đường ghi nguồn (Codex soát vòng 8): ghi-chu/vat-doi.json {khoá cụm: {goc, d, bo,
     sao}} — trình xem áp lại mỗi lần mở. `goc` = điểm chân cụm lúc DỰNG: nguồn đổi (ghi chú đã đưa vào dữ liệu) ⇒ cụm dựng chỗ
     khác ⇒ bỏ qua lớp ấy, không dời hai lần. */
  const khoaCum = (o) => (api.cum?.(o) || [o])[0]?.userData.id || o.userData.id;
  const tamCum = (ds) => { const b = new THREE.Box3(); for (const o of ds) b.expandByObject(o); const c = b.getCenter(new V3()); return w2m(new V3(c.x, b.min.y, c.z)); };
  const congD = (a, b) => ({ x: +((a?.x || 0) + (b?.x || 0)).toFixed(4), y: +((a?.y || 0) + (b?.y || 0)).toFixed(4), z: +((a?.z || 0) + (b?.z || 0)).toFixed(4), k: +((a?.k ?? 1) * (b?.k ?? 1)).toFixed(4) });
  let LUU_VAT = {};
  window.XEM?.ready?.then(async () => {
    if (new URLSearchParams(location.search).has("nguyen")) return;   // ảnh chụp trang việc: chỉ bản dựng từ nguồn
    const r = await goiSua("vat", "doc_vat"); if (!r.ok) return;
    LUU_VAT = r.vat || {};
    const theoId = new Map(PHAN.map((o) => [o.userData.id, o]));
    for (const [k, e] of Object.entries(LUU_VAT)) {
      const o = theoId.get(k); if (!o) continue;
      const ds = (api.cum?.(o) || [o]).filter((x) => PHAN.includes(x) && !laMon(x)); if (!ds.length) continue;
      const t = tamCum(ds);
      if (Math.hypot(t.x - e.goc[0], t.y - e.goc[1], t.z - e.goc[2]) > 0.02) continue;   // nguồn đã đổi ⇒ lớp dời hết hiệu lực
      const v = nhomVat(ds);
      for (const q of e.sao || []) danVat(v, q);                        // bản sao dựng từ chỗ DỰNG của gốc
      if (e.bo) { api.an(ds.map((x) => x.userData.id)); continue; }
      if (e.d) { v.d = { ...KHONG, ...e.d }; apVat(v); gocVat(v); v.tong = { ...KHONG, ...e.d }; }
    }
    veLai(60);
  });
  function phongVat(f) {
    const v = VAT_CHON; if (!v) return;
    const d0 = { ...v.d };
    v.d = { ...d0, k: Math.min(5, Math.max(0.2, +((d0.k ?? 1) * f).toFixed(3))) }; apVat(v);
    HOAN_TAC.push({ kieu: "cho_vat", v, truoc: d0, sau: { ...v.d }, ten: v.ten }); veXn();
  }
  const huongMm = (m, duong, am) => `${m > 0 ? "+" : "−"}${mm(Math.abs(m))} mm (về phía ${m > 0 ? duong : am})`;
  function chuDoi(v) {
    const p = [];
    if (Math.abs(v.d.x) > 1e-4) p.push("x " + huongMm(v.d.x, "tường Tây Nam", "tường Đông Bắc"));
    if (Math.abs(v.d.y) > 1e-4) p.push("y " + huongMm(v.d.y, "sau nhà", "mặt tiền"));
    if (Math.abs(v.d.z) > 1e-4) p.push(`cao ${v.d.z > 0 ? "+" : "−"}${mm(Math.abs(v.d.z))} mm`);
    const k = v.d.k ?? 1;
    if (Math.abs(k - 1) > 1e-4) p.push(`${k > 1 ? "phóng to" : "thu nhỏ"} ×${hs(k)} cả ba chiều (giữ chân đứng chỗ cũ)`);
    const truc = "Trục mặt bằng: x tăng về phía tường Tây Nam, y tăng từ mặt tiền về phía sau; cao tính từ chỗ đang dựng.";
    if (v.bo) return `Bỏ trên trình xem (chế độ sửa, đã xác nhận): bỏ «${v.ten}» khỏi mô hình. Xoá nó khỏi dữ liệu nguồn rồi dựng lại.`;
    return v.sao
      ? `Sao chép trên trình xem (chế độ sửa, đã xác nhận): thêm một «${v.ten}» nữa, đặt lệch so với cái có sẵn ${p.join(" · ") || "(trùng chỗ)"}. ${truc} Thêm vào dữ liệu nguồn rồi dựng lại.`
      : `Dời trên trình xem (chế độ sửa, đã xác nhận): «${v.ten}» ${p.join(" · ")}. ${truc} Áp vào dữ liệu nguồn của vật này rồi dựng lại.`;
  }
  const chuVat = (v) => (v.sao ? "Bản sao " : "") + v.ten + (laSan(v) && giongD(v.d, KHONG) ? " — đổi gạch / sơn ở «Vật liệu»" : giongD(v.d, KHONG) ? " — kéo để dời"
    : ` · dời ${mm(v.d.x)} · ${mm(v.d.y)}${Math.abs(v.d.z) > 1e-4 ? ` · cao ${mm(v.d.z)}` : ""} mm${Math.abs((v.d.k ?? 1) - 1) > 1e-4 ? ` · ×${hs(v.d.k)}` : ""}`);

  /* ── XÁC NHẬN (chủ nhà 2026-10-30 «a button to confirm the edit, if not confirm, it goes back to previous state»): mọi dời,
     xoay, nâng hạ, bỏ trong chế độ sửa chỉ là NHÁP tới khi bấm «Xác nhận»; «Huỷ» hoặc tắt chế độ sửa ⇒ mọi thứ về như cũ.
     Món thả từ thư viện phải ghi ngay để có mã — Huỷ thì xoá khỏi mặt bằng. */
  const CHO_DAU = new Map();                                          // khoá món → chỗ lúc bắt đầu nháp (đã ghi)
  const CHO_BO = new Map();                                           // khoá món → tầng (bỏ, chưa ghi)
  const CHO_THEM = new Set();                                         // khoá món mới thả trong nháp (đã ghi — huỷ thì xoá)
  const CHO_SAO = new Set();                                          // khoá bản sao món dán trong nháp (chưa ghi)
  const monDoi = () => [...CHO_DAU].filter(([k, a]) => NAY.has(k) && !CHO_BO.has(k) && !CHO_SAO.has(k) && !CHO_THEM.has(k) && !giong(new Map([[k, a]]), new Map([[k, NAY.get(k)]])));
  const demCho = () => monDoi().length + CHO_BO.size + CHO_THEM.size + CHO_SAO.size + [...VAT.values()].filter(coDoi).length + NHAP_NGOAI.length;
  const xn = document.createElement("div");
  xn.className = "dd-xn"; xn.hidden = true; xn.setAttribute("role", "region"); xn.setAttribute("aria-label", "Thay đổi chưa lưu");
  xn.innerHTML = `<span class="dd-xn-chu"></span><button type="button" class="dd-xn-huy">Huỷ</button><button type="button" class="dd-xn-ok">Xác nhận</button>`;
  canvas.parentElement.append(xn);
  function veXn() {
    const n = demCho();
    xn.hidden = !n;
    xn.querySelector(".dd-xn-chu").textContent = `${n} thay đổi chưa lưu`;
    veLai(60);
  }
  const hienMon = (k) => { const gc = GIU_CHO.get(k); if (gc) gc.visible = true; else api.hien(dsCua(k).map((o) => o.userData.id)); };
  const boNhap = (pred) => { for (let i = HOAN_TAC.length - 1; i >= 0; i--) if (pred(HOAN_TAC[i])) HOAN_TAC.splice(i, 1); };
  let dangXn = false;
  async function xacNhan() {
    if (E || dangXn) return;
    dangXn = true;
    const loi = [], ok = [];
    boNhap((h) => h.kieu.startsWith("cho"));
    const soHt = HOAN_TAC.length;
    const theoTang = (ks, f) => { const m = new Map(); for (const k of ks) { const t = f(k); m.set(t, [...(m.get(t) || []), k]); } return m; };
    for (const k of [...CHO_SAO]) if (CHO_BO.has(k)) { boKhoi(k); CHO_SAO.delete(k); CHO_BO.delete(k); CHO_DAU.delete(k); }   // dán rồi bỏ: thôi
    for (const [tang, ks] of theoTang([...CHO_SAO], (k) => NAY.get(k).tang)) {
      const kq = await goi("nhan-ban", { tang, ds: ks.map((k) => thanMon(k, NAY.get(k))) });
      if (!kq.ok) { loi.push(...(kq.loi || [])); continue; }
      ks.forEach((k, i) => { NAY.get(k).id = kq.ids[i]; CHO_SAO.delete(k); CHO_DAU.delete(k); HOAN_TAC.push({ kieu: "them", tang, k, ten: NAY.get(k).ten }); });
      ok.push(`dán ${tenNhom(ks)}`);
    }
    for (const [tang, ks] of theoTang(monDoi().map(([k]) => k), (k) => NAY.get(k).tang)) {
      const sau = new Map(ks.map((k) => [k, chep(NAY.get(k))]));
      const kq = await goi("dat", thanNhom(sau));
      if (!kq.ok) { loi.push(...(kq.loi || [])); continue; }
      HOAN_TAC.push({ kieu: "dat", truoc: new Map(ks.map((k) => [k, CHO_DAU.get(k)])), sau, ten: tenNhom(ks) });
      for (const k of ks) CHO_DAU.delete(k);
      ok.push(`dời ${tenNhom(ks)}`); void tang;
    }
    for (const [tang, ks] of theoTang([...CHO_BO.keys()], (k) => CHO_BO.get(k))) {
      const kq = await goi("xoa", { tang, ids: ks.map((k) => NAY.get(k).id).filter(Boolean) });
      if (!kq.ok) { loi.push(...(kq.loi || [])); continue; }
      HOAN_TAC.push({ kieu: "xoa", tang, ks, ban_ghi: kq.ban_ghi, ten: tenNhom(ks) });
      for (const k of ks) { CHO_BO.delete(k); CHO_THEM.delete(k); }
      ok.push(`bỏ ${tenNhom(ks)}`);
    }
    // món MỚI (thả từ thư viện, bộ đồ, đặt lại từ kho): NHÁP tới đây mới ghi mặt bằng — đóng trang trước khi xác nhận không để lại gì
    for (const k of [...CHO_THEM]) if (CHO_BO.has(k)) { boKhoi(k); CHO_THEM.delete(k); CHO_BO.delete(k); CHO_DAU.delete(k); }
    for (const [tang, ks] of theoTang([...CHO_THEM], (k) => NAY.get(k).tang)) {
      for (const nhomBG of [ks.filter((k) => NAY.get(k).banGhi), ks.filter((k) => !NAY.get(k).banGhi)]) {
        if (!nhomBG.length) continue;
        const coBG = !!NAY.get(nhomBG[0]).banGhi;
        const than = coBG
          ? { tang, ban_ghi: nhomBG.map((k) => { const n = NAY.get(k); return { ...n.banGhi, x: Math.round(n.x * 1000), y: Math.round(n.y * 1000), rotation_deg: Math.round(n.rot) % 360, ...(n.z > 0.0005 ? { z_mm: Math.round(n.z * 1000) } : {}) }; }) }
          : { tang, tu_do: true, ds: nhomBG.map((k) => { const n = NAY.get(k), f = n.k ?? 1; return { catalog: n.catalog, x: n.x * 1000, y: n.y * 1000, rot: n.rot, z: n.z * 1000, w: n.w * f * (n.kx ?? 1), d: n.d * f * (n.ky ?? 1), ten: n.ten }; }) };   // tu_do: món từ thư viện không kiểm chỗ đặt
        const kq = await goi("them", than);
        if (!kq.ok) { loi.push(...(kq.loi || [])); continue; }
        nhomBG.forEach((k, i) => { const n = NAY.get(k); n.id = kq.ids?.[i] || n.banGhi?.id || null; CHO_THEM.delete(k); CHO_DAU.delete(k); HOAN_TAC.push({ kieu: "them", tang, k, ten: n.ten }); });
        ok.push(`thêm ${tenNhom(nhomBG)}`);
      }
    }
    // VẬT KHÁC có nguồn ghi được (điểm điện → bo-tri-dien-mang.yaml, cửa / cửa sổ → mặt bằng) ⇒ ghi THẬT (Codex soát vòng 6:
    // «dời cửa chỉ thành ghi chú, tải lại là về chỗ cũ»); cụm nào không có đường ghi thì vẫn ghi chú dời như cũ.
    const nhomCum = (v) => { const m = new Map(); for (const o of v.ds) { const c = api.cum?.(o) || [o], k0 = c[0]?.userData.id || o.userData.id; (m.get(k0) || m.set(k0, []).get(k0)).push(o); } return [...m.values()]; };
    const muc = [], cuaMuc = [], daGhiVat = new Map();
    for (const v of [...VAT.values()].filter((v) => coDoi(v) && !v.sao && !v.bo && Math.abs((v.d.k ?? 1) - 1) < 1e-4))
      for (const ds of nhomCum(v)) { cuaMuc.push([v, ds]); muc.push({ ids: ds.map((o) => o.userData.id), tens: ds.map((o) => o.userData.ten || ""), ten: api.tenCum(ds[0]), dx: v.d.x * 1000, dy: v.d.y * 1000, dz: v.d.z * 1000 }); }
    if (muc.length) {
      const r = await goiSua("vat", "ghi_doi_vat", { muc });
      const da = r.da_ghi || [];
      for (const i of da) { const [v, ds] = cuaMuc[i]; (daGhiVat.get(v) || daGhiVat.set(v, []).get(v)).push(ds); }
      if (da.length) {
        const nguoc = da.map((i) => ({ ...muc[i], dx: -muc[i].dx, dy: -muc[i].dy, dz: -muc[i].dz }));
        HOAN_TAC.push({ kieu: "ngoai_da_ghi", ten: `dời ${da.length} vật`, lui: () => goiSua("vat", "ghi_doi_vat", { muc: nguoc }) });
        ok.push(`ghi dời ${da.map((i) => muc[i].ten).join(", ")} vào dữ liệu`);
      }
      ok.push(...(r.bao || []));
      if (r.loi?.length) loi.push(...r.loi);
    }
    // lớp dời bền cho mọi vật khác CHƯA ghi được vào nguồn (dời · bỏ · chép) — trước ghi chú: lưu hỏng thì không ghi chú gì
    const luuMoi = {}, luuCu = {}, tongMoi = new Map();
    const datMuc = (k, e) => { if (!(k in luuCu)) luuCu[k] = LUU_VAT[k] || null; luuMoi[k] = e; };
    for (const v of [...VAT.values()].filter(coDoi)) {
      const daGhi = daGhiVat.get(v) || [], nhom = nhomCum(v).filter((ds) => !daGhi.some((x) => x[0] === ds[0]));
      if (!nhom.length) continue;
      if (v.sao) {                                                     // bản sao: ghi vào mục của CỤM GỐC
        const theoGoc = new Map();
        for (const o of v.ds) { const g = PHAN.find((x) => x.userData.id === o.userData.nguonId); if (g) theoGoc.set(khoaCum(g), g); }
        for (const [k, g] of theoGoc) {
          const e = luuMoi[k] || LUU_VAT[k], dsG = (api.cum?.(g) || [g]).filter((x) => PHAN.includes(x)), tG = e?.d || KHONG, t = tamCum(dsG);
          datMuc(k, { goc: e?.goc || [t.x - (tG.x || 0), t.y - (tG.y || 0), t.z - (tG.z || 0)], d: e?.d || null, bo: !!e?.bo, sao: [...(e?.sao || []), congD(tG, v.d)] });
        }
        continue;
      }
      const tong = congD(v.tong, v.d);
      for (const ds of nhom) {
        const k = khoaCum(ds[0]), e = luuMoi[k] || LUU_VAT[k], t = tamCum(ds.filter((o) => o.visible !== false || v.bo));
        datMuc(k, { goc: e?.goc || [t.x - tong.x, t.y - tong.y, t.z - tong.z], d: v.bo ? (e?.d || null) : tong, bo: !!v.bo, sao: e?.sao || [] });
      }
      if (!v.bo) tongMoi.set(v, tong);
    }
    if (Object.keys(luuMoi).length) {
      const r = await goiSua("vat", "ghi_vat", { muc: luuMoi });
      if (!r.ok) { loi.push("lưu lớp dời vật khác: " + (r.loi || []).join(" · ")); }
      else {
        LUU_VAT = r.vat || { ...LUU_VAT, ...luuMoi };
        for (const [v, t] of tongMoi) v.tong = t;
        HOAN_TAC.push({ kieu: "ngoai_da_ghi", khongDung: true, ten: `lớp dời ${Object.keys(luuMoi).length} vật`,
          lui: async () => { const b = await goiSua("vat", "ghi_vat", { muc: luuCu }); if (b.ok) { LUU_VAT = b.vat || LUU_VAT; dungLaiRoiTai(true); } return b; } });
      }
    }
    for (let v of [...VAT.values()].filter(coDoi)) {
      if (Object.keys(luuMoi).length && loi.some((x) => x.startsWith("lưu lớp dời"))) break;   // chưa lưu được ⇒ giữ nháp, không ghi chú
      const daGhi = daGhiVat.get(v) || [];
      if (daGhi.length) {                                              // cụm đã ghi thật: không ghi chú lại; cụm còn lại (nếu có) mới ghi chú
        const conLai = nhomCum(v).filter((ds) => !daGhi.some((x) => x[0] === ds[0]));
        if (!conLai.length) { gocVat(v); continue; }
        v = { ...v, ten: conLai.map((ds) => api.tenCum(ds[0])).join(", "), neo: conLai[0][0], _goc: v };
      }
      try {
        await api.ghiChu(v.neo, chuDoi(v) + " (Trình xem đang giữ lớp dời này — tự hết khi nguồn đổi.)");
        ok.push(`${v.bo ? "bỏ" : v.sao ? "sao chép" : "dời"} ${v.ten} (giữ trên trình xem + ghi chú)`);
        if (v._goc) { gocVat(v._goc); continue; }
        if (v.bo) VAT.delete(v.khoa);                                  // đã ghi chú bỏ: ẩn tới khi dựng lại
        else { v.sao = false; gocVat(v); }                             // chỗ + cỡ mới thành gốc (tới khi dựng lại)
      } catch (e) { loi.push(`${v.ten}: ${e.message}`); }
    }
    for (const n of [...NHAP_NGOAI]) {                                 // nháp của mô-đun (vật liệu, tường, cửa…)
      let r;
      try { r = await n.xacNhan(); } catch (e) { r = { ok: false, loi: [e.message] }; }
      if (r && r.ok === false) { loi.push(...(r.loi || [n.ten])); continue; }
      NHAP_NGOAI.splice(NHAP_NGOAI.indexOf(n), 1);
      boNhap((h) => h.kieu === "ngoai" && h.n === n);
      if (r?.hoanTac) HOAN_TAC.push({ kieu: "ngoai_da_ghi", ten: n.ten, lui: r.hoanTac });
      ok.push(r?.chu || n.ten);
    }
    for (const f of KHI_XAC_NHAN) f({ ok, loi });
    const daGhiNguon = HOAN_TAC.slice(soHt).some((h) => !h.khongDung);   // có lần ghi mặt bằng / dữ liệu nguồn (lớp dời của trình xem thì không cần dựng)
    for (const k of [...CHO_DAU.keys()]) if (!monDoi().some(([x]) => x === k)) CHO_DAU.delete(k);
    dangXn = false;
    veXn();
    thongBao(loi.length ? `⛔ Chưa lưu hết: ${loi.join(" · ")}` : `Đã lưu: ${ok.join(" · ")}.`, !loi.length && HOAN_TAC.length > soHt);   // ghi chú dời không hoàn tác được — chỉ có nút khi mặt bằng vừa ghi
    if (daGhiNguon && !loi.length) dungLaiRoiTai();
  }
  /* DỰNG LẠI RỒI TẢI (khoảng trống G08 so với Paralives — ở đó tường / cửa đổi là thấy ngay): xác nhận đã ghi dữ liệu nguồn ⇒
     nhờ xem.py dựng lại các nhóm cũ (/api/ban-dung, không kiem) rồi tải lại trang GIỮ GÓC NHÌN (?v=). Đang có nháp mới hay đang
     kéo thì không tự tải — báo để người dùng bấm «Tải lại» khi xong. */
  let dangDung = false;
  async function dungLaiRoiTai(chiTai = false) {
    if (dangDung) return;
    dangDung = true;
    const ghiLuc = Date.now();
    await new Promise((r) => setTimeout(r, 1500));                     // đợi thông báo «Đã lưu» hiện một nhịp
    thongBao("Đang dựng lại mô hình theo dữ liệu vừa ghi… trang tự tải lại khi xong (giữ góc nhìn).", false, true);
    let d = chiTai ? { linh_kien: [] } : null;                          // chiTai: chỉ lớp dời của trình xem đổi — tải lại là đủ, khỏi dựng
    if (!d) try { d = await (await fetch("/api/ban-dung", { cache: "no-store" })).json(); } catch { /* máy chủ bận — để banner «Có bản mới» lo */ }
    dangDung = false;
    if (!d) return;
    const loi = (d.linh_kien || []).filter((x) => x.loi);
    if (loi.length) { thongBao(`⛔ Dựng lại lỗi: ${loi.map((x) => x.ten).join(", ")} — đang xem bản cũ.`, false, true); return; }
    if (demCho() || E || keo) { thongBao("Mô hình đã dựng lại — bấm «Tải lại» trên thanh khi xong việc đang làm.", false, true); return; }
    const u = new URL(location.href);
    try { u.searchParams.set("v", window.XEM.chuoiGoc()); } catch { /* không có góc nhìn thì thôi */ }
    window.__TAI_LAI = { luc: ghiLuc, url: u.toString() };              // phép thử đọc
    if (!window.__KHONG_TAI_LAI) location.replace(u.toString());
  }
  async function huy(chu = "Đã huỷ") {
    if (E || dangXn) return 0;
    const n = demCho();
    for (const [k, a] of CHO_DAU) if (NAY.has(k)) { Object.assign(NAY.get(k), a); apCho(k, a); }
    for (const k of CHO_BO.keys()) hienMon(k);
    for (const k of CHO_THEM) {
      const nn = NAY.get(k);
      if (nn?.id) await goi("xoa", { tang: nn.tang, ids: [nn.id] });
      boKhoi(k);
    }
    for (const k of CHO_SAO) boKhoi(k);
    for (const v of [...VAT.values()]) {
      if (v.sao) { boSaoVat(v); continue; }
      if (v.bo) { v.bo = false; api.hien(v.ds.map((o) => o.userData.id)); }
      if (coDoi(v)) { v.d = { ...KHONG }; apVat(v); }
    }
    for (const n of [...NHAP_NGOAI].reverse()) { try { n.huy(); } catch (e) { console.error(e); } }
    NHAP_NGOAI.length = 0;
    boNhap((h) => h.kieu.startsWith("cho") || h.kieu === "ngoai" || (h.kieu === "them" && CHO_THEM.has(h.k)));
    CHO_DAU.clear(); CHO_BO.clear(); CHO_THEM.clear(); CHO_SAO.clear();
    veXn();
    if (n) thongBao(`${chu} ${n} thay đổi chưa xác nhận — mọi thứ về như cũ.`);
    return n;
  }
  xn.querySelector(".dd-xn-ok").onclick = xacNhan;
  xn.querySelector(".dd-xn-huy").onclick = () => huy();
  addEventListener("beforeunload", (e) => { if (demCho()) { e.preventDefault(); e.returnValue = ""; } });

  /* ── gọi máy ── */
  const CU = "máy chủ xem.py đang chạy bản cũ — khởi động lại để lưu";
  // chụp ảnh (chup.mjs dựng máy chủ tĩnh, không có /api) ⇒ không báo — dòng báo từng dính vào ảnh tờ bếp
  function canhBaoMay() { if (document.body.classList.contains("chup")) return; thongBao("⛔ Máy chủ xem.py đang chạy bản cũ — dời đồ chưa lưu được. Dừng rồi chạy lại: python3 tools/3d/xem.py", false, true); }
  async function goi(duong, than) {
    if (THIET_BI) return { ok: false, loi: ["trên thiết bị này chỉ đổi được vật liệu"] };
    if (!MAY_OK) return { ok: false, loi: [CU] };
    try {
      const r = await fetch("/api/do-dac/" + duong, { method: "POST", body: JSON.stringify(than) });
      if (r.status === 404) { MAY_OK = false; canhBaoMay(); return { ok: false, loi: [CU] }; }
      return r.ok ? await r.json() : { ok: false, loi: [await r.text()] };
    } catch (e) { return { ok: false, loi: ["không gọi được máy (xem.py): " + e.message] }; }
  }
  const thanMon = (k, s) => { const n = NAY.get(k), gc = GIU_CHO.get(k), f = s.k ?? 1;
    const o = { id: n.id, moi: !n.id && !n.nguon && gc ? gc.userData.moi : null, nguon: !n.id ? n.nguon || null : null, x: s.x * 1000, y: s.y * 1000, rot: s.rot, z: s.z * 1000, lat: !!s.lat };
    const fx = f * (s.kx ?? 1), fy = f * (s.ky ?? 1), fz = f * (s.kz ?? 1);
    if (Math.abs(fx - 1) > 1e-6 || Math.abs(fy - 1) > 1e-6 || Math.abs(fz - 1) > 1e-6) { o.w = n.w * fx; o.d = n.d * fy; if (n.hD && Math.abs(fz - 1) > 1e-6) o.h = n.hD * fz * 1000; }   // chỉ ghi cao khi cao đổi   // phóng / thu / kéo riêng: cỡ mới (mm)
    return o; };
  const thanNhom = (m) => ({ tang: NAY.get([...m.keys()][0]).tang, mon: [...m].map(([k, s]) => thanMon(k, s)) });

  /* ── kiểm khi đang kéo (trễ một nhịp), nhớ chỗ HỢP LỆ cuối cùng ── */
  let henKiem = 0, luot = 0;
  function kiem() {
    clearTimeout(henKiem);
    const e = E, l = ++luot, anh = new Map([...e.nay].map(([k, s]) => [k, chep(s)]));
    e.ok = null; veTam();
    henKiem = setTimeout(async () => {
      const k = await goi("kiem", thanNhom(anh));
      if (E !== e) return;
      if (k.ok) e.hl = anh;
      if (l !== luot) return;
      e.ok = k.ok; e.loi = k.loi || []; veTam();
    }, 70);
  }
  function batDau(kieu, ks = NHOM) {
    E = { kieu, ks: [...ks], dau: new Map(ks.map((k) => [k, chep(NAY.get(k))])), ok: true, loi: [] };
    E.nay = new Map([...E.dau].map(([k, s]) => [k, chep(s)]));
    E.hl = new Map([...E.dau].map(([k, s]) => [k, chep(s)]));
    veTam();
  }
  const giong = (a, b) => [...a].every(([k, s]) => { const t = b.get(k); return t && Math.abs(t.x - s.x) < 1e-4 && Math.abs(t.y - s.y) < 1e-4 && t.rot === s.rot && Math.abs(t.z - s.z) < 1e-4 && Math.abs((t.k ?? 1) - (s.k ?? 1)) < 1e-4 && Math.abs((t.kx ?? 1) - (s.kx ?? 1)) < 1e-4 && Math.abs((t.ky ?? 1) - (s.ky ?? 1)) < 1e-4 && Math.abs((t.kz ?? 1) - (s.kz ?? 1)) < 1e-4 && !!t.lat === !!s.lat; });

  /* ── LƯU khi thôi kéo / xoay / nâng hạ: chỗ hiện tại nếu hợp lệ, không thì chỗ hợp lệ cuối, không thì về chỗ cũ ── */
  async function luu() {
    const e = E; if (!e) return;
    clearTimeout(henKiem); luot++;
    let dich = e.nay, lyDo = null;
    const k = await goi("kiem", thanNhom(dich));
    if (!k.ok) {
      lyDo = (k.loi || [])[0];
      dich = e.hl && !giong(e.hl, e.dau) ? e.hl : e.dau;
      /* kéo qua mép (chủ nhà 2026-10-31: «không dời được tủ lạnh sát tường dù còn khoảng trống»): kiểm khi kéo chỉ chạy lúc
         tay dừng, nên chỗ hợp lệ cuối có thể còn cách tường nửa mét. Dò chia đôi trên đoạn [chỗ hợp lệ → chỗ thả] để dừng
         sát chỗ bị chặn nhất — ~1 mm sau 10 lần kiểm. */
      if (e.kieu === "xy" && dich) {
        const goc = dich, tron = (v) => Math.round(v * 1000) / 1000;
        const giua = (t) => new Map([...e.nay].map(([kk, s]) => { const a = goc.get(kk); return [kk, { ...s, x: tron(a.x + (s.x - a.x) * t), y: tron(a.y + (s.y - a.y) * t) }]; }));
        const dai = Math.max(...[...e.nay].map(([kk, s]) => Math.hypot(s.x - goc.get(kk).x, s.y - goc.get(kk).y)));
        let lo = 0, hi = 1, tot = null;
        for (let i = 0; i < 14 && dai * (hi - lo) > 0.001; i++) {
          const t = (lo + hi) / 2, m = giua(t);
          if ((await goi("kiem", thanNhom(m))).ok) { lo = t; tot = m; } else hi = t;
        }
        if (tot && dai > 0) {                                         // máy kiểm cho ăn vào 5 mm (DUNG_SAI) — lùi đúng ngần ấy cho áp sát mặt, không lấn
          const lui = giua(Math.max(0, lo - 0.005 / dai));
          if ((await goi("kiem", thanNhom(lui))).ok) tot = lui;
        }
        if (tot) dich = tot;
      }
    }
    apHet(dich);
    E = null; veTam();
    if (giong(dich, e.dau)) { if (lyDo) thongBao(`⛔ ${lyDo} — ${tenNhom(e.ks)} về chỗ cũ.`); return; }
    for (const [kk, s] of dich) { if (!CHO_DAU.has(kk)) CHO_DAU.set(kk, chep(e.dau.get(kk))); Object.assign(NAY.get(kk), s); }   // NHÁP — ghi khi «Xác nhận»
    HOAN_TAC.push({ kieu: "cho", truoc: e.dau, sau: dich, ten: tenNhom(e.ks) });
    veXn();
    const k0 = e.ks[0], a = e.dau.get(k0), b = dich.get(k0);
    const mo = e.kieu === "z" ? `cao ${mm(b.z)} mm` : e.kieu === "phong" ? `cỡ ×${hs(b.k ?? 1)}` : e.kieu === "co" ? `cỡ ${mm(NAY.get(k0).w / 1000 * (b.k ?? 1) * (b.kx ?? 1))} × ${mm(NAY.get(k0).d / 1000 * (b.k ?? 1) * (b.ky ?? 1))} mm` : e.kieu === "lat" ? "lật gương" : e.kieu === "vi_tri" ? `vị trí ${mm(b.x)} · ${mm(b.y)} mm` : b.rot !== a.rot ? `xoay ${((b.rot % 360) + 360) % 360}°` : `dời ${mm(b.x - a.x)} · ${mm(b.y - a.y)} mm`;
    if (lyDo) thongBao(`⛔ ${lyDo} — ${tenNhom(e.ks)} đứng ở chỗ hợp lệ gần nhất (${mo}), chưa lưu.`);
  }

  async function xoay(buoc) {
    if (!NHOM.length || E) return;
    batDau("xoay");
    const ds = [...E.nay.values()], P = { x: ds.reduce((a, s) => a + s.x, 0) / ds.length, y: ds.reduce((a, s) => a + s.y, 0) / ds.length };
    const r = THREE.MathUtils.degToRad(buoc), c = Math.cos(r), sn = Math.sin(r);
    for (const s of ds) {
      const dx = s.x - P.x, dy = s.y - P.y;
      if (ds.length > 1) { s.x = +(P.x + dx * c - dy * sn).toFixed(4); s.y = +(P.y + dx * sn + dy * c).toFixed(4); }
      s.rot = (((s.rot + buoc) % 360) + 360) % 360;
    }
    E.hl = null; apHet(E.nay);
    await luu();
  }
  let henPhim = 0;
  function nang(dz) {                                                 // phím 9 / 0: mỗi lần bấm một nấc, lưu khi thôi bấm
    if (!NHOM.length || NHOM.some((k) => !NAY.get(k).doc) || (E && E.kieu !== "z")) return;
    if (!E) batDau("z");
    for (const s of E.nay.values()) s.z = Math.max(0, +(s.z + dz).toFixed(4));
    apHet(E.nay); kiem();
    clearTimeout(henPhim); henPhim = setTimeout(luu, 650);
  }
  async function phong(f) {                                          // phóng to / thu nhỏ đều ba chiều, chân đứng yên
    if (!NHOM.length || E) return;
    batDau("phong");
    for (const s of E.nay.values()) s.k = Math.min(5, Math.max(0.2, +((s.k ?? 1) * f).toFixed(3)));
    E.hl = null; apHet(E.nay);
    await luu();
  }

  /* ── CHÉP · DÁN (chủ nhà 2026-10-30 «copy paste an object»): bản sao hiện ngay cạnh bản gốc, là NHÁP tới «Xác nhận» —
     món đồ chép nguyên bản ghi mặt bằng (dat_do.nhan_ban), vật khác thành ghi chú «thêm một cái nữa». ── */
  let demSao = 0, PHIEU = null;
  function khoiSao(k0, s) {                                           // lưới chép của món gốc, gom thành một khối giữ chỗ
    const n0 = NAY.get(k0), k = `sao:${++demSao}`, gc0 = GIU_CHO.get(k0);
    let grp;
    if (gc0) { grp = gc0.clone(true); grp.position.set(0, 0, 0); grp.rotation.set(0, 0, 0); grp.scale.set(1, 1, 1); grp.userData = { ...gc0.userData }; }
    else {
      const g = DUNG.get(k0), zs = sanMon(k0), qi = new THREE.Quaternion().setFromAxisAngle(TRUC_Z, -THREE.MathUtils.degToRad(g.rot));
      grp = new THREE.Group();
      for (const o of dsCua(k0)) {
        if (!o.visible) continue;
        const c = o.clone(false);
        c.position.copy(o.userData.p0).sub(new V3(g.x, g.y, zs + g.z)).applyQuaternion(qi);
        c.quaternion.copy(qi).multiply(o.userData.q0); c.scale.copy(o.userData.s0);
        grp.add(c);
      }
      grp.userData = { san: zs, h: 0 };
    }
    grp.userData.khoa = k; grp.userData.ten = n0.ten;
    GOC.add(grp); GIU_CHO.set(k, grp);
    NAY.set(k, { ...chep(s), w: n0.w, d: n0.d, hD: n0.hD, tang: n0.tang, id: null, nguon: n0.id || n0.nguon, ten: n0.ten, doc: n0.doc });
    apCho(k, s); CHO_SAO.add(k);
    return k;
  }
  async function dan(ds) {                                             // ds [{k, s}]: dán cạnh, thử bốn phía một bề rộng
    if (!ds.length || E) return;
    const tang = NAY.get(ds[0].k).tang, r = Math.max(...ds.map(({ k, s }) => (NAY.get(k).w * (s.k ?? 1)) / 1000)) + 0.1;
    let tot = null;
    /* chủ nhà 2026-10-31: dán đôi ghế rồi không dời được — bản sao rơi vào gầm bàn (ghế được thò gầm bàn), bị mặt bàn che
       nên không nắm được. Lượt đầu đòi chỗ KHÔNG chồng món nào (chat), không có mới chấp nhận chỗ thò gầm. */
    const PHIA = [[r, 0], [-r, 0], [0, r], [0, -r], [2 * r, 0], [-2 * r, 0], [0, 2 * r], [0, -2 * r]];
    for (const chat of [true, false]) {
      for (const [dx, dy] of PHIA) {
        const kq = await goi("kiem", { tang, mon: ds.map(({ k, s }) => ({ ...thanMon(k, { ...s, x: s.x + dx, y: s.y + dy }), id: null, moi: null, nguon: NAY.get(k).id || NAY.get(k).nguon, chat })) });
        if (kq.ok) { tot = [dx, dy]; break; }
      }
      if (tot) break;
    }
    const [dx, dy] = tot || [r, 0];
    api.datChon(null); rieng = true;
    NHOM = ds.map(({ k, s }) => khoiSao(k, { ...s, x: +(s.x + dx).toFixed(4), y: +(s.y + dy).toFixed(4) }));
    PHIEU = { mon: NHOM.map((k) => ({ k })), ten: tenNhom(NHOM) };    // dán tiếp ⇒ cạnh bản vừa dán, không chồng lên nó
    HOAN_TAC.push({ kieu: "cho_sao", ks: [...NHOM], ten: `bản sao ${tenNhom(NHOM)}` });
    veXn();
    thongBao(`Đã dán ${tenNhom(NHOM)}${tot ? " cạnh bản gốc" : " — chưa có chỗ trống ngay cạnh"}: kéo tới chỗ muốn đặt, rồi «Xác nhận».`);
  }
  function chepChon() {
    if (NHOM.length) PHIEU = { mon: NHOM.map((k) => ({ k })), ten: tenNhom(NHOM) };
    else if (VAT_CHON) PHIEU = { vat: VAT_CHON, ten: VAT_CHON.ten };
    else return false;
    thongBao(`Đã chép ${PHIEU.ten} — ⌘V / Ctrl+V để dán.`);
    return true;
  }
  function danPhieu() {
    if (!PHIEU || E || api.cheDoSua?.() === false) return false;
    if (PHIEU.mon) { const ds = PHIEU.mon.filter(({ k }) => NAY.has(k)).map(({ k }) => ({ k, s: chep(NAY.get(k)) })); if (!ds.length) return false; dan(ds); }
    else if (PHIEU.vat.ds.every((o) => o.parent)) PHIEU = { vat: danVat(PHIEU.vat), ten: PHIEU.ten };
    else return false;
    return true;
  }
  const nhanBan = () => { const cu = PHIEU; if (chepChon()) { danPhieu(); } else PHIEU = cu; };

  async function bo() {
    if (!NHOM.length || E) return;
    const ks = [...NHOM], tang = NAY.get(ks[0]).tang;
    for (const k of ks) { const gc = GIU_CHO.get(k); if (gc) gc.visible = false; else api.an(dsCua(k).map((o) => o.userData.id)); CHO_BO.set(k, tang); }
    HOAN_TAC.push({ kieu: "cho_bo", ks, ten: tenNhom(ks) });           // NHÁP — bỏ khỏi mặt bằng khi «Xác nhận»
    veXn();
    NHOM = []; rieng = false; api.datChon(null);
  }
  async function hoanTacCuoi() {
    const h = HOAN_TAC.pop(); if (!h || E) return;
    bao.hidden = true;
    for (const f of KHI_LUI) f(h);
    if (h.kieu === "ngoai") {                                          // bước nháp của mô-đun
      const i = NHAP_NGOAI.indexOf(h.n);
      if (h.n && i >= 0 && h.cuoi) { NHAP_NGOAI.splice(i, 1); h.n.huy(); } else h.lui?.();
      veXn(); thongBao(`Đã lùi: ${h.ten}.`); return;
    }
    if (h.kieu === "ngoai_da_ghi") {                                   // đã xác nhận: mô-đun tự ghi ngược
      let r; try { r = await h.lui(); } catch (e) { r = { ok: false, loi: [e.message] }; }
      if (r && r.ok === false) { HOAN_TAC.push(h); thongBao("⛔ Không hoàn tác được: " + (r.loi || []).join(" · ")); }
      else thongBao(`Đã hoàn tác: ${h.ten}.`);
      veLai(60); return;
    }
    if (h.kieu.startsWith("cho")) {                                   // bước nháp: lùi tại chỗ, không gọi máy
      if (h.kieu === "cho") { apHet(h.truoc); for (const [k, s] of h.truoc) Object.assign(NAY.get(k), s); }
      else if (h.kieu === "cho_bo") for (const k of h.ks) { hienMon(k); CHO_BO.delete(k); }
      else if (h.kieu === "cho_sao") for (const k of h.ks) { boKhoi(k); CHO_SAO.delete(k); CHO_DAU.delete(k); CHO_BO.delete(k); }
      else if (h.kieu === "cho_them") for (const k of h.ks) { boKhoi(k); CHO_THEM.delete(k); CHO_DAU.delete(k); CHO_BO.delete(k); }
      else if (h.kieu === "cho_saovat") boSaoVat(h.v);
      else if (h.kieu === "cho_saovat_bo") { for (const o of h.v.ds) h.v.goc.add(o); VAT.set(h.v.khoa, h.v); apVat(h.v); }
      else if (h.kieu === "cho_bovat") { h.v.bo = false; api.hien(h.v.ds.map((o) => o.userData.id)); }
      else { h.v.d = { ...h.truoc }; apVat(h.v); }
      veXn(); thongBao(`Đã lùi: ${h.ten}.`); return;
    }
    let kq;
    if (h.kieu === "dat") {
      kq = await goi("dat", thanNhom(h.truoc));
      if (kq.ok) { apHet(h.truoc); for (const [k, s] of h.truoc) Object.assign(NAY.get(k), s); }
    } else if (h.kieu === "xoa") {
      kq = await goi("them", { tang: h.tang, ban_ghi: h.ban_ghi });
      if (kq.ok) for (const k of h.ks) { const gc = GIU_CHO.get(k); if (gc) gc.visible = true; else api.hien(dsCua(k).map((o) => o.userData.id)); }
    } else {
      kq = await goi("xoa", { tang: h.tang, ids: [NAY.get(h.k).id] });
      if (kq.ok) { GOC.remove(GIU_CHO.get(h.k)); GIU_CHO.delete(h.k); NHOM = NHOM.filter((k) => k !== h.k); }
    }
    if (!kq.ok) { HOAN_TAC.push(h); thongBao("⛔ Không hoàn tác được: " + (kq.loi || []).join(" · ")); }
    else thongBao(`Đã hoàn tác: ${h.ten}.`);
    veLai(60);
  }
  nc.addEventListener("click", (ev) => {
    const v = ev.target.closest("button")?.dataset.v;
    if (v === "xoay+") xoay(90); else if (v === "xoay-") xoay(-90);
    else if (v === "to" || v === "nho") { const f = v === "to" ? 1.1 : 1 / 1.1; if (NHOM.length) phong(f); else phongVat(f); }
    else NUT_NGOAI.find((n) => n.v === v)?.khi(ev);
  });

  /* ── kéo trên sàn (tia ∩ mặt ngang ở cốt món) · kéo nút ↕ (dz theo số điểm ảnh một mét đứng ở chỗ món) ── */
  const ray = new THREE.Raycaster(), chuot = new THREE.Vector2();
  function tia(ev) {
    const r = canvas.getBoundingClientRect();
    chuot.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(chuot, camera);
    return ray;
  }
  function diemSan(ev, z) {
    const n = m2w(0, 0, 1).sub(m2w(0, 0, 0)).normalize(), w = new V3();
    return tia(ev).ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(n, m2w(0, 0, z)), w) ? w2m(w) : null;
  }
  const vatNhom = () => NHOM.flatMap((k) => (GIU_CHO.has(k) ? [GIU_CHO.get(k)] : dsCua(k).filter((o) => o.visible)));
  function trung(ev, ds) {
    const h = tia(ev).intersectObjects(ds, true)[0];
    if (!h) return null;
    const truoc = api.ban(ev);                                        // vật khác che trước ⇒ không phải cú nắm món
    return !truoc || ds.includes(truoc.object) || truoc.distance >= h.distance - 1e-3 ? h : null;
  }
  let keo = null, tCo = 0;
  /* LEO LÊN VẬT (chủ nhà 2026-10-30 «dragging onto another object, it will try to climb on it»): đang kéo, dò tia thẳng đứng
     xuống từ trên chỗ món (1,2 m trên sàn) — gặp mặt NẰM của vật khác (bàn, bệ bếp, nóc tủ thấp) thì món đứng lên mặt ấy,
     ra khỏi thì xuống sàn. Món không nâng hạ được (doc: false) và vật treo (không chạm mặt dưới nó lúc bắt đầu) không leo. */
  const tiaDoc = new THREE.Raycaster(), KHONG_DO = new Set(["den", "dien", "quat", "thong_gio"]);
  function matDuoi(x, y, zTu, bo) {                                    // cốt mặt nằm cao nhất ngay dưới (x, y) — mét mô hình, null: không có
    const len = m2w(0, 0, 1).sub(m2w(0, 0, 0)).normalize();
    tiaDoc.set(m2w(x, y, zTu), len.clone().negate());
    const ds = PHAN.filter((o) => o.visible && !bo.has(o) && !o.userData.khoi_phong && o.userData.vat_lieu !== "khoang" && !o.userData.ma
      && !KHONG_DO.has(o.userData.nhom));                              // đèn thả, ổ điện, quạt không phải mặt để đặt đồ
    for (const h of tiaDoc.intersectObjects(ds, false)) {
      if (!h.face) continue;
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      if (n.dot(len) > 0.7) return w2m(h.point).z;
    }
    return null;
  }
  const LEO = 1.2, SAT = 0.03;                                         // mặt đỡ cao nhất 1,2 m trên sàn (bàn, bệ bếp, tủ thấp)
  function leoMon(k, s) {                                               // cao độ món đặt ở (s.x, s.y): mặt vật bên dưới, sàn ⇒ 0
    if (!NAY.get(k).doc) return s.z;
    const san = sanMon(k), bo = new Set([...E.ks.flatMap((kk) => (GIU_CHO.has(kk) ? GIU_CHO.get(kk).children : dsCua(kk)))]);
    const m = matDuoi(s.x, s.y, san + LEO, bo);
    return m == null || m - san < SAT ? 0 : +(Math.round((m - san) / BUOC_MIN) * BUOC_MIN).toFixed(4);
  }
  // chế độ sửa: con trỏ bàn tay trên thứ kéo được (món đồ, hoặc vật khác đang chọn)
  canvas.addEventListener("pointermove", (ev) => {
    if (keo || ev.buttons || api.cheDoSua?.() === false) { if (!keo && api.cheDoSua?.() === false) canvas.style.cursor = ""; return; }
    if (ev.timeStamp - tCo < 60) return;                               // dò tia thưa thôi — xem.js cũng dò cho tô rê
    tCo = ev.timeStamp;
    const b = api.ban(ev);
    canvas.style.cursor = (b && laMon(b.object) && NHOM.includes(nhan(b.object))) || (VAT_CHON && !laSan(VAT_CHON) && tia(ev).intersectObjects(VAT_CHON.ds, false).length) ? "grab" : "";
  });
  canvas.addEventListener("pointerdown", (ev) => {
    if (THIET_BI || ev.button > 0 || keo || E || ev.shiftKey || api.cheDoSua?.() === false) return;   // thiết bị: không nắm kéo — chạm chỉ chọn
    let h = NHOM.length ? trung(ev, vatNhom()) : null;
    if (!h) {                                                          // khối giữ chỗ (món mới thả, bản sao dán): chạm là chọn nó
      const g = tia(ev).intersectObjects([...GIU_CHO.values()].filter((x) => x.visible), true)[0];
      const kg = g && [...GIU_CHO].find(([, x]) => x === g.object || x.getObjectById(g.object.id))?.[0];
      if (kg && NHOM.includes(kg)) h = g;                             // khối thuộc nhóm đang chọn (đôi ghế vừa dán): kéo cả nhóm
      else if (kg) { ev.stopImmediatePropagation(); ev.preventDefault(); api.datChon(null); rieng = true; NHOM = [kg]; veLai(60); return; }   // chưa chọn: chạm này chỉ chọn
    }
    if (!h) {                                                          // bản sao vật khác (không nằm trong cảnh để chọn): chạm là chọn
      const sv = [...VAT.values()].filter((v) => v.sao && v !== VAT_CHON);
      const g = sv.length && tia(ev).intersectObjects(sv.flatMap((v) => v.ds), false)[0];
      if (g) { ev.stopImmediatePropagation(); ev.preventDefault(); rieng = false; NHOM = []; api.datChon(null); VAT_CHON = sv.find((v) => v.ds.includes(g.object)); veLai(60); return; }
    }
    if (!h) {
      const b = api.ban(ev);
      let bv = VAT_CHON && !laSan(VAT_CHON) && tia(ev).intersectObjects(VAT_CHON.ds.filter((o) => o.visible), false)[0];   // vật đang chọn vẽ xuyên ⇒ nắm được cả khi có vật che
      /* CHỌN TRƯỚC RỒI MỚI KÉO (chủ nhà 2026-10-31: «I always accidentally drag the view but turned to drag an object around…
         I can only drag object if I select it first, click once, then click down and drag»): vật CHƯA chọn — món đồ, cửa, đèn,
         tường… — kéo lên nó là xoay camera, chạm nhả là chọn (xem.js); chỉ vật ĐANG chọn mới nắm-kéo được. */
      if (bv) {                                                        // vật khác ĐANG CHỌN (tường, cửa, đèn…): nắm mà kéo
        ev.stopImmediatePropagation(); ev.preventDefault();
        const z = w2m(bv.point).z, p = diemSan(ev, z);
        if (!p) return;
        const v = VAT_CHON, bo = new Set(v.ds), day = v.tam.z + v.d.z;   // vật đứng trên một mặt lúc bắt đầu (không treo, không cao quá 2 m) mới leo
        const b0 = new THREE.Box3(); for (const o of v.ds) b0.expandByObject(o);
        const m0 = matDuoi(v.tam.x + v.d.x, v.tam.y + v.d.y, day + 0.05, bo);
        const leo = m0 != null && Math.abs(m0 - day) < SAT && b0.max.y - b0.min.y < 2;
        keo = { id: ev.pointerId, kieu: "vat", v, d0: { ...v.d }, z, p0: p, x0: ev.clientX, y0: ev.clientY, da: false, leo, bo };
        controls.enabled = false; canvas.setPointerCapture?.(ev.pointerId);
        return;
      }
      return;                                                          // chưa chọn: kéo là xoay camera, chạm nhả là chọn
    }
    ev.stopImmediatePropagation(); ev.preventDefault();
    const k0 = NHOM[0], p = diemSan(ev, sanMon(k0) + NAY.get(k0).z);
    if (!p) return;
    keo = { id: ev.pointerId, kieu: "xy", p0: p, x0: ev.clientX, y0: ev.clientY, vat: h.object, da: false };
    controls.enabled = false;
    canvas.setPointerCapture?.(ev.pointerId);
  }, { capture: true });
  nutDoc.addEventListener("pointerdown", (ev) => {
    if (E || (!NHOM.length && !VAT_CHON)) return;
    ev.preventDefault(); ev.stopPropagation();
    let a, b;
    if (NHOM.length) {
      const k0 = NHOM[0], s = NAY.get(k0), z = sanMon(k0) + s.z;
      a = m2w(s.x, s.y, z).project(camera); b = m2w(s.x, s.y, z + 1).project(camera);
    } else {
      const c = w2m(new THREE.Box3().setFromObject(VAT_CHON.ds[0]).getCenter(new V3()));
      a = m2w(c.x, c.y, c.z).project(camera); b = m2w(c.x, c.y, c.z + 1).project(camera);
    }
    const r = canvas.getBoundingClientRect();
    const pxm = Math.max(20, Math.abs((a.y - b.y) / 2 * r.height));    // điểm ảnh cho một mét đứng, ở chỗ món
    keo = NHOM.length ? { id: ev.pointerId, kieu: "z", x0: ev.clientX, y0: ev.clientY, pxm, da: false }
      : { id: ev.pointerId, kieu: "vatz", v: VAT_CHON, d0: { ...VAT_CHON.d }, x0: ev.clientX, y0: ev.clientY, pxm, da: false };
    nutDoc.setPointerCapture?.(ev.pointerId);
  });
  addEventListener("pointermove", (ev) => {
    if (!keo || ev.pointerId !== keo.id) return;
    ev.stopImmediatePropagation();
    const laVat = keo.kieu === "vat" || keo.kieu === "vatz";
    if (!keo.da) {
      if (Math.hypot(ev.clientX - keo.x0, ev.clientY - keo.y0) < 4) return;
      keo.da = true; if (!laVat) batDau(keo.kieu);
    }
    const b = ev.altKey ? BUOC_MIN : BUOC;
    if (laVat) {
      const v = keo.v, d = { ...keo.d0 };
      if (keo.kieu === "vatz") d.z = +(keo.d0.z + Math.round(-(ev.clientY - keo.y0) / keo.pxm / b) * b).toFixed(4);
      else {
        const p = diemSan(ev, keo.z); if (!p) return;
        d.x = +(keo.d0.x + Math.round((p.x - keo.p0.x) / b) * b).toFixed(4); d.y = +(keo.d0.y + Math.round((p.y - keo.p0.y) / b) * b).toFixed(4);
        if (keo.leo) {
          const m = matDuoi(v.tam.x + d.x, v.tam.y + d.y, v.tam.z + d.z + LEO, keo.bo);
          if (m != null) d.z = +(m - v.tam.z).toFixed(4);
        }
      }
      for (const f of KHI_KEO) f({ kieu: keo.kieu, v, d, d0: keo.d0, ev, buoc: b });   // mô-đun: bám tường / láng giềng, đo
      v.d = d; apVat(v);
      return;
    }
    if (keo.kieu === "z") {
      const dz = Math.round(-(ev.clientY - keo.y0) / keo.pxm / b) * b;
      for (const [k, s] of E.nay) s.z = Math.max(0, +(E.dau.get(k).z + dz).toFixed(4));
    } else {
      const k0 = E.ks[0], p = diemSan(ev, sanMon(k0) + E.dau.get(k0).z);
      if (!p) return;
      const dx = Math.round((p.x - keo.p0.x) / b) * b, dy = Math.round((p.y - keo.p0.y) / b) * b;
      for (const [k, s] of E.nay) { const a = E.dau.get(k); s.x = +(a.x + dx).toFixed(4); s.y = +(a.y + dy).toFixed(4); s.z = leoMon(k, s); }
    }
    for (const f of KHI_KEO) f({ kieu: keo.kieu, ks: E.ks, nay: E.nay, dau: E.dau, ev, buoc: b });   // mô-đun: bám tường / láng giềng, đo
    apHet(E.nay); kiem();
  }, { capture: true });
  const tha = async (ev) => {
    if (!keo || ev.pointerId !== keo.id) return;
    ev.stopImmediatePropagation();
    const k = keo; keo = null; controls.enabled = true;
    for (const f of KHI_THOI_KEO) f({ kieu: k.kieu, da: k.da, v: k.v });
    if (k.kieu === "vat" || k.kieu === "vatz") {
      if (k.da && !giongD(k.d0, k.v.d)) { HOAN_TAC.push({ kieu: "cho_vat", v: k.v, truoc: k.d0, sau: { ...k.v.d }, ten: k.v.ten }); veXn(); }
      return;
    }
    if (!k.da) {                                                       // bấm không kéo: như một cú chọn thường (chỉ món này)
      if (k.kieu === "xy" && !rieng && k.vat && PHAN.includes(k.vat)) api.datChon(k.vat);
      return;
    }
    await luu();
  };
  addEventListener("pointerup", tha, { capture: true });
  addEventListener("pointercancel", tha, { capture: true });

  addEventListener("keydown", (ev) => {
    if (ev.target.closest?.("input, textarea, select, [contenteditable]")) return;
    const k = ev.key;
    for (const f of PHIM) if (f(ev)) { ev.preventDefault(); ev.stopImmediatePropagation(); return; }   // mô-đun xử lý trước
    if ((ev.metaKey || ev.ctrlKey) && !ev.shiftKey && k.toLowerCase() === "z" && HOAN_TAC.length) { hoanTacCuoi(); ev.preventDefault(); ev.stopImmediatePropagation(); return; }
    if (THIET_BI) return;                                              // thiết bị: phím dời / xoay / bỏ / chép đồ tắt
    const cmd = ev.metaKey || ev.ctrlKey, sua = api.cheDoSua?.() !== false;
    if (!NHOM.length && laSan(VAT_CHON) && !(cmd && k.toLowerCase() === "c" && String(getSelection()).trim()) && (cmd ? ["c", "d"].includes(k.toLowerCase()) : ["=", "+", "-", "_", "9", "0", "PageUp", "PageDown", "Delete", "Backspace"].includes(k))) {
      thongBao("Sàn không dời, phóng hay bỏ được — đổi gạch / sơn ở «Vật liệu» (H)."); ev.preventDefault(); ev.stopImmediatePropagation(); return;
    }
    if (sua && cmd && !ev.altKey && !ev.shiftKey && ["c", "v", "d"].includes(k.toLowerCase())) {   // chép · dán · nhân bản
      const l = k.toLowerCase();
      if (l === "c" && String(getSelection()).trim()) return;          // đang bôi chữ: chép chữ như thường
      const xong = l === "c" ? chepChon() : l === "v" ? danPhieu() : (NHOM.length || VAT_CHON) ? (nhanBan(), true) : false;
      if (xong) { ev.preventDefault(); ev.stopImmediatePropagation(); }
      return;
    }
    if (sua && !cmd && (NHOM.length || VAT_CHON) && ["=", "+", "-", "_"].includes(k)) {   // phóng to · thu nhỏ 10%
      const f = k === "=" || k === "+" ? 1.1 : 1 / 1.1;
      if (NHOM.length) phong(f); else phongVat(f);
      ev.preventDefault(); ev.stopImmediatePropagation(); return;
    }
    if (sua && !cmd && !NHOM.length && VAT_CHON && (k === "Delete" || k === "Backspace")) { boVat(VAT_CHON); ev.preventDefault(); ev.stopImmediatePropagation(); return; }
    if (!NHOM.length && VAT_CHON && !ev.metaKey && !ev.ctrlKey && ["9", "0", "PageUp", "PageDown"].includes(k)) {
      const v = VAT_CHON, d0 = { ...v.d }, b = (ev.altKey ? BUOC_MIN : BUOC) * (k === "9" || k === "PageUp" ? 1 : -1);
      v.d = { ...d0, z: +(d0.z + b).toFixed(4) }; apVat(v);
      HOAN_TAC.push({ kieu: "cho_vat", v, truoc: d0, sau: { ...v.d }, ten: v.ten }); veXn();
      ev.preventDefault(); ev.stopImmediatePropagation(); return;
    }
    if (!NHOM.length || ev.metaKey || ev.ctrlKey) return;
    const b = ev.altKey ? BUOC_MIN : BUOC;
    let xong = true;
    if (k === "r" || k === "R") xoay(ev.shiftKey ? -90 : 90);
    else if (k === ".") xoay(90);
    else if (k === ",") xoay(-90);
    else if (k === "9" || k === "PageUp") nang(b);
    else if (k === "0" || k === "PageDown") nang(-b);
    else if ((k === "Delete" || k === "Backspace") && !E) bo();
    else xong = false;
    if (xong) { ev.preventDefault(); ev.stopImmediatePropagation(); }
  }, { capture: true });

  /* ── THƯ VIỆN ĐỒ: nút trên thanh công cụ + bảng nổi (tìm · nhóm · cỡ) ── */
  const nhomCC = document.querySelector('.thanh [aria-label="Công cụ"]');
  const nutTV = document.createElement("button");
  nutTV.type = "button"; nutTV.id = "nut-thu-vien"; nutTV.textContent = "Thư viện đồ";
  nutTV.title = "Tìm một món (sofa, giường, bàn, tủ…) rồi kéo thả vào mô hình — ghi vào mặt bằng";
  nhomCC?.append(nutTV);
  const bang = document.createElement("div");
  bang.className = "dd-thu-vien"; bang.hidden = true; bang.setAttribute("role", "dialog"); bang.setAttribute("aria-label", "Thư viện đồ");
  bang.innerHTML = `<div class="dd-tv-dau"><input type="search" placeholder="Tìm: sofa, giường, bàn ăn, tủ…" aria-label="Tìm món">
    <button type="button" class="dd-tv-dong" aria-label="Đóng thư viện">✕</button></div>
    <p class="mo">Kéo một cỡ thả vào khung 3D — thả là nháp, «Xác nhận» mới ghi. Chạm cỡ: món vào chỗ trống gần giữa khung. Cỡ phổ thông, không phải món đã chọn mua.</p>
    <div class="dd-tv-ds"></div>`;
  khung.append(bang);
  const oTim = bang.querySelector("input"), dsEl = bang.querySelector(".dd-tv-ds");
  let THU_VIEN = null;
  async function napTV() {
    const r = await fetch("/api/do-dac/thu-vien");
    if (!r.ok) { MAY_OK = false; canhBaoMay(); return 0; }
    const d = await r.json(); THU_VIEN = d.mon; SAN = d.san || SAN; return THU_VIEN.length;
  }
  if (!THIET_BI) napTV().catch(() => {});
  async function moThuVien() {
    bang.hidden = !bang.hidden;
    if (bang.hidden) return;
    if (!THU_VIEN && !(await napTV().catch(() => 0))) { dsEl.textContent = "Không tải được thư viện (xem.py)."; return; }
    veDs(); oTim.focus();
  }
  const boDau = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();
  function veDs() {
    const q = boDau(oTim.value.trim()).split(/\s+/).filter(Boolean);  // mọi chữ gõ đều phải có (thứ tự nào cũng được)
    dsEl.innerHTML = "";
    let nhomCu = null;
    for (const m of THU_VIEN) {
      const chuoi = boDau(`${m.ten} ${m.nhom} ${m.id} ${m.co.map((c) => c.ten).join(" ")}`);
      if (q.some((t) => !chuoi.includes(t))) continue;
      if (m.nhom !== nhomCu) { const h = document.createElement("h4"); h.textContent = nhomCu = m.nhom; dsEl.append(h); }
      const hang = document.createElement("div"); hang.className = "dd-tv-mon";
      const t = document.createElement("strong"); t.textContent = m.ten; hang.append(t);
      for (const c of m.co) {
        const b = document.createElement("button"); b.type = "button"; b.className = "chip";
        b.textContent = `${c.ten ? c.ten + " · " : ""}${c.w}×${c.d}`;
        b.title = `${m.ten} ${c.w} × ${c.d} × cao ${m.h} mm — kéo vào khung 3D`;
        b.addEventListener("pointerdown", (ev) => keoTuThuVien(ev, m, c));
        hang.append(b);
      }
      dsEl.append(hang);
    }
    if (!dsEl.childElementCount) dsEl.textContent = "Không có món nào khớp.";
  }
  oTim.addEventListener("input", veDs);
  nutTV.onclick = moThuVien;
  bang.querySelector(".dd-tv-dong").onclick = () => (bang.hidden = true);

  const tangTai = (z) => Object.entries(SAN).reduce((a, b) => (Math.abs(b[1] - z) < Math.abs(a[1] - z) ? b : a))[0];
  function diemTha(ev) {                                               // mặt sàn đầu tiên dưới con trỏ (ở cốt một tầng), không thì sàn tầng 1
    const h = api.ban(ev);
    if (h) { const p = w2m(h.point); if (Math.abs(p.z - SAN[tangTai(p.z)]) < 0.12) return p; }
    return diemSan(ev, SAN.t1);
  }
  let demMoi = 0;
  function khoiGiuCho(m, c, tang, s) {
    const w = c.w / 1000, d = c.d / 1000, h = m.h / 1000;
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), new THREE.MeshBasicMaterial({ color: 0xc9b48f }));
    o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry), new THREE.LineBasicMaterial({ color: 0x4a4a46 })));
    const k = `moi:${++demMoi}`;
    o.userData = { khoa: k, ten: m.ten, h, san: SAN[tang], moi: { catalog: m.id, width_mm: c.w, depth_mm: c.d } };
    GOC.add(o);
    GIU_CHO.set(k, o);
    NAY.set(k, { ...s, w: c.w, d: c.d, tang, id: null, ten: m.ten, doc: true, catalog: m.id });
    apCho(k, s);
    return k;
  }
  function boKhoi(k) { GOC.remove(GIU_CHO.get(k)); GIU_CHO.delete(k); NAY.delete(k); NHOM = NHOM.filter((x) => x !== k); veLai(60); }
  async function luuMoi(k) {                                           // món mới vừa thả: NHÁP — ghi mặt bằng khi «Xác nhận»
    const n = NAY.get(k);
    HOAN_TAC.push({ kieu: "cho_them", ks: [k], ten: n.ten });
    CHO_THEM.add(k); veXn();
    api.datChon(null); rieng = true; NHOM = [k];
    thongBao(`Đã thả ${n.ten} — «Xác nhận» để ghi vào mặt bằng, «Huỷ» thì bỏ.`);
    veLai(60);
  }
  /* MẶT BÁM khi kéo từ thư viện (chủ nhà 2026-10-31: «objects have a sticky surface: some at the bottom (drag onto other
     objects), some on the side (attach to others on the side)»; «no need to check whether size overflows the space or is
     cramped against walls»). `m.bam` từ furniture-presets.yaml: «day» — đáy món đặt lên mặt NẰM dưới con trỏ (sàn, mặt bàn,
     nóc tủ); «canh» — lưng món (+v) áp vào mặt ĐỨNG dưới con trỏ (tường, cạnh tủ), quay lưng vào mặt ấy, tâm món theo cao độ
     con trỏ. Không trúng mặt đúng kiểu ⇒ đứng sàn ở cao độ của thư viện như trước. Món kéo từ thư viện KHÔNG kiểm chỗ đặt — thả
     là nháp ngay, «Xác nhận» ghi với tu_do (dat_do.py them). */
  const _N = new V3();
  const tangDuoi = (z) => Object.entries(SAN).filter(([, v]) => v <= z + 0.05).reduce((a, b) => (b[1] > a[1] ? b : a), ["t1", -Infinity])[0];
  function choBam(e, m, c) {                                           // → {s, tang} chỗ đặt theo mặt bám, hay null
    const h = api.ban(e);
    if (h?.face) {
      const p = w2m(h.point), n = w2m(h.point.clone().add(_N.copy(h.face.normal).transformDirection(h.object.matrixWorld))).sub(p);
      if (m.bam === "canh" && Math.abs(n.z) < 0.5) {
        const nx = n.x / Math.hypot(n.x, n.y), ny = n.y / Math.hypot(n.x, n.y), d = c.d / 1000, tang = tangDuoi(p.z);
        const rot = ((Math.round(Math.atan2(nx, -ny) * 180 / Math.PI) % 360) + 360) % 360;   // trục v của món = −pháp tuyến: lưng vào mặt
        const z = Math.max(0, Math.round((p.z - SAN[tang] - m.h / 2000) / BUOC_MIN) * BUOC_MIN);
        return { tang, s: { x: +(p.x + nx * (d / 2 + 0.002)).toFixed(4), y: +(p.y + ny * (d / 2 + 0.002)).toFixed(4), rot, z: +z.toFixed(4) } };
      }
      if (m.bam !== "canh" && n.z > 0.6) {
        const tang = tangDuoi(p.z), z = Math.max(0, p.z - SAN[tang]);
        return { tang, s: { x: Math.round(p.x / BUOC) * BUOC, y: Math.round(p.y / BUOC) * BUOC, rot: 0, z: +((z < 0.02 ? 0 : z) + (m.z || 0) / 1000).toFixed(4) } };   // `z` thư viện = đáy so với CHỖ ĐỨNG (chậu âm −200 dưới mặt bệ)
      }
    }
    const p = diemTha(e); if (!p) return null;
    return { tang: tangTai(p.z), s: { x: Math.round(p.x / BUOC) * BUOC, y: Math.round(p.y / BUOC) * BUOC, rot: 0, z: (m.z || 0) / 1000 } };   // món treo thả ở cao độ của thư viện
  }
  function keoTuThuVien(ev, m, c) {
    ev.preventDefault();
    const x0 = ev.clientX, y0 = ev.clientY, id = ev.pointerId;
    let k = null;
    const di = (e) => {
      if (e.pointerId !== id || (!k && Math.hypot(e.clientX - x0, e.clientY - y0) < 8)) return;
      const r = canvas.getBoundingClientRect(), br = bang.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      if (e.clientX > br.left && e.clientX < br.right && e.clientY > br.top && e.clientY < br.bottom) return;
      const tv = document.querySelector(".sv-tv:not([hidden])")?.getBoundingClientRect();   // còn trên bảng thư viện của khay ⇒ chưa thả
      if (tv && e.clientX > tv.left && e.clientX < tv.right && e.clientY > tv.top && e.clientY < tv.bottom) return;
      const cb = choBam(e, m, c); if (!cb) return;
      const { s, tang } = cb;
      if (!k) { api.datChon(null); rieng = true; k = khoiGiuCho(m, c, tang, s); NHOM = [k]; batDau("xy", [k]); E.hl = null; }
      else if (NAY.get(k).tang !== tang) { NAY.get(k).tang = tang; GIU_CHO.get(k).userData.san = SAN[tang]; SAN_MON.delete(k); }   // lên / xuống tầng khi kéo
      E.nay.set(k, s); apCho(k, s);
    };
    const len = async (e) => {
      if (e.pointerId !== id) return;
      removeEventListener("pointermove", di, true); removeEventListener("pointerup", len, true); removeEventListener("pointercancel", len, true);
      if (k) {                                                         // thả: đặt đúng chỗ thả — món thư viện không kiểm chỗ đặt
        const e2 = E; clearTimeout(henKiem); luot++;
        const s = e2.nay.get(k);
        E = null; veTam();
        Object.assign(NAY.get(k), s); apCho(k, s);
        await luuMoi(k);
        return;
      }
      const r = canvas.getBoundingClientRect();                       // chạm (không kéo): chỗ trống gần giữa khung nhất
      const p = diemTha({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
      if (!p) return;
      const tang = tangTai(p.z);
      const tc = await goi("tim-cho", { tang, moi: { catalog: m.id, width_mm: c.w, depth_mm: c.d }, x: p.x * 1000, y: p.y * 1000, rot: 0 });
      if (!tc.ok) { thongBao(`⛔ ${(tc.loi || [])[0]} — kéo cỡ thả vào chỗ trống.`); return; }
      await luuMoi(khoiGiuCho(m, c, tang, { x: tc.x / 1000, y: tc.y / 1000, rot: 0, z: (m.z || 0) / 1000 }));
    };
    addEventListener("pointermove", di, true); addEventListener("pointerup", len, true); addEventListener("pointercancel", len, true);
  }

  /* ── MỞ RỘNG CHẾ ĐỘ SỬA (drive 2026-10-30): mỗi nhóm tính năng là một mô-đun web/sua/<tên>.js `export function batDau(ctx)`.
     ctx phơi trạng thái + hàm lõi; móc: khiKeo (chỉnh chỗ đang kéo: bám, đo), khiThoiKeo, phim (trả true = đã xử lý), khiLui,
     nhap.them (nháp riêng của mô-đun — đếm vào thanh «Xác nhận», Huỷ / ⌘Z lùi được), nut (nút tròn trên hàng nút ngữ cảnh). ── */
  const goiSua = async (mod, ham, than = {}) => {
    if (THIET_BI) return (await import("./sua/thiet_bi.js")).goi(mod, ham, than);
    try {
      const r = await fetch(`/api/sua/${mod}/${ham}`, { method: "POST", body: JSON.stringify(than) });
      return r.ok ? await r.json() : { ok: false, loi: [await r.text()] };
    } catch (e) { return { ok: false, loi: ["không gọi được máy (xem.py): " + e.message] }; }
  };
  const ctx = {
    THREE, GOC, PHAN, canvas, camera, controls, veLai, m2w, w2m, api, khung, nc, BUOC, BUOC_MIN, TRUC_Z,
    NAY, DUNG, GIU_CHO, HOAN_TAC, VAT, CHO_DAU, CHO_BO, CHO_SAO, CHO_THEM, SAN: () => SAN,
    nhom: () => NHOM, vatChon: () => VAT_CHON, dangKeo: () => E, dangNam: () => keo,
    datNhomKhoa: (ks) => { rieng = true; VAT_CHON = null; api.datChon(null); NHOM = [...ks]; veLai(60); },
    datVatChon: (v) => { rieng = false; NHOM = []; api.datChon(null); VAT_CHON = v; veLai(60); },
    boChon: () => { rieng = false; NHOM = []; VAT_CHON = null; api.datChon(null); veLai(60); },
    laMon, nhan, khoaCua, dsCua, sanMon, apCho, apHet, apVat, gocVat, nhomVat, chep, giong, giongD, KHONG,
    LAT0, khoiGiuCho, khoiSao, boKhoi, hienMon, matDuoi, leoMon, tia, diemSan, tenNhom, thanMon, thanNhom,
    goi, goiSua, thongBao, mm, hs, veXn, demCho, xacNhan, huy, hoanTacCuoi, batDauKeo: batDau, kiem, luu,
    chepChon, danPhieu, nhanBan, bo, boVat, phong, phongVat, xoay, nang, napThuVien: napTV, thuVien: () => THU_VIEN, keoTuThuVien,
    nutThuVien: nutTV, bangThuVien: bang,
    khiKeo: (f) => KHI_KEO.push(f), khiThoiKeo: (f) => KHI_THOI_KEO.push(f), phim: (f) => PHIM.push(f),
    khiLui: (f) => KHI_LUI.push(f), khiXacNhan: (f) => KHI_XAC_NHAN.push(f),
    nhap: {
      // n = {ten, loai, xacNhan: async () => ({ok, loi?, chu?, hoanTac?: async () => ({ok})}), huy: () => void}
      them(n) { NHAP_NGOAI.push(n); HOAN_TAC.push({ kieu: "ngoai", n, cuoi: true, ten: n.ten }); veXn(); return n; },
      buoc(n, ten, lui) { HOAN_TAC.push({ kieu: "ngoai", n, cuoi: false, ten, lui }); veXn(); },   // thêm một bước lùi vào nháp đã có
      bo(n) { const i = NHAP_NGOAI.indexOf(n); if (i >= 0) NHAP_NGOAI.splice(i, 1); boNhap((h) => h.kieu === "ngoai" && h.n === n); veXn(); },
      ds: () => [...NHAP_NGOAI],
    },
    nut({ v, chu, title, khi, hien = () => true, truoc = null }) {
      const el = document.createElement("button");
      el.type = "button"; el.dataset.v = v; el.textContent = chu; el.title = title || ""; el.setAttribute("aria-label", title || chu);
      const hang = nc.querySelector(".dd-nc-nut");
      hang.insertBefore(el, truoc ? hang.querySelector(`[data-v="${truoc}"]`) : null);
      NUT_NGOAI.push({ v, el, khi, hien });
      return el;
    },
  };
  window.__SUA = ctx;
  const MO_DUN = THIET_BI ? ["vat_lieu", "khung_sua"] : ["bien_doi", "bam", "vat_lieu", "thu_vien", "tuong", "quy_trinh", "khung_sua"];
  if (THIET_BI) ctx.thietBi = true;
  ctx.san_sang = (THIET_BI ? import("./sua/thiet_bi.js").then((m) => { ctx.urlVan = m.urlVan; }) : Promise.resolve())
    .then(() => Promise.all(MO_DUN.map((t) => import(`./sua/${t}.js`).then((m) => m.batDau?.(ctx))
      .catch((e) => console.error(`mô-đun sửa ${t}:`, e)))));

  /* phép thử */
  return {
    trangThai: () => ({ nhom: NHOM.map((k) => ({ khoa: k, ...NAY.get(k) })), dang: E && { kieu: E.kieu, ok: E.ok, loi: E.loi }, hoan_tac: HOAN_TAC.length,
      giu_cho: GIU_CHO.size, nut: !nc.hidden, chu: ncChu.textContent, bao: bao.hidden ? null : bao.textContent, may_ok: MAY_OK, cho: demCho(), vat: VAT_CHON && chuVat(VAT_CHON) }),
    xacNhan, huy,
    xoay, bo, nang, hoanTac: hoanTacCuoi, napThuVien: napTV,
    diemNut: (v) => { const b = nc.querySelector(`[data-v="${v}"]`)?.getBoundingClientRect(); return b && b.width ? [b.left + b.width / 2, b.top + b.height / 2] : null; },
  };
}
