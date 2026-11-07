export const escapeText=v=>String(v??'Unknown').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const pane=(title,body)=>'<section class="window"><div class="window-title"><strong>'+escapeText(title)+'</strong></div><div class="window-body">'+body+'</div></section>';
