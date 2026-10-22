import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const dataDir = path.resolve(process.env.DATA_DIR ?? './data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'studyflow.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    deadline TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    estimated_minutes INTEGER NOT NULL DEFAULT 30,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    planned_date TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

export type Priority = 'low' | 'medium' | 'high';
export type TaskInput = { subject: string; topic: string; deadline: string; priority?: Priority; estimatedMinutes?: number };

export function createTask(input: TaskInput) {
  const stmt = db.prepare(`INSERT INTO tasks(subject, topic, deadline, priority, estimated_minutes) VALUES (?, ?, ?, ?, ?)`);
  const result = stmt.run(input.subject.trim(), input.topic.trim(), input.deadline, input.priority ?? 'medium', input.estimatedMinutes ?? 30);
  return getTask(Number(result.lastInsertRowid));
}

export function listTasks(includeCompleted = true) {
  const where = includeCompleted ? '' : 'WHERE completed = 0';
  return db.prepare(`SELECT id, subject, topic, deadline, priority, estimated_minutes AS estimatedMinutes, completed, created_at AS createdAt FROM tasks ${where} ORDER BY completed ASC, deadline ASC, CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END`).all();
}

export function getTask(id: number) {
  return db.prepare(`SELECT id, subject, topic, deadline, priority, estimated_minutes AS estimatedMinutes, completed, created_at AS createdAt FROM tasks WHERE id = ?`).get(id);
}

export function completeTask(id: number) {
  const result = db.prepare('UPDATE tasks SET completed = 1 WHERE id = ?').run(id);
  if (!result.changes) throw new Error(`Task ${id} was not found`);
  return getTask(id);
}

export function getProgress() {
  const summary = db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed, SUM(CASE WHEN completed = 0 THEN estimated_minutes ELSE 0 END) AS remainingMinutes FROM tasks`).get() as { total: number; completed: number | null; remainingMinutes: number | null };
  return { total: summary.total, completed: summary.completed ?? 0, pending: summary.total - (summary.completed ?? 0), remainingMinutes: summary.remainingMinutes ?? 0, completionPercent: summary.total ? Math.round(((summary.completed ?? 0) / summary.total) * 100) : 0 };
}

export function replanDay(availableMinutes: number, date = new Date().toISOString().slice(0, 10)) {
  const tasks = db.prepare(`SELECT id, subject, topic, deadline, priority, estimated_minutes AS estimatedMinutes FROM tasks WHERE completed = 0 ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, deadline ASC`).all() as Array<{id:number;subject:string;topic:string;deadline:string;priority:Priority;estimatedMinutes:number}>;
  let remaining = availableMinutes;
  const plan = tasks.map(task => {
    const duration = Math.min(task.estimatedMinutes, Math.max(0, remaining));
    remaining -= duration;
    return { taskId: task.id, subject: task.subject, topic: task.topic, deadline: task.deadline, priority: task.priority, plannedMinutes: duration, status: duration === 0 ? 'move to another day' : duration < task.estimatedMinutes ? 'shortened session' : 'planned' };
  });
  const insert = db.prepare('INSERT INTO sessions(task_id, planned_date, duration_minutes) VALUES (?, ?, ?)');
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM sessions WHERE planned_date = ? AND completed = 0').run(date);
    for (const item of plan) if (item.plannedMinutes > 0) insert.run(item.taskId, date, item.plannedMinutes);
  });
  transaction();
  return { date, availableMinutes, scheduledMinutes: availableMinutes - remaining, plan, note: remaining > 0 ? `${remaining} minutes remain unallocated.` : 'Time is allocated to the highest-priority unfinished tasks first.' };
}

export function getStudyPlan(date = new Date().toISOString().slice(0, 10)) {
  const sessions = db.prepare(`SELECT s.id, s.task_id AS taskId, s.planned_date AS plannedDate, s.duration_minutes AS durationMinutes, s.completed, t.subject, t.topic, t.deadline, t.priority FROM sessions s JOIN tasks t ON t.id = s.task_id WHERE s.planned_date = ? ORDER BY t.deadline ASC`).all(date);
  return { date, sessions, tasks: listTasks(false) };
}

export function completeSession(sessionId: number) {
  const result = db.prepare('UPDATE sessions SET completed = 1 WHERE id = ?').run(sessionId);
  if (!result.changes) throw new Error(`Session ${sessionId} was not found`);
  return db.prepare('SELECT id, task_id AS taskId, planned_date AS plannedDate, duration_minutes AS durationMinutes, completed FROM sessions WHERE id = ?').get(sessionId);
}
