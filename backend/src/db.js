import pg from "pg";
const { Pool } = pg;
let pool;
export function getPool(){
  if(!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada");
  if(!pool) pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==="production"?{rejectUnauthorized:false}:undefined,max:10,idleTimeoutMillis:30000});
  return pool;
}
export async function query(sql,params=[]){return getPool().query(sql,params);}
export async function transaction(work){
  const client=await getPool().connect();
  try{
    await client.query("BEGIN");
    const result=await work(client);
    await client.query("COMMIT");
    return result;
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
}
export async function transaction(work){
  const client=await getPool().connect();
  try{
    await client.query("BEGIN");
    const result=await work(client);
    await client.query("COMMIT");
    return result;
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
}
