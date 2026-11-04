import {schema,OutputType} from "./verify_POST.schema";
import {db} from "../../helpers/db";
import superjson from "superjson";
export const flootPublic=true;
export const flootPreviewPublic=true;
export async function handle(request:Request){
 try{
  const input=schema.parse(superjson.parse(await request.text()));
  const license=await db.selectFrom("issuedLicenses").innerJoin("contentItems","contentItems.id","issuedLicenses.contentId")
    .select(["issuedLicenses.licenseCode","issuedLicenses.purpose","issuedLicenses.territory","issuedLicenses.startsAt","issuedLicenses.expiresAt","issuedLicenses.status","contentItems.title as contentTitle"])
    .where("issuedLicenses.licenseCode","=",input.licenseCode).executeTakeFirst();
  if(!license)return new Response(superjson.stringify({valid:false,message:"Licença não encontrada."} satisfies OutputType),{headers:{"Content-Type":"application/json"}});
  const now=new Date();const valid=license.status==="active"&&license.startsAt<=now&&license.expiresAt>now;
  return new Response(superjson.stringify({valid,license:{licenseCode:license.licenseCode,contentTitle:license.contentTitle,purpose:license.purpose,territory:license.territory,startsAt:license.startsAt.toISOString(),expiresAt:license.expiresAt.toISOString(),status:valid?"active":license.expiresAt<=now?"expired":license.status},message:valid?"Licença ativa para o escopo indicado.":"Licença não está ativa."} satisfies OutputType),{headers:{"Content-Type":"application/json"}});
 }catch(e){return new Response(superjson.stringify({valid:false,message:e instanceof Error?e.message:"Código inválido."} satisfies OutputType),{status:400,headers:{"Content-Type":"application/json"}});}
}