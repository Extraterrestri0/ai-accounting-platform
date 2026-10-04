import * as React from 'react';
import { cn } from '@/lib/utils';
import { inputClass } from './input';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(inputClass, 'h-auto min-h-[88px] py-2 leading-relaxed', className)} {...props} />
  ),
);
Textarea.displayName = 'Textarea';
export { Textarea };
