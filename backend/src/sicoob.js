import axios from "axios";
import https from "node:https";
import {createHash} from "node:crypto";
const AUTH_URL=process.env.SICOOB_AUTH_URL||"https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token";
const API_URL=(process.env.SICOOB_API_BASE_URL||"https://api.sicoob.com.br/pix/api/v2").replace(/\/+$/,"");
const tokens=new Map();
function settings(credentials={}){
 return {clientId:credentials.clientId||process.env.SICOOB_CLIENT_ID,clientSecret:credentials.clientSecret||process.env.SICOOB_CLIENT_SECRET,pfxBase64:credentials.pfxBase64||process.env.SICOOB_MTLS_PFX_BASE64,pfxPassword:credentials.pfxPassword??process.env.SICOOB_MTLS_PFX_PASSWORD??"",authUrl:credentials.authUrl||AUTH_URL,apiUrl:credentials.apiUrl||API_URL,scopes:credentials.scopes||process.env.SICOOB_SCOPES||"cob.read cob.write pix.read webhook.write webhook.read"};
}
function agent(c){if(!c.pfxBase64)throw new Error("Certificado mTLS PFX não configurado.");return new https.Agent({pfx:Buffer.from(c.pfxBase64,"base64"),passphrase:c.pfxPassword,minVersion:"TLSv1.2",rejectUnauthorized:true});}
async function accessToken(credentials={}){
 const c=settings(credentials);if(!c.clientId||!c.clientSecret)throw new Error("Client ID e Client Secret Sicoob não configurados.");
 const cacheKey=createHash("sha256").update(c.clientId+"|"+c.clientSecret+"|"+c.pfxBase64).digest("hex"),cached=tokens.get(cacheKey);
 if(cached&&cached.expiresAt>Date.now()+30000)return cached.value;
 const form=new URLSearchParams({grant_type:"client_credentials",scope:c.scopes});
 const response=await axios.post(c.authUrl,form.toString(),{httpsAgent:agent(c),auth:{username:c.clientId,password:c.clientSecret},headers:{"Content-Type":"application/x-www-form-urlencoded"},timeout:20000});
 if(!response.data?.access_token)throw new Error("Sicoob não retornou access_token.");
 const value=response.data.access_token,expiresAt=Date.now()+Math.max(60,Number(response.data.expires_in||300))*1000;tokens.set(cacheKey,{value,expiresAt});return value;
}
export async function validateSicoobCredentials(credentials){await accessToken(credentials);return {valid:true};}
export function sicoobStatus(){return {provider:"sicoob",configured:Boolean(process.env.SICOOB_CLIENT_ID&&process.env.SICOOB_CLIENT_SECRET&&process.env.SICOOB_MTLS_PFX_BASE64),environment:process.env.SICOOB_ENVIRONMENT||"production"};}
export async function sicoobRequest(method,path,data,credentials={}){
 const c=settings(credentials),token=await accessToken(credentials);
 const response=await axios({method,url:c.apiUrl+path,data,httpsAgent:agent(c),headers:{Authorization:"Bearer "+token,client_id:c.clientId,Accept:"application/json","Content-Type":"application/json"},timeout:25000});
 return response.data;
}
export async function createPixCharge({txid,valueCents,pixKey,description},credentials={}){
 if(!Number.isSafeInteger(valueCents)||valueCents<1)throw new Error("Valor da cobrança inválido.");
 if(!pixKey)throw new Error("Chave Pix do titular não cadastrada.");
 return sicoobRequest("put","/cob/"+encodeURIComponent(txid),{calendario:{expiracao:Number(process.env.SICOOB_PIX_EXPIRATION_SECONDS||3600)},valor:{original:(valueCents/100).toFixed(2)},chave:pixKey,solicitacaoPagador:String(description||"Licenciamento de conteúdo").slice(0,140)},credentials);
}
