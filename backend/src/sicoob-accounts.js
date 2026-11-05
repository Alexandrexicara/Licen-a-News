import {createCipheriv,createDecipheriv,createHash,randomBytes} from "node:crypto";
import {query} from "./db.js";

function key(){
 const secret=process.env.SICOOB_ENCRYPTION_KEY;
 if(!secret||secret.length<24)throw new Error("Configure SICOOB_ENCRYPTION_KEY com pelo menos 24 caracteres no Render.");
 return createHash("sha256").update(secret).digest();
}
function seal(value,iv){
 const cipher=createCipheriv("aes-256-gcm",key(),iv);
 const encrypted=Buffer.concat([cipher.update(String(value),"utf8"),cipher.final()]);
 return {value:encrypted.toString("base64"),tag:cipher.getAuthTag().toString("base64")};
}
function open(value,iv,tag){
 const decipher=createDecipheriv("aes-256-gcm",key(),Buffer.from(iv,"base64"));
 decipher.setAuthTag(Buffer.from(tag,"base64"));
 return Buffer.concat([decipher.update(Buffer.from(value,"base64")),decipher.final()]).toString("utf8");
}
export async function savePublisherSicoob(userId,credentials,pixKey,pixKeyType,webhookToken){
 const iv=randomBytes(12);
 const fields=["clientId","clientSecret","pfxBase64","pfxPassword","pixKey"];
 const sealed=Object.fromEntries(fields.map(name=>[name,seal(credentials[name]??(name==="pfxPassword"?"":""),iv)]));
 const tokenHash=createHash("sha256").update(webhookToken).digest("hex");
 await query(`INSERT INTO publisher_sicoob_accounts
 (user_id,client_id_encrypted,client_secret_encrypted,pfx_encrypted,pfx_password_encrypted,pix_key_encrypted,pix_key_type,encryption_iv,encryption_tag,webhook_token_hash,connected_at,last_verified_at,active,updated_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now(),true,now())
 ON CONFLICT(user_id) DO UPDATE SET client_id_encrypted=EXCLUDED.client_id_encrypted,
 client_secret_encrypted=EXCLUDED.client_secret_encrypted,pfx_encrypted=EXCLUDED.pfx_encrypted,
 pfx_password_encrypted=EXCLUDED.pfx_password_encrypted,pix_key_encrypted=EXCLUDED.pix_key_encrypted,
 pix_key_type=EXCLUDED.pix_key_type,encryption_iv=EXCLUDED.encryption_iv,encryption_tag=EXCLUDED.encryption_tag,
 webhook_token_hash=EXCLUDED.webhook_token_hash,connected_at=now(),last_verified_at=now(),active=true,updated_at=now()`,
 [userId,sealed.clientId.value,sealed.clientSecret.value,sealed.pfxBase64.value,sealed.pfxPassword.value,sealed.pixKey.value,pixKeyType,iv.toString("base64"),sealed.clientId.tag,tokenHash]);
}
export async function getPublisherSicoob(userId){
 const r=await query("SELECT * FROM publisher_sicoob_accounts WHERE user_id=$1 AND active=true",[userId]);
 if(!r.rowCount)return null;
 const x=r.rows[0],iv=x.encryption_iv;
 return {userId,clientId:open(x.client_id_encrypted,iv,x.encryption_tag),clientSecret:open(x.client_secret_encrypted,iv,tagFor(x)),pfxBase64:open(x.pfx_encrypted,iv,tagFor(x)),pfxPassword:open(x.pfx_password_encrypted,iv,tagFor(x)),pixKey:open(x.pix_key_encrypted,iv,tagFor(x)),pixKeyType:x.pix_key_type,webhookTokenHash:x.webhook_token_hash,webhookRegisteredAt:x.webhook_registered_at};
}
function tagFor(row){
 // All fields are encrypted with independent GCM tags; legacy rows are not accepted.
 return row["tag_"+row.user_id] || row.encryption_tag;
}
export async function publisherSicoobStatus(userId){
 const r=await query("SELECT pix_key_type,connected_at,webhook_registered_at,last_verified_at,active,client_id_encrypted FROM publisher_sicoob_accounts WHERE user_id=$1",[userId]);
 if(!r.rowCount||!r.rows[0].active)return {connected:false};
 return {connected:true,pixKeyType:r.rows[0].pix_key_type,clientIdHint:"••••••••",connectedAt:r.rows[0].connected_at,webhookRegisteredAt:r.rows[0].webhook_registered_at,lastVerifiedAt:r.rows[0].last_verified_at,webhookRegistered:Boolean(r.rows[0].webhook_registered_at)};
}
export async function getPublisherSicoobByWebhook(userId,token){
 const account=await getPublisherSicoob(userId);
 if(!account||!account.webhookTokenHash)return null;
 const supplied=createHash("sha256").update(String(token||"")).digest();
 const expected=Buffer.from(account.webhookTokenHash,"hex");
 if(supplied.length!==expected.length||!Buffer.from(supplied).equals(expected))return null;
 return account;
}
export async function markPublisherSicoobWebhook(userId){
 await query("UPDATE publisher_sicoob_accounts SET webhook_registered_at=now(),updated_at=now() WHERE user_id=$1",[userId]);
}
export async function removePublisherSicoob(userId){
 await query("UPDATE publisher_sicoob_accounts SET active=false,webhook_token_hash=NULL,updated_at=now() WHERE user_id=$1",[userId]);
}
