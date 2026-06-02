/** Bulgarian-first labels (Bulgarian primary, English secondary for the preview). */
export const t = {
  app: 'Счетоводство', appEn: 'Accounting',
  nav: {
    dashboard: 'Табло', documents: 'Документи', extraction: 'Извличане', suggestions: 'Предложения',
    review: 'Преглед', posting: 'Осчетоводяване', vat: 'ДДС', invoices: 'Фактури', reports: 'Отчети',
    accountant: 'Счетоводител', company: 'Фирма',
  },
  widgets: {
    documentsPending: 'Документи за обработка', reviewsPending: 'Чакащи прегледи', invoicesIssued: 'Издадени фактури',
    vatPayable: 'ДДС за внасяне', reportsStatus: 'Статус на отчети', recentActivity: 'Скорошна активност',
  },
} as const;
