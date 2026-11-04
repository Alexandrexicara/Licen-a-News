import {schema,OutputType} from "./review_POST.schema";
import {db} from "../../helpers/db";
import {getServerUserSession} from "../../helpers/getServerUserSession";
import {NotAuthenticatedError} from "../../helpers/getSetServerSession";
import superjson from "superjson";
export async function handle(request:Request){
 try{
  const {user}=await getServerUserSession(request);if(user.role!=="admin")return new Response(superjson.stringify({error:"Apenas administradores podem revisar titularidade."}),{status:403});
  const input=schema.parse(superjson.parse(await request.text()));let status:string;
  if(input.entityType==="publisher"){
   const row=await db.updateTable("publisherProfiles").set({verificationStatus:input.decision,verificationNotes:input.notes,updatedAt:new Date()}).where("id","=",input.entityId).returning("id").executeTakeFirst();
   if(!row)return new Response(superjson.stringify({error:"Perfil não encontrado."}),{status:404});status=input.decision;
  }else{
   const row=await db.updateTable("contentItems").set({status:input.decision,rightsReviewedBy:user.id,rightsReviewedAt:new Date(),updatedAt:new Date()}).where("id","=",input.entityId).returning("id").executeTakeFirst();
   if(!row)return new Response(superjson.stringify({error:"Conteúdo não encontrado."}),{status:404});status=input.decision;
  }
  await db.insertInto("auditLogs").values({actorUserId:user.id,action:"rights.reviewed",entityType:input.entityType,entityId:input.entityId,details:{decision:input.decision,notes:input.notes}}).execute();
  return new Response(superjson.stringify({updated:true,status} satisfies OutputType),{headers:{"Content-Type":"application/json"}});
 }catch(e){const status=e instanceof NotAuthenticatedError?401:400;return new Response(superjson.stringify({error:e instanceof Error?e.message:"Erro na revisão"}),{status,headers:{"Content-Type":"application/json"}});}
}