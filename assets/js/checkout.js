(function(){
 'use strict';
 var link='https://www.paypal.com/ncp/payment/PLB-2FCAQUF5Q4CB',bag={},rows=[];
 try{bag=JSON.parse(localStorage.getItem('sok.bag.v2')||'{}');if(!bag||typeof bag!=='object')bag={}}catch(e){}
 Object.keys(bag).forEach(function(k){if(/^Black\|(S|M|L|XL|XXL)$/.test(k)&&Number.isInteger(bag[k])&&bag[k]>0)rows.push({size:k.split('|')[1],quantity:Math.min(9,bag[k])})});
 var items=document.getElementById('items'),actions=document.getElementById('payment-actions');
 function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n}
 if(!rows.length){items.appendChild(el('p','empty','Your bag is empty. Choose your size to get started.'));var shop=el('a','pay-link','Explore the $99 set');shop.href='/#product';actions.appendChild(shop);return}
 var total=0;
 rows.forEach(function(row){total+=row.quantity*99;var card=el('article','product'),img=el('img');img.src='/assets/img/black-hoodie.webp';img.alt='Black Son of Kings hoodie';var info=el('div');info.append(el('p','eyebrow','HOODIE + TROUSERS'),el('h2','','Crest Tracksuit'),el('p','','Black · Size '+row.size+' · Quantity '+row.quantity),el('p','','$'+(row.quantity*99).toFixed(2)));card.append(img,info);items.appendChild(card)});
 document.getElementById('total').textContent='$'+total.toFixed(2);
 if(rows.length>1)actions.appendChild(el('p','fine','Ordering different sizes? Complete one PayPal checkout per size. Each button below opens a separate order.'));
 rows.forEach(function(row){var notice=el('div','selection');notice.append(el('strong','','On PayPal, select size '+row.size+' and quantity '+row.quantity+'.'),el('p','','Your bag selections do not transfer automatically. Confirm them before paying.'));var pay=el('a','pay-link',rows.length===1?'Continue to PayPal':'Continue to PayPal · Size '+row.size);pay.href=link;actions.append(notice,pay)});
})();
