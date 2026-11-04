import {db} from "../../helpers/db";
import {getServerUserSession} from "../../helpers/getServerUserSession";
import {NotAuthenticatedError} from "../../helpers/getSetServerSession";
import superjson from "superjson";
export async function handle(request:Request){
 try{
  const {user}=await getServerUserSession(request);
  const rows=await db.selectFrom("contentItems").select(["id","title","contentType","status","createdAt"]).where("ownerUserId","=",user.id).orderBy("createdAt","desc").limit(100).execute();
  return new Response(superjson.stringify({items:rows.map(x=>({...x,id:String(x.id),createdAt:x.createdAt.toISOString()}))}),{headers:{"Content-Type":"application/json"}});
 }catch(e){const status=e instanceof NotAuthenticatedError?401:400;return new Response(superjson.stringify({error:e instanceof Error?e.message:"Erro ao carregar conteúdos"}),{status,headers:{"Content-Type":"application/json"}});}
}