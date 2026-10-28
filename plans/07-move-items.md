# 07 — Di chuyển file và folder

> Nhánh `feat/move-items` từ `develop`, PR vào `develop`. Cần plan 06 (test) đã merge.

## Context
Hiện không có cách đổi chỗ một file hay folder. Muốn sắp xếp lại thư viện thì phải tải về rồi upload lại, mất thumbnail và ngày upload. Schema đã chuẩn bị cho việc này: comment trên bảng `folders` ghi "moves rewrite the prefix of the whole subtree".

Không cần migration.

## Luật
- **File:** cần editor ở folder hiện tại **và** editor ở folder đích. Folder đích phải còn sống.
- **Folder con:** cần editor ở folder đó (tức là ở cây chứa nó) **và** editor ở folder cha mới.
  - Không được chuyển vào chính nó hoặc folder con cháu của nó: `dest.path` khác `folder.path` và không bắt đầu bằng `folder.path + "/"`.
  - Trùng tên với folder anh em ở đích → index `folders_sibling_name_uq` báo lỗi, `run()` đã đổi thành "Đã có folder cùng tên ở đây".
- **Folder gốc (top-level):** bản này **không** cho di chuyển folder gốc, và không cho đưa folder con lên làm folder gốc. Folder gốc là không gian chung có grant owner riêng; đổi chỗ nó làm quyền thay đổi khó lường. Ghi rõ trong UI (mục "Di chuyển" không hiện ở card folder gốc).
- **Ảnh hưởng tới quyền (phải báo trong dialog):** grant đặt trên chính folder bị chuyển và các folder bên trong vẫn giữ. Quyền kế thừa thì đổi theo chỗ mới:
  - người chỉ có quyền ở folder cũ sẽ mất quyền;
  - người có quyền ở folder đích sẽ thấy nội dung.
- **Link chia sẻ:**
  - Link kiểu folder trên folder tổ tiên cũ tự nhiên không còn chứa nội dung đã chuyển; link trên chính folder bị chuyển vẫn chạy (nếu người tạo còn quyền editor ở chỗ mới, `resolveShareLink` đã kiểm).
  - Link kiểu "files": mọi file trong link phải nằm trong `link.folderId`, nhưng `findSharedFile` không kiểm folder. Vì vậy khi chuyển file ra khỏi folder, **xoá các dòng `share_link_files`** của file đó ở link thuộc folder cũ. Dialog báo trước: "N file đang nằm trong link chia sẻ sẽ bị gỡ khỏi link".

## Server (`src/server/actions.ts`)
- **`moveFiles(fileIds: string[], destFolderId: string)`**
  - zod: 1–500 uuid.
  - Load các file còn sống; tất cả phải cùng một folder nguồn (UI chỉ chọn trong một folder). Không cùng → `ForbiddenError`.
  - `requireFolderRole(source, "editor")`, `requireFolderRole(dest, "editor")`. Nguồn trùng đích → no-op.
  - `db.batch([...])`:
    1. `update files set folder_id = dest where id in (...) and folder_id = source and deleted_at is null` (điều kiện lặp lại để an toàn khi có thao tác song song);
    2. `delete from share_link_files where file_id in (...) and link_id in (select id from share_links where folder_id = source)`.
- **`moveFolder(folderId: string, destParentId: string)`**
  - Load folder; `parentId === null` → `ForbiddenError("Không di chuyển được folder gốc")`.
  - `requireFolderRole(folder, "editor")`, `requireFolderRole(dest, "editor")`; kiểm vòng lặp như trên. Đích là cha hiện tại → no-op.
  - Một câu `update` viết lại cả cây con, **kể cả folder con đang trong thùng rác** để `path` luôn nhất quán:
    ```sql
    update folders
    set path = ${dest.path + "/" + folder.id} || substr(path, ${folder.path.length + 1}),
        parent_id = case when id = ${folder.id} then ${dest.id} else parent_id end
    where path = ${folder.path} or path like ${folder.path + "/%"}
    ```
  - Đặt câu này trong `db.batch` cùng các thay đổi phụ (plan 12 sẽ thêm dòng nhật ký).
- **`getMoveTargets()`** (server action, `refresh: false`):
  - Các folder còn sống mà user có quyền editor, dùng `grantedOn(session, folders.path, "editor")`.
  - Trả `{ id, name, parentId, path }`. Lọc ở client để dựng cây.
  - Giới hạn 2000 dòng; nếu quá thì client chỉ dùng ô tìm kiếm.

## UI
- **`src/components/folders/move-dialog.tsx` (mới):**
  - Props: `items` (file hoặc một folder), `sourceFolderId`, `onMoved`.
  - Mở ra thì gọi `getMoveTargets()`; hiện cây folder có thể mở/đóng, ô tìm theo tên, mỗi dòng hiện đường dẫn đầy đủ khi đang tìm.
  - Vô hiệu hoá: folder nguồn, và khi chuyển folder thì chính nó cùng cây con.
  - Phần cảnh báo dưới cây: đổi quyền (khi chuyển ra khỏi folder gốc hiện tại) và số file sẽ bị gỡ khỏi link.
  - Nút "Chuyển tới đây". Thành công → toast "Đã chuyển N file" kèm nút "Mở folder" (`/f/{dest}`).
- **Lối vào:**
  - `FileGrid` → menu của `FileCard` thêm "Di chuyển" (`FolderInputIcon`) khi `canEdit`.
  - `MediaViewer`: thêm `onMove` cạnh `onRename` / `onDelete`.
  - `FolderGrid` → `SubfolderCard` thêm "Di chuyển" khi `can.rename(role)` và không phải folder gốc.
  - Chọn nhiều để di chuyển: làm ở plan 08.
- Kéo thả file vào folder: **ngoài phạm vi**, để sau nếu cần.

## Test (thêm vào bộ test của plan 06)
- Chuyển folder 3 tầng: mọi `path` con cháu đổi đúng, `parentId` chỉ đổi ở folder gốc của thao tác.
- Chuyển vào chính nó / con cháu → lỗi. Chuyển folder gốc → lỗi.
- Thiếu editor ở nguồn hoặc đích → lỗi; viewer ở đích → `ForbiddenError`.
- Sau khi chuyển, user chỉ có grant ở folder cũ không còn đọc được file (`requireFolderRole` → NotFound).
- `share_link_files` bị gỡ khi chuyển file ra khỏi folder của link.

## Files
- **Sửa:** `src/server/actions.ts`, `src/components/folders/{file-grid,file-card,folder-grid,folder-card}.tsx`, `src/components/viewer/media-viewer.tsx`.
- **Mới:** `src/components/folders/move-dialog.tsx`, `src/server/actions.move.test.ts`.

## Verification
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- Trình duyệt: chuyển một file sang folder khác → biến mất ở nguồn, hiện ở đích, thumbnail giữ nguyên. Chuyển một folder có con cháu → mở được cây ở chỗ mới, breadcrumb đúng.
- Đăng nhập user viewer: không thấy mục "Di chuyển".
- Mở link chia sẻ kiểu "files" sau khi chuyển một file trong đó ra ngoài → file không còn trong link.
