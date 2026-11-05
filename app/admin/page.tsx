export default function Admin() {
  return (
    <>
      <header className="admin-header">
        <a href="/" className="brand-text">
          CHICO BURGUER
        </a>
        <div>
          <a href="/">Ver cardápio ↗</a>
          <button className="outline-button" id="logout" hidden>
            Sair
          </button>
        </div>
      </header>
      <main className="admin-body">
        <div id="admin-root">
          <p className="small-note">Abrindo área da equipe…</p>
        </div>
      </main>
      <script src="/admin.js" defer />
    </>
  );
}
