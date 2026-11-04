import { schema, OutputType } from "./save_POST.schema";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import superjson from "superjson";
export async function handle(request: Request) {
  try {
    const {user} = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const existing = await db.selectFrom("publisherProfiles").select("id").where("userId","=",user.id).executeTakeFirst();
    const values = {accountType:input.accountType, organizationName:input.organizationName || null, documentNumber:input.documentNumber || null, websiteUrl:input.websiteUrl || null, contactPhone:input.contactPhone || null, rightsDeclaration:input.rightsDeclaration || null, verificationStatus:"pending" as const, verificationNotes:null, updatedAt:new Date()};
    const profile = existing
      ? await db.updateTable("publisherProfiles").set(values).where("userId","=",user.id).returning(["id","verificationStatus"]).executeTakeFirstOrThrow()
      : await db.insertInto("publisherProfiles").values({...values,userId:user.id}).returning(["id","verificationStatus"]).executeTakeFirstOrThrow();
    await db.insertInto("auditLogs").values({actorUserId:user.id,action:"profile.submitted",entityType:"publisher_profile",entityId:String(profile.id),details:{accountType:input.accountType}}).execute();
    return new Response(superjson.stringify({profileId:String(profile.id),verificationStatus:profile.verificationStatus} satisfies OutputType),{headers:{"Content-Type":"application/json"}});
  } catch(e) {
    const status = e instanceof NotAuthenticatedError ? 401 : 400;
    return new Response(superjson.stringify({error:e instanceof Error ? e.message : "Erro ao salvar perfil"}),{status,headers:{"Content-Type":"application/json"}});
  }
}