(function () {
  'use strict';
  var active = null, opener = null, previousOverflow = '', inertElements = [];
  function focusable(element) {
    return Array.from(element.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]'))
      .filter(function (item) { return item.getClientRects().length && !item.closest('[inert]'); });
  }
  function show(dialog) {
    if (active === dialog) return;
    if (active) hide(active);
    opener = document.activeElement;
    active = dialog;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.classList.add('open');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('tabindex', '-1');
    var branch = dialog;
    while (branch.parentElement && branch !== document.body) {
      Array.from(branch.parentElement.children).forEach(function (sibling) {
        if (sibling !== branch && !sibling.inert && sibling.tagName !== 'SCRIPT' && !sibling.classList.contains('live-region')) {
          sibling.inert = true;
          inertElements.push(sibling);
        }
      });
      branch = branch.parentElement;
    }
    var first = dialog.querySelector('[aria-label="Close"]') || focusable(dialog)[0] || dialog;
    first.focus();
  }
  function hide(dialog) {
    dialog.classList.remove('open');
    if (active !== dialog) return;
    active = null;
    inertElements.forEach(function (element) { element.inert = false; });
    inertElements = [];
    document.body.style.overflow = previousOverflow;
    if (opener && opener.isConnected) opener.focus();
    opener = null;
  }
  document.addEventListener('keydown', function (event) {
    if (!active || event.key !== 'Tab') return;
    var items = focusable(active), first = items[0], last = items[items.length - 1];
    if (!first) { event.preventDefault(); active.focus(); return; }
    if (!active.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
    else if (event.shiftKey && (document.activeElement === first || document.activeElement === active)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }, true);
  function confirmAction(message) {
    return new Promise(function (resolve) {
      var dialog = document.createElement('div');
      dialog.className = 'sftl-confirm';
      dialog.setAttribute('aria-label', 'Confirm album update');
      dialog.style.cssText = 'position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:20px';
      var panel = document.createElement('div');
      panel.style.cssText = 'max-width:460px;background:#242424;color:#ececec;padding:24px;border:1px solid #777;border-radius:8px;font:16px/1.5 system-ui';
      var text = document.createElement('p'); text.textContent = message;
      var cancel = document.createElement('button'), accept = document.createElement('button');
      cancel.textContent = 'Cancel'; accept.textContent = 'Confirm update';
      [cancel,accept].forEach(function (button) { button.type = 'button'; button.style.cssText = 'margin:18px 12px 0 0;min-height:44px;padding:8px 14px;border:1px solid #aaa;border-radius:5px;color:inherit;background:#303030;font:inherit;cursor:pointer'; });
      function finish(value) { hide(dialog); dialog.remove(); resolve(value); }
      cancel.onclick = function () { finish(false); };
      accept.onclick = function () { finish(true); };
      dialog.addEventListener('keydown', function (event) { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(false); } });
      panel.append(text,cancel,accept); dialog.append(panel); document.body.append(dialog); show(dialog);
    });
  }
  window.SFTLDialog = { show: show, hide: hide, confirm: confirmAction };
})();
