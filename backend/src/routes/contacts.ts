import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../utils/database-helpers';
import { ContactRow } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError, NotFoundError } from '../errors/AppError';
import { logger } from '../utils/logger';

const router = Router();

// Get all contacts
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  logger.info('Fetching all contacts');
  
  const contacts = await dbAll<ContactRow>('SELECT * FROM contacts ORDER BY updated_at DESC');
  
  logger.info(`Retrieved ${contacts.length} contacts`);
  res.json(contacts);
}));

// Get single contact
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    throw new ValidationError('Valid contact ID is required');
  }
  
  logger.info(`Fetching contact with ID: ${id}`);
  
  const contact = await dbGet<ContactRow>('SELECT * FROM contacts WHERE id = ?', [id]);
  
  if (!contact) {
    throw new NotFoundError('Contact', id);
  }
  
  logger.info(`Retrieved contact: ${contact.name}`);
  res.json(contact);
}));

// Create contact
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name, email, phone, context } = req.body;
  
  // Validate required fields
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw ValidationError.missingField('name');
  }
  
  if (email && (typeof email !== 'string' || !email.includes('@'))) {
    throw ValidationError.invalidFormat('email', 'valid email address', email);
  }
  
  const id = uuidv4();
  const now = new Date().toISOString();
  
  logger.info('Creating new contact', { 
    name: name.trim(),
    hasEmail: !!email,
    hasPhone: !!phone
  });

  await dbRun(
    `INSERT INTO contacts (id, name, email, phone, context, last_interaction, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name.trim(), email, phone, context, now, now, now]
  );
  
  const newContact: ContactRow = {
    id,
    name: name.trim(),
    email,
    phone,
    context,
    last_interaction: now,
    created_at: now,
    updated_at: now,
  };
  
  logger.info(`Contact created successfully: ${newContact.name}`, { contactId: id });
  res.status(201).json(newContact);
}));

// Update contact
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, phone, context } = req.body;
  
  if (!id || typeof id !== 'string') {
    throw new ValidationError('Valid contact ID is required');
  }
  
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw ValidationError.missingField('name');
  }
  
  if (email && (typeof email !== 'string' || !email.includes('@'))) {
    throw ValidationError.invalidFormat('email', 'valid email address', email);
  }
  
  const now = new Date().toISOString();
  
  logger.info(`Updating contact with ID: ${id}`, { name: name.trim() });

  const result = await dbRun(
    `UPDATE contacts 
     SET name = ?, email = ?, phone = ?, context = ?, updated_at = ?, last_interaction = ?
     WHERE id = ?`,
    [name.trim(), email, phone, context, now, now, id]
  );
  
  if (result.changes === 0) {
    throw new NotFoundError('Contact', id);
  }
  
  logger.info(`Contact updated successfully: ${name.trim()}`, { contactId: id });
  res.json({ message: 'Contact updated successfully', id });
}));

// Delete contact
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id || typeof id !== 'string') {
    throw new ValidationError('Valid contact ID is required');
  }
  
  logger.info(`Deleting contact with ID: ${id}`);

  const result = await dbRun('DELETE FROM contacts WHERE id = ?', [id]);
  
  if (result.changes === 0) {
    throw new NotFoundError('Contact', id);
  }
  
  logger.audit('Contact deleted', { contactId: id });
  res.json({ message: 'Contact deleted successfully', id });
}));

export default router;