// Runs in <head>, before the first paint (a plain script, not a module, so the
// parser waits for it): puts the theme and the highlight the console last told
// the shell on <html>, so a relaunch opens in the right colors with no flash.
// app.js keeps the same two keys current (applyLooks). A script of its own
// because the page's CSP allows no inline script.
(function () {
  var root = document.documentElement;
  var theme = 'dark';
  var shades = null;
  try {
    var saved = localStorage.getItem('p2c-app:theme');
    if (saved === 'light' || saved === 'dark') theme = saved;
    var accent = JSON.parse(localStorage.getItem('p2c-app:accent'));
    // The shades are saved as { light, dark }; an older launch saved only the
    // dark four as an array, which is simply ignored.
    if (accent && !Array.isArray(accent) && Array.isArray(accent[theme]) && accent[theme].length === 4) shades = accent[theme];
  } catch (e) {
    // Nothing saved, or storage is blocked: the dark default and Ocean stand.
  }
  // The window opens hidden and app.js shows it on the first paint. Should that
  // module never get as far (a script error), this shows it after a while, so
  // the app is never left invisible.
  setTimeout(function () {
    try {
      window.__TAURI__.window.getCurrentWindow().show();
    } catch (e) {
      // No window API here: nothing to show.
    }
  }, 6000);
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
  if (shades) {
    var names = ['--accent', '--accent-soft', '--accent-ink', '--accent-line'];
    for (var i = 0; i < names.length; i += 1) {
      if (/^#[0-9a-f]{6}$/i.test(shades[i])) root.style.setProperty(names[i], shades[i]);
    }
  }
})();
