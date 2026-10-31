/* BỐ CỤC TRÌNH XEM (chủ nhà 2026-10-10: «dọn, sắp lại, bỏ phần thừa») — dựng theo việc chủ nhà làm với công cụ:
     Cảnh       xem một phòng / một nhóm: bật tắt nhóm kết cấu, lớp, vật đã ẩn, bóc lớp, trình tự thi công
     Trạng thái chuyển thế cửa, rèm, ngăn kéo, thang… (công tắc chọn một)
     Phương án  so loại + màu vật liệu
     Phân tích  nhiệt · gió · mô phỏng (chỉ ở máy)
     Ghi chú    đọc ghi chú đã để lại
   Ô trái thành MỘT dải thẻ; ô «Tìm vật thể» luôn ở trên cùng. Mô-đun khác (nhiet.js, phan_tich_nha.js, khi3d.js…) chèn
   khối vào ô trái lúc chạy — khối nào chưa có `data-the` thì xếp theo lớp/mã ở bảng XEP dưới đây, khối lạ vào «Cảnh».
   Thẻ không có khối nào đang hiện thì ẩn. Thẻ đang mở nhớ ở localStorage (chỉ tiện cho người xem, mất cũng không sao).
   Thanh công cụ: các nút xếp theo nhóm việc; nút ít dùng (Nét viền, Chép liên kết, Kiểm tra) vào trình đơn «⋯». */

const THE = [
  ["canh", "Cảnh"], ["trang-thai", "Trạng thái"], ["pa", "Phương án"],
  ["phan-tich", "Phân tích"], ["ghi-chu", "Ghi chú"],
];
const XEP = [
  [(s) => s.id === "khoi-pa", "pa"],
  [(s) => s.id === "khoi-trang-thai", "trang-thai"],
  [(s) => !!s.querySelector("#ds-gc"), "ghi-chu"],
  [(s) => /\b(nhiet|nhiet-mai|phan-tich|khi3d|k3)\b/.test(s.className) || /^(Nhiệt|Phân tích|Dòng khí)/.test(s.querySelector("h2")?.textContent || ""), "phan-tich"],
];
const nho = (k, v) => { try { if (v === undefined) return localStorage.getItem(k) || ""; localStorage.setItem(k, v); } catch { return ""; } };

export function batDau() {
  const ben = document.getElementById("ben-trai");
  if (!ben) return null;
  const tim = ben.querySelector("section");                 // «Tìm vật thể» — luôn hiện
  tim.dataset.the = "*";
  tim.classList.add("khoi-tim");
  const dai = document.createElement("nav");
  dai.className = "dai-the";
  dai.setAttribute("role", "tablist");
  dai.setAttribute("aria-label", "Ô trái");
  const nut = new Map();
  for (const [ma, ten] of THE) {
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("role", "tab"); b.dataset.the = ma;
    b.innerHTML = `<span></span><span class="dem-the"></span>`;
    b.firstChild.textContent = ten;
    b.onclick = () => moThe(ma);
    dai.append(b); nut.set(ma, b);
  }
  tim.after(dai);
  let dang = nho("xem-the") || "canh";

  const xep = (s) => { if (!s.dataset.the) s.dataset.the = (XEP.find(([f]) => f(s)) || [null, "canh"])[1]; };
  function capNhat() {
    const co = new Set();
    for (const s of ben.querySelectorAll(":scope > section")) {
      xep(s);
      const rong = s.id === "khoi-trang-thai" && s.querySelector("#ds-chon-mot")?.hidden;
      if (s.dataset.the !== "*" && !s.hidden && !rong) co.add(s.dataset.the);
    }
    for (const [ma, b] of nut) b.hidden = !co.has(ma);
    if (!co.has(dang)) dang = co.has("canh") ? "canh" : [...co][0] || "canh";
    for (const s of ben.querySelectorAll(":scope > section")) s.classList.toggle("ngoai-the", s.dataset.the !== "*" && s.dataset.the !== dang);
    for (const [ma, b] of nut) b.setAttribute("aria-selected", String(ma === dang));
    const gc = document.getElementById("dem-gc");             // số ghi chú đang mở trên thẻ «Ghi chú»
    const so = gc ? (gc.textContent.match(/\d+/) || [""])[0] : "";
    nut.get("ghi-chu").lastChild.textContent = so && so !== "0" ? so : "";
  }
  function moThe(ma) {
    dang = ma; nho("xem-the", ma);
    capNhat();
    ben.scrollTop = 0;
  }
  let hen = 0;
  new MutationObserver(() => { cancelAnimationFrame(hen); hen = requestAnimationFrame(capNhat); })
    .observe(ben, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"], characterData: true });
  capNhat();

  /* ── thanh công cụ: nhóm theo việc + trình đơn «⋯» ── */
  const cc = document.querySelector('.thanh [aria-label="Công cụ"]');
  const THU_TU = ["nut-sua-3d", "|", "nut-them", "nut-do", "|", "nut-cat", "|", "nut-mo-phong", "|", "nut-them-cc"];
  const VAO_MENU = ["nut-vien", "nut-chep", "nut-kiem"];
  const them = document.createElement("button");
  them.id = "nut-them-cc"; them.type = "button"; them.textContent = "⋯";
  them.title = "Công cụ khác: nét viền, chép liên kết, kiểm tra";
  them.setAttribute("aria-haspopup", "menu");
  const menu = taoMenu(them, "menu-cc", (b) => b.id !== "nut-vien");
  function sapThanh() {
    if (!cc) return;
    for (const id of VAO_MENU) { const b = document.getElementById(id); if (b && b.parentElement !== menu) { b.setAttribute("role", "menuitem"); menu.append(b); } }
    const co = [];
    for (const id of THU_TU) {
      if (id === "|") { co.push("|"); continue; }
      const b = id === "nut-them-cc" ? them : document.getElementById(id);
      if (b && (b === them || !b.hidden)) co.push(b);
    }
    for (const b of [...cc.children]) if (!co.includes(b) && !b.classList.contains("vach")) co.splice(co.length - 1, 0, b);   // nút lạ: trước «⋯»
    const ra = [];
    for (const x of co) if (x !== "|" || (ra.length && ra[ra.length - 1] !== "|")) ra.push(x);
    if (ra[ra.length - 1] === "|") ra.pop();
    const hien = ra.map((x) => (x === "|" ? Object.assign(document.createElement("span"), { className: "vach", ariaHidden: "true" }) : x));
    const cuChuoi = [...cc.children].map((x) => x.id || x.className).join(",");
    if (cuChuoi !== hien.map((x) => x.id || x.className).join(",")) cc.replaceChildren(...hien);
  }
  new MutationObserver(() => sapThanh()).observe(cc, { childList: true, subtree: false, attributes: true, attributeFilter: ["hidden"] });
  sapThanh();
  gocNhin();
  gocVong();
  catGon();
  hangMucNoi();
  formGon();
  const api = { moThe, capNhat: () => { capNhat(); sapThanh(); } };
  window.BO_CUC = api;
  return api;
}


/* Trình đơn bật ra dưới một nút (dùng cho «⋯» và «▾» góc nhìn): vị trí cố định, bấm ra ngoài thì đóng;
   bấm một mục thì đóng, trừ mục `giu(b)` trả false (công tắc như Nét viền — để thấy dấu ✓ đổi). */
function taoMenu(nut, lop, dong = () => true, len = false) {   // len: bật LÊN trên nút (nút nằm ở đáy màn hình)
  const menu = document.createElement("div");
  menu.className = "menu-them " + lop; menu.hidden = true; menu.setAttribute("role", "menu");
  menu.style.position = "fixed"; menu.style.zIndex = "60";
  document.body.append(menu);
  nut.setAttribute("aria-haspopup", "menu");
  nut.addEventListener("click", (e) => {
    e.stopPropagation();
    const r = nut.getBoundingClientRect();
    if (len) { menu.style.top = "auto"; menu.style.bottom = `${innerHeight - r.top + 6}px`; }
    else { menu.style.bottom = "auto"; menu.style.top = `${r.bottom + 4}px`; }
    if (r.left + 240 > innerWidth) { menu.style.left = "auto"; menu.style.right = `${Math.max(8, innerWidth - r.right)}px`; }
    else { menu.style.right = "auto"; menu.style.left = `${Math.max(8, r.left)}px`; }
    menu.hidden = !menu.hidden;
    nut.setAttribute("aria-expanded", String(!menu.hidden));
  });
  addEventListener("click", (e) => { if (!menu.contains(e.target) && !nut.contains(e.target)) { menu.hidden = true; nut.setAttribute("aria-expanded", "false"); } });
  menu.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b && dong(b)) setTimeout(() => { menu.hidden = true; nut.setAttribute("aria-expanded", "false"); }, 0); });
  return menu;
}

/* GÓC NHÌN (chủ nhà 2026-10-10: sáu nút trùng la bàn + phím 0/1/3/7): giữ ba góc hay dùng — Trục đo · Mặt tiền · Trên —
   trên điều khiển phân đoạn; Tây Nam, Đông Bắc, Sau vào «▾». Nút giữ nguyên `data-goc` (xem.js gắn sự kiện, phép thử bấm);
   góc đang chọn nằm trong «▾» thì nút «▾» mang tên nó và sáng. */
function gocNhin() {
  const nhom = document.querySelector('.thanh [aria-label="Góc nhìn"]');
  if (!nhom) return;
  const VAO = ["tay-nam", "dong-bac", "sau"];
  const ds = VAO.map((g) => nhom.querySelector(`[data-goc="${g}"]`)).filter(Boolean);
  if (!ds.length) return;
  const nut = document.createElement("button");
  nut.type = "button"; nut.className = "nut-goc-khac"; nut.title = "Góc nhìn khác: Tây Nam, Đông Bắc, Sau";
  nut.setAttribute("aria-label", "Góc nhìn khác");
  const menu = taoMenu(nut, "menu-goc");
  for (const b of ds) { b.setAttribute("role", "menuitem"); menu.append(b); }
  nhom.append(nut);
  const dat = () => {
    const dang = ds.find((b) => b.getAttribute("aria-pressed") === "true");
    nut.textContent = (dang ? dang.textContent : "Khác") + " ▾";
    nut.setAttribute("aria-pressed", String(!!dang));
  };
  new MutationObserver(dat).observe(menu, { subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
  dat();
}

/* MỘT NÚT XOAY VÒNG GÓC NHÌN (chủ nhà 2026-10-16: «thanh đầu chỉ một dòng») — bản đăng trên điện thoại: thay điều khiển
   phân đoạn + «▾» bằng MỘT nút mang tên góc đang xem; mỗi lần chạm sang góc kế tiếp, đi vòng quanh nhà rồi nhìn xuống.
   Nút gốc `data-goc` vẫn nằm nguyên (xem.js gắn sự kiện, phép thử bấm) — nút vòng chỉ bấm hộ. Hiện/ẩn do xem.css. */
function gocVong() {
  const nhom = document.querySelector('.thanh [aria-label="Góc nhìn"]');
  if (!nhom) return;
  const VONG = ["truc-do", "truoc", "tay-nam", "sau", "dong-bac", "tren"];
  const ds = () => VONG.map((g) => document.querySelector(`[data-goc="${g}"]`)).filter(Boolean);
  const nut = document.createElement("button");
  nut.type = "button"; nut.className = "nut-vong nut-goc-vong";
  nut.title = "Góc nhìn — chạm để sang góc kế tiếp: Trục đo · Mặt tiền · Tây Nam · Sau · Đông Bắc · Trên";
  let cuoi = -1;
  const dat = () => {
    const d = ds(), i = d.findIndex((b) => b.getAttribute("aria-pressed") === "true");
    if (i >= 0) cuoi = i;
    nut.textContent = i >= 0 ? d[i].textContent : "Góc nhìn";
    nut.setAttribute("aria-label", `Góc nhìn: ${nut.textContent} — chạm để đổi`);
  };
  nut.onclick = (e) => { e.stopPropagation(); const d = ds(); if (d.length) d[(cuoi + 1) % d.length].click(); };
  nhom.prepend(nut);
  for (const b of ds()) new MutationObserver(dat).observe(b, { attributes: true, attributeFilter: ["aria-pressed"] });
  dat();
}

/* Ô MẶT CẮT MỘT DÒNG (chủ nhà 2026-10-16: «bảng dưới chiếm nhiều chỗ») — [hướng cắt ↻] [thanh kéo] [số] [⋯]:
   ba nút Dọc nhà · Ngang nhà · Bằng gộp thành MỘT nút, mỗi lần chạm đổi hướng; «Đảo phía» và các mặt cắt sẵn vào trình đơn
   «⋯» bật lên trên. Nút gốc `data-truc` + ô `#cat-dao` vẫn nằm trong ô (ẩn) — xem.js, khi3d.js đọc và gắn sự kiện trên chúng;
   `#cat-san` dời nguyên khối (giữ id) vào trình đơn. Khung nhúng (?nhung=1) giữ kiểu riêng của nó, không gộp. */
function catGon() {
  const bang = document.getElementById("bang-cat");
  if (!bang || (new URLSearchParams(location.search).has("nhung") && window.parent !== window)) return;
  const truc = [...bang.querySelectorAll("[data-truc]")];
  const dao = document.getElementById("cat-dao");
  if (!truc.length || !dao) return;
  bang.classList.add("gon");

  const vong = document.createElement("button");
  vong.type = "button"; vong.className = "nut-vong nut-cat-vong";
  vong.title = "Hướng cắt — chạm để đổi: Dọc nhà · Ngang nhà · Bằng";
  const datVong = () => {
    const b = truc.find((x) => x.getAttribute("aria-pressed") === "true");
    vong.textContent = b ? b.textContent : "Hướng cắt";
    vong.setAttribute("aria-label", `Hướng cắt: ${vong.textContent} — chạm để đổi`);
  };
  vong.onclick = () => {
    const i = truc.findIndex((x) => x.getAttribute("aria-pressed") === "true");
    truc[(i + 1) % truc.length].click();
  };
  for (const b of truc) new MutationObserver(datVong).observe(b, { attributes: true, attributeFilter: ["aria-pressed"] });
  bang.prepend(vong);
  datVong();

  const them = document.createElement("button");
  them.type = "button"; them.id = "nut-cat-them"; them.textContent = "⋯";
  them.title = "Đảo phía giữ lại · mặt cắt sẵn";
  them.setAttribute("aria-label", "Thêm: đảo phía, mặt cắt sẵn");
  const menu = taoMenu(them, "menu-cat", () => true, true);
  const nutDao = document.createElement("button");
  nutDao.type = "button"; nutDao.className = "nut-dao"; nutDao.setAttribute("role", "menuitemcheckbox");
  nutDao.textContent = "Đảo phía";
  nutDao.title = "Giữ phần bên kia mặt cắt";
  const datDao = () => { nutDao.setAttribute("aria-pressed", String(dao.checked)); nutDao.setAttribute("aria-checked", String(dao.checked)); };
  nutDao.onclick = () => { dao.checked = !dao.checked; dao.dispatchEvent(new Event("change", { bubbles: true })); datDao(); };
  them.addEventListener("click", datDao);           // xem.js tự chọn phía mà không phát sự kiện — đọc lại mỗi lần mở
  dao.addEventListener("change", datDao);
  menu.append(nutDao);
  const san = document.getElementById("cat-san");
  if (san) menu.append(san);
  bang.append(them);
  datDao();
}

/* NÚT «HẠNG MỤC» = DANH SÁCH TRANG CON (chủ nhà 2026-10-24: «when we pick an agenda, it opens a child page instead, and we
   use those child pages instead of the current agenda»). Mỗi dòng là một trang việc 3D (data/viec-3d.yaml); bấm là MỞ trang
   ấy — ở đó mỗi mục hiện kiểu hạng mục: vật làm nổi đặc, tường / cột / sàn kề nó mờ (tools/3d/nen_3d.py). Danh sách đọc từ
   viec.json cạnh trình xem (site: 3d/viec.json; máy: xem.py /viec.json, trỏ sang trang việc của dev server). Trong khung nhúng
   (chính trang việc) không có nút. */
function hangMucNoi() {
  const b = document.body;
  if (new URLSearchParams(location.search).has("nhung") && window.parent !== window) return;
  const thanh = document.querySelector(".thanh"), cc = thanh?.querySelector(".cong-cu");
  if (!cc) return;
  fetch("viec.json").then((r) => (r.ok ? r.json() : null)).then((d) => {
    const ds = (d?.viec || []).filter((v) => v.id && v.ten && !v.an_hang_muc);   // an_hang_muc: chủ nhà bỏ khỏi danh sách
    if (!ds.length) return;
    const trang = d.trang || "../viec.html";
    const nut = document.createElement("button");
    nut.type = "button"; nut.id = "nut-hang-muc";
    nut.innerHTML = '<span class="nhan-hm">Hạng mục</span>';
    nut.title = "Chọn một hạng mục để mở trang của nó";
    nut.setAttribute("aria-pressed", "false"); nut.setAttribute("aria-controls", "khoi-hang-muc");
    thanh.insertBefore(nut, cc);
    const khoi = document.createElement("section");
    khoi.id = "khoi-hang-muc"; khoi.setAttribute("aria-label", "Hạng mục");
    khoi.innerHTML = '<button type="button" class="tt-dong lop-dong" aria-label="Đóng ô hạng mục">✕</button><h2>Hạng mục</h2><ul class="ds-hm"></ul>';
    b.append(khoi);
    const ul = khoi.querySelector(".ds-hm");
    let nhom = null;
    for (const v of ds) {
      if (v.nhom_viec && v.nhom_viec !== nhom) {                 // đầu nhóm phụ thuộc (data/viec-3d.yaml nhom_viec)
        nhom = v.nhom_viec;
        const h = document.createElement("li");
        h.className = "hm-nhom"; h.textContent = nhom;
        h.style.cssText = "margin:12px 8px 2px;font-size:var(--fs-data);font-weight:600;color:var(--ink-soft)";
        ul.append(h);
      }
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.className = "hm-chon"; a.href = `${trang}#${v.id}`;
      a.innerHTML = "<strong></strong><span></span>";
      a.firstChild.textContent = v.ten;
      a.lastChild.textContent = v.phu_de || String(v.mo_dau || "").split(/(?<=\.)\s/)[0] || "";   // phụ đề trang, không có thì câu đầu phần mở đầu
      li.append(a); ul.append(li);
    }
    const mo = (bat) => { b.classList.toggle("mo-hang-muc", bat); nut.setAttribute("aria-pressed", String(bat)); };
    nut.onclick = () => mo(!b.classList.contains("mo-hang-muc"));
    khoi.querySelector(".lop-dong").onclick = () => mo(false);
    addEventListener("keydown", (e) => { if (e.key === "Escape") mo(false); });
  }).catch(() => {});
}

/* Ô GHI CHÚ bên phải (chủ nhà 2026-10-10: «ô ghi chú to luôn chiếm chỗ»): lúc rảnh chỉ còn tiêu đề + một ô chữ một dòng;
   chạm vào ô (hoặc đang có chữ / đang sửa / có vật chú thích / có vùng khoanh / có lỗi) thì mở đủ: khoanh vùng, tên, nút lưu. */
function formGon() {
  const f = document.getElementById("form-gc");
  if (!f) return;
  const ta = document.getElementById("gc-noi-dung");
  const co = (id) => { const e = document.getElementById(id); return e && !e.hidden; };
  const chu = (id) => (document.getElementById(id)?.textContent || "").trim();
  const dat = () => {
    const mo = f.contains(document.activeElement) || !!ta.value.trim() || co("khoi-nhap") || co("gc-huy-sua") || co("gc-loi") || !!chu("vung-kq")
      || document.getElementById("nut-vung")?.getAttribute("aria-pressed") === "true";
    f.classList.toggle("gon", !mo);
  };
  f.addEventListener("focusin", dat);
  f.addEventListener("focusout", () => setTimeout(dat, 120));
  f.addEventListener("input", dat);
  new MutationObserver(dat).observe(f, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["hidden", "aria-pressed"] });
  dat();
}
