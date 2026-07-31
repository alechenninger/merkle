import { useMemo, useState } from 'react'
import { INITIAL_LOG_EVENTS, LOG_KIND_OPTIONS } from '../../demoData'
import { buildLogView, eventTimestamp, measureLogProof } from '../../domain/log'

export type LogDemoModel = ReturnType<typeof useLogDemo>

export function useLogDemo() {
  const [events, setEvents] = useState(INITIAL_LOG_EVENTS)
  const [selectedIndex, setSelectedIndex] = useState(1)
  const [newEventKind, setNewEventKind] = useState(LOG_KIND_OPTIONS[0])
  const [newEventActor, setNewEventActor] = useState('Mina')
  const [newEventDetail, setNewEventDetail] = useState('')

  const view = useMemo(() => buildLogView(events, selectedIndex), [events, selectedIndex])
  const selectedEvent = events[view.selectedIndex]
  const proofSize = useMemo(() => measureLogProof(selectedEvent, view.proof), [selectedEvent, view.proof])
  const proofNodeKeys = useMemo(() => new Set(view.proof.map((step) => `${step.sibling.start}-${step.sibling.end}`)), [view.proof])

  const appendEvent = () => {
    const detail = newEventDetail.trim()
    const actor = newEventActor.trim()
    if (!detail || !actor) {
      return
    }
    const nextEvent = {
      id: `evt_${String(events.length + 1).padStart(3, '0')}`,
      kind: newEventKind,
      actor,
      detail,
      timestamp: eventTimestamp(events.length),
    }
    setEvents((currentEvents) => [...currentEvents, nextEvent])
    setSelectedIndex(events.length)
    setNewEventDetail('')
  }

  const reset = () => {
    setEvents(INITIAL_LOG_EVENTS)
    setSelectedIndex(1)
    setNewEventKind(LOG_KIND_OPTIONS[0])
    setNewEventActor('Mina')
    setNewEventDetail('')
  }

  return {
    events,
    selectedIndex: view.selectedIndex,
    selectedEvent,
    view,
    proofSize,
    proofNodeKeys,
    kindOptions: LOG_KIND_OPTIONS,
    newEventKind,
    newEventActor,
    newEventDetail,
    setSelectedIndex,
    setNewEventKind,
    setNewEventActor,
    setNewEventDetail,
    appendEvent,
    reset,
  }
}