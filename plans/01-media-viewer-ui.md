# 01 — Media viewer UI tự viết (photo, video, audio)

> Khi được duyệt: bước đầu tiên là lưu plan này vào `plans/01-media-viewer-ui.md` (prefix `NN-` để biết thứ tự; plan sau là `02-…`).

## Context
Viewer hiện tại (`src/components/folders/media-preview.tsx`) là Dialog full-screen dùng `<video controls>` và `<img>` native: controls của trình duyệt, khác nhau mỗi browser, không hợp theme tối `bg-stage`, ảnh không zoom được, mobile không có swipe/info. Audio chưa được hỗ trợ ở đâu cả (upload chỉ nhận `image/*`, `video/*`). Mục tiêu: tự viết UI viewer thống nhất cho ảnh, video, audio trên element native, không thêm dependency; mở upload cho audio.

## Phần A — Hỗ trợ audio (upload + data)
- `src/lib/upload-limits.ts`: `isMediaType` thêm `audio/`. Thông báo lỗi ở `src/app/api/uploads/route.ts:16` → "Chỉ hỗ trợ ảnh, video và audio".
- `src/lib/media.ts`: thêm `isAudio`, `isImage`, và `mediaKind(file): "image" | "video" | "audio"`; thay các chỗ suy luận "không phải video = ảnh" (`file-grid.tsx:45-48,134`, info "Loại" trong viewer).
- `src/components/upload/folder-dropzone.tsx`: `ACCEPT` thêm `audio/*`.
- `src/components/upload/thumbnail.ts`: `extractMediaInfo`/`extractMediaInfoFromUrl` thêm nhánh `audio/` → `fromAudio(url)` dùng `<audio preload="metadata">` chỉ lấy `durationMs`, `thumb: null` (không backfill thumb cho audio: sửa điều kiện ở `file-grid.tsx:53` để bỏ qua audio).
- `src/components/folders/media-thumb.tsx`: thêm tile audio (ToneTile + `MusicIcon` lucide) khi file là audio; `DurationBadge` nhận `kind` để đổi icon/sr-only label. Cập nhật `file-card.tsx`, `recent-grid.tsx`, `trash-list.tsx` dùng `mediaKind`.
- `file-grid.tsx`: filter thêm chip "Audio" + count.
- DB không đổi (`mimeType`, `durationMs` đã có). `presignRead` trả content-type từ `mimeType` → `<audio>` stream được.

## Phần B — Viewer shell mới
Thư mục mới `src/components/viewer/`, thay `media-preview.tsx` (giữ nguyên API props `files, folderName, index, onIndexChange, onRename, onDelete` để 2 chỗ dùng — `src/app/(app)/f/[folderId]/page.tsx` qua `file-grid.tsx:151` và `src/app/s/[token]/page.tsx` — không phải sửa).
- `media-viewer.tsx`: Dialog full-screen như cũ (header, download, dropdown rename/delete, chevrons, filmstrip, aside info). Thân render theo `mediaKind`: `<ImageViewer>`, `<VideoPlayer>`, `<AudioPlayer>`, mỗi cái `key={file.id}`.
- `info-panel.tsx`: tách aside hiện tại (InfoRow, uploader, vị trí). Desktop `lg:` hiện cạnh phải như cũ; mobile thêm nút `InfoIcon` trên header mở `Sheet` (`src/components/ui/sheet.tsx`, side bottom) cùng nội dung.
- `use-viewer-hotkeys.ts`: listener capture-phase trên window như hiện tại. Quy ước:
  - Ảnh: `←/→` chuyển file.
  - Video/audio: `←/→` tua ±5s, `J/L` ±10s, `Space/K` play/pause, `↑/↓` volume, `M` mute, `F` fullscreen (video), `,`/`.` đổi tốc độ.
  - Mọi loại: `Shift+←/→` chuyển file; `Esc` đóng (Dialog mặc định; khi đang fullscreen thì Esc thoát fullscreen trước).
  - Bỏ qua khi target là input/textarea hoặc menu đang mở.
- Swipe trái/phải trên mobile để chuyển file (pointer events, ngưỡng ~60px, chỉ khi ảnh chưa zoom và không kéo trên seek bar).

## Phần C — Photo viewer (`image-viewer.tsx`)
- `<img>` trong container `overflow-hidden`, transform `translate + scale` qua state.
- Zoom: wheel (quanh vị trí con trỏ), double-click/double-tap toggle fit ↔ 2x, pinch 2 ngón (pointer events), nút `+ / − / Fit` nổi góc dưới với % zoom; giới hạn 1x–8x; pan bằng kéo khi >1x, clamp mép.
- Loading: hiện `MediaThumb` mờ làm placeholder tới khi `onLoad`; lỗi decode (vd HEIC ngoài Safari) → khối thông báo + nút Tải về.
- Preload ảnh kế tiếp/trước (`new Image().src`) cho chuyển nhanh.

## Phần D — Media player chung (video + audio)
`src/components/viewer/player/`:
- `use-media-state.ts`: hook nhận ref `HTMLMediaElement`, subscribe events (`play, pause, timeupdate, durationchange, progress, volumechange, ratechange, waiting, playing, ended, error`) → `{ playing, currentTime, duration, buffered, volume, muted, rate, waiting, ended, error }` + actions `toggle, seek, seekBy, setVolume, toggleMute, setRate`.
- Pref volume/muted/rate lưu `localStorage` (try/catch) dùng chung video và audio.
- `seek-bar.tsx`: track + buffered + progress, kéo bằng pointer capture, tooltip thời gian khi hover/drag, `role="slider"` với `aria-valuetext` (dùng `formatDuration` ở `src/lib/format.ts:36`, đổi giây → ms), phím mũi tên khi focus.
- `volume-control.tsx`: nút mute + slider ngang (ẩn trên mobile, chỉ còn nút mute).
- `speed-menu.tsx`: `DropdownMenu` 0.5/0.75/1/1.25/1.5/2.
- `time-display.tsx`: `00:12 / 04:12` font-mono.
- Không thêm slider primitive từ shadcn: seek/volume tự viết cùng một `slider-track` nhỏ để kiểm soát buffered layer.

## Phần E — Video player (`video-player.tsx`)
- `<video playsInline autoPlay>` không `controls`; container là đích `requestFullscreen` (fallback `webkitEnterFullscreen` trên iOS).
- Controls overlay gradient đáy: play, seek bar, time, volume, speed, PiP (`requestPictureInPicture` nếu hỗ trợ), fullscreen. Nút play lớn giữa khi pause/ended; spinner khi `waiting`.
- Auto-hide controls + cursor sau 2.5s không di chuột khi đang play; hiện lại khi move/tap/focus.
- Click video = play/pause, double-click = fullscreen; mobile: tap = hiện/ẩn controls, double-tap nửa trái/phải = ±10s với ripple hiển thị.
- Lỗi phát (codec không hỗ trợ) → thông báo + Tải về.

## Phần F — Audio player (`audio-player.tsx`)
- Thẻ lớn giữa stage: artwork = tile audio (ToneTile theo `file.id` + `MusicIcon`), tên file, thời lượng; bên dưới seek bar, cụm play/±10s, volume, speed.
- `<audio>` ẩn (không `controls`), `autoPlay`. Khi `ended` và file kế tiếp cũng là audio → tự chuyển (`onIndexChange(index+1)`).
- Media Session API (`navigator.mediaSession.metadata` + handler play/pause/seek/previoustrack/nexttrack) để điều khiển từ lock screen/phím media.

## Files chính
- Mới: `src/components/viewer/{media-viewer,info-panel,image-viewer,video-player,audio-player,use-viewer-hotkeys}.tsx|ts`, `src/components/viewer/player/{use-media-state,seek-bar,volume-control,speed-menu,time-display}.tsx|ts`.
- Sửa: `src/lib/media.ts`, `src/lib/upload-limits.ts`, `src/app/api/uploads/route.ts`, `src/components/upload/{thumbnail.ts,folder-dropzone.tsx}`, `src/components/folders/{file-grid,file-card,media-thumb,recent-grid}.tsx`, `src/components/trash/trash-list.tsx`, 2 trang import viewer.
- Xoá: `src/components/folders/media-preview.tsx` sau khi thay.
- Tái dùng: `useMediaUrls` (`media-urls.tsx`), `MediaThumb`/`ToneTile`, `formatDuration`/`formatBytes`/`formatDateTime`, `useIsMobile` (`src/hooks/use-mobile.ts`), `Button`, `DropdownMenu`, `Sheet`, `Tooltip`. Base UI: dùng `render` prop, menu item `onClick`.

## Thứ tự làm
1. A (audio data/upload) → 2. B shell + info panel + hotkeys → 3. C photo → 4. D player chung → 5. E video → 6. F audio.

## Verification
- `pnpm typecheck && pnpm lint && pnpm build` (Node 22: `export PATH=~/.nvm/versions/node/v22.13.0/bin:$PATH`).
- `preview_start` dev server, trong browser pane:
  - Upload 1 ảnh, 1 video, 1 mp3 vào folder → audio được nhận, có duration, tile audio trong grid, filter "Audio" đúng count.
  - Ảnh: wheel zoom, double-click, pan, Fit, `←/→` chuyển file.
  - Video: play/pause, kéo seek bar, buffered, volume/mute, speed, fullscreen, PiP, auto-hide controls, hotkeys, `Shift+→` chuyển file.
  - Audio: phát, seek, auto-next sang audio kế, Media Session (check `navigator.mediaSession.metadata` qua javascript_tool).
  - `resize_window` mobile: swipe chuyển file, nút info mở Sheet, controls tap.
  - Trang share công khai `/s/[token]`: viewer chạy với `sharedMediaUrls`, ẩn uploader.
  - Console không lỗi.
