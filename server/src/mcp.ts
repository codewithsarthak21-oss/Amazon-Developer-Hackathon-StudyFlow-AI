import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { completeSession, completeTask, createTask, getProgress, getStudyPlan, listTasks, replanDay } from './store.js';

export function createMcpServer() {
  const server = new McpServer({ name: 'studyflow-ai', version: '1.0.0' });

  server.registerTool('create_task', {
    title: 'Create study task',
    description: 'Create and persist a study task with subject, topic, deadline, priority, and estimated duration.',
    inputSchema: {
      subject: z.string().min(1).max(100),
      topic: z.string().min(1).max(200),
      deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      estimatedMinutes: z.number().int().min(5).max(600).optional()
    }
  }, async (input) => ({ content: [{ type: 'text', text: JSON.stringify(createTask(input)) }] }));

  server.registerTool('get_study_plan', {
    title: 'Get study plan', description: 'Get the study sessions scheduled for a date and all unfinished tasks.',
    inputSchema: { date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }
  }, async ({ date }) => ({ content: [{ type: 'text', text: JSON.stringify(getStudyPlan(date)) }] }));

  server.registerTool('complete_session', {
    title: 'Complete study session', description: 'Mark a saved study session as completed.',
    inputSchema: { sessionId: z.number().int().positive() }
  }, async ({ sessionId }) => ({ content: [{ type: 'text', text: JSON.stringify(completeSession(sessionId)) }] }));

  server.registerTool('get_progress', {
    title: 'Get study progress', description: 'Summarize total tasks, completed tasks, pending tasks, remaining study minutes, and completion percentage.',
    inputSchema: {}
  }, async () => ({ content: [{ type: 'text', text: JSON.stringify(getProgress()) }] }));

  server.registerTool('replan_day', {
   title: 'Rescue my study day', description: "Rebuild today's plan from unfinished tasks using the available time, prioritizing high priority and earlier deadlines.",
    inputSchema: { availableMinutes: z.number().int().min(15).max(900), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }
  }, async ({ availableMinutes, date }) => ({ content: [{ type: 'text', text: JSON.stringify(replanDay(availableMinutes, date)) }] }));

  server.registerTool('list_tasks', {
    title: 'List study tasks', description: 'List saved tasks, optionally including completed tasks.',
    inputSchema: { includeCompleted: z.boolean().optional() }
  }, async ({ includeCompleted }) => ({ content: [{ type: 'text', text: JSON.stringify(listTasks(includeCompleted ?? true)) }] }));

  server.registerTool('complete_task', {
    title: 'Complete task', description: 'Mark a study task as completed.',
    inputSchema: { taskId: z.number().int().positive() }
  }, async ({ taskId }) => ({ content: [{ type: 'text', text: JSON.stringify(completeTask(taskId)) }] }));

  return server;
}

export function createStatelessTransport() {
  return new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
}
