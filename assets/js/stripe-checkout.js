/* Embedded Stripe Checkout; no card information passes through this server. */
(function(){
 'use strict';
 var sdk;
 function node(tag,text,cls){var n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n}
 async function request(body){var response=await fetch('/api/stripe',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)}:{cache:'no-store',signal:AbortSignal.timeout(10000)});var data=await response.json();if(!response.ok)throw Error(data.error||'Unable to load secure checkout.');return data}
 function load(){if(!sdk)sdk=new Promise(function(resolve,reject){if(window.Stripe){resolve();return}var script=document.createElement('script');script.src='https://js.stripe.com/v3/';script.onload=resolve;script.onerror=function(){sdk=null;reject(Error('Unable to load Stripe. Please refresh.'))};document.head.appendChild(script)});return sdk}
 function pending(){try{return JSON.parse(sessionStorage.getItem('sok.stripe.pending')||'null')}catch{return null}}
 async function mount(root,bag,config,callbacks){
  var embedded=null,disposed=false,saved=pending(),query=new URLSearchParams(location.search),returned=query.get('session_id');
  var status=node('p','','fine');status.setAttribute('role','status');root.appendChild(status);
  if(!config.live)root.appendChild(node('p','TEST CHECKOUT — no real payments.','checkout-message'));
  function say(t){if(!disposed)status.textContent=t}
  function cleanup(){disposed=true;if(embedded)embedded.destroy()}
  function paid(result){if(disposed)return;var matches=saved&&saved.id===result.id;try{if(matches&&localStorage.getItem('sok.bag.v2')===saved.snapshot)localStorage.removeItem('sok.bag.v2');if(matches)sessionStorage.removeItem('sok.stripe.pending')}catch(e){}callbacks.confirmed(result)}
  async function check(id){callbacks.busy(true);say('Confirming your payment…');try{var result=await request({action:'status',id:id});if(disposed)return;if(result.fulfilled){paid(result);return}say(result.status==='expired'?'This checkout expired. Your payment was not completed.':'Your payment is not confirmed yet. Check its status before starting another payment.');var retry=node('button','Check payment status','pay-link');retry.type='button';retry.onclick=function(){retry.remove();check(id)};root.appendChild(retry);if(result.status==='expired'){sessionStorage.removeItem('sok.stripe.pending');var back=node('a','Return to your bag','pay-link');back.href='/checkout/';root.appendChild(back)}}catch(e){say(e.message);var retry=node('button','Retry payment status','pay-link');retry.onclick=function(){retry.remove();check(id)};root.appendChild(retry)}}
  if(returned){await check(returned);return cleanup}
  var start=node('button','Continue to secure payment','pay-link');start.type='button';root.append(node('p','Pay securely by card or an available wallet. Shipping is $10 per order.','fine'),start);
  async function open(){callbacks.busy(true);start.disabled=true;say('Preparing secure checkout…');
   try{
    var snapshot=JSON.stringify(bag),order;
    await load();if(disposed)return;
    if(saved&&saved.snapshot===snapshot){var previous=await request({action:'status',id:saved.id});if(previous.fulfilled){paid(previous);return}if(previous.status==='open')order=saved;else if(previous.status==='complete'){await check(saved.id);return}}
    if(!order){var prices={set:19800,pants:9600,hoodie:12600},items=Object.keys(bag).map(function(k){var p=k.split('|');return {color:p[0],size:p[1],product:p[2]||'set',quantity:bag[k]}});order=await request({action:'create',items:items,expectedTotalCents:1000+items.reduce(function(n,x){return n+x.quantity*prices[x.product]},0)});saved=Object.assign({},order,{snapshot:snapshot});sessionStorage.setItem('sok.stripe.pending',JSON.stringify(saved))}
    if(disposed)return;
    var container=node('div');container.id='stripe-embedded';root.appendChild(container);var stripe=window.Stripe(config.publishableKey);embedded=await stripe.createEmbeddedCheckoutPage({fetchClientSecret:function(){return Promise.resolve(order.clientSecret)}});if(disposed){embedded.destroy();return}embedded.mount('#stripe-embedded');start.hidden=true;say('Enter your delivery and payment details below.');
    var edit=node('button','Edit your bag','btn btn--ghost btn--block');edit.type='button';root.appendChild(edit);edit.onclick=async function(){edit.disabled=true;say('Closing this checkout…');try{var result=await request({action:'cancel',id:saved.id,clientToken:saved.clientToken});if(result.fulfilled){paid(result);return}if(result.status!=='expired')throw Error('Payment may be processing. Check payment status before editing your bag.');sessionStorage.removeItem('sok.stripe.pending');cleanup();callbacks.edit()}catch(e){say(e.message);edit.disabled=false}};
   }catch(e){say(e.message);start.disabled=false;if(!saved)callbacks.busy(false)}
  }
  start.onclick=open;
  if(saved)await open();
  return cleanup;
 }
 window.SOKStripe={request:request,mount:mount,pending:pending};
})();
