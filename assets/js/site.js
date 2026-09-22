/* Son of Kings storefront — dependency-free, multi-color display with Black-only inventory */
(function () {
  'use strict';
  var $ = function(s,r){return (r||document).querySelector(s)};
  var $$ = function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
  var on = function(el,t,fn,o){if(el)el.addEventListener(t,fn,o)};
  var money = function(n){return '$'+n.toFixed(2)};

  /* Estrah-style deferred hero playback. The explicit control remains available
     when autoplay is blocked by iOS Low Power Mode, reduced motion, or data saver. */
  (function initHeroVideo(){
    var video = $('#sok-hero-video');
    var source = $('#sok-hero-source');
    var button = $('#sok-hero-play');
    if (!video || !source || !button) return;

    var label = $('span', button);
    var userPaused = false;
    var startTimer;

    function render(){
      var playing = !video.paused && !video.ended;
      button.style.display = 'flex';
      button.setAttribute('aria-pressed', String(playing));
      button.setAttribute('aria-label', playing ? 'Pause background video' : 'Play background video');
      if (label) label.textContent = playing ? 'Pause video' : 'Play video';
      button.classList.toggle('is-playing', playing);
    }

    function loadSource(){
      if (!source.getAttribute('src') && source.getAttribute('data-src')) {
        source.setAttribute('src', source.getAttribute('data-src'));
        video.load();
      }
    }

    function play(){
      userPaused = false;
      loadSource();
      video.preload = 'auto';
      var attempt = video.play();
      if (attempt && attempt.catch) attempt.catch(render);
    }

    on(button, 'click', function(){
      if (!video.paused) {
        userPaused = true;
        video.pause();
      } else {
        play();
      }
    });

    ['play','playing','pause','waiting','ended'].forEach(function(eventName){
      on(video, eventName, render, {passive:true});
    });

    function syncHeroMedia(){
      clearTimeout(startTimer);
      var hero = video.closest ? video.closest('.hero') : video;
      var rect = hero.getBoundingClientRect();
      var visible = !document.hidden && rect.bottom > 0 && rect.top < window.innerHeight;
      if (!visible) {
        video.pause();
        return;
      }
      if (userPaused ||
          window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
          (navigator.connection && navigator.connection.saveData)) {
        render();
        return;
      }
      startTimer = setTimeout(function(){
        if (document.hidden) return;
        play();
      }, 1500);
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(syncHeroMedia).observe(video);
    }
    on(document, 'visibilitychange', syncHeroMedia);
    render();
    syncHeroMedia();
  })();

  var SITE={
    email:'MuhammadAsjad.RehmanHashmi@gmail.com', phone:'+18165911437', price:199.99, stripeCheckout:'https://buy.stripe.com/fZuaEPdAodYr0WX5PWfYY00',
    sizes:['S','M','L','XL','XXL'], max:9,
    colors:{
      Black:{front:'assets/img/black-hoodie.webp',back:'assets/img/black-trousers.webp',available:true},
      Navy:{front:'assets/enhanced/navy-hoodie.webp',back:'assets/enhanced/navy-pants.webp',available:false},
      'Royal Blue':{front:'assets/enhanced/blue-hoodie.webp',back:'assets/enhanced/blue-pants.webp',available:false},
      'Forest Green':{front:'assets/enhanced/green-hoodie.webp',back:'assets/enhanced/green-pants.webp',available:false},
      Marble:{front:'assets/enhanced/marble-hoodie.webp',back:'assets/enhanced/marble-pants.webp',available:false},
      Crimson:{front:'assets/enhanced/red-hoodie.webp',back:'assets/enhanced/red-pants.webp',available:false}
    }
  };
  var KEY='sok.bag.v2', bag=load(), chosenSize='M', chosenColor='Black', qty=1;

  function key(c,s){return c+'|'+s}
  function load(){try{var x=JSON.parse(localStorage.getItem(KEY)||'{}'),o={};Object.keys(x).forEach(function(k){var p=k.split('|'),q=parseInt(x[k],10);if(SITE.colors[p[0]]&&SITE.colors[p[0]].available&&SITE.sizes.indexOf(p[1])>-1&&q>0)o[k]=Math.min(q,SITE.max)});return o}catch(e){return {}}}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(bag))}catch(e){}}
  function count(){return Object.keys(bag).reduce(function(n,k){return n+bag[k]},0)}
  function total(){return count()*SITE.price}
  function productName(c){return 'Son of Kings Crest Tracksuit in '+c}

  var joinBody='Please add me to Son of Kings product and release updates.';
  var sms=$('#club-sms'); if(sms){sms.href='sms:'+SITE.phone+'?&body='+encodeURIComponent(joinBody);sms.textContent='Text'}
  var note=$('#club-note');if(note)note.textContent='Text to join the updates list.';
  var foot=$('#footer-email');if(foot){foot.href='mailto:'+SITE.email;foot.textContent='Contact'}

  var lastFocused=null, locks=0, mobile=$('#mobile-nav'), bagEl=$('#bag');
  function lock(n){locks=Math.max(0,locks+n);document.body.dataset.locked=locks?'true':'false'}
  function openSheet(el,focus){if(!el)return;lastFocused=document.activeElement;el.hidden=false;lock(1);if(focus)focus.focus()}
  function closeSheet(el){if(!el||el.hidden)return;el.hidden=true;lock(-1);if(lastFocused&&document.contains(lastFocused))lastFocused.focus()}
  function setNav(v){if(v)openSheet(mobile,$('#nav-close'));else closeSheet(mobile);var b=$('#nav-open');if(b)b.setAttribute('aria-expanded',v?'true':'false')}
  on($('#nav-open'),'click',function(){setNav(true)});on($('#nav-close'),'click',function(){setNav(false)});
  $$('a',mobile).forEach(function(a){on(a,'click',function(){setNav(false)})});
  on(window,'resize',function(){if(innerWidth>=900&&mobile&&!mobile.hidden)setNav(false)});

  var thumbs=$$('.thumb');
  function showView(v){$$('.gallery__stage .plate').forEach(function(p){p.dataset.active=p.classList.contains('plate--'+v)?'true':'false'});thumbs.forEach(function(t){t.setAttribute('aria-pressed',t.dataset.view===v?'true':'false')})}
  thumbs.forEach(function(t){on(t,'click',function(){showView(t.dataset.view)})});
  function setPlate(view,src,color){$$('.plate--'+view).forEach(function(p){var inner=$('.plate__inner',p);if(!inner)return;var img=new Image();img.src=src;img.alt=color+' Son of Kings '+(view==='front'?'hoodie':'trousers');img.className='plate__photo';img.decoding='async';img.loading='eager';inner.replaceChildren(img);inner.style.padding='0';inner.style.background='none'})}

  var cards=$$('.edition-card');
  cards.forEach(function(card){
    var h=$('h3',card);if(!h||!SITE.colors[h.textContent.trim()])return;
    var c=h.textContent.trim(), available=SITE.colors[c].available;card.dataset.color=c;card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',(available?'Select ':'View ')+c+' tracksuit'+(available?'':' — out of stock'));
    if(available)card.classList.add('edition-card--available');else card.classList.remove('edition-card--available');
    var body=$('.edition-card__body',card), old=body&&body.querySelector('span');if(old)old.textContent=available?'Select color':'Out of stock';
    var stock=$('.stock',card);if(!stock){stock=document.createElement('p');card.appendChild(stock)}
    stock.className=available?'stock stock--live':'stock';stock.innerHTML='<span></span>'+(available?'Available now':'Out of stock');
    function choose(){setColor(c);var product=$('#product');if(product)product.scrollIntoView({behavior:'smooth',block:'start'})}
    on(card,'click',function(e){if(e.target.tagName==='A')e.preventDefault();choose()});on(card,'keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}})
  });

  function setColor(c){
    if(!SITE.colors[c])return;chosenColor=c;var ph=SITE.colors[c],available=ph.available;setPlate('front',ph.front,c);setPlate('back',ph.back,c);showView('front');
    var eyebrow=$('.detail__head .eyebrow');if(eyebrow)eyebrow.textContent='SON OF KINGS · '+c.toUpperCase();
    var title=$('#product-title');if(title)title.innerHTML='Tracksuit<br><em>in '+c+'</em>';
    var lede=$('.detail > .lede');if(lede)lede.textContent=c+' hoodie and trousers made from 70% recycled polyester and 30% organic cotton, with gold hardware and the Son of Kings crest.';
    var stock=$('.detail__head .stock');if(stock){stock.className=available?'stock stock--live':'stock';stock.innerHTML='<span></span>'+(available?'Available to order':'Out of stock')}
    var add=$('#add-to-bag');if(add){add.textContent=available?'Add '+c+' set — '+money(SITE.price):c+' — Out of stock';add.disabled=!available}
    var buybarAdd=$('#buybar-add');if(buybarAdd){buybarAdd.disabled=!available;buybarAdd.textContent=available?'Add to bag':'Out of stock'}
    cards.forEach(function(card){var active=card.dataset.color===c;card.setAttribute('aria-pressed',active?'true':'false');card.dataset.selected=active?'true':'false'});
    var bar=$('#buybar-size');if(bar)bar.textContent=c+' · '+(available?'Size '+chosenSize:'Out of stock');
  }

  var sizeBtns=$$('.size');
  function setSize(s){chosenSize=s;sizeBtns.forEach(function(b){var a=b.dataset.size===s;b.setAttribute('aria-checked',a?'true':'false');b.tabIndex=a?0:-1});var x=$('#size-current');if(x)x.textContent=s;var bar=$('#buybar-size');if(bar)bar.textContent=chosenColor+' · '+(SITE.colors[chosenColor].available?'Size '+s:'Out of stock')}
  sizeBtns.forEach(function(b,i){on(b,'click',function(){setSize(b.dataset.size)});on(b,'keydown',function(e){var d=/Right|Down/.test(e.key)?1:/Left|Up/.test(e.key)?-1:0;if(!d)return;e.preventDefault();var n=sizeBtns[(i+d+sizeBtns.length)%sizeBtns.length];setSize(n.dataset.size);n.focus()})});
  function setQty(n){qty=Math.max(1,Math.min(SITE.max,n));var o=$('#qty-value');if(o)o.textContent=qty;var d=$('#qty-dec'),i=$('#qty-inc');if(d)d.disabled=qty<=1;if(i)i.disabled=qty>=SITE.max}
  on($('#qty-dec'),'click',function(){setQty(qty-1)});on($('#qty-inc'),'click',function(){setQty(qty+1)});

  var guide=$('#size-guide'),toggle=$('#guide-toggle');function setGuide(v){if(!guide||!toggle)return;guide.hidden=!v;toggle.setAttribute('aria-expanded',v?'true':'false');toggle.textContent=v?'Hide size guide':'Size guide'}
  on(toggle,'click',function(){setGuide(guide.hidden)});$$('[data-open-guide]').forEach(function(a){on(a,'click',function(){setGuide(true)})});

  var bagBody=$('#bag-body');
  function renderBag(){
    var n=count(),ce=$('#bag-count');if(ce){ce.textContent=n;ce.dataset.empty=n?'false':'true'}var ct=$('#bag-count-text');if(ct)ct.textContent='Bag, '+n+(n===1?' item':' items');var te=$('#bag-total');if(te)te.textContent=money(total());var checkout=$('#checkout');if(checkout)checkout.disabled=!n;var so=$('#checkout-sms');if(so){so.href=n?'sms:'+SITE.phone+'?&body='+encodeURIComponent(orderText()):'#';so.setAttribute('aria-disabled',n?'false':'true');so.tabIndex=n?0:-1}
    if(!bagBody)return;bagBody.replaceChildren();var ks=Object.keys(bag);if(!ks.length){var p=document.createElement('p');p.className='bag__empty';p.textContent='Nothing selected yet';bagBody.appendChild(p);return}
    ks.forEach(function(k){bagBody.appendChild(lineFor(k))})
  }
  function lineFor(k){var p=k.split('|'),c=p[0],s=p[1],n=bag[k],line=document.createElement('div');line.className='line';var art=document.createElement('div');art.className='line__art';var img=document.createElement('img');img.src=SITE.colors[c].front;img.alt='';img.loading='lazy';art.appendChild(img);var body=document.createElement('div');body.className='line__body';var name=document.createElement('p');name.className='line__name';name.textContent=productName(c);var meta=document.createElement('p');meta.className='line__meta';meta.textContent='Size '+s+' · '+money(SITE.price*n);var f=document.createElement('div');f.className='line__foot';var q=document.createElement('div');q.className='line__qty';var minus=document.createElement('button');minus.type='button';minus.innerHTML='&minus;';minus.onclick=function(){setLine(k,n-1)};var out=document.createElement('output');out.textContent=n;var plus=document.createElement('button');plus.type='button';plus.textContent='+';plus.disabled=n>=SITE.max;plus.onclick=function(){setLine(k,n+1)};q.append(minus,out,plus);var rem=document.createElement('button');rem.type='button';rem.className='line__remove';rem.textContent='Remove';rem.onclick=function(){setLine(k,0)};f.append(q,rem);body.append(name,meta,f);line.append(art,body);return line}
  function setLine(k,n){if(n<=0)delete bag[k];else bag[k]=Math.min(n,SITE.max);save();renderBag()}
  function add(n){if(!SITE.colors[chosenColor].available)return;var k=key(chosenColor,chosenSize),cur=bag[k]||0,next=Math.min(cur+n,SITE.max);if(next===cur)return;bag[k]=next;save();renderBag();setBag(true)}
  function setBag(v){if(v)openSheet(bagEl,$('#bag-close'));else closeSheet(bagEl)}
  on($('#bag-open'),'click',function(){setBag(true)});on($('#bag-close'),'click',function(){setBag(false)});$$('[data-bag-close]').forEach(function(x){on(x,'click',function(){setBag(false)})});on($('#add-to-bag'),'click',function(){add(qty)});on($('#buybar-add'),'click',function(){add(1)});
  on(document,'keydown',function(e){if(e.key==='Escape'){if(bagEl&&!bagEl.hidden)setBag(false);else if(mobile&&!mobile.hidden)setNav(false)}});

  function orderText(){var lines=Object.keys(bag).map(function(k){var p=k.split('|'),n=bag[k];return '  '+productName(p[0])+' — size '+p[1]+' × '+n+' — '+money(SITE.price*n)});return ['Hello, I would like to request this Son of Kings order:','',lines.join('\n'),'', 'Product subtotal: '+money(total()),'', 'Shipping name:','Address:','Phone:'].join('\n')}
  on($('#checkout'),'click',function(){if(!count())return;location.href='/checkout/';});

  var eh=$('.editions__head .lede');if(eh)eh.textContent='Black is available now. Explore every Son of Kings colorway below; Navy, Royal Blue, Forest Green, Marble and Crimson are currently out of stock.';
  var et=$('#editions-title');if(et)et.innerHTML='Explore every <em>color.</em>';
  $$('.faq__list details').forEach(function(d){var s=$('summary',d);if(s&&/Black the only edition|Which colors are available/i.test(s.textContent)){s.textContent='Which colors are available?';var p=$('p',d);if(p)p.textContent='Black is currently available to order. Navy, Royal Blue, Forest Green, Marble and Crimson are shown as colorways but are currently out of stock.'}if(s&&/What is included/i.test(s.textContent)){var p2=$('p',d);if(p2)p2.textContent='One hoodie and one matching pair of trousers in your selected available color. They are sold together as a set.'}});

  var buybar=$('#buybar'),product=$('#product');if(buybar&&product&&'IntersectionObserver'in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){buybar.dataset.shown=e.isIntersecting?'true':'false';buybar.setAttribute('aria-hidden',e.isIntersecting?'false':'true')})},{rootMargin:'-40% 0px -20% 0px'});io.observe(product)}

  var year=$('#year');if(year)year.textContent=new Date().getFullYear();setColor('Black');setSize('M');setQty(1);save();renderBag();
})();