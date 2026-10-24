/* NỐI chuyen_dong_ve.js vào trình xem qua window.XEM_HOOK (giao kèo với phiên sửa xem.js, 2026-10-21) — xem.js chỉ cần
   import tệp này; không sửa gì khác ở đây.
     chuyenTrangThai({ ma, cm, tuNhan, denNhan, tu, den, scene, veLai, xong }) — chạy chuyển động rồi mới gọi xong() (đổi lớp)
     nutHien({ ma, cm, phan, neo, tuNhan, denNhan, tu, den, scene, veLai, khungLienTuc }) — nút nổi hiện ⇒ đường báo «bấm thì đi
       đâu», vẽ qua XEM.veSau (sau lớp tập trung — không bị phủ nền)
     nutAn() — nút ẩn ⇒ gỡ đường báo
   Tên trường theo tin nhắn của phiên kia; đổi tên ở đây khi commit của họ chốt tên cuối. */
import { chayChuyen, taoDuongBao, capNhatCo } from "./chuyen_dong_ve.js";

const nhanCua = (cm) => [...new Set((cm?.lua_chon || []).map((l) => l.nhan))];
let BAO = null, BAO_RAF = 0, BAO_DUNG = null;

function goBao() {
  cancelAnimationFrame(BAO_RAF); BAO_RAF = 0;
  if (BAO_DUNG) { BAO_DUNG(); BAO_DUNG = null; }      // trả yêu cầu khung liên tục
  if (BAO) { BAO.bo(); BAO = null; }
}

const HOOK = (window.XEM_HOOK = window.XEM_HOOK || {});

HOOK.chuyenTrangThai = (a) => {
  goBao();                                            // đường báo chỉ có TRƯỚC khi chạy
  if (!a?.scene || !a.tu?.length || !a.den?.length) { a?.xong?.(); return; }
  // nút nổi MỜ đi trong lúc diễn nhưng VẪN NHẬN CHẠM (soát trình duyệt: ẩn hẳn thì cú chạm thứ hai lọt xuống mô hình, chọn
  // nhầm vật phía sau) — chạm lần nữa = tới đích ngay; trình xem dựng lại nút ở chỗ mới sau khi đổi thế
  const nut = window.XEM?.neoNutNoi?.()?.nut;
  if (nut) nut.style.opacity = "0.45";
  const tra = () => { if (nut) nut.style.opacity = ""; };
  const p = chayChuyen({ scene: a.scene, tu: a.tu, den: a.den, nhan: nhanCua(a.cm), veLai: a.veLai || (() => {}) });
  p.then(() => { tra(); a.xong?.(); }, (e) => { console.error("chuyển động công tắc:", e); tra(); a.xong?.(); });
  return () => { p.huy?.(); tra(); };                 // trình xem gọi khi cần tới đích ngay
};

HOOK.nutHien = (a) => {
  goBao();
  if (!a?.tu?.length || !a.den?.length) return;
  BAO = taoDuongBao({ tu: a.tu, den: a.den, nhan: nhanCua(a.cm) });
  if (!BAO) return;
  // vẽ SAU lớp tập trung (XEM.veSau) để đường báo không bị phủ màu nền; trình xem cũ không có móc ⇒ thêm vào cảnh
  const nhom = BAO.nhom, co = { x: 0, y: 0 };
  const go = window.XEM?.veSau?.((r, cam) => {
    const w = r.domElement.width, h = r.domElement.height;
    if (w !== co.x || h !== co.y) { co.x = w; co.y = h; capNhatCo(w, h); }
    BAO?.xuyen?.(window.XEM?.vienCum?.manh?.().mo || 0);
    // đường báo là chỉ dẫn, không phải hình học: mặt cắt không xén nó (cung ngang giữa cao cánh hay nằm đúng dưới mặt cắt)
    const ac = r.autoClear, cp = r.clippingPlanes; r.autoClear = false; r.clippingPlanes = [];
    try { r.render(nhom, cam); } finally { r.autoClear = ac; r.clippingPlanes = cp; }
  });
  if (go) BAO.goVe = go; else a.scene.add(nhom);
  // nút ra ngoài khung / bị ẩn ⇒ đường báo ẩn theo và TRẢ yêu cầu vẽ liên tục (soát Codex: cả cảnh vẽ mọi khung cho một
  // đường báo không ai thấy); nút hiện lại ⇒ chạy tiếp
  const nut = window.XEM?.neoNutNoi?.()?.nut;
  let stop = null;
  const xin = () => { if (!stop && typeof a.khungLienTuc === "function") stop = a.khungLienTuc(); };
  const tra = () => { if (stop) { stop(); stop = null; } };
  const t0 = performance.now();
  const nhip = (now) => {
    if (!BAO) return;
    // (đường báo cũ: trình xem tự dựng lại nút + đường báo mỗi khi công tắc của nút đổi thế — apLopChonMot. KHÔNG gọi XEM.* mỗi
    //  khung ở đây: hàm XEM bọc sẵn «vẽ thêm 300 ms», gọi mỗi khung thì trình xem không bao giờ nghỉ — soát Codex vòng 5)
    const thay = !nut || !nut.hidden;
    nhom.visible = thay;
    if (thay) { xin(); BAO.nhip((now - t0) / 1000); if (!stop) a.veLai?.(60); } else tra();
    BAO_RAF = requestAnimationFrame(nhip);
  };
  BAO_RAF = requestAnimationFrame(nhip);
  BAO_DUNG = () => { tra(); BAO?.goVe?.(); };
};

HOOK.nutAn = () => goBao();

