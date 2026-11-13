/* Mô-đun chế độ sửa «khung_sua» — xem dat_do.js «MỞ RỘNG CHẾ ĐỘ SỬA».
   BỐ CỤC CHẾ ĐỘ SỬA (chủ nhà 2026-10-31 «our current UI is not good … look at the game's UI to analyze and adopt what's good»,
   phân tích ở thu_sua/SO_SANH_GIAO_DIEN.md): bật «Sửa» là đổi hẳn màn hình —
   · khung 3D tràn màn hình: ô trái (nhóm · lớp · ghi chú), ghim ghi chú, thẻ vật bên phải và nút xem-thôi trên thanh đều ẩn;
   · KHAY TRÁI: cột thẻ có hình (Tìm · Đồ đạc · Vật liệu · Tường · Kho · Thay đổi), mỗi lúc mở một bảng, bảng đứng sát cột;
     thư viện là lưới thẻ có hình — ảnh chụp từ món cùng loại đang có trong nhà, chưa có thì vẽ dấu chân rộng × sâu;
   · THANH ĐÁY: một thanh duy nhất cho vật đang chọn — tên + số đo · nút theo nhóm (xoay · cỡ · đổi · xếp) · Huỷ / Xác nhận;
   · BẢNG PHÍM góc phải dưới: chỉ những phím dùng được LÚC NÀY (chưa chọn · đang chọn · đang kéo), gập được;
   · THANH TRÊN: chọn tầng (cắt bằng ngang tầng như nhà búp bê) · lùi / làm lại · lưới / bám;
   · cột phải: bảng số đo (bien_doi) và bảng tường (tuong) xếp chồng, không đè nhau.
   Chỉ dời chỗ phần tử của mô-đun khác (giữ nguyên lớp / mã) — phép thử cũ vẫn bấm đúng nút. Tắt «Sửa» ⇒ trả mọi thứ về chỗ cũ. */
export function batDau(ctx) {
  const { THREE, api, khung } = ctx;
  const $ = (s, g = document) => g.querySelector(s);
  const body = document.body;
  const sua = () => api.cheDoSua?.() !== false && body.classList.contains("che-do-sua");

  const st = document.createElement("style");
  st.textContent = `
body.che-do-sua:not(.chi-xem):not(.nhung):not(.chup) .app { grid-template-columns: minmax(0, 1fr); grid-template-areas: "thanh" "khung"; }
body.che-do-sua:not(.chi-xem):not(.nhung) #ben-trai, body.che-do-sua #nut-gon-trai, body.che-do-sua #lop-ghim,
body.che-do-sua .huong-dan, body.che-do-sua .huong-dan-xem { display: none !important; }
/* MẶT CẮT trong chế độ sửa (chủ nhà 2026-10-31): bảng cắt của chế độ xem nằm dưới thanh trên, nút «Mặt cắt» trên thanh trên bật / tắt */
body.che-do-sua #bang-cat:not([hidden]) { position: absolute; top: 72px; left: 50%; transform: translateX(-50%); z-index: 45; }
body.che-do-sua:not(.ks-chi-tiet) #ben-phai { display: none !important; }
body.che-do-sua .thanh .cong-cu > :not(#nut-sua-3d):not(#nut-do) { display: none !important; }
.ks-khay, .ks-day, .ks-phim, .ks-tren, .ks-phai { display: none; }
/* thiết bị (bản đăng, iPhone — web/sua/thiet_bi.js): chỉ đổi vật liệu ⇒ thanh đáy chỉ giữ «Vật liệu» · «Phương án» · «Chi tiết»; bảng phím ẩn */
body.thiet-bi .dd-nc-nut > button:not([data-v="vat-lieu"]):not([data-v="phuong-an"]):not([data-v="chi-tiet"]) { display: none !important; }
body.thiet-bi.che-do-sua .ks-phim { display: none; }
/* bản đăng (chi-xem): thẻ nổi «vật đang chọn» của chế độ xem không được hiện chồng thanh đáy của chế độ sửa */
body.che-do-sua.chi-xem.co-chon:not(.ks-chi-tiet):not(.nhung) #ben-phai { display: none !important; }
body.che-do-sua .ks-khay, body.che-do-sua .ks-tren, body.che-do-sua .ks-phai { display: flex; }
body.che-do-sua .ks-day { display: flex; }
body.che-do-sua .ks-phim { display: block; }

/* khay trái: cột thẻ */
.ks-khay { position: absolute; left: 12px; top: 12px; z-index: 46; flex-direction: column; gap: 6px; padding: 6px; border-radius: 16px;
  background: rgba(29,29,27,.86); backdrop-filter: blur(12px); box-shadow: 0 6px 24px rgba(0,0,0,.22); }
.ks-khay > button[hidden] { display: none; }
.ks-khay > button { width: 60px; min-height: 58px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  padding: 6px 2px; border: 0; border-radius: 12px; background: transparent; color: #f3efe6; font: 600 11px/1.15 var(--font-sans); cursor: pointer; }
.ks-khay > button svg { width: 24px; height: 24px; stroke: currentColor; fill: none; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.ks-khay > button:hover { background: rgba(255,255,255,.12); }
.ks-khay > button[aria-pressed="true"] { background: var(--accent); color: #fff; }
.ks-khay > button:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }
/* bảng của thẻ: đứng sát cột, chừa thanh đáy */
body.che-do-sua .sv-tv, body.che-do-sua .vl-bang, body.che-do-sua .qt-bang, .ks-tim {
  left: 88px !important; right: auto !important; top: 12px !important; bottom: auto !important;
  width: 360px !important; max-height: calc(100% - 124px) !important; }
body.che-do-sua .vl-bang { height: auto; }
.ks-tim { position: absolute; z-index: 44; display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 14px; overflow: auto;
  background: var(--vat-lieu, rgba(250,246,236,.95)); backdrop-filter: blur(14px); box-shadow: 0 6px 24px rgba(0,0,0,.18); }
.ks-tim[hidden] { display: none; }
.ks-tim section { margin: 0; padding: 0; border: 0; }
/* thư viện: lưới thẻ có hình */
body.che-do-sua .sv-ds { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; align-content: start; }
body.che-do-sua .sv-ds > h4, body.che-do-sua .sv-ds > p { grid-column: 1 / -1; }
body.che-do-sua .sv-mon { position: relative; flex-direction: column; align-items: stretch; gap: 4px; padding: 6px; border: 1px solid var(--line-soft);
  border-radius: 12px; background: #fffdf8; }
body.che-do-sua .sv-mon strong { order: 1; font-size: 12px; line-height: 1.25; }
body.che-do-sua .sv-mon .sv-sao { position: absolute; top: 2px; right: 2px; min-width: 32px; min-height: 32px; padding: 0; z-index: 1; }
body.che-do-sua .sv-mon .chip { order: 2; min-height: 32px; font-size: 11px; padding: 0 6px; justify-content: center; }
.ks-anh { order: 0; display: block; width: 100%; aspect-ratio: 16 / 9; border-radius: 8px; background: var(--paper-deep); object-fit: contain; }

/* thanh đáy: một thanh cho vật đang chọn + Huỷ / Xác nhận */
.ks-day { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 45; align-items: stretch; gap: 10px; pointer-events: none;
  max-width: calc(100% - 24px); }
.ks-day > * { pointer-events: auto; }
.ks-day .dd-nc { position: static !important; flex-direction: row; align-items: center; gap: 10px; padding: 6px 8px 6px 6px; border-radius: 18px;
  background: rgba(29,29,27,.88); backdrop-filter: blur(12px); box-shadow: 0 6px 24px rgba(0,0,0,.25); }
.ks-day .dd-nc[hidden] { display: none; }
.ks-day .dd-nc-chu { order: -1; flex: 0 0 auto; width: max-content; min-width: 150px; max-width: 230px; min-height: 52px; display: flex; align-items: center; padding: 6px 12px; border-radius: 12px;
  background: #fffdf8; color: var(--ink); font-size: 13px; font-weight: 600; line-height: 1.3; white-space: normal; }
.ks-day .dd-nc-chu:empty { display: none; }
.ks-day .dd-nc.do .dd-nc-chu { background: var(--accent); color: #fff; }
.ks-day .dd-nc-nut { padding: 0; gap: 2px; background: transparent; box-shadow: none; backdrop-filter: none; border-radius: 0; }
.ks-day .dd-nc-nut button { width: auto; min-width: 52px; height: 56px; min-height: 56px; padding: 4px 6px 2px; border-radius: 12px; background: transparent; color: #fff;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-size: 18px; line-height: 1; }
.ks-day .dd-nc-nut button svg { width: 22px; height: 22px; stroke: currentColor; fill: none; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.ks-day .dd-nc-nut button::after { content: attr(data-nhan); font: 500 10.5px/1.1 var(--font-sans); opacity: .85; white-space: nowrap; }
.ks-day .dd-nc-nut button:hover { background: rgba(255,255,255,.14); }
.ks-day .dd-nc-nut button[data-nhom-dau] { margin-left: 10px; position: relative; }
.ks-day .dd-nc-nut button[data-nhom-dau]::before { content: ""; position: absolute; left: -6px; top: 10px; bottom: 10px; width: 1px; background: rgba(255,255,255,.22); }
.ks-day .dd-xn { position: static !important; align-self: stretch; padding: 6px; border-radius: 18px; }
.ks-day .dd-xn-chu { padding: 0 6px; font-size: 12px; max-width: 96px; line-height: 1.25; }
.ks-day .dd-xn [data-qt="mo-ds"] { display: none; }   /* danh sách đã có thẻ «Thay đổi» ở khay */
.ks-day .dd-xn button { min-height: 52px; padding: 0 14px; border-radius: 14px; }
.ks-day .dd-xn-ok { min-width: 112px; font-size: 15px; }
.ks-day .dd-xn-ok::before { content: "✓ "; }
body.che-do-sua .dd-bao { bottom: 104px; }
body.che-do-sua .sv-cho, body.che-do-sua .qt-so { top: 72px !important; }

/* thanh trên: tầng · lùi / làm lại · lưới / bám */
.ks-tren { position: absolute; left: 50%; top: 12px; transform: translateX(-50%); z-index: 44; align-items: center; gap: 8px; }
.ks-nhom { display: flex; gap: 2px; padding: 3px; border-radius: 22px; background: rgba(29,29,27,.86); box-shadow: 0 2px 10px rgba(0,0,0,.2); }
.ks-nhom button { min-height: 38px; min-width: 38px; padding: 0 12px; border: 0; border-radius: 19px; background: transparent; color: #fff; font: 600 13px var(--font-sans); cursor: pointer; }
.ks-nhom button:hover { background: rgba(255,255,255,.14); }
.ks-nhom button[aria-pressed="true"] { background: #fffdf8; color: var(--ink); }
.ks-nhom button:disabled { opacity: .35; cursor: default; background: transparent; }
.ks-nhom button svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; vertical-align: -4px; }

/* cột phải: bảng số đo + bảng tường */
.ks-phai { position: absolute; right: 12px; top: 12px; z-index: 43; flex-direction: column; gap: 8px; align-items: flex-end; max-height: calc(100% - 200px); overflow: auto; }
.ks-phai > .bd-bang, .ks-phai > .tg-bang { position: static !important; }
.ks-phai > .tg-bang.ks-an { display: none; }
body.che-do-sua .la-ban { display: none !important; }   /* góc nhìn vẫn ở thanh trên (Trục đo · Mặt tiền · Trên) */

/* bảng phím */
.ks-phim { position: absolute; right: 12px; bottom: 104px; z-index: 42; min-width: 200px; max-width: 280px; padding: 8px 10px; border-radius: 14px;
  background: rgba(29,29,27,.80); color: #fff; font-size: 12px; backdrop-filter: blur(10px); }
.ks-phim > button { all: unset; display: flex; width: 100%; justify-content: space-between; cursor: pointer; font-weight: 600; font-size: 12px; opacity: .9; }
.ks-phim > button:focus-visible { outline: 2px solid #fff; }
.ks-phim ul { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 3px; }
.ks-phim li { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
.ks-pa { position: absolute; left: 50%; bottom: 100px; transform: translateX(-50%); z-index: 46; display: flex; flex-direction: column; gap: 4px;
  min-width: 300px; max-width: min(520px, calc(100% - 24px)); max-height: 50%; overflow: auto; padding: 10px; border-radius: 14px;
  background: var(--vat-lieu, rgba(250,246,236,.96)); backdrop-filter: blur(14px); box-shadow: 0 6px 24px rgba(0,0,0,.22); }
.ks-pa[hidden] { display: none; }
.ks-pa h5 { margin: 4px 0 2px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; opacity: .65; }
.ks-pa button { min-height: 40px; text-align: left; padding: 0 12px; border: 1px solid var(--line-soft); border-radius: 10px; background: #fffdf8; font: inherit; cursor: pointer; }
.ks-pa button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: #fff; }
.ks-phim kbd { font: 600 11px var(--font-mono); padding: 1px 6px; border-radius: 5px; background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.25); white-space: nowrap; }
.ks-phim.gon ul, .ks-phim.tam-gon ul { display: none; }
@media (max-width: 820px) {
  .ks-phim { display: none !important; }
  .ks-khay { flex-direction: row; top: auto; bottom: 96px; left: 8px; right: 8px; overflow-x: auto; }
  body.che-do-sua .sv-tv, body.che-do-sua .vl-bang, body.che-do-sua .qt-bang, .ks-tim { left: 8px !important; width: calc(100% - 16px) !important; max-height: calc(100% - 250px) !important; }
  /* điện thoại: bảng đứng TRÊN khay (khay đáy 96 + cao ~70) và DƯỚI thanh tầng trên — không che đầu bảng, không che khay */
  body.che-do-sua .vl-bang { bottom: 176px !important; top: auto !important; }
  /* bản đăng: thanh trên của trang (Trục đo · Hạng mục · Sửa) đè lên khung ⇒ thanh tầng xuống dưới nó, bảng chừa chỗ thanh tầng */
  body.chi-xem .ks-tren { top: 60px; }
  body.chi-xem.che-do-sua .vl-bang { max-height: calc(100% - 290px) !important; }
  .ks-day { left: 8px; right: 8px; transform: none; max-width: none; overflow-x: auto; }
  .ks-day .dd-nc-chu { display: none; }
  .ks-tren { top: 8px; }
  .ks-phai { display: none !important; }
}`;
  document.head.append(st);

  /* ── biểu tượng nét (một bộ, một độ dày) ── */
  const HINH = {
    tim: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
    do: '<path d="M4 11v6h16v-6"/><path d="M6 11V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3"/><path d="M4 11a2 2 0 0 1 4 0v2h8v-2a2 2 0 0 1 4 0"/><path d="M6 17v2M18 17v2"/>',
    vl: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.6-1 1.1-1.9-.6-1 .1-2.1 1.3-2.1H17a4 4 0 0 0 4-4c0-5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
    tuong: '<path d="M3 20h18M4 20V8l8-4 8 4v12"/><path d="M4 12h16M4 16h16M9 8v4M15 8v4M12 12v4M8 16v4M16 16v4"/>',
    kho: '<path d="M3 8l9-5 9 5v10l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v10"/>',
    ds: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h1M4 12h1M4 18h1"/>',
    lui: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    toi: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
    // thanh đáy (chủ nhà 2026-10-31: «scale up and rotate, each with an icon so it's easy to recognise»): nút nào có hình ở đây
    // thì mặc hình thay ký tự — mô-đun vẫn tạo nút bằng ký tự, ra khỏi chế độ sửa thì trả ký tự
    "xoay-": '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6"/><path d="M4 3.5v5.1h5.1"/>',
    "xoay+": '<path d="M20 12a8 8 0 1 1-2.4-5.7L20 8.6"/><path d="M20 3.5v5.1h-5.1"/>',
    doc: '<path d="M12 3v18"/><path d="M8 7l4-4 4 4M8 17l4 4 4-4"/>',
    lat: '<path d="M12 3v2M12 9v2M12 13v2M12 19v2"/><path d="M9 6L3 18h6zM15 6l6 12h-6z"/>',
    nho: '<path d="M4 14h6v6M20 10h-6V4"/><path d="M14 10l7-7M3 21l7-7"/>',
    to: '<path d="M15 3h6v6M9 21H3v-6"/><path d="M21 3l-7 7M3 21l7-7"/>',
    "doi-co": '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
    "doi-mon": '<path d="M4 8h15l-4-4M20 16H5l4 4"/>',
    "phuong-an": '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    "ca-phong": '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    "chi-tiet": '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  };
  HINH["vat-lieu"] = HINH.vl; HINH["cat-kho"] = HINH.kho;
  const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${HINH[k]}</svg>`;
  const phim = (key, them = {}) => {                                  // gọi đúng phím tắt sẵn có — một đường xử lý duy nhất
    const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...them });
    document.body.dispatchEvent(ev);
  };

  /* ── KHAY TRÁI ── */
  const khay = document.createElement("nav");
  khay.className = "ks-khay"; khay.setAttribute("aria-label", "Khay sửa");
  khung.append(khay);
  const timKhung = document.createElement("div");
  timKhung.className = "ks-tim"; timKhung.hidden = true; timKhung.setAttribute("role", "dialog"); timKhung.setAttribute("aria-label", "Tìm vật");
  khung.append(timKhung);
  const timSec = document.getElementById("tim")?.closest("section");
  let timCho = null;                                                  // chỗ cũ của khối tìm trong ô trái
  const bang = {                                                      // thẻ → {mo: đang mở?, bat: mở/đóng}
    tim: { mo: () => !timKhung.hidden, bat: () => { timKhung.hidden = !timKhung.hidden; if (!timKhung.hidden) $("#tim")?.focus(); } },
    do: { mo: () => !!$(".sv-tv") && !$(".sv-tv").hidden, bat: () => ctx.nutThuVien.click() },
    vl: { mo: () => !!$(".vl-bang") && !$(".vl-bang").hidden, bat: () => phim("h") },
    tuong: { mo: () => !!ctx.tuong?.ve(), bat: () => ctx.tuong?.batVe(!ctx.tuong.ve()) },
    kho: { mo: () => !!$('.qt-bang[aria-label="Kho đồ"]') && !$('.qt-bang[aria-label="Kho đồ"]').hidden, bat: () => ctx.quyTrinh?.moKho() },
    ds: { mo: () => !!$('.qt-bang[aria-label="Danh sách thay đổi"]') && !$('.qt-bang[aria-label="Danh sách thay đổi"]').hidden, bat: () => ctx.quyTrinh?.moBang() },
  };
  const THE = [
    ["tim", "Tìm", "Tìm một vật theo tên (cửa, cột, ổ cắm…) để chọn"],
    ["do", "Đồ đạc", "Thư viện đồ — kéo thẻ vào khung 3D"],
    ["vl", "Vật liệu", "Vật liệu và màu (H)"],
    ["tuong", "Tường", "Vẽ tường: bấm hai điểm trên sàn (W)"],
    ["kho", "Kho", "Đồ đã cất — đặt lại sau (K)"],
    ["ds", "Thay đổi", "Danh sách thay đổi chưa lưu (L)"],
  ];
  const nutThe = {}, THE_GOC = {};
  let tuDong = false;                                                // đang tự đóng bảng (bấm hộ nút gốc) ⇒ móc «đóng bảng khác» của nút gốc đứng ngoài
  const dongBang = (x) => { tuDong = true; try { x.bat(); } finally { tuDong = false; } };
  const dongKhac = (k) => { for (const [j, x] of Object.entries(bang)) if (j !== k && x.mo()) dongBang(x); };   // mỗi lúc một công cụ (kể cả đang vẽ tường)
  for (const [k, ten, tit] of THE) {
    if (ctx.thietBi && !["tim", "vl"].includes(k)) continue;         // thiết bị (bản đăng, iPhone): chỉ Tìm + Vật liệu
    const b = document.createElement("button");
    b.type = "button"; b.dataset.ks = k; b.title = tit; b.setAttribute("aria-pressed", "false");
    b.innerHTML = `${svg(k)}<span>${ten}</span>`;
    b.onclick = () => { dongKhac(k); bang[k].bat(); veKhay(); };
    khay.append(b); nutThe[k] = b; THE_GOC[k] = b;
  }
  // «Đồ đạc» và «Kho» LÀ nút gốc của mô-đun (#nut-thu-vien, #nut-kho-do) mặc áo thẻ — một nút, không có bản sao che nhau
  const GOC_THE = { do: () => ctx.nutThuVien, kho: () => document.getElementById("nut-kho-do") };
  const CHU_CU = new Map();
  function mangAo(k) {
    const n = GOC_THE[k](), the = THE_GOC[k];
    if (!n || !the || n.parentElement === khay) return;               // thiết bị: không có thẻ Đồ đạc / Kho
    CHU_CU.set(n, [n.innerHTML, n.className, n.title]);
    doi(n, khay); khay.insertBefore(n, the);
    n.innerHTML = the.innerHTML; n.classList.add("ks-the"); n.dataset.ksGoc = k; n.dataset.ks = k; n.title = the.title;
    delete the.dataset.ks;
    n.addEventListener("click", dongKhacGoc, true);
    the.hidden = true; nutThe[k] = n;
  }
  function dongKhacGoc(ev) { if (sua() && !tuDong) dongKhac(ev.currentTarget.dataset.ksGoc); }
  function coiAo() {
    for (const [n, [html, cls, tit]] of CHU_CU) { n.innerHTML = html; n.className = cls; n.title = tit; delete n.dataset.ksGoc; delete n.dataset.ks; n.removeEventListener("click", dongKhacGoc, true); }
    CHU_CU.clear();
    for (const k of Object.keys(GOC_THE)) { const the = THE_GOC[k]; if (!the) continue; the.dataset.ks = k; the.hidden = false; nutThe[k] = the; }
  }
  function veKhay() { for (const [k, b] of Object.entries(nutThe)) { const v = String(bang[k].mo()); if (b.getAttribute("aria-pressed") !== v) b.setAttribute("aria-pressed", v); } }

  /* ── THANH ĐÁY ── */
  const day = document.createElement("div");
  day.className = "ks-day"; day.setAttribute("role", "region"); day.setAttribute("aria-label", "Vật đang chọn");
  khung.append(day);
  const NHAN = {                                                      // chữ dưới nút + thứ tự + đầu nhóm (như thanh hành động trong game xây nhà)
    "xoay-": ["Xoay trái", 1], "xoay+": ["Xoay phải", 2], doc: ["Nâng hạ", 3], lat: ["Lật", 4],
    nho: ["Nhỏ lại", 10, 1], to: ["To ra", 11], "doi-co": ["Đổi cỡ", 12],
    "doi-mon": ["Đổi món", 20, 1], "vat-lieu": ["Vật liệu", 21], "phuong-an": ["Phương án", 22],
    "ca-phong": ["Cả phòng", 30, 1], "cat-kho": ["Cất kho", 31], "chi-tiet": ["Chi tiết", 40, 1],
  };
  function veNut() {
    const nc = $(".dd-nc"); if (!nc) return;
    const ds = [...nc.querySelectorAll(".dd-nc-nut button")];
    let dau = false;
    for (const b of ds.sort((a, c) => (NHAN[a.dataset.v]?.[1] ?? 50) - (NHAN[c.dataset.v]?.[1] ?? 50))) {
      const n = NHAN[b.dataset.v];
      if (n && b.dataset.nhan !== n[0]) b.dataset.nhan = n[0];
      if (HINH[b.dataset.v] && b.dataset.ksChu == null) { b.dataset.ksChu = b.innerHTML; b.innerHTML = svg(b.dataset.v); }
      b.style.order = String(n?.[1] ?? 50);
      if (n?.[2] && !b.hidden && dau) b.dataset.nhomDau = ""; else delete b.dataset.nhomDau;
      if (!b.hidden) dau = true;
    }
  }
  /* PHƯƠNG ÁN CỦA VẬT ĐANG CHỌN (chủ nhà 2026-10-31: gạch sàn phòng ngủ «set them as one of option we can set in the editor
     mode»; «some objects have variants … add a Variant next to the Material buttons»; «remove the Phương án [outside edit mode]
     … we use the version in edit mode instead»): thanh đáy có nút «Phương án» cạnh «Vật liệu» — danh sách lựa chọn của mọi công
     tắc gắn với cụm đang chọn (sàn phòng ngủ: gạch kem / vân gỗ; WC: ba mẫu terrazzo…) + «Loại · màu vật liệu…» (phương án
     vật liệu của xem.js — khung nhôm, tay vịn…). Chế độ xem không còn nút «Phương án». */
  const idChon = () => { const v = ctx.vatChon(); if (v) return v.ds[0]?.userData.id; const k = ctx.nhom()[0]; return k ? ctx.dsCua(k)[0]?.userData.id : null; };
  const ctVat = () => { const id = idChon(); return id && window.XEM?.congTacVat ? window.XEM.congTacVat(id).filter((c) => c.lua_chon.length > 1) : []; };
  const pa = document.createElement("div");
  pa.className = "ks-pa"; pa.hidden = true; pa.setAttribute("role", "dialog"); pa.setAttribute("aria-label", "Phương án của vật đang chọn");
  khung.append(pa);
  const vatChon1 = () => { const v = ctx.vatChon(); if (v) return v.ds[0]; const k = ctx.nhom()[0]; return k ? ctx.dsCua(k)[0] : api.cacChon?.()[0]; };
  const coPaVl = () => api.coPaVatLieu?.(vatChon1()) > 0;              // phương án VẬT LIỆU (loại · màu) — menu của xem.js
  function moPa(bat = pa.hidden) {
    pa.hidden = !bat; if (!bat) return;
    pa.replaceChildren();
    if (!ctVat().length && coPaVl()) { pa.hidden = true; api.moPaVatLieu(vatChon1()); return; }
    for (const c of ctVat()) {
      const h = document.createElement("h5"); h.textContent = c.nhan; pa.append(h);
      for (const n of c.lua_chon) {
        const b = document.createElement("button"); b.type = "button"; b.textContent = n; b.dataset.ksPa = c.ma;
        b.setAttribute("aria-pressed", String(n === c.the));
        b.onclick = () => { if (window.XEM.datCongTac(c.ma, n)) { pa.hidden = true; ctx.boChon(); ctx.thongBao(`${c.nhan}: ${n}`); } };
        pa.append(b);
      }
    }
    if (coPaVl()) {
      const h = document.createElement("h5"); h.textContent = "Vật liệu"; pa.append(h);
      const b = document.createElement("button"); b.type = "button"; b.dataset.v = "phuong-an"; b.textContent = "Loại · màu vật liệu…";
      b.onclick = () => { pa.hidden = true; api.moPaVatLieu(vatChon1()); };
      pa.append(b);
    }
  }
  ctx.nut({ v: "phuong-an", chu: "◧", title: "Phương án của vật này (gạch, mẫu…)", hien: () => sua() && (ctVat().length > 0 || coPaVl()), khi: () => moPa() });
  ctx.nut({ v: "chi-tiet", chu: "ⓘ", title: "Quy cách, vật liệu, sản phẩm của vật đang chọn", hien: () => sua(),
    khi: () => body.classList.toggle("ks-chi-tiet") });

  /* ── THANH TRÊN ── */
  const tren = document.createElement("div");
  tren.className = "ks-tren"; tren.setAttribute("role", "toolbar"); tren.setAttribute("aria-label", "Tầng và lịch sử sửa");
  tren.innerHTML = `<div class="ks-nhom" role="group" aria-label="Tầng">
      <button type="button" data-ks-tang="" title="Cả nhà">Cả nhà</button>
      <button type="button" data-ks-tang="t1" title="Chỉ tầng 1 — cắt bằng ngang 1,3 m trên sàn, nhìn như nhà búp bê">Tầng 1</button>
      <button type="button" data-ks-tang="t2" title="Chỉ tầng 2 — cắt bằng ngang 1,3 m trên sàn">Tầng 2</button></div>
    <div class="ks-nhom" role="group" aria-label="Lùi và làm lại">
      <button type="button" data-ks="lui" title="Lùi một bước (⌘Z)" aria-label="Lùi một bước">${svg("lui")}</button>
      <button type="button" data-ks="toi" title="Làm lại (⌘⇧Z)" aria-label="Làm lại">${svg("toi")}</button></div>
    <div class="ks-nhom" role="group" aria-label="Mặt cắt">
      <button type="button" data-ks="cat" title="Mặt cắt — dọc nhà · ngang nhà · bằng, kéo thanh trượt dời mặt cắt (C)">Mặt cắt</button></div>`;
  khung.append(tren);
  const CAT_TANG = 1.3;                                               // mét trên sàn: thấp hơn tủ bếp trên, cao hơn mặt bàn
  let tang = "";
  function datTang(t) {
    tang = t;
    const X = window.XEM;
    if (!X) return;
    if (!t) X.cat(null);
    else X.catM("z", (ctx.SAN()[t] ?? 0) + CAT_TANG, false);
    veTren();
  }
  for (const b of tren.querySelectorAll("[data-ks-tang]")) b.onclick = () => datTang(b.dataset.ksTang);
  tren.querySelector('[data-ks="lui"]').onclick = () => ctx.hoanTacCuoi();
  tren.querySelector('[data-ks="toi"]').onclick = () => ctx.quyTrinh?.lamLai();
  const nutCat = tren.querySelector('[data-ks="cat"]');
  nutCat.onclick = () => { tang = ""; document.getElementById("nut-cat")?.click(); veTren(); };   // cùng bảng cắt + phím C của chế độ xem
  function veTren() {
    for (const b of tren.querySelectorAll("[data-ks-tang]")) b.setAttribute("aria-pressed", String(b.dataset.ksTang === tang));
    tren.querySelector('[data-ks="lui"]').disabled = !ctx.HOAN_TAC.length;
    tren.querySelector('[data-ks="toi"]').disabled = !ctx.quyTrinh?.soLamLai?.();
    nutCat.setAttribute("aria-pressed", String(!document.getElementById("bang-cat")?.hidden));
  }

  /* ── CỘT PHẢI ── */
  const phai = document.createElement("div");
  phai.className = "ks-phai";
  khung.append(phai);

  /* ── BẢNG PHÍM: chỉ phím dùng được lúc này ── */
  const bp = document.createElement("div");
  bp.className = "ks-phim"; bp.setAttribute("role", "note"); bp.setAttribute("aria-label", "Phím tắt dùng được lúc này");
  bp.innerHTML = `<button type="button" aria-expanded="true"><span>Phím tắt</span><span aria-hidden="true">▾</span></button><ul></ul>`;
  khung.append(bp);
  const KLS = "sua.ks.phim_gon";
  try { if (localStorage.getItem(KLS) === "1") bp.classList.add("gon"); } catch { /* không có kho */ }
  bp.querySelector("button").onclick = () => {
    const gon = bp.classList.toggle("gon");
    bp.querySelector("button").setAttribute("aria-expanded", String(!gon));
    try { localStorage.setItem(KLS, gon ? "1" : "0"); } catch { /* không có kho */ }
  };
  const PHIM = {
    keo: [["Bỏ bám, bước 5 mm", "giữ Alt"], ["Thả ở chỗ đỏ = về chỗ hợp lệ cuối", ""]],
    mon: [["Dời", "kéo món"], ["Cỡ · cao", "kéo mũi tên"], ["Xoay tự do", "kéo vòng"], ["Xoay 90°", "R · ⇧R"], ["Nâng · hạ", "9 · 0"], ["Nhỏ · to 10%", "− · +"], ["Lật", "F"],
      ["Nhân bản", "⌘D"], ["Chép · dán", "⌘C · ⌘V"], ["Thêm vào nhóm", "⇧ bấm"], ["Bỏ", "Delete"], ["Thôi chọn", "Esc"]],
    san: [["Đổi gạch · sơn", "Vật liệu · H"], ["Thôi chọn", "Esc"]],
    vat: [["Dời", "kéo"], ["Nâng · hạ", "9 · 0"], ["Nhỏ · to 10%", "− · +"], ["Chép · dán", "⌘C · ⌘V"], ["Bỏ", "Delete"], ["Thôi chọn", "Esc"]],
    trong: [["Chọn · dời", "bấm · kéo"], ["Khoanh chọn", "⇧ kéo nền"], ["Lưới · bước", "Q · ⇧Q"], ["Vẽ tường", "W"], ["Vật liệu · ống hút", "H · I"],
      ["Kho · thay đổi", "K · L"], ["Lùi · làm lại", "⌘Z · ⌘⇧Z"], ["So với bản cũ", "giữ \\"], ["Thoát sửa", "E"]],
  };
  let phimDang = "";
  function veBangPhim() {
    const v = ctx.vatChon();
    const k = ctx.dangKeo() ? "keo" : ctx.nhom().length ? "mon" : v ? (/^Sàn\b/.test(v.ten || "") ? "san" : "vat") : "trong";
    if (k === phimDang) return;
    phimDang = k;
    const ul = bp.querySelector("ul"); ul.replaceChildren();
    for (const [chu, p] of PHIM[k]) {
      const li = document.createElement("li"); const s = document.createElement("span"); s.textContent = chu; li.append(s);
      if (p) { const kb = document.createElement("kbd"); kb.textContent = p; li.append(kb); }
      ul.append(li);
    }
  }

  /* ── ẢNH THẺ THƯ VIỆN: chụp món cùng loại đang có trong nhà; chưa có thì vẽ dấu chân ── */
  const ANH = new Map();                                              // mã thư viện → dataURL
  let rd = null, henRd = 0;
  function chupMon(id) {
    if (ANH.has(id)) return ANH.get(id);
    const k = [...ctx.NAY.keys()].find((x) => ctx.NAY.get(x).catalog === id && !ctx.GIU_CHO.has(x));
    if (!k) return null;                                              // chưa có trong nhà: lần mở sau thử lại
    try {
      if (!rd) { rd = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); rd.setSize(240, 180, false); rd.setPixelRatio(1); }
      const sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight(0xffffff, 0x8a8478, 2.2));
      const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(3, 6, 4); sc.add(dl);
      const g = new THREE.Group();
      for (const o of ctx.dsCua(k)) { const c = o.clone(); o.updateWorldMatrix(true, false); c.matrixAutoUpdate = false; c.matrix.copy(o.matrixWorld); c.visible = true; g.add(c); }
      sc.add(g);
      const b = new THREE.Box3().setFromObject(g), tam = b.getCenter(new THREE.Vector3()), r = b.getSize(new THREE.Vector3()).length() / 2 || 1;
      const cam = new THREE.PerspectiveCamera(30, 4 / 3, r / 50, r * 20);
      cam.position.copy(tam).add(new THREE.Vector3(1.1, 0.95, 1.5).normalize().multiplyScalar(r / Math.sin(THREE.MathUtils.degToRad(15)) * 1.05));
      cam.lookAt(tam);
      rd.render(sc, cam);
      const u = rd.domElement.toDataURL("image/png");
      ANH.set(id, u); return u;
    } catch (e) { console.warn("ảnh thẻ thư viện:", id, e); return null; }
  }
  function dauChan(the) {                                             // rộng × sâu từ nhãn cỡ đầu tiên của thẻ
    const t = the.querySelector(".chip")?.title || "", m = t.match(/(\d+)\s*×\s*(\d+)/);
    if (!m) return null;
    const w = +m[1], d = +m[2], k = Math.min(200 / w, 120 / d);
    const W = w * k, D = d * k;
    return "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180"><rect width="240" height="180" fill="#ebe5d6"/>
      <rect x="${120 - W / 2}" y="${84 - D / 2}" width="${W}" height="${D}" rx="6" fill="#fffdf8" stroke="#4a4a46" stroke-width="2"/>
      <text x="120" y="166" text-anchor="middle" font-family="system-ui,sans-serif" font-size="15" fill="#4a4a46">${w} × ${d} mm</text></svg>`);
  }
  function anhThe() {
    if (!sua()) return;
    for (const the of document.querySelectorAll(".sv-ds .sv-mon:not([data-ks-anh])")) {
      the.dataset.ksAnh = "";
      const u = chupMon(the.dataset.id) || dauChan(the);
      if (!u) continue;
      const img = document.createElement("img"); img.className = "ks-anh"; img.alt = ""; img.src = u; img.draggable = false;
      the.prepend(img);
    }
    clearTimeout(henRd); henRd = setTimeout(() => { if (rd) { rd.dispose(); rd.forceContextLoss(); rd = null; } }, 3000);   // trả ngữ cảnh WebGL thứ hai khi thôi chụp
  }
  new MutationObserver((ms) => { if (ms.some((m) => m.target.closest?.(".sv-ds"))) anhThe(); }).observe(khung, { childList: true, subtree: true });

  /* ── VÀO / RA CHẾ ĐỘ SỬA: dời phần tử vào khung sửa, ra thì trả về ── */
  const CHO_CU = new Map();                                           // phần tử → [cha, kế]
  const doi = (el, dich, dau = false) => { if (!el || el.parentElement === dich) return; if (!CHO_CU.has(el)) CHO_CU.set(el, [el.parentElement, el.nextSibling]); dau ? dich.prepend(el) : dich.append(el); };
  const tra = () => { for (const [el, [cha, ke]] of CHO_CU) cha.insertBefore(el, ke && ke.parentElement === cha ? ke : null); CHO_CU.clear(); };
  function datCho() {                                                // mô-đun nạp song song ⇒ phần tử của mô-đun khác có thể đến sau
    doi($(".dd-nc"), day); doi($(".dd-xn"), day);
    doi($(".bd-bang"), phai); doi($(".tg-bang"), phai);
    mangAo("do"); mangAo("kho");
    if (timSec) doi(timSec, timKhung);
  }
  function vao() {
    datCho();
    // MẶT CẮT GIỮ NGUYÊN khi đổi chế độ (chủ nhà 2026-10-31: «switching between editor mode and normal mode should keep the
    // current cutting face position») — vào hay ra chế độ sửa đều không đụng tới mặt cắt đang có
    phimDang = "";
    veTren(); veKhay();
  }
  function ra() {
    coiAo(); tra(); pa.hidden = true;
    for (const b of document.querySelectorAll(".dd-nc-nut button")) {
      b.style.order = ""; delete b.dataset.nhomDau;
      if (b.dataset.ksChu != null) { b.innerHTML = b.dataset.ksChu; delete b.dataset.ksChu; }
    }
    timKhung.hidden = true; body.classList.remove("ks-chi-tiet");
    tang = "";                                                        // nút tầng của thanh sửa thôi sáng; mặt cắt tầng vẫn giữ
  }
  api.khiDoiSua?.((bat) => (bat ? vao() : ra()));
  if (sua()) vao();

  document.getElementById("ket-qua")?.addEventListener("click", () => { if (sua()) { timKhung.hidden = true; veKhay(); } });   // chọn xong thì gập bảng tìm
  function anTuong() {                                               // bảng tường chỉ còn nút «Vẽ tường» ⇒ ẩn (đã có thẻ Tường ở khay)
    const B = $(".tg-bang"); if (!B) return;
    B.classList.toggle("ks-an", B.textContent.trim() === "▭ Vẽ tường (W)");
  }
  function tranhPhim() {                                             // cột phải dài xuống chạm bảng phím ⇒ gập bảng phím tạm
    const a = phai.getBoundingClientRect(), c = bp.getBoundingClientRect();
    bp.classList.toggle("tam-gon", a.height > 0 && a.bottom > c.top - 8 && !bp.classList.contains("gon"));
  }
  let moTruoc = new Set();
  function motBang() {                                               // bảng mở bằng đường khác (nút «Vật liệu» thanh đáy, phím H / K / L) ⇒ đóng bảng kia
    const mo = new Set(Object.keys(bang).filter((k) => bang[k].mo())), moi = [...mo].filter((k) => !moTruoc.has(k));
    if (moi.length) for (const k of mo) if (!moi.includes(k)) dongBang(bang[k]);
    moTruoc = new Set(Object.keys(bang).filter((k) => bang[k].mo()));
  }
  let idPa = null;
  api.moiKhung(() => { if (!sua()) return; const i = idChon(); if (i !== idPa) { idPa = i; pa.hidden = true; } datCho(); motBang(); anTuong(); tranhPhim(); veNut(); veBangPhim(); veKhay(); veTren(); });
  ctx.khiXacNhan?.(() => { ANH.clear(); for (const e of document.querySelectorAll(".sv-mon[data-ks-anh]")) { delete e.dataset.ksAnh; e.querySelector(".ks-anh")?.remove(); } veTren(); });
}
