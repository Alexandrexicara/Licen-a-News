import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { query } from "./db.js";

function key() {
  const secret = process.env.WOOVI_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) throw new Error("Configure WOOVI_ENCRYPTION_KEY no Render.");
  return createHash("sha256").update(secret).digest();
}
function seal(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return { encrypted: encrypted.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}
function open(row, prefix) {
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(row[prefix + "_iv"], "base64"));
  decipher.setAuthTag(Buffer.from(row[prefix + "_tag"], "base64"));
  return Buffer.concat([decipher.update(Buffer.from(row[prefix + "_encrypted"], "base64")), decipher.final()]).toString("utf8");
}
export async function saveWooviAccount(userId, appId, hmacSecret, webhookToken) {
  const a = seal(appId), h = seal(hmacSecret);
  await query(`INSERT INTO user_woovi_accounts
    (user_id,app_id_encrypted,app_id_iv,app_id_tag,app_id_hint,webhook_hmac_encrypted,webhook_hmac_iv,webhook_hmac_tag,webhook_token_hash,connected_at,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())
    ON CONFLICT(user_id) DO UPDATE SET app_id_encrypted=EXCLUDED.app_id_encrypted,app_id_iv=EXCLUDED.app_id_iv,app_id_tag=EXCLUDED.app_id_tag,
    app_id_hint=EXCLUDED.app_id_hint,webhook_hmac_encrypted=EXCLUDED.webhook_hmac_encrypted,webhook_hmac_iv=EXCLUDED.webhook_hmac_iv,
    webhook_hmac_tag=EXCLUDED.webhook_hmac_tag,webhook_token_hash=EXCLUDED.webhook_token_hash,connected_at=now(),updated_at=now()`,
    [userId,a.encrypted,a.iv,a.tag,String(appId).slice(-4),h.encrypted,h.iv,h.tag,createHash("sha256").update(webhookToken).digest("hex")]);
}
export async function getWooviAccount(userId) {
  const r = await query("SELECT * FROM user_woovi_accounts WHERE user_id=$1",[userId]);
  if (!r.rowCount) return null;
  const row = r.rows[0];
  return { appId: open({app_id_encrypted:row.app_id_encrypted,app_id_iv:row.app_id_iv,app_id_tag:row.app_id_tag},"app_id"), hmacSecret: open({webhook_hmac_encrypted:row.webhook_hmac_encrypted,webhook_hmac_iv:row.webhook_hmac_iv,webhook_hmac_tag:row.webhook_hmac_tag},"webhook_hmac"), tokenHash: row.webhook_token_hash, hint: row.app_id_hint };
}
export async function getWooviAccountStatus(userId) {
  const r=await query("SELECT app_id_hint,connected_at,updated_at FROM user_woovi_accounts WHERE user_id=$1",[userId]);
  return r.rowCount ? {connected:true,appIdHint:"••••"+r.rows[0].app_id_hint,connectedAt:r.rows[0].connected_at,updatedAt:r.rows[0].updated_at} : {connected:false};
}
export async function removeWooviAccount(userId) {
  await query("DELETE FROM user_woovi_accounts WHERE user_id=$1",[userId]);
}
export async function getWooviAccountForWebhook(userId, token) {
  const account=await getWooviAccount(userId);
  if(!account || !token) return null;
  const hash=createHash("sha256").update(token).digest();
  const expected=Buffer.from(account.tokenHash,"hex");
  if(hash.length!==expected.length || !timingSafeEqual(hash,expected)) return null;
  return account;
}
export function verifyWooviWebhook(rawBody, headers, secret) {
  const supplied=headers["x-webhook-signature"] || headers["x-openpix-signature"] || headers["x-webhook-signature-sha256"] || "";
  if(!supplied || !rawBody || !secret) return false;
  const body=Buffer.isBuffer(rawBody)?rawBody:Buffer.from(rawBody);
  const candidates=["sha256","sha1"].map(algorithm=>createHmac(algorithm,secret).update(body).digest("base64"));
  return candidates.some(value=>{
    const a=Buffer.from(value),b=Buffer.from(String(supplied));
    return a.length===b.length && timingSafeEqual(a,b);
  });
}
export async function wooviRequest(appId, path, body, method="POST") {
  const response=await fetch("https://api.woovi.com"+path,{
    method,headers:{Authorization:appId,"Content-Type":"application/json",Accept:"application/json"},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) {
    const error=new Error(data?.error || data?.message || "A Woovi recusou a operação.");
    error.status=response.status; error.provider=data; throw error;
  }
  return data;
}
export async function createPlatformCommissionPayout({appId,orderId,userId,amountCents}) {
  const pixKey=String(process.env.WOOVI_PLATFORM_PIX_KEY||"").trim();
  const pixKeyType=String(process.env.WOOVI_PLATFORM_PIX_KEY_TYPE||"").trim().toUpperCase();
  if(!pixKey || !["CPF","CNPJ","EMAIL","PHONE","RANDOM"].includes(pixKeyType)) {
    throw new Error("A chave Pix da plataforma ainda não foi configurada no Render.");
  }
  const correlationID="ln-comissao-"+orderId;
  const result=await wooviRequest(appId,"/api/v1/payment",{
    correlationID,destinationAlias:pixKey,destinationAliasType:pixKeyType,type:"PIX_KEY",
    value:amountCents,comment:"Comissão Licença News - pedido "+orderId,autoApprove:true
  });
  const payment=result.payment||{};
  if(!["APPROVED","CONFIRMED"].includes(String(payment.status||"").toUpperCase())) {
    throw new Error("A Woovi não confirmou a aprovação automática da comissão.");
  }
  return {correlationID,status:String(payment.status).toLowerCase(),providerReference:payment.id||payment.correlationID||correlationID};
}
