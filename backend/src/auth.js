import jwt from "jsonwebtoken";
export function signToken(user){return jwt.sign({sub:user.id,email:user.email,role:user.role},process.env.JWT_SECRET,{expiresIn:"7d"});}
export function authRequired(req,res,next){
  const token=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  if(!token) return res.status(401).json({error:"Autenticação necessária"});
  try{req.user=jwt.verify(token,process.env.JWT_SECRET);next();}
  catch{return res.status(401).json({error:"Sessão inválida ou expirada"});}
}
export function adminRequired(req,res,next){if(req.user?.role!=="admin")return res.status(403).json({error:"Acesso restrito"});next();}
