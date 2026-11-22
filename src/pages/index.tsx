/**
 * Landing page: static and prerendered (no auth call, no realtime), so it is
 * cheap to serve and readable without JavaScript. Explains the product in
 * one screen and sends people into the app.
 */

import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, FileText, Search, SlidersHorizontal } from 'lucide-react'
import { Seo } from '../components/Seo'
import { APP_NAME } from '../constants'
import { seo } from '../seo'

const STEPS = [
  {
    icon: Search,
    title: 'Research with receipts',
    body: 'For each option, Decision Desk reads the official site, picks one plan, and fills one cell per criterion with a quote from the page.',
  },
  {
    icon: BadgeCheck,
    title: 'Quotes are checked in code',
    body: 'Every quote is matched against the page text. If the AI’s quote isn’t there, the cell says “Needs checking”, not “Verified”.',
  },
  {
    icon: SlidersHorizontal,
    title: 'You review and weigh',
    body: 'Correct any cell, flag what you doubt, and set how much each criterion matters. The ranking updates as you go.',
  },
  {
    icon: FileText,
    title: 'Decide and share',
    body: 'Freeze the table with a short brief where every fact links to its source. Share a read-only link or email it to your team.',
  },
]

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="min-h-screen bg-background text-foreground">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <span className="font-semibold">{APP_NAME}</span>
          <Link to="/home" className="text-sm text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
        </header>

        <main className="mx-auto max-w-5xl px-6 pb-24">
          <section className="grid items-center gap-12 py-16 md:grid-cols-[1.1fr_1fr]">
            <div className="flex flex-col gap-6">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Decide with evidence, not vibes.</h1>
              <p className="text-lg text-muted-foreground">
                Comparing tools for your team? Name two or three options and what matters. You get a comparison table
                where every cell quotes its source, and you stay in charge of the conclusion.
              </p>
              <div>
                <Link
                  to="/home"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Open {APP_NAME} <ArrowRight className="size-4" />
                </Link>
                <p className="mt-3 text-xs text-muted-foreground">
                  After signing in, “Try a ready-made example” opens a researched comparison instantly.
                </p>
              </div>
            </div>

            {/* A static picture of one row of the table: what the product produces. */}
            <figure aria-label="Example comparison row" className="rounded-xl border border-border bg-card p-5 text-sm shadow-sm">
              <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Price for 3 agents · weight 5</p>
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Help Scout</span>
                    <span className="rounded-full bg-success px-2 py-px text-[10px] text-success-foreground">Quote verified</span>
                    <span className="text-xs text-muted-foreground">4/5</span>
                  </div>
                  <p className="mt-1">$90/month on Standard (3 × $30)</p>
                  <blockquote className="mt-1 border-l-2 border-border pl-2 text-xs italic text-muted-foreground">
                    “$30 per user/mo, billed monthly” · helpscout.com
                  </blockquote>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Zendesk</span>
                    <span className="rounded-full border border-border px-2 py-px text-[10px]">Corrected by you</span>
                    <span className="text-xs text-muted-foreground">2/5</span>
                  </div>
                  <p className="mt-1">$165/month on Suite Team, over budget</p>
                  <p className="mt-1 text-xs text-muted-foreground">The AI used a cheaper plan’s price; you fixed it.</p>
                </div>
              </div>
            </figure>
          </section>

          <section aria-labelledby="how" className="border-t border-border pt-12">
            <h2 id="how" className="mb-8 text-2xl font-semibold">How it works</h2>
            <ol className="grid gap-6 sm:grid-cols-2">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-medium">
                      {i + 1}. {title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <p className="mt-16 text-xs text-muted-foreground">
            The AI drafts; it can be wrong. “Quote verified” means the quote is on the page, not that the summary is
            right, which is why every cell shows its evidence.
          </p>
        </main>
      </div>
    </>
  )
}
