'use client'

import { Database, ExternalLink, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function FirestoreSetupScreen({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-background p-4">
      <Card className="max-w-2xl w-full p-8 sm:p-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Enable Firestore Database</h1>
            <p className="text-sm text-muted-foreground">One-time setup in your Firebase project</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          This planner is connected to your Firebase project{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">etsy-229e5</code>, but the
          Firestore database hasn&apos;t been created yet. Follow these steps — it takes about a minute.
        </p>

        <ol className="space-y-4 mb-8">
          {[
            {
              title: 'Open the Firebase Console',
              body: 'Go to your project and select “Firestore Database” from the left menu.',
              link: 'https://console.firebase.google.com/project/etsy-229e5/firestore',
              linkText: 'Open Firestore for etsy-229e5',
            },
            {
              title: 'Click “Create database”',
              body: 'Choose a location close to you, then start in “Test mode” so the app can read & write while you evaluate it.',
            },
            {
              title: 'Wait ~1 minute for it to provision',
              body: 'Then come back here and click “I’ve enabled it — retry”. Your sample data will load automatically.',
            },
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                {i + 1}
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="font-medium text-sm">{step.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{step.body}</p>
                {step.link && (
                  <a
                    href={step.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {step.linkText}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button onClick={onRetry} disabled={retrying} className="w-full sm:w-auto gap-2">
            {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {retrying ? 'Checking…' : "I've enabled it — retry"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Already enabled? It can take a minute to propagate.
          </p>
        </div>
      </Card>
    </div>
  )
}
