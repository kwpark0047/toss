const crypto = require('crypto');
const FIELDS = {
 Store:['name','timezone'],Product:['name'],MenuItem:['name','product_external_id','price'],
 Order:['amount','refund_amount','status','native_order_id'],OrderItem:['order_external_id','menu_external_id','quantity','amount'],
 Payment:['order_external_id','amount','status'],Refund:['payment_external_id','amount'],
 Customer:['customer_key'],AggregatedCustomer:['customer_key','order_count'],
 Promotion:['name','status'],Review:['rating'],
};
const REQUIRED = {Store:['name','timezone'],Product:['name'],MenuItem:['name','product_external_id','price'],Order:['amount','refund_amount','status'],OrderItem:['order_external_id','menu_external_id','quantity','amount'],Payment:['order_external_id','amount','status'],Refund:['payment_external_id','amount'],Customer:['customer_key'],AggregatedCustomer:['customer_key','order_count'],Promotion:['name','status'],Review:['rating']};
function invalid(code) { const error=new Error(code);error.code=code;return error; }
function stable(value) {
 if(Array.isArray(value))return value.map(stable);
 if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
 return value;
}
function normalizeRecord(input) {
 if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).some(k=>!['entity','external_id','version','occurred_at','data'].includes(k)))throw invalid('CANONICAL_FIELDS');
 const fields=FIELDS[input.entity];
 if(!fields || typeof input.external_id!=='string' || !/^[A-Za-z0-9_.:#-]{1,128}$/.test(input.external_id) || !Number.isSafeInteger(input.version) || input.version<1)throw invalid('CANONICAL_IDENTITY');
 if(typeof input.occurred_at!=='string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.occurred_at) || !Number.isFinite(Date.parse(input.occurred_at)))throw invalid('CANONICAL_TIME');
 const data=input.data;
 if(!data || typeof data!=='object' || Array.isArray(data) || Object.keys(data).some(k=>!fields.includes(k)) || REQUIRED[input.entity].some(k=>data[k]==null))throw invalid('CANONICAL_DATA');
 for(const [key,value] of Object.entries(data)) {
  if(['amount','refund_amount','price','quantity','order_count','native_order_id','rating'].includes(key)) {
   if(!Number.isSafeInteger(value) || value<0 || value>1e12 || (['quantity','native_order_id','rating'].includes(key)&&value<1) || (key==='rating'&&value>5))throw invalid('CANONICAL_NUMBER');
  } else if(typeof value!=='string' || !value.length || value.length>200)throw invalid('CANONICAL_TEXT');
 }
 if(data.refund_amount>data.amount)throw invalid('CANONICAL_REFUND');
 if(data.customer_key && !/^[a-f0-9]{64}$/.test(data.customer_key))throw invalid('CANONICAL_CUSTOMER');
 if(data.status && !['pending','paid','cancelled','completed','active','inactive','refunded','failed'].includes(data.status))throw invalid('CANONICAL_STATUS');
 const record=stable({...input,occurred_at:new Date(input.occurred_at).toISOString()});
 return {...record,hash:crypto.createHash('sha256').update(JSON.stringify(record)).digest('hex')};
}
function assertAdapter(adapter) {
 if(!adapter || !/^[a-z0-9_-]{1,60}$/.test(adapter.provider||'') || typeof adapter.fetchPage!=='function' || typeof adapter.normalize!=='function' || !adapter.documentationUrl || !/^https:\/\//.test(adapter.documentationUrl))throw invalid('ADAPTER_CONTRACT');
 return adapter;
}
async function fetchPageWithRetry(adapter, context, options={}) {
 const sleep=options.sleep || (ms=>new Promise(resolve=>setTimeout(resolve,ms)));
 const random=options.random || Math.random;
 for(let attempt=0;attempt<4;attempt++) {
  if(context.signal?.aborted)throw invalid('SYNC_ABORTED');
  try {
   // Each attempt is bounded even if an adapter ignores AbortSignal.
   const controller=new AbortController();
   const abort=()=>controller.abort();context.signal?.addEventListener('abort',abort,{once:true});
   let timer;
   let page;
   try {page=await Promise.race([adapter.fetchPage({...context,signal:controller.signal}),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();const e=invalid('PROVIDER_TIMEOUT');e.status=504;reject(e);},15000);})]);}
   finally {clearTimeout(timer);context.signal?.removeEventListener('abort',abort);}
   if(!page || !Array.isArray(page.records) || page.records.length>500 || typeof page.done!=='boolean' || (!page.done && (typeof page.nextCursor!=='string' || !page.nextCursor.length || page.nextCursor.length>4096 || page.nextCursor===context.cursor)))throw invalid('PROVIDER_PAGE');
   return page;
  } catch(error) {
   const status=error.status || error.response?.status;
   if(attempt===3 || !(status===429 || [500,502,503,504].includes(status)) || context.signal?.aborted)throw error;
   const retryAfter=Number(error.retryAfterMs);
   const delay=Math.min(60000,Math.max(1000*2**attempt+Math.floor(random()*250),Number.isFinite(retryAfter)?retryAfter:0));
   await sleep(delay);
  }
 }
}
module.exports={FIELDS,normalizeRecord,assertAdapter,fetchPageWithRetry};
