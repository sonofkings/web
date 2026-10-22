'use strict';
const assert=require('node:assert/strict');
const StripeClient=require('stripe');
const {handler,webhook,settings}=require('../api/stripe.js');
new Function(require('node:fs').readFileSync('assets/js/stripe-checkout.js','utf8'));
(async()=>{
 const {Inventory}=await import('../api/inventory.mjs');
 const spaces=new Map();
 const binding={idFromName:n=>n,get(n){if(!spaces.has(n)){const db=new Map();let queue=Promise.resolve();const storage={async get(k){return structuredClone(db.get(k))},async put(k,v){db.set(k,structuredClone(v))},transaction(fn){const p=queue.then(()=>fn(storage));queue=p.catch(()=>{});return p}};spaces.set(n,new Inventory({storage,blockConcurrencyWhile:fn=>fn()}))}return {fetch:(input,options)=>spaces.get(n).fetch(input instanceof Request?input:new Request(input,options))}}};
 const env={STRIPE_RESTRICTED_KEY:'rk_test_fake',STRIPE_PUBLISHABLE_KEY:'pk_test_fake',STRIPE_WEBHOOK_SECRET:'whsec_fake',STRIPE_ENABLED:'true',STRIPE_SANDBOX_ENABLED:'true',CHECKOUT_TAX_BPS:'0',INVENTORY:binding};
 const calls=[];let current,seq=100000000000,paid=false;const originalFetch=global.fetch;
 global.fetch=async(url,options)=>{const path=new URL(url).pathname;calls.push({path,options});
  if(options.method==='POST'&&path==='/v1/checkout/sessions'){const p=new URLSearchParams(options.body);current={id:'cs_test_'+(++seq),client_secret:'test_secret',status:'open',payment_status:'unpaid',currency:'usd',livemode:false,amount_total:21000,metadata:{site:'sonofkings.com'}};assert.equal(p.get('ui_mode'),'embedded_page');assert.equal(p.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'),'1000');assert.equal(p.get('automatic_tax[enabled]'),'false');assert.equal(p.has('payment_method_types[0]'),false);assert.match(p.get('integration_identifier'),/[a-z]{8}$/);return Response.json(current)}
  if(path.endsWith('/expire'))current={...current,status:'expired'};
  if(paid)current={...current,status:'complete',payment_status:'paid'};
  return Response.json(current);
 };
 async function invoke(body,settingsEnv=env){let status=200,data;const response={setHeader(){},status(n){status=n;return this},json(d){data=d;return this}};await handler({method:body?'POST':'GET',body,env:settingsEnv},response);return {status,data}}
 async function read(name){return (await binding.get(name).fetch(new Request('https://inventory/',{method:'POST',body:JSON.stringify({action:'read'})}))).json()}
 const cart={action:'create',items:[{color:'Black',size:'S',quantity:1,product:'set'}],expectedTotalCents:21000};
 try{
 assert.equal((await invoke()).data.enabled,true);
 assert.equal(settings({...env,STRIPE_SANDBOX_ENABLED:undefined}).enabled,false);
 assert.equal(settings({...env,CHECKOUT_TAX_BPS:'800'}).enabled,false);
 assert.equal((await invoke({...cart,expectedTotalCents:20000})).status,409);
 assert.equal((await invoke({...cart,items:[cart.items[0],cart.items[0]]})).status,400);
 assert.equal((await invoke({...cart,items:[{...cart.items[0],color:'Fake'}]})).status,400);
 const created=await invoke(cart);assert.equal(created.status,200);const firstID=created.data.id;
 assert.deepEqual((await read('stripe-sandbox')).stock.Black.S,[0,0]);assert.deepEqual((await read('store')).stock.Black.S,[1,1]);
 assert.equal((await invoke(cart)).status,409);
 assert.equal((await invoke({action:'cancel',id:firstID,clientToken:'bad'})).status,403);
 assert.equal((await invoke({action:'cancel',id:firstID,clientToken:created.data.clientToken})).data.status,'expired');
 assert.deepEqual((await read('stripe-sandbox')).stock.Black.S,[1,1]);
 await invoke({action:'status',id:firstID});assert.deepEqual((await read('stripe-sandbox')).stock.Black.S,[1,1]);
 const second=await invoke(cart);assert.equal(second.status,200);paid=true;
 function hook(type){const event={id:'evt_test',livemode:false,type,data:{object:{id:second.data.id}}};const payload=JSON.stringify(event);const signature=StripeClient.webhooks.generateTestHeaderString({payload,secret:env.STRIPE_WEBHOOK_SECRET});return new Request('https://sonofkings.com/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':signature},body:payload})}
 assert.equal((await webhook(new Request('https://site/',{method:'POST',body:'{}'}),env)).status,400);
 assert.equal((await webhook(hook('checkout.session.completed'),env)).status,200);
 assert.equal((await webhook(hook('checkout.session.async_payment_succeeded'),env)).status,200);
 assert.equal((await webhook(hook('checkout.session.expired'),env)).status,200);
 assert.deepEqual((await read('stripe-sandbox')).stock.Black.S,[0,0]);
 assert.equal((await invoke({action:'status',id:second.data.id})).data.fulfilled,true);
 console.log('Stripe pricing, sandbox isolation, stock reservation, expiry, signed webhooks and idempotency checks passed.');
 }finally{global.fetch=originalFetch}
})().catch(e=>{console.error(e);process.exitCode=1});
