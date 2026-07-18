// Centered, persistent notice dialog. The message stays on screen until
// the user explicitly dismisses it, so they have time to read and understand it.

export type NoticeOptions = {
  title?: string;
  message: string;
  description?: string;
  dismissLabel?: string;
  variant?: "error" | "warning" | "info" | "success";
};

export const NOTICE_EVENT = "sh:notice-dialog";

export function noticeToast(opts: NoticeOptions) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<NoticeOptions>(NOTICE_EVENT, { detail: opts }));
}

export const showNotice = noticeToast;
