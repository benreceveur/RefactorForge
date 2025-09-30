import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// REMOVED: Mock patterns data - now returns empty array
const patterns: any[] = [];
// Patterns will be populated from real repository scans when implemented

// Get all patterns
router.get('/', async (req: Request, res: Response) => {
  try {
    const { repository, category, tags } = req.query;
    
    let filteredPatterns = patterns;
    
    // Filter by repository if specified
    if (repository) {
      filteredPatterns = filteredPatterns.filter(pattern => 
        pattern.repository === repository
      );
    }
    
    // Filter by category if specified
    if (category) {
      filteredPatterns = filteredPatterns.filter(pattern => 
        pattern.category === category
      );
    }
    
    // Filter by tags if specified
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      filteredPatterns = filteredPatterns.filter(pattern =>
        pattern.tags && pattern.tags.some((tag: string) => tagArray.includes(tag))
      );
    }
    
    res.json({
      patterns: filteredPatterns,
      total: filteredPatterns.length,
      filters: { repository, category, tags }
    });
  } catch (error) {
    console.error('Error fetching patterns:', error);
    res.status(500).json({ error: 'Failed to fetch patterns' });
  }
});

// Search patterns
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const query = String(q).toLowerCase();
    const searchLimit = Math.min(parseInt(String(limit)), 100);
    
    const searchResults = patterns
      .filter(pattern =>
        pattern.content.toLowerCase().includes(query) ||
        pattern.description.toLowerCase().includes(query) ||
        pattern.tags.some((tag: string) => tag.toLowerCase().includes(query))
      )
      .slice(0, searchLimit)
      .map(pattern => ({
        ...pattern,
        relevanceScore: calculateRelevance(pattern, query)
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    res.json({
      query,
      results: searchResults,
      totalFound: searchResults.length,
      limit: searchLimit
    });
  } catch (error) {
    console.error('Error searching patterns:', error);
    res.status(500).json({ error: 'Failed to search patterns' });
  }
});

// Get pattern by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const pattern = patterns.find(p => p.id === id);
    
    if (!pattern) {
      return res.status(404).json({ error: 'Pattern not found' });
    }
    
    res.json(pattern);
  } catch (error) {
    console.error('Error fetching pattern:', error);
    res.status(500).json({ error: 'Failed to fetch pattern' });
  }
});

// Helper function to calculate search relevance
const calculateRelevance = (pattern: any, query: string): number => {
  let score = 0;
  
  // Content match
  if (pattern.content.toLowerCase().includes(query)) {
    score += 3;
  }
  
  // Description match
  if (pattern.description.toLowerCase().includes(query)) {
    score += 2;
  }
  
  // Tag match
  if (pattern.tags.some((tag: string) => tag.toLowerCase().includes(query))) {
    score += 1;
  }
  
  // Quality bonus
  score += pattern.quality || 0;
  
  return score;
};

export default router;