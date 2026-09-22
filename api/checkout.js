const PRICE_ID='price_1UHmMd0y7rc6eekMfkkoFPc7';
const SIZES=new Set(['S','M','L','XL','XXL']);
module.exports=async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  const items=Array.isArray(body.items)?body.items:[];
  const valid=items.filter(x=>x&&x.color==='Black'&&SIZES.has(x.size)&&Number.isInteger(x.quantity)&&x.quantity>=1&&x.quantity<=9);
  if(!valid.length||valid.length!==items.length)return res.status(400).json({error:'Invalid cart'});
  const params=new URLSearchParams();
  params.set('mode','payment');params.set('success_url','https://sonofkings.com/checkout/success.html?session_id={CHECKOUT_SESSION_ID}');params.set('cancel_url','https://sonofkings.com/checkout/');
  params.set('shipping_address_collection[allowed_countries][0]','US');params.set('phone_number_collection[enabled]','true');
  params.set('metadata[site]','sonofkings.com');params.set('metadata[cart]',valid.map(x=>x.size+'x'+x.quantity).join(','));
  valid.forEach((x,i)=>{params.set('line_items['+i+'][price]',PRICE_ID);params.set('line_items['+i+'][quantity]',String(x.quantity));params.set('line_items['+i+'][metadata][size]',x.size);});
  const stripe=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:'Bearer '+process.env.STRIPE_SECRET_KEY,'Content-Type':'application/x-www-form-urlencoded'},body:params});
  const data=await stripe.json();if(!stripe.ok)throw new Error(data.error&&data.error.message||'Stripe error');
  return res.status(200).json({url:data.url});
 }catch(e){console.error(e);return res.status(500).json({error:'Unable to create checkout'});}
}