export default function Home() {
  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">Phase 1 Infrastructure</p>
        <h1>Energy Copilot AI</h1>
        <p className="lead">
          Frontend запущен. Локальная инфраструктура готова для следующей проверки.
        </p>
      </section>

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(body) {
          margin: 0;
          background: #111113;
          color: #f0ede8;
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
            "Segoe UI", sans-serif;
        }

        .page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .card {
          width: min(100%, 720px);
          border: 1px solid rgba(255, 122, 24, 0.45);
          border-radius: 24px;
          padding: clamp(28px, 6vw, 56px);
          background: #171719;
        }

        .eyebrow {
          margin: 0 0 14px;
          color: #ff7a18;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          font-size: clamp(36px, 8vw, 72px);
          line-height: 0.95;
        }

        .lead {
          max-width: 560px;
          margin: 24px 0 0;
          color: rgba(240, 237, 232, 0.78);
          font-size: clamp(16px, 2.5vw, 20px);
          line-height: 1.6;
        }
      `}</style>
    </main>
  );
}
