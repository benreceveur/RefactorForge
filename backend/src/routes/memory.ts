import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ApiResponse } from '../types';
import db from '../database';
import { dbRun, dbAll } from '../utils/database-helpers';

interface MemoryRow {
  id: string;
  type: string;
  content: string;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

const router = Router();

// Store memory
router.post('/', async (req: Request, res: Response) => {
  const { type, content, metadata } = req.body;
  const id = uuidv4();

  try {
    await dbRun(
      `INSERT INTO memory (id, type, content, metadata)
       VALUES (?, ?, ?, ?)`,
      [id, type, content, JSON.stringify(metadata)]
    );
    
    res.status(201).json({
      id,
      type,
      content,
      metadata,
      message: 'Memory stored successfully',
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

// Retrieve memories
router.get('/', async (req: Request, res: Response) => {
  const { type, limit = 100 } = req.query;
  
  let query = 'SELECT * FROM memory';
  const params: (string | number)[] = [];
  
  if (type) {
    query += ' WHERE type = ?';
    params.push(type as string);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(typeof limit === 'string' ? parseInt(limit) : (limit as number));

  try {
    const rows = await dbAll<MemoryRow>(query, params);
    res.json(rows.map((row: MemoryRow) => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    })));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

// Search memories
router.get('/search', async (req: Request, res: Response) => {
  const { q } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Search query required' });
  }

  try {
    const rows = await dbAll<MemoryRow>(
      `SELECT * FROM memory 
       WHERE content LIKE ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [`%${q}%`]
    );
    
    res.json(rows.map((row: MemoryRow) => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    })));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

// Delete memory
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await dbRun('DELETE FROM memory WHERE id = ?', [id]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Memory not found' });
    }
    
    res.json({ message: 'Memory deleted successfully' });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

export default router;