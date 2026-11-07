/* Navigation stays available even when an optional data viewer fails to load. */
(() => {
  const aliases = {evidence:'materials',comparison:'cases',boundaries:'cases'};
  const archiveRoutes = new Set(['nodes','revision-decisions']);
  const titles = {overview:'Designing with reclaimed timber',materials:'Material evidence',algorithm:'Design method',cases:'Three cases',case1:'Timber Shelter',case2:'Contour Bench',case3:'Open Pavilion'};
  let active;
  function navigate() {
    let hash;
    try { hash = decodeURIComponent(location.hash.slice(1)); } catch { hash = ''; }
    if (archiveRoutes.has(hash)) { location.replace('technical.html#' + hash); return; }
    const target = document.getElementById(hash);
    const requested = aliases[hash] || (target?.closest('[data-chapter]')?.dataset.chapter) || hash;
    // Skip links and in-figure anchors must never select a different chapter.
    const chapter = Object.hasOwn(titles,requested) ? requested : (hash && active ? active : 'overview');
    const changed = active !== chapter;
    document.querySelectorAll('[data-chapter]').forEach(el => { el.hidden = el.dataset.chapter !== chapter; });
    document.querySelectorAll('.chapter-nav a').forEach(link => {
      if (link.hash === '#' + (/^case\d/.test(chapter) ? 'cases' : chapter)) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
    document.body.dataset.activeChapter = chapter;
    document.title = titles[chapter] + ' — SECOND GRAIN';
    document.querySelectorAll('video').forEach(video => { if (video.closest('[data-chapter]')?.hidden) video.pause(); });
    const panel = document.querySelector('[data-chapter="' + chapter + '"]');
    const anchor = target && target !== panel && !target.closest('[hidden]') ? target : null;
    if (changed && active) {
      const heading = panel.querySelector('h1,h2');
      if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
      window.scrollTo({top:0,behavior:'instant'});
    }
    if (anchor && hash !== 'main') anchor.scrollIntoView({block:'start',behavior:'instant'});
    if (hash === 'main') { const main=document.getElementById('main');main.tabIndex=-1;main.focus({preventScroll:true}); }
    active = chapter;
    window.dispatchEvent(new CustomEvent('research:chapter',{detail:{chapter,changed}}));
  }
  addEventListener('hashchange',navigate);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',navigate,{once:true});
  else navigate();
})();
