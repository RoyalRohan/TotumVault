use chrono::NaiveDate;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Milestone {
    FiveDays = 5,
    FourDays = 4,
    ThreeDays = 3,
    TwoDays = 2,
    Tomorrow = 1,
    Today = 0,
    Expired = -1,
}

impl Milestone {
    pub fn value(&self) -> i32 {
        *self as i32
    }

    pub fn from_days(days: i64) -> Option<Self> {
        match days {
            5 => Some(Milestone::FiveDays),
            4 => Some(Milestone::FourDays),
            3 => Some(Milestone::ThreeDays),
            2 => Some(Milestone::TwoDays),
            1 => Some(Milestone::Tomorrow),
            0 => Some(Milestone::Today),
            d if d <= -1 => Some(Milestone::Expired),
            _ => None,
        }
    }

    pub fn notification_message(&self, title: &str) -> String {
        match self {
            Milestone::FiveDays => format!("{} expires in 5 days.", title),
            Milestone::FourDays => format!("{} expires in 4 days.", title),
            Milestone::ThreeDays => format!("{} expires in 3 days.", title),
            Milestone::TwoDays => format!("{} expires in 2 days.", title),
            Milestone::Tomorrow => format!("{} expires tomorrow.", title),
            Milestone::Today => format!("{} expires today.", title),
            Milestone::Expired => format!("{} has expired.", title),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DueReminder {
    pub document_id: String,
    pub title: String,
    pub milestone: Milestone,
    pub message: String,
    pub target_date: String,
}

/// Evaluates whether a document needs an OS notification on `today`.
///
/// Rules:
/// 1. `reminder_enabled` must be true.
/// 2. `expiry_date_str` must parse as `YYYY-MM-DD`.
/// 3. Within countdown window (5, 4, 3, 2, 1, 0, -1).
/// 4. If `diff_days < -1`: only fires if `last_milestone != Some(-1)` (one-time post-expiry catchup).
/// 5. Suppressed if `last_date == Some(today_str)` (never send multiple reminders on the same day).
/// 6. Suppressed if `last_milestone == Some(current_milestone)`.
pub fn evaluate_reminder(
    doc_id: &str,
    doc_title: &str,
    expiry_date_str: &str,
    reminder_enabled: bool,
    last_milestone: Option<i32>,
    last_date: Option<&str>,
    today: NaiveDate,
) -> Option<DueReminder> {
    if !reminder_enabled {
        return None;
    }

    let trimmed = expiry_date_str.trim();
    if trimmed.is_empty() {
        return None;
    }

    let expiry = NaiveDate::parse_from_str(trimmed, "%Y-%m-%d").ok()?;
    let diff_days = (expiry - today).num_days();
    let today_str = today.format("%Y-%m-%d").to_string();

    let milestone = Milestone::from_days(diff_days)?;

    // If document already expired before today (diff_days < -1),
    // only deliver if we have NEVER delivered the Expired milestone before.
    if diff_days < -1 && last_milestone == Some(Milestone::Expired.value()) {
        return None;
    }

    // Suppress if already delivered a reminder today for this document
    if let Some(ld) = last_date {
        if ld == today_str {
            return None;
        }
    }

    // Suppress if this milestone was already delivered
    if let Some(lm) = last_milestone {
        if lm == milestone.value() {
            return None;
        }
    }

    Some(DueReminder {
        document_id: doc_id.to_string(),
        title: doc_title.to_string(),
        milestone,
        message: milestone.notification_message(doc_title),
        target_date: today_str,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_disabled_reminder_returns_none() {
        let today = NaiveDate::from_ymd_opt(2026, 10, 1).unwrap();
        let res = evaluate_reminder("doc1", "Passport", "2026-10-06", false, None, None, today);
        assert_eq!(res, None);
    }

    #[test]
    fn test_invalid_date_returns_none() {
        let today = NaiveDate::from_ymd_opt(2026, 10, 1).unwrap();
        let res = evaluate_reminder("doc1", "Passport", "invalid-date", true, None, None, today);
        assert_eq!(res, None);
    }

    #[test]
    fn test_empty_date_returns_none() {
        let today = NaiveDate::from_ymd_opt(2026, 10, 1).unwrap();
        let res = evaluate_reminder("doc1", "Passport", "", true, None, None, today);
        assert_eq!(res, None);
    }

    #[test]
    fn test_future_beyond_5_days_returns_none() {
        let today = NaiveDate::from_ymd_opt(2026, 10, 1).unwrap();
        // 6 days away
        let res = evaluate_reminder("doc1", "Passport", "2026-10-07", true, None, None, today);
        assert_eq!(res, None);
    }

    #[test]
    fn test_milestone_countdown_messages() {
        let base_today = NaiveDate::from_ymd_opt(2026, 10, 1).unwrap();

        // 5 days away
        let r5 = evaluate_reminder("doc1", "Passport", "2026-10-06", true, None, None, base_today).unwrap();
        assert_eq!(r5.milestone, Milestone::FiveDays);
        assert_eq!(r5.message, "Passport expires in 5 days.");

        // 4 days away
        let r4 = evaluate_reminder("doc1", "Passport", "2026-10-05", true, None, None, base_today).unwrap();
        assert_eq!(r4.milestone, Milestone::FourDays);
        assert_eq!(r4.message, "Passport expires in 4 days.");

        // 3 days away
        let r3 = evaluate_reminder("doc1", "Passport", "2026-10-04", true, None, None, base_today).unwrap();
        assert_eq!(r3.milestone, Milestone::ThreeDays);
        assert_eq!(r3.message, "Passport expires in 3 days.");

        // 2 days away
        let r2 = evaluate_reminder("doc1", "Passport", "2026-10-03", true, None, None, base_today).unwrap();
        assert_eq!(r2.milestone, Milestone::TwoDays);
        assert_eq!(r2.message, "Passport expires in 2 days.");

        // 1 day away (tomorrow)
        let r1 = evaluate_reminder("doc1", "Passport", "2026-10-02", true, None, None, base_today).unwrap();
        assert_eq!(r1.milestone, Milestone::Tomorrow);
        assert_eq!(r1.message, "Passport expires tomorrow.");

        // 0 days away (today)
        let r0 = evaluate_reminder("doc1", "Passport", "2026-10-01", true, None, None, base_today).unwrap();
        assert_eq!(r0.milestone, Milestone::Today);
        assert_eq!(r0.message, "Passport expires today.");

        // -1 day (yesterday / expired)
        let rm1 = evaluate_reminder("doc1", "Passport", "2026-09-30", true, None, None, base_today).unwrap();
        assert_eq!(rm1.milestone, Milestone::Expired);
        assert_eq!(rm1.message, "Passport has expired.");
    }

    #[test]
    fn test_same_day_idempotency_suppresses_duplicate() {
        let today = NaiveDate::from_ymd_opt(2026, 10, 1).unwrap();
        // Today is 2026-10-01, document expires 2026-10-04 (3 days).
        // If last_date is today, it should NOT fire.
        let res = evaluate_reminder("doc1", "License", "2026-10-04", true, Some(3), Some("2026-10-01"), today);
        assert_eq!(res, None);
    }

    #[test]
    fn test_already_delivered_milestone_suppressed() {
        let today = NaiveDate::from_ymd_opt(2026, 10, 1).unwrap();
        // Today is 2026-10-01, document expires 2026-10-04 (3 days).
        // If last_milestone is 3 (delivered earlier), return None.
        let res = evaluate_reminder("doc1", "License", "2026-10-04", true, Some(3), Some("2026-09-30"), today);
        assert_eq!(res, None);
    }

    #[test]
    fn test_missed_days_suppression() {
        // App was closed since day 7. User launches app on day 2 before expiry.
        let today = NaiveDate::from_ymd_opt(2026, 10, 8).unwrap();
        let expiry = "2026-10-10"; // diff_days = 2
        let res = evaluate_reminder("doc1", "Billbook", expiry, true, None, None, today).unwrap();
        assert_eq!(res.milestone, Milestone::TwoDays);
        assert_eq!(res.message, "Billbook expires in 2 days.");
        // Only 1 reminder generated for today; days 5, 4, 3 are skipped.
    }

    #[test]
    fn test_post_expiry_single_delivery() {
        // Document expired 20 days ago, never notified
        let today = NaiveDate::from_ymd_opt(2026, 10, 20).unwrap();
        let expiry = "2026-09-30"; // diff_days = -20
        let res = evaluate_reminder("doc1", "Insurance", expiry, true, None, None, today).unwrap();
        assert_eq!(res.milestone, Milestone::Expired);
        assert_eq!(res.message, "Insurance has expired.");

        // Once last_milestone is marked -1, next day should return None
        let tomorrow = NaiveDate::from_ymd_opt(2026, 10, 21).unwrap();
        let res2 = evaluate_reminder("doc1", "Insurance", expiry, true, Some(-1), Some("2026-10-20"), tomorrow);
        assert_eq!(res2, None);
    }

    #[test]
    fn test_leap_year_boundary() {
        // 2028 is a leap year. Feb has 29 days.
        let today = NaiveDate::from_ymd_opt(2028, 2, 27).unwrap();
        let expiry = "2028-03-01"; // Feb 28 is +1, Feb 29 is +2, Mar 1 is +3 -> diff_days = 3
        let res = evaluate_reminder("doc1", "Tax Doc", expiry, true, None, None, today).unwrap();
        assert_eq!(res.milestone, Milestone::ThreeDays);
    }

    #[test]
    fn test_year_rollover_boundary() {
        // Dec 31 to Jan 2
        let today = NaiveDate::from_ymd_opt(2026, 12, 31).unwrap();
        let expiry = "2027-01-02"; // diff_days = 2
        let res = evaluate_reminder("doc1", "Visa", expiry, true, None, None, today).unwrap();
        assert_eq!(res.milestone, Milestone::TwoDays);
    }
}
