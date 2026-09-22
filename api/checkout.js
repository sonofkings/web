const PRICE_ID = 'price_1UHmMd0y7rc6eekMfkkoFPc7';
const SIZES = new Set(['S', 'M', 'L', 'XL', 'XXL']);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const valid = items.filter((item) =>
      item &&
      item.color === 'Black' &&
      SIZES.has(item.size) &&
      Number.isInteger(item.quantity) &&
      item.quantity >= 1 &&
      item.quantity <= 9
    );

    if (!valid.length || valid.length !== items.length || valid.length > SIZES.size) {
      return res.status(400).json({ error: 'Invalid cart' });
    }

    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('success_url', 'https://sonofkings.com/checkout/success.html?session_id={CHECKOUT_SESSION_ID}');
    params.set('cancel_url', 'https://sonofkings.com/checkout/');
    params.set('shipping_address_collection[allowed_countries][0]', 'US');
    params.set('phone_number_collection[enabled]', 'true');
    params.set('metadata[site]', 'sonofkings.com');
    params.set('metadata[cart]', valid.map((item) => item.size + 'x' + item.quantity).join(','));

    valid.forEach((item, index) => {
      params.set('line_items[' + index + '][price]', PRICE_ID);
      params.set('line_items[' + index + '][quantity]', String(item.quantity));
    });

    const stripe = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });
    const data = await stripe.json();

    if (!stripe.ok || !data.url) {
      throw new Error(data.error && data.error.message || 'Stripe did not return a checkout URL');
    }

    return res.status(200).json({ url: data.url });
  } catch (error) {
    console.error('Checkout session creation failed:', error.message);
    return res.status(500).json({ error: 'Unable to create checkout' });
  }
};
