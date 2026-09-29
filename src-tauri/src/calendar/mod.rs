pub mod dataset;
pub mod nepali;

pub use nepali::{
    ad_str_to_bs, ad_to_bs, bs_str_to_ad, bs_to_ad, epoch_ad_start, format_ad_date,
    format_bs_date, format_dual_date, get_bs_month_days, get_today_dual, is_valid_ad_date,
    is_valid_bs_date, parse_ymd, to_ascii_digits, to_nepali_numerals, CalendarError,
    DualDateResult, GregorianDate, NepaliDate, BS_MONTH_NAMES_EN, BS_MONTH_NAMES_NE,
    BS_MONTH_NAMES_SHORT_EN, WEEKDAY_NAMES_EN, WEEKDAY_NAMES_NE, WEEKDAY_NAMES_SHORT_EN,
    WEEKDAY_NAMES_SHORT_NE,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_known_conversion_fixtures() {
        // Fixture 1: Prompt Example (Ashwin 16, 2083 BS == 2026-10-02 AD)
        let ad1 = bs_to_ad(2083, 6, 16).expect("BS to AD conversion");
        assert_eq!(ad1.year, 2026);
        assert_eq!(ad1.month, 10);
        assert_eq!(ad1.day, 2);
        assert_eq!(ad1.weekday, 5); // Friday

        let bs1 = ad_to_bs(2026, 10, 2).expect("AD to BS conversion");
        assert_eq!(bs1.year, 2083);
        assert_eq!(bs1.month, 6);
        assert_eq!(bs1.day, 16);
        assert_eq!(bs1.weekday, 5);

        // Fixture 2: Today (Ashwin 13, 2083 BS == 2026-09-29 AD)
        let ad2 = bs_to_ad(2083, 6, 13).expect("BS to AD conversion");
        assert_eq!(ad2.year, 2026);
        assert_eq!(ad2.month, 9);
        assert_eq!(ad2.day, 29);
        assert_eq!(ad2.weekday, 2); // Tuesday

        let bs2 = ad_to_bs(2026, 9, 29).expect("AD to BS conversion");
        assert_eq!(bs2.year, 2083);
        assert_eq!(bs2.month, 6);
        assert_eq!(bs2.day, 13);
        assert_eq!(bs2.weekday, 2);

        // Fixture 3: Baishakh 1, 2083 BS (New Year) == 2026-04-14 AD (Tuesday)
        let ad3 = bs_to_ad(2083, 1, 1).expect("BS to AD conversion");
        assert_eq!(ad3.year, 2026);
        assert_eq!(ad3.month, 4);
        assert_eq!(ad3.day, 14);
        assert_eq!(ad3.weekday, 2);

        let bs3 = ad_to_bs(2026, 4, 14).expect("AD to BS conversion");
        assert_eq!(bs3.year, 2083);
        assert_eq!(bs3.month, 1);
        assert_eq!(bs3.day, 1);

        // Fixture 4: Chaitra 30, 2082 BS (Year end) == 2026-04-13 AD (Monday)
        let ad4 = bs_to_ad(2082, 12, 30).expect("BS to AD conversion");
        assert_eq!(ad4.year, 2026);
        assert_eq!(ad4.month, 4);
        assert_eq!(ad4.day, 13);
        assert_eq!(ad4.weekday, 1);

        let bs4 = ad_to_bs(2026, 4, 13).expect("AD to BS conversion");
        assert_eq!(bs4.year, 2082);
        assert_eq!(bs4.month, 12);
        assert_eq!(bs4.day, 30);

        // Fixture 5: Epoch start (Baishakh 1, 1975 BS == April 13, 1918 AD, Saturday)
        let ad5 = bs_to_ad(1975, 1, 1).expect("BS to AD conversion");
        assert_eq!(ad5.year, 1918);
        assert_eq!(ad5.month, 4);
        assert_eq!(ad5.day, 13);
        assert_eq!(ad5.weekday, 6);

        let bs5 = ad_to_bs(1918, 4, 13).expect("AD to BS conversion");
        assert_eq!(bs5.year, 1975);
        assert_eq!(bs5.month, 1);
        assert_eq!(bs5.day, 1);

        // Fixture 6: Millennium 2000 BS == April 14, 1943 AD
        let ad6 = bs_to_ad(2000, 1, 1).expect("BS to AD conversion");
        assert_eq!(ad6.year, 1943);
        assert_eq!(ad6.month, 4);
        assert_eq!(ad6.day, 14);

        let bs6 = ad_to_bs(1943, 4, 14).expect("AD to BS conversion");
        assert_eq!(bs6.year, 2000);
        assert_eq!(bs6.month, 1);
        assert_eq!(bs6.day, 1);
    }

    #[test]
    fn test_month_boundaries_2083() {
        let expected_days = [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30];
        for (idx, &expected) in expected_days.iter().enumerate() {
            let m = (idx + 1) as u8;
            let days = get_bs_month_days(2083, m).expect("Month days in 2083");
            assert_eq!(days, expected, "Month {} length mismatch", m);

            // First day of month converts and roundtrips
            let ad_first = bs_to_ad(2083, m, 1).unwrap();
            let bs_first = ad_to_bs(ad_first.year, ad_first.month, ad_first.day).unwrap();
            assert_eq!(bs_first.year, 2083);
            assert_eq!(bs_first.month, m);
            assert_eq!(bs_first.day, 1);

            // Last day of month converts and roundtrips
            let ad_last = bs_to_ad(2083, m, expected).unwrap();
            let bs_last = ad_to_bs(ad_last.year, ad_last.month, ad_last.day).unwrap();
            assert_eq!(bs_last.year, 2083);
            assert_eq!(bs_last.month, m);
            assert_eq!(bs_last.day, expected);
        }
    }

    #[test]
    fn test_invalid_dates_rejected() {
        // Day 32 in Ashwin 2083 (Ashwin 2083 has only 31 days)
        let res = bs_to_ad(2083, 6, 32);
        assert!(res.is_err(), "Day 32 in 31-day month must be rejected");

        // Day 30 in Mangsir 2083 (Mangsir 2083 has only 29 days)
        let res2 = bs_to_ad(2083, 8, 30);
        assert!(res2.is_err(), "Day 30 in 29-day month must be rejected");

        // Month 13
        assert!(bs_to_ad(2083, 13, 1).is_err());

        // Month 0
        assert!(bs_to_ad(2083, 0, 1).is_err());

        // Day 0
        assert!(bs_to_ad(2083, 1, 0).is_err());

        // Out of range (year 1974)
        assert!(bs_to_ad(1974, 1, 1).is_err());

        // Out of range (year 2100)
        assert!(bs_to_ad(2100, 1, 1).is_err());
    }

    #[test]
    fn test_property_roundtrip_all_supported_years() {
        // Test first, middle, and last day of every year from 1975 to 2099
        for y in 1975..=2099 {
            for m in [1, 6, 12] {
                let max_d = get_bs_month_days(y, m).unwrap();
                for d in [1, max_d / 2, max_d] {
                    let ad = bs_to_ad(y, m, d).unwrap();
                    let back_bs = ad_to_bs(ad.year, ad.month, ad.day).unwrap();
                    assert_eq!(back_bs.year, y);
                    assert_eq!(back_bs.month, m);
                    assert_eq!(back_bs.day, d);
                }
            }
        }
    }

    #[test]
    fn test_nepali_numerals_conversion() {
        assert_eq!(to_nepali_numerals("2083-06-16"), "२०८३-०६-१६");
        assert_eq!(to_ascii_digits("२०८३-०६-१६"), "2083-06-16");
    }

    #[test]
    fn test_formatting_dual_date() {
        let dual = format_dual_date("2026-10-02", false).unwrap();
        assert_eq!(dual.ad.year, 2026);
        assert_eq!(dual.ad.month, 10);
        assert_eq!(dual.ad.day, 2);
        assert_eq!(dual.bs.year, 2083);
        assert_eq!(dual.bs.month, 6);
        assert_eq!(dual.bs.day, 16);
        assert!(dual.formatted_ad.contains("02 October 2026"));
        assert!(dual.formatted_bs.contains("16 Asoj 2083"));
        assert!(dual.formatted_dual.contains("02 October 2026 • 16 Asoj 2083"));

        let dual_ne = format_dual_date("2026-10-02", true).unwrap();
        assert!(dual_ne.formatted_bs.contains("१६ असोज २०८३"));
    }
}
