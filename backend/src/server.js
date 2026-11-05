import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import { randomBytes,createHash,randomUUID } from "node:crypto";
import { query,transaction } from "./db.js";
import { authRequired,adminRequired,signToken,optionalAuth } from "./auth.js";
import { saveElevenLabsKey,getElevenLabsKeyStatus,removeElevenLabsKey } from "./user-keys.js";
import assistantRouter from "./assistant.js";
import { wooviRouter, wooviWebhookRouter } from "./woovi-routes.js";
import { sicoobRouter, sicoobWebhookRouter } from "./sicoob-routes.js";

const app=express();
app.use(helmet());
app.use(cors({origin:(process.env.CORS_ORIGIN||"").split(",").filter(Boolean),credentials:true}));
app.use(express.json({limit:"2mb",verify:(req,res,buf)=>{req.rawBody=Buffer.from(buf);}}));
app.use("/api/v1/webhooks/woovi",wooviWebhookRouter);
app.use("/api/v1/webhooks/sicoob",sicoobWebhookRouter);
app.use("/api/v1/woovi",authRequired,wooviRouter);
app.use("/api/v1/sicoob",sicoobRouter);
app.use("/api/v1/assistant",optionalAuth,assistantRouter);
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const cleanUser=r=>({id:r.id,email:r.email,name:r.name,role:r.role,accountType:r.account_type});
app.get("/health",(req,res)=>res.json({status:"ok",service:"licenca-news-api"}));
app.get("/api/v1/info",(req,res)=>res.json({name:"Licença News API",version:"1.0.0",payments:"external_between_parties",licensing:"direct_authorization",licenseIssuance:"publisher_confirmation"}));

app.post("/api/v1/auth/register",asyncRoute(async(req,res)=>{
 const {name,email,password,accountType="journalist",organizationName="",websiteUrl="",contactPhone=""}=req.body||{};
 const normalizedEmail=String(email||"").trim().toLowerCase();
 if(!String(name||"").trim()||!/^\S+@\S+\.\S+$/.test(normalizedEmail)||typeof password!=="string"||password.length<10)return res.status(400).json({error:"Informe nome, e-mail válido e senha com pelo menos 10 caracteres"});
 if(!["journalist","publisher","influencer","buyer","both"].includes(accountType))return res.status(400).json({error:"Tipo de conta inválido"});
 const hash=await bcrypt.hash(password,12);
 const id=randomUUID();
 const user=await transaction(async client=>{
  const result=await client.query("INSERT INTO app_users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,'user') RETURNING id,name,email,role",[id,String(name).trim(),normalizedEmail,hash]);
  await client.query("INSERT INTO publisher_profiles(user_id,account_type,organization_name,website_url,contact_phone) VALUES($1,$2,$3,$4,$5)",[id,accountType,organizationName,websiteUrl,contactPhone]);
  return {...result.rows[0],account_type:accountType};
 });
 res.status(201).json({user:cleanUser(user),token:signToken(user)});
}));
app.post("/api/v1/auth/login",asyncRoute(async(req,res)=>{
 const {email,password}=req.body||{};
 const r=await query("SELECT u.id,u.name,u.email,u.password_hash,u.role,p.account_type FROM app_users u LEFT JOIN publisher_profiles p ON p.user_id=u.id WHERE u.email=lower($1) AND u.disabled_at IS NULL",[email||""]);
 if(!r.rowCount||!await bcrypt.compare(password||"",r.rows[0].password_hash))return res.status(401).json({error:"E-mail ou senha incorretos"});
 res.json({user:cleanUser(r.rows[0]),token:signToken(r.rows[0])});
}));
app.get("/api/v1/me",authRequired,asyncRoute(async(req,res)=>{
 const r=await query("SELECT u.id,u.name,u.email,u.role,p.account_type,p.organization_name,p.website_url,p.contact_phone,p.verification_status,p.rights_declaration FROM app_users u LEFT JOIN publisher_profiles p ON p.user_id=u.id WHERE u.id=$1",[req.user.sub]);
 if(!r.rowCount)return res.status(404).json({error:"Usuário não encontrado"});
 res.json({user:r.rows[0]});
}));
app.get("/api/v1/me/elevenlabs",authRequired,asyncRoute(async(req,res)=>{
 res.json(await getElevenLabsKeyStatus(req.user.sub));
}));
app.post("/api/v1/me/elevenlabs",authRequired,asyncRoute(async(req,res)=>{
 const key=String(req.body?.apiKey||"").trim();
 if(!key||key.length>512)return res.status(400).json({error:"Cole uma chave API válida da ElevenLabs."});
 const check=await fetch("https://api.elevenlabs.io/v1/user",{headers:{"xi-api-key":key,"Accept":"application/json"},signal:AbortSignal.timeout(15000)});
 if(!check.ok){
  const details=await check.json().catch(()=>({}));
  console.warn("ElevenLabs user key validation rejected",check.status);
  return res.status(400).json({error:check.status===401||check.status===403?"A ElevenLabs recusou essa chave. Confira se ela está correta e ativa.":"Não foi possível validar a chave na ElevenLabs agora.",provider_status:check.status});
 }
 await saveElevenLabsKey(req.user.sub,key);
 res.json({connected:true,message:"Chave ElevenLabs validada e vinculada somente à sua conta.",...(await getElevenLabsKeyStatus(req.user.sub))});
}));
app.delete("/api/v1/me/elevenlabs",authRequired,asyncRoute(async(req,res)=>{
 await removeElevenLabsKey(req.user.sub);
 res.json({connected:false,message:"Chave pessoal desconectada. A Bia voltou a usar a chave padrão da plataforma."});
}));
app.patch("/api/v1/me/profile",authRequired,asyncRoute(async(req,res)=>{
 const {organizationName,websiteUrl,contactPhone,rightsDeclaration}=req.body||{};
 const r=await query("UPDATE publisher_profiles SET organization_name=COALESCE($2,organization_name),website_url=COALESCE($3,website_url),contact_phone=COALESCE($4,contact_phone),rights_declaration=COALESCE($5,rights_declaration),updated_at=now() WHERE user_id=$1 RETURNING *",[req.user.sub,organizationName??null,websiteUrl??null,contactPhone??null,rightsDeclaration??null]);
 res.json({profile:r.rows[0]});
}));

app.get("/api/v1/content",asyncRoute(async(req,res)=>{
 const {q="",type="",limit=30}=req.query;
 const r=await query("SELECT c.id,c.content_type,c.title,c.summary,c.canonical_url,c.asset_url,c.source_name,c.author_name,c.created_at,p.organization_name FROM content_items c LEFT JOIN publisher_profiles p ON p.user_id=c.owner_user_id WHERE c.status='approved' AND ($1='' OR c.title ILIKE '%'||$1||'%' OR c.summary ILIKE '%'||$1||'%') AND ($2='' OR c.content_type=$2) ORDER BY c.created_at DESC LIMIT $3",[q,type,Math.min(Math.max(Number(limit)||30,1),100)]);
 res.json({items:r.rows});
}));
app.post("/api/v1/content",authRequired,asyncRoute(async(req,res)=>{
 const wooviState=await query("SELECT consented_at,payout_permission_status,payout_permission_verified_at FROM user_woovi_accounts WHERE user_id=$1",[req.user.sub]);
 if(!wooviState.rowCount||!wooviState.rows[0].consented_at||wooviState.rows[0].payout_permission_status!=="verified"||!wooviState.rows[0].payout_permission_verified_at)return res.status(403).json({error:"Para publicar, conecte a Woovi, aceite a comissão de 15% e confirme a permissão Pix Out da sua conta.",code:"WOOVI_AUTHORIZATION_REQUIRED"});
 const {contentType,title,summary="",canonicalUrl="",assetUrl="",sourceName="",authorName="",rightsEvidenceUrl="",rightsDeclaration}=req.body||{};
 if(!["article","photo","video","audio"].includes(contentType)||!title||!rightsDeclaration)return res.status(400).json({error:"Tipo, título e declaração de direitos são obrigatórios"});
 const r=await query("INSERT INTO content_items(owner_user_id,content_type,title,summary,canonical_url,asset_url,source_name,author_name,rights_evidence_url,rights_declaration) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",[req.user.sub,contentType,title,summary,canonicalUrl,assetUrl,sourceName,authorName,rightsEvidenceUrl,rightsDeclaration]);
 res.status(201).json({item:r.rows[0]});
}));
app.get("/api/v1/content/mine",authRequired,asyncRoute(async(req,res)=>{const r=await query("SELECT * FROM content_items WHERE owner_user_id=$1 ORDER BY created_at DESC",[req.user.sub]);res.json({items:r.rows});}));
app.post("/api/v1/content/:id/offers",authRequired,asyncRoute(async(req,res)=>{
 const wooviState=await query("SELECT consented_at,payout_permission_status,payout_permission_verified_at FROM user_woovi_accounts WHERE user_id=$1",[req.user.sub]);
 if(!wooviState.rowCount||!wooviState.rows[0].consented_at||wooviState.rows[0].payout_permission_status!=="verified"||!wooviState.rows[0].payout_permission_verified_at)return res.status(403).json({error:"Para publicar, conecte a Woovi, aceite a comissão de 15% e confirme a permissão Pix Out da sua conta.",code:"WOOVI_AUTHORIZATION_REQUIRED"});
 const {purpose,priceCents,currency="BRL",territory="BR",durationDays=365,exclusive=false,terms}=req.body||{};
 if(!["indexing","summary","snippet","reproduction","ai_training"].includes(purpose)||!Number.isInteger(Number(priceCents))||Number(priceCents)<=0||!terms)return res.status(400).json({error:"Dados da oferta inválidos"});
 const r=await query("INSERT INTO license_offers(content_id,owner_user_id,purpose,price_cents,currency,territory,duration_days,exclusive,terms) SELECT id,$2,$3,$4,$5,$6,$7,$8,$9 FROM content_items WHERE id=$1 AND owner_user_id=$2 AND status='approved' RETURNING *",[req.params.id,req.user.sub,purpose,priceCents,currency,territory,durationDays,exclusive,terms]);
 if(!r.rowCount)return res.status(404).json({error:"Conteúdo aprovado não encontrado ou não pertence a você"});
 res.status(201).json({offer:r.rows[0]});
}));
app.get("/api/v1/offers",asyncRoute(async(req,res)=>{
 const r=await query("SELECT o.*,c.title,c.content_type,c.summary,c.asset_url FROM license_offers o JOIN content_items c ON c.id=o.content_id JOIN user_woovi_accounts wa ON wa.user_id=o.owner_user_id AND wa.consented_at IS NOT NULL AND wa.payout_permission_status='verified' AND wa.payout_permission_verified_at IS NOT NULL WHERE o.active=true AND c.status='approved' ORDER BY o.created_at DESC LIMIT 100");
 res.json({offers:r.rows});
}));
app.post("/api/v1/licenses/request",authRequired,asyncRoute(async(req,res)=>{
 const {offerId,requestMessage="",termsAccepted}=req.body||{};
 if(!offerId||termsAccepted!==true)return res.status(400).json({error:"Informe a oferta e aceite expressamente os termos."});
 const order=await transaction(async client=>{
  const offer=await client.query("SELECT o.*,c.title,c.status AS content_status FROM license_offers o JOIN content_items c ON c.id=o.content_id JOIN user_woovi_accounts wa ON wa.user_id=o.owner_user_id AND wa.consented_at IS NOT NULL AND wa.payout_permission_status='verified' AND wa.payout_permission_verified_at IS NOT NULL WHERE o.id=$1 AND o.active=true FOR UPDATE OF o",[offerId]);
  if(!offer.rowCount||offer.rows[0].content_status!=="approved")throw Object.assign(new Error("Oferta indisponível."),{status:404});
  const o=offer.rows[0];
  if(o.owner_user_id===req.user.sub)throw Object.assign(new Error("Você não pode solicitar licença do seu próprio conteúdo."),{status:400});
  const created=await client.query("INSERT INTO license_orders(offer_id,buyer_user_id,publisher_user_id,stripe_account_id,currency,gross_amount_cents,platform_fee_cents,creator_net_cents,status,buyer_message) VALUES($1,$2,$3,NULL,$4,$5,0,$5,'pending',$6) RETURNING *",[o.id,req.user.sub,o.owner_user_id,o.currency,o.price_cents,String(requestMessage).slice(0,2000)]);
  await client.query("INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,details) VALUES($1,'license.requested','license_order',$2,$3::jsonb)",[req.user.sub,String(created.rows[0].id),JSON.stringify({offerId:o.id,contentId:o.content_id,payments:"external_between_parties"})]);
  return {...created.rows[0],content_title:o.title,purpose:o.purpose,territory:o.territory,duration_days:o.duration_days};
 });
 res.status(201).json({order,payments:"external_between_parties",message:"Solicitação enviada ao titular. A negociação e qualquer pagamento acontecem diretamente entre as partes, fora do Licença News."});
}));
app.get("/api/v1/licenses/mine",authRequired,asyncRoute(async(req,res)=>{
 const r=await query("SELECT o.*,c.title,l.license_code,l.status AS license_status,l.starts_at,l.expires_at,(o.publisher_user_id=$1) AS can_respond,(o.buyer_user_id=$1) AS can_pay FROM license_orders o JOIN license_offers f ON f.id=o.offer_id JOIN content_items c ON c.id=f.content_id LEFT JOIN issued_licenses l ON l.order_id=o.id WHERE o.buyer_user_id=$1 OR o.publisher_user_id=$1 ORDER BY o.created_at DESC",[req.user.sub]);
 res.json({orders:r.rows});
}));
app.patch("/api/v1/licenses/:id/respond",authRequired,asyncRoute(async(req,res)=>{
 const {decision,responseMessage=""}=req.body||{};
 if(!["accept","decline"].includes(decision))return res.status(400).json({error:"Decisão inválida."});
 const result=await transaction(async client=>{
  const found=await client.query("SELECT o.*,f.content_id,f.purpose,f.territory,f.duration_days,f.owner_user_id FROM license_orders o JOIN license_offers f ON f.id=o.offer_id WHERE o.id=$1 FOR UPDATE OF o",[req.params.id]);
  if(!found.rowCount)return null;
  const order=found.rows[0];
  if(order.publisher_user_id!==req.user.sub)return {forbidden:true};
  if(order.status!=="pending")return {conflict:true};
  const status=decision==="accept"?"accepted":"declined";
  const updated=await client.query("UPDATE license_orders SET status=$2,publisher_response=$3,updated_at=now() WHERE id=$1 RETURNING *",[order.id,status,String(responseMessage).slice(0,2000)]);
  await client.query("INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,details) VALUES($1,$2,'license_order',$3,$4::jsonb)",[req.user.sub,"license."+status,String(order.id),JSON.stringify({payments:"external_between_parties"})]);
  return {order:updated.rows[0]};
 });
 if(!result)return res.status(404).json({error:"Solicitação não encontrada."});
 if(result.forbidden)return res.status(403).json({error:"Somente o titular do conteúdo pode responder a esta solicitação."});
 if(result.conflict)return res.status(409).json({error:"Esta solicitação já foi respondida."});
 res.json({order:result.order,message:decision==="accept"?"Autorização aprovada. A licença será emitida quando o titular confirmar o acordo diretamente com o comprador.":"Solicitação recusada."});
}));
app.post("/api/v1/licenses/:id/issue",authRequired,asyncRoute(async(req,res)=>{
 const result=await transaction(async client=>{
  const found=await client.query("SELECT o.*,f.content_id,f.purpose,f.territory,f.duration_days FROM license_orders o JOIN license_offers f ON f.id=o.offer_id WHERE o.id=$1 FOR UPDATE OF o",[req.params.id]);
  if(!found.rowCount)return {notFound:true};
  const order=found.rows[0];
  if(order.publisher_user_id!==req.user.sub)return {forbidden:true};
  if(order.status!=="accepted")return {conflict:true};
  const existing=await client.query("SELECT * FROM issued_licenses WHERE order_id=$1",[order.id]);
  if(existing.rowCount)return {license:existing.rows[0],alreadyIssued:true};
  const code="LN-"+randomBytes(12).toString("hex").toUpperCase();
  const issued=await client.query("INSERT INTO issued_licenses(order_id,license_code,content_id,owner_user_id,buyer_user_id,purpose,territory,starts_at,expires_at,status) VALUES($1,$2,$3,$4,$5,$6,$7,now(),now()+($8::int * interval '1 day'),'active') RETURNING *",[order.id,code,order.content_id,order.publisher_user_id,order.buyer_user_id,order.purpose,order.territory,order.duration_days]);
  await client.query("INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,details) VALUES($1,'license.issued','license_order',$2,$3::jsonb)",[req.user.sub,String(order.id),JSON.stringify({licenseCode:code,externalSettlementConfirmed:true})]);
  return {license:issued.rows[0]};
 });
 if(result.notFound)return res.status(404).json({error:"Solicitação não encontrada."});
 if(result.forbidden)return res.status(403).json({error:"Somente o titular pode emitir a licença."});
 if(result.conflict)return res.status(409).json({error:"A solicitação precisa estar aprovada antes da emissão."});
 res.status(result.alreadyIssued?200:201).json({license:result.license,message:result.alreadyIssued?"Esta licença já havia sido emitida.":"Licença emitida após confirmação do titular sobre o acordo externo."});
}));
app.get("/api/v1/licenses/verify/:code",asyncRoute(async(req,res)=>{
 const r=await query("SELECT license_code,status,purpose,territory,starts_at,expires_at,content_id FROM issued_licenses WHERE license_code=$1",[req.params.code]);
 if(!r.rowCount)return res.status(404).json({valid:false,error:"Licença não encontrada"});
 const l=r.rows[0],valid=l.status==="active"&&new Date(l.expires_at)>new Date()&&new Date(l.starts_at)<=new Date();
 res.json({valid,status:valid?"active":l.status,license:l});
}));
app.get("/api/v1/admin/content",authRequired,adminRequired,asyncRoute(async(req,res)=>{const r=await query("SELECT * FROM content_items ORDER BY created_at DESC");res.json({items:r.rows});}));
app.patch("/api/v1/admin/content/:id",authRequired,adminRequired,asyncRoute(async(req,res)=>{
 const {status}=req.body||{};if(!["approved","rejected","suspended","pending_review"].includes(status))return res.status(400).json({error:"Status inválido"});
 const r=await query("UPDATE content_items SET status=$2,updated_at=now() WHERE id=$1 RETURNING *",[req.params.id,status]);if(!r.rowCount)return res.status(404).json({error:"Conteúdo não encontrado"});
 await query("INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,details) VALUES($1,$2,'content',$3,$4)",[req.user.sub,"content."+status,String(req.params.id),JSON.stringify({status})]);
 res.json({item:r.rows[0]});
}));
app.post("/api/v1/developer/api-keys",authRequired,asyncRoute(async(req,res)=>{
 const key="ln_live_"+randomBytes(32).toString("hex"),hash=createHash("sha256").update(key).digest("hex");
 await query("INSERT INTO api_credentials(user_id,label,key_hash) VALUES($1,$2,$3)",[req.user.sub,req.body?.label||"Chave API",hash]);
 res.status(201).json({key,warning:"Copie agora. A chave completa não será exibida novamente."});
}));
app.use((err,req,res,next)=>{console.error(err);const status=Number.isInteger(err?.status)&&err.status>=400&&err.status<600?err.status:500;res.status(status).json({error:status===500?"Erro interno do servidor":err.message||"Solicitação inválida"});});
const port=process.env.PORT||4000;
app.listen(port,"0.0.0.0",()=>console.log("Licença News API ouvindo na porta "+port));
