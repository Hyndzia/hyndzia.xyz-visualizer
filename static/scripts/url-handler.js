window.APP_ROOT = {{ request.script_root|tojson }};
  window.appUrl = function (path) {
    path = String(path || '');
    return window.APP_ROOT + (path.charAt(0) === '/' ? path : '/' + path);
  };