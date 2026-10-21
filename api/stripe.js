const StripeClient=require('stripe');
const {createHmac,randomUUID,timingSafeEqual}=require('node:crypto');
const inventory=require('../assets/js/inventory.js');
const prices={set:19800,hoodie:12600,pants:9600};
const names={set:'Crest Tracksuit',hoodie:'Crest Hoodie',pants:'Crest Pants'};
const API_VERSION='2026-08-26.dahlia';
function settings(env){
 const secret=env.STRIPE_RESTRICTED_KEY||env.STRIPE_SECRET_KEY||'';
 const publishable=env.STRIPE_PUBLISHABLE_KEY||'';
 const live=/^(rk|sk)_live_/.test(secret)&&publishable.startsWith('pk_live_');
 const sandbox=/^(rk|sk)_test_/.test(secret)&&publishable.startsWith('pk_test_');
 const enabled=env.STRIPE_ENABLED==='true'&&!!env.INVENTORY&&!!env.STRIPE_WEBHOOK_SECRET&&env.CHECKOUT_TAX_BPS==='0'&&(live||sandbox&&env.STRIPE_SANDBOX_ENABLED==='true');
 return {secret,publishable,live,sandbox,enabled};
}
function client(env){const c=settings(env);return new StripeClient(c.secret,{apiVersion:API_VERSION,httpClient:StripeClient.createFetchHttpClient(),maxNetworkRetries:2,timeout:15000})}
async function stock(env,action,data={}){
 const c=settings(env),name=c.live?'store':'stripe-sandbox';
 const response=await env.INVENTORY.get(env.INVENTORY.idFromName(name)).fetch('https://inventory/',{method:'POST',body:JSON.stringify({action,...data})});
 if(!response.ok)throw Error('Inventory unavailable');return response.json();
}
function validCart(items){return Array.isArray(items)&&items.length>0&&items.length<=15&&new Set(items.map(x=>x&&x.color+'|'+x.size+'|'+(x.product||'set'))).size===items.length&&items.every(x=>x&&Object.hasOwn(prices,x.product||'set')&&Object.hasOwn(inventory.stock,x.color)&&inventory.sizes.includes(x.size)&&Number.isInteger(x.quantity)&&x.quantity>=1&&x.quantity<=9)}
function token(id,secret){return createHmac('sha256',secret).update('sok-stripe:'+id).digest('hex')}
function validToken(value,id,secret){const expected=token(id,secret);return typeof value==='string'&&value.length===expected.length&&timingSafeEqual(Buffer.from(value),Buffer.from(expected))}
async function reconcile(env,stripe,session,eventType){
 const c=settings(env);
 if(session.metadata?.site!=='sonofkings.com'||session.currency!=='usd'||session.livemode!==c.live)return {ok:false};
 const id='stripe:'+session.id,record=await stock(env,'lookup',{id});
 if(!record.exists)return {ok:false};
 if(session.payment_status==='paid'){if(record.total!==session.amount_total)return {ok:false};return stock(env,'complete',{id})}
 if(session.status==='expired'||eventType==='checkout.session.async_payment_failed')return stock(env,'release',{id});
 return {ok:true};
}
async function handler(req,res){
 const env=req.env||process.env,c=settings(env);res.setHeader('Cache-Control','no-store');
 if(req.method==='GET')return res.status(200).json({enabled:c.enabled,live:c.live,publishableKey:c.enabled?c.publishable:null,shippingCents:1000,taxBps:0,configuration:{serverKey:!c.secret?'missing':/^(rk|sk)_live_/.test(c.secret)?'live':/^(rk|sk)_test_/.test(c.secret)?'test':'invalid_format',publishableKey:!c.publishable?'missing':c.publishable.startsWith('pk_live_')?'live':c.publishable.startsWith('pk_test_')?'test':'invalid_format',webhookConfigured:Boolean(env.STRIPE_WEBHOOK_SECRET),inventoryConfigured:Boolean(env.INVENTORY),enabledFlag:env.STRIPE_ENABLED==='true',zeroTaxConfigured:env.CHECKOUT_TAX_BPS==='0'}});
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const body=req.body||{};
 if(!c.secret||!env.INVENTORY)return res.status(503).json({error:'Stripe is not configured.'});
 try{
  const stripe=client(env);
  if(body.action==='create'){
   if(!c.enabled)return res.status(503).json({error:'Stripe checkout is not enabled.'});
   if(!validCart(body.items))return res.status(400).json({error:'Invalid cart'});
   const total=1000+body.items.reduce((sum,x)=>sum+prices[x.product||'set']*x.quantity,0);
   if(body.expectedTotalCents!==total)return res.status(409).json({error:'Your total changed. Refresh checkout to review it.'});
   if(!(await stock(env,'check',{items:body.items})).ok)return res.status(409).json({error:'An item is sold out or exceeds remaining stock. Please adjust your bag.'});
   const requestId=randomUUID();
   const session=await stripe.checkout.sessions.create({
    mode:'payment',ui_mode:'embedded_page',currency:'usd',
    integration_identifier:'sonofkings_embedded_mqtxlvas',
    expires_at:Math.floor(Date.now()/1000)+1800,
    return_url:'https://sonofkings.com/checkout/?session_id={CHECKOUT_SESSION_ID}',
    shipping_address_collection:{allowed_countries:['US']},
    shipping_options:[{shipping_rate_data:{type:'fixed_amount',fixed_amount:{amount:1000,currency:'usd'},display_name:'Tracked U.S. shipping'}}],
    automatic_tax:{enabled:false},adaptive_pricing:{enabled:false},
    metadata:{site:'sonofkings.com',order_reference:requestId},
    line_items:body.items.map(x=>({quantity:x.quantity,price_data:{currency:'usd',unit_amount:prices[x.product||'set'],product_data:{name:inventory.colorName(x.color)+' '+names[x.product||'set']+' — '+x.size}}}))
   },{idempotencyKey:requestId});
   if(!session.client_secret)throw Error('Unexpected session');
   const id='stripe:'+session.id;
   await stock(env,'register',{id,items:body.items,total,provider:'stripe'});
   if(!(await stock(env,'reserve',{id})).ok){await stripe.checkout.sessions.expire(session.id);return res.status(409).json({error:'An item just sold out. Please adjust your bag.'})}
   return res.status(200).json({id:session.id,clientSecret:session.client_secret,clientToken:token(session.id,c.secret),sandbox:!c.live});
  }
  if(!/^cs_(test_|live_)?[A-Za-z0-9]{10,240}$/.test(body.id||''))return res.status(400).json({error:'Invalid session'});
  if(!['status','cancel'].includes(body.action))return res.status(400).json({error:'Invalid action'});
  let session=await stripe.checkout.sessions.retrieve(body.id);
  if(body.action==='cancel'){
   if(!validToken(body.clientToken,body.id,c.secret))return res.status(403).json({error:'Invalid checkout token'});
   if(session.status==='open')session=await stripe.checkout.sessions.expire(body.id);
  }
  const result=await reconcile(env,stripe,session);
  if(!result.ok)return res.status(409).json({error:'Unable to confirm this checkout. Please contact Son of Kings.'});
  return res.status(200).json({id:session.id,status:session.status,paymentStatus:session.payment_status,total:session.amount_total,fulfilled:session.payment_status==='paid'});
 }catch{return res.status(502).json({error:'Stripe could not complete this request. Please retry.'})}
}
async function webhook(request,env){
 const c=settings(env);if(!env.STRIPE_WEBHOOK_SECRET||!c.secret)return Response.json({error:'Not configured'},{status:503});
 let event;const stripe=client(env);
 try{const raw=await request.text();if(raw.length>262144)return Response.json({error:'Too large'},{status:413});event=await stripe.webhooks.constructEventAsync(raw,request.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET)}catch{return Response.json({error:'Invalid signature'},{status:400})}
 if(event.livemode!==c.live)return Response.json({error:'Wrong environment'},{status:400});
 if(!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired'].includes(event.type))return Response.json({received:true});
 try{const session=await stripe.checkout.sessions.retrieve(event.data.object.id);const result=await reconcile(env,stripe,session,event.type);if(!result.ok)return Response.json({error:'Reconciliation pending'},{status:503});return Response.json({received:true})}catch{return Response.json({error:'Reconciliation pending'},{status:503})}
}
module.exports={handler,webhook,validCart,settings};
