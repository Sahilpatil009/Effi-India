import Link from "next/link"
import { getCurrentUser, isAdminEmail } from "@/lib/dashboard/auth"
import { signOut } from "@/app/actions"

export async function CitizenShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  const admin = user ? await isAdminEmail(user.email) : false
  return <div className="min-h-screen bg-[#f4f7f9] text-slate-800">
    <header className="border-b bg-white"><nav aria-label="Main navigation" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
      <Link href="/" className="text-xl font-bold tracking-tight text-[#185079]">Effi India<span className="ml-2 text-orange-500">·</span></Link>
      <div className="flex flex-wrap items-center gap-5 text-sm font-medium">
        <Link href="/">Report an issue</Link><Link href="/requests">My requests</Link>
        {admin && <Link href="/admin">Admin dashboard</Link>}
        {user ? <form action={signOut}><button className="cursor-pointer text-slate-500">Sign out</button></form> : <Link href="/login">Sign in</Link>}
      </div>
    </nav></header>
    <main className="mx-auto max-w-6xl px-6 py-10 sm:py-16">{children}</main>
    <footer className="mx-auto max-w-6xl px-6 py-8 text-xs text-slate-500">Effi India · Civic complaint assistant · College project demonstration</footer>
  </div>
}
