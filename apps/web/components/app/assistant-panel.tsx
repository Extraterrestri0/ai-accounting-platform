'use client';

/**
 * AI Accountant panel (Module 11, Phase 1 — ADR-001). READ-ONLY: fixed question chips
 * (no free chat), grounded answers with mandatory citations, confidence and an
 * llmUsed indicator. Citations deep-link into the existing screens; rule-card citations
 * show their legal reference and an "awaiting accountant review" badge when pending.
 */
import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Sparkles, Loader2, BookOpen, AlertTriangle } from 'lucide-react';
import { Endpoints, type AssistantAnswer, type AssistantCitation } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfidenceBadge } from '@/components/app/confidence';

interface Props {
  surface: 'vat' | 'invoice' | 'reports' | 'dashboard';
  context?: { documentId?: string; year?: number; month?: number };
}

export function AssistantPanel({ surface, context }: Props) {
  const questionsQ = useQuery({
    queryKey: ['assistantQuestions', surface],
    queryFn: () => Endpoints.assistantQuestions(surface).catch(() => []),
    staleTime: 5 * 60 * 1000,
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
  if (!questionsQ.isLoading && questions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> AI счетоводител
        </CardTitle>
        <CardDescription>Обяснява с данни от системата — само чете, нищо не променя. Решенията остават ваши.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          {questions.map((q) => (
            <Button key={q.key} size="sm" variant={activeKey === q.key ? 'default' : 'outline'}
              disabled={ask.isPending}
              onClick={() => ask.mutate(q.key)}>
              {ask.isPending && activeKey === q.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {q.labelBg}
            </Button>
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft p-2.5 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" /> {error}
          </div>
        )}

        {answer && (
          <div className="space-y-2 rounded-md border border-border bg-secondary/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                {answer.abstained
                  ? <Badge variant="neutral">Без отговор</Badge>
                  : <ConfidenceBadge value={answer.confidence} />}
                <Badge variant={answer.llmUsed ? 'default' : 'neutral'}>{answer.llmUsed ? 'AI текст' : 'детерминистичен'}</Badge>
              </span>
            </div>
            <p className="whitespace-pre-line leading-relaxed text-foreground">{answer.answer}</p>
            {answer.citations.length > 0 && (
              <div className="space-y-1 border-t border-border pt-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Източници</p>
                <div className="flex flex-wrap gap-1.5">
                  {answer.citations.map((c, i) => <CitationChip key={i} c={c} />)}
                </div>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">Информативно обяснение върху ваши данни — не е данъчна консултация. Проверете преди решение.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CitationChip({ c }: { c: AssistantCitation }) {
  const inner = (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground">
      {c.type === 'rule_card' ? <BookOpen className="h-3 w-3" /> : null}
      {c.label}
      {c.ruleCard?.reviewPending && <Badge variant="warning" className="ml-1 px-1 py-0 text-[10px]">очаква преглед</Badge>}
    </span>
  );
  if (c.type === 'rule_card') {
    return <span title={`${c.ruleCard?.legalReference ?? ''} (v${c.ruleCard?.version ?? '1'})`}>{inner}</span>;
  }
  return c.href ? <Link href={c.href}>{inner}</Link> : inner;
}
