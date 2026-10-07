import checkout from './api/checkout.js';
import paypal from './api/paypal.js';
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  const handler={'/api/checkout':checkout,'/api/paypal':paypal}[url.pathname];
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
  await handler({method:request.method,body},response);
  return new Response(result,{status,headers});
 }
};
