import { version } from "../../package.json";

export type ChangeKind = "feature" | "improvement" | "fix";

export type Release = {
  version: string;
  /** Release day, `YYYY-MM-DD`. */
  date: string;
  title: string;
  description: string;
  changes: { kind: ChangeKind; text: string }[];
};

export const CHANGE_KINDS: { kind: ChangeKind; label: string }[] = [
  { kind: "feature", label: "Tính năng mới" },
  { kind: "improvement", label: "Cải tiến" },
  { kind: "fix", label: "Sửa lỗi" },
];

/** The running version, from package.json. */
export const CURRENT_VERSION = version;

/** Noon UTC so the day is the same in every timezone we format in. */
export const releaseDate = (r: Release) => new Date(`${r.date}T12:00:00Z`);

/**
 * Newest first. A release PR (develop → main) bumps `version` in package.json
 * and adds its entry here.
 */
export const RELEASES: Release[] = [
  {
    version: "0.2.0",
    date: "2026-10-28",
    title: "Trình xem media, hồ sơ cá nhân và quản lý link",
    description:
      "Trình xem riêng cho ảnh, video và audio. Admin quản lý user chi tiết hơn, mỗi người có trang hồ sơ với ảnh đại diện, và mọi link chia sẻ được gom về một trang.",
    changes: [
      {
        kind: "feature",
        text: "Trình xem ảnh mới: zoom bằng cuộn chuột, chụm tay hoặc nhấp đúp (tới 8x), kéo để di chuyển, vuốt để chuyển file trên điện thoại.",
      },
      {
        kind: "feature",
        text: "Trình phát video tự làm: tua có hiển thị phần đã tải, âm lượng, tốc độ, hình trong hình (PiP), toàn màn hình và phím tắt.",
      },
      {
        kind: "feature",
        text: "Hỗ trợ upload và nghe file audio: tự lấy thời lượng, tự phát bài kế tiếp, điều khiển từ màn hình khoá. Thêm bộ lọc \"Audio\".",
      },
      {
        kind: "feature",
        text: "Trang chi tiết user cho admin: sửa tên, email, vai trò; gửi email đặt lại mật khẩu hoặc đặt mật khẩu trực tiếp; đăng xuất mọi thiết bị; xem và thu hồi quyền folder.",
      },
      {
        kind: "feature",
        text: "Khoá / mở khoá tài khoản thay cho xoá. Tài khoản bị khoá bị đăng xuất ngay và link chia sẻ họ tạo ngừng hoạt động.",
      },
      {
        kind: "feature",
        text: "Trang \"Hồ sơ của tôi\": đổi tên hiển thị, tải lên ảnh đại diện (tự cắt vuông).",
      },
      {
        kind: "feature",
        text: "Trang \"Link chia sẻ\": xem mọi link trong các folder bạn quản lý, kèm trạng thái thật của từng link; đổi hạn, thu hồi một hoặc nhiều link, xoá link hết hạn, xem file trong link.",
      },
      {
        kind: "improvement",
        text: "Âm lượng, tắt tiếng và tốc độ phát được nhớ giữa các lần xem.",
      },
      {
        kind: "improvement",
        text: "Trên điện thoại, bảng thông tin file mở dạng sheet từ dưới lên.",
      },
      {
        kind: "improvement",
        text: "Ảnh đại diện hiện ở thanh bên, danh sách và chi tiết user, và người upload trong trình xem.",
      },
      {
        kind: "improvement",
        text: "Đăng nhập bằng tài khoản bị khoá báo rõ \"Tài khoản đã bị khoá, liên hệ admin\".",
      },
      {
        kind: "fix",
        text: "Video WebM quay từ trình duyệt (không có thời lượng) giờ tua được bình thường.",
      },
      {
        kind: "fix",
        text: "Link trong folder đã vào thùng rác giờ thu hồi được.",
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-10-04",
    title: "Ra mắt ReelRoom",
    description:
      "Phiên bản đầu tiên của thư viện ảnh và video nội bộ: folder có phân quyền, upload thẳng lên kho lưu trữ, tìm kiếm, thùng rác và link chia sẻ công khai.",
    changes: [
      {
        kind: "feature",
        text: "Thư viện theo folder, phân quyền viewer / editor / owner áp dụng cho cả cây con.",
      },
      {
        kind: "feature",
        text: "Upload ảnh và video dung lượng lớn thẳng lên kho lưu trữ, tự tạo thumbnail.",
      },
      {
        kind: "feature",
        text: "Tìm kiếm file và folder; thùng rác để khôi phục hoặc xoá vĩnh viễn.",
      },
      {
        kind: "feature",
        text: "Link chia sẻ công khai cho cả folder hoặc các file đã chọn, có thời hạn tuỳ chọn.",
      },
      {
        kind: "feature",
        text: "Admin mời người dùng bằng link; người được mời tự đặt tên và mật khẩu.",
      },
      {
        kind: "feature",
        text: "Gửi email qua SMTP (ví dụ Gmail) ngoài Resend.",
      },
      {
        kind: "feature",
        text: "Nút hiện / ẩn mật khẩu; bấm vào ô folder trống để chọn file upload.",
      },
      {
        kind: "improvement",
        text: "Chuyển trang tức thì với khung tải, máy chủ đặt ở Singapore cho nhanh hơn.",
      },
      {
        kind: "improvement",
        text: "Logo ReelRoom làm favicon và icon ứng dụng.",
      },
      {
        kind: "fix",
        text: "Upload không bắt đầu, và phím mũi tên trong trình xem không hoạt động.",
      },
      {
        kind: "fix",
        text: "Thumbnail upload lỗi được thử lại; file thiếu thumbnail được bổ sung khi mở xem.",
      },
      {
        kind: "fix",
        text: "Tên file / folder dài bị tràn trong các hộp thoại.",
      },
      {
        kind: "fix",
        text: "Lỗi hiển thị nút sao chép trong danh sách lời mời đang chờ.",
      },
    ],
  },
];
