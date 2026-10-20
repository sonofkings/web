const { createHmac, randomUUID, timingSafeEqual } = require('node:crypto');
const SIZES = new Set(['S','M','L','XL','XXL']);
const base = () => process.env.PAYPAL_ENV === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
const signature = (invoice, amount) => createHmac('sha256', process.env.PAYPAL_CLIENT_SECRET).update(invoice + ':' + amount).digest('hex');
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  const configured = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  // Explicit launch settings: never assume shipping or tax are zero.
  const shippingRaw=process.env.CHECKOUT_US_SHIPPING_CENTS, taxRaw=process.env.CHECKOUT_TAX_BPS;
  const validSetting=x=>typeof x==='string'&&/^\d{1,6}$/.test(x);
  const ready=configured&&process.env.PAYPAL_EMBEDDED_ENABLED==='true'&&validSetting(shippingRaw)&&validSetting(taxRaw)&&Number(taxRaw)<=10000;
  const shippingCents=Number(shippingRaw),taxBps=Number(taxRaw);
  if(req.method === 'GET') return res.status(200).json({configured,cardConfigured:Boolean(process.env.STRIPE_SECRET_KEY),clientId:configured?process.env.PAYPAL_CLIENT_ID:null,embeddedEnabled:ready,shippingCents:ready?shippingCents:null,taxBps:ready?taxBps:null});
  if(req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  if(!ready) return res.status(503).json({error:'Embedded checkout is not available yet.'});
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if(!['create','capture'].includes(body.action)) return res.status(400).json({error:'Invalid action'});
    let cart;
    if(body.action === 'create') {
      cart=body.items;
      if(!Array.isArray(cart)||!cart.length||cart.length>5||new Set(cart.map(x=>x&&x.size)).size!==cart.length||cart.some(x=>!x||x.color!=='Black'||!SIZES.has(x.size)||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>9)) return res.status(400).json({error:'Invalid cart'});
    } else if(!/^[A-Z0-9]{10,32}$/.test(body.orderID||'')) return res.status(400).json({error:'Invalid order'});
    const auth=await fetch(base()+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(process.env.PAYPAL_CLIENT_ID+':'+process.env.PAYPAL_CLIENT_SECRET).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
    const token=await auth.json(); if(!auth.ok||!token.access_token) throw Error('PayPal authentication failed');
    async function api(path,method='GET',data,id){const r=await fetch(base()+path,{method,headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json',...(id?{'PayPal-Request-Id':id}:{})},...(data?{body:JSON.stringify(data)}:{})});const d=await r.json();if(!r.ok) throw Error('PayPal request failed');return d;}
    if(body.action==='create'){
      const s=body.shipping;
      if(!s||typeof s.name!=='string'||!s.name.trim()||s.name.length>100||!s.address||s.address.country_code!=='US'||['address_line_1','admin_area_2','admin_area_1','postal_code'].some(k=>typeof s.address[k]!=='string'||!s.address[k].trim()||s.address[k].length>100)||!/^[A-Z]{2}$/.test(s.address.admin_area_1)||!/^\d{5}(-\d{4})?$/.test(s.address.postal_code)) return res.status(400).json({error:'Please enter a valid U.S. shipping address.'});
      const shipping={name:{full_name:s.name.trim()},address:{country_code:'US'}};
      for(const k of ['address_line_1','address_line_2','admin_area_2','admin_area_1','postal_code']) if(typeof s.address[k]==='string'&&s.address[k].trim()) shipping.address[k]=s.address[k].trim().slice(0,100);
      const subtotal=cart.reduce((n,x)=>n+x.quantity*9900,0),tax=Math.round((subtotal+shippingCents)*taxBps/10000);
      const money=n=>(n/100).toFixed(2),value=money(subtotal+shippingCents+tax),invoice=randomUUID();
      const order=await api('/v2/checkout/orders','POST',{intent:'CAPTURE',purchase_units:[{reference_id:'SONOFKINGS',invoice_id:invoice,custom_id:signature(invoice,value),shipping,amount:{currency_code:'USD',value,breakdown:{item_total:{currency_code:'USD',value:money(subtotal)},shipping:{currency_code:'USD',value:money(shippingCents)},tax_total:{currency_code:'USD',value:money(tax)}}},items:cart.map(x=>({name:'Black Crest Tracksuit — '+x.size,sku:'SOK-BLACK-'+x.size,quantity:String(x.quantity),unit_amount:{currency_code:'USD',value:'99.00'},category:'PHYSICAL_GOODS'}))}],payment_source:body.paymentMethod==='card'?{card:{attributes:{verification:{method:'SCA_WHEN_REQUIRED'}}}}:{paypal:{experience_context:{brand_name:'Son of Kings',shipping_preference:'SET_PROVIDED_ADDRESS',user_action:'PAY_NOW',return_url:'https://sonofkings.com/checkout/',cancel_url:'https://sonofkings.com/checkout/'}}}},invoice);
      return res.status(200).json({id:order.id});
    }
    const path='/v2/checkout/orders/'+body.orderID,order=await api(path),unit=order.purchase_units&&order.purchase_units[0];
    if(!unit||order.purchase_units.length!==1||unit.reference_id!=='SONOFKINGS'||unit.amount.currency_code!=='USD'||!unit.invoice_id||typeof unit.custom_id!=='string') return res.status(400).json({error:'Invalid order'});
    const expected=signature(unit.invoice_id,unit.amount.value),actual=unit.custom_id;
    if(actual.length!==expected.length||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected))) return res.status(400).json({error:'Invalid order'});
    if(!unit.shipping||unit.shipping.address.country_code!=='US') return res.status(400).json({error:'Please select a U.S. shipping address in PayPal.'});
    const result=order.status==='COMPLETED'?order:await api(path+'/capture','POST',{},body.orderID+'-capture');
    const capture=result.purchase_units?.[0]?.payments?.captures?.[0];
    if(result.status!=='COMPLETED'||capture?.status!=='COMPLETED'||capture.amount.currency_code!=='USD'||capture.amount.value!==unit.amount.value) return res.status(409).json({error:'Payment has not completed. Please check PayPal before trying again.'});
    return res.status(200).json({status:'COMPLETED',id:result.id});
  }catch(error){console.error('PayPal checkout failed');return res.status(502).json({error:'PayPal could not complete this request. Please try again.'});}
};
