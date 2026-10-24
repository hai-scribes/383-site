/* BỐ CỤC TRÌNH XEM (chủ nhà 2026-10-10: «dọn, sắp lại, bỏ phần thừa») — dựng theo việc chủ nhà làm với công cụ:
     Cảnh       xem một phòng / một nhóm: bật tắt nhóm kết cấu, lớp, vật đã ẩn, bóc lớp, trình tự thi công
     Trạng thái chuyển thế cửa, rèm, ngăn kéo, thang… (công tắc chọn một)
     Phương án  so loại + màu vật liệu
     Phân tích  nhiệt · gió · mô phỏng (chỉ ở máy)
     Ghi chú    đọc ghi chú đã để lại
     Điện       công tắc + nhà thông minh (che_do_dien.js)
   Ô trái thành MỘT dải thẻ; ô «Tìm vật thể» luôn ở trên cùng. Mô-đun khác (nhiet.js, phan_tich_nha.js, khi3d.js…) chèn
   khối vào ô trái lúc chạy — khối nào chưa có `data-the` thì xếp theo lớp/mã ở bảng XEP dưới đây, khối lạ vào «Cảnh».
   Thẻ không có khối nào đang hiện thì ẩn. Thẻ đang mở nhớ ở localStorage (chỉ tiện cho người xem, mất cũng không sao).
   Thanh công cụ: các nút xếp theo nhóm việc; nút ít dùng (Nét viền, Chép liên kết, Kiểm tra) vào trình đơn «⋯». */

const THE = [
  ["canh", "Cảnh"], ["trang-thai", "Trạng thái"], ["pa", "Phương án"],
  ["phan-tich", "Phân tích"], ["ghi-chu", "Ghi chú"], ["dien", "Điện"],
];
const XEP = [
  [(s) => s.id === "khoi-pa", "pa"],
  [(s) => s.id === "khoi-trang-thai", "trang-thai"],
  [(s) => s.id === "khoi-dien", "dien"],
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
  const THU_TU = ["nut-them", "nut-do", "|", "nut-cat", "nut-cot", "|", "nut-mau-that", "nut-vat-lieu", "nut-mo-phong", "|", "nut-dien", "nut-them-cc"];
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

/* NÚT «HẠNG MỤC» TRÊN BẢN ĐĂNG (chủ nhà 2026-10-16: «mỗi nhà thầu chọn đúng phần mình quan tâm — bếp, kệ phòng làm
   việc…; tường nối trực tiếp với nó hiện trong suốt đi cùng để có ngữ cảnh»). Danh sách ở mo-hinh/hang-muc.json (giải từ
   data/hang-muc-3d.yaml lúc dựng site — tools/3d/hang_muc.py). Chọn một mục = một cảnh của kịch bản 3D (XEM.apTrangThai):
   chỉ hiện vật chính + kèm (ống chờ, điểm điện, đèn của nó) + nền (tường, cột, sàn kề nó); chính + kèm làm nổi, nền mờ;
   camera khung vừa phần làm nổi. «Cả nhà» về cảnh gốc. Ở máy (xem.py) nút giống hệt — máy chủ giải cùng luật trên bản dựng
   mới nhất; trong khung nhúng: không có nút. */
const MO_NEN = 0.2;          // độ đậm tường, cột, sàn nền — đủ thấy chỗ đứng, không che vật chính
function hangMucNoi() {
  const b = document.body;
  if (new URLSearchParams(location.search).has("nhung") && window.parent !== window) return;
  const thanh = document.querySelector(".thanh"), cc = thanh?.querySelector(".cong-cu");
  if (!cc) return;
  fetch("mo-hinh/hang-muc.json").then((r) => (r.ok ? r.json() : null)).then((d) => {
    const ds = d?.hang_muc || [];
    if (!ds.length) return;
    const nut = document.createElement("button");
    nut.type = "button"; nut.id = "nut-hang-muc";
    nut.innerHTML = '<span class="nhan-hm">Hạng mục</span><span class="dang-hm"></span>';
    nut.title = "Chọn một hạng mục, hoặc bấm ＋ để xem nhiều hạng mục cùng lúc";
    nut.setAttribute("aria-pressed", "false"); nut.setAttribute("aria-controls", "khoi-hang-muc");
    thanh.insertBefore(nut, cc);
    const khoi = document.createElement("section");
    khoi.id = "khoi-hang-muc"; khoi.setAttribute("aria-label", "Hạng mục");
    khoi.innerHTML = '<button type="button" class="tt-dong lop-dong" aria-label="Đóng ô hạng mục">✕</button><h2>Hạng mục</h2>'
      + '<p class="hm-goi-y">Chỉ còn phần đã chọn; tường, cột, sàn kề nó hiện mờ. Bấm ＋ để xem nhiều phần cùng lúc, ví dụ điện cùng Wi-Fi và nhà thông minh.</p><ul class="ds-hm"></ul>';
    b.append(khoi);
    const ul = khoi.querySelector(".ds-hm");
    let tap = [];                       // tập hạng mục đang xem: bấm dòng = chọn MỘT; bấm «＋» = thêm / bớt khỏi tập (hợp các vật)
    const muc = (m) => {
      const li = document.createElement("li");
      const bt = document.createElement("button");
      bt.type = "button"; bt.className = "hm-chon"; bt.dataset.ma = m ? m.ma : "";
      bt.innerHTML = "<strong></strong><span></span>";
      bt.firstChild.textContent = m ? m.ten : "Cả nhà";
      bt.lastChild.textContent = m ? m.mo_ta : "Về lại toàn bộ ngôi nhà.";
      bt.onclick = () => chon(m ? [m] : []);
      li.append(bt);
      if (m) {
        const them = document.createElement("button");
        them.type = "button"; them.className = "hm-them"; them.dataset.ma = m.ma; them.textContent = "＋";
        them.onclick = () => chon(tap.includes(m) ? tap.filter((x) => x !== m) : [...tap, m], true);
        li.append(them);
      }
      ul.append(li);
    };
    muc(null);
    for (const m of ds) muc(m);
    const mo = (bat) => {
      b.classList.toggle("mo-hang-muc", bat); nut.setAttribute("aria-pressed", String(bat || tap.length > 0));
    };
    const danh = () => {
      const ten = tap.map((x) => x.ten).join(" + ");
      for (const x of ul.querySelectorAll("button.hm-chon")) x.setAttribute("aria-current", String(x.dataset.ma ? tap.some((m) => m.ma === x.dataset.ma) : !tap.length));
      for (const x of ul.querySelectorAll("button.hm-them")) {
        const co = tap.some((m) => m.ma === x.dataset.ma), t = ds.find((m) => m.ma === x.dataset.ma)?.ten || "";
        x.setAttribute("aria-pressed", String(co));
        x.setAttribute("aria-label", co ? `Bớt «${t}» khỏi phần đang xem` : `Thêm «${t}» vào phần đang xem`);
        x.title = co ? "Bớt khỏi phần đang xem" : "Xem cùng với phần đang chọn";
      }
      nut.querySelector(".dang-hm").textContent = ten;
      nut.title = ten || "Chọn một hạng mục, hoặc bấm ＋ để xem nhiều hạng mục cùng lúc";
      nut.setAttribute("aria-label", tap.length ? `Hạng mục: ${ten} — chạm để đổi` : "Hạng mục");
      nut.classList.toggle("co-hm", tap.length > 0);
      nut.setAttribute("aria-pressed", String(b.classList.contains("mo-hang-muc") || tap.length > 0));
    };
    async function chon(ms, giuMo = false) {
      tap = ms; danh(); if (!giuMo) mo(false);
      const X = window.XEM;
      if (!X) return;
      await X.ready;
      if (!tap.length) { X.apTrangThai({}, { bay: 0.8 }); return; }
      const hop = (k) => [...new Set(tap.flatMap((m) => m[k]))];
      const noi = [...new Set([...hop("chinh"), ...hop("kem")])], nn = new Set(noi);
      const nen = hop("nen").filter((i) => !nn.has(i));
      const mot = tap.length === 1 ? tap[0] : null;      // một hạng mục: hướng nhìn + độ lùi riêng của nó; nhiều: khung vừa phần hợp lại
      const xa = tap.map((m) => m.xa).filter((x) => x != null);
      X.apTrangThai({ nhom: hop("nhom"), rieng: [...noi, ...nen], noi_bat: noi, mo: MO_NEN, huong: mot?.huong, xa: mot ? mot.xa : xa.length ? Math.max(...xa) : undefined,
        ...(tap.some((m) => m.danh_dau) ? { danh_dau: true } : {}) }, { bay: 0.8 });
    }
    danh();
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
