# Rule dự án

- **Khi được yêu cầu commit title**: viết bằng **tiếng Anh**, đúng một dòng dạng `vX.Y.Z <tóm tắt>`.
  - Phần tóm tắt **tối đa 6 từ**, chỉ **một ý chính**.
  - Không dùng "and", dấu phẩy hay dấu "·" để nối nhiều ý.
  - Trước khi trả lời phải đếm số từ của phần tóm tắt; vượt 6 từ hoặc có từ nối nhiều ý thì viết lại.
  - Đúng: `v0.38.6 Smarter villager debt management`
  - Sai: `v0.38.6 Make villagers borrow within repayment capacity, cut spending when in debt and prioritize repaying loans`
- **Giữ luật game tách khỏi phần vẽ 3D**: logic mới (trạng thái, giá, phí, năng lượng, quyết định của NPC, kinh tế) phải nằm trong hàm/module không phụ thuộc Three.js hay DOM, giống `bank.js`, `certify.js`, `economy.js`, `market.js`.
  - Phần vẽ (model, hoạt ảnh, hiệu ứng, UI) chỉ gọi vào luật, không chứa luật.
  - Lý do: sau này làm thế giới chung, luật phải chạy được trên máy chủ (Node) mà không cần tách lại.
- **Nghiêm cấm viền cam/vàng bên trong popup**: không dùng `outline` (hay `box-shadow inset`, `border` lồng, pseudo-element) để vẽ khung màu cam/vàng (`--gold`, `--amber`...) thụt vào bên trong popup, dialog, panel. Khung popup chỉ giữ viền gỗ ngoài cùng.
  - Lý do: user rất ghét kiểu viền này; trước đây nó nằm trong style chung `dialog.paper` nên popup nào cũng dính.
- **Icon trên đầu nhân vật không được chồng lên nhau**: mọi icon trạng thái trên đầu (đói, lượt đặt ghế, chuyến đi...) của người chơi và dân làng phải xếp thành một hàng ngang, cách đều nhau, cả hàng canh giữa trên đầu nhân vật.
  - Thêm icon mới thì đưa vào hàng badge của `bubble.js` (giống `setMood`, `setTurn`, `setTrip`), không gắn sprite 3D riêng ở giữa đầu.
  - Lý do: trước đây badge lượt đặt ghế là sprite 3D riêng nên đè lên icon chén cơm.
- **Mọi icon trên đầu nhân vật phải do `bubble.js` quản lý**: tên, icon trạng thái, icon đang học... đều là badge trong hàng của `bubble.js` (thêm hàm `setXxx` như `setStudy`), tuyệt đối không tạo `THREE.Sprite` hay phần tử DOM riêng gắn lên đầu người chơi/dân làng.
  - Lý do: icon nằm ngoài `bubble.js` thì hàng badge không biết để chừa chỗ, nên bị đè lên tên và các icon khác (icon 📖 từng đè lên tên dân làng).
- **Nghiêm cấm phân biệt nghề nghiệp của dân làng**: trong game không có khái niệm nghề nghiệp, mọi người chỉ gọi chung là dân làng. Không tạo màu tên, nhãn, icon, cách gọi hay giao diện riêng theo nghề (học sinh, nông dân...).
