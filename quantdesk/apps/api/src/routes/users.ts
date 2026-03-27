import { Router } from 'express';
import { findById, updateProfile } from '../services/db/userService';

const router = Router();

/** GET /api/users/me */
router.get('/me', (req, res) => {
  res.json({ user: req.user });
});

/** PATCH /api/users/me */
router.patch('/me', async (req, res) => {
  const { display_name, firm, role, photo_url } = req.body as {
    display_name?: string;
    firm?:         string;
    role?:         string;
    photo_url?:    string;
  };

  const updated = await updateProfile(req.user.id, { display_name, firm, role, photo_url });
  res.json({ user: updated });
});

/** GET /api/users/:id (basic public profile) */
router.get('/:id', async (req, res) => {
  const user = await findById(req.params.id);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  // Return only public fields
  res.json({
    id:           user.id,
    display_name: user.display_name,
    photo_url:    user.photo_url,
    firm:         user.firm,
    role:         user.role,
  });
});

export default router;
