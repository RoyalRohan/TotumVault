use chrono::{Datelike, Duration, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

use super::dataset::{BS_MONTH_DAYS, END_BS_YEAR, START_BS_YEAR};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NepaliDate {
    pub year: i32,
    pub month: u8,
    pub day: u8,
    pub weekday: u8, // 0 = Sunday, 1 = Monday, ... 6 = Saturday
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GregorianDate {
    pub year: i32,
    pub month: u8,
    pub day: u8,
    pub weekday: u8,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DualDateResult {
    pub ad: GregorianDate,
    pub bs: NepaliDate,
    pub formatted_ad: String,
    pub formatted_bs: String,
    pub formatted_dual: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "error", content = "details")]
pub enum CalendarError {
    OutOfRange {
        date: String,
        supported_range: String,
    },
    InvalidDate {
        date: String,
        reason: String,
    },
    ParseError(String),
}

impl std::fmt::Display for CalendarError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::OutOfRange { date, supported_range } => {
                write!(f, "Date '{}' is outside supported range ({})", date, supported_range)
            }
            Self::InvalidDate { date, reason } => {
                write!(f, "Invalid date '{}': {}", date, reason)
            }
            Self::ParseError(msg) => write!(f, "Date parse error: {}", msg),
        }
    }
}

impl std::error::Error for CalendarError {}

pub const BS_MONTH_NAMES_EN: [&str; 12] = [
    "Baishakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
    "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];

pub const BS_MONTH_NAMES_SHORT_EN: [&str; 12] = [
    "Bai", "Jes", "Asar", "Shra", "Bhad", "Asoj",
    "Kar", "Mang", "Pou", "Magh", "Fal", "Chai",
];

pub const BS_MONTH_NAMES_NE: [&str; 12] = [
    "बैशाख", "जेठ", "असार", "श्रावण", "भाद्र", "असोज",
    "कार्तिक", "मंसिर", "पौष", "माघ", "फाल्गुण", "चैत्र",
];

pub const WEEKDAY_NAMES_EN: [&str; 7] = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

pub const WEEKDAY_NAMES_SHORT_EN: [&str; 7] = [
    "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",
];

pub const WEEKDAY_NAMES_NE: [&str; 7] = [
    "आइतबार", "सोमबार", "मंगलबार", "बुधबार", "बिहिबार", "शुक्रबार", "शनिबार",
];

pub const WEEKDAY_NAMES_SHORT_NE: [&str; 7] = [
    "आइत", "सोम", "मंगल", "बुध", "बिहि", "शुक्र", "शनि",
];

const NEPALI_NUMERALS: [char; 10] = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

/// Converts ASCII digits to Devanagari numerals.
pub fn to_nepali_numerals(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c.is_ascii_digit() {
                let digit = (c as u8 - b'0') as usize;
                NEPALI_NUMERALS[digit]
            } else {
                c
            }
        })
        .collect()
}

/// Converts Devanagari numerals to ASCII digits.
pub fn to_ascii_digits(s: &str) -> String {
    s.chars()
        .map(|c| {
            if let Some(pos) = NEPALI_NUMERALS.iter().position(|&nc| nc == c) {
                (b'0' + pos as u8) as char
            } else {
                c
            }
        })
        .collect()
}

/// Returns the epoch AD start date: April 13, 1918 (equivalent to Baishakh 1, 1975 BS).
#[inline]
pub fn epoch_ad_start() -> NaiveDate {
    NaiveDate::from_ymd_opt(1918, 4, 13).expect("Valid epoch start date")
}

/// Returns the number of days in a given BS month for a given BS year.
pub fn get_bs_month_days(year: i32, month: u8) -> Result<u8, CalendarError> {
    if year < START_BS_YEAR || year > END_BS_YEAR {
        return Err(CalendarError::OutOfRange {
            date: format!("{}-{:02}", year, month),
            supported_range: format!("{}-{} BS", START_BS_YEAR, END_BS_YEAR),
        });
    }
    if month < 1 || month > 12 {
        return Err(CalendarError::InvalidDate {
            date: format!("{}-{:02}", year, month),
            reason: format!("Month must be between 1 and 12 (got {})", month),
        });
    }

    let year_idx = (year - START_BS_YEAR) as usize;
    let month_idx = (month - 1) as usize;
    Ok(BS_MONTH_DAYS[year_idx][month_idx])
}

/// Checks if a given BS date is valid.
pub fn is_valid_bs_date(year: i32, month: u8, day: u8) -> bool {
    match get_bs_month_days(year, month) {
        Ok(max_day) => day >= 1 && day <= max_day,
        Err(_) => false,
    }
}

/// Checks if a given AD date is valid.
pub fn is_valid_ad_date(year: i32, month: u8, day: u8) -> bool {
    NaiveDate::from_ymd_opt(year, month as u32, day as u32).is_some()
}

/// Converts a Bikram Sambat (BS) date to Gregorian (AD).
pub fn bs_to_ad(year: i32, month: u8, day: u8) -> Result<GregorianDate, CalendarError> {
    if year < START_BS_YEAR || year > END_BS_YEAR {
        return Err(CalendarError::OutOfRange {
            date: format!("{}-{:02}-{:02}", year, month, day),
            supported_range: format!("{}-01-01 to {}-12-30 BS", START_BS_YEAR, END_BS_YEAR),
        });
    }

    let max_days = get_bs_month_days(year, month)?;
    if day < 1 || day > max_days {
        return Err(CalendarError::InvalidDate {
            date: format!("{}-{:02}-{:02}", year, month, day),
            reason: format!(
                "Day {} exceeds month {} length of {} days for year {}",
                day, month, max_days, year
            ),
        });
    }

    // Calculate total days elapsed from Baishakh 1, 1975 BS
    let mut total_days: i64 = 0;

    // Prior years
    for y in START_BS_YEAR..year {
        let y_idx = (y - START_BS_YEAR) as usize;
        for m_idx in 0..12 {
            total_days += BS_MONTH_DAYS[y_idx][m_idx] as i64;
        }
    }

    // Prior months of the current year
    let curr_year_idx = (year - START_BS_YEAR) as usize;
    for m in 1..month {
        let m_idx = (m - 1) as usize;
        total_days += BS_MONTH_DAYS[curr_year_idx][m_idx] as i64;
    }

    // Current month days
    total_days += (day - 1) as i64;

    let ad_date = epoch_ad_start() + Duration::days(total_days);
    let weekday = ad_date.weekday().num_days_from_sunday() as u8;

    Ok(GregorianDate {
        year: ad_date.year(),
        month: ad_date.month() as u8,
        day: ad_date.day() as u8,
        weekday,
    })
}

/// Converts a Gregorian (AD) date to Bikram Sambat (BS).
pub fn ad_to_bs(year: i32, month: u8, day: u8) -> Result<NepaliDate, CalendarError> {
    let ad_date = NaiveDate::from_ymd_opt(year, month as u32, day as u32).ok_or_else(|| {
        CalendarError::InvalidDate {
            date: format!("{}-{:02}-{:02}", year, month, day),
            reason: "Invalid Gregorian date".to_string(),
        }
    })?;

    let epoch_start = epoch_ad_start();
    let days_diff = (ad_date - epoch_start).num_days();

    if days_diff < 0 {
        return Err(CalendarError::OutOfRange {
            date: format!("{}-{:02}-{:02}", year, month, day),
            supported_range: "Dates from April 13, 1918 (1975-01-01 BS) onwards".to_string(),
        });
    }

    let mut remaining_days = days_diff;
    let mut bs_year = START_BS_YEAR;

    while bs_year <= END_BS_YEAR {
        let y_idx = (bs_year - START_BS_YEAR) as usize;
        let mut year_days: i64 = 0;
        for m_idx in 0..12 {
            year_days += BS_MONTH_DAYS[y_idx][m_idx] as i64;
        }

        if remaining_days < year_days {
            break;
        }
        remaining_days -= year_days;
        bs_year += 1;
    }

    if bs_year > END_BS_YEAR {
        return Err(CalendarError::OutOfRange {
            date: format!("{}-{:02}-{:02}", year, month, day),
            supported_range: format!("Up to Chaitra 30, {} BS (April 2043 AD)", END_BS_YEAR),
        });
    }

    let y_idx = (bs_year - START_BS_YEAR) as usize;
    let mut bs_month: u8 = 1;

    while bs_month <= 12 {
        let m_idx = (bs_month - 1) as usize;
        let m_days = BS_MONTH_DAYS[y_idx][m_idx] as i64;

        if remaining_days < m_days {
            break;
        }
        remaining_days -= m_days;
        bs_month += 1;
    }

    let bs_day = (remaining_days + 1) as u8;
    let weekday = ad_date.weekday().num_days_from_sunday() as u8;

    Ok(NepaliDate {
        year: bs_year,
        month: bs_month,
        day: bs_day,
        weekday,
    })
}

/// Parses an YYYY-MM-DD string into components.
pub fn parse_ymd(s: &str) -> Result<(i32, u8, u8), CalendarError> {
    let clean = s.trim();
    let parts: Vec<&str> = clean.split(&['-', '/', '.'][..]).collect();
    if parts.len() != 3 {
        return Err(CalendarError::ParseError(format!(
            "Expected YYYY-MM-DD format (got '{}')",
            s
        )));
    }

    let y: i32 = parts[0]
        .parse()
        .map_err(|_| CalendarError::ParseError(format!("Invalid year '{}'", parts[0])))?;
    let m: u8 = parts[1]
        .parse()
        .map_err(|_| CalendarError::ParseError(format!("Invalid month '{}'", parts[1])))?;
    let d: u8 = parts[2]
        .parse()
        .map_err(|_| CalendarError::ParseError(format!("Invalid day '{}'", parts[2])))?;

    Ok((y, m, d))
}

/// Converts a canonical AD YYYY-MM-DD string to BS.
pub fn ad_str_to_bs(ad_str: &str) -> Result<NepaliDate, CalendarError> {
    let (y, m, d) = parse_ymd(ad_str)?;
    ad_to_bs(y, m, d)
}

/// Converts a BS YYYY-MM-DD string to canonical AD.
pub fn bs_str_to_ad(bs_str: &str) -> Result<GregorianDate, CalendarError> {
    let clean = to_ascii_digits(bs_str);
    let (y, m, d) = parse_ymd(&clean)?;
    bs_to_ad(y, m, d)
}

/// Formats a Gregorian date as readable English or canonical string.
pub fn format_ad_date(ad: &GregorianDate) -> String {
    let month_name = match ad.month {
        1 => "January",
        2 => "February",
        3 => "March",
        4 => "April",
        5 => "May",
        6 => "June",
        7 => "July",
        8 => "August",
        9 => "September",
        10 => "October",
        11 => "November",
        12 => "December",
        _ => "Unknown",
    };
    format!("{:02} {} {}", ad.day, month_name, ad.year)
}

/// Formats a Nepali BS date with specified language and month naming.
pub fn format_bs_date(bs: &NepaliDate, in_nepali: bool) -> String {
    let month_idx = (bs.month.saturating_sub(1) as usize).min(11);
    if in_nepali {
        let m_name = BS_MONTH_NAMES_NE[month_idx];
        let day_str = to_nepali_numerals(&format!("{:02}", bs.day));
        let year_str = to_nepali_numerals(&bs.year.to_string());
        format!("{} {} {}", day_str, m_name, year_str)
    } else {
        let m_name = BS_MONTH_NAMES_SHORT_EN[month_idx];
        format!("{:02} {} {}", bs.day, m_name, bs.year)
    }
}

/// Formats a date into a dual string (AD + BS).
pub fn format_dual_date(ad_str: &str, in_nepali: bool) -> Result<DualDateResult, CalendarError> {
    let (y, m, d) = parse_ymd(ad_str)?;
    let ad_naive = NaiveDate::from_ymd_opt(y, m as u32, d as u32).ok_or_else(|| {
        CalendarError::InvalidDate {
            date: ad_str.to_string(),
            reason: "Invalid Gregorian date".to_string(),
        }
    })?;
    let weekday = ad_naive.weekday().num_days_from_sunday() as u8;

    let ad = GregorianDate {
        year: y,
        month: m,
        day: d,
        weekday,
    };
    let bs = ad_to_bs(y, m, d)?;

    let formatted_ad = format_ad_date(&ad);
    let formatted_bs = format_bs_date(&bs, in_nepali);
    let formatted_dual = if in_nepali {
        format!("{} / {}", formatted_ad, formatted_bs)
    } else {
        format!("{} • {}", formatted_ad, formatted_bs)
    };

    Ok(DualDateResult {
        ad,
        bs,
        formatted_ad,
        formatted_bs,
        formatted_dual,
    })
}

/// Returns today's date in both AD and BS.
pub fn get_today_dual() -> Result<DualDateResult, CalendarError> {
    let now = Utc::now().date_naive();
    let ad_str = format!("{:04}-{:02}-{:02}", now.year(), now.month(), now.day());
    format_dual_date(&ad_str, false)
}
