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
