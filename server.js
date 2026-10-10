const express=require('express');const fs=require('fs');const path=require('path');const crypto=require('crypto');const archiver=require('archiver');
const app=express();app.use(express.json());
const ROOT=__dirname, PUBLIC=path.join(ROOT,'public'), PRIVATE=path.join(ROOT,'private/cursos');
const PORT=process.env.PORT||3000, MP_TOKEN=process.env.MERCADOPAGO_ACCESS_TOKEN||process.env.MP_ACCESS_TOKEN||'';
const BASE=(process.env.PUBLIC_BASE_URL||process.env.RENDER_EXTERNAL_URL||`http://localhost:${PORT}`).replace(/\/$/,'');
const SECRET=process.env.DOWNLOAD_SECRET||'TROQUE-ESTA-CHAVE-ANTES-DE-PUBLICAR';
const MP_WEBHOOK_SECRET=process.env.MP_WEBHOOK_SECRET||'';
const ORDERS=path.join(ROOT,'orders.json');
function readOrders(){try{return JSON.parse(fs.readFileSync(ORDERS,'utf8'))}catch{return {}}}
function writeOrders(x){fs.writeFileSync(ORDERS,JSON.stringify(x,null,2))}
function sign(s){return crypto.createHmac('sha256',SECRET).update(s).digest('hex')}
function token(orderId,paymentId){return sign(orderId+'|'+paymentId)}
async function mp(pathname,opts={}){if(!MP_TOKEN) throw new Error('Mercado Pago não configurado');const r=await fetch('https://api.mercadopago.com'+pathname,{...opts,headers:{Authorization:'Bearer '+MP_TOKEN,'Content-Type':'application/json',...(opts.headers||{})}});const t=await r.text();let d;try{d=JSON.parse(t)}catch{d={raw:t}};if(!r.ok) throw new Error(JSON.stringify(d));return d}
app.get('/api/config',(req,res)=>res.json({configured:!!MP_TOKEN}));
app.post('/api/create-payment',async(req,res)=>{try{
  const {productId,email}=req.body||{};
  const products=JSON.parse(fs.readFileSync(path.join(PUBLIC,'products.json')));
  if(!email||!email.includes('@')) return res.status(400).json({error:'Informe um e-mail válido'});
  let ids=String(productId||'').split(',').map(x=>x.trim()).filter(Boolean);
  let items;
  if(ids.length===1 && ids[0]==='all') items=[{id:'all',title:'Pacote Completo — 36 cursos em PDF',price:199.90}];
  else {items=ids.map(id=>products.find(p=>String(p.id)===id)).filter(Boolean).map(p=>({id:String(p.id),title:p.title,price:Number(p.price)}));}
  if(!items.length || items.length!==ids.length) return res.status(400).json({error:'Produto inválido'});
  const amount=Number(items.reduce((a,b)=>a+b.price,0).toFixed(2));
  const orderId=crypto.randomUUID();
  const orders=readOrders();
  orders[orderId]={orderId,productId:items.map(x=>x.id).join(','),items,email,amount,status:'pending',createdAt:new Date().toISOString()};
  writeOrders(orders);
  const pref=await mp('/checkout/preferences',{method:'POST',body:JSON.stringify({items:items.map(x=>({title:x.title,quantity:1,currency_id:'BRL',unit_price:x.price})),external_reference:orderId,payer:{email},back_urls:{success:BASE+'/sucesso.html',failure:BASE+'/falha.html',pending:BASE+'/pendente.html'},auto_return:'approved',notification_url:BASE+'/api/webhook'})});
  orders[orderId].preferenceId=pref.id;writeOrders(orders);res.json({init_point:pref.init_point,orderId});
}catch(e){res.status(500).json({error:'Não foi possível criar o pagamento',detail:e.message})}});

app.post('/api/webhook',async(req,res)=>{
  try{
    if(MP_WEBHOOK_SECRET){
      const sig=req.headers['x-signature']||''; const rid=req.headers['x-request-id']||'';
      const m=sig.match(/ts=([^,]+),v1=(.+)/); const dataId=req.body?.data?.id||req.body?.id||'';
      if(!m||!rid||!dataId) return res.sendStatus(401);
      const manifest=`id:${dataId};request-id:${rid};ts:${m[1]};`;
      const expected=crypto.createHmac('sha256',MP_WEBHOOK_SECRET).update(manifest).digest('hex');
      if(expected.length!==m[2].length || !crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(m[2]))) return res.sendStatus(401);
    }
    res.sendStatus(200);
    const paymentId=req.body?.data?.id||req.body?.id; if(!paymentId) return;
    const p=await mp('/v1/payments/'+paymentId); const orderId=p.external_reference; const orders=readOrders();
    if(!orderId||!orders[orderId]) return;
    orders[orderId].paymentId=String(paymentId); orders[orderId].status=p.status; orders[orderId].updatedAt=new Date().toISOString(); writeOrders(orders);
  }catch(e){console.error('webhook',e.message); if(!res.headersSent) res.sendStatus(500);}
});
app.get('/api/verify',async(req,res)=>{try{const {payment_id}=req.query;if(!payment_id)return res.status(400).json({error:'Pagamento ausente'});const p=await mp('/v1/payments/'+payment_id);const orders=readOrders();const o=orders[p.external_reference];if(!o||String(o.paymentId||payment_id)!==String(payment_id))return res.status(403).json({error:'Pedido não encontrado'});if(p.status!=='approved')return res.json({approved:false,status:p.status});o.status='approved';o.paymentId=String(payment_id);writeOrders(orders);res.json({approved:true,downloadToken:token(o.orderId,String(payment_id)),productId:o.productId,orderId:o.orderId})}catch(e){res.status(500).json({error:'Não foi possível confirmar o pagamento'})}});
app.get('/download/:type',async(req,res)=>{try{
  const {order,payment,sig}=req.query;if(!order||!payment||sig!==token(order,payment))return res.status(403).send('Link de download inválido.');
  const orders=readOrders();const o=orders[order];if(!o||o.status!=='approved'||String(o.paymentId)!==String(payment))return res.status(403).send('Pagamento não aprovado.');
  if(o.productId==='all'){
    const zipName=`VitaCursos-Pacote-${order}.zip`;
    res.setHeader('Content-Type','application/zip');
    res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''VitaCursos-Pacote-Completo.zip`);
    const archive=archiver('zip',{zlib:{level:6}});
    archive.on('error',()=>{if(!res.headersSent)res.status(500).end();});
    archive.pipe(res);
    const products=JSON.parse(fs.readFileSync(path.join(PUBLIC,'products.json')));
    for(const product of products){
      const filePath=path.join(PRIVATE,product.file);
      if(fs.existsSync(filePath)) archive.file(filePath,{name:product.file});
    }
    await archive.finalize();
    return;
  }
  const ids=String(o.productId).split(',').filter(Boolean);const products=JSON.parse(fs.readFileSync(path.join(PUBLIC,'products.json')));const selected=ids.map(id=>products.find(x=>String(x.id)===id)).filter(Boolean);
  if(!selected.length)return res.status(404).send('Produtos não encontrados.');
  if(selected.length===1)return res.download(path.join(PRIVATE,selected[0].file),selected[0].file);
  res.setHeader('Content-Type','application/zip');
  res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''VitaCursos-Cursos.zip");
  const archive=archiver('zip',{zlib:{level:6}});
  archive.on('error',()=>{if(!res.headersSent)res.status(500).end();});
  archive.pipe(res);
  for(const product of selected){const filePath=path.join(PRIVATE,product.file);if(fs.existsSync(filePath))archive.file(filePath,{name:product.file});}
  await archive.finalize();
}catch(e){res.status(500).send('Erro ao liberar o download.')}});

app.use(express.static(PUBLIC));app.get('/{*splat}',(req,res)=>res.sendFile(path.join(PUBLIC,'index.html')));app.listen(PORT,()=>console.log('MGL Cursos rodando na porta '+PORT));
