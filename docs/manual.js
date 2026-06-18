// ArchView360 User Manual — shared header/nav (avoids duplicating markup on every page)
(function () {
  var PAGES = [
    { id: 'index',            file: '/docs/index.html',             label: 'マニュアルトップ' },
    { id: 'getting-started',  file: '/docs/getting-started.html',   label: 'はじめに' },
    { id: 'scene-management', file: '/docs/scene-management.html',  label: 'シーン管理' },
    { id: 'floormap',         file: '/docs/floormap.html',          label: 'FloorMap' },
    { id: 'compare',          file: '/docs/compare.html',           label: '比較モード' },
    { id: 'project-json',     file: '/docs/project-json.html',      label: 'プロジェクトJSON' },
    { id: 'shortcuts',        file: '/docs/shortcuts.html',         label: 'キーボードショートカット' },
  ];

  function renderManualChrome(activeId) {
    var header = document.getElementById('m-header');
    if (header) {
      header.innerHTML =
        '<div class="m-header-title"><span class="icon">⬡</span> ArchView360 ユーザーマニュアル</div>' +
        '<a class="m-header-back" href="/">← ArchView360 を開く</a>';
    }

    var nav = document.getElementById('m-nav');
    if (nav) {
      var html = '<div class="m-nav-heading">目次</div><ul class="m-nav-list">';
      PAGES.forEach(function (p) {
        html += '<li><a href="' + p.file + '"' + (p.id === activeId ? ' class="active"' : '') + '>' + p.label + '</a></li>';
      });
      html += '</ul>';
      nav.innerHTML = html;
    }
  }

  window.ArchViewManual = { renderManualChrome: renderManualChrome, PAGES: PAGES };
})();
