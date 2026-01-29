import { Router } from 'express';
import { downloadAttachment } from '../services/attachment.service.js';

const router = Router();

// Melléklet letöltés
router.get('/:id/download', async (req, res) => {
  try {
    const result = await downloadAttachment(req.params.id);

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(result.filename)}"`,
    );
    res.setHeader('Content-Length', result.data.length);
    res.send(result.data);
  } catch (error) {
    console.error('Melléklet letöltés hiba:', error);
    res.status(404).json({ error: 'Melléklet nem található' });
  }
});

export default router;
