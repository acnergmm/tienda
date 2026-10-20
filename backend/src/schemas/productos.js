import { z } from 'zod';

export const listarProductosQuery = z.object({
  categoria: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Categoría inválida')
    .max(100)
    .optional(),
  q: z.string().trim().max(100).optional(),
});

export const productoIdParams = z.object({
  id: z.coerce.number().int().positive(),
});
