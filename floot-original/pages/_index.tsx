import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, BadgeCheck, BookOpen, Building2, ChevronRight, CircleDollarSign, FileCheck2, FileImage, FileText, KeyRound, LayoutDashboard, LockKeyhole, LogOut, Menu, Newspaper, Plus, Search, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { useAuth } from "../helpers/useAuth";
import styles from "./_index.module.css";

const sampleStories = [
  { id: "LN-2026-000184", title: "A transição energética e o novo mapa da indústria brasileira", publisher: "Jornal Horizonte", type: "Reportagem", status: "Licenciável", price: "R$ 240,00", scope: "Resumo · Indexação" },
  { id: "LN-2026-000183", title: "O impacto da inteligência artificial nas redações regionais", publisher: "Agência Pauta", type: "Análise", status: "Em revisão", price: "R$ 180,00", scope: "Trechos · Resumo" },
  { id: "LN-2026-000182", title: "Fotografia: a memória urbana das cidades do interior", publisher: "Marina Costa", type: "Fotografia", status: "Licenciável", price: "R$ 95,00", scope: "Reprodução editorial" },
];

export default function HomePage() {
  const [section, setSection] = useState("visao-geral");
  const [mobileMenu, setMobileMenu] = useState(false);
  const { authState, logout } = useAuth();
  const navigate = useNavigate();
  const signedIn = authState.type === "authenticated";
  const user = signedIn ? authState.user : null;

  const navItems = [
    { id: "visao-geral", label: "Visão geral", icon: LayoutDashboard },
    { id: "conteudos", label: "Conteúdos", icon: Newspaper },
    { id: "licencas", label: "Licenças", icon: FileCheck2 },
    { id: "financeiro", label: "Financeiro", icon: WalletCards },
    { id: "api", label: "API e integrações", icon: KeyRound },
  ];

  const goToSection = (id: string) => {
    if (!signedIn && id !== "visao-geral") {
      navigate("/login");
      return;
    }
    setSection(id);
    setMobileMenu(false);
  };

  return (
    <div className={styles.appShell}>
      <aside className={`${styles.sidebar} ${mobileMenu ? styles.sidebarOpen : ""}`}>
        <Link to="/" className={styles.brand}>
          <span className={styles.brandMark}><Newspaper size={21} /></span>
          <span><strong>Licença News</strong><small>RIGHTS EXCHANGE</small></span>
        </Link>
        <div className={styles.workspaceLabel}>ESPAÇO DE TRABALHO</div>
        <nav className={styles.navigation}>
          {navItems.map(item => {
            const Icon = item.icon;
            return <button key={item.id} onClick={() => goToSection(item.id)} className={section === item.id ? styles.navActive : styles.navItem}>
              <Icon size={18} /><span>{item.label}</span>{item.id === "api" && <span className={styles.navDot} />}
            </button>;
          })}
        </nav>
        <div className={styles.sidebarBottom}>
          <div className={styles.helpCard}>
            <ShieldCheck size={19} />
            <strong>Direitos em primeiro lugar</strong>
            <p>Cada licença tem escopo, prazo e titularidade verificáveis.</p>
            <button onClick={() => setSection("como-funciona")}>Como funciona <ArrowUpRight size={14} /></button>
          </div>
          {signedIn ? <div className={styles.userRow}>
            <div className={styles.avatar}>{user?.displayName?.slice(0,1).toUpperCase() || "U"}</div>
            <div className={styles.userInfo}><strong>{user?.displayName}</strong><small>{user?.email}</small></div>
            <button className={styles.iconButton} aria-label="Sair" onClick={async () => { await logout(); navigate("/"); }}><LogOut size={17} /></button>
          </div> : <Button className={styles.sideLogin} onClick={() => navigate("/login")}>Entrar na plataforma</Button>}
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <button className={styles.mobileMenu} onClick={() => setMobileMenu(!mobileMenu)}><Menu size={20}/></button>
          <div className={styles.breadcrumb}>Plataforma <ChevronRight size={14}/> <strong>{navItems.find(n => n.id === section)?.label || "Como funciona"}</strong></div>
          <div className={styles.topActions}>
            <span className={styles.secureLabel}><LockKeyhole size={14}/> Ambiente protegido</span>
            {signedIn ? <Button size="sm" onClick={() => navigate("/painel")}>Abrir painel <ArrowUpRight size={15}/></Button> : <Button size="sm" onClick={() => navigate("/login")}>Acessar conta</Button>}
          </div>
        </header>

        {section === "visao-geral" && <>
          <section className={styles.welcome}>
            <div>
              <div className={styles.eyebrow}><span/> MERCADO DE DIREITOS EDITORIAIS</div>
              <h1>Conteúdo jornalístico.<br/><em>Direitos respeitados.</em></h1>
              <p>Uma infraestrutura transparente para licenciar notícias, fotografias e vídeos a empresas de mídia, buscadores e plataformas de inteligência artificial.</p>
              <div className={styles.welcomeActions}>
                <Button size="lg" onClick={() => navigate("/login")}>Começar agora <ArrowUpRight size={17}/></Button>
                <button className={styles.textAction} onClick={() => setSection("como-funciona")}>Conhecer a plataforma <ChevronRight size={16}/></button>
              </div>
            </div>
            <div className={styles.heroStamp}>
              <div className={styles.stampTop}>LICENCIAMENTO TRANSPARENTE</div>
              <div className={styles.stampIcon}><FileCheck2 size={42}/></div>
              <strong>Direitos<br/>sob controle.</strong>
              <span>REGISTRO · ESCOPO · AUDITORIA</span>
            </div>
          </section>

          <section className={styles.metrics}>
            <div className={styles.metric}><span>COMISSÃO DA PLATAFORMA</span><strong>15%</strong><small>Somente sobre transações concluídas</small></div>
            <div className={styles.metric}><span>REPASSE AO TITULAR</span><strong>85%</strong><small>Do valor da licença, antes de custos externos</small></div>
            <div className={styles.metric}><span>CONTROLE DE USO</span><strong>100%</strong><small>Finalidade, prazo e território definidos</small></div>
          </section>

          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>UM MERCADO, DUAS PONTAS</span><h2>Uma ponte entre quem produz e quem utiliza.</h2></div><span className={styles.sectionNote}>Modelo de licenciamento voluntário</span></div>
            <div className={styles.audienceGrid}>
              <article className={styles.audienceCard}><div className={styles.audienceIcon}><Newspaper size={22}/></div><span>PARA QUEM PUBLICA</span><h3>Jornalistas e veículos</h3><p>Cadastre conteúdos, comprove seus direitos, defina preços e acompanhe licenças e repasses.</p><button onClick={() => navigate("/login")}>Cadastrar conteúdo <ArrowUpRight size={15}/></button></article>
              <article className={styles.audienceCard}><div className={styles.audienceIcon}><Building2 size={22}/></div><span>PARA QUEM LICENCIA</span><h3>Empresas e plataformas</h3><p>Descubra conteúdos autorizados, solicite licenças e integre a verificação por API.</p><button onClick={() => navigate("/login")}>Solicitar acesso empresarial <ArrowUpRight size={15}/></button></article>
            </div>
          </section>

          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>CATÁLOGO DE DEMONSTRAÇÃO</span><h2>Conteúdos e possibilidades de licença.</h2></div><Badge variant="warning">Dados ilustrativos</Badge></div>
            <div className={styles.storyTable}>
              <div className={styles.tableHeader}><span>CONTEÚDO</span><span>TITULAR</span><span>ESCOPO</span><span>VALOR</span><span>STATUS</span></div>
              {sampleStories.map(story => <div className={styles.storyRow} key={story.id}><div className={styles.storyTitle}><FileText size={18}/><span><strong>{story.title}</strong><small>{story.id} · {story.type}</small></span></div><span className={styles.publisher}>{story.publisher}</span><span className={styles.scope}>{story.scope}</span><strong className={styles.price}>{story.price}</strong><Badge variant={story.status === "Licenciável" ? "success" : "warning"}>{story.status}</Badge></div>)}
            </div>
            <p className={styles.demoDisclaimer}>Os exemplos acima são fictícios e não representam ofertas reais. O catálogo comercial será preenchido por titulares verificados.</p>
          </section>
        </>}

        {section === "conteudos" && <section className={styles.contentPage}><span className={styles.eyebrow}>BIBLIOTECA EDITORIAL</span><h1>Seus conteúdos</h1><p>Cadastre matérias, fotografias e vídeos e acompanhe a análise de titularidade.</p><div className={styles.emptyState}><FileImage size={34}/><h3>Seu catálogo começa aqui</h3><p>O cadastro de conteúdo será liberado após entrar e concluir o perfil de titularidade.</p><Button onClick={() => navigate("/login")}>Entrar para continuar</Button></div></section>}
        {section === "licencas" && <section className={styles.contentPage}><span className={styles.eyebrow}>AUTORIZAÇÕES E CONTRATOS</span><h1>Central de licenças</h1><p>Solicitações, aprovações, pagamentos e documentos digitais em um único lugar.</p><div className={styles.emptyState}><FileCheck2 size={34}/><h3>Nenhuma licença vinculada</h3><p>Entre na plataforma para consultar solicitações e autorizações da sua conta.</p><Button onClick={() => navigate("/login")}>Acessar licenças</Button></div></section>}
        {section === "financeiro" && <section className={styles.contentPage}><span className={styles.eyebrow}>TRANSPARÊNCIA FINANCEIRA</span><h1>Financeiro</h1><p>Visualize valores brutos, taxa de serviço, saldo e repasses aos titulares.</p><div className={styles.feePanel}><CircleDollarSign size={28}/><strong>85% titular · 15% plataforma</strong><span>Comissão calculada após confirmação do pagamento. Repasses sujeitos à configuração do provedor e validações cadastrais.</span></div></section>}
        {section === "api" && <section className={styles.contentPage}><span className={styles.eyebrow}>INTEGRAÇÃO PARA EMPRESAS</span><h1>API Licença News</h1><p>Verifique disponibilidade, solicite uma licença e valide a autorização antes de utilizar o conteúdo.</p><div className={styles.apiPreview}><div><Badge variant="success">API REST</Badge><code>POST /api/v1/licenses/request</code></div><div><Badge variant="outline">VERIFICAÇÃO</Badge><code>GET /api/v1/licenses/verify/:licenseId</code></div><div><Badge variant="outline">CATÁLOGO</Badge><code>GET /api/v1/content/search</code></div></div><Button onClick={() => navigate("/login")}>Solicitar credenciais de API</Button></section>}
        {section === "como-funciona" && <section className={styles.contentPage}><span className={styles.eyebrow}>PROCESSO DE LICENCIAMENTO</span><h1>Autorização clara, do início ao fim.</h1><div className={styles.steps}><div><span>01</span><h3>Cadastro e titularidade</h3><p>O titular identifica o conteúdo e apresenta declaração e evidências de que pode licenciá-lo.</p></div><div><span>02</span><h3>Escopo da licença</h3><p>Define finalidade, prazo, território, modalidades de uso e preço.</p></div><div><span>03</span><h3>Solicitação e aceite</h3><p>A empresa solicita a licença e aceita os termos específicos daquela utilização.</p></div><div><span>04</span><h3>Pagamento e emissão</h3><p>Após a aprovação dos direitos e confirmação do pagamento, a licença é emitida e verificável.</p></div></div><div className={styles.importantNote}><ShieldCheck size={20}/><p><strong>Pagamento não substitui autorização.</strong> Uma licença só fica ativa quando a titularidade foi aprovada, o escopo foi aceito e o pagamento foi confirmado.</p></div></section>}

        <footer className={styles.footer}><span>© 2026 Licença News</span><span>Infraestrutura independente de licenciamento jornalístico</span><span>Privacidade · Termos · Direitos autorais</span></footer>
      </main>
    </div>
  );
}