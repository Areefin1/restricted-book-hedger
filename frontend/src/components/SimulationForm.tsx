import type { ReactNode } from 'react'
import type { Metadata, Scenario } from '../api/types'
import { CUSTOM_SCENARIO, DEFAULT_FORM, applyScenario, parseAmount, type FormErrors, type SimForm } from '../features/simulator/formModel'
import { fmtUsd } from '../format'
import { GLOSSARY } from '../glossary'
import { InfoTip, Segmented } from './ui'

interface Props {
  form: SimForm
  errors: FormErrors
  onChange: (next: SimForm) => void
  scenarios: Scenario[] | undefined
  meta: Metadata | undefined
  /** Fields the current view uses; others are hidden. */
  fields?: { book?: boolean; ratio?: boolean; borrow?: boolean }
}

function Field({
  id,
  label,
  tip,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  tip?: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className={`field ${error ? 'invalid' : ''}`}>
      <div className="field-label">
        <label htmlFor={id}>{label}</label>
        {tip && <InfoTip text={tip} label={`About ${label}`} />}
      </div>
      {children}
      <div className="field-msg" id={`${id}-msg`} aria-live="polite">
        {error ?? hint ?? ''}
      </div>
    </div>
  )
}

export function SimulationForm({ form, errors, onChange, scenarios, meta, fields = { book: true, ratio: true, borrow: true } }: Props) {
  const set = (patch: Partial<SimForm>) => onChange({ ...form, ...patch })
  const setDate = (patch: Partial<SimForm>) => set({ ...patch, scenarioId: CUSTOM_SCENARIO })
  const activeScenario = scenarios?.find((s) => s.id === form.scenarioId)
  const book = parseAmount(form.bookSize)
  const ratioNum = Number(form.hedgeRatio)

  const scenarioOptions = [
    ...(scenarios ?? []).map((s) => ({ value: s.id, label: s.name, title: `${s.start_date} → ${s.end_date}` })),
    { value: CUSTOM_SCENARIO, label: 'Custom' },
  ]

  return (
    <form className="sim-form" onSubmit={(e) => e.preventDefault()} aria-label="Portfolio controls" noValidate>
      <div className="sim-form-top">
        <div className="scenario-picker">
          <span className="eyebrow">Historical window</span>
          <Segmented
            ariaLabel="Scenario preset"
            value={form.scenarioId}
            options={scenarioOptions}
            onChange={(id) => {
              const s = scenarios?.find((x) => x.id === id)
              if (s) onChange(applyScenario(form, s))
              else set({ scenarioId: CUSTOM_SCENARIO })
            }}
          />
        </div>
        <button type="button" className="btn ghost" onClick={() => onChange(DEFAULT_FORM)}>
          Reset
        </button>
      </div>
      <p className="scenario-note">
        {activeScenario ? (
          <>
            <span className="badge">Preset rule</span> {activeScenario.rule}
          </>
        ) : (
          'Custom range. Choose any dates within the available history.'
        )}
      </p>

      <div className="sim-form-grid">
        <Field id="start" label="Start date" tip={GLOSSARY.dateRange} error={errors.startDate}>
          <input
            id="start"
            type="date"
            value={form.startDate}
            min={meta?.first_date}
            max={meta?.last_date}
            aria-invalid={!!errors.startDate}
            aria-describedby="start-msg"
            onChange={(e) => setDate({ startDate: e.target.value })}
          />
        </Field>
        <Field id="end" label="End date" error={errors.endDate}>
          <input
            id="end"
            type="date"
            value={form.endDate}
            min={meta?.first_date}
            max={meta?.last_date}
            aria-invalid={!!errors.endDate}
            aria-describedby="end-msg"
            onChange={(e) => setDate({ endDate: e.target.value })}
          />
        </Field>

        {fields.book && (
          <Field
            id="book"
            label="Book size"
            tip={GLOSSARY.bookSize}
            error={errors.bookSize}
            hint={Number.isFinite(book) ? fmtUsd(book) : undefined}
          >
            <div className="input-affix">
              <span aria-hidden="true">$</span>
              <input
                id="book"
                inputMode="decimal"
                autoComplete="off"
                value={form.bookSize}
                aria-invalid={!!errors.bookSize}
                aria-describedby="book-msg"
                onChange={(e) => set({ bookSize: e.target.value })}
                onBlur={() => {
                  if (Number.isFinite(book)) set({ bookSize: book.toLocaleString('en-US') })
                }}
              />
            </div>
          </Field>
        )}

        {fields.ratio && (
          <Field
            id="ratio"
            label="Hedge ratio"
            tip={GLOSSARY.hedgeRatio}
            error={errors.hedgeRatio}
            hint={Number.isFinite(book) && Number.isFinite(ratioNum) ? `${fmtUsd(book * ratioNum)} hedge notional` : undefined}
          >
            <div className="ratio-input">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={Number.isFinite(ratioNum) ? Math.min(1, Math.max(0, ratioNum)) : 0}
                aria-label="Hedge ratio slider"
                onChange={(e) => set({ hedgeRatio: e.target.value })}
              />
              <input
                id="ratio"
                className="num"
                inputMode="decimal"
                value={form.hedgeRatio}
                aria-invalid={!!errors.hedgeRatio}
                aria-describedby="ratio-msg"
                onChange={(e) => set({ hedgeRatio: e.target.value })}
              />
            </div>
          </Field>
        )}

        {fields.borrow && (
          <Field id="borrow" label="Borrow rate" tip={GLOSSARY.borrowRate} error={errors.borrowRatePct} hint="Annual, static short only">
            <div className="input-affix suffix">
              <input
                id="borrow"
                inputMode="decimal"
                value={form.borrowRatePct}
                aria-invalid={!!errors.borrowRatePct}
                aria-describedby="borrow-msg"
                onChange={(e) => set({ borrowRatePct: e.target.value })}
              />
              <span aria-hidden="true">%</span>
            </div>
          </Field>
        )}
      </div>
    </form>
  )
}
