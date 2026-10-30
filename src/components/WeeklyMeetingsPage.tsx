import { useEffect, useState } from "react";
import type { WeeklyMeeting } from "../../shared/types.ts";
import { api } from "../api.ts";
import { dateLabel } from "../lib/format.ts";
import { Button, Field, showConfirm, showToast, TextArea, TextInput } from "./ui.tsx";
import { ActionItemsEditor } from "./ActionItemsPanel.tsx";

type DraftAction = { key: number; name: string; description: string };
type MeetingForm = { id: number | null; meetingDate: string; agenda: string; actions: DraftAction[] };
type DraftActionInput = { name: string; description: string };
let nextDraftActionKey = 1;
const localToday = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};
const newMeetingForm = (): MeetingForm => ({ id: null, meetingDate: localToday(), agenda: "", actions: [] });
const blankDraftAction = (): DraftActionInput => ({ name: "", description: "" });

export function WeeklyMeetingsPage() {
  const [meetings, setMeetings] = useState<WeeklyMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meetingForm, setMeetingForm] = useState<MeetingForm | null>(null);
  const [draftAction, setDraftAction] = useState<DraftActionInput>(blankDraftAction);
  const [expandedMeetings, setExpandedMeetings] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    api.getWeeklyMeetings()
      .then((data) => {
        setMeetings(data.meetings);
        if (!data.meetings.length) setMeetingForm(newMeetingForm());
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const apply = async (operation: Promise<{ meetings: WeeklyMeeting[] }>, message: string) => {
    try {
      const data = await operation;
      setMeetings(data.meetings);
      setError(null);
      showToast(message);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  };

  const saveMeeting = async () => {
    if (!meetingForm?.meetingDate || !meetingForm.agenda.trim()) {
      setError("Meeting date and agenda are required.");
      return;
    }
    if (!draftAction.name.trim() && draftAction.description.trim()) {
      setError("A name is required for every action item.");
      return;
    }
    const actions = meetingForm.actions.map(({ name, description }) => ({ name, description }));
    if (draftAction.name.trim()) actions.push({ name: draftAction.name.trim(), description: draftAction.description.trim() });
    const input = { meetingDate: meetingForm.meetingDate, agenda: meetingForm.agenda.trim(), actions };
    const savedMeetingId = meetingForm.id;
    const ok = await apply(
      meetingForm.id === null ? api.createWeeklyMeeting(input) : api.updateWeeklyMeeting(meetingForm.id, input),
      meetingForm.id === null ? "Weekly meeting created." : "Weekly meeting updated.",
    );
    if (ok) {
      setMeetingForm(null);
      setDraftAction(blankDraftAction());
      if (savedMeetingId !== null) {
        setExpandedMeetings((expanded) => {
          const next = new Set(expanded);
          next.delete(savedMeetingId);
          return next;
        });
      }
    }
  };

  const addDraftAction = () => {
    const name = draftAction.name.trim();
    if (!name || !meetingForm) {
      setError("A name is required for every action item.");
      return;
    }
    setMeetingForm({
      ...meetingForm,
      actions: [...meetingForm.actions, { key: nextDraftActionKey++, name, description: draftAction.description.trim() }],
    });
    setDraftAction(blankDraftAction());
    setError(null);
  };

  const openNewMeeting = () => {
    setMeetingForm(newMeetingForm());
    setDraftAction(blankDraftAction());
  };

  const editMeeting = (meeting: WeeklyMeeting) => {
    setMeetingForm({ id: meeting.id, meetingDate: meeting.meetingDate, agenda: meeting.agenda, actions: [] });
    setDraftAction(blankDraftAction());
  };

  const deleteMeeting = async (meeting: WeeklyMeeting) => {
    const confirmed = await showConfirm("Delete weekly meeting?", `${dateLabel(meeting.meetingDate)} and its ${meeting.actions.length} action item(s) will be deleted. The deletion will remain in the audit log.`);
    if (confirmed && await apply(api.removeWeeklyMeeting(meeting.id), "Weekly meeting deleted.")) {
      setExpandedMeetings((expanded) => {
        const next = new Set(expanded);
        next.delete(meeting.id);
        return next;
      });
    }
  };

  const toggleMeeting = (meetingId: number) => {
    setExpandedMeetings((expanded) => {
      const next = new Set(expanded);
      if (next.has(meetingId)) next.delete(meetingId);
      else next.add(meetingId);
      return next;
    });
  };

  if (loading) return <div className="loading">Loading weekly meetings…</div>;

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Weekly Meetings</h1><div className="page-sub">Meeting agendas and accountable action items, newest meeting first.</div></div>
        <Button primary onClick={openNewMeeting}>+ Add weekly meeting</Button>
      </div>

      {error && <div className="notice error"><div><span>{error}</span><button type="button" onClick={() => setError(null)}>Dismiss</button></div></div>}

      {meetingForm && (
        <div className="form-card">
          <div className="form-head">{meetingForm.id === null ? "Add weekly meeting" : "Modify weekly meeting"}</div>
          <div className="form-body">
            <Field label="Meeting date"><TextInput type="date" value={meetingForm.meetingDate} onChange={(meetingDate) => setMeetingForm({ ...meetingForm, meetingDate })} /></Field>
            <Field label="Meeting agenda"><TextArea rows={6} value={meetingForm.agenda} onChange={(agenda) => setMeetingForm({ ...meetingForm, agenda })} /></Field>
            <div className="meeting-draft-actions">
              <div className="eyebrow">Action items</div>
              <div className="page-sub">Add action items now; they will be saved together with the meeting.</div>
              {meetingForm.actions.map((action) => (
                <div key={action.key} className="report-item action-item-row">
                  <div className="dash">—</div>
                  <div>{action.name}{action.description ? `: ${action.description}` : ""}</div>
                  <Button onClick={() => setMeetingForm({ ...meetingForm, actions: meetingForm.actions.filter((item) => item.key !== action.key) })}>Remove</Button>
                </div>
              ))}
              <div className="add-row meeting-draft-action-form">
                <Field label="Name" style={{ flex: 1 }}><TextInput value={draftAction.name} onChange={(name) => setDraftAction({ ...draftAction, name })} /></Field>
                <Field label="Description" style={{ flex: 1.5 }}><TextInput value={draftAction.description} onChange={(description) => setDraftAction({ ...draftAction, description })} /></Field>
                <Button onClick={addDraftAction}>Add action item</Button>
              </div>
            </div>
            <div className="form-actions"><Button onClick={() => { setMeetingForm(null); setDraftAction(blankDraftAction()); }}>Cancel</Button><Button primary onClick={saveMeeting}>Save meeting and action items</Button></div>
          </div>
        </div>
      )}

      <div className="meeting-list">
        {meetings.map((meeting) => (
          <section className="card meeting-card" key={meeting.id}>
            <button
              type="button"
              className="meeting-accordion-trigger"
              aria-expanded={expandedMeetings.has(meeting.id)}
              aria-controls={`weekly-meeting-${meeting.id}`}
              onClick={() => toggleMeeting(meeting.id)}
            >
              <span className="meeting-date">{dateLabel(meeting.meetingDate)}</span>
              <span className="meeting-accordion-icon" aria-hidden="true">{expandedMeetings.has(meeting.id) ? "−" : "+"}</span>
            </button>
            {expandedMeetings.has(meeting.id) && (
              <div id={`weekly-meeting-${meeting.id}`} className="meeting-accordion-body">
                <div className="meeting-detail-head">
                  <div className="page-sub">{meeting.actions.filter((action) => action.status === "open").length} open · {meeting.actions.length} total actions</div>
                  <div className="meeting-controls"><Button onClick={() => editMeeting(meeting)}>Modify</Button><Button onClick={() => deleteMeeting(meeting)}>Delete</Button></div>
                </div>
                <div className="meeting-agenda"><div className="eyebrow">Agenda</div><div>{meeting.agenda}</div></div>
                <div className="meeting-actions">
                  <div className="eyebrow">Action items</div>
                  <ActionItemsEditor
                    actionItems={meeting.actions}
                    today={localToday()}
                    canEdit
                    onAdd={(input) => apply(api.addMeetingAction(meeting.id, input), "Action item added.")}
                    onToggle={(action) => apply(
                      api.updateMeetingAction(meeting.id, action.id, { status: action.status === "open" ? "closed" : "open" }),
                      action.status === "open" ? "Action item closed." : "Action item reopened.",
                    )}
                    onDelete={(action) => apply(api.removeMeetingAction(meeting.id, action.id), "Action item deleted.")}
                  />
                </div>
              </div>
            )}
          </section>
        ))}
        {!meetings.length && <div className="card"><div className="card-empty">No weekly meetings have been recorded.</div></div>}
      </div>
    </div>
  );
}
