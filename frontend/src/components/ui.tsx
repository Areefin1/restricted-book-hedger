// Small shared presentational components.

import { useId, type ReactNode } from 'react'

export function InfoTip({ text, label = 'More information' }: { text: string; label?: string }) {
  const id = useId()
  return (
    <span className="infotip">
      <button type="button" className="infotip-btn" aria-label={label} aria-describedby={id}>
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 7v4.2M8 4.6v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <span role="tooltip" id={id} className="infotip-body">
        {text}
      </span>
    </span>
  )
}

interface PanelProps {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function Panel({ title, subtitle, actions, children, className }: PanelProps) {
  return (
    <section className={`panel ${className ?? ''}`}>
      <header className="panel-head">
        <div>
          <h2 className="panel-title">{title}</h2>
          {subtitle && <p className="panel-sub">{subtitle}</p>}
        </div>
        {actions && <div className="panel-actions">{actions}</div>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  )
}

interface SegmentedProps<T extends string | number> {
  value: T
  options: { value: T; label: string; title?: string }[]
  onChange: (v: T) => void
  ariaLabel: string
  size?: 'sm' | 'md'
}

export function Segmented<T extends string | number>({ value, options, onChange, ariaLabel, size = 'md' }: SegmentedProps<T>) {
  return (
    <div className={`segmented ${size}`} role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'active' : ''}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state error" role="alert">
      <strong>Could not load results.</strong>
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state empty">
      <strong>{title}</strong>
      {children && <span>{children}</span>}
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warn' | 'accent' }) {
  return <span className={`badge ${tone}`}>{children}</span>
}
