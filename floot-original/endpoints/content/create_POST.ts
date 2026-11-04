import {schema,OutputType} from "./create_POST.schema";
import {db} from "../../helpers/db";
import {getServerUserSession} from "../../helpers/getServerUserSession";
import {NotAuthenticatedError} from "../../helpers/getSetServerSession";
import superjson from "superjson";
export async function handle(request:Request){
 try{
  const {user}=await getServerUserSession(request);
  const input=schema.parse(superjson.parse(await request.text()));
  const profile=await db.selectFrom("publisherProfiles").select(["verificationStatus","accountType"]).where("userId","=",user.id).executeTakeFirst();
  if(!profile || !["journalist","publisher","both"].includes(profile.accountType)) return new Response(superjson.stringify({error:"Cadastre primeiro um perfil de titular."}),{status:403});
  const item=await db.insertInto("contentItems").values({ownerUserId:user.id,contentType:input.contentType,title:input.title,summary:input.summary||null,canonicalUrl:input.canonicalUrl||null,assetUrl:input.assetUrl||null,sourceName:input.sourceName||null,authorName:input.authorName||null,rightsEvidenceUrl:input.rightsEvidenceUrl||null,rightsDeclaration:input.rightsDeclaration,status:"pending_review",updatedAt:new Date()}).returning(["id","status"]).executeTakeFirstOrThrow();
  await db.insertInto("auditLogs").values({actorUserId:user.id,action:"content.submitted",entityType:"content",entityId:String(item.id),details:{title:input.title}}).execute();
  return new Response(superjson.stringify({contentId:String(item.id),status:item.status} satisfies OutputType),{headers:{"Content-Type":"application/json"}});
 }catch(e){const status=e instanceof NotAuthenticatedError?401:400;return new Response(superjson.stringify({error:e instanceof Error?e.message:"Erro ao cadastrar conteúdo"}),{status,headers:{"Content-Type":"application/json"}});}
}