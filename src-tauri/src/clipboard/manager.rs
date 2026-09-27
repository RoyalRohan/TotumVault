/// Backward-compatible bridge for legacy callers.
/// Directs to the safe non-blocking OS cleaner.
pub fn clear_os_clipboard() {
    super::os_cleaner::safe_clear_os_clipboard();
}
