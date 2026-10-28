//! The taskbar entry's attention signal. It decides which of four states the
//! desktop app is in (busy, ready, attention, plain), which badge the platform
//! shows for that state, whether a change into a state that wants the person
//! should flash the window, and the pixels of the colored dot. The states and
//! the dot colors mirror the web console's favicon. Knows nothing about Tauri.
//! The caller turns these decisions into calls on the window.

/// What Plan2Code is doing, as the web console's favicon shows it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Signal {
    Busy,
    Ready,
    Attention,
    Plain,
}

/// The two dot colors the taskbar badge can show.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DotColor {
    Green,
    Red,
}

/// The badge a platform shows on the taskbar entry.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Badge {
    None,
    Dot(DotColor),
    Label(&'static str),
    Count(i64),
}

/// The default size, in pixels, of the square dot image.
pub const DOT_SIZE: u32 = 16;

const GREEN_HEX: &str = "#22c55e";
const RED_HEX: &str = "#e5484d";
const RING_HEX: &str = "#3b332c";

impl Signal {
    /// The signal named by a favicon state id ("busy", "ready", "attention"
    /// or "plain"). Any other text is `None`.
    pub fn from_id(id: &str) -> Option<Signal> {
        match id {
            "busy" => Some(Signal::Busy),
            "ready" => Some(Signal::Ready),
            "attention" => Some(Signal::Attention),
            "plain" => Some(Signal::Plain),
            _ => None,
        }
    }
}

/// The badge for `signal` on the platform named by `os` (the value of
/// `std::env::consts::OS`). When the badge is turned off, there is none.
/// Windows shows a dot, macOS a "!" label and Linux a count of 1, and only
/// for the states that want the person.
pub fn badge_for(signal: Signal, os: &str, enabled: bool) -> Badge {
    if !enabled {
        return Badge::None;
    }
    match (os, signal) {
        ("windows", Signal::Ready) => Badge::Dot(DotColor::Green),
        ("windows", Signal::Attention) => Badge::Dot(DotColor::Red),
        ("macos", Signal::Attention) => Badge::Label("!"),
        ("linux", Signal::Attention) => Badge::Count(1),
        _ => Badge::None,
    }
}

/// Whether the window should flash. It does so only when flashing is on, the
/// window is not focused, and the signal just changed into Ready or Attention.
/// A repeat of the same signal does not flash again.
pub fn should_flash(prev: Option<Signal>, next: Signal, focused: bool, enabled: bool) -> bool {
    enabled && !focused && matches!(next, Signal::Ready | Signal::Attention) && prev != Some(next)
}

/// The dot as RGBA bytes, row by row: a filled, anti-aliased circle with a
/// 1 px dark ring at its edge, on a transparent square of `size` pixels. The
/// result is `size * size * 4` bytes long, with straight (not premultiplied)
/// alpha.
pub fn dot_rgba(color: DotColor, size: u32) -> Vec<u8> {
    let fill = parse_hex(match color {
        DotColor::Green => GREEN_HEX,
        DotColor::Red => RED_HEX,
    });
    let ring = parse_hex(RING_HEX);
    let n = size as usize;
    let mut out = vec![0u8; n * n * 4];
    let center = size as f32 / 2.0;
    let radius = center - 0.5;
    for y in 0..n {
        for x in 0..n {
            // Distance from the pixel's center to the circle's center.
            let dx = x as f32 + 0.5 - center;
            let dy = y as f32 + 0.5 - center;
            let distance = (dx * dx + dy * dy).sqrt();
            let coverage = (radius + 0.5 - distance).clamp(0.0, 1.0);
            let rgb = if distance > radius - 1.0 { ring } else { fill };
            let alpha = (coverage * 255.0).round() as u8;
            let i = (y * n + x) * 4;
            out[i..i + 4].copy_from_slice(&[rgb[0], rgb[1], rgb[2], alpha]);
        }
    }
    out
}

/// The three bytes of a `#rrggbb` color. A malformed pair reads as 0.
fn parse_hex(hex: &str) -> [u8; 3] {
    let digits = hex.strip_prefix('#').unwrap_or(hex);
    let byte = |i: usize| {
        digits
            .get(i..i + 2)
            .and_then(|pair| u8::from_str_radix(pair, 16).ok())
            .unwrap_or(0)
    };
    [byte(0), byte(2), byte(4)]
}

#[cfg(test)]
mod tests {
    use super::*;

    const SIGNALS: [Signal; 4] = [
        Signal::Busy,
        Signal::Ready,
        Signal::Attention,
        Signal::Plain,
    ];

    fn pixel(buf: &[u8], size: u32, x: u32, y: u32) -> [u8; 4] {
        let i = ((y * size + x) * 4) as usize;
        [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]
    }

    #[test]
    fn the_badge_follows_the_platform_table() {
        let table: [(Signal, &str, Badge); 16] = [
            (Signal::Busy, "windows", Badge::None),
            (Signal::Ready, "windows", Badge::Dot(DotColor::Green)),
            (Signal::Attention, "windows", Badge::Dot(DotColor::Red)),
            (Signal::Plain, "windows", Badge::None),
            (Signal::Busy, "macos", Badge::None),
            (Signal::Ready, "macos", Badge::None),
            (Signal::Attention, "macos", Badge::Label("!")),
            (Signal::Plain, "macos", Badge::None),
            (Signal::Busy, "linux", Badge::None),
            (Signal::Ready, "linux", Badge::None),
            (Signal::Attention, "linux", Badge::Count(1)),
            (Signal::Plain, "linux", Badge::None),
            (Signal::Busy, "freebsd", Badge::None),
            (Signal::Ready, "freebsd", Badge::None),
            (Signal::Attention, "freebsd", Badge::None),
            (Signal::Plain, "freebsd", Badge::None),
        ];
        for (signal, os, want) in table {
            assert_eq!(
                badge_for(signal, os, true),
                want,
                "{signal:?} on {os}, enabled"
            );
            assert_eq!(
                badge_for(signal, os, false),
                Badge::None,
                "{signal:?} on {os}, disabled"
            );
        }
    }

    #[test]
    fn from_id_reads_the_four_words_and_refuses_the_rest() {
        assert_eq!(Signal::from_id("busy"), Some(Signal::Busy));
        assert_eq!(Signal::from_id("ready"), Some(Signal::Ready));
        assert_eq!(Signal::from_id("attention"), Some(Signal::Attention));
        assert_eq!(Signal::from_id("plain"), Some(Signal::Plain));
        assert_eq!(Signal::from_id("sleeping"), None);
        assert_eq!(Signal::from_id("Ready"), None, "the ids are lowercase");
    }

    #[test]
    fn a_change_into_ready_or_attention_flashes_when_unfocused() {
        assert!(should_flash(Some(Signal::Busy), Signal::Ready, false, true));
        assert!(should_flash(None, Signal::Attention, false, true));
    }

    #[test]
    fn no_flash_while_the_window_is_focused() {
        assert!(!should_flash(Some(Signal::Busy), Signal::Ready, true, true));
    }

    #[test]
    fn no_flash_for_a_repeat_of_the_same_signal() {
        assert!(!should_flash(
            Some(Signal::Ready),
            Signal::Ready,
            false,
            true
        ));
        assert!(!should_flash(
            Some(Signal::Attention),
            Signal::Attention,
            false,
            true
        ));
    }

    #[test]
    fn no_flash_for_busy_or_plain() {
        for prev in [None, Some(Signal::Ready), Some(Signal::Attention)] {
            assert!(
                !should_flash(prev, Signal::Busy, false, true),
                "busy from {prev:?}"
            );
            assert!(
                !should_flash(prev, Signal::Plain, false, true),
                "plain from {prev:?}"
            );
        }
    }

    #[test]
    fn no_flash_when_flashing_is_turned_off() {
        for signal in SIGNALS.iter().copied() {
            assert!(
                !should_flash(Some(Signal::Busy), signal, false, false),
                "{signal:?} while disabled"
            );
        }
    }

    #[test]
    fn parse_hex_reads_the_byte_pairs() {
        assert_eq!(parse_hex("#22c55e"), [0x22, 0xc5, 0x5e]);
        assert_eq!(parse_hex("e5484d"), [0xe5, 0x48, 0x4d]);
    }

    #[test]
    fn the_green_dot_is_a_transparent_square_with_a_filled_middle() {
        let size = DOT_SIZE;
        let buf = dot_rgba(DotColor::Green, size);
        assert_eq!(buf.len(), (size * size * 4) as usize);
        assert_eq!(pixel(&buf, size, 0, 0)[3], 0, "a corner is transparent");
        let center = pixel(&buf, size, 8, 8);
        assert_eq!(center[3], 255, "the middle is opaque");
        assert_eq!(
            &center[..3],
            &parse_hex(GREEN_HEX)[..],
            "the middle is the green fill"
        );
    }

    #[test]
    fn the_red_dot_is_a_transparent_square_with_a_filled_middle() {
        let size = DOT_SIZE;
        let buf = dot_rgba(DotColor::Red, size);
        assert_eq!(buf.len(), (size * size * 4) as usize);
        assert_eq!(pixel(&buf, size, 0, 0)[3], 0, "a corner is transparent");
        let center = pixel(&buf, size, 8, 8);
        assert_eq!(center[3], 255, "the middle is opaque");
        assert_eq!(
            &center[..3],
            &parse_hex(RED_HEX)[..],
            "the middle is the red fill"
        );
    }

    #[test]
    fn the_fill_colors_match_the_web_console_favicon() {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../src/web-console/public/favicon.js"
        );
        let text = std::fs::read_to_string(path).unwrap();
        assert!(
            text.contains(&format!("ready: \"{GREEN_HEX}\"")),
            "ready color in favicon.js"
        );
        assert!(
            text.contains(&format!("attention: \"{RED_HEX}\"")),
            "attention color in favicon.js"
        );
    }
}
