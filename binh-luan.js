/* ==========================================================================
   SỔ BÌNH LUẬN TRÊN HỒ SƠ 383
   ==========================================================================
   Bôi đen một đoạn chữ trên trang → ghi chú → lưu chung. Nhà thầu mở cùng đường
   dẫn thì thấy đúng những ghi chú đó và trả lời được ngay tại chỗ.

   Chỗ lưu: Supabase (REST). Khoá `anon` nằm thẳng trong trang — đó là khoá
   CÔNG KHAI theo thiết kế của Supabase, không phải khoá bí mật. Bảng không mở
   quyền ghi cho khoá đó; ghi chỉ đi qua hàm `them_binh_luan`, và hàm đó đòi
   MẬT KHẨU CHUNG. Xem tools/kts-review/binh-luan.sql.

   Cấu hình do build_site.py chèn vào trang, dạng:
     window.BINH_LUAN_CAU_HINH = { url: "...", khoa: "..." }

   NEO BÌNH LUẬN VÀO CHỮ, KHÔNG VÀO TOẠ ĐỘ. Tài liệu còn sửa; toạ độ chết ngay
   lần sửa đầu. Mỗi bình luận giữ ĐOẠN TRÍCH và vài chữ đứng trước nó, rồi tìm
   lại bằng cách quét các nút văn bản. Không tìm thấy thì bình luận vẫn còn —
   nó rơi xuống mục "không còn thấy đoạn chữ này trong trang" chứ không biến mất.
   ========================================================================== */
(function () {
  "use strict";

  var CH = window.BINH_LUAN_CAU_HINH;
  if (!CH || !CH.url || !CH.khoa) return;

  var API = CH.url.replace(/\/+$/, "") + "/rest/v1";
  var TRANG = (function () {
    var p = location.pathname.split("/").pop();
    return p && p !== "" ? p : "index.html";
  })();

  var NHO = {
    ten: function (v) { return luu("bl-ten", v); },
    mk: function (v) { return luu("bl-mk", v); }
  };
  function luu(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k) || "";
      localStorage.setItem(k, v);
      return v;
    } catch (e) { return ""; }
  }

  var duLieu = [];          // toàn bộ bình luận của trang này
  var goc = null;           // .bl-root — chứa nút nổi và ngăn kéo
  var nutChon = null;       // nút "Ghi chú" hiện ra khi bôi đen
  var chonHienTai = null;   // {trich, truoc, neo}

  /* ── Gọi máy chủ ───────────────────────────────────────────────────────── */
  function dau() {
    return { apikey: CH.khoa, Authorization: "Bearer " + CH.khoa, "Content-Type": "application/json" };
  }

  function doc() {
    var u = API + "/binh_luan?select=*&trang=eq." + encodeURIComponent(TRANG) + "&order=tao_luc.asc";
    return fetch(u, { headers: dau() }).then(function (r) {
      if (!r.ok) throw new Error("Không đọc được sổ bình luận (" + r.status + ")");
      return r.json();
    });
  }

  function goi(ham, than) {
    return fetch(API + "/rpc/" + ham, {
      method: "POST", headers: dau(), body: JSON.stringify(than)
    }).then(function (r) {
      return r.text().then(function (t) {
        if (r.ok) return t ? JSON.parse(t) : null;
        if (t.indexOf("SAI_MAT_KHAU") >= 0) throw new Error("Sai mật khẩu chung.");
        if (t.indexOf("NOI_DUNG_TRONG") >= 0) throw new Error("Chưa gõ nội dung.");
        throw new Error("Không lưu được (" + r.status + ").");
      });
    });
  }

  /* ── Gom theo luồng ────────────────────────────────────────────────────── */
  function luong() {
    var goc = duLieu.filter(function (b) { return !b.tra_loi_cho; });
    return goc.map(function (b) {
      return { g: b, tra: duLieu.filter(function (x) { return x.tra_loi_cho === b.id; }) };
    });
  }

  /* ── Tìm lại đoạn trích trong trang và bọc <mark> ──────────────────────── */
  function vungChu() {
    return document.querySelector("main") || document.body;
  }

  function boDauCu() {
    Array.prototype.forEach.call(document.querySelectorAll("mark.bl-hl"), function (m) {
      var cha = m.parentNode;
      while (m.firstChild) cha.insertBefore(m.firstChild, m);
      cha.removeChild(m);
      cha.normalize();
    });
  }

  function timVaDanhDau() {
    boDauCu();
    luong().forEach(function (l) {
      var b = l.g;
      if (!b.trich) return;
      var v = timDoan(b.trich, b.truoc);
      if (!v) return;
      var marks = boc(v.b, v.tu, v.den, function () {
        var m = document.createElement("mark");
        m.className = "bl-hl" + (b.da_xong ? " bl-xong" : "");
        m.setAttribute("data-bl-id", String(b.id));
        m.setAttribute("title", b.nguoi + ": " + b.noi_dung.slice(0, 80));
        return m;
      });
      if (!marks.length) return;
      // Con số hiện bằng CSS ::after chứ KHÔNG bằng một <span> nhét vào <mark>:
      // chữ trong <mark> là chữ THẬT của tài liệu, nhét thêm vào đó là người
      // đọc chép đi một con số không có trong hồ sơ.
      marks[marks.length - 1].setAttribute("data-bl-so", String(1 + l.tra.length));
    });
  }

  /* Bọc đoạn [tu, den) của chuỗi phẳng bằng một hoặc NHIỀU <mark>.
     Phải làm từng nút văn bản một: đoạn trích thường vắt qua <strong>, mà
     Range.surroundContents ném lỗi ngay khi nó chỉ ôm một phần của thẻ đó. */
  function boc(b, tu, den, taoMark) {
    var marks = [];
    for (var k = 0; k < b.nut.length; k++) {
      var t = b.nut[k], dai = t.n.nodeValue.length;
      var d0 = t.tu, d1 = t.tu + dai;
      if (d1 <= tu || d0 >= den) continue;
      var a = Math.max(tu, d0) - d0, z = Math.min(den, d1) - d0;
      if (z <= a) continue;
      var nut = t.n;
      if (!nut.parentNode) continue;
      if (z < dai) nut.splitText(z);
      if (a > 0) nut = nut.splitText(a);
      var m = taoMark();
      nut.parentNode.insertBefore(m, nut);
      m.appendChild(nut);
      marks.push(m);
    }
    return marks;
  }

  /* Quét mọi nút văn bản trong vùng nội dung, nối thành một chuỗi phẳng kèm
     bản đồ vị trí, rồi tìm chuỗi trích trên chuỗi phẳng đó. Nhờ vậy đoạn trích
     nằm vắt qua <strong> vẫn tìm ra được. */
  function batDau() {
    var vung = vungChu(), nut = [], chuoi = "";
    var w = document.createTreeWalker(vung, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode;
        while (p && p !== vung) {
          var tn = p.nodeName;
          if (tn === "SCRIPT" || tn === "STYLE" || tn === "SVG" || tn === "svg") return NodeFilter.FILTER_REJECT;
          if (p.classList && p.classList.contains("bl-root")) return NodeFilter.FILTER_REJECT;
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = w.nextNode())) { nut.push({ n: n, tu: chuoi.length }); chuoi += n.nodeValue; }
    return { nut: nut, chuoi: chuoi };
  }

  function timDoan(trich, truoc) {
    var b = batDau();
    var i = -1;
    if (truoc) {
      var j = b.chuoi.indexOf(truoc + trich);
      if (j >= 0) i = j + truoc.length;
    }
    if (i < 0) i = b.chuoi.indexOf(trich);
    if (i < 0) return null;
    return { b: b, tu: i, den: i + trich.length };
  }

  /* ── Nút "Ghi chú" khi bôi đen ─────────────────────────────────────────── */
  function neoGan(nut) {
    var p = nut.nodeType === 3 ? nut.parentNode : nut;
    while (p && p !== document.body) {
      if (p.id) return p.id;
      p = p.parentNode;
    }
    return null;
  }

  function xemChon() {
    var s = window.getSelection();
    if (!s || s.isCollapsed) { anNutChon(); return; }
    var t = s.toString().replace(/\s+/g, " ").trim();
    if (t.length < 3) { anNutChon(); return; }
    var r = s.getRangeAt(0);
    if (!vungChu().contains(r.commonAncestorContainer)) { anNutChon(); return; }
    if (goc && goc.contains(r.commonAncestorContainer)) { anNutChon(); return; }

    var b = batDau();
    var tho = s.toString();
    var i = b.chuoi.indexOf(tho);
    var truoc = i > 0 ? b.chuoi.slice(Math.max(0, i - 40), i) : "";

    chonHienTai = { trich: tho.slice(0, 400), truoc: truoc, neo: neoGan(r.startContainer) };

    var hop = r.getBoundingClientRect();
    if (!nutChon) {
      nutChon = document.createElement("button");
      nutChon.type = "button";
      nutChon.className = "bl-chon";
      nutChon.textContent = "💬 Ghi chú";
      nutChon.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        moNgan(null, chonHienTai);
        anNutChon();
      });
      document.body.appendChild(nutChon);
    }
    nutChon.style.display = "block";
    var tren = hop.top + window.scrollY - 52;
    if (tren < window.scrollY + 6) tren = hop.bottom + window.scrollY + 8;
    nutChon.style.top = tren + "px";
    nutChon.style.left = Math.max(8, Math.min(hop.left + window.scrollX, window.innerWidth - 150)) + "px";
  }

  function anNutChon() { if (nutChon) nutChon.style.display = "none"; }

  /* ── Ngăn kéo ──────────────────────────────────────────────────────────── */
  var nen = null, ngan = null;

  function moNgan(loc, chon) {
    dungNgan();
    ve(loc, chon);
    document.addEventListener("keydown", phimEsc);
  }

  function phimEsc(e) { if (e.key === "Escape") dongNgan(); }

  function dungNgan() {
    if (ngan) return;
    nen = document.createElement("div");
    nen.className = "bl-nen";
    nen.addEventListener("click", dongNgan);
    ngan = document.createElement("div");
    ngan.className = "bl-ngan";
    ngan.setAttribute("role", "dialog");
    ngan.setAttribute("aria-label", "Sổ bình luận của trang");
    goc.appendChild(nen);
    goc.appendChild(ngan);
  }

  function dongNgan() {
    document.removeEventListener("keydown", phimEsc);
    if (nen) { nen.remove(); nen = null; }
    if (ngan) { ngan.remove(); ngan = null; }
  }

  function chu(t) { return document.createTextNode(t); }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function ngay(s) {
    try {
      var d = new Date(s);
      var hai = function (n) { return (n < 10 ? "0" : "") + n; };
      return hai(d.getDate()) + "/" + hai(d.getMonth() + 1) + " " + hai(d.getHours()) + ":" + hai(d.getMinutes());
    } catch (e) { return ""; }
  }

  /* loc: null = cả trang · {id} = một luồng · chon = đang tạo ghi chú mới */
  function ve(loc, chon) {
    ngan.innerHTML = "";

    var dau = el("div", "bl-dau");
    var ten = chon ? "Ghi chú mới" : (loc ? "Một ghi chú" : "Ghi chú trên trang này");
    dau.appendChild(el("h2", null, ten));
    var nutDong = el("button", "bl-dong", "×");
    nutDong.type = "button";
    nutDong.setAttribute("aria-label", "Đóng");
    nutDong.addEventListener("click", dongNgan);
    dau.appendChild(nutDong);
    ngan.appendChild(dau);

    var than = el("div", "bl-than");
    ngan.appendChild(than);

    var ds = luong();
    if (loc) ds = ds.filter(function (l) { return l.g.id === loc.id; });

    if (chon) {
      var tr = el("p", "bl-trich", "“" + chon.trich + "”");
      than.appendChild(tr);
    } else if (!ds.length) {
      than.appendChild(el("p", "bl-trong",
        "Chưa có ghi chú nào trên trang này. Bôi đen một đoạn chữ bất kỳ rồi bấm “Ghi chú”."));
    }

    ds.forEach(function (l) {
      than.appendChild(veMot(l.g, false, l.tra.length));
      l.tra.forEach(function (t) { than.appendChild(veMot(t, true, 0)); });
      var traLoi = el("div", "bl-viec");
      var b = el("button", null, "Trả lời");
      b.type = "button";
      b.addEventListener("click", function () { ve({ id: l.g.id }, { traLoiCho: l.g.id, trich: l.g.trich }); });
      traLoi.appendChild(b);
      than.appendChild(traLoi);
    });

    ngan.appendChild(veSoan(chon));
    var o = ngan.querySelector("textarea");
    if (o) o.focus();
  }

  function veMot(b, laTra, soTra) {
    var box = el("div", "bl-mot" + (laTra ? " bl-tra" : ""));
    var ai = el("div", "bl-ai");
    ai.appendChild(el("b", null, b.nguoi));
    ai.appendChild(chu(ngay(b.tao_luc)));
    if (b.da_xong) ai.appendChild(el("span", "bl-co-xong", "đã xử lý"));
    if (!laTra && soTra) ai.appendChild(chu(soTra + " trả lời"));
    box.appendChild(ai);
    if (!laTra && b.trich) box.appendChild(el("p", "bl-trich", "“" + b.trich + "”"));
    box.appendChild(el("p", "bl-noi", b.noi_dung));

    if (!laTra) {
      var viec = el("div", "bl-viec");
      var x = el("button", null, b.da_xong ? "Bỏ dấu đã xử lý" : "Đánh dấu đã xử lý");
      x.type = "button";
      x.addEventListener("click", function () {
        var mk = hoiMatKhau();
        if (mk === null) return;
        x.disabled = true;
        goi("danh_dau_xong", { p_mat_khau: mk, p_id: b.id, p_xong: !b.da_xong })
          .then(taiLai)
          .catch(function (e) { alert(e.message); x.disabled = false; });
      });
      viec.appendChild(x);

      var d = el("button", null, "Xoá");
      d.type = "button";
      d.addEventListener("click", function () {
        if (!confirm("Xoá ghi chú này và mọi trả lời của nó?")) return;
        var mk = hoiMatKhau();
        if (mk === null) return;
        d.disabled = true;
        goi("xoa_binh_luan", { p_mat_khau: mk, p_id: b.id })
          .then(taiLai)
          .catch(function (e) { alert(e.message); d.disabled = false; });
      });
      viec.appendChild(d);
      box.appendChild(viec);
    }
    return box;
  }

  function hoiMatKhau() {
    var cu = NHO.mk();
    if (cu) return cu;
    var v = prompt("Mật khẩu chung để ghi vào sổ:");
    if (v === null) return null;
    NHO.mk(v);
    return v;
  }

  function veSoan(chon) {
    var s = el("div", "bl-soan");

    var hang = el("div", "bl-hang");
    var oTen = el("div");
    oTen.appendChild(el("label", null, "Tên"));
    var iTen = document.createElement("input");
    iTen.type = "text";
    iTen.placeholder = "Ai đang ghi";
    iTen.value = NHO.ten();
    oTen.appendChild(iTen);
    var oMk = el("div");
    oMk.appendChild(el("label", null, "Mật khẩu chung"));
    var iMk = document.createElement("input");
    iMk.type = "password";
    iMk.value = NHO.mk();
    oMk.appendChild(iMk);
    hang.appendChild(oTen);
    hang.appendChild(oMk);
    s.appendChild(hang);

    s.appendChild(el("label", null, chon && chon.traLoiCho ? "Trả lời" : "Nội dung ghi chú"));
    var ta = document.createElement("textarea");
    ta.placeholder = "Viết cái phải sửa, hoặc câu hỏi cho người làm.";
    s.appendChild(ta);

    var bao = el("p", "bl-bao");
    bao.hidden = true;
    s.appendChild(bao);

    var gui = el("button", "bl-gui", "Lưu vào sổ");
    gui.type = "button";
    gui.addEventListener("click", function () {
      bao.hidden = true;
      bao.className = "bl-bao";
      if (!ta.value.trim()) { hienBao(bao, "Chưa gõ nội dung."); return; }
      if (!iMk.value.trim()) { hienBao(bao, "Chưa gõ mật khẩu chung."); return; }
      NHO.ten(iTen.value.trim());
      NHO.mk(iMk.value);
      gui.disabled = true;
      gui.textContent = "Đang lưu…";
      var than = {
        p_mat_khau: iMk.value,
        p_trang: TRANG,
        p_noi_dung: ta.value,
        p_nguoi: iTen.value.trim() || "Khách",
        p_neo: chon && chon.neo ? chon.neo : null,
        p_trich: chon && !chon.traLoiCho ? chon.trich : null,
        p_truoc: chon && !chon.traLoiCho ? chon.truoc : null,
        p_tra_loi_cho: chon && chon.traLoiCho ? chon.traLoiCho : null
      };
      goi("them_binh_luan", than).then(function () {
        ta.value = "";
        return taiLai();
      }).then(function () {
        dongNgan();
      }).catch(function (e) {
        gui.disabled = false;
        gui.textContent = "Lưu vào sổ";
        hienBao(bao, e.message);
      });
    });
    s.appendChild(gui);
    return s;
  }

  function hienBao(p, t) { p.textContent = t; p.hidden = false; }

  /* ── Nút nổi ───────────────────────────────────────────────────────────── */
  var nutNoi = null;
  function veNutNoi() {
    if (!nutNoi) {
      nutNoi = el("button", "bl-nut");
      nutNoi.type = "button";
      nutNoi.appendChild(chu("💬 Ghi chú"));
      var dem = el("span", "bl-dem", "0");
      nutNoi.appendChild(dem);
      nutNoi.addEventListener("click", function () { moNgan(null, null); });
      goc.appendChild(nutNoi);
    }
    var mo = duLieu.filter(function (b) { return !b.tra_loi_cho && !b.da_xong; }).length;
    nutNoi.querySelector(".bl-dem").textContent = String(mo);
    nutNoi.setAttribute("aria-label", "Mở sổ ghi chú — " + mo + " ghi chú chưa xử lý");
  }

  /* ── Tải lại và vẽ lại ─────────────────────────────────────────────────── */
  function taiLai() {
    return doc().then(function (ds) {
      duLieu = ds || [];
      timVaDanhDau();
      veNutNoi();
      if (ngan) ve(null, null);
    }).catch(function (e) {
      duLieu = [];
      veNutNoi();
      console.warn("[bình luận]", e.message);
    });
  }

  /* ── Khởi động ─────────────────────────────────────────────────────────── */
  function chay() {
    goc = el("div", "bl-root");
    document.body.appendChild(goc);

    document.addEventListener("mouseup", function () { setTimeout(xemChon, 10); });
    document.addEventListener("touchend", function () { setTimeout(xemChon, 60); });
    document.addEventListener("selectionchange", function () {
      var s = window.getSelection();
      if (!s || s.isCollapsed) anNutChon();
    });
    document.addEventListener("click", function (e) {
      var m = e.target.closest && e.target.closest("mark.bl-hl");
      if (!m) return;
      e.preventDefault();
      moNgan({ id: Number(m.getAttribute("data-bl-id")) }, null);
    });

    taiLai();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", chay);
  else chay();
})();
