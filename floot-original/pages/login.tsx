import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Newspaper, ShieldCheck } from "lucide-react";
import { PasswordLoginForm } from "../components/PasswordLoginForm";
import { PasswordRegisterForm } from "../components/PasswordRegisterForm";
import { useAuth } from "../helpers/useAuth";
import styles from "./login.module.css";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const { authState } = useAuth();
  const navigate = useNavigate();
  React.useEffect(() => { if (authState.type === "authenticated") navigate("/"); }, [authState.type, navigate]);
  return <main className={styles.page}>
    <Link to="/" className={styles.back}><ArrowLeft size={16}/> Voltar à página inicial</Link>
    <section className={styles.card}>
      <div className={styles.brand}><span><Newspaper size={22}/></span><strong>Licença News</strong></div>
      <div className={styles.kicker}><ShieldCheck size={14}/> ACESSO SEGURO À PLATAFORMA</div>
      <h1>{mode === "login" ? "Bem-vindo de volta." : "Faça parte do mercado."}</h1>
      <p className={styles.intro}>{mode === "login" ? "Acesse seu espaço de trabalho para gerenciar conteúdos, licenças e pagamentos." : "Crie sua conta para licenciar conteúdo ou disponibilizar obras jornalísticas."}</p>
      <div className={styles.switcher}><button className={mode === "login" ? styles.selected : ""} onClick={() => setMode("login")}>Entrar</button><button className={mode === "register" ? styles.selected : ""} onClick={() => setMode("register")}>Criar conta</button></div>
      {mode === "login" ? <PasswordLoginForm/> : <PasswordRegisterForm/>}
      <div className={styles.legal}>Ao continuar, você concorda com os Termos de Uso e a Política de Privacidade do Licença News.</div>
    </section>
    <p className={styles.footer}>Licença News · Direitos autorais, transparência e tecnologia.</p>
  </main>;
}