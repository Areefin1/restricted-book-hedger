import type { ReactNode } from 'react'
import type { Metadata, Scenario } from '../../api/types'
import { AdvancedFields, Field } from '../../components/SimulationForm'
import { Segmented } from '../../components/ui'
import { GLOSSARY } from '../../glossary'
import { CUSTOM_SCENARIO, DEFAULT_FORM, applyScenario, parseAmount, type FormErrors, type SimForm } from './formModel'

interface Props {
  form: SimForm
  errors: FormErrors
  onChange: (next: SimForm) => void
  scenarios: Scenario[] | undefined
  meta: Metadata | undefined
  /** Effective range and run status, shown under the inputs. */
  status?: ReactNode
}

/** An input that sits inside the setup sentence and grows with its value. */
function Chip({ label, value, error, prefix, suffix, onChange, onBlur }: {
  label: string
  value: string
  error?: string
  prefix?: string
  suffix?: string
  onChange: (v: string) => void
  onBlur?: () => void
}) {
  return (
    <span className={`chip-input ${error ? 'invalid' : ''}`} title={label}>
      {prefix && <span aria-hidden="true">{prefix}</span>}
      <input
        aria-label={label}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        aria-invalid={!!error}
        aria-describedby={error ? 'setup-errors' : undefined}
        style={{ width: `${Math.max(value.length, 2) + 0.5}ch` }}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {suffix && <span aria-hidden="true">{suffix}</span>}
    </span>
  )
}

export function SetupSentence({ form, errors, onChange, scenarios, meta, status }: Props) {
  const set = (patch: Partial<SimForm>) => onChange({ ...form, ...patch })
  const setDate = (patch: Partial<SimForm>) => set({ ...patch, scenarioId: CUSTOM_SCENARIO })
  const activeScenario = scenarios?.find((s) => s.id === form.scenarioId)
  const book = parseAmount(form.bookSize)
  // Date and advanced fields show their own messages; only point to them.
  const messages = [errors.bookSize, errors.hedgeRatio, errors.borrowRatePct].filter((m): m is string => !!m)
  const sentenceKeys = ['bookSize', 'hedgeRatio', 'borrowRatePct', 'startDate', 'endDate']
  if (Object.keys(errors).some((k) => !sentenceKeys.includes(k))) messages.push('Check the research assumptions below.')

  return (
    <section className="setup" aria-label="Simulation setup">
      <p className="setup-sentence">
        Hedging a
        <Chip
          label="HYG proxy book size"
          prefix="$"
          value={form.bookSize}
          error={errors.bookSize}
          onChange={(v) => set({ bookSize: v })}
          onBlur={() => {
            if (Number.isFinite(book)) set({ bookSize: book.toLocaleString('en-US') })
          }}
        />
        book with a
        <Chip label="Hedge ratio" value={form.hedgeRatio} error={errors.hedgeRatio} onChange={(v) => set({ hedgeRatio: v })} />
        hedge ratio and a
        <Chip label="Borrow rate" suffix="%" value={form.borrowRatePct} error={errors.borrowRatePct} onChange={(v) => set({ borrowRatePct: v })} />
        borrow rate.
      </p>

      {messages.length > 0 && (
        <ul className="setup-errors" id="setup-errors" aria-live="polite">
          {messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      <div className="setup-window">
        <span className="setup-label">Window</span>
        <Segmented
          ariaLabel="Scenario preset"
          value={form.scenarioId}
          options={[
            ...(scenarios ?? []).map((s) => ({ value: s.id, label: s.name, title: `${s.start_date} → ${s.end_date}` })),
            { value: CUSTOM_SCENARIO, label: 'Custom' },
          ]}
          onChange={(id) => {
            const s = scenarios?.find((x) => x.id === id)
            if (s) onChange(applyScenario(form, s))
            else set({ scenarioId: CUSTOM_SCENARIO })
          }}
        />
      </div>

      {form.scenarioId === CUSTOM_SCENARIO ? (
        <div className="setup-dates">
          <Field id="start" label="Start date" tip={GLOSSARY.dateRange} error={errors.startDate}>
            <input id="start" type="date" value={form.startDate} min={meta?.first_date} max={meta?.last_date}
              aria-invalid={!!errors.startDate} aria-describedby="start-msg" onChange={(e) => setDate({ startDate: e.target.value })} />
          </Field>
          <Field id="end" label="End date" error={errors.endDate}>
            <input id="end" type="date" value={form.endDate} min={meta?.first_date} max={meta?.last_date}
              aria-invalid={!!errors.endDate} aria-describedby="end-msg" onChange={(e) => setDate({ endDate: e.target.value })} />
          </Field>
        </div>
      ) : (
        activeScenario && <p className="scenario-note">{activeScenario.rule}</p>
      )}

      <div className="setup-meta">
        {status}
        <button type="button" className="link-btn" onClick={() => onChange(DEFAULT_FORM)}>
          Reset
        </button>
      </div>

      <AdvancedFields form={form} errors={errors} onChange={onChange} className="setup-more" />
    </section>
  )
}
