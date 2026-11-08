/* Navigation stays available even when an optional data viewer fails to load. */
(() => {
  const aliases = {evidence:'materials',comparison:'cases',boundaries:'cases'};
  const archiveRoutes = new Set(['nodes','revision-decisions']);
  const titles = {overview:'Designing with reclaimed timber',materials:'Material AI',algorithm:'Design Agent',films:'Films',cases:'Three cases',case1:'Timber Shelter',case2:'Contour Bench',case3:'Open Pavilion'};
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
    const indexLink = document.querySelector('[data-index-link]');
    indexLink.textContent = chapter === 'overview' ? 'Index' : '← Back';
    indexLink.setAttribute('aria-label', chapter === 'overview' ? 'Research index' : 'Back to research index');
    document.body.dataset.activeChapter = chapter;
    document.title = titles[chapter] + ' — SECOND GRAIN';
    const panel = document.querySelector('[data-chapter="' + chapter + '"]');
    const records = panel.querySelector(':scope > [data-evidence-view]');
    let viewChanged = false;
    if (records) {
      const showingRecords = hash === 'main' ? !records.hidden : Boolean(target && records.contains(target));
      viewChanged = records.hidden === showingRecords;
      records.hidden = !showingRecords;
      panel.querySelector(':scope > [data-diagram-view]').hidden = showingRecords;
      document.body.dataset.chapterView = showingRecords ? 'evidence' : 'diagram';
    } else {
      delete document.body.dataset.chapterView;
    }
    document.querySelectorAll('video').forEach(video => { if (video.closest('[hidden]')) video.pause(); });
    const anchor = target && target !== panel && !target.closest('[hidden]') ? target : null;
    const entering = (changed || viewChanged) && active;
    if (anchor && hash !== 'main') {
      let disclosure = anchor.closest('details');
      while (disclosure) {
        disclosure.open = true;
        disclosure = disclosure.parentElement?.closest('details');
      }
      if (entering) {
        if (anchor.tabIndex < 0 && !anchor.hasAttribute('tabindex')) anchor.tabIndex = -1;
        anchor.focus({preventScroll:true});
      }
      anchor.scrollIntoView({block:'start',behavior:'instant'});
    } else if ((entering || target === panel) && hash !== 'main') {
      if (entering) {
        const heading = panel.querySelector('h1,h2');
        const previousRoute = /^case\d$/.test(active) ? 'cases' : active;
        const card = chapter === 'overview' && panel.querySelector(`.research-index-card[href="#${previousRoute}"]`);
        if (card) card.focus({preventScroll:true});
        else if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
      }
      const currentHash = location.hash;
      requestAnimationFrame(() => {
        if (location.hash === currentHash) window.scrollTo({top:0,behavior:'instant'});
      });
    }
    if (hash === 'main') { const main=document.getElementById('main');main.tabIndex=-1;main.focus({preventScroll:true}); }
    active = chapter;
    window.dispatchEvent(new CustomEvent('research:chapter',{detail:{chapter,changed}}));
  }
  document.querySelectorAll('[data-diagram-zoom]').forEach(button => button.addEventListener('click', () => {
    const scroll = document.getElementById(button.getAttribute('aria-controls'));
    const enlarged = scroll.classList.toggle('is-enlarged');
    button.setAttribute('aria-pressed', String(enlarged));
    button.textContent = enlarged ? 'Fit diagram' : 'Zoom diagram';
    if (enlarged) scroll.scrollIntoView({block:'start',behavior:'instant'});
    else scroll.scrollLeft = 0;
  }));
  addEventListener('hashchange',navigate);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',navigate,{once:true});
  else navigate();
})();
