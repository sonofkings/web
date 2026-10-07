const { createHmac, randomUUID, timingSafeEqual } = require('node:crypto');
const SIZES = new Set(['S','M','L','XL','XXL']);
const base = () => process.env.PAYPAL_ENV === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
const signature = (invoice, amount) => createHmac('sha256', process.env.PAYPAL_CLIENT_SECRET).update(invoice + ':' + amount).digest('hex');
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  const configured = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  if(req.method === 'GET') return res.status(200).json({configured,clientId:configured?process.env.PAYPAL_CLIENT_ID:null});
  if(req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  if(!configured) return res.status(503).json({error:'PayPal is not available yet. Please use card checkout.'});
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
      const value=cart.reduce((n,x)=>n+x.quantity*99,0).toFixed(2),invoice=randomUUID();
      const order=await api('/v2/checkout/orders','POST',{intent:'CAPTURE',purchase_units:[{reference_id:'SONOFKINGS',invoice_id:invoice,custom_id:signature(invoice,value),amount:{currency_code:'USD',value,breakdown:{item_total:{currency_code:'USD',value}}},items:cart.map(x=>({name:'Black Crest Tracksuit — '+x.size,sku:'SOK-BLACK-'+x.size,quantity:String(x.quantity),unit_amount:{currency_code:'USD',value:'99.00'},category:'PHYSICAL_GOODS'}))}],payment_source:{paypal:{experience_context:{brand_name:'Son of Kings',shipping_preference:'GET_FROM_FILE',user_action:'PAY_NOW',return_url:'https://sonofkings.com/checkout/',cancel_url:'https://sonofkings.com/checkout/'}}}},invoice);
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
