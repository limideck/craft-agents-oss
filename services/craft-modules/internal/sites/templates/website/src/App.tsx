export default function App() {
  return (
    <div className="min-h-screen bg-white text-stone-900">
      <header className="border-b border-stone-200 px-6 py-4 flex items-center justify-between">
        <strong className="tracking-tight">Site</strong>
        <nav className="flex gap-4 text-sm text-stone-600">
          <a href="#about">About</a>
          <a href="#work">Work</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>
      <main>
        <section className="px-6 py-20 max-w-4xl mx-auto">
          <h1 className="text-4xl font-semibold tracking-tight">A simple website</h1>
          <p className="mt-4 text-stone-600 max-w-2xl">
            Multi-section scaffold for marketing or company sites. Edit sections in App.tsx.
          </p>
        </section>
        <section id="about" className="bg-stone-50 px-6 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-medium">About</h2>
            <p className="mt-3 text-stone-600">Tell your story here.</p>
          </div>
        </section>
        <section id="work" className="px-6 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-medium">Work</h2>
            <p className="mt-3 text-stone-600">Highlight projects or products.</p>
          </div>
        </section>
        <section id="contact" className="bg-stone-900 text-stone-50 px-6 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-medium">Contact</h2>
            <p className="mt-3 text-stone-300">hello@example.com</p>
          </div>
        </section>
      </main>
    </div>
  )
}
