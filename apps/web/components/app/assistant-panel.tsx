'use client';

/**
 * AI Accountant panel (Module 11, Phase 1 — ADR-001). READ-ONLY: fixed question
 * playbooks (no free chat), grounded answers with mandatory citations, confidence
 * and an llmUsed indicator. Citations deep-link into the existing screens.
 * Nothing here can post, approve, lock or file.
 */
import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Sparkles, Loader2, BookOpen, AlertTriangle, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Endpoints, type AssistantAnswer, type AssistantCitation } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConfidenceBadge } from '@/components/app/confidence';
import { cn } from '@/lib/utils';

interface Props {
  surface: 'vat' | 'invoice' | 'reports' | 'dashboard';
  context?: { documentId?: string; year?: number; month?: number };
  /** Render without the outer card (for the /assistant page). */
  bare?: boolean;
}

/** Minimal, safe rendering of the answer text: bold (**x**) and line breaks only. */
function AnswerText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-foreground">
      {parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>))}
    </p>
  );
}

export function AssistantPanel({ surface, context, bare }: Props) {
  const questionsQ = useQuery({
    queryKey: ['assistantQuestions', surface],
    queryFn: () => Endpoints.assistantQuestions(surface),
    staleTime: 5 * 60 * 1000,
    retry: 0,
  });
  const [answer, setAnswer] = React.useState<AssistantAnswer | null>(null);
  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const ask = useMutation({
    mutationFn: (key: string) => Endpoints.assistantAsk({ question: { kind: 'key', key }, context }),
    onMutate: (key) => { setActiveKey(key); setError(null); },
    onSuccess: (a) => setAnswer(a),
    onError: (e) => { setAnswer(null); setError(e instanceof ApiError ? e.message : 'Грешка — опитайте отново.'); },
  });

  const questions = questionsQ.data ?? [];
  const activeLabel = questions.find((q) => q.key === activeKey)?.labelBg;
  if (!bare && !questionsQ.isLoading && questions.length === 0 && !questionsQ.isError) return null;

  const body = (
    <div className="space-y-4">
      {questionsQ.isError ? (
        <p className="text-[13px] text-muted-foreground">Асистентът не е наличен в момента.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {questions.map((q) => (
            <button
              key={q.key}
              type="button"
              disabled={ask.isPending}
              onClick={() => ask.mutate(q.key)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
                activeKey === q.key ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground hover:border-border-strong hover:bg-accent',
              )}
            >
              {ask.isPending && activeKey === q.key && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {q.labelBg}
            </button>
          ))}
          {questionsQ.isLoading && [0, 1, 2].map((i) => <span key={i} className="skeleton h-8 w-40 rounded-full" />)}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-warning/25 bg-warning-soft px-3 py-2.5 text-xs text-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" /> {error}
        </div>
      )}

      {answer && (
        <div className="rounded-lg border border-border">
          {/* Question */}
          <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2 px-4 py-2.5">
            <p className="text-[13px] font-medium text-foreground">{activeLabel}</p>
            <div className="flex items-center gap-2">
              {answer.abstained ? <Badge variant="neutral">Без отговор</Badge> : <ConfidenceBadge value={answer.confidence} />}
              <Badge variant={answer.llmUsed ? 'info' : 'outline'}>{answer.llmUsed ? 'AI текст' : 'детерминистичен'}</Badge>
            </div>
          </div>
          {/* Answer */}
          <div className="px-4 py-3.5">
            <AnswerText text={answer.answer} />
          </div>
          {/* Sources */}
          {answer.citations.length > 0 && (
            <div className="border-t border-border px-4 py-3">
              <p className="t-overline mb-2">Източници</p>
              <div className="flex flex-wrap gap-1.5">
                {answer.citations.map((c, i) => <CitationChip key={i} c={c} />)}
              </div>
            </div>
          )}
          <div className="flex items-center gap-1.5 border-t border-border px-4 py-2 text-2xs text-faint">
            <ShieldCheck className="h-3.5 w-3.5" /> Информативно обяснение върху вашите данни — не е данъчна консултация. Асистентът само чете; решенията остават ваши.
          </div>
        </div>
      )}
    </div>
  );

  if (bare) return body;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand" /> AI счетоводител</CardTitle>
        <CardDescription>Отговаря с цитати от вашите данни. Само чете — нищо не променя.</CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}

function CitationChip({ c }: { c: AssistantCitation }) {
  const inner = (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground transition-colors hover:bg-accent">
      {c.type === 'rule_card' ? <BookOpen className="h-3 w-3 text-faint" /> : <ArrowUpRight className="h-3 w-3 text-faint" />}
      {c.label}
      {c.ruleCard?.reviewPending && <Badge variant="warning" className="px-1.5">очаква преглед</Badge>}
    </span>
  );
  if (c.type === 'rule_card') {
    return <span title={`${c.ruleCard?.legalReference ?? ''} (v${c.ruleCard?.version ?? '1'})`}>{inner}</span>;
  }
  return c.href ? <Link href={c.href}>{inner}</Link> : inner;
}
