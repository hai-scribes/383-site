/* Mô-đun chế độ sửa «vat_lieu» — xem dat_do.js «MỞ RỘNG CHẾ ĐỘ SỬA».
   F11 chọn vật liệu cho cả vật / MỘT phần · F12 bánh xe màu «thử màu» · F13 màu từng phần · F14 lớp phủ sàn / tường theo phòng ·
   F15 ống hút (phím I: vật liệu · Shift+I: kích thước).
   Mọi thứ là NHÁP (một nháp «Vật liệu» trên thanh Xác nhận, mỗi lần đổi một bước lùi ⌘Z). Xem trước đổi vlGoc của lưới
   (cùng đường với «Sơn màu» của xem.js ⇒ mờ, tô chọn, làm nổi… theo vật liệu mới). «Xác nhận» KHÔNG ghi dữ liệu nguồn: lưu thành
   GHI CHÚ «lựa chọn vật liệu» (đường ghi chú có sẵn) — màu thử lưu kèm ô vật liệu hồ sơ gần nhất. Ô màu từ máy chủ
   (sua_vat_lieu.py: data/materials.yaml + phuong-an-vat-lieu.yaml + thư viện gạch có vân thật); phím H mở bảng. */
export function batDau(ctx) {
  const { THREE, GOC, PHAN, canvas, camera, veLai, api, khung, NAY } = ctx;
  const V2 = THREE.Vector2;
  let BANG = [], PHONG = {}, tai = null;
  /* THIẾT BỊ (bản đăng, iPhone — web/sua/thiet_bi.js): ảnh vân mẫu thêm trên máy này là blob: trong IndexedDB */
  const urlVan = (k, t) => ctx.urlVan?.(k, t) || `vat-lieu/${k}/${t}.jpg`;
  const DOI = new Map();                      // lưới → ô màu đang xem thử
  const DA_XONG = new Map();                  // lưới → ô màu đã xác nhận (Huỷ về đây, không về hồ sơ)
  const GOC_VL = new WeakMap();               // lưới → vlGoc của hồ sơ trước khi tôi đổi
  const VL_DUNG = new Map();                  // khoá → vật liệu dùng chung
  const PH = new Map();                       // «tầng:phòng:be» → {spec, mesh}
  const PH_XONG = new Map();                  // «tầng:phòng:be» → spec đã xác nhận
  const CHUA = new Set();                     // lưới + khoá phòng đã chạm trong nháp
  const TD = { tab: "mon", che: "ca", phan: null, tang: "t1", phong: null, be: "san", hut: null, chuanBi: null };
  let nh = null;                              // nháp «Vật liệu» đang mở

  /* ── vật liệu xem thử ── */
  const laKinh = (m) => !!m && (m.transparent || m.transmission > 0);
  /* ô có VÂN THẬT (thư viện gạch: `vl_co_san` = thư mục web/vat-lieu/<khoá>/, lặp mỗi `van_co` mét): hiện màu TB ngay, ảnh
     nạp lười rồi gắn vào vật liệu. Toạ độ vân: kênh uv1 theo MÉT, chiếu hộp theo pháp tuyến (sàn: x·y, tường: ngang·cao) —
     không đụng uv gốc của vật. */
  const VAN = new Map();
  function napVan(k) {
    if (!VAN.has(k)) {
      const L = new THREE.TextureLoader();
      VAN.set(k, Promise.all(["mau", "nham", "phap"].map((t) => new Promise((ok, loi) => L.load(urlVan(k, t), ok, undefined, loi)))));
    }
    return VAN.get(k);
  }
  function uvMet(g) {
    if (!g?.attributes?.position || g.userData.uvMetSua) return;
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
      const [a, b] = az >= ax && az >= ay ? [p.getX(i), p.getY(i)] : ax >= ay ? [p.getY(i), p.getZ(i)] : [p.getX(i), p.getZ(i)];
      uv[2 * i] = a; uv[2 * i + 1] = b;
    }
    g.setAttribute("uv1", new THREE.BufferAttribute(uv, 2));
    g.userData.uvMetSua = true;
  }
  function ganVan(m, s, goc = null) {                                // goc [u, v] mét: mép viên đầu tiên (góc phòng / mặt sàn) — null = gốc nhà
    if (!s.vl_co_san || !s.van_co) return;
    napVan(s.vl_co_san).then(([tm, tn, tp]) => {
      const ru = 1 / s.van_co[0], rv = 1 / s.van_co[1];
      const lap = (t) => { const c = t.clone(); c.channel = 1; c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(ru, rv);
        if (goc) c.offset.set(-goc[0] * ru, -goc[1] * rv); c.needsUpdate = true; return c; };
      const a = lap(tm); a.colorSpace = THREE.SRGBColorSpace;
      Object.assign(m, { map: a, roughnessMap: lap(tn), normalMap: lap(tp), roughness: 1 });
      m.color.set("#ffffff"); m.needsUpdate = true; veLai(60);
    }).catch((e) => console.warn("vật liệu: không nạp được vân", s.vl_co_san, e));
  }
  function vlTu(goc, s) {
    const k = goc.uuid + s.hex + (s.kim_loai ?? 0) + (s.nham ?? 0.6) + (s.vl_co_san || "");
    let m = VL_DUNG.get(k);
    if (!m) {
      m = goc.clone(); m.color.set(s.hex); m.map = null; m.vertexColors = false;
      m.roughnessMap = m.metalnessMap = m.normalMap = null;
      m.metalness = s.kim_loai ?? 0; m.roughness = s.nham ?? 0.6; m.name = (goc.name || "") + " · thử " + (s.vl_co_san || s.hex);
      m.userData = { ...goc.userData, vlSua: s.hex }; m.needsUpdate = true; VL_DUNG.set(k, m);
      ganVan(m, s);
    }
    return m;
  }
  function apLuoi(o, s) {                                              // s = null ⇒ về bản đã xác nhận / hồ sơ
    const u = o.userData;
    if (!s) s = DA_XONG.get(o) || null;
    if (!GOC_VL.has(o)) { if (!s) return; GOC_VL.set(o, u.vlGoc || o.material); }
    const goc = GOC_VL.get(o);
    if (Array.isArray(goc)) return;
    if (s?.vl_co_san) uvMet(o.geometry);
    const cu = o.material, nm = s ? vlTu(goc, s) : goc;
    u.vlGoc = nm; if (u.vlHien === cu || !u.vlHien) u.vlHien = nm;
    if (cu?.userData?.vlSua || cu === goc) o.material = nm;
    if (s) { DOI.set(o, s); u.vat_lieu_ten_thu = s.ten; } else { DOI.delete(o); delete u.vat_lieu_ten_thu; }
  }
  const hexCua = (o) => { const m = Array.isArray(o.material) ? o.material[0] : o.material; return "#" + (m?.color ? m.color.getHexString() : "888888"); };
  const specCua = (o) => DOI.get(o) || DA_XONG.get(o) || { hex: hexCua(o), ten: o.userData.vat_lieu_ten || o.userData.ten || "vật liệu hồ sơ", ma: null, kim_loai: o.material?.metalness ?? 0, nham: o.material?.roughness ?? 0.6, hoso: true };

  /* ── lớp phủ sàn / tường theo phòng (xem thử, không phải mô hình thật) ── */
  const khoaPh = (t, z, b) => `${t}:${z}:${b}`;
  /* KHOẢNG GẠCH RIÊNG trong một phòng (chủ nhà 3D #491: «this one, if I change its material, the other floor changes instead» —
     khoảng gạch hoa văn 200×200 trong lòng chữ L tủ bếp là cụm «Sàn Bếp + bàn ăn — khoảng gạch hoa văn 200×200»; trước đây tên ấy
     bị đọc thành «sàn cả phòng Bếp + bàn ăn» nên đổi gạch là lát lại cả bếp). Mặt «be» = `vung-<băm tên cụm>` (khoá lưu chỉ nhận
     chữ / số / - : .), lớp phủ dựng từ chính các viên của cụm (mặt trên mỗi viên, nở 1,2 mm phủ mạch cũ). */
  const bam8 = (x) => { let h = 5381; for (const ch of x) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0; return h.toString(16).padStart(8, "0"); };
  const laVung = (b) => /^vung-/.test(b || "");
  const luoiVung = (b) => PHAN.filter((o) => o.isMesh && o.userData.cum && bam8(o.userData.cum) === b.slice(5));
  const tenVung = (b) => { const c = luoiVung(b)[0]?.userData.cum || ""; return c.split(" — ").slice(1).join(" — ") || "khoảng gạch"; };
  const phongCua = (t, z) => PHONG[t]?.phong.find((p) => p.id === z);
  /* bề mặt một phòng: sàn · cả tường · tường DƯỚI (sàn → mép chia `chia_op_mm` hay chiều cao ốp `cao_op_mm`, vd WC master 900) · tường TRÊN (chiều cao ốp → trần)
     — dưới / trên chọn gạch riêng (chủ nhà 2026-10-31) */
  const BE = { san: "Sàn", tuong: "Tường", tuong_duoi: "Tường dưới", tuong_tren: "Tường trên" };
  const tenBe = (b, p) => (laVung(b) ? tenVung(b) : /^c\d+$/.test(b) ? `Mặt tường ${p?.canh_ten?.[+b.slice(1)] || `cạnh ${+b.slice(1) + 1}`}` : b === "tuong_duoi" ? `Tường dưới (sàn → ${(p?.cao_op_mm ?? 1200) / 1000} m)` : b === "tuong_tren" ? `Tường trên (${(p?.cao_op_mm ?? 1200) / 1000} m → trần)` : BE[b]);
  function dungPhong(t, p, be, s) {
    const T = PHONG[t], zs = T.san_mm / 1000, z0 = zs - (p.ha_san_mm || 0) / 1000, pts = p.polygon_m;   // sàn hạ (WC): mặt sàn thấp hơn cốt tầng
    const mat = new THREE.MeshStandardMaterial({ color: s.hex, metalness: s.kim_loai ?? 0, roughness: s.nham ?? 0.6, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    let geo, vi = 0;
    let gocVung = null;
    if (laVung(be)) {
      GOC.updateMatrixWorld(); const ve = GOC.matrixWorld.clone().invert(), b3 = new THREE.Box3(), d = 0.0012, pos = [];
      let ax = Infinity, ay = Infinity;
      const v = new THREE.Vector3(), w = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], mt = new THREE.Matrix4();
      for (const o of luoiVung(be)) {
        // MẶT TRÊN THẬT của từng viên (viên cắt theo cung bo R800 giữ đúng đường cong), nở mỗi chiều d quanh tâm viên để phủ mạch cũ
        b3.setFromObject(o).applyMatrix4(ve);                      // hộp viên trong toạ độ mô hình (z lên)
        const cx = (b3.min.x + b3.max.x) / 2, cy = (b3.min.y + b3.max.y) / 2, hx = (b3.max.x - b3.min.x) / 2 || 1, hy = (b3.max.y - b3.min.y) / 2 || 1;
        const kx = (hx + d) / hx, ky = (hy + d) / hy, z = b3.max.z + 0.003;
        mt.multiplyMatrices(ve, o.matrixWorld);
        const g = o.geometry, P = g.attributes.position, I = g.index, n = I ? I.count : P.count;
        for (let i = 0; i < n; i += 3) {
          for (let j = 0; j < 3; j++) w[j].fromBufferAttribute(P, I ? I.getX(i + j) : i + j).applyMatrix4(mt);
          if (Math.min(w[0].z, w[1].z, w[2].z) < b3.max.z - 0.001) continue;          // chỉ tam giác nằm ở mặt trên
          v.subVectors(w[1], w[0]).cross(new THREE.Vector3().subVectors(w[2], w[0]));
          if (Math.abs(v.z) < 1e-9) continue;
          const tt = v.z > 0 ? [0, 1, 2] : [0, 2, 1];            // mặt quay lên
          for (const j of tt) pos.push(cx + (w[j].x - cx) * kx, cy + (w[j].y - cy) * ky, z);
        }
        ax = Math.min(ax, b3.min.x); ay = Math.min(ay, b3.min.y);
      }
      geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
      gocVung = [ax, ay];
    } else if (be === "san") { geo = new THREE.ShapeGeometry(new THREE.Shape(pts.map((q) => new V2(q[0], q[1])))); vi = z0 + 0.004; }
    else {
      const h = (p.cao_tran_mm || T.cao_tran_mm) / 1000, hop = Math.min((p.cao_op_mm || 1200) / 1000, h);
      // chiều cao ốp + trần tính từ COT TẦNG (như dựng ốp: WC master ốp tới cốt +2 400, mặt sàn hạ 30 nằm dưới)
      // mép chia `chia_op_mm` (WC master 900) đo từ MẶT SÀN phòng (sàn hạ) — đúng chỗ chia của ốp dựng (hoan_thien _op_wc_phuong_an)
      const zc = (p.chia_tu_san ? z0 : zs) + hop;
      const [za, zb, lech] = be === "tuong_duoi" ? [z0, zc, 0.005] : be === "tuong_tren" ? [zc, zs + h, 0.005] : [z0, zs + h, 0.004];
      const pos = [], dt = pts.reduce((a, q, i) => a + (q[0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * q[1]), 0) > 0 ? 1 : -1;
      const chiCanh = /^c\d+$/.test(be) ? +be.slice(1) : -1;          // MỘT mặt tường của phòng (cạnh i của đa giác), sàn → trần
      for (let i = 0; i < pts.length; i++) {
        if (chiCanh >= 0 && i !== chiCanh) continue;
        const a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * dt * lech, ny = dx / l * dt * lech;
        const A = [a[0] + nx, a[1] + ny], B = [b[0] + nx, b[1] + ny];
        pos.push(A[0], A[1], za, B[0], B[1], za, B[0], B[1], zb, A[0], A[1], za, B[0], B[1], zb, A[0], A[1], zb);
      }
      geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
    }
    /* LƯỚI VIÊN BẮT ĐẦU Ở GÓC PHÒNG (chủ nhà 2026-10-31 «tiles are size corrected»): vân lặp đúng `van_co` mét (lưới viên + mạch
       thật), mép viên đầu trùng góc phòng (sàn) / mặt sàn (tường) — không theo gốc nhà, kẻo viên 1200 bị cắt dở ở mép phòng. */
    if (s.vl_co_san) {
      uvMet(geo);
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      ganVan(mat, s, gocVung || (be === "san" ? [Math.min(...xs), Math.min(...ys)] : [0, geo.attributes.position.array.reduce((a, v, i) => (i % 3 === 2 ? Math.min(a, v) : a), Infinity)]));
    }
    mat.userData.vlPhongK = khoaPh(t, p.id, be);
    const m = new THREE.Mesh(geo, mat);
    m.position.z = vi; m.raycast = () => {}; m.renderOrder = 1;
    m.userData = { vlPhong: true, id: `vl-${khoaPh(t, p.id, be)}`, ten: `${BE[be] || tenBe(be, p)} ${p.ten}` };
    GOC.add(m); return m;
  }
  function datPhong(t, z, be, s) {                                   // s = null ⇒ về bản đã xác nhận / trống
    const k = khoaPh(t, z, be), p = phongCua(t, z); if (!p) return;
    if (!s) s = PH_XONG.get(k) || null;
    const cu = PH.get(k); if (cu) { GOC.remove(cu.mesh); cu.mesh.geometry.dispose(); cu.mesh.material.dispose(); PH.delete(k); }
    if (s) PH.set(k, { spec: s, mesh: dungPhong(t, p, be, s) });
    veLai(60);
  }

  /* ── đích đang sửa ── */
  // đồ dùng đặt trên / trong tủ (bếp: ấm, hũ, chai — `do_dung`) chung cụm với tủ nhưng KHÔNG đổi vật liệu theo tủ (chủ nhà
  // 3D 2026-11-01); chọn chính món đồ ấy thì chỉ món ấy đổi
  const luoiCua = (o) => {
    if (o.userData.do_dung) return [o].filter((x) => x.isMesh && !laKinh(x.material));
    const ds = o.userData.do_dac ? ctx.dsCua(ctx.khoaCua(o.userData.do_dac)) : (api.cum?.(o) || [o]);
    return ds.filter((x) => x.isMesh && PHAN.includes(x) && !x.userData.ma && !x.userData.do_dung && !laKinh(x.material));
  };
  function chonDs() {
    // bộ phận chọn trong «Chi tiết» (xem.js api.phanCT): chỉ bộ phận ấy — kể cả bộ phận nằm sau bộ phận khác (khung cổng sau ván)
    const pc = api.phanCT?.();
    if (pc) { const ds = pc.ds.filter((x) => x.isMesh && !laKinh(x.material)); if (ds.length) return { ds, ten: pc.ten, phanCT: true }; }
    const nhm = ctx.nhom(), v = ctx.vatChon();
    if (nhm.length) return { ds: nhm.flatMap((k) => ctx.dsCua(k)).filter((x) => x.isMesh && !laKinh(x.material)), ten: ctx.tenNhom(nhm) };
    if (v) { const ds = v.ds.filter((x) => x.isMesh && !laKinh(x.material)), tu = ds.filter((x) => !x.userData.do_dung);
      return { ds: tu.length ? tu : ds, ten: v.ten }; }
    const c = api.cacChon();
    if (c.length) return { ds: [...new Set(c.flatMap(luoiCua))], ten: api.tenCum(c[0]) };
    return { ds: [], ten: "" };
  }
  /* SÀN MỘT PHÒNG (chủ nhà 2026-10-31 «select each room's floor to decide to lay what type of tiles»): cụm «Sàn <phòng>» (mọi
     viên sàn của phòng, kể cả phương án công tắc «Sàn <phòng> — …») ⇒ đích là MẶT SÀN cả phòng: gạch chọn lát lại cả phòng đúng cỡ
     viên + mạch (lớp phủ), che lưới viên cũ — không tô vân lên từng viên cũ (mạch cũ sẽ lộ). */
  /* MỘT MẶT CỦA TƯỜNG SƠN (chủ nhà 2026-10-31: «wall of each room is different selection — we can select different wall on each
     side»): tường kết cấu là MỘT vật cho cả hai mặt (lớp sơn phủ đã gỡ theo 3D #151) ⇒ ở chế độ sửa, bấm tường thì đích «Vật liệu»
     là MẶT phía phòng vừa bấm: điểm bấm + pháp tuyến mặt trúng ⇒ phòng nằm phía ấy (đa giác thông thuỷ chứa điểm lùi 15 cm theo
     pháp tuyến) ⇒ cạnh đa giác song song mặt trúng, gần điểm bấm nhất. Vật liệu phủ đúng mặt ấy (lớp phủ phòng, khoá
     `phong:<tầng>:<phòng>:c<cạnh>`, sàn → trần); mặt đang chọn tô nhẹ màu nhấn. Mặt ngoài nhà (không phòng nào) ⇒ cả vật như cũ. */
  let BAM = null;                                                     // {x, y, ev} cú bấm cuối trên khung vẽ (chế độ sửa)
  canvas.addEventListener("pointerdown", (ev) => { if (api.cheDoSua?.() !== false && ev.button === 0) BAM = { x: ev.clientX, y: ev.clientY }; }, true);
  const laTuongKC = (o) => !!o && /^(t1|t2)$/.test(o.userData.linh_kien || "") && /— tường /.test(o.userData.ten || "");
  const trongDG = (x, y, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  function matTuong(c) {
    if (!BAM || !Object.keys(PHONG).length || !c.ds.length || !c.ds.every(laTuongKC)) return null;
    if (BAM.k && BAM.ds === c.ds[0]) return BAM.k;                     // đã tính cho cú bấm này
    const h = api.ban({ clientX: BAM.x, clientY: BAM.y });
    if (!h?.face || !c.ds.includes(h.object)) return null;
    const k = matTu(h); if (!k) return null;
    BAM.ds = c.ds[0];
    return (BAM.k = k);
  }
  function matTu(h) {                                                 // điểm trúng mặt tường ⇒ đích một mặt phía phòng, hay null (mặt ngoài nhà)
    const P = ctx.w2m(h.point.clone()), N = ctx.w2m(h.point.clone().add(h.face.normal.clone().transformDirection(h.object.matrixWorld))).sub(P);
    const L = Math.hypot(N.x, N.y); if (L < 0.7) return null;          // mặt trên / dưới tường
    const nx = N.x / L, ny = N.y / L;
    const t = Object.entries(PHONG).filter(([, T]) => T.san_mm / 1000 <= P.z + 0.05).sort((a, b) => b[1].san_mm - a[1].san_mm)[0]?.[0]; if (!t) return null;
    const qx = P.x + nx * 0.15, qy = P.y + ny * 0.15, p = PHONG[t].phong.find((r) => trongDG(qx, qy, r.polygon_m)); if (!p) return null;
    let tot = -1, kc = 0.35;
    p.polygon_m.forEach((a, i) => {
      const b = p.polygon_m[(i + 1) % p.polygon_m.length], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); if (l < 0.05) return;
      if (Math.abs((dx * ny - dy * nx) / l) < 0.9) return;              // cạnh không song song mặt trúng
      const u = Math.max(0, Math.min(1, ((P.x - a[0]) * dx + (P.y - a[1]) * dy) / (l * l))), d = Math.hypot(a[0] + dx * u - P.x, a[1] + dy * u - P.y);
      if (d < kc) { kc = d; tot = i; }
    });
    if (tot < 0) return null;
    const tenT = String(h.object.userData.ten).replace(/^.*— /, "");
    (p.canh_ten ||= [])[tot] = `${tenT} phía ${p.ten}`;
    return { loai: "phong", t, z: p.id, be: "c" + tot, ten: `Mặt ${tenT} — phía ${p.ten}` };
  }
  // mặt tường đang chọn: tô nhẹ màu nhấn (cả khi bảng «Vật liệu» đóng) — biết mình sắp đổi mặt nào
  let toMat = null, khoaTo = "";
  api.moiKhung(() => {
    const g = api.cheDoSua?.() !== false && TD.tab === "mon" ? (() => { const c = chonDs(); return c.ds.length ? matTuong(c) : null; })() : null;
    const k = g ? khoaPh(g.t, g.z, g.be) : "";
    if (k === khoaTo) return;
    khoaTo = k;
    if (toMat) { GOC.remove(toMat); toMat.geometry.dispose(); toMat.material.dispose(); toMat = null; }
    if (g) { toMat = dungPhong(g.t, phongCua(g.t, g.z), g.be, { hex: "#2563eb" }); toMat.material.transparent = true; toMat.material.opacity = 0.18; toMat.material.depthWrite = false; toMat.userData.vlPhong = false; toMat.userData.toMat = true; toMat.position.z += 0.002; }
    veLai(60);
  });
  function phongTuSan(ten) {
    const m = /^Sàn (.+?)(?: — .*)?$/.exec(ten || ""); if (!m) return null;
    for (const t of ["t1", "t2"]) { const p = PHONG[t]?.phong.find((r) => r.ten === m[1]); if (p) return { t, p }; }
    return null;
  }
  function dich() {
    if (TD.tab === "phong") return TD.phong ? { loai: "phong", t: TD.tang, z: TD.phong, be: TD.be, ten: `${tenBe(TD.be, phongCua(TD.tang, TD.phong))} — ${phongCua(TD.tang, TD.phong)?.ten}` } : null;
    const c = chonDs(); if (!c.ds.length) return null;
    if (c.phanCT) return { loai: "mon", ds: c.ds, ten: c.ten };          // bộ phận chọn trong «Chi tiết»: đúng bộ phận ấy
    const cumV = c.ds.find((o) => o.userData.cum)?.userData.cum || "", pv = TD.che !== "phan" && / — khoảng /.test(cumV) && phongTuSan(cumV);
    if (pv) return { loai: "phong", t: pv.t, z: pv.p.id, be: "vung-" + bam8(cumV), ten: `${c.ten} — lát lại cả khoảng`, tuSan: true };
    const ps = TD.che !== "phan" && phongTuSan(c.ten);
    if (ps) return { loai: "phong", t: ps.t, z: ps.p.id, be: "san", ten: `Sàn ${ps.p.ten} — lát lại cả phòng`, tuSan: true };
    const mt = TD.che !== "phan" && matTuong(c);
    if (mt) return mt;
    if (TD.che === "phan" && TD.phan && c.ds.includes(TD.phan)) return { loai: "mon", ds: [TD.phan], ten: `${c.ten} — phần «${TD.phan.userData.ten || TD.phan.name}»` };
    return { loai: "mon", ds: c.ds, ten: c.ten };
  }
  const chup = (g) => (g.loai === "mon" ? g.ds.map((o) => [o, DOI.get(o) || null]) : PH.get(khoaPh(g.t, g.z, g.be))?.spec || null);
  /* XEM NGAY KHI ĐỔI (chủ nhà 2026-10-31 «change its material, it should update instantly»): chế độ sửa tô trắng mọi thứ ngoài
     cụm đang chọn (xem.js XAM) — lớp phủ sàn / tường của phòng không thuộc cụm nên vừa lát xong đã bị tô trắng, chỉ hiện khi bỏ
     chọn. Lớp phủ của ĐÍCH đang sửa giữ màu thật (giuMau); lớp phủ khác vẫn trắng như phần còn lại. */
  function giuMauDich() {
    const g = bg.hidden ? null : dich(), k = g && g.loai === "phong" ? khoaPh(g.t, g.z, g.be) : null;
    /* …và thuộc MẶT NẠ CỤM CHỌN (lớp 3 = VIEN_CUM LOP trong xem.js): không có nó, các viên sàn cũ (đang chọn) nằm ngay dưới lớp
       phủ bị coi là «cụm chọn bị che» và hiệu ứng soi xuyên vẽ màu cũ đè lên gạch mới. */
    for (const [kk, r] of PH) {
      const v = kk === k;
      if (r.mesh.material.userData.giuMau !== v) { r.mesh.material.userData.giuMau = v; veLai(60); }
      if (v) r.mesh.layers.enable(3); else r.mesh.layers.disable(3);
    }
  }
  /* ĐI THEO SÀN (chủ nhà 3D 2026-11-01 «link this materials to the one chosen by the front yard's floor so they change at the
     same time»): vật mang `theo_san: "<tầng>:<phòng>"` (ốp mặt đứng bậc + len chân tường sân trước) đổi cùng lúc với sàn phòng ấy */
  const theoSan = (g) => (g.loai === "phong" && g.be === "san" ? PHAN.filter((o) => o.isMesh && o.userData.theo_san === `${g.t}:${g.z}`) : []);
  function ap(g, s) {
    if (g.loai === "mon") for (const o of g.ds) { apLuoi(o, s); CHUA.add(o); } else { datPhong(g.t, g.z, g.be, s); CHUA.add(khoaPh(g.t, g.z, g.be)); }
    for (const o of theoSan(g)) { apLuoi(o, s); CHUA.add(o); }
    giuMauDich(); veLai(60);
  }
  function lui(g, sn) {
    if (g.loai === "mon") for (const [o, s] of sn) apLuoi(o, s); else datPhong(g.t, g.z, g.be, sn);
    for (const o of theoSan(g)) apLuoi(o, g.loai === "phong" ? sn : null);
    veLai(60); ve();
  }

  /* ── nháp ── */
  const dieuBao = (s) => ctx.thongBao(s);
  function buoc(ten, f) {
    if (!nh || !ctx.nhap.ds().includes(nh)) nh = ctx.nhap.them({ ten: "Vật liệu: " + ten, loai: "vat_lieu", xacNhan, huy: huyNhap });
    else ctx.nhap.buoc(nh, "Vật liệu: " + ten, f);
  }
  function huyNhap() {
    // mọi đích đã chạm trong nháp — kể cả đích vừa «Gỡ» (đã rời DOI / PH): về bản ĐÃ xác nhận (Codex soát vòng 3)
    for (const x of [...CHUA]) {
      if (typeof x === "string") { const [t, z, b] = x.split(":"); datPhong(t, z, b, null); }
      else apLuoi(x, null);
    }
    CHUA.clear(); nh = null; ve();
  }
  const dsDoi = () => [...DOI].filter(([o, s]) => DA_XONG.get(o) !== s);
  const phDoi = () => [...PH].filter(([k, v]) => PH_XONG.get(k) !== v.spec);
  async function xacNhan() {
    const ghi = [], theoVat = new Map();
    for (const [o, s] of dsDoi()) {
      const u = o.userData, kv = u.do_dac ? ctx.khoaCua(u.do_dac) : (api.cum?.(o)?.[0]?.userData.id || u.id);
      if (!theoVat.has(kv)) theoVat.set(kv, { neo: o, ten: u.do_dac?.ten || api.tenCum(o), ps: [] });
      theoVat.get(kv).ps.push([o, s]);
    }
    const goiY = async (s) => {
      if (!s.thu) return `${s.ten}${s.ma ? ` (${s.ma})` : ""} ${s.hex}`;
      const g = await ctx.goiSua("vat_lieu", "gan_nhat", { hex: s.hex });
      return `màu thử ${s.hex} — ô vật liệu gần nhất: ${g.ok ? `${g.gan.ten} (${g.gan.ma}, ${g.gan.hex})` : "chưa tra được"}`;
    };
    for (const v of theoVat.values()) {
      const tat = new Set(v.ps.map(([, s]) => s.hex)).size === 1 && v.ps.length >= luoiCua(v.neo).length;
      const mo = tat ? await goiY(v.ps[0][1]) : (await Promise.all(v.ps.map(async ([o, s]) => `«${o.userData.ten || o.name}» → ${await goiY(s)}`))).join("; ");
      ghi.push({ neo: v.neo, chu: `[lựa chọn vật liệu] ${v.ten}: ${tat ? "cả vật → " : "từng phần: "}${mo}.` });
    }
    for (const [k, r] of phDoi()) {
      const [t, z, b] = k.split(":"), p = phongCua(t, z), neo = neoPhong(t, p);
      if (neo) ghi.push({ neo, chu: `[lựa chọn vật liệu] ${t === "t1" ? "Tầng 1" : "Tầng 2"} · ${p.ten}: ${tenBe(b, p).toLowerCase()} → ${await goiY(r.spec)}.` });
    }
    // «Gỡ» một lựa chọn ĐÃ xác nhận: về vật liệu hồ sơ — cũng phải lưu (Codex soát 2026-10-30)
    const goMon = [...DA_XONG.keys()].filter((o) => !DOI.has(o)), goPh = [...PH_XONG.keys()].filter((k) => !PH.has(k));
    const goVat = new Map();
    for (const o of goMon) { const u = o.userData, kv = u.do_dac ? ctx.khoaCua(u.do_dac) : (api.cum?.(o)?.[0]?.userData.id || u.id); if (!goVat.has(kv)) goVat.set(kv, { neo: o, ten: u.do_dac?.ten || api.tenCum(o) }); }
    for (const v of goVat.values()) ghi.push({ neo: v.neo, chu: `[lựa chọn vật liệu] ${v.ten}: gỡ màu đã chọn — về vật liệu hồ sơ.` });
    for (const k of goPh) { const [t, z, b] = k.split(":"), p = phongCua(t, z), neo = p && neoPhong(t, p); if (neo) ghi.push({ neo, chu: `[lựa chọn vật liệu] ${t === "t1" ? "Tầng 1" : "Tầng 2"} · ${p.ten}: ${tenBe(b, p).toLowerCase()} — gỡ lựa chọn, về hồ sơ.` }); }
    // LƯU BỀN (Codex soát: tải lại không được mất): ghi-chu/vat-lieu-chon.json — trình xem áp lại lúc mở; ghi chú để đưa vào dữ liệu nguồn
    const chon = {};
    for (const [o, s] of dsDoi()) chon["luoi:" + o.userData.id] = s;
    for (const o of goMon) chon["luoi:" + o.userData.id] = null;
    for (const [k, r] of phDoi()) chon["phong:" + k] = r.spec;
    for (const k of goPh) chon["phong:" + k] = null;
    const kq = await ctx.goiSua("vat_lieu", "ghi_chon", { chon });
    if (!kq.ok) return { ok: false, loi: ["lưu lựa chọn vật liệu: " + (kq.loi || []).join(" · ")] };
    // lựa chọn ĐÃ lưu bền ⇒ đã xác nhận, kể cả khi ghi chú hỏng (Codex soát vòng 2: không báo hỏng cho thứ đã lưu) — ghi chú hỏng chỉ cảnh báo
    let loiGc = "";
    if (!ctx.thietBi) try { for (const g of ghi) await api.ghiChu(g.neo, g.chu); } catch (e) { loiGc = e.message; }   // thiết bị: không có sổ ghi chú — lựa chọn chỉ lưu ở máy
    for (const o of goMon) DA_XONG.delete(o);
    for (const k of goPh) PH_XONG.delete(k);
    for (const [o, s] of DOI) DA_XONG.set(o, s);
    for (const [k, r] of PH) PH_XONG.set(k, r.spec);
    CHUA.clear(); nh = null;
    if (loiGc) return { ok: true, chu: `lựa chọn vật liệu đã lưu — ⚠ ghi chú chưa gửi được (${loiGc}), ghi lại tay ở «Ghi chú»` };
    return { ok: true, chu: ctx.thietBi ? "đã lưu lựa chọn vật liệu trên máy này" : `${ghi.length} ghi chú lựa chọn vật liệu` };
  }
  function neoPhong(t, p) {                                          // một lưới thật của tầng, chứa tâm phòng (neo ghi chú)
    const cx = p.polygon_m.reduce((a, q) => a + q[0], 0) / p.polygon_m.length, cy = p.polygon_m.reduce((a, q) => a + q[1], 0) / p.polygon_m.length;
    const n = t === "t1" ? 1 : 2, tien = `tang-${n}-`, b = new THREE.Box3(), c = new THREE.Vector3();
    let dung = null;
    for (const o of PHAN) {
      if (!o.isMesh || !o.userData.id?.startsWith(tien) || !/^Sàn/.test(o.userData.nhom || "")) continue;
      b.setFromObject(o); b.getCenter(c);
      const l = GOC.worldToLocal(b.min.clone()), h = GOC.worldToLocal(b.max.clone());
      const x0 = Math.min(l.x, h.x), x1 = Math.max(l.x, h.x), y0 = Math.min(l.y, h.y), y1 = Math.max(l.y, h.y);
      if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) return o;
      dung ||= o;
    }
    return dung || PHAN.find((o) => o.isMesh && o.userData.id?.startsWith(tien)) || null;
  }

  /* ── chỗ đứng: góc dưới-trái, CHỒNG LÊN TRÊN bảng «Kích thước & vị trí» khi bảng ấy hiện — không che vật đang sửa ở giữa khung ── */
  api.moiKhung(() => {
    if (bg.hidden) return;
    const bd = document.querySelector(".bd-bang"), cao = bd && !bd.hidden && bd.offsetParent ? bd.offsetHeight + 24 : 16;
    if (bg.style.bottom !== cao + "px") { bg.style.bottom = cao + "px"; bg.style.maxHeight = `calc(100% - ${cao + 76}px)`; }   // chừa thanh «Xác nhận» góc trên-trái
  });

  /* ── mở trang: áp lại các lựa chọn đã xác nhận (ghi-chu/vat-lieu-chon.json) ── */
  // ?nguyen=1 (mọi ảnh chụp cho trang việc — chup_*.mjs): KHÔNG áp lựa chọn thử trên máy, ảnh chỉ mang bản dựng từ nguồn
  window.XEM?.ready?.then(async () => {
    if (new URLSearchParams(location.search).has("nguyen")) return;
    const d = await ctx.goiSua("vat_lieu", "doc_chon");
    if (!d.ok || !d.chon) return;
    const theoId = new Map(PHAN.map((o) => [o.userData.id, o]));
    let coPhong = false;
    for (const [k, s] of Object.entries(d.chon)) {
      if (!s) continue;
      if (k.startsWith("luoi:")) { const o = theoId.get(k.slice(5)); if (o) { DA_XONG.set(o, s); apLuoi(o, s); } }
      else if (k.startsWith("phong:")) { PH_XONG.set(k.slice(6), s); coPhong = true; }
    }
    if (coPhong) { await nap(); for (const [k, s] of PH_XONG) { const [t, z, b] = k.split(":"); datPhong(t, z, b, s); } }
    DA_TAI = Object.keys(d.chon).length; veLai(60);
  });
  let DA_TAI = 0;

  /* ── áp một ô màu ── */
  function chon(s, ten) {
    const g = dich(); if (!g) { dieuBao(TD.tab === "phong" ? "Chọn phòng và sàn / tường trước." : "Chọn một vật trước."); return false; }
    const sn = chup(g); ap(g, s);
    buoc(`${g.ten} → ${ten || s.ten}`, () => lui(g, sn));
    ve(); return true;
  }

  /* ── giao diện ── */
  const st = document.createElement("style");
  st.textContent = `
  .vl-bang{position:absolute;left:16px;bottom:16px;z-index:44;width:min(304px,calc(100% - 32px));max-height:min(60%,440px);display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:12px;background:var(--vat-lieu,rgba(250,246,236,.92));backdrop-filter:blur(12px);box-shadow:0 6px 24px rgba(0,0,0,.2);font-size:13px;color:var(--ink,#1d1d1b)}
  .vl-bang[hidden]{display:none}
  .vl-dau{display:flex;gap:4px;align-items:center}.vl-dau .vl-tab{display:flex;gap:4px;flex:1}
  .vl-bang button{font:inherit;min-height:32px;border:0;border-radius:8px;background:#fff;cursor:pointer;padding:0 10px}
  .vl-bang button.on{background:var(--accent,#b8412c);color:#fff}
  .vl-dich{font-size:12px;opacity:.85;min-height:16px}
  .vl-hang{display:flex;gap:4px;flex-wrap:wrap}
  .vl-luoi{overflow-y:auto;overscroll-behavior:contain;min-height:60px}
  .vl-luoi h5{margin:0;padding:8px 4px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none;border-top:1px solid var(--line-soft,#0001)}
  .vl-luoi h5:first-child{border-top:0}
  .vl-luoi h5::before{content:"▸";font-size:10px;opacity:.6;transition:transform .15s}
  .vl-luoi h5[aria-expanded="true"]::before{transform:rotate(90deg)}
  .vl-luoi h5::after{content:attr(data-so);margin-left:auto;font-weight:400;font-size:11px;opacity:.55}
  .vl-luoi h5:hover{background:#0000000a;border-radius:6px}
  .vl-luoi .vl-o{padding:2px 4px 10px}
  .vl-luoi .vl-o[hidden]{display:none}
  .vl-o{display:flex;flex-wrap:wrap;gap:4px}
  .vl-o button.vl-sw{width:28px;min-height:28px;height:28px;padding:0;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25);border-radius:50%}
  .vl-o button.vl-sw.on{box-shadow:0 0 0 2px var(--accent,#b8412c)}
  .vl-o.vl-o-gach{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
  .vl-o.vl-o-gach button.vl-sw{width:auto;height:auto;aspect-ratio:1;border-radius:8px;display:flex;align-items:flex-end;overflow:hidden;border:0}
  .vl-o.vl-o-gach button.vl-sw span{width:100%;padding:2px 4px;background:rgba(255,253,248,.92);font-size:10.5px;line-height:1.2;text-align:left;max-height:2.5em;overflow:hidden}
  .vl-o.vl-o-gach button.vl-sw.on{box-shadow:0 0 0 3px var(--accent,#b8412c);color:var(--ink,#1d1d1b)}
  .vl-tc-nut{width:28px;height:28px;min-height:28px;padding:0;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25);cursor:pointer;
    background:conic-gradient(#e53935,#fdd835,#43a047,#00acc1,#3949ab,#d81b60,#e53935);position:relative}
  .vl-tc-nut::after{content:"+";position:absolute;inset:0;display:grid;place-items:center;color:#fff;font:700 15px/1 system-ui;text-shadow:0 0 3px #0008}
  .vl-tc-nut[aria-expanded="true"]{box-shadow:0 0 0 2px var(--accent,#b8412c)}
  .vl-banh{position:absolute;left:10px;right:10px;bottom:10px;z-index:3;display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:14px;background:#fffdf8;box-shadow:0 8px 28px #0004}
  .vl-banh[hidden]{display:none}
  .vl-banh .vl-tc-dau{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:600}
  .vl-banh .vl-tc-than{display:flex;gap:10px;align-items:center}
  .vl-banh canvas{width:132px;height:132px;border-radius:50%;cursor:crosshair;touch-action:none;flex:none}
  .vl-banh .vl-cot{display:flex;flex-direction:column;gap:6px;flex:1;min-width:0}
  .vl-banh .vl-cot label{font-size:11px;opacity:.7}
  .vl-banh .vl-xem{height:32px;border-radius:8px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)}
  .vl-p{display:flex;flex-direction:column;gap:2px;max-height:120px;overflow-y:auto}
  .vl-p .ph{display:flex;gap:4px;align-items:center}.vl-p .ph span{flex:1;font-size:12px}
  .vl-p .ph button{min-height:26px;font-size:12px}.vl-p .ph i{width:12px;height:12px;border-radius:3px;display:inline-block;box-shadow:0 0 0 1px rgba(0,0,0,.3)}
  .vl-hut{font-size:12px;opacity:.9}
  .vl-o button.vl-sw{position:relative}
  .vl-o .vl-xoa{position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;background:#fffd;font:600 13px/18px system-ui;font-style:normal;text-align:center;box-shadow:0 0 0 1px #0003;opacity:.75}
  .vl-o .vl-xoa:hover{opacity:1;background:#fff}
  .vl-them{position:absolute;inset:0;z-index:60;display:grid;place-items:center;background:#0005}
  .vl-them[hidden]{display:none}
  .vl-them .hop{width:min(760px,calc(100% - 24px));max-height:calc(100% - 24px);overflow:auto;display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:14px;background:#fffdf8;box-shadow:0 10px 40px #0006;font-size:13px;color:var(--ink,#1d1d1b)}
  .vl-them .dau{display:flex;justify-content:space-between;align-items:center;font-weight:600;font-size:14px}
  .vl-them button{font:inherit;min-height:32px;border:0;border-radius:8px;background:#efe9dc;cursor:pointer;padding:0 12px}
  .vl-them button.chinh{background:var(--accent,#b8412c);color:#fff}.vl-them button:disabled{opacity:.5;cursor:default}
  .vl-them .than{display:flex;gap:12px;flex-wrap:wrap}
  .vl-them .anh{flex:1 1 380px;min-width:260px;display:flex;flex-direction:column;gap:6px}
  .vl-them .tha{position:relative;border:2px dashed #0003;border-radius:10px;min-height:220px;display:grid;place-items:center;text-align:center;padding:8px;cursor:pointer;background:#f5f1e8}
  .vl-them .tha.keo{border-color:var(--accent,#b8412c);background:#fbeee9}
  .vl-them canvas{max-width:100%;touch-action:none;cursor:crosshair;display:block}
  .vl-them .cot{flex:1 1 240px;display:flex;flex-direction:column;gap:8px}
  .vl-them label{display:flex;flex-direction:column;gap:3px;font-size:12px}
  .vl-them label.ngang{flex-direction:row;align-items:center;gap:6px}
  .vl-them input,.vl-them select{font:inherit;min-height:30px;border:1px solid #ccc;border-radius:6px;padding:0 6px;box-sizing:border-box;background:#fff}
  .vl-them input[type=checkbox]{min-height:0}
  .vl-them .doi{display:flex;gap:6px}.vl-them .doi>*{flex:1}
  .vl-them .goi-y{font-size:11.5px;opacity:.7;line-height:1.35}
  .vl-them .chan{display:flex;gap:8px;justify-content:flex-end;align-items:center}
  .vl-them .trang-thai{flex:1;font-size:12px}`;
  document.head.append(st);
  const bg = document.createElement("div");
  bg.className = "vl-bang"; bg.hidden = true; bg.setAttribute("role", "dialog"); bg.setAttribute("aria-label", "Vật liệu và màu");
  bg.innerHTML = `<div class="vl-dau"><div class="vl-tab"><button type="button" data-tab="mon" class="on">Vật</button><button type="button" data-tab="phong">Phòng</button></div><button type="button" data-v="dong" aria-label="Đóng">×</button></div>
  <div class="vl-dich"></div>
  <div class="vl-hang vl-mon"><button type="button" data-che="ca" class="on">Cả vật</button><button type="button" data-che="phan">Một phần</button><button type="button" data-v="go" title="Gỡ màu thử của đích">Gỡ</button></div>
  <div class="vl-hang vl-ph" hidden><button type="button" data-tang="t1" class="on">Tầng 1</button><button type="button" data-tang="t2">Tầng 2</button><button type="button" data-be="san" class="on">Sàn</button><button type="button" data-be="tuong">Tường</button><button type="button" data-be="tuong_duoi">Tường dưới</button><button type="button" data-be="tuong_tren">Tường trên</button></div>
  <div class="vl-p" hidden></div>
  <div class="vl-luoi"></div>
  <div class="vl-banh" hidden role="dialog" aria-label="Màu tự chọn"><div class="vl-tc-dau"><span>Màu tự chọn — sơn trơn, không vân</span><button type="button" data-v="tc-dong" aria-label="Đóng màu tự chọn">×</button></div>
    <div class="vl-tc-than"><canvas width="96" height="96" aria-label="Bánh xe màu — sắc và độ đậm"></canvas><div class="vl-cot"><div class="vl-xem"></div>
    <label>Độ sáng<input type="range" class="vl-v" min="10" max="100" value="100" aria-label="Độ sáng"></label>
    <label>Mã màu<input class="vl-hex" value="#c8a07a" maxlength="7" aria-label="Mã màu" style="width:100%;min-height:30px;border:1px solid #ccc;border-radius:6px;padding:0 6px;box-sizing:border-box"></label>
    <span class="vl-ten" style="font-size:11px;opacity:.7">Kéo trên bánh xe để thử</span></div></div></div>
  <div class="vl-hang"><button type="button" data-v="hut-vl" title="Hút vật liệu (I)">Hút vật liệu</button><button type="button" data-v="hut-kt" title="Hút kích thước (Shift+I)">Hút cỡ</button><button type="button" data-v="them-anh" title="Thêm ảnh chụp vật liệu vào thư viện rồi áp lên 3D">＋ Thêm ảnh</button></div>
  <div class="vl-hut"></div>`;
  khung.append(bg);
  const $ = (s) => bg.querySelector(s);
  const luoi = $(".vl-luoi"), dichEl = $(".vl-dich"), hutEl = $(".vl-hut");

  /* THÊM ẢNH VÀO THƯ VIỆN (chủ nhà 2026-11-02 «add images into the material library and then use it as material to update
     the 3d view»): kéo-thả / chọn / dán ảnh → kéo 4 góc ôm mặt vật liệu (ảnh chụp xiên được nắn thẳng) → nhập cỡ thật →
     máy (them_vat_lieu.py) làm sạch ảnh, thêm mục `tu_them` vào data/thu-vien-gach.yaml, dựng vân. Xong thì bảng nạp lại;
     đang có đích (vật / sàn / tường) thì áp ngay. Ô tự thêm có nút × để gỡ (chỉ khi chưa dùng ở đâu). */
  const th = document.createElement("div");
  th.className = "vl-them"; th.hidden = true; th.setAttribute("role", "dialog"); th.setAttribute("aria-label", "Thêm ảnh vật liệu");
  th.innerHTML = `<div class="hop"><div class="dau"><span>Thêm ảnh vật liệu vào thư viện</span><button type="button" data-t="dong" aria-label="Đóng">×</button></div>
  <div class="than"><div class="anh"><div class="tha" tabindex="0"><span>Kéo ảnh vào đây, bấm để chọn tệp, hoặc dán (⌘V)</span><canvas hidden></canvas></div>
    <div class="goi-y">Kéo <b>4 chấm đỏ</b> vào 4 góc của mặt vật liệu (một viên, cả lưới viên, hay một mảng mặt liền) — ảnh chụp xiên sẽ được nắn thẳng. <button type="button" data-t="goc">Đặt lại góc</button></div>
    <input type="file" accept="image/*" hidden></div>
  <div class="cot"><label>Tên<input class="t-ten" placeholder="vd Gạch thẻ xanh rêu Mai Anh 7533F12" maxlength="120"></label>
    <label>Ảnh là<select class="t-kieu"><option value="vien">Một viên gạch / tấm</option><option value="luoi">Nhiều viên xếp lưới</option><option value="lien">Mặt liền, không mạch (gỗ, đá tấm, vải, giấy dán…)</option></select></label>
    <div class="doi t-luoi" hidden><label>Số cột<input type="number" class="t-cot" min="1" max="40" value="2"></label><label>Số hàng<input type="number" class="t-hang" min="1" max="40" value="2"></label></div>
    <div class="doi"><label><span class="t-nhan-r">Rộng một viên (mm)</span><input type="number" class="t-r" min="5" max="4000" value="300"></label><label><span class="t-nhan-c">Cao một viên (mm)</span><input type="number" class="t-c" min="5" max="4000" value="300"></label></div>
    <label>Bề mặt<select class="t-mat"><option value="bong">Bóng</option><option value="ban_bong" selected>Bán bóng / satin</option><option value="mo">Mờ</option><option value="nham">Nhám, chống trơn</option></select></label>
    <div class="t-mach-ca"><div class="doi"><label>Mạch (mm)<input type="number" class="t-mach" min="0.5" max="20" step="0.5" value="2"></label><label>Màu mạch<input type="color" class="t-mau-mach" value="#d4d2cc"></label></div>
    <label class="ngang"><input type="checkbox" class="t-sole"> Hàng sau lệch nửa viên (xây kiểu gạch)</label>
    <label class="ngang"><input type="checkbox" class="t-xoay"> Xoay ngẫu nhiên từng viên (vân không có hướng)</label></div>
    <label class="ngang"><input type="checkbox" class="t-loa"> Gỡ vệt loá đèn (men bóng)</label>
    <label>Nhóm<select class="t-nhom"></select></label>
    <div class="goi-y t-may" hidden>Trên trang này mẫu mới chỉ lưu ở <b>máy này</b> (trình duyệt) — máy khác không thấy.</div></div></div>
  <div class="chan"><span class="trang-thai" aria-live="polite"></span><button type="button" data-t="dong">Huỷ</button><button type="button" class="chinh" data-t="them" disabled>Thêm vào thư viện</button></div></div>`;
  khung.append(th);
  const T = (s) => th.querySelector(s), cvT = T("canvas"), cxT = cvT.getContext("2d");
  const TH = { im: null, goc: null, dang: false, keo: -1 };
  const macDinhGoc = () => [[0.04, 0.04], [0.96, 0.04], [0.96, 0.96], [0.04, 0.96]];
  function veThem() {
    const k = T(".t-kieu").value;
    T(".t-luoi").hidden = k !== "luoi"; T(".t-mach-ca").hidden = k === "lien";
    T(".t-nhan-r").textContent = k === "lien" ? "Bề ngang thật phần trong khung (mm)" : "Rộng một viên (mm)";
    T(".t-nhan-c").textContent = k === "lien" ? "Bề cao thật phần trong khung (mm)" : "Cao một viên (mm)";
    T("[data-t=them]").disabled = TH.dang || !TH.im || !T(".t-ten").value.trim();
    if (!TH.im) return;
    const W = cvT.width, H = cvT.height;
    cxT.clearRect(0, 0, W, H); cxT.drawImage(TH.im, 0, 0, W, H);
    const P = TH.goc.map(([x, y]) => [x * W, y * H]);
    cxT.fillStyle = "#0006"; cxT.beginPath(); cxT.rect(0, 0, W, H); cxT.moveTo(...P[0]); for (const p of [P[3], P[2], P[1]]) cxT.lineTo(...p); cxT.closePath(); cxT.fill("evenodd");
    cxT.strokeStyle = "#e53935"; cxT.lineWidth = 2; cxT.beginPath(); cxT.moveTo(...P[0]); for (const p of P.slice(1)) cxT.lineTo(...p); cxT.closePath(); cxT.stroke();
    if (k === "luoi") {                                               // đường chia viên trong khung — để canh lưới đúng mạch
      const nc = Math.max(1, +T(".t-cot").value || 1), nr = Math.max(1, +T(".t-hang").value || 1);
      const L = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      cxT.strokeStyle = "#ffeb3b"; cxT.lineWidth = 1; cxT.beginPath();
      for (let i = 1; i < nc; i++) { cxT.moveTo(...L(P[0], P[1], i / nc)); cxT.lineTo(...L(P[3], P[2], i / nc)); }
      for (let j = 1; j < nr; j++) { cxT.moveTo(...L(P[0], P[3], j / nr)); cxT.lineTo(...L(P[1], P[2], j / nr)); }
      cxT.stroke();
    }
    for (const p of P) { cxT.fillStyle = "#e53935"; cxT.beginPath(); cxT.arc(p[0], p[1], 7, 0, 7); cxT.fill(); cxT.strokeStyle = "#fff"; cxT.lineWidth = 2; cxT.stroke(); }
  }
  function napAnh(tep) {
    if (!tep || !/^image\//.test(tep.type)) { T(".trang-thai").textContent = "Không phải tệp ảnh."; return; }
    const url = URL.createObjectURL(tep), im = new Image();
    im.onload = () => {
      const k = Math.min(1, (ctx.thietBi ? 1600 : 3000) / Math.max(im.naturalWidth, im.naturalHeight));   // gửi tối đa 3000 px; iPhone 1600 (bộ nhớ — Codex soát)
      const c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      TH.im = c; TH.goc = macDinhGoc();
      const s = Math.min(1, 440 / c.width, 360 / c.height); cvT.width = Math.round(c.width * s); cvT.height = Math.round(c.height * s);
      cvT.hidden = false; T(".tha > span").hidden = true;
      if (!T(".t-ten").value) T(".t-ten").value = (tep.name || "").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 80);
      T(".trang-thai").textContent = ""; veThem();
    };
    im.onerror = () => { URL.revokeObjectURL(url); T(".trang-thai").textContent = "Không đọc được ảnh (HEIC? — xuất sang JPEG rồi thử lại)."; };
    im.src = url;
  }
  const diemT = (ev) => { const r = cvT.getBoundingClientRect(); return [(ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height]; };
  cvT.addEventListener("pointerdown", (ev) => {
    if (!TH.im) return; ev.stopPropagation(); const [x, y] = diemT(ev), r = cvT.getBoundingClientRect();
    let tot = -1, d0 = 1e9;
    TH.goc.forEach(([gx, gy], i) => { const d = Math.hypot((gx - x) * r.width, (gy - y) * r.height); if (d < d0) { d0 = d; tot = i; } });
    if (d0 < 28) { TH.keo = tot; cvT.setPointerCapture(ev.pointerId); }
  });
  cvT.addEventListener("pointermove", (ev) => { if (TH.keo < 0) return; const [x, y] = diemT(ev); TH.goc[TH.keo] = [Math.min(1.2, Math.max(-0.2, x)), Math.min(1.2, Math.max(-0.2, y))]; veThem(); });
  cvT.addEventListener("pointerup", () => { TH.keo = -1; });
  cvT.addEventListener("click", (ev) => ev.stopPropagation());
  const tha = T(".tha"), fi = T("input[type=file]");
  tha.addEventListener("click", () => { if (!TH.im) fi.click(); });
  tha.addEventListener("keydown", (ev) => { if ((ev.key === "Enter" || ev.key === " ") && !TH.im) { ev.preventDefault(); fi.click(); } });
  fi.addEventListener("change", () => napAnh(fi.files[0]));
  tha.addEventListener("dragover", (ev) => { ev.preventDefault(); tha.classList.add("keo"); });
  tha.addEventListener("dragleave", () => tha.classList.remove("keo"));
  tha.addEventListener("drop", (ev) => { ev.preventDefault(); tha.classList.remove("keo"); napAnh(ev.dataTransfer.files[0]); });
  th.addEventListener("paste", (ev) => { const f = [...(ev.clipboardData?.files || [])].find((x) => /^image\//.test(x.type)); if (f) { ev.preventDefault(); napAnh(f); } });
  addEventListener("paste", (ev) => { if (th.hidden) return; const f = [...(ev.clipboardData?.files || [])].find((x) => /^image\//.test(x.type)); if (f) { ev.preventDefault(); napAnh(f); } });
  for (const e of ["keydown", "keyup", "keypress"]) th.addEventListener(e, (ev) => { if (ev.key === "Escape" && e === "keydown" && !TH.dang) dongThem(); ev.stopPropagation(); });
  th.addEventListener("input", veThem); th.addEventListener("change", veThem);
  async function moThem() {
    th.hidden = false; T(".t-may").hidden = !ctx.thietBi; veThem();
    const sel = T(".t-nhom");
    if (!sel.options.length) {
      const r = await ctx.goiSua("vat_lieu", "nhom_thu_vien");
      for (const [k, n] of r.nhom || [["tu_them", "Vật liệu tự thêm (ảnh chụp)"]]) sel.append(new Option(n, k));
    }
    (TH.im ? T(".t-ten") : tha).focus();
  }
  function dongThem() { th.hidden = true; }
  function datLaiThem() { TH.im = null; TH.goc = null; cvT.hidden = true; T(".tha > span").hidden = false; T(".t-ten").value = ""; fi.value = ""; }
  th.addEventListener("click", async (ev) => {
    if (ev.target === th && !TH.dang) { dongThem(); return; }
    const b = ev.target.closest("button[data-t]"); if (!b) return;
    if (b.dataset.t === "dong" && !TH.dang) dongThem();
    else if (b.dataset.t === "goc" && TH.im) { TH.goc = macDinhGoc(); veThem(); }
    else if (b.dataset.t === "them") {
      const kieu = T(".t-kieu").value, tt = T(".trang-thai");
      const than = { ten: T(".t-ten").value.trim(), ...(ctx.thietBi ? { anh_canvas: TH.im } : { anh: TH.im.toDataURL("image/jpeg", 0.92) }), kieu, rong_mm: +T(".t-r").value, cao_mm: +T(".t-c").value,
        cot: +T(".t-cot").value, hang: +T(".t-hang").value, goc4: TH.goc, nhom: T(".t-nhom").value, be_mat: T(".t-mat").value,
        go_loa: T(".t-loa").checked, mach_mm: +T(".t-mach").value, mau_mach: T(".t-mau-mach").value, so_le: T(".t-sole").checked, xoay: T(".t-xoay").checked };
      TH.dang = true; veThem(); tt.textContent = ctx.thietBi ? "Đang làm sạch ảnh và dựng vân trên máy này… (vài giây)" : "Đang làm sạch ảnh và dựng vân… (10–60 giây)";
      const r = await ctx.goiSua("vat_lieu", "them_anh", than);
      TH.dang = false;
      if (!r.ok) { tt.textContent = "Không thêm được: " + (r.loi || []).join(" · "); veThem(); return; }
      tt.textContent = ""; datLaiThem(); dongThem();
      VAN.delete("tv_" + r.ma);
      tai = null; await nap();
      const o = BANG.find((x) => x.ma === "tv:" + r.ma);
      if (o) { TD.mo ||= new Set(); TD.mo.add(o.nhom); }
      ve();
      if (r.canh_bao) dieuBao("⚠ " + r.canh_bao);
      else if (o && dich()) { chon({ ma: o.ma, ten: o.ten, hex: o.hex, kim_loai: o.kim_loai, nham: o.nham, vl_co_san: o.vl_co_san, van_co: o.van_co }); dieuBao(`Đã thêm «${o.ten}» và áp thử — bấm Xác nhận để giữ.`); }
      else dieuBao(`Đã thêm «${o?.ten || r.ma}» vào nhóm «${o?.nhom || "Tự thêm"}» — chọn vật / sàn / tường rồi bấm ô để áp.`);
    }
  });
  async function xoaAnh(ma) {
    const o = BANG.find((x) => x.ma === "tv:" + ma);
    const k = o?.vl_co_san, dungNhap = [...DOI.values(), ...[...PH.values()].map((r) => r.spec)].some((sp) => sp?.vl_co_san === k);
    if (k && dungNhap) { dieuBao("Mẫu này đang áp thử (chưa xác nhận) — Huỷ hoặc đổi vật liệu khác trước khi gỡ."); return; }   // Codex soát
    if (!confirm(`Gỡ «${o?.ten || ma}» khỏi thư viện${o?.may_nay ? " của máy này" : ""}? (xoá ảnh + vân; chỉ gỡ được khi chưa dùng ở đâu)`)) return;
    const r = await ctx.goiSua("vat_lieu", "xoa_anh", { ma });
    if (!r.ok) { dieuBao("Không gỡ được: " + (r.loi || []).join(" · ")); return; }
    tai = null; await nap(); ve(); dieuBao(`Đã gỡ «${o?.ten || ma}».`);
  }

  /* SÀN / TƯỜNG (chủ nhà 2026-10-31 «select the floor and then choose to change materials (or type of tiles), simple paint
     (purely simple color)»): đích là một mặt (sàn, tường, ốp — hay ô «Phòng») ⇒ gạch có vân thật lên đầu thành lưới thẻ lớn,
     rồi «Sơn — đang dùng trong nhà» (chỉ sơn của thiết kế hiện tại, chủ nhà 2026-10-31; màu khác: nút tròn «Màu tự chọn» mở bảng
     bánh xe màu · độ sáng · mã hex), rồi vật liệu hồ sơ, kim loại / nẹp.
     LUÔN HIỆN MỌI VẬT LIỆU (chủ nhà 2026-10-31 «pick Vật liệu, we should show all materials here»): đích nào cũng đủ cả bảng —
     chỉ đổi THỨ TỰ (mặt: gạch → sơn → hồ sơ → còn lại; vật: sơn → hồ sơ → kim loại, vật liệu mô hình → gạch). */
  const laMat = (g) => !!g && (g.loai === "phong" || /^(Sàn|Tường|Ốp|Trần|Len)\b/i.test(g.ten));
  function ve() {
    const g = dich();
    dichEl.textContent = g ? `Đang sửa: ${g.ten}` : TD.tab === "phong" ? "Chọn phòng ở danh sách, rồi sàn hoặc tường." : "Chọn một vật (bấm vào nó) để đổi vật liệu.";
    for (const b of bg.querySelectorAll("[data-tab]")) b.classList.toggle("on", b.dataset.tab === TD.tab);
    for (const b of bg.querySelectorAll("[data-che]")) b.classList.toggle("on", b.dataset.che === TD.che);
    for (const b of bg.querySelectorAll("[data-tang]")) b.classList.toggle("on", b.dataset.tang === TD.tang);
    for (const b of bg.querySelectorAll("[data-be]")) b.classList.toggle("on", b.dataset.be === TD.be);
    $(".vl-mon").hidden = TD.tab !== "mon"; $(".vl-ph").hidden = $(".vl-p").hidden = TD.tab !== "phong";
    const sp = g ? (g.loai === "mon" ? DOI.get(g.ds[0]) : PH.get(khoaPh(g.t, g.z, g.be))?.spec) : null, cur = sp?.hex, curMa = sp?.ma;
    luoi.textContent = "";
    const mat = laMat(g), nhom = new Map();
    const hang = (m) => (/^Tự thêm/.test(m.nhom) ? -1 : /^Gạch/.test(m.nhom) ? 0 : /^Sơn/.test(m.nhom) ? 1 : m.nhom === "Vật liệu hồ sơ" ? 2 : 3);
    const thu = mat ? hang : (m) => (/^Tự thêm/.test(m.nhom) ? -1 : /^Gạch/.test(m.nhom) ? 3 : /^Sơn/.test(m.nhom) ? 0 : m.nhom === "Vật liệu hồ sơ" ? 1 : 2);   // vật: sơn (+ màu tự chọn) lên đầu; ảnh tự thêm luôn đầu
    const ds0 = [...BANG].map((m, i) => [m, i]).sort((a, b) => thu(a[0]) - thu(b[0]) || a[1] - b[1]).map(([m]) => m);
    for (const m of ds0) (nhom.get(m.nhom) || nhom.set(m.nhom, []).get(m.nhom)).push(m);
    /* DANH SÁCH NHÓM, KHÔNG Ô TÌM (chủ nhà 2026-10-31: «remove search box, use the list with groups of materials»): mỗi nhóm
       một dòng đầu bấm mở / gập (số món bên phải). Mặc định mở: nhóm chứa vật liệu đang dùng của đích, không có thì nhóm đầu
       (gạch cho mặt, sơn cho vật). Bấm mở / gập thì nhớ tới khi đổi đích. */
    const coCur = (m) => (m.vl_co_san ? m.ma === curMa : m.hex === cur);
    const khoaMo = (mat ? "mat" : "vat") + "|" + (g?.ten || "");
    if (TD.moKhoa !== khoaMo) { TD.moKhoa = khoaMo; TD.mo = new Set([...nhom].filter(([, ds]) => ds.some(coCur)).map(([t]) => t)); if (!TD.mo.size && nhom.size) TD.mo.add([...nhom.keys()][0]); }
    for (const [ten, ds] of nhom) {
      const lon = (mat && /^Gạch/.test(ten)) || /^Tự thêm/.test(ten), mo = TD.mo.has(ten);
      const h = document.createElement("h5"); h.textContent = ten; h.dataset.so = ds.length; h.dataset.nhom = ten;
      h.setAttribute("role", "button"); h.tabIndex = 0; h.setAttribute("aria-expanded", String(mo));
      const w = document.createElement("div"); w.className = "vl-o" + (lon ? " vl-o-gach" : ""); w.hidden = !mo;
      for (const m of ds) {
        const b = document.createElement("button"); b.type = "button"; b.className = "vl-sw" + ((m.vl_co_san ? m.ma === curMa : m.hex === cur) ? " on" : "");
        b.style.background = m.vl_co_san ? `url("${urlVan(m.vl_co_san, "mau")}") center / ${lon ? "cover" : "300%"} ${m.hex}` : m.hex;
        b.title = `${m.ten} (${m.ma.replace(/^(tv|son):/, "")})${m.suy_ra ? " — màu suy ra từ loại vật liệu" : ""}`; b.setAttribute("aria-label", m.ten); b.dataset.ma = m.ma;
        if (lon) { const c = document.createElement("span"); c.textContent = m.ten; b.append(c); }
        if (m.tu_them) { const x = document.createElement("i"); x.className = "vl-xoa"; x.dataset.xoa = m.ma.slice(3); x.title = "Gỡ ảnh tự thêm này khỏi thư viện"; x.textContent = "×"; b.append(x); }
        w.append(b);
      }
      if (/^Sơn/.test(ten)) {                                        // màu khác sơn của thiết kế: một nút tròn cuối nhóm sơn
        const t = document.createElement("button"); t.type = "button"; t.className = "vl-tc-nut"; t.dataset.v = "tc";
        t.title = "Màu tự chọn… (bánh xe màu, độ sáng, mã hex)"; t.setAttribute("aria-label", "Màu tự chọn");
        t.setAttribute("aria-haspopup", "dialog"); t.setAttribute("aria-expanded", String(!$(".vl-banh").hidden));
        w.append(t);
      }
      luoi.append(h, w);
    }
    if (TD.tab === "phong") {
      const p = $(".vl-p"); p.textContent = "";
      for (const r of PHONG[TD.tang]?.phong || []) {
        const d = document.createElement("div"); d.className = "ph";
        const o = (b) => { const sp = PH.get(khoaPh(TD.tang, r.id, b))?.spec; return `<i style="background:${sp ? (sp.vl_co_san ? `url(${urlVan(sp.vl_co_san, "mau")}) center / 300% ${sp.hex}` : sp.hex) : "transparent"}" title="${tenBe(b, r)}"></i>`; };
        d.innerHTML = `<span></span>${Object.keys(BE).map(o).join("")}<button type="button" data-ph="${r.id}" class="${TD.phong === r.id ? "on" : ""}">Chọn</button>`;
        d.firstChild.textContent = r.ten; p.append(d);
      }
    }
    hutEl.textContent = TD.chuanBi ? (TD.hut ? `Ống hút ${TD.chuanBi === "vl" ? "vật liệu" : "kích thước"}: đã hút «${TD.hut.ten}» — bấm vật cần áp (Esc thôi)` : `Ống hút ${TD.chuanBi === "vl" ? "vật liệu" : "kích thước"}: bấm vật mẫu`) : "";
    for (const b of bg.querySelectorAll("[data-v^=hut]")) b.classList.toggle("on", TD.chuanBi === b.dataset.v.slice(4));
  }
  function mo(bat = true, tab = null) {
    if (tab) TD.tab = tab;
    bg.hidden = !bat; if (bat) { nap().then(ve); ve(); }
    giuMauDich();
  }
  api.khiChon?.(() => setTimeout(giuMauDich, 0));                   // đổi chọn ⇒ lớp phủ nào giữ màu thật cũng đổi theo
  const nap = () => (tai ||= Promise.all([ctx.goiSua("vat_lieu", "bang_mau"), ctx.goiSua("vat_lieu", "phong_tang")]).then(([a, b]) => { BANG = a.mau || []; PHONG = b.tang || {}; }));

  const doiNhom = (h) => { const t = h.dataset.nhom; TD.mo.has(t) ? TD.mo.delete(t) : TD.mo.add(t); const mo = TD.mo.has(t); h.setAttribute("aria-expanded", String(mo)); h.nextElementSibling.hidden = !mo; };
  luoi.addEventListener("keydown", (ev) => { const h = ev.target.closest?.("h5[data-nhom]"); if (h && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); doiNhom(h); } });
  bg.addEventListener("click", (ev) => {
    const hn = ev.target.closest("h5[data-nhom]"); if (hn) { doiNhom(hn); return; }
    const xo = ev.target.closest("[data-xoa]"); if (xo) { ev.stopPropagation(); xoaAnh(xo.dataset.xoa); return; }
    const b = ev.target.closest("button"); if (!b) return;
    const d = b.dataset;
    if (d.v === "them-anh") { moThem(); return; }
    if (d.tab) { TD.tab = d.tab; ve(); }
    else if (d.che) { TD.che = d.che; if (d.che === "phan" && !TD.phan) dieuBao("Bấm vào một phần của vật để chọn phần cần đổi."); ve(); }
    else if (d.tang) { TD.tang = d.tang; TD.phong = null; ve(); }
    else if (d.be) { TD.be = d.be; ve(); }
    else if (d.ph) { TD.phong = d.ph; ve(); }
    else if (d.v === "tc" || d.v === "tc-dong") { const p = $(".vl-banh"); p.hidden = d.v === "tc-dong" || !p.hidden; for (const x of bg.querySelectorAll(".vl-tc-nut")) x.setAttribute("aria-expanded", String(!p.hidden)); }
    else if (d.ma) { const m = BANG.find((x) => x.ma === d.ma); if (m) chon({ ma: m.ma, ten: m.ten, hex: m.hex, kim_loai: m.kim_loai, nham: m.nham, ...(m.vl_co_san ? { vl_co_san: m.vl_co_san, van_co: m.van_co } : {}) }); }
    else if (d.v === "dong") mo(false);
    else if (d.v === "go") {
      const g = dich(); if (!g) return;
      const sn = chup(g);
      if (g.loai === "mon") for (const o of g.ds) { DOI.delete(o); const goc = GOC_VL.get(o); if (goc) { o.userData.vlGoc = goc; o.userData.vlHien = goc; o.material = goc; } CHUA.add(o); }
      else { const k = khoaPh(g.t, g.z, g.be), cu = PH.get(k); if (cu) { GOC.remove(cu.mesh); PH.delete(k); CHUA.add(k); } }
      buoc(`${g.ten} → hồ sơ`, () => lui(g, sn)); veLai(60); ve();
    }
    else if (d.v === "hut-vl") hut(TD.chuanBi === "vl" ? null : "vl");
    else if (d.v === "hut-kt") hut(TD.chuanBi === "kt" ? null : "kt");
  });

  /* bánh xe màu (F12) — trong bảng nổi «Màu tự chọn» (nút tròn cuối nhóm sơn): hue = góc, độ đậm = bán kính, độ sáng = thanh
     trượt (không có độ trong suốt — sơn luôn đặc). Kéo = xem thử trực tiếp; thả = một bước lùi. */
  const cv = $("canvas"), cx = cv.getContext("2d"), R = 48;
  function veBanh(v) {
    const im = cx.createImageData(96, 96);
    for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
      const dx = x - R + 0.5, dy = y - R + 0.5, r = Math.hypot(dx, dy), i = (y * 96 + x) * 4;
      if (r > R) { im.data[i + 3] = 0; continue; }
      const [rr, gg, bb] = hsv((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, r / R, v);
      im.data.set([rr, gg, bb, 255], i);
    }
    cx.putImageData(im, 0, 0);
  }
  function hsv(h, s, v) {
    const f = (n) => { const k = (n + h / 60) % 6; return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)))); };
    return [f(5), f(3), f(1)];
  }
  const hexTu = ([r, g, b]) => "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
  let THU = null;
  function thuMau(hex, chot) {
    const g = dich(); if (!g) { if (chot) dieuBao("Chọn đích (vật hoặc phòng) trước khi thử màu."); return; }
    if (!THU || THU.g.loai !== g.loai || (g.loai === "mon" && THU.g.ds[0] !== g.ds[0])) THU = { g, sn: chup(g) };
    const s = { hex, ten: `Màu thử ${hex}`, thu: true, kim_loai: 0, nham: 0.6 };
    ap(THU.g, s); $(".vl-hex").value = hex; $(".vl-ten").textContent = "Thử màu " + hex; $(".vl-xem").style.background = hex;
    if (chot) { const { g: gg, sn } = THU; THU = null; buoc(`${gg.ten} → màu thử ${hex}`, () => lui(gg, sn)); ve(); }
  }
  const tuBanh = (ev) => {
    const r = cv.getBoundingClientRect(), dx = ev.clientX - r.left - r.width / 2, dy = ev.clientY - r.top - r.height / 2, rr = Math.min(1, Math.hypot(dx, dy) / (r.width / 2));
    return hexTu(hsv((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, rr, +$(".vl-v").value / 100));
  };
  let keoBanh = false;
  cv.addEventListener("pointerdown", (ev) => { keoBanh = true; cv.setPointerCapture(ev.pointerId); thuMau(tuBanh(ev), false); });
  cv.addEventListener("pointermove", (ev) => { if (keoBanh) thuMau(tuBanh(ev), false); });
  cv.addEventListener("pointerup", (ev) => { if (keoBanh) { keoBanh = false; thuMau(tuBanh(ev), true); } });
  $(".vl-v").addEventListener("input", (ev) => { veBanh(ev.target.value / 100); const h = $(".vl-hex").value; if (/^#[0-9a-f]{6}$/i.test(h)) { /* giữ sắc, đổi sáng */ const n = parseInt(h.slice(1), 16), m = Math.max(n >> 16, (n >> 8) & 255, n & 255) || 1, k = (ev.target.value / 100 * 255) / m; thuMau(hexTu([n >> 16, (n >> 8) & 255, n & 255].map((x) => Math.min(255, Math.round(x * k)))), false); } });
  $(".vl-v").addEventListener("change", () => { const h = $(".vl-hex").value; if (/^#[0-9a-f]{6}$/i.test(h)) thuMau(h, true); });
  $(".vl-hex").addEventListener("change", (ev) => { const h = ev.target.value.trim(); if (/^#[0-9a-f]{6}$/i.test(h)) thuMau(h.toLowerCase(), true); else dieuBao("Mã màu dạng #rrggbb."); });
  veBanh(1);

  /* ── chọn MỘT phần: bấm lưới của vật đang chọn khi «Một phần» bật (hoặc giữ Alt) ── */
  let vien = null;
  function danhDau() {
    if (vien) { vien.parent?.remove(vien); vien = null; }
    if (!TD.phan || bg.hidden) { veLai(60); return; }
    const b = new THREE.Box3().setFromObject(TD.phan); vien = new THREE.Box3Helper(b, 0xffb300); vien.material.depthTest = false; vien.renderOrder = 999;
    (GOC.parent || GOC).add(vien); veLai(60);
  }
  addEventListener("pointerdown", (ev) => {
    if (ev.button > 0 || api.cheDoSua?.() === false || bg.hidden || TD.tab !== "mon" || !canvas.contains(ev.target) && ev.target !== canvas) return;
    if (TD.che !== "phan" && !ev.altKey) return;
    const c = chonDs(); if (!c.ds.length) return;
    // mọi bộ phận trúng tia, gần → xa (mỗi vật một lần). Bấm lại ĐÚNG chỗ cũ ⇒ phần NẰM SAU phần vừa chọn (khung cổng sau
    // ván, khung cửa sau kính…) — bộ phận bị che vẫn chọn được, không phải xoay camera
    const hs = []; for (const h of ctx.tia(ev).intersectObjects(c.ds.filter((o) => o.visible), false)) if (!hs.includes(h.object)) hs.push(h.object);
    if (!hs.length) return;
    ev.stopImmediatePropagation(); ev.preventDefault();
    const lai = BAM_PHAN && Math.hypot(ev.clientX - BAM_PHAN.x, ev.clientY - BAM_PHAN.y) < 8 && hs.includes(TD.phan);
    TD.phan = lai ? hs[(hs.indexOf(TD.phan) + 1) % hs.length] : hs[0];
    BAM_PHAN = { x: ev.clientX, y: ev.clientY };
    TD.che = "phan"; danhDau(); ve();
    if (hs.length > 1 && !lai) dieuBao(`Chọn «${TD.phan.userData.ten || TD.phan.name}» — bấm lại đúng chỗ để chọn phần nằm sau (${hs.length} phần).`);
  }, { capture: true });
  let BAM_PHAN = null;

  /* ── ống hút (F15) ── */
  function hut(kieu) {
    TD.chuanBi = kieu; TD.hut = null;
    canvas.style.cursor = kieu ? "crosshair" : ""; if (kieu) bg.hidden = false;
    if (kieu) dieuBao(kieu === "vl" ? "Ống hút vật liệu: bấm vật mẫu, rồi bấm vật cần áp." : "Ống hút kích thước: bấm món mẫu, rồi bấm món cần chỉnh cỡ.");
    ve();
  }
  async function bamHut(ev) {
    const ds = PHAN.filter((o) => o.isMesh && o.visible && !o.userData.ma);
    const h = ctx.tia(ev).intersectObjects(ds, false)[0]; if (!h) return;
    const o = h.object, u = o.userData;
    if (TD.chuanBi === "vl") {
      if (!TD.hut) { const s = specCua(o); TD.hut = { ten: s.ten, spec: s }; ve(); return; }
      const g = { loai: "mon", ds: TD.che === "phan" ? [o] : luoiCua(o), ten: u.do_dac?.ten || api.tenCum(o) };
      if (!g.ds.length) return;
      const sn = chup(g); ap(g, { ...TD.hut.spec, hoso: undefined });
      buoc(`${g.ten} ← ${TD.hut.ten}`, () => lui(g, sn)); ve();
    } else {
      if (!u.do_dac) { dieuBao("Ống hút kích thước chỉ dùng cho đồ đạc."); return; }
      const k = ctx.nhan(o);
      // cỡ THẬT từng chiều (mm) = cỡ mặt bằng × phóng đều × kéo riêng — hút rồi áp đủ rộng · sâu · cao (như ống hút cỡ của Paralives)
      const coCua = (n) => ({ w: n.w * (n.k ?? 1) * (n.kx ?? 1), d: n.d * (n.k ?? 1) * (n.ky ?? 1), h: (n.hD || 0) * 1000 * (n.k ?? 1) * (n.kz ?? 1) });
      if (!TD.hut) { const n = NAY.get(k); TD.hut = { ten: n.ten, k, co: coCua(n) }; ve(); return; }
      const n = NAY.get(k), c = TD.hut.co, f = n.k ?? 1;
      if (k === TD.hut.k) return;
      const kq = { kx: c.w / (n.w * f), ky: c.d / (n.d * f), kz: n.hD && c.h ? c.h / (n.hD * 1000 * f) : (n.kz ?? 1) };
      if (["kx", "ky", "kz"].every((t) => Math.abs(kq[t] - (n[t] ?? 1)) < 0.005)) return;
      ctx.datNhomKhoa([k]); ctx.batDauKeo("co");
      const e = ctx.dangKeo(); if (!e) return;
      for (const s of e.nay.values()) for (const t of ["kx", "ky", "kz"]) s[t] = Math.min(20, Math.max(0.05, +kq[t].toFixed(4)));
      ctx.apHet(e.nay); await ctx.luu();
      const m = NAY.get(k), cm = coCua(m);
      dieuBao(`Đã chỉnh «${n.ten}» thành ${Math.round(cm.w)} × ${Math.round(cm.d)} × ${Math.round(cm.h)} mm như «${TD.hut.ten}».`);
    }
  }
  addEventListener("pointerdown", (ev) => {
    if (!TD.chuanBi || ev.button > 0 || api.cheDoSua?.() === false || ev.target !== canvas) return;
    ev.stopImmediatePropagation(); ev.preventDefault(); bamHut(ev);
  }, { capture: true });

  /* ── phím: I ống hút vật liệu · Shift+I kích thước · H bảng · Esc thôi hút ── */
  ctx.phim((ev) => {
    if (api.cheDoSua?.() === false || ev.metaKey || ev.ctrlKey || ev.altKey) return false;
    const k = ev.key.toLowerCase();
    if (k === "i") { hut(ev.shiftKey ? (TD.chuanBi === "kt" ? null : "kt") : (TD.chuanBi === "vl" ? null : "vl")); return true; }
    if (k === "h") { mo(bg.hidden); return true; }
    if (k === "escape" && TD.chuanBi) { hut(null); return true; }
    return false;
  });
  ctx.nut({ v: "vat-lieu", chu: "🎨", title: "Vật liệu và màu (H)", khi: () => mo(bg.hidden || TD.tab !== "mon", "mon"), hien: () => true });

  /* chọn đổi ⇒ bỏ phần đã chọn; huỷ nháp do lõi gọi huyNhap. Theo dõi chữ ký chọn mỗi khung. */
  let ky = "";
  api.moiKhung(() => {
    const c = chonDs(), k = c.ds.map((o) => o.uuid).join(",") + (BAM ? `@${BAM.x},${BAM.y}` : "");   // bấm mặt kia của cùng bức tường ⇒ đích đổi
    if (k !== ky) { ky = k; if (TD.phan && !c.ds.includes(TD.phan)) { TD.phan = null; if (TD.che === "phan") TD.che = "ca"; danhDau(); } if (!bg.hidden) ve(); }
  });
  nap().then(() => ve());

  ctx.vatLieu = {                                                    // phép thử
    mo, dich: () => dich(), hut, matTu,
    trang: () => ({ doi: DOI.size, phong: [...PH.keys()], chua: CHUA.size, nhap: !!nh, tab: TD.tab, che: TD.che, phan: TD.phan?.userData.id || null, hut: TD.hut?.ten || null, chuanBi: TD.chuanBi, o: BANG.length }),
    mau: (o) => DOI.get(o)?.hex || null,
  };
}
