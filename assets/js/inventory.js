/* One hoodie and one pair of pants per set. Quantities confirmed October 20, 2026. */
(function(root){
 const sizes=['S','M','L','XL','XXL','3XL','4XL'];
 const stock={
  Black:{S:[1,1],L:[8,8],XL:[5,6],XXL:[13,12],'3XL':[4,4],'4XL':[2,2]},
  Navy:{XL:[1,1],XXL:[1,0]},
  'Royal Blue':{XL:[1,1],XXL:[1,1]},
  'Forest Green':{M:[1,1]},Marble:{XL:[1,1],XXL:[1,1]},Crimson:{XXL:[1,1]}
 };
 function quantity(data,color,size,product){const row=data[color]?.[size]||[0,0];return product==='hoodie'?row[0]:product==='pants'?row[1]:Math.min(...row)}
 function demand(items){const out={};for(const x of items){const k=x.color+'|'+x.size;const row=out[k]||(out[k]=[0,0]);if(x.product!=='pants')row[0]+=x.quantity;if(x.product!=='hoodie')row[1]+=x.quantity}return out}
 const api={sizes,stock,quantity,demand};if(typeof module==='object')module.exports=api;else root.SOKInventory=api;
})(typeof window==='object'?window:globalThis);
