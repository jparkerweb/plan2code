//! The quit check's box on Windows, drawn with TaskDialog directly. The dialog
//! plugin has no heading, always makes its first button the default, and
//! leaves Windows to copy the body's icon into the title bar, so the same
//! warning showed twice. Here the heading is the question, Stay is the default
//! (Enter, Esc and the close button all keep the app open), and the title bar
//! wears the app's own icon. The words come from quit_prompt.rs.

use crate::quit_prompt::{QuitCase, QuitPrompt};
use std::ptr;
use winapi::shared::basetsd::LONG_PTR;
use winapi::shared::minwindef::{LPARAM, UINT, WPARAM};
use winapi::shared::ntdef::HRESULT;
use winapi::shared::windef::HWND;
use winapi::shared::winerror::S_OK;
use winapi::um::commctrl::{
    TaskDialogIndirect, TASKDIALOGCONFIG, TASKDIALOG_BUTTON, TDF_ALLOW_DIALOG_CANCELLATION,
    TDF_POSITION_RELATIVE_TO_WINDOW, TDN_CREATED, TD_INFORMATION_ICON, TD_WARNING_ICON,
};
use winapi::um::winuser::{
    GetClassLongPtrW, SendMessageW, GCLP_HICONSM, ICON_BIG, ICON_SMALL, ICON_SMALL2, WM_GETICON,
    WM_SETICON,
};

const ID_QUIT: i32 = 100;
const ID_STAY: i32 = 101;

fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(Some(0)).collect()
}

// Once the box exists, give its title bar the parent window's icon instead of
// the copy of the body's icon Windows puts there.
unsafe extern "system" fn on_event(
    hwnd: HWND,
    msg: UINT,
    _wparam: WPARAM,
    _lparam: LPARAM,
    parent: LONG_PTR,
) -> HRESULT {
    if msg == TDN_CREATED {
        let parent = parent as HWND;
        let mut icon = SendMessageW(parent, WM_GETICON, ICON_SMALL2 as WPARAM, 0);
        if icon == 0 {
            icon = GetClassLongPtrW(parent, GCLP_HICONSM) as isize;
        }
        SendMessageW(hwnd, WM_SETICON, ICON_SMALL as WPARAM, icon);
        SendMessageW(hwnd, WM_SETICON, ICON_BIG as WPARAM, icon);
    }
    S_OK
}

/// Shows the box over `parent` and blocks until it closes. True only when
/// Quit was pressed; anything else (Stay, Esc, the close button, a failure to
/// show the box) keeps the app open.
pub fn ask(parent: HWND, prompt: &QuitPrompt) -> bool {
    let title = wide(prompt.title);
    let heading = wide(prompt.heading);
    let message = wide(prompt.message);
    let quit = wide(prompt.quit);
    let stay = wide(prompt.stay);
    let buttons = [
        TASKDIALOG_BUTTON {
            nButtonID: ID_QUIT,
            pszButtonText: quit.as_ptr(),
        },
        TASKDIALOG_BUTTON {
            nButtonID: ID_STAY,
            pszButtonText: stay.as_ptr(),
        },
    ];
    let icon = match prompt.case {
        QuitCase::Waiting => TD_INFORMATION_ICON,
        QuitCase::Working => TD_WARNING_ICON,
    };

    // SAFETY: every pointer in the config points at a local above that
    // outlives the blocking TaskDialogIndirect call, and an all-zero
    // TASKDIALOGCONFIG is the documented "nothing set" for every other field.
    unsafe {
        let mut config: TASKDIALOGCONFIG = std::mem::zeroed();
        config.cbSize = std::mem::size_of::<TASKDIALOGCONFIG>() as UINT;
        config.hwndParent = parent;
        config.dwFlags = TDF_ALLOW_DIALOG_CANCELLATION | TDF_POSITION_RELATIVE_TO_WINDOW;
        config.pszWindowTitle = title.as_ptr();
        *config.u1.pszMainIcon_mut() = icon;
        config.pszMainInstruction = heading.as_ptr();
        config.pszContent = message.as_ptr();
        config.cButtons = buttons.len() as UINT;
        config.pButtons = buttons.as_ptr();
        config.nDefaultButton = ID_STAY;
        config.pfCallback = Some(on_event);
        config.lpCallbackData = parent as LONG_PTR;

        let mut pressed = 0;
        let result = TaskDialogIndirect(&config, &mut pressed, ptr::null_mut(), ptr::null_mut());
        result == S_OK && pressed == ID_QUIT
    }
}
