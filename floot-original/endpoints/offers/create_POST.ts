import {schema,OutputType} from "./create_POST.schema";
import {db} from "../../helpers/db";
import {getServerUserSession} from "../../helpers/getServerUserSession";
import {NotAuthenticatedError} from "../../helpers/getSetServerSession";
import superjson from "superjson";
export async function handle(request:Request){
 try{
  const {user}=await getServerUserSession(request);const input=schema.parse(superjson.parse(await request.text()));
  const profile=await db.selectFrom("publisherProfiles").select(["verificationStatus","accountType"]).where("userId","=",user.id).executeTakeFirst();
  if(!profile||profile.verificationStatus!=="approved"||!["journalist","publisher","both"].includes(profile.accountType))return new Response(superjson.stringify({error:"Perfil de titular precisa estar aprovado antes de publicar ofertas."}),{status:403});
  const content=await db.selectFrom("contentItems").select(["id","ownerUserId","status"]).where("id","=",input.contentId).executeTakeFirst();
  if(!content||content.ownerUserId!==user.id||content.status!=="approved")return new Response(superjson.stringify({error:"Conteúdo não encontrado ou ainda não aprovado."}),{status:403});
  const offer=await db.insertInto("licenseOffers").values({contentId:content.id,ownerUserId:user.id,purpose:input.purpose,priceCents:input.priceCents,territory:input.territory,durationDays:input.durationDays,exclusive:input.exclusive,terms:input.terms}).returning("id").executeTakeFirstOrThrow();
  await db.insertInto("auditLogs").values({actorUserId:user.id,action:"offer.created",entityType:"offer",entityId:String(offer.id),details:{contentId:input.contentId,purpose:input.purpose,priceCents:input.priceCents}}).execute();
  return new Response(superjson.stringify({offerId:String(offer.id),status:"active"} satisfies OutputType),{headers:{"Content-Type":"application/json"}});
 }catch(e){const status=e instanceof NotAuthenticatedError?401:400;return new Response(superjson.stringify({error:e instanceof Error?e.message:"Erro ao criar oferta"}),{status,headers:{"Content-Type":"application/json"}});}
}