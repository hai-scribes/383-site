/* KHUNG 3D NHÚNG — trình xem chạy trong khung 3D của bộ hồ sơ (tools/site/web/khung-3d.html).
   Trang hồ sơ tải trình xem MỘT lần; mỗi nút cảnh chỉ gửi trạng thái qua postMessage, trình xem áp tại chỗ
   (XEM.apTrangThai — xem «KỊCH BẢN 3D» trong xem.js). Kho kịch bản: data/canh-3d.yaml.

   ?nhung=1        chế độ xem: chỉ còn khung vẽ + la bàn (thợ xoay, phóng được; không thanh công cụ)
   lệnh «sua»      chế độ soạn: hiện đủ công cụ (cắt, ẩn, chỉ xem, ◐, bóc/tách lớp…) để dựng cảnh

   Nhận (từ cửa sổ cha):  {lenh:"ap", tt, bay, tachDe, hoi?} → {lenh:"da_ap", hoi}  · {lenh:"kich_ban", tt, ds, tachDe} → {lenh:"kich_ban_xong", hoi, xong}  · {lenh:"lay", hoi}  · {lenh:"sua", bat}  · {lenh:"tach", khe}
                          {lenh:"chon", hoi} → {lenh:"chon", ds:[{id,ten,nhom}]} · {lenh:"noi_bat_dat", ds, hoi}
                          {lenh:"noi_bat", theo_lop} · {lenh:"bo_noi_bat"} · {lenh:"nang", bat, ngay, gio} → {lenh:"nang", nang, hoi}
   Gửi  (lên cửa sổ cha): {nguon:"xem3d", lenh:"san_sang"} · {lenh:"trang_thai", tt, hoi} · {lenh:"loi", loi}
   Chỉ nghe thư từ ĐÚNG cửa sổ cha; thư gửi đi chỉ mang trạng thái góc nhìn, không mang gì riêng tư. */
const Q = new URLSearchParams(location.search);
if (Q.has("nhung") && window.parent !== window) {
  document.body.classList.add("nhung");
  // xem.js đo khung vẽ lúc khởi động (khi thanh công cụ còn chiếm chỗ) — báo đổi cỡ sau khi bỏ chúng
  const doiCo = () => { dispatchEvent(new Event("resize")); requestAnimationFrame(() => dispatchEvent(new Event("resize"))); };
  doiCo();
  const gui = (m) => window.parent.postMessage({ nguon: "xem3d", ...m }, "*");
  const doi = async () => {
    for (let i = 0; i < 400 && !window.XEM; i++) await new Promise((r) => setTimeout(r, 25));
    if (!window.XEM) throw new Error("trình xem không khởi động");
    await (window.XEM.hienDau || window.XEM.ready);   // đợt đầu đã dựng là đủ hiện — nhóm chậm tự thêm vào sau
    return window.XEM;
  };
  // tiến độ tải (xem.js TIEN) → trang việc: nó giữ khung 3D ẩn tới khi hiện được, nên thanh tiến độ phải nằm ở trang ấy
  const guiTien = () => { const t = window.TIEN_DO && window.TIEN_DO.tom; if (t) gui({ lenh: "tien_do", ...t }); };
  addEventListener("tien-do-tom", guiTien); guiTien();
  const XEMP = doi();
  XEMP.then(() => { doiCo(); gui({ lenh: "san_sang" }); }, (e) => gui({ lenh: "loi", loi: String(e.message || e) }));
  window.addEventListener("message", async (ev) => {
    if (ev.source !== window.parent) return;
    const d = ev.data || {};
    if (d.nguon !== "khung3d") return;
    const X = await XEMP;
    try {
      if (d.lenh === "ap") {
        X.apTrangThai(d.tt || {}, { bay: d.bay ?? 0.8, tachDe: d.tachDe ?? null });
        // có hỏi ⇒ báo lại sau khi cảnh đã VẼ (hai khung) — trang việc giữ khung 3D ẩn tới lúc này, khỏi nháy bố cục + lưới
        if (d.hoi) requestAnimationFrame(() => requestAnimationFrame(() => gui({ lenh: "da_ap", hoi: d.hoi })));
      }
      else if (d.lenh === "kich_ban") {
        const xong = await X.chayKichBan(d.tt || {}, d.ds || [], { tachDe: d.tachDe ?? null });
        if (d.hoi) gui({ lenh: "kich_ban_xong", xong, hoi: d.hoi });
      }
      else if (d.lenh === "tach") X.tachGiu(Number(d.khe) || 0, d.giay ?? 0.8);
      else if (d.lenh === "chon") gui({ lenh: "chon", ds: X.dangChon(), hoi: d.hoi });
      else if (d.lenh === "noi_bat_dat") gui({ lenh: "trang_thai", tt: (X.datNoiBat(d.ds || []), X.trangThai()), hoi: d.hoi });
      else if (d.lenh === "lay") gui({ lenh: "trang_thai", tt: X.trangThai(), hoi: d.hoi });
      else if (d.lenh === "sua") { document.body.classList.toggle("nhung-sua", !!d.bat); doiCo(); }
      else if (d.lenh === "noi_bat") gui({ lenh: "trang_thai", tt: (X.noiBat(!!d.theo_lop), X.trangThai()), hoi: d.hoi });
      else if (d.lenh === "bo_noi_bat") X.boNoiBat();
      else if (d.lenh === "nang") gui({ lenh: "nang", nang: X.nang(d.tuy || null), hoi: d.hoi });
    } catch (e) {
      gui({ lenh: "loi", loi: String(e.message || e) });
    }
  });
}
