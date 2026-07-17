export default function App() {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto max-w-3xl px-6 py-24 text-center space-y-6">
        <p className="text-sm uppercase tracking-[0.2em] text-amber-400">Launch</p>
        <h1 className="text-5xl font-semibold tracking-tight">Ship your next idea</h1>
        <p className="text-lg text-stone-300">
          A minimal landing page scaffold. Replace this copy and wire your CTA.
        </p>
        <a
          href="#cta"
          className="inline-block rounded-md bg-amber-400 px-5 py-2.5 text-stone-950 font-medium"
        >
          Get started
        </a>
      </section>
      <section id="cta" className="border-t border-stone-800 px-6 py-16 text-center">
        <h2 className="text-2xl font-medium">Ready when you are</h2>
      </section>
    </main>
  )
}
