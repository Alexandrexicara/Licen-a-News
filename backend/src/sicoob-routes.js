import express from "express";
import {randomBytes,timingSafeEqual,createDecipheriv,createCipheriv,createHash} from "node:crypto";
import {query,transaction} from "./db.js";
import {authRequired} from "./auth.js";
import {sicoobStatus,createPixCharge,sicoobRequest} from "./sicoob.js";
const router=express.Router(),webhooks=express.Router();
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
router.get("/status",authRequired,(req,res)=>res.json({provider:"sicoob",...sicoobStatus()}));
router.post("/orders/:id/charge",authRequired,asyncRoute(async(req,res)=>{
 if(process.env.SICOOB_ENABLE_CHARGES!=="true")return res.status(503).json({error:"Cobranças Sicoob permanecem desativadas até credenciais, chave Pix do titular e homologação."});
 if(!sicoobStatus().configured)return res.status(503).json({error:"Configure Client ID, Client Secret e certificado mTLS do Sicoob."});
 const orderResult=await query(`SELECT o.*,p.pix_key_encrypted,p.pix_key_iv,p.pix_key_tag
 FROM license_orders o JOIN publisher_pix_accounts p ON p.user_id=o.publisher_user_id AND p.active=true
 WHERE o.id=$1 AND o.buyer_user_id=$2`,[req.params.id,req.user.sub]);
 if(!orderResult.rowCount)return res.status(404).json({error:"Pedido ou chave Pix do titular não encontrado."});
 const order=orderResult.rows[0];
 if(order.status!=="accepted")return res.status(409).json({error:"O titular precisa aprovar a licença antes da cobrança."});
 if(order.sicoob_txid)return res.json({payment:{txid:order.sicoob_txid,status:order.sicoob_status,brCode:order.sicoob_br_code,qrCodeImage:order.sicoob_qr_code_image}});
 const key=decryptPixKey(order);
 const txid=randomBytes(16).toString("hex").toUpperCase();
 const cents=Number(order.gross_amount_cents);
 const charge=await createPixCharge({txid,valueCents:cents,pixKey:key,description:"Licença News - pedido "+order.id});
 await query(`UPDATE license_orders SET sicoob_txid=$2,sicoob_status='created',sicoob_payload=$3::jsonb,updated_at=now()
 WHERE id=$1 AND buyer_user_id=$4 AND status='accepted' AND sicoob_txid IS NULL`,[order.id,txid,JSON.stringify(charge),req.user.sub]);
 res.status(201).json({payment:{txid,status:charge.status||"ATIVA",brCode:charge.pixCopiaECola||charge.qrcode||null,charge}});
}));
router.post("/me/webhook",authRequired,asyncRoute(async(req,res)=>{
 if(!sicoobStatus().configured)return res.status(503).json({error:"Configure primeiro a API Sicoob."});
 const r=await query("SELECT * FROM publisher_pix_accounts WHERE user_id=$1 AND active=true",[req.user.sub]);
 if(!r.rowCount)return res.status(409).json({error:"Cadastre primeiro a chave Pix do titular."});
 const pixKey=decryptPixKey(r.rows[0]);const secret=String(process.env.SICOOB_WEBHOOK_TOKEN||"");
 if(!secret)return res.status(503).json({error:"SICOOB_WEBHOOK_TOKEN não configurado."});
 const base=String(process.env.PUBLIC_API_URL||"").replace(/\\/$/,"");
 if(!base)return res.status(503).json({error:"PUBLIC_API_URL não configurada."});
 const url=base+"/api/v1/webhooks/sicoob/"+encodeURIComponent(secret);
 const result=await sicoobRequest("put","/webhook/"+encodeURIComponent(pixKey),{webhookUrl:url});
 res.json({registered:true,webhookUrl:url.replace(secret,"••••"),provider:result});
}));
router.get("/orders/:id/charge",authRequired,asyncRoute(async(req,res)=>{
 const r=await query("SELECT sicoob_txid,sicoob_status,sicoob_payload FROM license_orders WHERE id=$1 AND (buyer_user_id=$2 OR publisher_user_id=$2)",[req.params.id,req.user.sub]);
 if(!r.rowCount||!r.rows[0].sicoob_txid)return res.status(404).json({error:"Cobrança não encontrada."});
 const charge=await sicoobRequest("get","/cob/"+encodeURIComponent(r.rows[0].sicoob_txid));
 res.json({payment:charge});
}));
function decryptPixKey(row){
 const d=createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(row.pix_key_iv,"base64"));d.setAuthTag(Buffer.from(row.pix_key_tag,"base64"));
 return Buffer.concat([d.update(Buffer.from(row.pix_key_encrypted,"base64")),d.final()]).toString("utf8");
}
function encryptionKey(){const v=process.env.SICOOB_ENCRYPTION_KEY;if(!v)throw new Error("SICOOB_ENCRYPTION_KEY não configurada.");return awaitCrypto.createHash("sha256").update(v).digest();}
router.put("/me/pix-key",authRequired,asyncRoute(async(req,res)=>{
 const {pixKey,pixKeyType}=req.body||{};const key=String(pixKey||"").trim();
 if(!key||!["CPF","CNPJ","EMAIL","PHONE","EVP"].includes(String(pixKeyType||"").toUpperCase()))return res.status(400).json({error:"Informe uma chave Pix e o tipo (CPF, CNPJ, EMAIL, PHONE ou EVP)."});
 const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv);const encrypted=Buffer.concat([cipher.update(key,"utf8"),cipher.final()]);
 await query(`INSERT INTO publisher_pix_accounts(user_id,pix_key_encrypted,pix_key_iv,pix_key_tag,pix_key_type,active,updated_at)
 VALUES($1,$2,$3,$4,$5,true,now()) ON CONFLICT(user_id) DO UPDATE SET pix_key_encrypted=EXCLUDED.pix_key_encrypted,pix_key_iv=EXCLUDED.pix_key_iv,pix_key_tag=EXCLUDED.pix_key_tag,pix_key_type=EXCLUDED.pix_key_type,active=true,updated_at=now()`,[req.user.sub,encrypted.toString("base64"),iv.toString("base64"),cipher.getAuthTag().toString("base64"),String(pixKeyType).toUpperCase()]);
 res.json({saved:true,pixKeyType:type,pixKeyHint:"••••"+key.slice(-4)});
}));
webhooks.post("/sicoob",asyncRoute(async(req,res)=>{
 const expected=Buffer.from(process.env.SICOOB_WEBHOOK_TOKEN||"");const supplied=Buffer.from(String(req.headers["x-sicoob-webhook-token"]||""));
 if(!expected.length||expected.length!==supplied.length||!timingSafeEqual(expected,supplied))return res.status(401).json({error:"Webhook não autorizado."});
 const pixList=Array.isArray(req.body?.pix)?req.body.pix:[];
 for(const pix of pixList){
  if(!pix.txid||!pix.endToEndId)continue;
  await transaction(async client=>{
   const found=await client.query("SELECT id,status,gross_amount_cents FROM license_orders WHERE sicoob_txid=$1 FOR UPDATE",[String(pix.txid)]);
   if(!found.rowCount||found.rows[0].status==="paid")return;
   if(Number(pix.valor)*100!==Number(found.rows[0].gross_amount_cents))throw new Error("Valor Pix recebido não corresponde ao pedido.");
   await client.query("UPDATE license_orders SET status='paid',paid_at=now(),sicoob_status='paid',sicoob_end_to_end_id=$2,updated_at=now() WHERE id=$1",[found.rows[0].id,String(pix.endToEndId)]);
   const o=await client.query(`SELECT o.*,f.content_id,f.purpose,f.territory,f.duration_days FROM license_orders o JOIN license_offers f ON f.id=o.offer_id WHERE o.id=$1`,[found.rows[0].id]);
   const order=o.rows[0];const {randomBytes}=await import("node:crypto");const code="LN-"+randomBytes(12).toString("hex").toUpperCase();
   await client.query(`INSERT INTO issued_licenses(order_id,license_code,content_id,owner_user_id,buyer_user_id,purpose,territory,starts_at,expires_at,status)
    VALUES($1,$2,$3,$4,$5,$6,$7,now(),now()+($8::int*interval '1 day'),'active') ON CONFLICT(order_id) DO NOTHING`,
    [order.id,code,order.content_id,order.publisher_user_id,order.buyer_user_id,order.purpose,order.territory,order.duration_days]);
   await client.query("INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,details) VALUES($1,'license.issued.sicoob_pix','license_order',$2,$3::jsonb)",[order.publisher_user_id,String(order.id),JSON.stringify({txid:pix.txid,endToEndId:pix.endToEndId})]);
  });
 }
 res.json({received:true,count:pixList.length});
}));
export {router as sicoobRouter,webhooks as sicoobWebhookRouter};
