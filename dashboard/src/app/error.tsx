"use client"
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-lg p-10"><h1 className="text-2xl font-semibold">We couldn’t load this page</h1><p className="my-5 text-slate-500">Check your connection and try again.</p><button className="rounded-xl bg-[#185079] px-5 py-3 text-white" onClick={reset}>Try again</button></main>
}
