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
  window.SFTLDialog = { show: show, hide: hide };
})();
