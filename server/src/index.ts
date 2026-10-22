import express from 'express';
import cors from 'cors';
import { createMcpServer, createStatelessTransport } from './mcp.js';
import { completeTask, createTask, getProgress, getStudyPlan, listTasks, replanDay } from './store.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);
app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(',') ?? true, exposedHeaders: ['Mcp-Session-Id'] }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'StudyFlow AI API', mcpEndpoint: '/mcp' }));
app.get('/api/tasks', (req, res) => res.json(listTasks(req.query.includeCompleted !== 'false')));
app.post('/api/tasks', (req, res) => {
  try {
    const { subject, topic, deadline, priority, estimatedMinutes } = req.body ?? {};
    if (typeof subject !== 'string' || !subject.trim() || typeof topic !== 'string' || !topic.trim() || typeof deadline !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return res.status(400).json({ error: 'subject, topic, and deadline (YYYY-MM-DD) are required.' });
    if (priority !== undefined && !['low', 'medium', 'high'].includes(priority)) return res.status(400).json({ error: 'priority must be low, medium, or high.' });
    if (estimatedMinutes !== undefined && (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 5 || estimatedMinutes > 600)) return res.status(400).json({ error: 'estimatedMinutes must be an integer from 5 to 600.' });
    res.status(201).json(createTask({ subject, topic, deadline, priority, estimatedMinutes }));
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create task' }); }
});
app.post('/api/tasks/:id/complete', (req, res) => {
  try { res.json(completeTask(Number(req.params.id))); }
  catch (error) { res.status(404).json({ error: error instanceof Error ? error.message : 'Task not found' }); }
});
app.get('/api/progress', (_req, res) => res.json(getProgress()));
app.get('/api/plan', (req, res) => res.json(getStudyPlan(typeof req.query.date === 'string' ? req.query.date : undefined)));
app.post('/api/replan', (req, res) => {
  const { availableMinutes, date } = req.body ?? {};
  if (!Number.isInteger(availableMinutes) || availableMinutes < 15 || availableMinutes > 900) return res.status(400).json({ error: 'availableMinutes must be an integer from 15 to 900.' });
  try { res.json(replanDay(availableMinutes, date)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to replan' }); }
});

// MCP endpoint: stateless Streamable HTTP. A new transport/server is created per request.
app.post('/mcp', async (req, res) => {
  const mcpServer = createMcpServer();
  const transport = createStatelessTransport();
  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => { void transport.close(); void mcpServer.close(); });
  } catch (error) {
    console.error('MCP request failed:', error);
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal MCP server error' }, id: null });
  }
});
app.get('/mcp', (_req, res) => res.status(405).set('Allow', 'POST').json({ error: 'This stateless MCP endpoint accepts POST requests.' }));
app.delete('/mcp', (_req, res) => res.status(405).set('Allow', 'POST').json({ error: 'This stateless MCP endpoint does not use sessions.' }));

app.listen(port, () => console.log(`StudyFlow API listening on http://localhost:${port} (MCP: /mcp)`));
