import { createCipheriv,createDecipheriv,createHash,randomBytes } from "node:crypto";
import { query } from "./db.js";

function encryptionKey(){
  const secret=process.env.ELEVENLABS_ENCRYPTION_KEY||process.env.JWT_SECRET;
  if(!secret)throw new Error("Configure ELEVENLABS_ENCRYPTION_KEY ou JWT_SECRET para proteger as chaves dos usuários.");
  return createHash("sha256").update(secret).digest();
}
function encrypt(value){
  const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv);
  const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  return {encrypted_key:encrypted.toString("base64"),key_iv:iv.toString("base64"),key_tag:cipher.getAuthTag().toString("base64")};
}
function decrypt(row){
  const decipher=createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(row.key_iv,"base64"));
  decipher.setAuthTag(Buffer.from(row.key_tag,"base64"));
  return Buffer.concat([decipher.update(Buffer.from(row.encrypted_key,"base64")),decipher.final()]).toString("utf8");
}
export async function saveElevenLabsKey(userId,key){
  const value=String(key||"").trim();
  if(!value||value.length>512)throw new Error("Chave ElevenLabs inválida.");
  const sealed=encrypt(value),hint=value.slice(-4);
  await query(`INSERT INTO user_elevenlabs_keys(user_id,encrypted_key,key_iv,key_tag,key_hint,verified_at,updated_at)
    VALUES($1,$2,$3,$4,$5,now(),now())
    ON CONFLICT(user_id) DO UPDATE SET encrypted_key=EXCLUDED.encrypted_key,key_iv=EXCLUDED.key_iv,key_tag=EXCLUDED.key_tag,key_hint=EXCLUDED.key_hint,verified_at=now(),updated_at=now()`,
    [userId,sealed.encrypted_key,sealed.key_iv,sealed.key_tag,hint]);
}
export async function getElevenLabsKey(userId){
  if(!userId)return null;
  const result=await query("SELECT encrypted_key,key_iv,key_tag FROM user_elevenlabs_keys WHERE user_id=$1",[userId]);
  return result.rowCount?decrypt(result.rows[0]):null;
}
export async function getElevenLabsKeyStatus(userId){
  const result=await query("SELECT key_hint,verified_at,updated_at FROM user_elevenlabs_keys WHERE user_id=$1",[userId]);
  if(!result.rowCount)return {connected:false};
  return {connected:true,keyHint:"••••"+result.rows[0].key_hint,verifiedAt:result.rows[0].verified_at,updatedAt:result.rows[0].updated_at};
}
export async function removeElevenLabsKey(userId){
  await query("DELETE FROM user_elevenlabs_keys WHERE user_id=$1",[userId]);
}
