import express from "express";
import {randomBytes,timingSafeEqual,createDecipheriv,createCipheriv,createHash} from "node:crypto";
import {query,transaction} from "./db.js";
import {authRequired} from "./auth.js";
import {sicoobStatus,createPixCharge,sicoobRequest} from "./sicoob.js";
const router=express.Router(),webhooks=express.Router();
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const encryptionKey=()=>{const value=process.env.SICOOB_ENCRYPTION_KEY;if(!value)throw new Error("SICOOB_ENCRYPTION_KEY não configurada.");return createHash("sha256").update(value).digest();};
function decryptPixKey(row){
 const decipher=createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(row.pix_key_iv,"base64"));
 decipher.setAuthTag(Buffer.from(row.pix_key_tag,"base64"));
 return Buffer.concat([decipher.update(Buffer.from(row.pix_key_encrypted,"base64")),decipher.final()]).toString("utf8");
}
router.get("/status",authRequired,(req,res)=>res.json({provider:"sicoob",...sicoobStatus()}));
router.put("/me/pix-key",authRequired,asyncRoute(async(req,res)=>{
 const profile=await query("SELECT account_type FROM publisher_profiles WHERE user_id=$1",[req.user.sub]);
 if(!profile.rowCount||!["journalist","publisher","influencer","both"].includes(profile.rows[0].account_type))return res.status(403).json({error:"Somente jornalistas, veículos e criadores podem cadastrar chave Pix recebedora."});
 const {pixKey,pixKeyType}=req.body||{};const key=String(pixKey||"").trim();const type=String(pixKeyType||"").toUpperCase();
 if(!key||!["CPF","CNPJ","EMAIL","PHONE","EVP"].includes(type))return res.status(400).json({error:"Informe uma chave Pix e o tipo CPF, CNPJ, EMAIL, PHONE ou EVP."});
 const digits=key.replace(/\\D/g,"");
 if((type==="CPF"&&digits.length!==11)||(type==="CNPJ"&&digits.length!==14)||(type==="EMAIL"&&!/^\\S+@\\S+\\.\\S+$/.test(key))||(type==="PHONE"&&digits.length<10)||(type==="EVP"&&!/^[0-9a-f-]{32,36}$/i.test(key)))return res.status(400).json({error:"A chave Pix não corresponde ao tipo informado."});
 const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv),encrypted=Buffer.concat([cipher.update(key,"utf8"),cipher.final()]);
 await query(`INSERT INTO publisher_pix_accounts(user_id,pix_key_encrypted,pix_key_iv,pix_key_tag,pix_key_type,active,updated_at)
 VALUES($1,$2,$3,$4,$5,true,now()) ON CONFLICT(user_id) DO UPDATE SET pix_key_encrypted=EXCLUDED.pix_key_encrypted,pix_key_iv=EXCLUDED.pix_key_iv,pix_key_tag=EXCLUDED.pix_key_tag,pix_key_type=EXCLUDED.pix_key_type,active=true,updated_at=now()`,[req.user.sub,encrypted.toString("base64"),iv.toString("base64"),cipher.getAuthTag().toString("base64"),type]);
 res.json({saved:true,pixKeyType:type,pixKeyHint:"••••"+key.slice(-4)});
}));
router.post("/me/webhook",authRequired,asyncRoute(async(req,res)=>{
 if(!sicoobStatus().configured)return res.status(503).json({error:"Configure primeiro a API Sicoob."});
 const r=await query("SELECT * FROM publisher_pix_accounts WHERE user_id=$1 AND active=true",[req.user.sub]);
 if(!r.rowCount)return res.status(409).json({error:"Cadastre primeiro a chave Pix do titular."});
 const secret=String(process.env.SICOOB_WEBHOOK_TOKEN||""),base=String(process.env.PUBLIC_API_URL||"").replace(/\\/$/,"");
 if(!secret||!base)return res.status(503).json({error:"Configure SICOOB_WEBHOOK_TOKEN e PUBLIC_API_URL."});
 const pixKey=decryptPixKey(r.rows[0]),url=base+"/api/v1/webhooks/sicoob/"+encodeURIComponent(secret);
 const result=await sicoobRequest("put","/webhook/"+encodeURIComponent(pixKey),{webhookUrl:url});
 res.json({registered:true,webhookUrl:url.replace(secret,"••••"),provider:result});
}));
router.post("/orders/:id/charge",authRequired,asyncRoute(async(req,res)=>{
 if(process.env.SICOOB_ENABLE_CHARGES!=="true")return res.status(503).json({error:"Cobranças Sicoob permanecem desativadas até credenciais, chave Pix do titular e homologação."});
 if(!sicoobStatus().configured)return res.status(503).json({error:"Configure Client ID, Client Secret e certificado mTLS do Sicoob."});
 const orderResult=await query(`SELECT o.*,p.pix_key_encrypted,p.pix_key_iv,p.pix_key_tag
 FROM license_orders o JOIN publisher_pix_accounts p ON p.user_id=o.publisher_user_id AND p.active=true
 WHERE o.id=$1 AND o.buyer_user_id=$2`,[req.params.id,req.user.sub]);
 if(!orderResult.rowCount)return res.status(404).json({error:"Pedido ou chave Pix do titular não encontrado."});
 const order=orderResult.rows[0];
 if(order.status!=="accepted")return res.status(409).json({error:"O titular precisa aprovar a licença antes da cobrança."});
 if(order.sicoob_txid)return res.json({payment:{txid:order.sicoob_txid,status:order.sicoob_status,brCode:order.sicoob_br_code}});
 const txid=randomBytes(16).toString("hex").toUpperCase(),key=decryptPixKey(order),cents=Number(order.gross_amount_cents);
 if(!Number.isSafeInteger(cents)||cents<1)return res.status(400).json({error:"Valor do pedido inválido."});
 const charge=await createPixCharge({txid,valueCents:cents,pixKey:key,description:"Licença News - pedido "+order.id});
 const saved=await query(`UPDATE license_orders SET sicoob_txid=$2,sicoob_status='created',sicoob_payload=$3::jsonb,sicoob_br_code=$4,updated_at=now()
 WHERE id=$1 AND buyer_user_id=$5 AND status='accepted' AND sicoob_txid IS NULL RETURNING id`,[order.id,txid,JSON.stringify(charge),charge.pixCopiaECola||null,req.user.sub]);
 if(!saved.rowCount)return res.status(409).json({error:"Outra cobrança foi iniciada para este pedido. Consulte o pedido novamente."});
 res.status(201).json({payment:{txid,status:charge.status||"ATIVA",brCode:charge.pixCopiaECola||null,charge}});
}));
router.get("/orders/:id/charge",authRequired,asyncRoute(async(req,res)=>{
 const r=await query("SELECT sicoob_txid,sicoob_status FROM license_orders WHERE id=$1 AND (buyer_user_id=$2 OR publisher_user_id=$2)",[req.params.id,req.user.sub]);
 if(!r.rowCount||!r.rows[0].sicoob_txid)return res.status(404).json({error:"Cobrança não encontrada."});
 const charge=await sicoobRequest("get","/cob/"+encodeURIComponent(r.rows[0].sicoob_txid));
 res.json({payment:charge});
}));
webhooks.post("/:token",asyncRoute(async(req,res)=>{
 const expected=Buffer.from(process.env.SICOOB_WEBHOOK_TOKEN||""),supplied=Buffer.from(String(req.params.token||""));
 if(!expected.length||expected.length!==supplied.length||!timingSafeEqual(expected,supplied))return res.status(401).json({error:"Webhook não autorizado."});
 const pixList=Array.isArray(req.body?.pix)?req.body.pix:[];
 for(const pix of pixList){
  if(!pix.txid||!pix.endToEndId)continue;
  await transaction(async client=>{
   const found=await client.query("SELECT id,status,gross_amount_cents FROM license_orders WHERE sicoob_txid=$1 FOR UPDATE",[String(pix.txid)]);
   if(!found.rowCount||found.rows[0].status==="paid")return;
   if(Math.round(Number(pix.valor)*100)!==Number(found.rows[0].gross_amount_cents))throw new Error("Valor Pix recebido não corresponde ao pedido.");
   await client.query("UPDATE license_orders SET status='paid',paid_at=now(),sicoob_status='paid',sicoob_end_to_end_id=$2,updated_at=now() WHERE id=$1",[found.rows[0].id,String(pix.endToEndId)]);
   const o=await client.query(`SELECT o.*,f.content_id,f.purpose,f.territory,f.duration_days FROM license_orders o JOIN license_offers f ON f.id=o.offer_id WHERE o.id=$1`,[found.rows[0].id]);
   const order=o.rows[0],code="LN-"+randomBytes(12).toString("hex").toUpperCase();
   await client.query(`INSERT INTO issued_licenses(order_id,license_code,content_id,owner_user_id,buyer_user_id,purpose,territory,starts_at,expires_at,status)
    VALUES($1,$2,$3,$4,$5,$6,$7,now(),now()+($8::int*interval '1 day'),'active') ON CONFLICT(order_id) DO NOTHING`,
    [order.id,code,order.content_id,order.publisher_user_id,order.buyer_user_id,order.purpose,order.territory,order.duration_days]);
   await client.query("INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,details) VALUES($1,'license.issued.sicoob_pix','license_order',$2,$3::jsonb)",[order.publisher_user_id,String(order.id),JSON.stringify({txid:pix.txid,endToEndId:pix.endToEndId})]);
  });
 }
 res.json({received:true,count:pixList.length});
}));
export {router as sicoobRouter,webhooks as sicoobWebhookRouter};
