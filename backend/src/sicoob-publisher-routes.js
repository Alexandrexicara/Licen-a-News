import express from "express";
import {randomBytes} from "node:crypto";
import {query,transaction} from "./db.js";
import {authRequired} from "./auth.js";
import {sicoobRequest,validateSicoobCredentials,createPixCharge} from "./sicoob.js";
import {savePublisherSicoob,getPublisherSicoob,publisherSicoobStatus,removePublisherSicoob} from "./sicoob-accounts.js";

const router=express.Router();
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const allowedTypes=["journalist","publisher","influencer","both"];
function validPixKey(key,type){
 const digits=key.replace(/\D/g,"");
 return (type==="CPF"&&digits.length===11)||(type==="CNPJ"&&digits.length===14)||(type==="EMAIL"&&/^\S+@\S+\.\S+$/.test(key))||(type==="PHONE"&&digits.length>=10)||(type==="EVP"&&/^[0-9a-f-]{32,36}$/i.test(key));
}
router.get("/me",authRequired,asyncRoute(async(req,res)=>res.json(await publisherSicoobStatus(req.user.sub))));
router.post("/me",authRequired,asyncRoute(async(req,res)=>{
 const profile=await query("SELECT account_type FROM publisher_profiles WHERE user_id=$1",[req.user.sub]);
 if(!profile.rowCount||!allowedTypes.includes(profile.rows[0].account_type))return res.status(403).json({error:"A conexão Sicoob está disponível para jornalistas, veículos e criadores."});
 const body=req.body||{},clientId=String(body.clientId||"").trim(),clientSecret=String(body.clientSecret||"").trim(),pfxBase64=String(body.pfxBase64||"").replace(/\s/g,""),pfxPassword=String(body.pfxPassword||""),pixKey=String(body.pixKey||"").trim(),pixKeyType=String(body.pixKeyType||"").toUpperCase();
 if(!clientId||!clientSecret||!pfxBase64||!pixKey||!["CPF","CNPJ","EMAIL","PHONE","EVP"].includes(pixKeyType)||!validPixKey(pixKey,pixKeyType))return res.status(400).json({error:"Informe Client ID, Client Secret, certificado PFX, chave Pix e tipo válido."});
 if(pfxBase64.length>1500000)return res.status(413).json({error:"Certificado PFX excede o tamanho permitido."});
 const credentials={clientId,clientSecret,pfxBase64,pfxPassword};
 await validateSicoobCredentials(credentials);
 await savePublisherSicoob(req.user.sub,credentials,pixKey,pixKeyType);
 res.status(201).json({connected:true,message:"Credenciais Sicoob validadas e conexão salva. A consulta automática de Pix já está habilitada.",...(await publisherSicoobStatus(req.user.sub))});
}));
router.delete("/me",authRequired,asyncRoute(async(req,res)=>{await removePublisherSicoob(req.user.sub);res.json({connected:false,message:"Conexão Sicoob removida."});}));
router.post("/orders/:id/charge",authRequired,asyncRoute(async(req,res)=>{
 if(process.env.SICOOB_ENABLE_CHARGES!=="true")return res.status(503).json({error:"Cobranças continuam bloqueadas até a homologação do fluxo Pix."});
 const orderResult=await query("SELECT * FROM license_orders WHERE id=$1 AND buyer_user_id=$2",[req.params.id,req.user.sub]);
 if(!orderResult.rowCount)return res.status(404).json({error:"Pedido não encontrado."});
 const order=orderResult.rows[0];
 if(order.status!=="accepted")return res.status(409).json({error:"O jornalista precisa aprovar a licença antes da cobrança."});
 const account=await getPublisherSicoob(order.publisher_user_id);
 if(!account)return res.status(409).json({error:"O titular ainda não conectou sua própria conta Sicoob."});
 if(order.sicoob_txid)return res.json({payment:{txid:order.sicoob_txid,status:order.sicoob_status,brCode:order.sicoob_br_code}});
 const txid=randomBytes(16).toString("hex").toUpperCase(),cents=Number(order.gross_amount_cents);
 if(!Number.isSafeInteger(cents)||cents<1)return res.status(400).json({error:"Valor do pedido inválido."});
 const charge=await createPixCharge({txid,valueCents:cents,pixKey:account.pixKey,description:"Licença News - pedido "+order.id},account);
 const saved=await query("UPDATE license_orders SET sicoob_txid=$2,sicoob_status='created',sicoob_payload=$3::jsonb,sicoob_br_code=$4,sicoob_publisher_user_id=$5,updated_at=now() WHERE id=$1 AND buyer_user_id=$6 AND status='accepted' AND sicoob_txid IS NULL RETURNING id",[order.id,txid,JSON.stringify(charge),charge.pixCopiaECola||null,order.publisher_user_id,req.user.sub]);
 if(!saved.rowCount)return res.status(409).json({error:"Já existe uma cobrança para este pedido. Atualize a tela."});
 res.status(201).json({payment:{txid,status:charge.status||"ATIVA",brCode:charge.pixCopiaECola||null,charge}});
}));
router.get("/orders/:id/charge",authRequired,asyncRoute(async(req,res)=>{
 const r=await query("SELECT sicoob_txid,sicoob_status,publisher_user_id FROM license_orders WHERE id=$1 AND (buyer_user_id=$2 OR publisher_user_id=$2)",[req.params.id,req.user.sub]);
 if(!r.rowCount||!r.rows[0].sicoob_txid)return res.status(404).json({error:"Cobrança não encontrada."});
 const account=await getPublisherSicoob(r.rows[0].publisher_user_id);
 if(!account)return res.status(409).json({error:"A conta Sicoob do recebedor não está conectada."});
 const charge=await sicoobRequest("get","/cob/"+encodeURIComponent(r.rows[0].sicoob_txid),undefined,account);
 res.json({payment:charge});
}));
async function confirmReceivedPix(userId,pix){
 if(!pix?.txid||!pix?.endToEndId)return false;
 return transaction(async client=>{
  const found=await client.query("SELECT id,status,gross_amount_cents,publisher_user_id FROM license_orders WHERE sicoob_txid=$1 AND publisher_user_id=$2 FOR UPDATE",[String(pix.txid),userId]);
  if(!found.rowCount||found.rows[0].status==="paid")return false;
  if(Math.round(Number(pix.valor)*100)!==Number(found.rows[0].gross_amount_cents))return false;
  const orderId=found.rows[0].id;
  await client.query("UPDATE license_orders SET status='paid',paid_at=now(),sicoob_status='paid',sicoob_end_to_end_id=$2,sicoob_payment_confirmed_at=now(),updated_at=now() WHERE id=$1",[orderId,String(pix.endToEndId)]);
  const o=await client.query("SELECT o.*,f.content_id,f.purpose,f.territory,f.duration_days FROM license_orders o JOIN license_offers f ON f.id=o.offer_id WHERE o.id=$1",[orderId]);
  if(!o.rowCount)return false;
  const order=o.rows[0],code="LN-"+randomBytes(12).toString("hex").toUpperCase();
  await client.query("INSERT INTO issued_licenses(order_id,license_code,content_id,owner_user_id,buyer_user_id,purpose,territory,starts_at,expires_at,status) VALUES($1,$2,$3,$4,$5,$6,$7,now(),now()+($8::int*interval '1 day'),'active') ON CONFLICT(order_id) DO NOTHING",[order.id,code,order.content_id,order.publisher_user_id,order.buyer_user_id,order.purpose,order.territory,order.duration_days]);
  await client.query("INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,details) VALUES($1,'license.payment_confirmed.sicoob','license_order',$2,$3::jsonb)",[order.publisher_user_id,String(order.id),JSON.stringify({txid:pix.txid,endToEndId:pix.endToEndId,recipient:order.publisher_user_id,confirmation:"sicoob_api_pix_query"})]);
  return true;
 });
}
let reconciliationRunning=false;
export async function reconcileSicoobReceipts(){
 if(reconciliationRunning)return {skipped:true,confirmed:0};
 reconciliationRunning=true;let confirmed=0,accounts=0,errors=0;
 try{
  const users=await query("SELECT user_id FROM publisher_sicoob_accounts WHERE active=true");
  for(const row of users.rows){
   try{
    const account=await getPublisherSicoob(row.user_id);if(!account)continue;accounts++;
    const end=new Date(),start=new Date(end.getTime()-24*60*60*1000);
    const params=new URLSearchParams({inicio:start.toISOString(),fim:end.toISOString(),"paginacao.paginaAtual":"0","paginacao.itensPorPagina":"100"});
    const result=await sicoobRequest("get","/pix?"+params.toString(),undefined,account);
    const received=Array.isArray(result?.pix)?result.pix:[];
    for(const pix of received){if(await confirmReceivedPix(row.user_id,pix))confirmed++;}
   }catch(error){errors++;console.error("Sicoob reconciliation failed for publisher",row.user_id,String(error?.message||error).slice(0,300));}
  }
 }finally{reconciliationRunning=false;}
 return {accounts,confirmed,errors};
}

export {router as sicoobPublisherRouter};
