(function(){
var q=function(s,r){return (r||document).querySelector(s)},qa=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
var g=q('#genres');
if(g){g.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;qa('#genres button').forEach(function(x){x.classList.toggle('on',x===b)});
 var id=b.getAttribute('data-g'),n=0;qa('.genre').forEach(function(s){var on=id==='all'||s.getAttribute('data-g')===id;s.hidden=!on;if(on)n+=qa('.card',s).length});
 var f=q('#fcount');if(f)f.textContent=n+(document.documentElement.lang==='ko'?'개 앱':' apps');window.scrollTo(0,0)})}
qa('.yt').forEach(function(w){w.addEventListener('click',function(){var id=w.getAttribute('data-id');w.innerHTML='<iframe src="https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>'})});
var z=q('#zoom');if(z){document.addEventListener('click',function(e){if(e.target.matches('.shots img')){q('img',z).src=e.target.src;z.style.display='flex'}else if(z.style.display==='flex'){z.style.display='none'}});
 document.addEventListener('keydown',function(e){if(e.key==='Escape')z.style.display='none'})}
})();