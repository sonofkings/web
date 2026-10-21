import inventory from '../assets/js/inventory.js';
// One durable coordinator serializes stock changes across all checkout requests.
export class Inventory {
 constructor(state){this.storage=state.storage;this.ready=state.blockConcurrencyWhile(async()=>{if(!await this.storage.get('stock'))await this.storage.put('stock',inventory.stock)})}
 async fetch(request){await this.ready;const {action,id,items}=await request.json();
  const result=await this.storage.transaction(async tx=>{
   const stock=await tx.get('stock');
   if(action==='read')return {stock};
   const key='order:'+id,order=await tx.get(key);
   if(action==='register'){
    if(!order)await tx.put(key,{items,status:'created'});
    return {ok:true};
   }
   if(action==='check')return {ok:this.fits(stock,items)};
   if(!order)return {ok:false,error:'This checkout has expired. Return to your bag and start checkout again.'};
   if(action==='reserve'){
    if(order.status!=='created')return {ok:true};
    if(!this.fits(stock,order.items))return {ok:false,error:'An item has sold out or exceeds remaining stock. Return to your bag and adjust your order.'};
    for(const [k,row] of Object.entries(inventory.demand(order.items))){const [c,s]=k.split('|');stock[c][s][0]-=row[0];stock[c][s][1]-=row[1]}
    order.status='reserved';await tx.put('stock',stock);await tx.put(key,order);return {ok:true};
   }
   if(action==='complete'){order.status='completed';await tx.put(key,order);return {ok:true}}
   return {ok:false};
  });return Response.json(result);
 }
 fits(stock,items){return Object.entries(inventory.demand(items)).every(([k,n])=>{const [c,s]=k.split('|'),row=stock[c]?.[s]||[0,0];return row[0]>=n[0]&&row[1]>=n[1]})}
}
