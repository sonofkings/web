
'use strict';
const assert=require('node:assert/strict');
new Function(require('node:fs').readFileSync(require('node:path').join(__dirname,'../assets/js/checkout.js'),'utf8'));
new Function(require('node:fs').readFileSync(require('node:path').join(__dirname,'../assets/js/site.js'),'utf8'));
const handler=require('../api/paypal.js');
const {createHmac}=require('node:crypto');
const env={PAYPAL_CLIENT_ID:'test-client',PAYPAL_CLIENT_SECRET:'test-secret',PAYPAL_EMBEDDED_ENABLED:'true',CHECKOUT_TAX_BPS:'0',PAYPAL_ENV:'sandbox'};
env.INVENTORY={idFromName:()=> 'store',get:()=>({fetch:async()=>Response.json({ok:true})})};
const shipping={name:'Test Buyer',address:{country_code:'US',address_line_1:'1 Main St',admin_area_2:'Chicago',admin_area_1:'IL',postal_code:'60601'}};
const items=[{color:'Black',size:'M',quantity:2},{color:'Black',size:'L',quantity:1}];
let requests=[],order=null,captureStatus='COMPLETED';
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options={})=>{
 requests.push({url,options});
 if(url.endsWith('/token'))return {ok:true,json:async()=>({access_token:'test-token'})};
 if(options.method==='POST'&&url.endsWith('/v2/checkout/orders'))return {ok:true,json:async()=>({id:'TESTORDER12345'})};
 if(url.endsWith('/capture'))return {ok:true,json:async()=>({...order,status:captureStatus,purchase_units:[{...order.purchase_units[0],payments:{captures:[{status:captureStatus,amount:order.purchase_units[0].amount}]}}]})};
 return {ok:true,json:async()=>order};
};
async function invoke(method,body,settings=env){let status=200,data;const res={setHeader(){},status(n){status=n;return this},json(d){data=d;return this}};await handler({method,body,env:settings},res);return {status,data}}
const create=(extra={})=>invoke('POST',{action:'create',paymentMethod:'card',shipping,items,expectedTotalCents:61000,...extra});
async function run(){
 try{
 assert.equal((await invoke('GET')).data.shippingCents,1000);
 assert.equal((await invoke('GET',null,{...env,CHECKOUT_TAX_BPS:undefined})).data.embeddedEnabled,false);
 assert.equal((await invoke('PUT')).status,405);
 assert.equal((await create({items:[]})).status,400);
 assert.equal((await create({items:[items[0],items[0]]})).status,400);
 assert.equal((await create({items:[{...items[0],quantity:10}]})).status,400);
 assert.equal((await create({paymentMethod:'invalid'})).status,400);
 assert.equal((await create({shipping:{...shipping,address:{...shipping.address,admin_area_1:'ZZ'}}})).status,400);
 assert.equal((await create({expectedTotalCents:29700})).status,409);
 for(const [product,cents] of [['pants',9600],['hoodie',12099],['set',20000]]){
 assert.equal((await create({items:[{color:'Black',size:'M',quantity:1,product}],expectedTotalCents:cents+1000})).status,200);
 assert.equal(JSON.parse(requests.at(-1).options.body).purchase_units[0].items[0].unit_amount.value,(cents/100).toFixed(2));
 }
 assert.equal((await create({items:[{color:'Black',size:'M',quantity:1,product:'pants'},{color:'Black',size:'M',quantity:1,product:'hoodie'}],expectedTotalCents:22699})).status,200);
 assert.equal((await create({items:[{...items[0],product:'invalid'}]})).status,400);
 assert.equal((await create()).status,200);
 let payload=JSON.parse(requests.at(-1).options.body),unit=payload.purchase_units[0];
 assert.equal(unit.amount.value,'610.00');
 assert.equal(unit.amount.breakdown.shipping.value,'10.00');
 assert.equal(unit.items.length,2);
 assert.equal(payload.payment_source.card.attributes.verification.method,'SCA_WHEN_REQUIRED');
 await create({paymentMethod:'paypal'});
 assert.equal(JSON.parse(requests.at(-1).options.body).payment_source.paypal.experience_context.shipping_preference,'SET_PROVIDED_ADDRESS');
 await invoke('POST',{action:'create',paymentMethod:'card',shipping,items,expectedTotalCents:65880},{...env,CHECKOUT_TAX_BPS:'800'});
 assert.equal(JSON.parse(requests.at(-1).options.body).purchase_units[0].amount.value,'658.80');
 const signed={...unit,invoice_id:'test-invoice'};signed.custom_id=createHmac('sha256',env.PAYPAL_CLIENT_SECRET).update(signed.invoice_id+':'+signed.amount.value).digest('hex');
 order={id:'TESTORDER12345',status:'APPROVED',purchase_units:[signed]};
 assert.equal((await invoke('POST',{action:'capture',orderID:order.id})).status,200);
 assert.equal(requests.at(-1).options.headers['PayPal-Request-Id'],'TESTORDER12345-capture');
 assert.equal((await invoke('POST',{action:'capture',orderID:order.id},{...env,PAYPAL_EMBEDDED_ENABLED:'false'})).status,200);
 captureStatus='PENDING';assert.equal((await invoke('POST',{action:'capture',orderID:order.id})).status,409);captureStatus='COMPLETED';
 order.status='CREATED';assert.equal((await invoke('POST',{action:'capture',orderID:order.id})).status,409);order.status='APPROVED';
 order.purchase_units[0].custom_id='0'.repeat(64);assert.equal((await invoke('POST',{action:'capture',orderID:order.id})).status,400);
 order.purchase_units[0]=signed;order.purchase_units[0].custom_id=createHmac('sha256',env.PAYPAL_CLIENT_SECRET).update(signed.invoice_id+':'+signed.amount.value).digest('hex');
 order={...order,status:'COMPLETED',purchase_units:[{...signed,payments:{captures:[{status:'COMPLETED',amount:signed.amount}]}}]};
 const before=requests.filter(x=>x.url.endsWith('/capture')).length;
 assert.equal((await invoke('POST',{action:'capture',orderID:order.id})).data.total,'610.00');
 assert.equal(requests.filter(x=>x.url.endsWith('/capture')).length,before);
 for(const color of ['Navy','Royal Blue','Forest Green','Marble','Crimson']){
 assert.equal((await create({items:[{color,size:'XL',quantity:1,product:'hoodie'}],expectedTotalCents:13099})).status,200);
 assert.equal(JSON.parse(requests.at(-1).options.body).purchase_units[0].items[0].name.startsWith(require('../assets/js/inventory.js').colorName(color)+' '),true);
 }
 assert.equal((await create({items:[{color:'Black',size:'4XL',quantity:1}],expectedTotalCents:21000})).status,200);
 const rejectStock={...env,INVENTORY:{idFromName:()=> 'store',get:()=>({fetch:async()=>Response.json({ok:false,error:'Stock unavailable'})})}};
 assert.equal((await invoke('POST',{action:'create',paymentMethod:'card',shipping,items,expectedTotalCents:61000},rejectStock)).status,409);
 order.status='APPROVED';const capturesBefore=requests.filter(x=>x.url.endsWith('/capture')).length;
 assert.equal((await invoke('POST',{action:'capture',orderID:order.id},rejectStock)).status,409);
 assert.equal(requests.filter(x=>x.url.endsWith('/capture')).length,capturesBefore);
 console.log('PayPal checkout regression checks passed.');
 }finally{globalThis.fetch=originalFetch}
}
module.exports=run();
