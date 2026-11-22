// If the game did not start (very old browser), show the "Browser not supported" screen (S17).
setTimeout(function () { if (!window.__tsBooted) { var u = document.getElementById('unsupported'); if (u) u.hidden = false; } }, 9000);
