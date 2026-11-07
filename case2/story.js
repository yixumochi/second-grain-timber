const descriptions={sw:'Self-weight only',central:'Self-weight + central TOTAL 1 kN',eccentric:'Self-weight + eccentric TOTAL 1 kN'};
document.querySelectorAll('[data-case]').forEach(button=>button.addEventListener('click',()=>{
  const key=button.dataset.case;
  document.querySelectorAll('[data-case]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  const image=document.getElementById('result-image'); image.src='assets/'+key+'.png';
  image.alt='Saved R03 '+descriptions[key]+' with supports, loads and displacement legend';
  document.getElementById('result-link').href=image.src;
}));
