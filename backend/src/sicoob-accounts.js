import {createCipheriv,createDecipheriv,createHash,randomBytes} from "node:crypto";
import {query} from "./db.js";
function key(){const secret=process.env.SICOOB_ENCRYPTION_KEY;if(!secret||secret.length<24)throw new Error("Configure SICOOB_ENCRYPTION_KEY com pelo menos 24 caracteres no Render.");return createHash("sha256").update(secret).digest();}
function seal(value,iv){const cipher=createCipheriv("aes-256-gcm",key(),iv);const encrypted=Buffer.concat([cipher.update(String(value),"utf8"),cipher.final()]);return {value:encrypted.toString("base64"),tag:cipher.getAuthTag().toString("base64")};}
function open(value,iv,tag){const decipher=createDecipheriv("aes-256-gcm",key(),Buffer.from(iv,"base64"));decipher.setAuthTag(Buffer.from(tag,"base64"));return Buffer.concat([decipher.update(Buffer.from(value,"base64")),decipher.final()]).toString("utf8");}
export async function savePublisherSicoob(userId,credentials,pixKey,pixKeyType,webhookToken){
 const iv=randomBytes(12),fields={clientId:seal(credentials.clientId,iv),clientSecret:seal(credentials.clientSecret,iv),pfxBase64:seal(credentials.pfxBase64,iv),pfxPassword:seal(credentials.pfxPassword||"",iv),pixKey:seal(pixKey,iv)};
 const tokenHash=createHash("sha256").update(webhookToken).digest("hex");
 await query(`INSERT INTO publisher_sicoob_accounts(user_id,client_id_encrypted,client_secret_encrypted,pfx_encrypted,pfx_password_encrypted,pix_key_encrypted,pix_key_type,encryption_iv,client_id_tag,client_secret_tag,pfx_tag,pfx_password_tag,pix_key_tag,webhook_token_hash,connected_at,last_verified_at,active,updated_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),now(),true,now())
 ON CONFLICT(user_id) DO UPDATE SET client_id_encrypted=EXCLUDED.client_id_encrypted,client_secret_encrypted=EXCLUDED.client_secret_encrypted,pfx_encrypted=EXCLUDED.pfx_encrypted,pfx_password_encrypted=EXCLUDED.pfx_password_encrypted,pix_key_encrypted=EXCLUDED.pix_key_encrypted,pix_key_type=EXCLUDED.pix_key_type,encryption_iv=EXCLUDED.encryption_iv,client_id_tag=EXCLUDED.client_id_tag,client_secret_tag=EXCLUDED.client_secret_tag,pfx_tag=EXCLUDED.pfx_tag,pfx_password_tag=EXCLUDED.pfx_password_tag,pix_key_tag=EXCLUDED.pix_key_tag,webhook_token_hash=EXCLUDED.webhook_token_hash,connected_at=now(),last_verified_at=now(),active=true,updated_at=now()`,
 [userId,fields.clientId.value,fields.clientSecret.value,fields.pfxBase64.value,fields.pfxPassword.value,fields.pixKey.value,pixKeyType,iv.toString("base64"),fields.clientId.tag,fields.clientSecret.tag,fields.pfxBase64.tag,fields.pfxPassword.tag,fields.pixKey.tag,tokenHash]);
}
export async function getPublisherSicoob(userId){
 const r=await query("SELECT * FROM publisher_sicoob_accounts WHERE user_id=$1 AND active=true",[userId]);if(!r.rowCount)return null;
 const x=r.rows[0],iv=x.encryption_iv;
 return {userId,clientId:open(x.client_id_encrypted,iv,x.client_id_tag),clientSecret:open(x.client_secret_encrypted,iv,x.client_secret_tag),pfxBase64:open(x.pfx_encrypted,iv,x.pfx_tag),pfxPassword:open(x.pfx_password_encrypted,iv,x.pfx_password_tag),pixKey:open(x.pix_key_encrypted,iv,x.pix_key_tag),pixKeyType:x.pix_key_type,webhookTokenHash:x.webhook_token_hash,webhookRegisteredAt:x.webhook_registered_at};
}
export async function publisherSicoobStatus(userId){
 const r=await query("SELECT pix_key_type,connected_at,webhook_registered_at,last_verified_at,active FROM publisher_sicoob_accounts WHERE user_id=$1",[userId]);
 if(!r.rowCount||!r.rows[0].active)return {connected:false};
 return {connected:true,pixKeyType:r.rows[0].pix_key_type,connectedAt:r.rows[0].connected_at,webhookRegisteredAt:r.rows[0].webhook_registered_at,lastVerifiedAt:r.rows[0].last_verified_at,webhookRegistered:Boolean(r.rows[0].webhook_registered_at)};
}
export async function getPublisherSicoobByWebhook(userId,token){
 const account=await getPublisherSicoob(userId);if(!account||!account.webhookTokenHash)return null;
 const supplied=createHash("sha256").update(String(token||"")).digest("hex");
 if(supplied.length!==account.webhookTokenHash.length||supplied!==account.webhookTokenHash)return null;
 return account;
}
export async function markPublisherSicoobWebhook(userId){await query("UPDATE publisher_sicoob_accounts SET webhook_registered_at=now(),updated_at=now() WHERE user_id=$1",[userId]);}
export async function removePublisherSicoob(userId){await query("UPDATE publisher_sicoob_accounts SET active=false,webhook_token_hash=NULL,updated_at=now() WHERE user_id=$1",[userId]);}
