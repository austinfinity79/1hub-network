'use client'

import { useState } from 'react'

import { DemoPage } from '@/components/programme-demo/demo-page'
import { useProjectDemo } from '@/components/project-demo/demo-store'
import {
  applicationOf,
  saveAnswers,
  startApplication,
  submitApplication,
  type ApplicationResult,
  type ProjectDemoState,
} from '@/lib/project-demo/application-store'
import type { DemoVentureDetailDTO, VentureContext } from '@/lib/project-demo/types'

/** WF05-T00 dev harness body: drives the real store through its pure transitions. */
export function ProjectDemoHarness({ details }: { details: DemoVentureDetailDTO[] }) {
  const { state, ready, mutate, generation } = useProjectDemo()
  const [last, setLast] = useState('')

  return (
    <DemoPage title="WF05-T00 harness (dev only)">
      <p data-harness-ready={ready ? 'true' : 'false'} data-harness-generation={generation}>
        {details.length} ventures
      </p>
      {details.map((d) => {
        const venture: VentureContext = {
          id: d.venture.id,
          type: d.venture.type,
          status: d.venture.status,
          relation: d.venture.relation,
        }
        return (
          <section
            key={d.venture.id}
            data-harness-venture={d.venture.id}
            data-applicant-type={d.venture.applicant_type}
            data-relation={d.venture.relation}
          >
            <h2>{d.venture.name}</h2>
            {d.programmes.map((p) => {
              const application = applicationOf(state, d.venture.id, p.id)
              const run = (transition: (s: ProjectDemoState) => ApplicationResult) => {
                const result = mutate(transition)
                setLast(result.ok ? 'ok' : result.reason)
              }
              const answers = (fill: (i: number) => string) => p.questions.map((_, i) => fill(i))
              return (
                <div
                  key={p.id}
                  data-harness-programme={p.id}
                  data-eligible={String(p.eligibility.eligible)}
                  data-reason={p.eligibility.eligible ? '' : p.eligibility.reason}
                  data-application={application?.status ?? 'NONE'}
                >
                  <button
                    type="button"
                    data-harness-action="start"
                    onClick={() => run((s) => startApplication(s, venture, p, new Date()))}
                  >
                    start
                  </button>
                  <button
                    type="button"
                    data-harness-action="answer-partial"
                    onClick={() =>
                      run((s) =>
                        saveAnswers(
                          s,
                          venture,
                          p,
                          answers((i) => (i === 0 ? 'Trả lời 1' : '')),
                          new Date(),
                        ),
                      )
                    }
                  >
                    answer partial
                  </button>
                  <button
                    type="button"
                    data-harness-action="answer"
                    onClick={() =>
                      run((s) =>
                        saveAnswers(
                          s,
                          venture,
                          p,
                          answers((i) => `Trả lời ${i + 1}`),
                          new Date(),
                        ),
                      )
                    }
                  >
                    answer
                  </button>
                  <button
                    type="button"
                    data-harness-action="submit"
                    onClick={() => run((s) => submitApplication(s, venture, p, new Date()))}
                  >
                    submit
                  </button>
                </div>
              )
            })}
          </section>
        )
      })}
      <p data-harness-last>{last}</p>
      <pre data-harness-state>{ready ? JSON.stringify(state) : ''}</pre>
    </DemoPage>
  )
}
