/* Son of Kings storefront — dependency-free, multi-color display with shared hoodie and pants inventory */
(function () {
  'use strict';
  var $ = function(s,r){return (r||document).querySelector(s)};
  var $$ = function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
  var on = function(el,t,fn,o){if(el)el.addEventListener(t,fn,o)};
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
  var colorName=SOKInventory.colorName;
  var money = function(n){return '$'+n.toFixed(2)};

  var SITE={
    email:'sonofkings591@gmail.com', phone:'+18165911437', price:198,
    sizes:SOKInventory.sizes, max:9,
    colors:{
      Black:{front:'assets/img/black-hoodie.webp',back:'assets/img/black-trousers.webp',available:true},
      Navy:{front:'assets/enhanced/navy-hoodie.webp',back:'assets/enhanced/navy-pants.webp',available:true},
      'Royal Blue':{front:'assets/enhanced/blue-hoodie.webp',back:'assets/enhanced/blue-pants.webp',available:true},
      'Forest Green':{front:'assets/enhanced/green-hoodie.webp',back:'assets/enhanced/green-pants.webp',available:true},
      Marble:{front:'assets/enhanced/marble-hoodie.webp',back:'assets/enhanced/marble-pants.webp',available:true},
      Crimson:{front:'assets/enhanced/red-hoodie.webp',back:'assets/enhanced/red-pants.webp',available:true}
    }
  };
  var liveStock=SOKInventory.stock,stockReady=false;
  var KEY='sok.bag.v2', bag=load(), chosenSize=null, chosenColor='Black', qty=1, chosenPiece='set';

  function availableFor(c,s,p,exclude){var row=(liveStock[c]&&liveStock[c][s]||[0,0]).slice();Object.keys(bag).forEach(function(k){if(k===exclude)return;var x=k.split('|');if(x[0]!==c||x[1]!==s)return;var part=piece(k);if(part!=='pants')row[0]-=bag[k];if(part!=='hoodie')row[1]-=bag[k]});return Math.max(0,p==='hoodie'?row[0]:p==='pants'?row[1]:Math.min.apply(null,row))}
  function stockMessage(){var status=$('#toast');status.textContent='That quantity is unavailable. Please check the remaining stock.';status.classList.add('is-visible');setTimeout(function(){status.classList.remove('is-visible')},3500)}
  function key(c,s){return c+'|'+s+'|'+chosenPiece}
  function load(){try{var x=JSON.parse(localStorage.getItem(KEY)||'{}'),o={};Object.keys(x).forEach(function(k){var p=k.split('|'),q=parseInt(x[k],10);if(SITE.colors[p[0]]&&SITE.colors[p[0]].available&&SITE.sizes.indexOf(p[1])>-1&&(!p[2]||['set','pants','hoodie'].indexOf(p[2])>-1)&&q>0)o[p[0]+'|'+p[1]+'|'+(p[2]||'set')]=Math.min(q,SITE.max)});return o}catch(e){return {}}}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(bag))}catch(e){}}
  function count(){return Object.keys(bag).reduce(function(n,k){return n+bag[k]},0)}
  var prices={set:198,pants:96,hoodie:126},names={set:'Crest Tracksuit',pants:'Crest Pants',hoodie:'Crest Hoodie'};function piece(k){return k.split('|')[2]||'set'}function total(){return Object.keys(bag).reduce(function(n,k){return n+bag[k]*prices[piece(k)]},0)}
  function productName(c){return 'Son of Kings Crest Tracksuit in '+colorName(c)}

  var joinBody='Please add me to Son of Kings product and release updates.';
  var sms=$('#club-sms'); if(sms){sms.href='mailto:'+SITE.email+'?subject='+encodeURIComponent('Son of Kings release updates')+'&body='+encodeURIComponent(joinBody);sms.textContent='Request release updates'}
  var note=$('#club-note');if(note)note.textContent='Opens an email request. You choose when to send it.';
  var foot=$('#footer-email');if(foot){foot.href='mailto:'+SITE.email;foot.textContent='Email Son of Kings'}

  var sheetFocus=new WeakMap(), locks=0, mobile=$('#mobile-nav'), bagEl=$('#bag');
  function lock(n){locks=Math.max(0,locks+n);document.body.dataset.locked=locks?'true':'false'}
  function openSheet(el,focus){if(!el||!el.hidden)return;sheetFocus.set(el,document.activeElement);el.hidden=false;lock(1);$('#main').inert=true;$('.header').inert=true;$('.footer').inert=true;$('#buybar').inert=true;if(focus)focus.focus()}
  function closeSheet(el){if(!el||el.hidden)return;el.hidden=true;lock(-1);if(!locks){$('#main').inert=false;$('.header').inert=false;$('.footer').inert=false;$('#buybar').inert=false}var previous=sheetFocus.get(el);if(previous&&document.contains(previous))previous.focus()}
  function setNav(v){if(v)openSheet(mobile,$('#nav-close'));else closeSheet(mobile);var b=$('#nav-open');if(b)b.setAttribute('aria-expanded',v?'true':'false')}
  on($('#nav-open'),'click',function(){setNav(true)});on($('#nav-close'),'click',function(){setNav(false)});
  $$('a',mobile).forEach(function(a){on(a,'click',function(){setNav(false)})});
  on(window,'resize',function(){if(innerWidth>=900&&mobile&&!mobile.hidden)setNav(false)});

  var thumbs=$$('.thumb'),viewIndex=0,views=['set','front','back','detail'];
  function showView(v){viewIndex=views.indexOf(v);if(viewIndex<0)viewIndex=0;$$('.gallery__stage .plate').forEach(function(p){p.dataset.active=p.classList.contains('plate--'+v)?'true':'false'});thumbs.forEach(function(t){t.setAttribute('aria-pressed',String(t.dataset.view===v))});var counter=$('#gallery-count');if(counter)counter.textContent='0'+(viewIndex+1)+' / 04'}
  thumbs.forEach(function(t,i){on(t,'click',function(){showView(t.dataset.view)});on(t,'keydown',function(e){var d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!d)return;e.preventDefault();var next=thumbs[(i+d+thumbs.length)%thumbs.length];showView(next.dataset.view);next.focus()})});
  on($('#gallery-prev'),'click',function(){showView(views[(viewIndex+views.length-1)%views.length])});on($('#gallery-next'),'click',function(){showView(views[(viewIndex+1)%views.length])});
  var swipeStart=null;
  on($('#gallery-stage'),'touchstart',function(e){swipeStart=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null},{passive:true});
  on($('#gallery-stage'),'touchend',function(e){if(!swipeStart||e.changedTouches.length!==1)return;var dx=e.changedTouches[0].clientX-swipeStart.x,dy=e.changedTouches[0].clientY-swipeStart.y;swipeStart=null;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.5)showView(views[(viewIndex+(dx<0?1:views.length-1))%views.length])},{passive:true});
  function setPlate(view,src,color){$$('.plate--'+view).forEach(function(p){var inner=$('.plate__inner',p);if(!inner)return;var img=new Image();img.src=src;img.alt=colorName(color)+' Son of Kings '+(view==='back'?'trousers':view==='detail'?'hoodie details':'hoodie');img.className='plate__photo';img.decoding='async';img.loading='eager';inner.replaceChildren(img);inner.style.padding='0';inner.style.background='none'})}

  var sizeList=$('#size-list');sizeList.replaceChildren();SITE.sizes.forEach(function(size){var b=document.createElement('button');b.className='size';b.type='button';b.dataset.size=size;b.textContent=size;b.setAttribute('role','radio');b.setAttribute('aria-checked','false');sizeList.appendChild(b)});
  var stickySizes=$('#buybar-select');SITE.sizes.filter(function(x){return !Array.from(stickySizes.options).some(function(o){return o.value===x})}).forEach(function(x){var o=document.createElement('option');o.value=x;o.textContent=x;stickySizes.appendChild(o)});
  var swatches={Black:'#1b1b1e',Navy:'#2558a4','Royal Blue':'#162640','Forest Green':'#234936',Marble:'#b5b1aa',Crimson:'#9a2537'};
  var colorList=$('.color-list');colorList.replaceChildren();Object.keys(SITE.colors).forEach(function(c){var b=document.createElement('button');b.className='color-choice';b.type='button';b.dataset.colorChoice=c;b.setAttribute('aria-label',colorName(c));b.setAttribute('aria-pressed',String(c===chosenColor));b.style.setProperty('--swatch',swatches[c]);colorList.appendChild(b)});
  var cards=$$('.edition-card');
  $$('[data-color-choice]').forEach(function(b){on(b,'click',function(){var c=b.dataset.colorChoice;if(SITE.colors[c].available)setColor(c);else openEdition(c)})});
  cards.forEach(function(card){
    var h=$('h3',card);if(!h||!SITE.colors[card.dataset.inventoryColor||h.textContent.trim()])return;
    var c=card.dataset.inventoryColor||h.textContent.trim(), available=SITE.colors[c].available;card.dataset.color=c;card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',(available?'Select ':'View ')+colorName(c)+' tracksuit'+(available?'':' — out of stock'));
    if(available)card.classList.add('edition-card--available');else card.classList.remove('edition-card--available');
    var body=$('.edition-card__body',card), old=body&&body.querySelector('span');if(old)old.textContent=available?'Select color':'Out of stock';
    var stock=$('.stock',card);if(!stock){stock=document.createElement('p');card.appendChild(stock)}
    stock.className=available?'stock stock--live':'stock';stock.innerHTML='<span></span>'+(available?'Almost sold out':'Out of stock');
    function choose(){if(!available){openEdition(c);return}setColor(c);var product=$('#product');if(product)product.scrollIntoView({behavior:motion,block:'start'})}
    on(card,'click',function(e){if(e.target.tagName==='A')e.preventDefault();choose()});on(card,'keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}})
  });

  function setColor(c){
    if(!SITE.colors[c])return;
    var tag=$('.gallery__tag');if(tag)tag.innerHTML=colorName(c).toUpperCase()+' EDITION <b>01</b>';var colorCurrent=$('#color-current');if(colorCurrent)colorCurrent.textContent=colorName(c);
    $$('[data-color-choice]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.colorChoice===c))});chosenColor=c;var ph=SITE.colors[c],available=ph.available;setPlate('front',ph.front,c);setPlate('back',ph.back,c);setPlate('detail',ph.front,c);$$('.plate--set .set-hoodie').forEach(function(img){img.src=ph.front;img.alt=colorName(c)+' Son of Kings hoodie'});$$('.plate--set .set-trousers').forEach(function(img){img.src=ph.back;img.alt=colorName(c)+' Son of Kings trousers'});showView(chosenPiece==='hoodie'?'front':chosenPiece==='pants'?'back':'set');
    var eyebrow=$('.detail__head .eyebrow');if(eyebrow)eyebrow.textContent='THE SIGNATURE COLLECTION · '+colorName(c).toUpperCase();
    var title=$('#product-title');if(title)title.textContent=names[chosenPiece];
    var lede=$('.detail > .lede');if(lede)lede.textContent=c==='Black'?'Black on black. A signature gold crest. Your complete hoodie and trouser set, made for the everyday.':colorName(c)+' with signature gold details. Choose the complete set or your favorite individual piece.';
    var preview=$('#color-preview');if(preview)preview.hidden=available;var message=$('#preview-message');if(message)message.textContent=c+' is a preview only. The Black Edition is available to order.';var stock=$('.detail__head .stock');if(stock){stock.className=available?'stock stock--live':'stock';stock.innerHTML='<span></span>'+(available?'Almost sold out':'Out of stock')}
    var add=$('#add-to-bag');if(add){add.textContent=available?'Add '+colorName(c)+' set — '+money(SITE.price):colorName(c)+' — Out of stock';add.disabled=!available}
    var buybarAdd=$('#buybar-add');if(buybarAdd){buybarAdd.disabled=!available;buybarAdd.textContent=available?'Add to bag':'Out of stock'}
    cards.forEach(function(card){var active=card.dataset.color===c;card.setAttribute('aria-pressed',active?'true':'false');card.dataset.selected=active?'true':'false'});
    syncPurchase();
  }

  on($('#return-black'),'click',function(){setColor('Black');$('#size-list').scrollIntoView({behavior:motion,block:'center'});var target=chosenSize?$('.size[data-size="'+chosenSize+'"]'):$('.size');if(target)target.focus()});
  var editionDialog=$('#edition-preview'),editionFocus=null,editionIndex=0,previewColors=Object.keys(SITE.colors).filter(function(c){return !SITE.colors[c].available});
  function renderEdition(c){editionIndex=previewColors.indexOf(c);$('#edition-preview-title').textContent=colorName(c)+' Edition';$('#edition-preview-hoodie').src=SITE.colors[c].front;$('#edition-preview-hoodie').alt=colorName(c)+' Son of Kings hoodie';$('#edition-preview-trousers').src=SITE.colors[c].back;$('#edition-preview-trousers').alt=colorName(c)+' Son of Kings trousers';$('#edition-preview-count').textContent='0'+(editionIndex+1)+' / 0'+previewColors.length}
  function openEdition(c){if(!editionDialog||previewColors.indexOf(c)<0)return;renderEdition(c);if(editionDialog.open)return;editionFocus=document.activeElement;editionDialog.showModal();lock(1);$('#edition-preview-close').focus()}
  on($('#edition-preview-prev'),'click',function(){renderEdition(previewColors[(editionIndex+previewColors.length-1)%previewColors.length])});
  on($('#edition-preview-next'),'click',function(){renderEdition(previewColors[(editionIndex+1)%previewColors.length])});
  on($('#edition-preview-close'),'click',function(){editionDialog.close()});
  on(editionDialog,'close',function(){lock(-1);if(editionFocus&&document.contains(editionFocus))editionFocus.focus()});
  on(editionDialog,'click',function(e){if(e.target!==editionDialog)return;var r=editionDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)editionDialog.close()});
  on($('#edition-preview-shop'),'click',function(){editionDialog.close();$('#product').scrollIntoView({behavior:motion,block:'start'});var target=chosenSize?$('.size[data-size="'+chosenSize+'"]'):$('.size');if(target)target.focus()});

  var sizeBtns=$$('.size');
  function setSize(s){chosenSize=s;try{if(s)sessionStorage.setItem('sok.size',s);else sessionStorage.removeItem('sok.size')}catch(e){};var feedback=$('#size-feedback');if(feedback){feedback.classList.remove('size-feedback--error');feedback.textContent=s?'Size '+s+' selected.':'Select a size to add your set to the bag.'}sizeBtns.forEach(function(b){var a=b.dataset.size===s;b.setAttribute('aria-checked',a?'true':'false');b.tabIndex=a||(!s&&b.dataset.size==='S')?0:-1});var x=$('#size-current');if(x)x.textContent=s||'Select your size';syncPurchase()}
  sizeBtns.forEach(function(b,i){on(b,'click',function(){setSize(b.dataset.size)});on(b,'keydown',function(e){var d=/Right|Down/.test(e.key)?1:/Left|Up/.test(e.key)?-1:0;if(!d)return;e.preventDefault();var n=sizeBtns[(i+d+sizeBtns.length)%sizeBtns.length];setSize(n.dataset.size);n.focus()})});
  function syncPurchase(){var available=stockReady&&(!chosenSize||availableFor(chosenColor,chosenSize,chosenPiece)>=qty),label='Add '+(qty>1?qty+' × ':'')+names[chosenPiece],amount=money(qty*prices[chosenPiece]);var add=$('#add-to-bag');if(add){add.disabled=!available;add.textContent=available?label+' — '+amount:(stockReady?'Unavailable quantity':'Checking stock…')}var sticky=$('#buybar-add');if(sticky){sticky.disabled=!available;sticky.textContent=available?(chosenSize?label+' — '+amount:'Choose size'):'Out of stock'}var remaining=chosenSize?availableFor(chosenColor,chosenSize,chosenPiece):0;var feedback=$('#size-feedback');if(feedback)feedback.textContent=!stockReady?'Checking current inventory…':chosenSize?remaining+' available in '+colorName(chosenColor)+' / '+chosenSize+' for your bag.':'Choose your size. Unavailable sizes are marked sold out.';$$('.size').forEach(function(b){var n=availableFor(chosenColor,b.dataset.size,chosenPiece);b.setAttribute('aria-disabled',String(!stockReady||n===0));b.title=n?n+' available':'Sold out';b.style.opacity=n?'1':'.35'});var detailStock=$('.detail__head .stock');if(detailStock)detailStock.textContent=stockReady?(chosenSize?(remaining?remaining+' available':'Sold out for this selection'):'Limited quantities available'):'Checking stock…';var price=$('#buybar-total');if(price)price.textContent=amount;var meta=$('#buybar-size');if(meta)meta.textContent=colorName(chosenColor)+' / '+(available?(chosenSize?'Size '+chosenSize:'Choose a size'):'Out of stock')+(qty>1?' / '+qty+' sets':'');var stickyImage=$('.buybar__product img');if(stickyImage)stickyImage.src=SITE.colors[chosenColor][chosenPiece==='pants'?'back':'front'];var select=$('#buybar-select');if(select){select.value=chosenSize||'';select.disabled=!available}var note=$('#purchase-note');if(note)note.textContent=amount+' USD for '+(qty===1?'one '+names[chosenPiece]:qty+' × '+names[chosenPiece])+'. $10 shipping per order. Tax reviewed at checkout.'}
  on($('#buybar-select'),'change',function(e){setSize(SITE.sizes.indexOf(e.target.value)>-1?e.target.value:null)});
  function setQty(n){qty=Math.max(1,Math.min(SITE.max,n));var o=$('#qty-value');if(o)o.textContent=qty;var d=$('#qty-dec'),i=$('#qty-inc');if(d)d.disabled=qty<=1;if(i)i.disabled=qty>=SITE.max;syncPurchase()}
  on($('#qty-dec'),'click',function(){setQty(qty-1)});on($('#qty-inc'),'click',function(){setQty(qty+1)});

  on($('#piece-choice'),'change',function(e){chosenPiece=e.target.value;SITE.price=prices[chosenPiece];$('.detail__price b').textContent=money(SITE.price);$('#product-title').textContent=names[chosenPiece];$('.included').textContent=chosenPiece==='set'?'Hoodie + matching pants · Save $24':chosenPiece==='pants'?'One pair of Crest Pants':'One Crest Hoodie';$('.buybar__product span').textContent=names[chosenPiece];$('.detail__price > span').textContent='USD · '+names[chosenPiece];showView(chosenPiece==='hoodie'?'front':chosenPiece==='pants'?'back':'set');syncPurchase()});
  var guide=$('#size-guide'),toggle=$('#guide-toggle'),guideFocus=null;
  function setGuide(v){if(!guide||!toggle)return;if(v&&!guide.open){guideFocus=document.activeElement;guide.showModal();lock(1);$('#guide-close').focus()}else if(!v&&guide.open)guide.close()}
  on(toggle,'click',function(){setGuide(true)});on($('#guide-close'),'click',function(){setGuide(false)});
  on(guide,'close',function(){lock(-1);if(guideFocus&&document.contains(guideFocus))guideFocus.focus()});
  on(guide,'click',function(e){if(e.target!==guide)return;var r=guide.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)setGuide(false)});
  $$('[data-open-guide]').forEach(function(a){on(a,'click',function(e){e.preventDefault();setGuide(true)})});

  var measurementCells=$$('.guide__table tbody td'),inchValues=measurementCells.map(function(td){return td.textContent});
  $$('[data-unit]').forEach(function(button){on(button,'click',function(){var cm=button.dataset.unit==='cm';measurementCells.forEach(function(td,i){var value=inchValues[i];if(cm){if(i%4===3)value='170.2–182.9';else value=value.split('–').map(function(n){return (Number(n)*2.54).toFixed(1)}).join('–')}td.textContent=value});$('#guide-unit-label').textContent='Body measurements / '+(cm?'centimetres':'inches');$$('[data-unit]').forEach(function(b){b.setAttribute('aria-pressed',String(b===button))})})});
  var bagBody=$('#bag-body');
  function renderBag(){
    var n=count(),ce=$('#bag-count');if(ce){ce.textContent=n;ce.dataset.empty=n?'false':'true'}var ct=$('#bag-count-text');if(ct)ct.textContent='Bag, '+n+(n===1?' item':' items');var te=$('#bag-total');if(te)te.textContent=money(total());var checkout=$('#checkout');if(checkout)checkout.disabled=!n;var so=$('#checkout-sms');if(so){so.href=n?'sms:'+SITE.phone+'?&body='+encodeURIComponent(orderText()):'#';so.setAttribute('aria-disabled',n?'false':'true');so.tabIndex=n?0:-1}
    if(!bagBody)return;bagBody.replaceChildren();var ks=Object.keys(bag);if(!ks.length){var p=document.createElement('p');p.className='bag__empty';p.textContent='Your bag is waiting for your set.';var shop=document.createElement('button');shop.type='button';shop.className='btn btn--gold bag__empty-action';shop.textContent='Find your fit';shop.onclick=function(){setBag(false);$('#product').scrollIntoView({behavior:motion,block:'start'})};bagBody.append(p,shop);return}
    ks.forEach(function(k){bagBody.appendChild(lineFor(k))})
  }
  function lineFor(k){var p=k.split('|'),c=p[0],s=p[1],n=bag[k],line=document.createElement('div');line.className='line';var art=document.createElement('div');art.className='line__art';var img=document.createElement('img');img.src=SITE.colors[c].front;img.alt='';img.loading='lazy';var pants=document.createElement('img');pants.src=SITE.colors[c].back;pants.alt='';pants.loading='lazy';if(piece(k)!=='pants')art.appendChild(img);if(piece(k)!=='hoodie')art.appendChild(pants);var body=document.createElement('div');body.className='line__body';var name=document.createElement('p');name.className='line__name';name.textContent=names[piece(k)];var meta=document.createElement('p');meta.className='line__meta';meta.textContent=colorName(c)+' · '+(s?'Size '+s:'Choose a size')+' · '+money(prices[piece(k)]*n);var f=document.createElement('div');f.className='line__foot';var q=document.createElement('div');q.className='line__qty';var minus=document.createElement('button');minus.type='button';minus.setAttribute('aria-label','Decrease quantity for size '+s);minus.innerHTML='&minus;';minus.onclick=function(){setLine(k,n-1,minus.getAttribute('aria-label'))};var out=document.createElement('output');out.textContent=n;var plus=document.createElement('button');plus.type='button';plus.setAttribute('aria-label','Increase quantity for size '+s);plus.textContent='+';plus.disabled=!stockReady||n>=availableFor(c,s,piece(k),k);plus.onclick=function(){setLine(k,n+1,plus.getAttribute('aria-label'))};q.append(minus,out,plus);var rem=document.createElement('button');rem.type='button';rem.className='line__remove';rem.textContent='Remove';rem.setAttribute('aria-label','Remove size '+s+' from your bag');rem.onclick=function(){setLine(k,0,rem.getAttribute('aria-label'))};f.append(q,rem);var sizeLabel=document.createElement('label');sizeLabel.className='line__size-label';sizeLabel.textContent='Size';var select=document.createElement('select');select.className='line__size';select.setAttribute('aria-label','Change size '+s+' in your bag');SITE.sizes.forEach(function(optionSize){var option=document.createElement('option');option.value=optionSize;option.textContent=optionSize;option.selected=optionSize===s;select.appendChild(option)});select.onchange=function(){moveLine(k,select.value,select)};sizeLabel.appendChild(select);body.append(name,meta,sizeLabel,f);line.append(art,body);return line}
  function moveLine(k,newSize,select){if(SITE.sizes.indexOf(newSize)<0)return;var destination=k.split('|')[0]+'|'+newSize+'|'+piece(k);if(destination===k)return;var merged=(bag[destination]||0)+bag[k];if(!stockReady||merged>availableFor(k.split('|')[0],newSize,piece(k),destination)){select.value=k.split('|')[1];$('#bag-status').textContent='That quantity is unavailable in this size. Your bag has not changed.';var toast=$('#toast');toast.textContent='Not enough stock in that size. Please adjust your quantities.';toast.classList.add('is-visible');setTimeout(function(){toast.classList.remove('is-visible')},3500);return}bag[destination]=merged;delete bag[k];save();renderBag();syncPurchase();setSize(newSize);var focus=$$('.line__size',bagBody).find(function(x){return x.value===newSize});if(focus)focus.focus();$('#bag-status').textContent='Size changed to '+newSize+'. Subtotal '+money(total())+'.'}
  function setLine(k,n,focusName){if(n<=0)delete bag[k];else {var parts=k.split('|');if(!stockReady||n>availableFor(parts[0],parts[1],piece(k),k)){stockMessage();return}bag[k]=Math.min(n,SITE.max);}save();renderBag();syncPurchase();if(focusName){var target=$$('button',bagBody).find(function(b){return b.getAttribute('aria-label')===focusName&&!b.disabled});if(!target)target=$('button',bagBody)||$('#bag-close');if(target)target.focus()}var status=$('#bag-status');if(status)status.textContent='Bag updated. '+count()+' sets. Subtotal '+money(total())+'.'}
  function add(n){if(!chosenSize){var feedback=$('#size-feedback');if(feedback){feedback.textContent='Select a size before adding your set.';feedback.classList.add('size-feedback--error')}var status=$('#toast');status.textContent='Please choose your size first.';status.classList.add('is-visible');setTimeout(function(){status.classList.remove('is-visible')},3500);$('#size-list').scrollIntoView({block:'center',behavior:motion});sizeBtns[0].focus();return}if(!stockReady||n>availableFor(chosenColor,chosenSize,chosenPiece)){stockMessage();return}var k=key(chosenColor,chosenSize),cur=bag[k]||0,next=Math.min(cur+n,SITE.max);if(next===cur){var status=$('#toast');status.textContent='Your bag already contains the maximum of 9 in this size.';status.classList.add('is-visible');setTimeout(function(){status.classList.remove('is-visible')},3500);setBag(true);return;}bag[k]=next;save();renderBag();syncPurchase();setBag(true)}
  function setBag(v){if(v)openSheet(bagEl,$('#bag-close'));else closeSheet(bagEl)}
  on($('#bag-open'),'click',function(){setBag(true)});on($('#bag-close'),'click',function(){setBag(false)});$$('[data-bag-close]').forEach(function(x){on(x,'click',function(){setBag(false)})});on($('#add-to-bag'),'click',function(){add(qty)});on($('#buybar-add'),'click',function(){add(qty)});
  on(document,'keydown',function(e){if(e.key==='Escape'){if(bagEl&&!bagEl.hidden)setBag(false);else if(mobile&&!mobile.hidden)setNav(false)}});

  function orderText(){var lines=Object.keys(bag).map(function(k){var p=k.split('|'),n=bag[k];return '  '+productName(p[0])+' — size '+p[1]+' × '+n+' — '+money(prices[piece(k)]*n)});return ['Hello, I would like to request this Son of Kings order:','',lines.join('\n'),'', 'Product subtotal: '+money(total()),'', 'Shipping name:','Address:','Phone:'].join('\n')}
  on($('#checkout'),'click',function(){if(!count())return;location.href='/checkout/';});

  var eh=$('.editions__head .lede');if(eh)eh.textContent='Shop all six colors. Choose a complete set, hoodie, or pants in available sizes.';
  var et=$('#editions-title');if(et)et.textContent='The color lineup.';
  $$('.faq__list details').forEach(function(d){var s=$('summary',d);if(s&&/Black the only edition|Which colors are available/i.test(s.textContent)){s.textContent='Which colors are available?';var p=$('p',d);if(p)p.textContent='Black, Navy, Royal Blue, Forest Green, Marble and Crimson are available in selected sizes. Stock is shared between complete sets and individual pieces.'}if(s&&/What is included/i.test(s.textContent)){var p2=$('p',d);if(p2)p2.textContent='One hoodie and one matching pair of trousers in your selected available color. Choose the complete set for $198, pants for $96, or hoodie for $126.'}});

  var buybar=$('#buybar'),product=$('#product');
  if(buybar&&product&&'IntersectionObserver'in window){
    function syncBar(entry){var visible=!entry.isIntersecting&&entry.boundingClientRect.bottom<=80;buybar.dataset.shown=String(visible);buybar.setAttribute('aria-hidden',String(!visible));$('#buybar-add').tabIndex=visible?0:-1;$('#buybar-select').tabIndex=visible?0:-1}
    new IntersectionObserver(function(es){syncBar(es[0])},{rootMargin:'-80px 0px 0px 0px'}).observe($('.buy'));
  }
  var zoom=$('#image-zoom');
  on($('#zoom-open'),'click',function(){var active=$('.gallery__stage .plate[data-active="true"]'),source=$('.plate__photo',active);if(!source||!zoom)return;$('#zoom-image').src=source.src;$('#zoom-image').alt=source.alt;var second=$('.set-trousers',active),other=$('#zoom-trousers');other.hidden=!second;$('#zoom-photos').dataset.set=String(!!second);if(second){other.src=second.src;other.alt=second.alt}$('#zoom-title').textContent=second?chosenColor+' / Complete set':source.alt;zoom.showModal();lock(1)});
  on($('#zoom-close'),'click',function(){zoom.close()});
  on(zoom,'click',function(e){if(e.target===zoom){var r=zoom.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)zoom.close()}});
  on(zoom,'close',function(){lock(-1);$('#zoom-open').focus()});
  if('IntersectionObserver'in window){var sectionObserver=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){$$('.nav a').forEach(function(a){if(a.hash==='#'+e.target.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')})}})},{rootMargin:'-20% 0px -55% 0px'});['product','editions','atelier','faq'].forEach(function(id){var el=$('#'+id);if(el)sectionObserver.observe(el)})}

  on(window,'storage',function(e){if(e.key===KEY){bag=load();renderBag();syncPurchase()}});
  on(document,'keydown',function(e){if(e.key!=='Tab')return;var sheet=bagEl&&!bagEl.hidden?bagEl:mobile&&!mobile.hidden?mobile:null;if(!sheet)return;var f=$$('a[href],button:not([disabled]),[tabindex="0"]',sheet).filter(function(el){return el.offsetParent!==null});if(!f.length)return;if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&document.activeElement===f[f.length-1]){e.preventDefault();f[0].focus()}});
  async function refreshStock(){try{var response=await fetch('/api/inventory',{cache:'no-store'});if(!response.ok)throw Error('stock');var data=await response.json();liveStock=data.stock;stockReady=true}catch(e){stockReady=false}syncPurchase();renderBag()}
  refreshStock();on(window,'focus',refreshStock);setInterval(refreshStock,30000);
  var year=$('#year');if(year)year.textContent=new Date().getFullYear();var remembered=null;try{var prior=sessionStorage.getItem('sok.size');if(SITE.sizes.indexOf(prior)>-1)remembered=prior}catch(e){}setColor('Black');setSize(remembered);setQty(1);save();renderBag();
})();