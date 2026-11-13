/* ĐÈN MINH HOẠ — bảng «Đèn» của trình xem 3D (chủ nhà 2026-11-01: «create a cheap light illustrations on 3d view so I can
   see which are where and what they do, how the light (color and intensity) and I can control them using switches»).

   Dữ liệu: mo-hinh/den-minh-hoa.json (tools/3d/den_minh_hoa.py — máy: xem.py đọc thẳng YAML; site: dong_goi_site.py).
     den       chỗ, lm, cct, góc chùm của mọi bộ đèn
     cong_tac  mọi phím tường / nút không dây có `dieu_khien` trỏ tới đèn, gom theo mặt công tắc
     canh      cảnh đèn của nhà thông minh (nha-thong-minh.yaml `muc_den`)

   RẺ: mỗi đèn đang bật = một nón sáng mờ cộng màu + một vũng sáng nơi chùm chạm (sàn / mặt bàn / tường), màu theo nhiệt độ
   màu, độ đậm theo độ rọi ước tính (cd / d²). «Trời tối» hạ nền + ánh sáng môi trường và bật thêm ≤ 8 đèn rọi thật của
   three.js cho các đèn sáng nhất (một lần biên dịch lại shader khi bật, không đổi số đèn sau đó). Trạng thái bật/tắt dùng
   chung với nút «Công tắc này điều khiển» của thẻ vật (xem.js batDen ⇄ sự kiện «den-doi»). */

const XEM_SAN = () => new Promise((ok) => { const t = () => (window.XEM?.den ? ok(window.XEM) : setTimeout(t, 200)); t(); });
const X = await XEM_SAN();
await X.ready;
const { THREE, scene, m2w } = X.den;
const DL = await fetch("mo-hinh/den-minh-hoa.json").then((r) => (r.ok ? r.json() : null)).catch(() => null);

if (DL && DL.den?.length) {
  const DEN = new Map(DL.den.map((d) => [d.id, d]));
  const MUC = new Map();                       // id → 1…100 (%) — đèn đang bật; không có = tắt
  let TOI = false, TANG = "t1", CANH = null;
  // đèn mái (hốc bồn E-M-06) hiện cùng tầng 2 — lên mái từ giếng tầng 2, bật theo đèn giếng
  const oTang = (t) => t === TANG || (TANG === "t2" && t === "mai");
  const LOP = new THREE.Group(); LOP.name = "Đèn minh hoạ"; LOP.renderOrder = 5; scene.add(LOP);
  const VE = new Map();                        // id → { g, non, vung, ... }

  /* ── MÀU THEO NHIỆT ĐỘ MÀU (xấp xỉ Tanner Helland, 1000–40000 K) ── */
  function mauK(k) {
    const t = k / 100; let r, g, b;
    r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332);
    g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755);
    b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
    const c = (v) => Math.min(255, Math.max(0, v)) / 255;
    return new THREE.Color().setRGB(c(r), c(g), c(b), THREE.SRGBColorSpace);
  }
  const hex = (k) => "#" + mauK(k).getHexString(THREE.SRGBColorSpace);

  /* ── ẢNH MỜ DẦN: dọc nón (đỉnh đậm → đáy nhạt) và vũng tròn (tâm đậm → mép 0) ── */
  function anh(ve) { const c = document.createElement("canvas"); c.width = c.height = 128; ve(c.getContext("2d")); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t; }
  const MO_NON = anh((g) => { const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, "#fff"); gr.addColorStop(0.75, "#555"); gr.addColorStop(1, "#000"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  const MO_VUNG = anh((g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "#fff"); gr.addColorStop(0.45, "#999"); gr.addColorStop(1, "#000"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });

  const V3 = (a) => new THREE.Vector3(...a);
  const huongDen = (d) => {                    // hướng chùm (mô hình, z lên)
    if (d.huong && Array.isArray(d.huong)) return V3(d.huong).normalize();
    if (d.phan_bo === "cay" || d.kieu === "DAY-HAT") return new THREE.Vector3(0, 0, 1);
    return new THREE.Vector3(0, 0, -1);
  };
  const zCham = (d) => {                       // cao độ mặt chùm chạm (m, mô hình)
    const s = d.z_san || 0;
    if (d.phan_bo === "tha" || d.phan_bo === "roi_ban") return s + 0.75;          // mặt bàn
    if (d.kieu === "DAY-VIEC") return s + 0.9;                                     // mặt bệ dưới tủ trên
    if (huongDen(d).z > 0) return s + (d.cao_tran || 2.8);                        // hắt trần
    return s;
  };
  function hinhHoc(d) {                        // điểm đầu, điểm chạm, bán kính vũng (m) — mô hình
    const p = V3(d.p), u = huongDen(d), zc = zCham(d);
    let L = Math.abs(u.z) > 0.2 ? (zc - p.z) / u.z : 1.2;
    if (!(L > 0.05)) L = 0.4;
    L = Math.min(L, 3.2);
    const nua = THREE.MathUtils.degToRad((d.chum || 120) / 2);
    const r = Math.min(1.5, Math.max(0.12, L * Math.tan(Math.min(nua, 1.15)) * 1.1));
    return { p, u, q: p.clone().addScaledVector(u, L), L, r, nua };
  }
  const cd = (d, muc) => {                     // cường độ trên trục (cd) ≈ lm / góc khối của chùm
    const nua = THREE.MathUtils.degToRad((d.chum || 120) / 2);
    const om = d.chum ? 2 * Math.PI * (1 - Math.cos(Math.min(nua, 1.5))) : 4 * Math.PI;
    return (d.lm || 0) * (muc / 100) / Math.max(om, 0.5);
  };

  function dung(d) {
    // đèn tường hắt lên–xuống (phan_bo «len_xuong», vd E-T2-105 đỉnh thang giếng): hai chùm ~70°, mỗi chùm nửa quang thông
    if (d.phan_bo === "len_xuong" && !d._nhanh) {
      const xuong = dung({ ...d, id: d.id + "#xuong", huong: [0, 0, -1], lm: (d.lm || 0) / 2, _nhanh: true });
      const len = dung({ ...d, id: d.id + "#len", huong: [0, 0, 1], lm: (d.lm || 0) / 2, _nhanh: true });
      VE.delete(xuong.id); VE.delete(len.id);
      const v = { ...xuong, phu: [len], d2: [{ ...d, lm: (d.lm || 0) / 2 }, { ...d, lm: (d.lm || 0) / 2 }] };
      VE.set(d.id, v);
      return v;
    }
    const h = hinhHoc(d), mau = mauK(d.cct || 3000);
    const g = new THREE.Group(); g.visible = false;
    const a = m2w(...h.p.toArray()), b = m2w(...h.q.toArray());
    const lenW = m2w(0, 0, 1).sub(m2w(0, 0, 0)).normalize();                       // «trên» của thế giới
    const vl = (map, o) => new THREE.MeshBasicMaterial({ color: mau, alphaMap: map, transparent: true, opacity: o, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    let non = null, vung;
    if (d.dai > 0) {                           // dải LED: vũng dài dọc trục + dải sáng
      const dai = d.dai + 2 * h.r * 0.6;
      vung = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), vl(MO_VUNG, 0.3));
      const ux = d.truc === "x" ? m2w(1, 0, 0).sub(m2w(0, 0, 0)).normalize() : m2w(0, 1, 0).sub(m2w(0, 0, 0)).normalize();
      const n = h.u.z < -0.5 || h.u.z > 0.5 ? lenW.clone() : m2w(...h.u.toArray()).sub(m2w(0, 0, 0)).normalize();
      const vy = new THREE.Vector3().crossVectors(n, ux).normalize();
      vung.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ux, vy, n));
      vung.scale.set(dai, h.r * 1.4, 1);
      vung.position.copy(b).addScaledVector(lenW, 0.006 * Math.sign(-h.u.z || 1));
    } else {
      const dir = b.clone().sub(a), len = dir.length();
      non = new THREE.Mesh(new THREE.ConeGeometry(h.r, len, 40, 1, true), vl(MO_NON, 0.1));
      non.position.copy(a).addScaledVector(dir, 0.5);
      non.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());   // đỉnh nón ở đèn
      g.add(non);
      vung = new THREE.Mesh(new THREE.CircleGeometry(h.r * 1.25, 48), vl(MO_VUNG, 0.4));
      vung.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize().negate());
      vung.position.copy(b).addScaledVector(dir.clone().normalize(), -0.006);
    }
    vung.renderOrder = 6; g.add(vung);
    LOP.add(g);
    const v = { id: d.id, g, non, vung, h, a, b, mau };
    VE.set(d.id, v);
    return v;
  }

  const dangHien = (id) => {                   // đèn có đang treo / đang hiện (công tắc «treo ở», lớp bị tắt)?
    const ds = X.den.matSang ? X.den.matSang(id) : [];
    return !ds.length || ds.some((m) => X.hienVat(m) !== false);
  };
  function capNhat() {
    for (const [id, d] of DEN) {
      const muc = MUC.get(id) || 0;
      let v = VE.get(id);
      const hien = muc > 0 && oTang(d.tang) && dangHien(id);
      if (!hien) { if (v) for (const x of [v, ...(v.phu || [])]) x.g.visible = false; continue; }
      if (!v) v = dung(d);
      for (const x of [v, ...(v.phu || [])]) {
        const E = cd(v.d2 ? v.d2[0] : d, muc) / Math.max(x.h.L * x.h.L, 0.15);        // lx ước tính tại vũng
        const k = Math.min(0.95, 0.12 + Math.sqrt(E / 300) * 0.5) * (TOI ? 1 : 0.55);
        x.vung.material.opacity = k;
        if (x.non) x.non.material.opacity = k * 0.22;
        x.g.visible = true;
      }
    }
    ganDenThat();
    X.den.veLai(200);
    veBang();
  }

  /* ── «TRỜI TỐI»: hạ môi trường, nền tối, ≤ 8 đèn rọi thật cho các đèn sáng nhất ── */
  const THAT = [];
  const GOC_MT = { env: scene.environmentIntensity, bg: scene.background };
  function ganDenThat() {
    if (!TOI) return;
    const ds = [...MUC].filter(([id, m]) => m > 0 && oTang(DEN.get(id)?.tang) && dangHien(id) && !(DEN.get(id).dai > 0))
      .map(([id, m]) => [DEN.get(id), m]).sort((x, y) => y[0].lm * y[1] - x[0].lm * x[1]).slice(0, THAT.length);
    THAT.forEach((l, i) => {
      const it = ds[i];
      if (!it) { l.intensity = 0; return; }
      const [d, m] = it, h = hinhHoc(d);
      l.color.copy(mauK(d.cct || 3000));
      l.intensity = cd(d, m) * 0.03;           // cd → đơn vị cảnh: 100 lx trên mặt sáng 0,8 ≈ 0,75 trên màn hình
      l.angle = Math.min(Math.PI / 2.2, h.nua * 1.25); l.penumbra = 0.7;
      l.position.copy(m2w(...h.p.toArray())); l.target.position.copy(m2w(...h.q.toArray()));
      l.target.updateMatrixWorld();
    });
  }
  function datToi(bat) {
    TOI = bat;
    if (bat) {
      if (!THAT.length) for (let i = 0; i < 8; i++) { const l = new THREE.SpotLight(0xffffff, 0, 0, 0.8, 0.7, 2); scene.add(l, l.target); THAT.push(l); }
      THAT.forEach((l) => { l.visible = true; });
      scene.environmentIntensity = 0.07; scene.background = new THREE.Color(0x14161b);
    } else {
      THAT.forEach((l) => { scene.remove(l, l.target); });
      THAT.length = 0;
      scene.environmentIntensity = GOC_MT.env; scene.background = GOC_MT.bg;
    }
    capNhat();
  }

  /* ── ĐỒNG BỘ VỚI THẺ VẬT (xem.js batDen) ── */
  let tuMinh = false;
  addEventListener("den-doi", (e) => {
    if (tuMinh) return;
    const { id, bat } = e.detail || {};
    if (!DEN.has(id)) return;
    if (bat) { if (!MUC.get(id)) MUC.set(id, 100); } else MUC.delete(id);
    capNhat();
  });
  function nhinTang() {                       // cắt ngang tầng đang xem ở sàn + 1,3 m (như chế độ sửa) và nhìn từ trên xuống
    const ds = DL.den.filter((d) => d.tang === TANG);
    X.catM("z", Math.min(...ds.map((d) => d.z_san || 0)) + 1.3, false);
    X.goc("tren");
    const vat = ds.map((d) => X.den.vatDiem(d.id)).filter(Boolean);
    if (vat.length) X.khung(vat);
  }
  function datMuc(ds, muc) {                  // ds: [id], muc: 0…100
    tuMinh = true;
    const bat = [], tat = [];
    for (const id of ds) { if (!DEN.has(id)) continue; if (muc > 0) { MUC.set(id, muc); bat.push(id); } else { MUC.delete(id); tat.push(id); } }
    if (bat.length) X.den.batNhieu(bat, true);
    if (tat.length) X.den.batNhieu(tat, false);
    tuMinh = false;
    capNhat();
  }

  /* ── BẢNG ── */
  const css = document.createElement("style");
  css.textContent = `
  #bang-den{position:fixed;right:12px;top:64px;bottom:12px;width:min(380px,calc(100vw - 24px));z-index:40;display:flex;flex-direction:column;
    background:var(--paper,#faf6ec);border:1px solid var(--line,#c9c2af);border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.18);font-size:var(--fs-small,.875rem)}
  #bang-den[hidden]{display:none}
  #bang-den header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--line-soft,#d8d2c0)}
  #bang-den header h2{flex:1;margin:0;font-size:var(--fs-body,1rem)}
  #bang-den .bd-than{overflow:auto;padding:4px 12px 12px}
  #bang-den .bd-hang{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
  #bang-den button{min-height:36px;padding:4px 10px;border:1px solid var(--line,#c9c2af);border-radius:18px;background:var(--paper,#faf6ec);cursor:pointer;font:inherit}
  #bang-den button[aria-pressed=true]{background:var(--ink,#1d1d1b);color:#fff;border-color:var(--ink,#1d1d1b)}
  #bang-den h3{margin:14px 0 4px;font-size:var(--fs-cap,.75rem);text-transform:uppercase;letter-spacing:.06em;color:var(--ink-soft,#4a4a46)}
  #bang-den .bd-mat{margin:6px 0 2px;color:var(--muted,#8a8780);font-size:var(--fs-cap,.75rem)}
  #bang-den .bd-phim{display:grid;grid-template-columns:44px 1fr;gap:2px 10px;align-items:center;padding:6px 0;border-top:1px solid var(--line-soft,#e4dfd2)}
  #bang-den .bd-nut{width:44px;height:44px;border-radius:50%!important;padding:0!important;font-size:18px}
  #bang-den .bd-ten{font-weight:600;cursor:pointer}
  #bang-den .bd-den{grid-column:2;display:flex;flex-wrap:wrap;gap:4px 10px;color:var(--ink-soft,#4a4a46);font-size:var(--fs-cap,.75rem)}
  #bang-den .bd-cham{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:-1px;box-shadow:0 0 0 1px rgba(0,0,0,.25)}
  #bang-den input[type=range]{grid-column:2;width:100%}
  #bang-den .bd-chu{color:var(--muted,#8a8780);font-size:var(--fs-cap,.75rem);line-height:1.45}
  #bang-den .bd-canh{flex-direction:column}
  #bang-den .bd-canh button{text-align:left;border-radius:8px;padding:6px 10px;width:100%}
  #bang-den .bd-canh small{display:block;color:var(--muted,#8a8780);font-size:var(--fs-micro,.6875rem);line-height:1.35}
  #bang-den .bd-canh button[aria-pressed=true] small{color:#ddd}
  `;
  document.head.append(css);
  const bang = document.createElement("section");
  bang.id = "bang-den"; bang.hidden = true; bang.setAttribute("aria-label", "Đèn và công tắc");
  bang.innerHTML = `<header><h2>Đèn · công tắc</h2><button type="button" class="bd-dong" aria-label="Đóng bảng đèn">✕</button></header><div class="bd-than"></div>`;
  document.body.append(bang);
  const than = bang.querySelector(".bd-than");
  bang.querySelector(".bd-dong").onclick = () => mo(false);

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const nutBat = (nhan, bat, bam, cls = "") => { const b = el("button", cls, nhan); b.type = "button"; b.setAttribute("aria-pressed", String(bat)); b.onclick = bam; return b; };
  const tenNgan = (d) => d.ten.replace(/^Đèn /, "").replace(/^đèn /, "");
  const chipDen = (id) => {
    const d = DEN.get(id); const s = el("span");
    const c = el("i", "bd-cham"); c.style.background = hex(d.cct || 3000); s.append(c);
    s.append(`${tenNgan(d)} · ${d.lm} lm · ${d.cct}K${MUC.get(id) && MUC.get(id) < 100 ? ` · ${MUC.get(id)} %` : ""}`);
    return s;
  };
  const bayToi = (ma) => { const id = X.den.vatDiem(ma); if (id) { X.chon(id); X.khung([id]); } };

  function veBang() {
    if (bang.hidden) return;
    const cuon = than.scrollTop;
    than.replaceChildren();
    const h1 = el("div", "bd-hang");
    h1.append(nutBat("Tầng 1", TANG === "t1", () => { TANG = "t1"; capNhat(); }), nutBat("Tầng 2", TANG === "t2", () => { TANG = "t2"; capNhat(); }),
      nutBat("☾ Trời tối", TOI, () => datToi(!TOI)), nutBat("Nhìn từ trên", false, () => nhinTang()),
      nutBat("Tắt hết", false, () => { CANH = null; datMuc([...MUC.keys()], 0); }));
    than.append(h1);
    than.append(el("p", "bd-chu", "Màu vùng sáng = nhiệt độ màu của đèn (hổ phách 2200K → trắng ấm 2700–3000K → trắng 4000K); độ đậm = độ rọi ước tính nơi chùm chạm. Bấm tên phím để bay tới công tắc."));

    if (DL.canh.length) {
      than.append(el("h3", null, "Cảnh"));
      const hc = el("div", "bd-hang bd-canh");
      for (const c of DL.canh) {
        const b = nutBat(c.ten.replace(/^Nút cảnh «(.+)»/, "$1"), CANH === c.ma, () => {
          CANH = c.ma;
          for (const [id, m] of Object.entries(c.den)) datMuc([id], m);
          const t = Object.keys(c.den).map((i) => DEN.get(i)?.tang).find(Boolean); if (t && t !== TANG) { TANG = t; capNhat(); }
        });
        const tom = Object.entries(c.den).filter(([, m]) => m > 0).length, tat = Object.values(c.den).filter((m) => !m).length;
        b.append(el("small", null, `${tom} đèn sáng${tat ? ` · tắt ${tat}` : ""}${c.chot ? "" : " · đề xuất"}${c.khi ? " — " + c.khi : ""}`));
        hc.append(b);
      }
      than.append(hc);
    }

    const phim = DL.cong_tac.filter((c) => c.tang === TANG || c.den.some((i) => oTang(DEN.get(i)?.tang)));
    const phong = [...new Set(phim.map((c) => c.phong))];
    for (const ph of phong) {
      than.append(el("h3", null, ph));
      let mat = null;
      for (const c of phim.filter((x) => x.phong === ph)) {
        if (c.mat !== mat) { mat = c.mat; if (c.cho) than.append(el("div", "bd-mat", (c.loai === "nut_khong_day" ? "Nút không dây · " : "") + c.cho)); }
        const bat = c.den.some((i) => MUC.get(i) > 0);
        const r = el("div", "bd-phim");
        r.append(nutBat(bat ? "●" : "○", bat, () => datMuc(c.den, bat ? 0 : (c.giam_sang ? (MUC.get(c.den[0]) || 100) : 100)), "bd-nut"));
        const t = el("span", "bd-ten", c.phim); t.title = "Bay tới công tắc"; t.onclick = () => bayToi(c.id); r.append(t);
        const dd = el("div", "bd-den"); for (const i of c.den) dd.append(chipDen(i)); r.append(dd);
        if (c.giam_sang) {
          const s = el("input"); s.type = "range"; s.min = 5; s.max = 100; s.step = 5; s.value = Math.max(...c.den.map((i) => MUC.get(i) || 0)) || 100;
          s.setAttribute("aria-label", "Độ sáng " + c.phim);
          s.oninput = () => datMuc(c.den, +s.value);
          r.append(s);
        }
        than.append(r);
      }
    }
    const coPhim = new Set(DL.cong_tac.flatMap((c) => c.den));
    const rieng = DL.den.filter((d) => oTang(d.tang) && !coPhim.has(d.id));
    if (rieng.length) {
      than.append(el("h3", null, "Không qua công tắc tường"));
      than.append(el("p", "bd-chu", "Đèn cắm ổ, đèn có công tắc trên thân / dây, đèn đêm pin, dải LED chạy theo cảm biến."));
      for (const d of rieng) {
        const bat = MUC.get(d.id) > 0;
        const r = el("div", "bd-phim");
        r.append(nutBat(bat ? "●" : "○", bat, () => datMuc([d.id], bat ? 0 : 100), "bd-nut"));
        const t = el("span", "bd-ten", d.phong); t.onclick = () => bayToi(d.id); r.append(t);
        const dd = el("div", "bd-den"); dd.append(chipDen(d.id)); r.append(dd);
        than.append(r);
      }
    }
    than.scrollTop = cuon;
  }

  /* ── NÚT «Đèn» trên thanh công cụ ── */
  const nut = document.createElement("button");
  nut.type = "button"; nut.id = "nut-den"; nut.textContent = "Đèn"; nut.title = "Bảng đèn · công tắc · cảnh — bật đèn để thấy chùm sáng";
  nut.setAttribute("aria-pressed", "false"); nut.setAttribute("aria-controls", "bang-den");
  function mo(bat) { bang.hidden = !bat; nut.setAttribute("aria-pressed", String(bat)); LOP.visible = true; if (bat) veBang(); }
  nut.onclick = () => mo(bang.hidden);
  (document.querySelector(".thanh .cong-cu") || document.querySelector(".thanh") || document.body).append(nut);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !bang.hidden) mo(false); });
  // công tắc «… · treo ở» đổi (có chuyển động, xong sau vài trăm ms) ⇒ vũng sáng theo chỗ đang treo: soát nhẹ đèn có `cho_treo`
  const CHO_TREO = DL.den.filter((d) => d.cho_treo).map((d) => d.id);
  let dauTreo = "";
  setInterval(() => {
    if (!CHO_TREO.some((i) => MUC.get(i) > 0)) return;
    const k = CHO_TREO.map((i) => (dangHien(i) ? 1 : 0)).join("");
    if (k !== dauTreo) { dauTreo = k; capNhat(); }
  }, 400);

  window.DEN_MINH_HOA = { mo, datMuc, datToi, nhinTang, tang: (t) => { TANG = t; capNhat(); }, muc: () => Object.fromEntries(MUC),
    hien: () => [...VE].filter(([, v]) => v.g.visible).map(([id, v]) => ({ id, vung: +v.vung.material.opacity.toFixed(2) })) };
}
