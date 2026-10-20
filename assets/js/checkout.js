(function(){
 'use strict';
 var key='sok.bag.v2',bag={};
 var busy=false,generation=0,sdkPromise,shippingDraft={},receipt=null;
 try{receipt=JSON.parse(sessionStorage.getItem('sok.receipt')||'null')}catch(e){}
 var items=document.getElementById('items'),actions=document.getElementById('payment-actions');
 function read(){bag={};try{var stored=JSON.parse(localStorage.getItem(key)||'{}');if(!stored||typeof stored!=='object')return;['S','M','L','XL','XXL'].forEach(function(size){var k='Black|'+size,q=stored[k];if(Number.isInteger(q)&&q>0)bag[k]=Math.min(9,q)})}catch(e){}}
 function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n}
 function change(k,q,focusName){if(busy)return;if(q<=0)delete bag[k];else bag[k]=Math.min(9,q);try{localStorage.setItem(key,JSON.stringify(bag))}catch(e){}render();if(focusName){var focusTarget=Array.from(items.querySelectorAll('button')).find(function(b){return b.getAttribute('aria-label')===focusName&&!b.disabled});if(!focusTarget)focusTarget=items.querySelector('button')||document.querySelector('.edit');if(focusTarget)focusTarget.focus()}var status=document.getElementById('checkout-status');if(status)status.textContent='Bag updated. Subtotal $'+Object.keys(bag).reduce(function(sum,k){return sum+99*bag[k]},0).toFixed(2)+'.'}
 function resizeItem(k,size,select){if(busy)return;if(['S','M','L','XL','XXL'].indexOf(size)<0)return;var dest='Black|'+size;if(dest===k)return;var q=(bag[dest]||0)+bag[k];if(q>9){select.value=k.split('|')[1];document.getElementById('checkout-status').className='checkout-message';document.getElementById('checkout-status').textContent='Maximum 9 sets per size. Adjust the quantity before changing to this size.';return}bag[dest]=q;delete bag[k];try{localStorage.setItem(key,JSON.stringify(bag));sessionStorage.setItem('sok.size',size)}catch(e){}render();var target=Array.from(items.querySelectorAll('select')).find(function(x){return x.value===size});if(target)target.focus();var status=document.getElementById('checkout-status');status.className='vh';status.textContent='Size changed to '+size+'. Order total unchanged.'}
 function render(){generation++;
 var previous=actions.querySelector('form');if(previous)Array.from(previous.elements).forEach(function(n){if(n.name)shippingDraft[n.name]=n.value});
 if(receipt&&/^[A-Z0-9]{10,32}$/.test(receipt.id||'')){items.replaceChildren();actions.replaceChildren();showReceipt(actions,receipt);return}
  items.replaceChildren();actions.replaceChildren();var keys=Object.keys(bag),total=keys.reduce(function(sum,k){return sum+99*bag[k]},0);document.getElementById('total').textContent='$'+total.toFixed(2);
  var hasPending=false;try{hasPending=Boolean(sessionStorage.getItem('sok.pending-payment'))}catch(e){}if(!keys.length&&!hasPending){items.appendChild(el('p','empty','Your bag is empty. Choose a size to start your set.'));var shop=el('a','pay-link','Explore the $99 set');shop.href='/#product';actions.appendChild(shop);return}
  keys.forEach(function(k){var size=k.split('|')[1],q=bag[k],card=el('article','product'),img=el('img');img.src='/assets/img/black-hoodie.webp';img.alt='Black Son of Kings hoodie';img.width=115;img.height=145;var art=el('div','checkout-art'),trousers=el('img');trousers.src='/assets/img/black-trousers.webp';trousers.alt='Matching black trousers';trousers.width=80;trousers.height=140;art.append(img,trousers);var info=el('div','product-info');info.append(el('p','eyebrow','HOODIE + TROUSERS'),el('h2','','Crest Tracksuit'),el('p','','Black / Size '+size),el('p','item-price','$'+(q*99).toFixed(2)));var sizeLabel=el('label','item-size-label','Size'),sizeSelect=el('select','item-size');sizeSelect.setAttribute('aria-label','Change size '+size+' in your bag');['S','M','L','XL','XXL'].forEach(function(v){var option=el('option','',v);option.value=v;option.selected=v===size;sizeSelect.appendChild(option)});sizeSelect.addEventListener('change',function(){resizeItem(k,sizeSelect.value,sizeSelect)});sizeLabel.appendChild(sizeSelect);info.appendChild(sizeLabel);var controls=el('div','item-controls'),qty=el('div','item-qty');var minus=el('button','','−'),plus=el('button','','+'),out=el('span','',String(q));minus.type=plus.type='button';minus.setAttribute('aria-label','Decrease quantity for size '+size);plus.setAttribute('aria-label','Increase quantity for size '+size);plus.disabled=q>=9;minus.addEventListener('click',function(){change(k,q-1,minus.getAttribute('aria-label'))});plus.addEventListener('click',function(){change(k,q+1,plus.getAttribute('aria-label'))});qty.append(minus,out,plus);var remove=el('button','remove-item','Remove');remove.type='button';remove.setAttribute('aria-label','Remove size '+size+' from your bag');remove.addEventListener('click',function(){change(k,0,remove.getAttribute('aria-label'))});controls.append(qty,remove);info.appendChild(controls);card.append(art,info);items.appendChild(card)});
  mountPayment();
 }

 function showReceipt(root,data){busy=true;items.querySelectorAll('button,select').forEach(function(n){n.disabled=true});root.replaceChildren(el('h2','','Payment confirmed'),el('p','','Thank you. Your order reference is '+data.id+'. Keep it for your records.'));if(data.total)root.appendChild(el('p','fine','Paid $'+data.total+' USD, including $10 shipping.'));var shop=el('a','pay-link','Continue shopping');shop.href='/#product';shop.onclick=function(){try{sessionStorage.removeItem('sok.receipt')}catch(e){}};root.appendChild(shop)}
 async function paymentRequest(body){
  var response=await fetch('/api/paypal',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
  var data;try{data=await response.json()}catch(e){throw Error('Checkout is temporarily unavailable. Please refresh or contact us.')}if(!response.ok)throw Error(data.error||'Payment request failed.');return data;
 }
 function loadSDK(id){
  if(!sdkPromise)sdkPromise=new Promise(function(resolve,reject){var script=document.createElement('script');script.src='https://www.paypal.com/sdk/js?client-id='+encodeURIComponent(id)+'&currency=USD&intent=capture&components=buttons,card-fields';script.onload=resolve;script.onerror=function(){sdkPromise=null;script.remove();reject(Error('Unable to load payment fields. Please refresh.'))};document.head.appendChild(script)});return sdkPromise;
 }
 async function mountPayment(){
  var version=generation,root=el('div'),status=el('p','fine','Loading secure checkout…');status.setAttribute('role','status');status.setAttribute('aria-live','polite');root.appendChild(status);actions.appendChild(root);
  function say(text){status.textContent=text}
  function lock(value){busy=value;items.querySelectorAll('button,select').forEach(function(n){n.disabled=value||(n.getAttribute('aria-label')||'').startsWith('Increase quantity')&&Number(n.parentNode.querySelector('span').textContent)>=9});root.querySelectorAll('input,button').forEach(function(n){n.disabled=value})}
  try{
   var pending=null;try{pending=JSON.parse(sessionStorage.getItem('sok.pending-payment')||'null')}catch(e){}
   if(pending&&!/^[A-Z0-9]{10,32}$/.test(pending.orderID||''))pending=null;
   var config=await paymentRequest();if(version!==generation)return;
   if(!config.embeddedEnabled&&!pending){say('Checkout is temporarily unavailable. Your bag is saved.');var contact=el('a','pay-link','Contact Son of Kings');contact.href='mailto:sonofkings591@gmail.com';root.append(el('p','fine','Please contact us for help with your order.'),contact);return}
   var subtotal=Object.keys(bag).reduce(function(n,k){return n+bag[k]*9900},0),tax=Math.round((subtotal+config.shippingCents)*config.taxBps/10000),total=(subtotal+config.shippingCents+tax)/100;
   if(!pending)root.append(el('p','fine','Shipping $'+(config.shippingCents/100).toFixed(2)+' · Tax $'+(tax/100).toFixed(2)),el('h2','','Total $'+total.toFixed(2)));
   var form=el('form'),names=['name','address_line_1','address_line_2','admin_area_2','admin_area_1','postal_code'],labels=['Full name','Street address','Apartment / suite (optional)','City','State (2 letters)','ZIP code'],autocomplete=['name','address-line1','address-line2','address-level2','address-level1','postal-code'];
   names.forEach(function(name,i){var label=el('label','shipping-label',labels[i]),input=el('input');input.name=name;input.value=shippingDraft[name]||'';input.autocomplete='shipping '+autocomplete[i];input.required=i!==2;input.maxLength=100;if(i===4){input.maxLength=2;input.pattern='[A-Za-z]{2}'}if(i===5)input.pattern='[0-9]{5}(-[0-9]{4})?';input.inputMode='numeric';label.appendChild(input);form.appendChild(label)});
   form.onsubmit=function(e){e.preventDefault()};if(!pending)root.append(el('h3','','Deliver to'),form,el('p','fine','United States shipping only.'));
   function address(){if(!form.reportValidity())throw Error('Complete your shipping address first.');var result={name:form.elements.namedItem('name').value.trim(),address:{country_code:'US'}};names.slice(1).forEach(function(name){result.address[name]=form.elements.namedItem(name).value.trim()});result.address.admin_area_1=result.address.admin_area_1.toUpperCase();return result}
   var snapshot=null;
   async function create(method){if(busy)throw Error('A payment is already in progress.');var shipping=address();snapshot=JSON.stringify(bag);lock(true);say('Processing securely…');try{var order=await paymentRequest({action:'create',paymentMethod:method,expectedTotalCents:Math.round(total*100),shipping:shipping,items:Object.keys(bag).map(function(k){return {color:'Black',size:k.split('|')[1],quantity:bag[k]}})});return order.id}catch(e){lock(false);say(e.message);throw e}}
   async function approve(data){
    pending={orderID:data.orderID,bag:snapshot};try{sessionStorage.setItem('sok.pending-payment',JSON.stringify(pending))}catch(e){}lock(true);
    try{var result=await paymentRequest({action:'capture',orderID:data.orderID});if(result.status!=='COMPLETED')throw Error('Not confirmed');
     try{sessionStorage.removeItem('sok.pending-payment');if(localStorage.getItem(key)===pending.bag)localStorage.removeItem(key)}catch(e){}
     receipt={id:result.id,total:result.total};try{sessionStorage.setItem('sok.receipt',JSON.stringify(receipt))}catch(e){}showReceipt(root,receipt);
    }catch(e){say('Payment confirmation is incomplete. Check this order before starting another payment.');var retry=el('button','pay-link','Check payment status');retry.type='button';retry.onclick=function(){retry.remove();approve({orderID:pending.orderID})};root.appendChild(retry)}
   }
   if(pending&&/^[A-Z0-9]{10,32}$/.test(pending.orderID||'')){snapshot=pending.bag;await approve(pending);return}
   await loadSDK(config.clientId);if(version!==generation)return;
   var card=el('section');card.hidden=true;root.appendChild(card);card.appendChild(el('h3','','Pay by card'));
   ['name','number','expiry','cvv'].forEach(function(name){var box=el('div','card-field');box.id='card-'+name;box.setAttribute('aria-label','Card '+name);card.appendChild(box)});
   var submit=el('button','pay-link','Pay $'+total.toFixed(2));submit.type='button';card.appendChild(submit);
   var privacy=el('p','fine','By paying with your card, you acknowledge that your data will be processed by PayPal subject to the '),policy=el('a','','PayPal Privacy Statement');policy.href='https://www.paypal.com/us/legalhub/paypal/privacy-full';policy.target='_blank';policy.rel='noopener noreferrer';privacy.appendChild(policy);card.appendChild(privacy);
   function failed(){if(pending){say('Your payment needs confirmation. Use Check payment status before trying again.');return}lock(false);say('Payment was not confirmed. Check your details and PayPal activity before retrying.')}
   var fields=window.paypal.CardFields({createOrder:function(){return create('card')},onApprove:approve,onError:failed,style:{input:{'font-size':'16px',color:'#171717'}}});
   if(fields.isEligible()){await Promise.all([fields.NameField().render('#card-name'),fields.NumberField().render('#card-number'),fields.ExpiryField().render('#card-expiry'),fields.CVVField().render('#card-cvv')]);if(version!==generation)return;card.hidden=false;submit.onclick=async function(){if(busy||submit.disabled)return;try{address();submit.disabled=true;await fields.submit()}catch(e){if(!pending)lock(false);say(e.message||'Check your card details.')}finally{if(!busy)submit.disabled=false}}}
   else root.appendChild(el('p','fine','On-site card payment is unavailable for this checkout. You can choose PayPal below.'));
   var buttons=el('div');buttons.id='paypal-buttons';root.append(el('p','fine','Or pay with PayPal'),buttons);
   await window.paypal.Buttons({fundingSource:window.paypal.FUNDING.PAYPAL,createOrder:function(){return create('paypal')},onApprove:approve,onCancel:function(){if(pending)return;lock(false);say('Payment cancelled. This order is not complete.')},onError:failed}).render('#paypal-buttons');
   say('Your card details are securely handled by PayPal.');
  }catch(e){if(version===generation)say(e.message||'Unable to load checkout. Please refresh.')}
 }

 window.addEventListener('storage',function(e){if(e.key===key&&!busy){read();render()}});read();render();
})();
