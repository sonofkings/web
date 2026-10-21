import checkout from './api/checkout.js';
import paypal from './api/paypal.js';
import stripe from './api/stripe.js';
export { Inventory } from './api/inventory.mjs';
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/stripe/webhook'&&request.method==='POST')return stripe.webhook(request,env);
  if(url.pathname==='/api/inventory' && request.method==='GET'){
   if(!env.INVENTORY)return Response.json({error:'Inventory unavailable'},{status:503});
   const response=await env.INVENTORY.get(env.INVENTORY.idFromName('store')).fetch('https://inventory/',{method:'POST',body:JSON.stringify({action:'read'})});return new Response(response.body,{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  }
  if(!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  const handler={'/api/checkout':checkout,'/api/paypal':paypal,'/api/stripe':stripe.handler}[url.pathname];
  if(!handler) return Response.json({error:'Not found'},{status:404});
  if(request.method==='POST' && request.headers.get('origin') && request.headers.get('origin')!==url.origin) return Response.json({error:'Invalid origin'},{status:403});
  let body={};
  if(request.method==='POST'){
   if(Number(request.headers.get('content-length'))>8192) return Response.json({error:'Request too large'},{status:413});
   const raw=await request.text();if(raw.length>8192)return Response.json({error:'Request too large'},{status:413});
   try{body=JSON.parse(raw)}catch{return Response.json({error:'Invalid JSON'},{status:400})}
  }
  const headers=new Headers({'Content-Type':'application/json','Cache-Control':'no-store'});let status=200,result;
  const response={setHeader(k,v){headers.set(k,v)},status(n){status=n;return this},json(data){result=JSON.stringify(data);return this}};
  try{await handler({method:request.method,body,env},response)}catch{return Response.json({error:'Checkout is temporarily unavailable. Please retry shortly.'},{status:500,headers:{'Cache-Control':'no-store'}})}
  return new Response(result,{status,headers});
 }
};
