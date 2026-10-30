import { useEffect, useState } from "react";
import type { WeeklyMeeting, WeeklyMeetingAction } from "../../shared/types.ts";
import { api } from "../api.ts";
import { dateLabel } from "../lib/format.ts";
import { Button, Field, showConfirm, showToast, TextArea, TextInput } from "./ui.tsx";

type MeetingForm = { id: number | null; meetingDate: string; agenda: string };
type ActionForm = { description: string; assignedTo: string };
const blankAction = (): ActionForm => ({ description: "", assignedTo: "" });
const localToday = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

export function WeeklyMeetingsPage() {
  const [meetings, setMeetings] = useState<WeeklyMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meetingForm, setMeetingForm] = useState<MeetingForm | null>(null);
  const [actionForms, setActionForms] = useState<Record<number, ActionForm>>({});
  const [editingAction, setEditingAction] = useState<{ meetingId: number; action: WeeklyMeetingAction } | null>(null);

  useEffect(() => {
    api.getWeeklyMeetings()
      .then((data) => setMeetings(data.meetings))
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
    const input = { meetingDate: meetingForm.meetingDate, agenda: meetingForm.agenda.trim() };
    const ok = await apply(
      meetingForm.id === null ? api.createWeeklyMeeting(input) : api.updateWeeklyMeeting(meetingForm.id, input),
      meetingForm.id === null ? "Weekly meeting created." : "Weekly meeting updated.",
    );
    if (ok) setMeetingForm(null);
  };

  const deleteMeeting = async (meeting: WeeklyMeeting) => {
    const confirmed = await showConfirm("Delete weekly meeting?", `${dateLabel(meeting.meetingDate)} and its ${meeting.actions.length} action item(s) will be deleted. The deletion will remain in the audit log.`);
    if (confirmed) await apply(api.removeWeeklyMeeting(meeting.id), "Weekly meeting deleted.");
  };

  const addAction = async (meetingId: number) => {
    const form = actionForms[meetingId] || blankAction();
    if (!form.description.trim() || !form.assignedTo.trim()) {
      setError("Action description and Assigned To are required.");
      return;
    }
    const ok = await apply(api.addMeetingAction(meetingId, form), "Action item added.");
    if (ok) setActionForms((forms) => ({ ...forms, [meetingId]: blankAction() }));
  };

  const saveAction = async () => {
    if (!editingAction) return;
    const { meetingId, action } = editingAction;
    if (!action.description.trim() || !action.assignedTo.trim()) {
      setError("Action description and Assigned To are required.");
      return;
    }
    const ok = await apply(api.updateMeetingAction(meetingId, action.id, {
      description: action.description.trim(), assignedTo: action.assignedTo.trim(),
    }), "Action item updated.");
    if (ok) setEditingAction(null);
  };

  const toggleAction = (meetingId: number, action: WeeklyMeetingAction) =>
    apply(api.updateMeetingAction(meetingId, action.id, { status: action.status === "open" ? "closed" : "open" }), action.status === "open" ? "Action item closed." : "Action item reopened.");

  const deleteAction = async (meetingId: number, action: WeeklyMeetingAction) => {
    if (await showConfirm("Delete action item?", action.description)) {
      await apply(api.removeMeetingAction(meetingId, action.id), "Action item deleted.");
    }
  };

  if (loading) return <div className="loading">Loading weekly meetings…</div>;

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Weekly Meetings</h1><div className="page-sub">Meeting agendas and accountable action items, newest meeting first.</div></div>
        <Button primary onClick={() => setMeetingForm({ id: null, meetingDate: localToday(), agenda: "" })}>+ Add weekly meeting</Button>
      </div>

      {error && <div className="notice error"><div><span>{error}</span><button type="button" onClick={() => setError(null)}>Dismiss</button></div></div>}

      {meetingForm && (
        <div className="form-card">
          <div className="form-head">{meetingForm.id === null ? "Add weekly meeting" : "Modify weekly meeting"}</div>
          <div className="form-body">
            <Field label="Meeting date"><TextInput type="date" value={meetingForm.meetingDate} onChange={(meetingDate) => setMeetingForm({ ...meetingForm, meetingDate })} /></Field>
            <Field label="Meeting agenda"><TextArea rows={6} value={meetingForm.agenda} onChange={(agenda) => setMeetingForm({ ...meetingForm, agenda })} /></Field>
            <div className="form-actions"><Button onClick={() => setMeetingForm(null)}>Cancel</Button><Button primary onClick={saveMeeting}>Save meeting</Button></div>
          </div>
        </div>
      )}

      <div className="meeting-list">
        {meetings.map((meeting) => {
          const actionForm = actionForms[meeting.id] || blankAction();
          return (
            <section className="card meeting-card" key={meeting.id}>
              <div className="card-head wide meeting-head">
                <div><div className="meeting-date">{dateLabel(meeting.meetingDate)}</div><div className="page-sub">{meeting.actions.filter((action) => action.status === "open").length} open · {meeting.actions.length} total actions</div></div>
                <div className="meeting-controls"><Button onClick={() => setMeetingForm({ id: meeting.id, meetingDate: meeting.meetingDate, agenda: meeting.agenda })}>Modify</Button><Button onClick={() => deleteMeeting(meeting)}>Delete</Button></div>
              </div>
              <div className="meeting-agenda"><div className="eyebrow">Agenda</div><div>{meeting.agenda}</div></div>
              <div className="meeting-actions">
                <div className="eyebrow">Action items</div>
                {meeting.actions.map((action) => {
                  const isEditing = editingAction?.meetingId === meeting.id && editingAction.action.id === action.id;
                  return (
                    <div className={`meeting-action ${action.status}`} key={action.id}>
                      {isEditing && editingAction ? (
                        <>
                          <Field label="Action description"><TextInput value={editingAction.action.description} onChange={(description) => setEditingAction({ ...editingAction, action: { ...editingAction.action, description } })} /></Field>
                          <Field label="Assigned to"><TextInput value={editingAction.action.assignedTo} onChange={(assignedTo) => setEditingAction({ ...editingAction, action: { ...editingAction.action, assignedTo } })} /></Field>
                          <div className="meeting-action-buttons"><Button onClick={() => setEditingAction(null)}>Cancel</Button><Button primary onClick={saveAction}>Save</Button></div>
                        </>
                      ) : (
                        <>
                          <span className={`status-pill ${action.status}`}>{action.status}</span>
                          <div><div className="meeting-action-description">{action.description}</div><div className="page-sub">Assigned to {action.assignedTo}{action.closedAt ? ` · Closed ${new Date(action.closedAt).toLocaleString()}` : ""}</div></div>
                          <div className="meeting-action-buttons">
                            <Button onClick={() => setEditingAction({ meetingId: meeting.id, action: { ...action } })}>Edit</Button>
                            <Button onClick={() => toggleAction(meeting.id, action)}>{action.status === "open" ? "Close" : "Reopen"}</Button>
                            <Button onClick={() => deleteAction(meeting.id, action)}>Delete</Button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                {!meeting.actions.length && <div className="card-empty meeting-empty">No action items for this meeting.</div>}
              </div>
              <div className="add-row meeting-action-form">
                <Field label="Action description" style={{ flex: 2 }}><TextInput value={actionForm.description} onChange={(description) => setActionForms((forms) => ({ ...forms, [meeting.id]: { ...actionForm, description } }))} /></Field>
                <Field label="Assigned to" style={{ flex: 1 }}><TextInput value={actionForm.assignedTo} onChange={(assignedTo) => setActionForms((forms) => ({ ...forms, [meeting.id]: { ...actionForm, assignedTo } }))} /></Field>
                <Button primary onClick={() => addAction(meeting.id)}>Add action</Button>
              </div>
            </section>
          );
        })}
        {!meetings.length && <div className="card"><div className="card-empty">No weekly meetings have been recorded.</div></div>}
      </div>
    </div>
  );
}
