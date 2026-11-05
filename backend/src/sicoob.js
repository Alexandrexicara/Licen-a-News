import axios from "axios";
import https from "node:https";

const AUTH_URL=process.env.SICOOB_AUTH_URL||"https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token";
const API_URL=(process.env.SICOOB_API_BASE_URL||"https://api.sicoob.com.br/pix/api/v2").replace(/\/+$/,"");
let cachedToken=null,expiresAt=0;
function httpsAgent(){
 const cert=process.env.SICOOB_MTLS_PFX_BASE64;
 if(!cert)throw new Error("Certificado mTLS do Sicoob ainda não configurado.");
 return new https.Agent({pfx:Buffer.from(cert,"base64"),passphrase:process.env.SICOOB_MTLS_PFX_PASSWORD||"",minVersion:"TLSv1.2",rejectUnauthorized:true});
}
export function sicoobStatus(){
 return {configured:Boolean(process.env.SICOOB_CLIENT_ID&&process.env.SICOOB_CLIENT_SECRET&&process.env.SICOOB_MTLS_PFX_BASE64),clientIdConfigured:Boolean(process.env.SICOOB_CLIENT_ID),clientSecretConfigured:Boolean(process.env.SICOOB_CLIENT_SECRET),certificateConfigured:Boolean(process.env.SICOOB_MTLS_PFX_BASE64),apiBaseUrl:API_URL,environment:process.env.SICOOB_ENVIRONMENT||"production"};
}
async function accessToken(){
 if(cachedToken&&expiresAt>Date.now()+30000)return cachedToken;
 const id=process.env.SICOOB_CLIENT_ID,secret=process.env.SICOOB_CLIENT_SECRET;
 if(!id||!secret)throw new Error("Credenciais Sicoob não configuradas.");
 const form=new URLSearchParams({grant_type:"client_credentials",scope:process.env.SICOOB_SCOPES||"cob.read cob.write pix.read webhook.write webhook.read"});
 const response=await axios.post(AUTH_URL,form.toString(),{httpsAgent:httpsAgent(),auth:{username:id,password:secret},headers:{"Content-Type":"application/x-www-form-urlencoded"},timeout:20000});
 if(!response.data?.access_token)throw new Error("Sicoob não retornou access_token.");
 cachedToken=response.data.access_token;expiresAt=Date.now()+Math.max(60,Number(response.data.expires_in||300))*1000;return cachedToken;
}
export async function sicoobRequest(method,path,data){
 const token=await accessToken();
 const response=await axios({method,url:API_URL+path,data,httpsAgent:httpsAgent(),headers:{Authorization:"Bearer "+token,client_id:process.env.SICOOB_CLIENT_ID,Accept:"application/json","Content-Type":"application/json"},timeout:25000});
 return response.data;
}
export async function createPixCharge({txid,valueCents,pixKey,description}){
 if(!Number.isSafeInteger(valueCents)||valueCents<1)throw new Error("Valor da cobrança inválido.");
 if(!pixKey)throw new Error("Chave Pix do titular não cadastrada.");
 return sicoobRequest("put","/cob/"+encodeURIComponent(txid),{calendario:{expiracao:Number(process.env.SICOOB_PIX_EXPIRATION_SECONDS||3600)},valor:{original:(valueCents/100).toFixed(2)},chave:pixKey,solicitacaoPagador:String(description||"Licenciamento de conteúdo").slice(0,140)});
}
