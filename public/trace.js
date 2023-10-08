!(function () {
  "use strict";
  const a = window.location;
  const r = window.document;
  const o = r.currentScript;
  const l = '/api/event'
  function s(t, e) {
    t && console.warn(`Ignoring Event: ${t}`), e && e.callback && e.callback();
  }
  function t(t, e) {
    if (
      /^localhost$|^127(\.\d+){0,2}\.\d+$|^\[::1?]$/.test(a.hostname) ||
      a.protocol === "file:"
    ) {
      return s("localhost", e);
    }
    if (
      window._phantom ||
      window.__nightmare ||
      window.navigator.webdriver ||
      window.Cypress
    ) {
      return s(null, e);
    }
    const n = {};
    const i =
      ((n.n = t),
      (n.u = a.href),
      (n.d = o.dataset.domain),
      (n.r = r.referrer || null),
      e && e.meta && (n.m = JSON.stringify(e.meta)),
      e && e.props && (n.p = e.props),
      new XMLHttpRequest());
    i.open("POST", l, !0),
      i.setRequestHeader("Content-Type", "text/plain"),
      i.send(JSON.stringify(n)),
      (i.onreadystatechange = function () {
        i.readyState === 4 && e && e.callback && e.callback();
      });
  }
  const e = (window.plausible && window.plausible.q) || [];
  window.plausible = t;
  for (var n, i = 0; i < e.length; i++) {
    t.apply(this, e[i]);
  }
  function p() {
    n !== a.pathname && ((n = a.pathname), t("pageview"));
  }
  let c;
  const w = window.history;
  w.pushState &&
    ((c = w.pushState),
    (w.pushState = function () {
      Reflect.apply(c, this, arguments), p();
    }),
    window.addEventListener("popstate", p)),
    r.visibilityState === "prerender"
      ? r.addEventListener("visibilitychange", () => {
          n || r.visibilityState !== "visible" || p();
        })
      : p();
})();
