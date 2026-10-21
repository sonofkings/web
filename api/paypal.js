const { createHmac, randomUUID, timingSafeEqual } = require('node:crypto');
const PRICES={set:19800,pants:9600,hoodie:12600};
const NAMES={set:'Crest Tracksuit',pants:'Crest Pants',hoodie:'Crest Hoodie'};
const SIZES = new Set(['S','M','L','XL','XXL']);
const STATES = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  const env=req.env||process.env;
  const signature=(invoice,amount)=>createHmac('sha256',env.PAYPAL_CLIENT_SECRET).update(invoice+':'+amount).digest('hex');
  const apiBase=env.PAYPAL_ENV==='sandbox'?'https://api-m.sandbox.paypal.com':'https://api-m.paypal.com';
  const configured = Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);
  // Explicit launch settings: never assume shipping or tax are zero.
  const taxRaw=env.CHECKOUT_TAX_BPS;
  const validSetting=x=>typeof x==='string'&&/^\d{1,6}$/.test(x);
  const ready=configured&&env.PAYPAL_EMBEDDED_ENABLED==='true'&&validSetting(taxRaw)&&Number(taxRaw)<=10000;
  const shippingCents=1000,taxBps=Number(taxRaw);
  if(req.method === 'GET') return res.status(200).json({configured,cardConfigured:Boolean(env.STRIPE_SECRET_KEY),clientId:configured?env.PAYPAL_CLIENT_ID:null,embeddedEnabled:ready,shippingCents:ready?shippingCents:null,taxBps:ready?taxBps:null});
  if(req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if(!['create','capture'].includes(body.action)) return res.status(400).json({error:'Invalid action'});
    if(!configured||(body.action==='create'&&!ready))return res.status(503).json({error:'Embedded checkout is not available yet.'});
    if(body.action==='create'&&!['card','paypal'].includes(body.paymentMethod))return res.status(400).json({error:'Invalid payment method'});
    let cart;
    if(body.action === 'create') {
      cart=body.items;
      if(!Array.isArray(cart)||!cart.length||cart.length>15||new Set(cart.map(x=>x&&(x.product||'set')+'|'+x.size)).size!==cart.length||cart.some(x=>!x||!Object.hasOwn(PRICES,x.product||'set')||x.color!=='Black'||!SIZES.has(x.size)||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>9)) return res.status(400).json({error:'Invalid cart'});
    } else if(!/^[A-Z0-9]{10,32}$/.test(body.orderID||'')) return res.status(400).json({error:'Invalid order'});
    const auth=await fetch(apiBase+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(env.PAYPAL_CLIENT_ID+':'+env.PAYPAL_CLIENT_SECRET).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(15000)});
    const token=await auth.json(); if(!auth.ok||!token.access_token) throw Error('PayPal authentication failed');
    async function api(path,method='GET',data,id){const r=await fetch(apiBase+path,{method,headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json',...(id?{'PayPal-Request-Id':id}:{})},signal:AbortSignal.timeout(20000),...(data?{body:JSON.stringify(data)}:{})});const d=await r.json();if(!r.ok) throw Error('PayPal request failed');return d;}
    if(body.action==='create'){
      const s=body.shipping;
      if(!s||typeof s.name!=='string'||!s.name.trim()||s.name.length>100||!s.address||s.address.country_code!=='US'||['address_line_1','admin_area_2','admin_area_1','postal_code'].some(k=>typeof s.address[k]!=='string'||!s.address[k].trim()||s.address[k].length>100)||!STATES.has(s.address.admin_area_1)||!/^\d{5}(-\d{4})?$/.test(s.address.postal_code)) return res.status(400).json({error:'Please enter a valid U.S. shipping address.'});
      const shipping={name:{full_name:s.name.trim()},address:{country_code:'US'}};
      for(const k of ['address_line_1','address_line_2','admin_area_2','admin_area_1','postal_code']) if(typeof s.address[k]==='string'&&s.address[k].trim()) shipping.address[k]=s.address[k].trim().slice(0,100);
      const subtotal=cart.reduce((n,x)=>n+x.quantity*PRICES[x.product||'set'],0),tax=Math.round((subtotal+shippingCents)*taxBps/10000);
      const totalCents=subtotal+shippingCents+tax;
      if(body.expectedTotalCents!==totalCents)return res.status(409).json({error:'Your order total changed. Refresh checkout to review the latest total.'});
      const money=n=>(n/100).toFixed(2),value=money(subtotal+shippingCents+tax),invoice=randomUUID();
      const order=await api('/v2/checkout/orders','POST',{intent:'CAPTURE',purchase_units:[{reference_id:'SONOFKINGS',invoice_id:invoice,custom_id:signature(invoice,value),shipping,amount:{currency_code:'USD',value,breakdown:{item_total:{currency_code:'USD',value:money(subtotal)},shipping:{currency_code:'USD',value:money(shippingCents)},tax_total:{currency_code:'USD',value:money(tax)}}},items:cart.map(x=>({name:'Black '+NAMES[x.product||'set']+' — '+x.size,sku:'SOK-BLACK-'+(x.product||'set')+'-'+x.size,quantity:String(x.quantity),unit_amount:{currency_code:'USD',value:money(PRICES[x.product||'set'])},category:'PHYSICAL_GOODS'}))}],payment_source:body.paymentMethod==='card'?{card:{attributes:{verification:{method:'SCA_WHEN_REQUIRED'}}}}:{paypal:{experience_context:{brand_name:'Son of Kings',shipping_preference:'SET_PROVIDED_ADDRESS',user_action:'PAY_NOW',return_url:'https://sonofkings.com/checkout/',cancel_url:'https://sonofkings.com/checkout/'}}}},invoice);
      if(!order.id)throw Error('Missing PayPal order ID');
      return res.status(200).json({id:order.id});
    }
    const path='/v2/checkout/orders/'+body.orderID,order=await api(path),unit=order.purchase_units&&order.purchase_units[0];
    if(!unit||order.purchase_units.length!==1||unit.reference_id!=='SONOFKINGS'||unit.amount?.currency_code!=='USD'||!unit.invoice_id||typeof unit.custom_id!=='string') return res.status(400).json({error:'Invalid order'});
    const expected=signature(unit.invoice_id,unit.amount.value),actual=unit.custom_id;
    if(actual.length!==expected.length||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected))) return res.status(400).json({error:'Invalid order'});
    if(!unit.shipping||unit.shipping.address?.country_code!=='US') return res.status(400).json({error:'Please select a U.S. shipping address in PayPal.'});
    if(!['APPROVED','COMPLETED'].includes(order.status))return res.status(409).json({error:'This order is not approved for payment yet.'});
    const result=order.status==='COMPLETED'?order:await api(path+'/capture','POST',{},body.orderID+'-capture');
    const capture=result.purchase_units?.[0]?.payments?.captures?.[0];
    if(result.status!=='COMPLETED'||capture?.status!=='COMPLETED'||capture.amount.currency_code!=='USD'||capture.amount.value!==unit.amount.value) return res.status(409).json({error:'Payment has not completed. Please check PayPal before trying again.'});
    return res.status(200).json({status:'COMPLETED',id:result.id,total:capture.amount.value});
  }catch(error){console.error('PayPal checkout failed');return res.status(502).json({error:'PayPal could not complete this request. Please try again.'});}
};
